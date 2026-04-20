import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOnly, adminOrTutorOnly } from '../middleware/auth';

const router = Router();

// GET /api/calendar/notes
router.get('/notes', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const notes = await prisma.calendarNote.findMany({ orderBy: { date: 'asc' } });
    return res.json(notes);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/calendar/notes
router.post('/notes', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { date, title, content, color } = req.body as {
      date: string; title: string; content?: string; color?: string;
    };
    if (!date || !title?.trim()) return res.status(400).json({ error: 'Date and title required' });

    const note = await prisma.calendarNote.create({
      data: {
        date,
        title: title.trim(),
        content: content || null,
        color: color || 'note',
        createdById: req.user!.userId,
      },
    });
    return res.status(201).json(note);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/calendar/notes/:id
router.put('/notes/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { date, title, content, color } = req.body;
    const note = await prisma.calendarNote.update({
      where: { id: req.params.id },
      data: { date, title: title?.trim(), content, color },
    });
    return res.json(note);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/calendar/notes/:id
router.delete('/notes/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    await prisma.calendarNote.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/calendar/requests — student creates a request
router.post('/requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Student access required' });
    }
    const { noteId, message } = req.body as { noteId: string; message: string };
    if (!noteId || !message?.trim()) {
      return res.status(400).json({ error: 'noteId and message are required' });
    }

    const student = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { name: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const request = await prisma.calendarRequest.create({
      data: {
        noteId,
        studentId: req.user!.userId,
        studentName: student.name,
        message: message.trim(),
      },
    });
    return res.status(201).json(request);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/calendar/requests — admin gets all pending requests
router.get('/requests', authMiddleware, adminOrTutorOnly, async (_req: Request, res: Response) => {
  try {
    const requests = await prisma.calendarRequest.findMany({
      where: { status: 'pending' },
      include: {
        note: true,
        student: { select: { id: true, name: true, grade: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/calendar/requests/:id — admin approves/denies
router.patch('/requests/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status: 'approved' | 'denied' };
    if (!['approved', 'denied'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or denied' });
    }
    const updated = await prisma.calendarRequest.update({
      where: { id: req.params.id },
      data: { status },
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
