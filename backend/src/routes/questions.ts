import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOnly, adminOrTutorOnly } from '../middleware/auth';
import { generateQuestion, CAPS_TOPICS, expectedSecondsFor } from '../utils/questionGenerators';
import { makeDiagram } from '../utils/diagramTemplates';
import { audit } from '../utils/audit';
import { Difficulty, Subject, Visibility } from '@prisma/client';

const router = Router();

const subjectMap: Record<string, Subject> = {
  mathematics: 'MATHEMATICS',
  physical_sciences: 'PHYSICAL_SCIENCES',
};
const diffMap: Record<string, Difficulty> = {
  Easy: 'EASY',
  Medium: 'MEDIUM',
  Hard: 'HARD',
};
const visMap: Record<string, Visibility> = {
  all: 'ALL', gr10: 'GR10', gr11: 'GR11', gr12: 'GR12', none: 'NONE',
};

// GET /api/questions
// ADMIN: full bank
// TUTOR: questions inside packs shared with them
// STUDENT: questions inside packs unlocked for them by their tutor
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { subject, visibility, search, grade, topic } = req.query;
    const user = req.user!;

    const where: Record<string, unknown> = {};

    if (subject) where.subject = subjectMap[subject as string] || subject;
    if (topic) where.topic = topic as string;
    if (grade) where.grade = Number(grade);

    if (visibility && user.role === 'ADMIN') where.visibility = visMap[visibility as string] || visibility;

    // ─── Scope by pack membership for non-admins ────────────────────
    if (user.role === 'TUTOR') {
      const shares = await prisma.packShare.findMany({
        where: { tutorId: user.userId },
        include: { pack: { include: { questions: { select: { questionId: true } } } } },
      });
      const qIds = new Set<string>();
      shares.forEach((s) => s.pack.questions.forEach((pq) => qIds.add(pq.questionId)));
      // Tutor sees: questions in shared packs  OR  questions they created themselves
      where.OR = [
        { id: { in: Array.from(qIds) } },
        { createdById: user.userId },
      ];
    } else if (user.role === 'STUDENT') {
      const unlocks = await prisma.studentUnlock.findMany({
        where: { studentId: user.userId },
        include: { pack: { include: { questions: { select: { questionId: true } } } } },
      });
      const qIds = new Set<string>();
      unlocks.forEach((u) => u.pack.questions.forEach((pq) => qIds.add(pq.questionId)));
      // Backwards-compat: also include legacy visibility-based access until packs are fully populated
      const studentData = await prisma.user.findUnique({ where: { id: user.userId } });
      const g = studentData?.grade || 10;
      where.OR = [
        { id: { in: Array.from(qIds) } },
        { visibility: { in: ['ALL', `GR${g}` as Visibility] } },
      ];
    }

    if (search) {
      const searchClause = [
        { question: { contains: search as string, mode: 'insensitive' as const } },
        { topic: { contains: search as string, mode: 'insensitive' as const } },
      ];
      if (Array.isArray(where.OR)) {
        // combine: each existing OR AND search match
        where.AND = [{ OR: where.OR }, { OR: searchClause }];
        delete where.OR;
      } else {
        where.OR = searchClause;
      }
    }

    const questions = await prisma.question.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Annotate each with its expectedSeconds so the frontend timer has a fair budget
    const enriched = questions.map((q) => ({
      ...q,
      expectedSeconds: expectedSecondsFor(q),
    }));

    return res.json(enriched);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/questions/topics
router.get('/topics', authMiddleware, async (req: Request, res: Response) => {
  const { subject, grade } = req.query;
  const sub = subject as string || 'mathematics';
  const gr = Number(grade) || 10;
  const topics = CAPS_TOPICS[sub]?.[gr] || [];
  return res.json(topics);
});

// POST /api/questions/generate
router.post('/generate', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { subject, grade, topic, count = 5, difficulty } = req.body as {
      subject: string; grade: number; topic: string; count?: number; difficulty?: string;
    };
    const sub = subjectMap[subject as string] || 'MATHEMATICS';
    const n = Math.min(Number(count), 20);
    const created = [];

    // Every generated question carries a diagram — topic-aware where a
    // template exists, subject-relevant fallback otherwise.
    for (let i = 0; i < n; i++) {
      const d = generateQuestion(topic, subject, Number(grade));
      const q = await prisma.question.create({
        data: {
          subject: sub as Subject,
          grade: Number(grade),
          topic,
          difficulty: diffMap[d.diff] || 'EASY',
          question: d.q,
          options: d.opts,
          answer: d.ans,
          solution: d.sol,
          visibility: 'ALL',
          imageData: makeDiagram(topic, subject),
          createdById: req.user!.userId,
        },
      });
      created.push(q);
    }

    // ─── Record the batch so it can be revisited / reused ───────────
    let batch: { id: string } | null = null;
    if (created.length > 0) {
      batch = await prisma.questionBatch.create({
        data: {
          createdById: req.user!.userId,
          subject: sub as Subject,
          grade: Number(grade),
          topic,
          requestedCount: n,
          difficulty: (difficulty || 'MIXED').toUpperCase(),
          items: {
            create: created.map((q, order) => ({ questionId: q.id, order })),
          },
        },
      });
      await audit(req, 'questions.generate', 'QuestionBatch', batch.id, {
        subject, grade: Number(grade), topic, requested: n, produced: created.length,
        difficulty: difficulty || 'MIXED',
      });
    }

    return res.json({ created, count: created.length, batchId: batch?.id ?? null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/questions   (admin or tutor — tutor's questions are private to them until added to a pack)
router.post('/', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { subject, grade, topic, difficulty, question, options, answer, solution, visibility, imageData } = req.body;

    const q = await prisma.question.create({
      data: {
        subject: subjectMap[subject] as Subject || 'MATHEMATICS',
        grade: Number(grade),
        topic,
        difficulty: diffMap[difficulty] || 'EASY',
        question,
        options: options || [],
        answer,
        solution,
        visibility: visMap[visibility] || 'ALL',
        imageData: imageData || null,
        createdById: req.user!.userId,
      },
    });

    return res.status(201).json(q);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/questions/:id
router.put('/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    // Tutors can only edit questions they created
    if (req.user!.role === 'TUTOR') {
      const existing = await prisma.question.findUnique({ where: { id: req.params.id }, select: { createdById: true } });
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (existing.createdById !== req.user!.userId) {
        return res.status(403).json({ error: 'You can only edit questions you created' });
      }
    }

    const { subject, grade, topic, difficulty, question, options, answer, solution, visibility, imageData } = req.body;

    const q = await prisma.question.update({
      where: { id: req.params.id },
      data: {
        subject: subjectMap[subject] as Subject || undefined,
        grade: grade ? Number(grade) : undefined,
        topic,
        difficulty: difficulty ? (diffMap[difficulty] || undefined) : undefined,
        question,
        options: options || undefined,
        answer,
        solution,
        visibility: visibility ? (visMap[visibility] || undefined) : undefined,
        imageData: imageData !== undefined ? imageData : undefined,
      },
    });

    return res.json(q);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/questions/:id/visibility — cycle visibility
router.patch('/:id/visibility', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const q = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!q) return res.status(404).json({ error: 'Not found' });

    const cycle: Visibility[] = ['ALL', 'GR10', 'GR11', 'GR12', 'NONE'];
    const next = cycle[(cycle.indexOf(q.visibility) + 1) % cycle.length];

    const updated = await prisma.question.update({
      where: { id: req.params.id },
      data: { visibility: next },
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/questions/bulk-delete — delete many at once (group delete in the UI)
//   body: { ids: string[] }
router.post('/bulk-delete', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? (req.body.ids as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 500)
      : [];
    if (!ids.length) return res.status(400).json({ error: 'No question ids provided' });

    // Tutors may only delete their own questions
    let deletableIds = ids;
    if (req.user!.role === 'TUTOR') {
      const owned = await prisma.question.findMany({
        where: { id: { in: ids }, createdById: req.user!.userId },
        select: { id: true },
      });
      deletableIds = owned.map((q) => q.id);
    }
    if (!deletableIds.length) {
      return res.status(403).json({ error: 'None of those questions are yours to delete' });
    }

    const result = await prisma.question.deleteMany({ where: { id: { in: deletableIds } } });
    await audit(req, 'questions.delete', 'Question', null, { count: result.count, requested: ids.length });
    return res.json({ deleted: result.count, requested: ids.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/questions/:id
router.delete('/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    if (req.user!.role === 'TUTOR') {
      const existing = await prisma.question.findUnique({ where: { id: req.params.id }, select: { createdById: true } });
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (existing.createdById !== req.user!.userId) {
        return res.status(403).json({ error: 'You can only delete your own questions' });
      }
    }
    await prisma.question.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/questions/import — bulk text import
router.post('/import', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text: string };
    if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });

    const blocks = text.split(/\n\s*\n/).filter((b: string) => b.trim());
    const created = [];

    for (const block of blocks) {
      const lines = block.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const get = (k: string) => {
        const l = lines.find((x: string) => x.toUpperCase().startsWith(k + ':'));
        return l ? l.slice(k.length + 1).trim() : null;
      };

      const subRaw = (get('SUBJECT') || 'mathematics').toLowerCase().replace(/\s+/g, '_');
      const sub = subjectMap[subRaw] || 'MATHEMATICS';
      const gr = parseInt(get('GRADE') || '10');
      const tp = get('TOPIC') || 'General';
      const diff = get('DIFF') || 'Medium';
      const vis = get('VIS') || 'all';
      const qt = get('Q') || get('QUESTION');
      const ans = get('ANS') || get('ANSWER');
      const sol = (get('SOL') || '').replace(/\\n/g, '\n');
      const opts = lines
        .filter((l: string) => l.toUpperCase().startsWith('A:'))
        .map((l: string) => l.slice(2).replace(/^★\s*/, '').trim());

      if (qt && ans) {
        const q = await prisma.question.create({
          data: {
            subject: sub as Subject,
            grade: gr,
            topic: tp,
            difficulty: diffMap[diff] || 'MEDIUM',
            question: qt,
            options: opts,
            answer: ans,
            solution: sol,
            visibility: visMap[vis] || 'ALL',
            createdById: req.user!.userId,
          },
        });
        created.push(q);
      }
    }

    return res.json({ created, count: created.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Quality signals (usage + correctness aggregates per question) ──
// GET /api/questions/stats?ids=id1,id2,...
//   Returns { questionId: { used, attempts, correctRate, packCount, avgTimeSec } }
router.get('/stats', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const idsParam = (req.query.ids as string) || '';
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 500);
    if (!ids.length) return res.json({});

    // Pack membership counts
    const packRows = await prisma.packQuestion.groupBy({
      by: ['questionId'],
      where: { questionId: { in: ids } },
      _count: { questionId: true },
    });

    // Result-detail aggregates (correct rate + attempts)
    const detailRows = await prisma.resultDetail.findMany({
      where: { questionId: { in: ids } },
      select: { questionId: true, isCorrect: true },
    });

    // Map back
    const packMap: Record<string, number> = {};
    for (const r of packRows) {
      if (r.questionId) packMap[r.questionId] = r._count.questionId;
    }

    const acc: Record<string, { attempts: number; correct: number }> = {};
    for (const d of detailRows) {
      if (!d.questionId) continue;
      const a = acc[d.questionId] || { attempts: 0, correct: 0 };
      a.attempts++;
      if (d.isCorrect) a.correct++;
      acc[d.questionId] = a;
    }

    const out: Record<string, { used: number; attempts: number; correctRate: number; packCount: number }> = {};
    for (const id of ids) {
      const a = acc[id] || { attempts: 0, correct: 0 };
      out[id] = {
        used: packMap[id] || 0,           // # of packs containing this Q
        packCount: packMap[id] || 0,
        attempts: a.attempts,
        correctRate: a.attempts ? Math.round((a.correct / a.attempts) * 100) : 0,
      };
    }
    return res.json(out);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Generation batches (history) ────────────────────────────────
// GET /api/questions/batches  — current user's recent generation batches
router.get('/batches', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const batches = await prisma.questionBatch.findMany({
      where: { createdById: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: { select: { items: true } },
      },
    });
    return res.json(batches.map((b) => ({
      id: b.id, subject: b.subject, grade: b.grade, topic: b.topic,
      requestedCount: b.requestedCount, difficulty: b.difficulty,
      createdAt: b.createdAt, questionCount: b._count.items,
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/questions/batches/:id  — the questions inside a batch
router.get('/batches/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const batch = await prisma.questionBatch.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { question: true }, orderBy: { order: 'asc' } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });
    if (!batch) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role !== 'ADMIN' && batch.createdById !== req.user!.userId) {
      return res.status(403).json({ error: 'Not your batch' });
    }
    return res.json({
      id: batch.id, subject: batch.subject, grade: batch.grade, topic: batch.topic,
      requestedCount: batch.requestedCount, difficulty: batch.difficulty,
      createdAt: batch.createdAt, createdBy: batch.createdBy,
      questions: batch.items.map((i) => ({
        ...i.question,
        expectedSeconds: expectedSecondsFor(i.question),
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/questions/batches/:id  — drop the batch record (does NOT delete the questions)
router.delete('/batches/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const batch = await prisma.questionBatch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role !== 'ADMIN' && batch.createdById !== req.user!.userId) {
      return res.status(403).json({ error: 'Not your batch' });
    }
    await prisma.questionBatch.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
