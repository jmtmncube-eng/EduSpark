import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOnly } from '../middleware/auth';

const router = Router();

// GET /api/analytics/overview
router.get('/overview', authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const [students, questions, assignments, results, resultDetails] = await Promise.all([
      prisma.user.count({ where: { role: 'STUDENT', active: true } }),
      prisma.question.count(),
      prisma.assignment.count(),
      prisma.quizResult.findMany({
        select: { score: true, timeTaken: true, completedAt: true, userId: true },
        orderBy: { completedAt: 'asc' },
      }),
      prisma.resultDetail.findMany({ select: { difficulty: true, isCorrect: true } }),
    ]);

    const avgScore = results.length
      ? (results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(1)
      : '0';
    const avgTime = results.length
      ? (results.reduce((s, r) => s + r.timeTaken, 0) / results.length / 60).toFixed(1)
      : '0';
    const totalStudents = await prisma.user.count({ where: { role: 'STUDENT' } });
    const completionRate = assignments && totalStudents
      ? Math.min(100, Number(((results.length / (assignments * Math.max(totalStudents, 1))) * 100).toFixed(0)))
      : 0;

    // passRate — % of results with score >= 50
    const passRate = results.length
      ? Number(((results.filter((r) => r.score >= 50).length / results.length) * 100).toFixed(1))
      : 0;

    // topicMastery — unique topics with avg score >= 70
    const topicResults = await prisma.quizResult.findMany({
      include: { assignment: { select: { topic: true } } },
    });
    const topicScores: Record<string, number[]> = {};
    topicResults.forEach((r) => {
      const t = r.assignment.topic;
      if (!topicScores[t]) topicScores[t] = [];
      topicScores[t].push(r.score);
    });
    const topicMastery = Object.values(topicScores).filter(
      (scores) => scores.reduce((s, v) => s + v, 0) / scores.length >= 70
    ).length;

    // improvementTrend — first half vs second half avg score
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
      const direction: 'up' | 'down' | 'stable' =
        recent > early + 1 ? 'up' : recent < early - 1 ? 'down' : 'stable';
      improvementTrend = { early, recent, direction };
    }

    // difficultyInsight — EASY/MEDIUM/HARD from ResultDetail
    const difficultyInsight: Record<string, { correct: number; total: number; pct: number }> = {
      EASY: { correct: 0, total: 0, pct: 0 },
      MEDIUM: { correct: 0, total: 0, pct: 0 },
      HARD: { correct: 0, total: 0, pct: 0 },
    };
    resultDetails.forEach((d) => {
      const key = (d.difficulty || 'EASY').toUpperCase();
      if (difficultyInsight[key]) {
        difficultyInsight[key].total++;
        if (d.isCorrect) difficultyInsight[key].correct++;
      }
    });
    Object.values(difficultyInsight).forEach((v) => {
      v.pct = v.total ? Number(((v.correct / v.total) * 100).toFixed(1)) : 0;
    });

    // engagementScore — avg quizzes per active student
    const activeStudentIds = new Set(results.map((r) => r.userId));
    const engagementScore = activeStudentIds.size
      ? Number((results.length / activeStudentIds.size).toFixed(2))
      : 0;

    return res.json({
      students, questions, assignments, attempts: results.length, avgScore, avgTime, completionRate,
      passRate, topicMastery, improvementTrend, difficultyInsight, engagementScore,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/subject-performance
router.get('/subject-performance', authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const results = await prisma.quizResult.findMany({
      include: { assignment: { select: { subject: true } } },
    });
    const bySubject: Record<string, { total: number; count: number }> = {};
    results.forEach((r) => {
      const s = r.assignment.subject;
      if (!bySubject[s]) bySubject[s] = { total: 0, count: 0 };
      bySubject[s].total += r.score;
      bySubject[s].count++;
    });
    return res.json(Object.entries(bySubject).map(([subject, data]) => ({
      subject, avgScore: data.count ? (data.total / data.count).toFixed(1) : '0', attempts: data.count,
    })));
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/topic-performance
router.get('/topic-performance', authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const results = await prisma.quizResult.findMany({
      include: { assignment: { select: { topic: true } } },
    });
    const byTopic: Record<string, { total: number; count: number }> = {};
    results.forEach((r) => {
      const t = r.assignment.topic;
      if (!byTopic[t]) byTopic[t] = { total: 0, count: 0 };
      byTopic[t].total += r.score;
      byTopic[t].count++;
    });
    return res.json(Object.entries(byTopic)
      .map(([topic, data]) => ({ topic, avgScore: data.count ? (data.total / data.count).toFixed(1) : '0', attempts: data.count }))
      .sort((a, b) => Number(a.avgScore) - Number(b.avgScore)));
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/weekly-activity
router.get('/weekly-activity', authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const results = await prisma.quizResult.findMany({
      where: { completedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      select: { completedAt: true },
    });
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days[d.toISOString().split('T')[0]] = 0;
    }
    results.forEach((r) => {
      const d = r.completedAt.toISOString().split('T')[0];
      if (days[d] !== undefined) days[d]++;
    });
    return res.json(Object.entries(days).map(([date, count]) => ({ date, count })));
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/difficulty-breakdown
router.get('/difficulty-breakdown', authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const details = await prisma.resultDetail.findMany({ select: { difficulty: true, isCorrect: true } });
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

// GET /api/analytics/student-report/:id  — detailed per-student exam readiness report
router.get('/student-report/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;
    // Students can only see their own report; admins can see all
    if (req.user!.role !== 'ADMIN' && req.user!.userId !== targetId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [student, results] = await Promise.all([
      prisma.user.findUnique({ where: { id: targetId }, select: { id: true, name: true, grade: true, xp: true, createdAt: true, photo: true } }),
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

    // Topic breakdown
    const topicMap: Record<string, { scores: number[]; subject: string }> = {};
    results.forEach((r) => {
      const key = r.assignment.topic;
      if (!topicMap[key]) topicMap[key] = { scores: [], subject: r.assignment.subject };
      topicMap[key].scores.push(r.score);
    });

    const topicBreakdown = Object.entries(topicMap).map(([topic, data]) => {
      const avg = data.scores.reduce((s, v) => s + v, 0) / data.scores.length;
      return { topic, subject: data.subject, avgScore: Math.round(avg), attempts: data.scores.length, trend: data.scores.length > 1 ? (data.scores[data.scores.length - 1] > data.scores[0] ? 'improving' : 'declining') : 'stable' };
    }).sort((a, b) => a.avgScore - b.avgScore);

    // Difficulty performance
    const diffMap: Record<string, { correct: number; total: number }> = { EASY: { correct: 0, total: 0 }, MEDIUM: { correct: 0, total: 0 }, HARD: { correct: 0, total: 0 } };
    results.forEach((r) => r.details.forEach((d) => {
      const k = d.difficulty || 'EASY';
      if (diffMap[k]) { diffMap[k].total++; if (d.isCorrect) diffMap[k].correct++; }
    }));

    // Exam readiness: weighted average (EASY=30%, MEDIUM=40%, HARD=30%)
    const easyPct = diffMap.EASY.total ? (diffMap.EASY.correct / diffMap.EASY.total) * 100 : null;
    const medPct = diffMap.MEDIUM.total ? (diffMap.MEDIUM.correct / diffMap.MEDIUM.total) * 100 : null;
    const hardPct = diffMap.HARD.total ? (diffMap.HARD.correct / diffMap.HARD.total) * 100 : null;
    const weights = [(easyPct !== null ? 0.3 : 0), (medPct !== null ? 0.4 : 0), (hardPct !== null ? 0.3 : 0)];
    const totalW = weights.reduce((s, v) => s + v, 0);
    const examReadiness = totalW > 0 ? Math.round(
      ((easyPct || 0) * weights[0] + (medPct || 0) * weights[1] + (hardPct || 0) * weights[2]) / totalW
    ) : null;

    // Overall stats
    const avgScore = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;
    const bestScore = results.length ? Math.max(...results.map((r) => r.score)) : 0;
    const totalXp = student.xp;

    // Recommendations
    const recommendations: { priority: 'urgent' | 'review' | 'maintain'; topic: string; avg: number; message: string }[] = [];
    topicBreakdown.forEach(({ topic, avgScore: avg }) => {
      if (avg < 50) recommendations.push({ priority: 'urgent', topic, avg, message: `Needs urgent attention — scoring ${avg}%. Focus on core concepts and practice daily.` });
      else if (avg < 70) recommendations.push({ priority: 'review', topic, avg, message: `Good effort but needs revision — ${avg}%. Work through more practice problems.` });
      else recommendations.push({ priority: 'maintain', topic, avg, message: `Strong performance at ${avg}%. Maintain consistency and tackle harder questions.` });
    });

    // Score trend (last 8 results)
    const trend = results.slice(-8).map((r) => ({ date: r.completedAt.toISOString().split('T')[0], score: r.score, topic: r.assignment.topic }));

    // attemptStats — per-assignment attempt summary
    const assignmentAttemptMap: Record<string, { assignmentTitle: string; scores: number[] }> = {};
    results.forEach((r) => {
      const aid = r.assignment.id;
      if (!assignmentAttemptMap[aid]) {
        assignmentAttemptMap[aid] = { assignmentTitle: r.assignment.title, scores: [] };
      }
      assignmentAttemptMap[aid].scores.push(r.score);
    });
    const attemptStats = Object.values(assignmentAttemptMap).map(({ assignmentTitle, scores }) => ({
      assignmentTitle,
      attempts: scores.length,
      avgScore: Number((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1)),
      bestScore: Math.max(...scores),
    }));

    return res.json({
      student, totalQuizzes: results.length, avgScore, bestScore, totalXp,
      examReadiness, topicBreakdown, difficultyBreakdown: diffMap, recommendations, trend, attemptStats,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
