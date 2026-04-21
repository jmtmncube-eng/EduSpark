import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOnly, adminOrTutorOnly } from '../middleware/auth';

const router = Router();

// GET /api/tutor-requests — admin: all; tutor: own
router.get('/', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user!.role === 'ADMIN';
    const requests = await prisma.tutorRequest.findMany({
      where: isAdmin ? {} : { tutorId: req.user!.userId },
      include: {
        tutor:   { select: { id: true, name: true, pin: true } },
        student: { select: { id: true, name: true, grade: true, xp: true, pin: true, teacherId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tutor-requests — tutor requests a student
router.post('/', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { studentId, note } = req.body as { studentId: string; note?: string };
    if (!studentId) return res.status(400).json({ error: 'studentId required' });

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student || student.role !== 'STUDENT') return res.status(404).json({ error: 'Student not found' });

    // Prevent requesting a student already in this tutor's class
    if (student.teacherId === req.user!.userId) {
      return res.status(409).json({ error: 'This student is already in your class' });
    }

    const existing = await prisma.tutorRequest.findUnique({
      where: { tutorId_studentId: { tutorId: req.user!.userId, studentId } },
    });
    if (existing) {
      if (existing.status === 'pending') return res.status(409).json({ error: 'You already have a pending request for this student' });
      // Allow re-requesting if previously denied
      const updated = await prisma.tutorRequest.update({
        where: { id: existing.id },
        data: { status: 'pending', note: note ?? null, updatedAt: new Date() },
        include: { tutor: { select: { id: true, name: true } }, student: { select: { id: true, name: true, grade: true } } },
      });
      return res.json(updated);
    }

    const request = await prisma.tutorRequest.create({
      data: { tutorId: req.user!.userId, studentId, note: note ?? null },
      include: { tutor: { select: { id: true, name: true } }, student: { select: { id: true, name: true, grade: true } } },
    });
    return res.status(201).json(request);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/tutor-requests/:id — admin approves or denies
router.patch('/:id', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status: 'approved' | 'denied' };
    if (!['approved', 'denied'].includes(status)) return res.status(400).json({ error: 'status must be approved or denied' });

    const request = await prisma.tutorRequest.findUnique({
      where: { id: req.params.id },
      include: { student: true },
    });
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const updated = await prisma.tutorRequest.update({
      where: { id: req.params.id },
      data: { status },
      include: { tutor: { select: { id: true, name: true } }, student: { select: { id: true, name: true, grade: true } } },
    });

    if (status === 'approved') {
      // Assign student to this tutor
      await prisma.user.update({
        where: { id: request.studentId },
        data: { teacherId: request.tutorId },
      });
      // Cancel all other pending requests for this student
      await prisma.tutorRequest.updateMany({
        where: {
          studentId: request.studentId,
          status: 'pending',
          id: { not: req.params.id },
        },
        data: { status: 'denied' },
      });
    }

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tutor-requests/:id — tutor cancels own pending request
router.delete('/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const request = await prisma.tutorRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (req.user!.role === 'TUTOR' && request.tutorId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not your request' });
    }
    if (request.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be cancelled' });

    await prisma.tutorRequest.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
