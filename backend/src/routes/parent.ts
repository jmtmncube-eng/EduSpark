import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Helper to generate a random 6-char parent PIN like "PAR-XY12"
function generateParentPin(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `PAR-${suffix}`;
}

// POST /api/parent/pins — admin creates a parent access PIN
router.post('/pins', authMiddleware, async (req: Request, res: Response) => {
  if (req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  const { studentId, label } = req.body;
  if (!studentId) return res.status(400).json({ error: 'studentId required' });

  // Verify student exists
  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student) return res.status(404).json({ error: 'Student not found' });

  // Generate unique PIN
  let pin = generateParentPin();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await prisma.parentAccess.findUnique({ where: { pin } });
    if (!existing) break;
    pin = generateParentPin();
    attempts++;
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const access = await prisma.parentAccess.create({
    data: { pin, studentId, label: label || null, expiresAt },
    include: { student: { select: { name: true, grade: true } } },
  });

  return res.json(access);
});

// GET /api/parent/pins — admin lists all parent PINs (with expiry status)
router.get('/pins', authMiddleware, async (req: Request, res: Response) => {
  if (req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });

  const pins = await prisma.parentAccess.findMany({
    include: { student: { select: { name: true, grade: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // Auto-delete expired ones older than 7 days and mark status
  const now = new Date();
  const result = pins.map((p) => ({
    ...p,
    expired: p.expiresAt < now,
    daysLeft: Math.max(0, Math.ceil((p.expiresAt.getTime() - now.getTime()) / 86400000)),
  }));

  return res.json(result);
});

// DELETE /api/parent/pins/:id — admin revokes a PIN
router.delete('/pins/:id', authMiddleware, async (req: Request, res: Response) => {
  if (req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  await prisma.parentAccess.delete({ where: { id: req.params.id } }).catch(() => {});
  return res.json({ success: true });
});

// GET /api/parent/view/:pin — PUBLIC — parent uses PIN to read child's report
router.get('/view/:pin', async (req: Request, res: Response) => {
  const access = await prisma.parentAccess.findUnique({
    where: { pin: req.params.pin.toUpperCase() },
    include: { student: { select: { id: true, name: true, grade: true, xp: true } } },
  });

  if (!access) return res.status(404).json({ error: 'Invalid PIN' });
  if (access.expiresAt < new Date()) return res.status(403).json({ error: 'This PIN has expired. Please ask the teacher for a new one.' });

  // Fetch quiz results for this student
  const results = await prisma.quizResult.findMany({
    where: { userId: access.studentId },
    include: { assignment: { select: { title: true, subject: true, topic: true, grade: true } } },
    orderBy: { completedAt: 'desc' },
  });

  const avgScore = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;
  const bestScore = results.length ? Math.max(...results.map((r) => r.score)) : 0;
  const passRate = results.length ? Math.round((results.filter((r) => r.score >= 50).length / results.length) * 100) : 0;

  // Topic breakdown
  const topicMap: Record<string, number[]> = {};
  results.forEach((r) => {
    const topic = r.assignment?.topic || 'Unknown';
    if (!topicMap[topic]) topicMap[topic] = [];
    topicMap[topic].push(r.score);
  });
  const topicBreakdown = Object.entries(topicMap).map(([topic, scores]) => ({
    topic,
    avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    attempts: scores.length,
  }));

  return res.json({
    student: access.student,
    label: access.label,
    expiresAt: access.expiresAt,
    daysLeft: Math.max(0, Math.ceil((access.expiresAt.getTime() - new Date().getTime()) / 86400000)),
    totalQuizzes: results.length,
    avgScore,
    bestScore,
    passRate,
    recentResults: results.slice(0, 10).map((r) => ({
      id: r.id,
      score: r.score,
      title: r.assignment?.title || 'Quiz',
      topic: r.assignment?.topic || '',
      completedAt: r.completedAt,
    })),
    topicBreakdown,
  });
});

export default router;
