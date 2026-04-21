import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOnly, adminOrTutorOnly } from '../middleware/auth';
import { makeUniquePin, generatePin, generateTutorPin } from '../utils/pinGenerator';

const router = Router();

// GET /api/students — ADMIN: all students; TUTOR: only their allocated students
router.get('/', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { search, grade } = req.query;
    const isTutor = req.user!.role === 'TUTOR';

    const where: Record<string, unknown> = { role: 'STUDENT' };
    if (isTutor) where.teacherId = req.user!.userId;
    if (grade) where.grade = Number(grade);
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { pin: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const students = await prisma.user.findMany({
      where,
      include: {
        results: { select: { score: true, completedAt: true, assignmentId: true }, orderBy: { completedAt: 'desc' } },
        teacher: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(students);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/students/tutors — ADMIN only: list all tutors
router.get('/tutors', authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const tutors = await prisma.user.findMany({
      where: { role: 'TUTOR' },
      include: { students: { select: { id: true, name: true, grade: true } } },
      orderBy: { name: 'asc' },
    });
    return res.json(tutors);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/students/search?q=name
router.get('/search', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const isTutor = req.user!.role === 'TUTOR';

    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        name: { contains: q, mode: 'insensitive' },
        ...(isTutor ? { teacherId: req.user!.userId } : {}),
      },
      select: { id: true, name: true, grade: true, pin: true, xp: true },
      take: 20,
      orderBy: { name: 'asc' },
    });

    return res.json(students.map((s) => ({ ...s, pin: s.pin ? s.pin.slice(0, 8) : null })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/students/available — unallocated students (no teacherId), for tutor request browsing
router.get('/available', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { grade } = req.query;
    const where: Record<string, unknown> = { role: 'STUDENT', teacherId: null };
    if (grade) where.grade = Number(grade);

    const available = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, grade: true, xp: true, active: true, createdAt: true,
        results: { select: { score: true }, orderBy: { completedAt: 'desc' }, take: 10 },
      },
      orderBy: { name: 'asc' },
    });
    return res.json(available);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/students/:id/assign-tutor — ADMIN only: assign a student to a tutor
router.patch('/:id/assign-tutor', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { tutorId } = req.body as { tutorId: string | null };
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { teacherId: tutorId ?? null },
      include: { teacher: { select: { id: true, name: true } } },
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/students/tutors/:id/toggle-active — ADMIN only: activate/deactivate a tutor
router.patch('/tutors/:id/toggle-active', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const tutor = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!tutor || tutor.role !== 'TUTOR') return res.status(404).json({ error: 'Tutor not found' });
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { active: !tutor.active } });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/students/:id
router.get('/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const student = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { results: { include: { details: true }, orderBy: { completedAt: 'desc' } } },
    });
    if (!student) return res.status(404).json({ error: 'Not found' });

    // Tutors can only access their own students
    if (req.user!.role === 'TUTOR' && student.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: 'This student is not in your class' });
    }

    return res.json(student);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/students/:id/toggle-active
router.patch('/:id/toggle-active', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const student = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!student) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { active: !student.active } });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/students/:id/reset-pin — works for students (SPK) and tutors (TCH); admin resets either
router.post('/:id/reset-pin', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Tutors can only reset PINs for their own students
    if (req.user!.role === 'TUTOR') {
      if (target.role !== 'STUDENT' || target.teacherId !== req.user!.userId) {
        return res.status(403).json({ error: 'This student is not in your class' });
      }
    }

    const isTutorTarget = target.role === 'TUTOR';
    const prefix = isTutorTarget ? 'TCH' : 'SPK';
    const generator = isTutorTarget ? generateTutorPin : generatePin;

    const { customSuffix } = req.body as { customSuffix?: string };
    let newPin: string;
    if (customSuffix && /^[A-Z0-9]{4}$/i.test(customSuffix)) {
      newPin = `${prefix}-${customSuffix.toUpperCase()}`;
      const exists = await prisma.user.findUnique({ where: { pin: newPin } });
      if (exists && exists.id !== req.params.id) return res.status(409).json({ error: 'PIN already in use' });
    } else {
      newPin = await makeUniquePin(async (p) => {
        const ex = await prisma.user.findUnique({ where: { pin: p } });
        return !!ex && ex.id !== req.params.id;
      }, generator);
    }

    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { pin: newPin } });
    return res.json({ pin: newPin, user: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/students/:id/photo
router.patch('/:id/photo', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { photo } = req.body as { photo: string };
    if (req.user!.userId !== req.params.id && req.user!.role !== 'ADMIN' && req.user!.role !== 'TUTOR') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { photo } });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/students/me/profile
router.get('/me/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        results: {
          include: { details: true, assignment: { select: { title: true, subject: true } } },
          orderBy: { completedAt: 'desc' },
        },
        teacher: { select: { id: true, name: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'Not found' });
    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
