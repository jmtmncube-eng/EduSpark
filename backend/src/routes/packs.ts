import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOnly, adminOrTutorOnly } from '../middleware/auth';
import { Subject } from '@prisma/client';
import { notify } from '../utils/notify';
import { renderPackPdf } from '../utils/pdfRenderer';

const router = Router();

const subjectMap: Record<string, Subject> = {
  mathematics: 'MATHEMATICS',
  physical_sciences: 'PHYSICAL_SCIENCES',
  MATHEMATICS: 'MATHEMATICS',
  PHYSICAL_SCIENCES: 'PHYSICAL_SCIENCES',
};

const packInclude = {
  questions: {
    include: { question: true },
    orderBy: { order: 'asc' as const },
  },
  documents: {
    include: { document: true },
    orderBy: { order: 'asc' as const },
  },
  createdBy: { select: { id: true, name: true, role: true } },
  _count: { select: { shares: true, unlocks: true } },
};

// ─── GET /api/packs ──────────────────────────────────────────────
// ADMIN: all packs
// TUTOR: only packs shared with them
// STUDENT: only packs unlocked for them by their tutor
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, userId } = req.user!;

    if (role === 'ADMIN') {
      const packs = await prisma.pack.findMany({
        where: { archived: false },
        include: packInclude,
        orderBy: { createdAt: 'desc' },
      });
      return res.json(packs);
    }

    if (role === 'TUTOR') {
      // Tutor sees: admin packs shared with them + packs they themselves created
      const [shares, owned] = await Promise.all([
        prisma.packShare.findMany({
          where: { tutorId: userId },
          include: { pack: { include: packInclude } },
          orderBy: { sharedAt: 'desc' },
        }),
        prisma.pack.findMany({
          where: { createdById: userId, archived: false },
          include: packInclude,
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      const sharedPacks = shares
        .filter((s) => !s.pack.archived)
        .map((s) => ({ ...s.pack, sharedAt: s.sharedAt, shareNote: s.note, source: 'admin' as const }));
      const ownPacks = owned.map((p) => ({ ...p, source: 'own' as const }));
      // De-dupe (e.g. tutor created a pack and admin happened to share something pointing at it — unlikely but safe)
      const seen = new Set<string>();
      const merged = [...ownPacks, ...sharedPacks].filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id); return true;
      });
      return res.json(merged);
    }

    // STUDENT
    const unlocks = await prisma.studentUnlock.findMany({
      where: { studentId: userId },
      include: { pack: { include: packInclude } },
      orderBy: { unlockedAt: 'desc' },
    });
    const packs = unlocks
      .filter((u) => !u.pack.archived)
      .map((u) => ({ ...u.pack, unlockedAt: u.unlockedAt }));
    return res.json(packs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/packs/:id ──────────────────────────────────────────
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, userId } = req.user!;
    const pack = await prisma.pack.findUnique({
      where: { id: req.params.id },
      include: { ...packInclude, shares: { include: { tutor: { select: { id: true, name: true } } } } },
    });
    if (!pack) return res.status(404).json({ error: 'Not found' });

    // visibility gate
    if (role === 'TUTOR') {
      const isOwn = pack.createdById === userId;
      if (!isOwn) {
        const share = await prisma.packShare.findUnique({
          where: { packId_tutorId: { packId: pack.id, tutorId: userId } },
        });
        if (!share) return res.status(403).json({ error: 'Not shared with you' });
      }
    } else if (role === 'STUDENT') {
      const unlock = await prisma.studentUnlock.findUnique({
        where: { studentId_packId: { studentId: userId, packId: pack.id } },
      });
      if (!unlock) return res.status(403).json({ error: 'Not unlocked for you' });
    }

    return res.json(pack);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/packs ─────────────────────────────────────────────  (ADMIN or TUTOR creates own pack)
router.post('/', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { title, description, subject, grade, topic, coverEmoji, questionIds, documentIds } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

    const pack = await prisma.pack.create({
      data: {
        title: title.trim(),
        description: description || null,
        subject: subjectMap[subject] || 'MATHEMATICS',
        grade: Number(grade) || 10,
        topic: topic || null,
        coverEmoji: coverEmoji || '📦',
        createdById: req.user!.userId,
        questions: {
          create: (questionIds || []).map((qId: string, order: number) => ({ questionId: qId, order })),
        },
        documents: {
          create: (documentIds || []).map((dId: string, order: number) => ({ documentId: dId, order })),
        },
      },
      include: packInclude,
    });

    return res.status(201).json(pack);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── PUT /api/packs/:id ──────────────────────────────────────────  (owner only)
router.put('/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    // Tutor can only edit their own packs; admin can edit any pack THEY created (not tutor packs)
    const existing = await prisma.pack.findUnique({ where: { id: req.params.id }, select: { createdById: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role === 'TUTOR' && existing.createdById !== req.user!.userId) {
      return res.status(403).json({ error: 'Not your pack' });
    }
    if (req.user!.role === 'ADMIN' && existing.createdById !== req.user!.userId) {
      // Admin can edit any admin-created pack, but not tutor-owned packs
      const creator = await prisma.user.findUnique({ where: { id: existing.createdById }, select: { role: true } });
      if (creator?.role === 'TUTOR') return res.status(403).json({ error: "Cannot edit a tutor's pack" });
    }

    const { title, description, subject, grade, topic, coverEmoji, questionIds, documentIds } = req.body;

    // refresh items if provided
    if (Array.isArray(questionIds)) {
      await prisma.packQuestion.deleteMany({ where: { packId: req.params.id } });
    }
    if (Array.isArray(documentIds)) {
      await prisma.packDocument.deleteMany({ where: { packId: req.params.id } });
    }

    const pack = await prisma.pack.update({
      where: { id: req.params.id },
      data: {
        title: title?.trim(),
        description,
        subject: subject ? (subjectMap[subject] as Subject) : undefined,
        grade: grade ? Number(grade) : undefined,
        topic,
        coverEmoji,
        ...(Array.isArray(questionIds) && {
          questions: {
            create: questionIds.map((qId: string, order: number) => ({ questionId: qId, order })),
          },
        }),
        ...(Array.isArray(documentIds) && {
          documents: {
            create: documentIds.map((dId: string, order: number) => ({ documentId: dId, order })),
          },
        }),
      },
      include: packInclude,
    });

    return res.json(pack);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /api/packs/:id ───────────────────────────────────────  (owner only)
router.delete('/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const existing = await prisma.pack.findUnique({ where: { id: req.params.id }, select: { createdById: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role === 'TUTOR' && existing.createdById !== req.user!.userId) {
      return res.status(403).json({ error: 'Not your pack' });
    }
    await prisma.pack.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/packs/:id/share ───────────────────────────────────  (ADMIN shares with TUTOR)
router.post('/:id/share', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { tutorIds, note } = req.body as { tutorIds: string[]; note?: string };
    if (!Array.isArray(tutorIds) || !tutorIds.length) return res.status(400).json({ error: 'tutorIds required' });

    const pack = await prisma.pack.findUnique({ where: { id: req.params.id } });
    if (!pack) return res.status(404).json({ error: 'Pack not found' });

    const tutors = await prisma.user.findMany({ where: { id: { in: tutorIds }, role: 'TUTOR' } });

    for (const tutor of tutors) {
      await prisma.packShare.upsert({
        where: { packId_tutorId: { packId: pack.id, tutorId: tutor.id } },
        update: { note: note || null, sharedAt: new Date(), sharedById: req.user!.userId },
        create: {
          packId: pack.id,
          tutorId: tutor.id,
          sharedById: req.user!.userId,
          note: note || null,
        },
      });
      await notify({
        userId: tutor.id,
        type: 'pack_shared',
        title: `📦 New pack: ${pack.title}`,
        body: `Admin has shared this pack with you. ${note || ''}`.trim(),
        link: `/app/library/${pack.id}`,
      });
    }

    return res.json({ shared: tutors.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /api/packs/:id/share/:tutorId ────────────────────────  (unshare)
router.delete('/:id/share/:tutorId', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    await prisma.packShare.delete({
      where: { packId_tutorId: { packId: req.params.id, tutorId: req.params.tutorId } },
    });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/packs/:id/unlock ──────────────────────────────────  (TUTOR unlocks for STUDENTS)
router.post('/:id/unlock', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'TUTOR') return res.status(403).json({ error: 'Tutors only' });
    const { studentIds } = req.body as { studentIds: string[] };
    if (!Array.isArray(studentIds) || !studentIds.length) return res.status(400).json({ error: 'studentIds required' });

    // Verify tutor has access to pack — either shared with them OR they created it
    const pack = await prisma.pack.findUnique({ where: { id: req.params.id } });
    if (!pack) return res.status(404).json({ error: 'Pack not found' });
    const isOwn = pack.createdById === req.user!.userId;
    if (!isOwn) {
      const share = await prisma.packShare.findUnique({
        where: { packId_tutorId: { packId: req.params.id, tutorId: req.user!.userId } },
      });
      if (!share) return res.status(403).json({ error: 'Pack not shared with you' });
    }

    // Verify all students belong to this tutor
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds }, role: 'STUDENT', teacherId: req.user!.userId },
    });

    for (const student of students) {
      await prisma.studentUnlock.upsert({
        where: { studentId_packId: { studentId: student.id, packId: pack.id } },
        update: { unlockedById: req.user!.userId, unlockedAt: new Date() },
        create: {
          studentId: student.id,
          packId: pack.id,
          unlockedById: req.user!.userId,
        },
      });
      await notify({
        userId: student.id,
        type: 'pack_unlocked',
        title: `🔓 New practice unlocked: ${pack.title}`,
        body: 'Your tutor has unlocked a new practice pack for you.',
        link: `/app/practice`,
      });
    }

    return res.json({ unlocked: students.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /api/packs/:id/unlock/:studentId ────────────────────  (TUTOR revokes unlock)
router.delete('/:id/unlock/:studentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'TUTOR') return res.status(403).json({ error: 'Tutors only' });
    const unlock = await prisma.studentUnlock.findUnique({
      where: { studentId_packId: { studentId: req.params.studentId, packId: req.params.id } },
    });
    if (!unlock) return res.status(404).json({ error: 'Not unlocked' });
    if (unlock.unlockedById !== req.user!.userId) return res.status(403).json({ error: 'Not yours' });
    await prisma.studentUnlock.delete({ where: { id: unlock.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/packs/:id/unlocks ─────────────────────────────────  (TUTOR: who has this pack unlocked)
router.get('/:id/unlocks', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'TUTOR') return res.status(403).json({ error: 'Tutors only' });
    const unlocks = await prisma.studentUnlock.findMany({
      where: { packId: req.params.id, unlockedById: req.user!.userId },
      include: { student: { select: { id: true, name: true, grade: true } } },
    });
    return res.json(unlocks);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/packs/:id/pdf?mode=worksheet|memo  — branded export ──
router.get('/:id/pdf', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, userId } = req.user!;
    const mode = (req.query.mode === 'memo' ? 'memo' : 'worksheet') as 'memo' | 'worksheet';

    const pack = await prisma.pack.findUnique({
      where: { id: req.params.id },
      include: {
        questions: { include: { question: true }, orderBy: { order: 'asc' } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });
    if (!pack) return res.status(404).json({ error: 'Not found' });

    // Authorization (same gate as /api/packs/:id)
    if (role === 'TUTOR') {
      const isOwn = pack.createdById === userId;
      if (!isOwn) {
        const share = await prisma.packShare.findUnique({
          where: { packId_tutorId: { packId: pack.id, tutorId: userId } },
        });
        if (!share) return res.status(403).json({ error: 'Not shared with you' });
      }
      // Tutors can download both worksheet and memo for their accessible packs
    } else if (role === 'STUDENT') {
      const unlock = await prisma.studentUnlock.findUnique({
        where: { studentId_packId: { studentId: userId, packId: pack.id } },
      });
      if (!unlock) return res.status(403).json({ error: 'Not unlocked for you' });
      // Students can ONLY get worksheets — memos contain answers
      if (mode === 'memo') return res.status(403).json({ error: 'Memo is teacher-only' });
    }

    const requester = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    renderPackPdf(res, {
      title: pack.title,
      subtitle: [
        pack.subject === 'MATHEMATICS' ? 'Mathematics' : 'Physical Sciences',
        `Grade ${pack.grade}`,
        pack.topic || undefined,
      ].filter(Boolean).join(' · '),
      mode,
      questions: pack.questions.map((pq) => ({
        question: pq.question.question,
        options: pq.question.options,
        answer: pq.question.answer,
        solution: pq.question.solution,
        topic: pq.question.topic,
        difficulty: pq.question.difficulty,
        imageData: pq.question.imageData,
      })),
      authorName: requester?.name,
    });
  } catch (err) {
    console.error('[pack pdf]', err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
});

export default router;
