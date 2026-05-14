import { Router, Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../db/client';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { audit } from '../utils/audit';

const router = Router();

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

// Ensure the upload directory exists AND is writable at boot — surfaces a
// clear error in the logs instead of a cryptic ENOENT/EACCES at request time.
function ensureUploadDir(): boolean {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.accessSync(UPLOAD_DIR, fs.constants.W_OK);
    return true;
  } catch (err) {
    console.error(`[documents] UPLOAD_DIR not writable at ${UPLOAD_DIR}:`, err);
    return false;
  }
}
ensureUploadDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!ensureUploadDir()) {
      cb(new Error('Upload storage is not writable on the server'), UPLOAD_DIR);
      return;
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const safe = (file.originalname || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    // Accept by mimetype OR .pdf extension — some browsers send octet-stream
    const isPdf = file.mimetype === 'application/pdf'
      || /\.pdf$/i.test(file.originalname || '');
    if (isPdf) cb(null, true);
    else cb(new Error('Only PDF files are accepted'));
  },
});

/**
 * Wraps multer's `single('file')` so its errors return clean 4xx JSON instead
 * of bubbling to the global handler as an opaque 500.
 */
function uploadSingle(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'PDF is larger than the 25 MB limit.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    const message = err instanceof Error ? err.message : 'Upload failed';
    // Filter rejections + "not writable" land here
    return res.status(400).json({ error: message });
  });
}

async function extractPdfText(filePath: string): Promise<{ text: string; pages: number }> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return { text: result.text || '', pages: result.total || result.pages?.length || 0 };
  } catch (err) {
    console.error('[pdf-parse] failed:', err);
    return { text: '', pages: 0 };
  }
}

// ─── GET /api/documents ──────────────────────────────────────────
// Admin: all docs. Tutor/Student: docs that appear in packs they can see.
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, userId } = req.user!;
    if (role === 'ADMIN') {
      const docs = await prisma.pdfDocument.findMany({
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
      });
      return res.json(docs);
    }
    if (role === 'TUTOR') {
      const shares = await prisma.packShare.findMany({
        where: { tutorId: userId },
        include: { pack: { include: { documents: { include: { document: true } } } } },
      });
      const docMap = new Map<string, typeof shares[0]['pack']['documents'][0]['document']>();
      shares.forEach((s) => s.pack.documents.forEach((pd) => docMap.set(pd.document.id, pd.document)));
      return res.json(Array.from(docMap.values()));
    }
    // STUDENT
    const unlocks = await prisma.studentUnlock.findMany({
      where: { studentId: userId },
      include: { pack: { include: { documents: { include: { document: true } } } } },
    });
    const docMap = new Map<string, typeof unlocks[0]['pack']['documents'][0]['document']>();
    unlocks.forEach((u) => u.pack.documents.forEach((pd) => docMap.set(pd.document.id, pd.document)));
    return res.json(Array.from(docMap.values()));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/documents/upload ──────────────────────────────────  (ADMIN)
router.post('/upload', authMiddleware, adminOnly, uploadSingle, async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file received. Pick a PDF and try again.' });

    // Confirm the file actually landed on disk before we commit a DB row
    if (!fs.existsSync(req.file.path)) {
      console.error('[documents] multer reported a file but it is not on disk:', req.file.path);
      return res.status(500).json({ error: 'Upload could not be saved on the server. Contact the admin.' });
    }

    const { title, description, documentKind } = req.body as {
      title?: string; description?: string; documentKind?: string;
    };

    // pdf-parse is best-effort — never let a bad parse block the upload
    const { text, pages } = await extractPdfText(req.file.path);

    const doc = await prisma.pdfDocument.create({
      data: {
        title: (title || req.file.originalname || 'Document').trim().slice(0, 200),
        description: description?.trim() || null,
        filePath: path.basename(req.file.path),
        fileSize: req.file.size,
        pageCount: pages,
        extractedText: (text || '').slice(0, 50000), // cap stored excerpt
        documentKind: ['practice', 'test', 'notes'].includes(documentKind || '') ? documentKind! : 'practice',
        uploadedById: req.user!.userId,
      },
    });

    await audit(req, 'document.upload', 'PdfDocument', doc.id, {
      title: doc.title, fileSize: doc.fileSize, pageCount: doc.pageCount, kind: doc.documentKind,
    });
    return res.status(201).json(doc);
  } catch (err: unknown) {
    console.error('[documents/upload]', err);
    // Clean up the orphaned file if the DB write failed
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
    return res.status(500).json({ error: 'Could not save the document. Please try again.' });
  }
});

// ─── GET /api/documents/:id/file  — stream the PDF (auth gated) ──
router.get('/:id/file', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, userId } = req.user!;
    const doc = await prisma.pdfDocument.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    // Authorization
    if (role !== 'ADMIN') {
      // Must appear in a pack shared with the tutor / unlocked for the student
      const linked = await prisma.packDocument.findMany({
        where: { documentId: doc.id },
        select: { packId: true },
      });
      const packIds = linked.map((l) => l.packId);
      if (!packIds.length) return res.status(403).json({ error: 'Forbidden' });

      if (role === 'TUTOR') {
        const share = await prisma.packShare.findFirst({
          where: { tutorId: userId, packId: { in: packIds } },
        });
        if (!share) return res.status(403).json({ error: 'Forbidden' });
      } else if (role === 'STUDENT') {
        const unlock = await prisma.studentUnlock.findFirst({
          where: { studentId: userId, packId: { in: packIds } },
        });
        if (!unlock) return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const fp = path.join(UPLOAD_DIR, doc.filePath);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File missing' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.title}.pdf"`);
    return fs.createReadStream(fp).pipe(res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── PUT /api/documents/:id  — update metadata (ADMIN) ───────────
router.put('/:id', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { title, description, documentKind } = req.body;
    const doc = await prisma.pdfDocument.update({
      where: { id: req.params.id },
      data: {
        title: title?.trim(),
        description,
        documentKind,
      },
    });
    return res.json(doc);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /api/documents/:id  (ADMIN) ──────────────────────────
router.delete('/:id', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const doc = await prisma.pdfDocument.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const fp = path.join(UPLOAD_DIR, doc.filePath);
    if (fs.existsSync(fp)) {
      try { fs.unlinkSync(fp); } catch (e) { console.error('unlink failed', e); }
    }
    await prisma.pdfDocument.delete({ where: { id: req.params.id } });
    await audit(req, 'document.delete', 'PdfDocument', req.params.id, { title: doc.title });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
