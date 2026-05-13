import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * SmartCoach engine — turns the student's quiz history into actionable next steps.
 *
 * Three outputs:
 *   1. weakTopics — topics where avg score is lowest. Recommends a pack.
 *   2. mastery   — per-topic mastery % across all attempts.
 *   3. dailyGoal — has the student practiced today? streak info.
 *
 * Tutors get the same view scoped to their class for the TutorSpotlight widget.
 */

interface TopicStat {
  topic: string;
  subject: string;
  attempts: number;
  avgScore: number;
  lastAttempt: string;
  trend: 'up' | 'down' | 'flat';
}

function calcStreak(dates: Date[]): number {
  if (!dates.length) return 0;
  const days = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Allow today OR yesterday to start the streak (so it survives until end of day)
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
  }
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Students only' });
    }
    const userId = req.user!.userId;

    const [results, unlocks] = await Promise.all([
      prisma.quizResult.findMany({
        where: { userId },
        include: {
          assignment: { select: { topic: true, subject: true } },
          details: { select: { isCorrect: true, difficulty: true } },
        },
        orderBy: { completedAt: 'asc' },
      }),
      prisma.studentUnlock.findMany({
        where: { studentId: userId },
        include: { pack: { select: { id: true, title: true, topic: true, subject: true, coverEmoji: true } } },
      }),
    ]);

    // ── Mastery per topic ──────────────────────────────────────────
    const byTopic: Record<string, { subject: string; scores: number[]; lastAt: Date; details: { correct: number; total: number } }> = {};
    for (const r of results) {
      const topic = r.assignment?.topic ?? r.practiceTopic ?? 'General';
      const subject = String(r.assignment?.subject ?? r.practiceSubject ?? 'MATHEMATICS');
      const key = `${subject}::${topic}`;
      const entry = byTopic[key] ||= { subject, scores: [], lastAt: r.completedAt, details: { correct: 0, total: 0 } };
      entry.scores.push(r.score);
      entry.lastAt = r.completedAt > entry.lastAt ? r.completedAt : entry.lastAt;
      for (const d of r.details) {
        entry.details.total++;
        if (d.isCorrect) entry.details.correct++;
      }
    }

    const topicStats: TopicStat[] = Object.entries(byTopic).map(([key, v]) => {
      const [, topic] = key.split('::');
      const avg = v.scores.reduce((s, x) => s + x, 0) / v.scores.length;
      // Trend: compare first half to second half
      const half = Math.floor(v.scores.length / 2);
      let trend: 'up' | 'down' | 'flat' = 'flat';
      if (v.scores.length >= 3) {
        const early = v.scores.slice(0, half).reduce((s, x) => s + x, 0) / Math.max(1, half);
        const late = v.scores.slice(half).reduce((s, x) => s + x, 0) / Math.max(1, v.scores.length - half);
        if (late - early > 5) trend = 'up';
        else if (early - late > 5) trend = 'down';
      }
      return {
        topic, subject: v.subject,
        attempts: v.scores.length,
        avgScore: Math.round(avg),
        lastAttempt: v.lastAt.toISOString(),
        trend,
      };
    });

    // ── Weak topics (avg < 70, sorted ascending) ───────────────────
    const weakTopics = [...topicStats]
      .filter((t) => t.avgScore < 70 && t.attempts >= 1)
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 3);

    // For each weak topic, suggest a pack that matches
    const weakWithPacks = weakTopics.map((t) => {
      const matching = unlocks.find((u) => u.pack.topic === t.topic && String(u.pack.subject) === t.subject);
      return { ...t, suggestedPack: matching?.pack ?? null };
    });

    // ── Strong topics (avg >= 85) ──────────────────────────────────
    const strongTopics = topicStats.filter((t) => t.avgScore >= 85).sort((a, b) => b.avgScore - a.avgScore).slice(0, 3);

    // ── Daily goal & streak ────────────────────────────────────────
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayResults = results.filter((r) => r.completedAt >= today);
    const todayMinutes = todayResults.reduce((s, r) => s + (r.timeTaken || 0), 0) / 60;
    const todayQuestions = todayResults.reduce((s, r) => s + r.total, 0);
    const dailyGoalQuestions = 10;
    const streak = calcStreak(results.map((r) => r.completedAt));

    // ── Suggested next pack (un-attempted or low-attempt) ──────────
    let nextPack: typeof unlocks[0]['pack'] | null = null;
    if (unlocks.length) {
      // Prefer packs the student hasn't tried much
      const packAttemptCount: Record<string, number> = {};
      unlocks.forEach((u) => { packAttemptCount[u.pack.id] = 0; });
      for (const r of results) {
        if (r.resultType !== 'PRACTICE') continue;
        const matchTopic = r.practiceTopic;
        const matched = unlocks.find((u) => u.pack.topic === matchTopic || u.pack.title === matchTopic);
        if (matched) packAttemptCount[matched.pack.id]++;
      }
      const leastTried = unlocks
        .map((u) => ({ pack: u.pack, count: packAttemptCount[u.pack.id] }))
        .sort((a, b) => a.count - b.count)[0];
      nextPack = leastTried?.pack ?? null;
    }

    return res.json({
      weakTopics: weakWithPacks,
      strongTopics,
      mastery: topicStats.sort((a, b) => b.avgScore - a.avgScore),
      dailyGoal: {
        target: dailyGoalQuestions,
        done: todayQuestions,
        minutesToday: Math.round(todayMinutes),
        complete: todayQuestions >= dailyGoalQuestions,
      },
      streak,
      nextPack,
      totalAttempts: results.length,
      avgScore: results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Tutor spotlight: students in their class flagged by recent performance ─
router.get('/spotlight', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'TUTOR' && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Tutors/admins only' });
    }

    const students = await prisma.user.findMany({
      where: req.user!.role === 'TUTOR'
        ? { role: 'STUDENT', teacherId: req.user!.userId, active: true }
        : { role: 'STUDENT', active: true },
      include: {
        results: {
          orderBy: { completedAt: 'desc' },
          take: 10,
          include: { assignment: { select: { topic: true } } },
        },
      },
    });

    const TWO_WEEKS_AGO = Date.now() - 14 * 24 * 60 * 60 * 1000;

    const spotlight = students.map((s) => {
      const recent = s.results;
      const avg = recent.length ? Math.round(recent.reduce((sum, r) => sum + r.score, 0) / recent.length) : 0;
      const lastAttempt = recent[0]?.completedAt ?? null;
      const daysSince = lastAttempt ? Math.floor((Date.now() - new Date(lastAttempt).getTime()) / 86400000) : 999;

      let status: 'at_risk' | 'inactive' | 'on_track' | 'thriving' | 'new';
      let reason = '';
      if (recent.length === 0) {
        status = 'new'; reason = 'No attempts yet';
      } else if (lastAttempt && new Date(lastAttempt).getTime() < TWO_WEEKS_AGO) {
        status = 'inactive'; reason = `No activity for ${daysSince} days`;
      } else if (avg < 50) {
        status = 'at_risk'; reason = `Avg ${avg}% — needs help`;
      } else if (avg >= 85) {
        status = 'thriving'; reason = `Avg ${avg}% 🔥`;
      } else {
        status = 'on_track'; reason = `Avg ${avg}%`;
      }

      // Weakest topic in last 5 results
      const topicAvg: Record<string, number[]> = {};
      recent.slice(0, 5).forEach((r) => {
        const t = r.assignment?.topic ?? r.practiceTopic ?? 'General';
        (topicAvg[t] ||= []).push(r.score);
      });
      const weakestTopic = Object.entries(topicAvg)
        .map(([t, ss]) => ({ topic: t, avg: ss.reduce((a, b) => a + b, 0) / ss.length }))
        .sort((a, b) => a.avg - b.avg)[0]?.topic ?? null;

      return {
        id: s.id, name: s.name, grade: s.grade, xp: s.xp,
        status, reason, avg, attempts: recent.length,
        lastAttempt, daysSince,
        weakestTopic,
      };
    });

    // Sort: at_risk > inactive > new > on_track > thriving
    const order = { at_risk: 0, inactive: 1, new: 2, on_track: 3, thriving: 4 };
    spotlight.sort((a, b) => order[a.status] - order[b.status]);

    return res.json(spotlight);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
