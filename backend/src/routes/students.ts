import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { makeUniquePin } from '../utils/pinGenerator';

const router = Router();

// GET /api/students
router.get('/', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { search, grade } = req.query;
    const where: Record<string, unknown> = { role: 'STUDENT' };

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
        results: {
          select: { score: true, completedAt: true, assignmentId: true },
          orderBy: { completedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(students);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/students/search?q=name — admin searches students by name
router.get('/search', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        name: { contains: q, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        grade: true,
        pin: true,
        xp: true,
      },
      take: 20,
      orderBy: { name: 'asc' },
    });

    const result = students.map((s) => ({
      ...s,
      pin: s.pin ? s.pin.slice(0, 8) : null,
    }));

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/students/:id
router.get('/:id', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const student = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        results: {
          include: { details: true },
          orderBy: { completedAt: 'desc' },
        },
      },
    });
    if (!student) return res.status(404).json({ error: 'Not found' });
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

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { active: !student.active },
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/students/:id/reset-pin
router.post('/:id/reset-pin', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { customSuffix } = req.body as { customSuffix?: string };

    let newPin: string;
    if (customSuffix && /^[A-Z0-9]{4}$/i.test(customSuffix)) {
      newPin = 'SPK-' + customSuffix.toUpperCase();
      const exists = await prisma.user.findUnique({ where: { pin: newPin } });
      if (exists && exists.id !== req.params.id) {
        return res.status(409).json({ error: 'PIN already in use' });
      }
    } else {
      newPin = await makeUniquePin(async (p) => {
        const ex = await prisma.user.findUnique({ where: { pin: p } });
        return !!ex && ex.id !== req.params.id;
      });
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { pin: newPin },
    });

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
    if (req.user!.userId !== req.params.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { photo },
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/students/me — current student profile
router.get('/me/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        results: {
          include: { details: true, assignment: { select: { title: true, subject: true } } },
          orderBy: { completedAt: 'desc' },
        },
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
