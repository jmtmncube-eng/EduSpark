import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/notifications  — list current user's notifications (newest first, last 50)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const list = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unread = list.filter((n) => !n.readAt).length;
    return res.json({ list, unread });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/notifications/unread-count  — fast endpoint for polling badge
router.get('/unread-count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const unread = await prisma.notification.count({
      where: { userId: req.user!.userId, readAt: null },
    });
    return res.json({ unread });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/:id/read  — mark one read
router.patch('/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const note = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!note) return res.status(404).json({ error: 'Not found' });
    if (note.userId !== req.user!.userId) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { readAt: new Date() },
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/read-all  — mark all read
router.patch('/read-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const note = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!note) return res.status(404).json({ error: 'Not found' });
    if (note.userId !== req.user!.userId) return res.status(403).json({ error: 'Forbidden' });

    await prisma.notification.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
