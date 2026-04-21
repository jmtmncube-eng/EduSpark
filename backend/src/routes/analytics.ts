import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOrTutorOnly } from '../middleware/auth';

const router = Router();

// Helper: get student IDs for a tutor (or null = all students for admin)
async function getScopeStudentIds(role: string, userId: string): Promise<string[] | null> {
  if (role === 'ADMIN') return null;
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT', teacherId: userId },
    select: { id: true },
  });
  return students.map((s) => s.id);
}

// GET /api/analytics/overview
router.get('/overview', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { role, userId } = req.user!;
    const scopeIds = await getScopeStudentIds(role, userId);
    const studentWhere = scopeIds ? { role: 'STUDENT' as const, id: { in: scopeIds } } : { role: 'STUDENT' as const };
    const resultWhere = scopeIds ? { userId: { in: scopeIds } } : {};
    const detailWhere = scopeIds
      ? { result: { userId: { in: scopeIds } } }
      : {};

    const [studentCount, results, resultDetails] = await Promise.all([
      prisma.user.count({ where: { ...studentWhere, active: true } }),
      prisma.quizResult.findMany({
        where: resultWhere,
        select: { score: true, timeTaken: true, completedAt: true, userId: true },
        orderBy: { completedAt: 'asc' },
      }),
      prisma.resultDetail.findMany({ where: detailWhere, select: { difficulty: true, isCorrect: true } }),
    ]);

    const assignmentCount = await prisma.assignment.count(
      scopeIds ? { where: { tutorId: userId } } : undefined
    );

    const avgScore = results.length
      ? (results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(1) : '0';
    const avgTime = results.length
      ? (results.reduce((s, r) => s + r.timeTaken, 0) / results.length / 60).toFixed(1) : '0';
    const completionRate = assignmentCount && studentCount
      ? Math.min(100, Number(((results.length / (assignmentCount * Math.max(studentCount, 1))) * 100).toFixed(0))) : 0;
    const passRate = results.length
      ? Number(((results.filter((r) => r.score >= 50).length / results.length) * 100).toFixed(1)) : 0;

    const topicResults = await prisma.quizResult.findMany({
      where: resultWhere,
      include: { assignment: { select: { topic: true } } },
    });
    const topicScores: Record<string, number[]> = {};
    topicResults.forEach((r) => {
      if (!topicScores[r.assignment.topic]) topicScores[r.assignment.topic] = [];
      topicScores[r.assignment.topic].push(r.score);
    });
    const topicMastery = Object.values(topicScores).filter(
      (scores) => scores.reduce((s, v) => s + v, 0) / scores.length >= 70
    ).length;

    let improvementTrend: { early: number; recent: number; direction: 'up' | 'down' | 'stable' };
    if (results.length < 2) {
      const only = results.length === 1 ? Number(results[0].score) : 0;
      improvementTrend = { early: only, recent: only, direction: 'stable' };
    } else {
      const mid = Math.floor(results.length / 2);
      const earlyAvg = results.slice(0, mid).reduce((s, r) => s + r.score, 0) / mid;
      const recentAvg = results.slice(mid).reduce((s, r) => s + r.score, 0) / (results.length - mid);
      const early = Number(earlyAvg.toFixed(1));
      const recent = Number(recentAvg.toFixed(1));
      improvementTrend = { early, recent, direction: recent > early + 1 ? 'up' : recent < early - 1 ? 'down' : 'stable' };
    }

    const difficultyInsight: Record<string, { correct: number; total: number; pct: number }> = {
      EASY: { correct: 0, total: 0, pct: 0 }, MEDIUM: { correct: 0, total: 0, pct: 0 }, HARD: { correct: 0, total: 0, pct: 0 },
    };
    resultDetails.forEach((d) => {
      const key = (d.difficulty || 'EASY').toUpperCase();
      if (difficultyInsight[key]) { difficultyInsight[key].total++; if (d.isCorrect) difficultyInsight[key].correct++; }
    });
    Object.values(difficultyInsight).forEach((v) => { v.pct = v.total ? Number(((v.correct / v.total) * 100).toFixed(1)) : 0; });

    const activeStudentIds = new Set(results.map((r) => r.userId));
    const engagementScore = activeStudentIds.size
      ? Number((results.length / activeStudentIds.size).toFixed(2)) : 0;

    return res.json({
      students: studentCount, assignments: assignmentCount, attempts: results.length,
      avgScore, avgTime, completionRate, passRate, topicMastery, improvementTrend, difficultyInsight, engagementScore,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/topic-performance
router.get('/topic-performance', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const scopeIds = await getScopeStudentIds(req.user!.role, req.user!.userId);
    const results = await prisma.quizResult.findMany({
      where: scopeIds ? { userId: { in: scopeIds } } : {},
      include: { assignment: { select: { topic: true } } },
    });
    const byTopic: Record<string, { total: number; count: number }> = {};
    results.forEach((r) => {
      const t = r.assignment.topic;
      if (!byTopic[t]) byTopic[t] = { total: 0, count: 0 };
      byTopic[t].total += r.score; byTopic[t].count++;
    });
    return res.json(Object.entries(byTopic)
      .map(([topic, d]) => ({ topic, avgScore: d.count ? (d.total / d.count).toFixed(1) : '0', attempts: d.count }))
      .sort((a, b) => Number(a.avgScore) - Number(b.avgScore)));
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/subject-performance
router.get('/subject-performance', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const scopeIds = await getScopeStudentIds(req.user!.role, req.user!.userId);
    const results = await prisma.quizResult.findMany({
      where: scopeIds ? { userId: { in: scopeIds } } : {},
      include: { assignment: { select: { subject: true } } },
    });
    const bySubject: Record<string, { total: number; count: number }> = {};
    results.forEach((r) => {
      const s = r.assignment.subject;
      if (!bySubject[s]) bySubject[s] = { total: 0, count: 0 };
      bySubject[s].total += r.score; bySubject[s].count++;
    });
    return res.json(Object.entries(bySubject).map(([subject, d]) => ({
      subject, avgScore: d.count ? (d.total / d.count).toFixed(1) : '0', attempts: d.count,
    })));
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/weekly-activity
router.get('/weekly-activity', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const scopeIds = await getScopeStudentIds(req.user!.role, req.user!.userId);
    const since = new Date(Date.now() - 12 * 7 * 86400000); // 12 weeks back
    const results = await prisma.quizResult.findMany({
      where: {
        completedAt: { gte: since },
        ...(scopeIds ? { userId: { in: scopeIds } } : {}),
      },
      select: { completedAt: true, score: true },
      orderBy: { completedAt: 'asc' },
    });

    // Group by week (ISO week label)
    const weekMap: Record<string, { attempts: number; totalScore: number }> = {};
    results.forEach((r) => {
      const d = new Date(r.completedAt);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = monday.toISOString().split('T')[0];
      if (!weekMap[key]) weekMap[key] = { attempts: 0, totalScore: 0 };
      weekMap[key].attempts++;
      weekMap[key].totalScore += r.score;
    });

    const sorted = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([week, d]) => ({
        week: new Date(week).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
        attempts: d.attempts,
        avgScore: d.attempts ? Math.round(d.totalScore / d.attempts) : 0,
      }));

    return res.json(sorted);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/difficulty-breakdown
router.get('/difficulty-breakdown', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const scopeIds = await getScopeStudentIds(req.user!.role, req.user!.userId);
    const details = await prisma.resultDetail.findMany({
      where: scopeIds ? { result: { userId: { in: scopeIds } } } : {},
      select: { difficulty: true, isCorrect: true },
    });
    const breakdown: Record<string, { correct: number; total: number }> = {
      EASY: { correct: 0, total: 0 }, MEDIUM: { correct: 0, total: 0 }, HARD: { correct: 0, total: 0 },
    };
    details.forEach((d) => {
      const key = d.difficulty || 'EASY';
      if (breakdown[key]) { breakdown[key].total++; if (d.isCorrect) breakdown[key].correct++; }
    });
    return res.json(breakdown);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/student-report/:id
router.get('/student-report/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;
    const { role, userId } = req.user!;

    // Access control: student sees own; admin sees all; tutor sees only their students
    if (role === 'STUDENT' && userId !== targetId) return res.status(403).json({ error: 'Forbidden' });
    if (role === 'TUTOR') {
      const student = await prisma.user.findUnique({ where: { id: targetId } });
      if (!student || student.teacherId !== userId) return res.status(403).json({ error: 'This student is not in your class' });
    }

    const [student, results] = await Promise.all([
      prisma.user.findUnique({ where: { id: targetId }, select: { id: true, name: true, grade: true, xp: true, createdAt: true, photo: true, examReadinessUnlocked: true, teacher: { select: { id: true, name: true } } } }),
      prisma.quizResult.findMany({
        where: { userId: targetId },
        include: {
          assignment: { select: { id: true, title: true, subject: true, topic: true, grade: true } },
          details: { select: { difficulty: true, isCorrect: true } },
        },
        orderBy: { completedAt: 'asc' },
      }),
    ]);

    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Students can only access their own exam readiness if tutor/admin has unlocked it
    if (role === 'STUDENT' && !student.examReadinessUnlocked) {
      return res.json({ locked: true });
    }

    const topicMap: Record<string, { scores: number[]; subject: string }> = {};
    results.forEach((r) => {
      const key = r.assignment.topic;
      if (!topicMap[key]) topicMap[key] = { scores: [], subject: r.assignment.subject };
      topicMap[key].scores.push(r.score);
    });
    const topicBreakdown = Object.entries(topicMap).map(([topic, data]) => {
      const avg = data.scores.reduce((s, v) => s + v, 0) / data.scores.length;
      return { topic, subject: data.subject, avgScore: Math.round(avg), attempts: data.scores.length,
        trend: data.scores.length > 1 ? (data.scores[data.scores.length - 1] > data.scores[0] ? 'improving' : 'declining') : 'stable' };
    }).sort((a, b) => a.avgScore - b.avgScore);

    const diffMap: Record<string, { correct: number; total: number }> = {
      EASY: { correct: 0, total: 0 }, MEDIUM: { correct: 0, total: 0 }, HARD: { correct: 0, total: 0 },
    };
    results.forEach((r) => r.details.forEach((d) => {
      const k = d.difficulty || 'EASY';
      if (diffMap[k]) { diffMap[k].total++; if (d.isCorrect) diffMap[k].correct++; }
    }));

    const easyPct = diffMap.EASY.total ? (diffMap.EASY.correct / diffMap.EASY.total) * 100 : null;
    const medPct = diffMap.MEDIUM.total ? (diffMap.MEDIUM.correct / diffMap.MEDIUM.total) * 100 : null;
    const hardPct = diffMap.HARD.total ? (diffMap.HARD.correct / diffMap.HARD.total) * 100 : null;
    const weights = [(easyPct !== null ? 0.3 : 0), (medPct !== null ? 0.4 : 0), (hardPct !== null ? 0.3 : 0)];
    const totalW = weights.reduce((s, v) => s + v, 0);
    const examReadiness = totalW > 0 ? Math.round(
      ((easyPct || 0) * weights[0] + (medPct || 0) * weights[1] + (hardPct || 0) * weights[2]) / totalW
    ) : null;

    const avgScore = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;
    const bestScore = results.length ? Math.max(...results.map((r) => r.score)) : 0;
    const passRate = results.length ? Math.round((results.filter((r) => r.score >= 50).length / results.length) * 100) : 0;

    const recentResults = results.slice(-10).reverse().map((r) => ({
      id: r.id, score: r.score, title: r.assignment.title, topic: r.assignment.topic, completedAt: r.completedAt,
    }));

    const assignmentAttemptMap: Record<string, { assignmentTitle: string; scores: number[] }> = {};
    results.forEach((r) => {
      if (!assignmentAttemptMap[r.assignmentId]) {
        assignmentAttemptMap[r.assignmentId] = { assignmentTitle: r.assignment.title, scores: [] };
      }
      assignmentAttemptMap[r.assignmentId].scores.push(r.score);
    });
    const attemptStats = Object.values(assignmentAttemptMap).map(({ assignmentTitle, scores }) => ({
      assignmentTitle, attempts: scores.length,
      avgScore: Number((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1)),
      bestScore: Math.max(...scores),
    }));

    const trend = results.slice(-8).map((r) => ({ date: r.completedAt.toISOString().split('T')[0], score: r.score, topic: r.assignment.topic }));

    const recommendations = topicBreakdown.map((t) => {
      if (t.avgScore < 50) return {
        priority: 'urgent' as const, topic: t.topic, avg: t.avgScore,
        message: `Scoring below 50% — requires focused revision and extra practice before the exam.`,
      };
      if (t.avgScore < 70) return {
        priority: 'review' as const, topic: t.topic, avg: t.avgScore,
        message: `Passing but not yet consistent — review key concepts and attempt more practice questions.`,
      };
      return {
        priority: 'maintain' as const, topic: t.topic, avg: t.avgScore,
        message: `Strong performance — continue practising to maintain exam readiness.`,
      };
    });

    return res.json({
      student, tutor: student.teacher ?? null,
      totalQuizzes: results.length, avgScore, bestScore, passRate, totalXp: student.xp,
      examReadiness, topicBreakdown, difficultyBreakdown: diffMap,
      recommendations, recentResults, attemptStats, trend,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
