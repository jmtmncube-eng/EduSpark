import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOnly, adminOrTutorOnly } from '../middleware/auth';
import { expectedSecondsFor } from '../utils/questionGenerators';
import { generateForTopic, CAPS_TOPICS } from '../generators';
import { makeDiagramOfKind } from '../utils/diagramTemplates';
import { validateQuestion } from '../utils/questionValidation';
import { computeQualityFlag, type QualityFlag } from '../utils/questionQuality';
import { audit } from '../utils/audit';
import { Difficulty, Subject, Visibility, QuestionStatus } from '@prisma/client';

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
const STATUSES: QuestionStatus[] = ['DRAFT', 'REVIEW', 'PUBLISHED', 'RETIRED'];

// ─── Shared: per-question usage + quality stats ──────────────────
// Returns { id: { packCount, attempts, correctRate, discrimination } }.
// discrimination = correctRate(top-half performers) − correctRate(bottom-half),
// the classic "does this question separate strong from weak students?" metric.
async function computeQuestionStats(ids: string[]) {
  const out: Record<string, { packCount: number; attempts: number; correctRate: number; discrimination: number }> = {};
  if (!ids.length) return out;

  const packRows = await prisma.packQuestion.groupBy({
    by: ['questionId'],
    where: { questionId: { in: ids } },
    _count: { questionId: true },
  });
  const packMap: Record<string, number> = {};
  for (const r of packRows) if (r.questionId) packMap[r.questionId] = r._count.questionId;

  const detailRows = await prisma.resultDetail.findMany({
    where: { questionId: { in: ids } },
    select: { questionId: true, isCorrect: true, result: { select: { score: true } } },
  });

  const byQ: Record<string, { isCorrect: boolean; score: number }[]> = {};
  for (const d of detailRows) {
    if (!d.questionId) continue;
    (byQ[d.questionId] ??= []).push({ isCorrect: d.isCorrect, score: d.result?.score ?? 0 });
  }

  for (const id of ids) {
    const rows = byQ[id] || [];
    const attempts = rows.length;
    const correct = rows.filter((r) => r.isCorrect).length;
    const correctRate = attempts ? Math.round((correct / attempts) * 100) : 0;

    // Discrimination: split attempts by the student's overall quiz score.
    let discrimination = 0;
    if (attempts >= 4) {
      const sorted = [...rows].sort((a, b) => b.score - a.score);
      const half = Math.floor(sorted.length / 2);
      const top = sorted.slice(0, half);
      const bottom = sorted.slice(sorted.length - half);
      const rate = (arr: typeof rows) => (arr.length ? (arr.filter((r) => r.isCorrect).length / arr.length) * 100 : 0);
      discrimination = Math.round(rate(top) - rate(bottom));
    }

    out[id] = { packCount: packMap[id] || 0, attempts, correctRate, discrimination };
  }
  return out;
}

// GET /api/questions
// ADMIN: full bank (optional ?status= filter)
// TUTOR: questions inside packs shared with them + their own
// STUDENT: PUBLISHED questions inside packs unlocked for them
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { subject, visibility, search, grade, topic, status, qualityFlag } = req.query;
    const user = req.user!;

    const where: Record<string, unknown> = {};

    if (subject) where.subject = subjectMap[subject as string] || subject;
    if (topic) where.topic = topic as string;
    if (grade) where.grade = Number(grade);

    if (visibility && user.role === 'ADMIN') where.visibility = visMap[visibility as string] || visibility;

    // Admin can slice by review status + quality flag
    if (user.role === 'ADMIN') {
      if (status && STATUSES.includes(status as QuestionStatus)) where.status = status;
      if (qualityFlag === 'flagged') where.qualityFlag = { in: ['broken', 'trivial', 'low_discrimination'] };
      else if (qualityFlag && qualityFlag !== 'all') where.qualityFlag = qualityFlag;
    }

    // ─── Scope by pack membership for non-admins ────────────────────
    if (user.role === 'TUTOR') {
      const shares = await prisma.packShare.findMany({
        where: { tutorId: user.userId },
        include: { pack: { include: { questions: { select: { questionId: true } } } } },
      });
      const qIds = new Set<string>();
      shares.forEach((s) => s.pack.questions.forEach((pq) => qIds.add(pq.questionId)));
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
      const studentData = await prisma.user.findUnique({ where: { id: user.userId } });
      const g = studentData?.grade || 10;
      where.OR = [
        { id: { in: Array.from(qIds) } },
        { visibility: { in: ['ALL', `GR${g}` as Visibility] } },
      ];
      // Students NEVER see DRAFT/REVIEW/RETIRED — only published material.
      where.status = 'PUBLISHED';
    }

    if (search) {
      const searchClause = [
        { question: { contains: search as string, mode: 'insensitive' as const } },
        { topic: { contains: search as string, mode: 'insensitive' as const } },
      ];
      if (Array.isArray(where.OR)) {
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
// Generated questions land as REVIEW — a human signs them off (one-by-one or
// via the batch approve action) before they can be bundled into a Pack.
router.post('/generate', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { subject, grade, topic, count = 5, difficulty } = req.body as {
      subject: string; grade: number; topic: string; count?: number; difficulty?: string;
    };
    const sub = subjectMap[subject as string] || 'MATHEMATICS';
    const n = Math.min(Math.max(Number(count) || 0, 1), 20);
    const created = [];

    for (let i = 0; i < n; i++) {
      const { question: d, meta } = generateForTopic(topic, subject, Number(grade));
      // Validate every generated question — store any blocking errors so the
      // reviewer sees exactly what is wrong before approving.
      const errors = validateQuestion({
        question: d.q, options: d.opts, answer: d.ans, solution: d.sol, topic, subject,
      }).errors;
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
          // Smarter diagrams: the registry says which diagram is genuinely
          // relevant for this topic — or null, in which case we attach none.
          imageData: makeDiagramOfKind(meta.diagram),
          capsCode: meta.caps,
          cognitiveLevel: meta.cognitiveLevel,
          status: 'REVIEW',
          validationErrors: errors,
          createdById: req.user!.userId,
        },
      });
      created.push(q);
    }

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
          status: 'REVIEW',
          items: { create: created.map((q, order) => ({ questionId: q.id, order })) },
        },
      });
      await audit(req, 'questions.generate', 'QuestionBatch', batch.id, {
        subject, grade: Number(grade), topic, requested: n, produced: created.length,
        difficulty: difficulty || 'MIXED',
        flagged: created.filter((q) => q.validationErrors.length > 0).length,
      });
    }

    return res.json({ created, count: created.length, batchId: batch?.id ?? null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/questions   (admin or tutor)
// Hand-written questions: validated, then PUBLISHED if clean (admin) /
// REVIEW (tutor), or DRAFT if they have blocking errors.
router.post('/', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { subject, grade, topic, difficulty, question, options, answer, solution, visibility, imageData, capsCode, cognitiveLevel } = req.body;

    const errors = validateQuestion({ question, options, answer, solution, topic, subject }).errors;
    let status: QuestionStatus;
    if (errors.length > 0) status = 'DRAFT';
    else status = req.user!.role === 'ADMIN' ? 'PUBLISHED' : 'REVIEW';

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
        capsCode: capsCode?.trim() || null,
        cognitiveLevel: cognitiveLevel ? Number(cognitiveLevel) : null,
        status,
        validationErrors: errors,
        reviewedAt: status === 'PUBLISHED' ? new Date() : null,
        reviewedById: status === 'PUBLISHED' ? req.user!.userId : null,
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
    const existing = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role === 'TUTOR' && existing.createdById !== req.user!.userId) {
      return res.status(403).json({ error: 'You can only edit questions you created' });
    }

    const { subject, grade, topic, difficulty, question, options, answer, solution, visibility, imageData, capsCode, cognitiveLevel } = req.body;

    // Re-validate against the merged result so validationErrors stays accurate.
    const merged = {
      question: question ?? existing.question,
      options: options ?? existing.options,
      answer: answer ?? existing.answer,
      solution: solution ?? existing.solution,
      topic: topic ?? existing.topic,
      subject: subject || existing.subject,
    };
    const errors = validateQuestion(merged).errors;
    // A PUBLISHED question that now fails validation is bumped back to REVIEW —
    // it must not stay live with a known defect.
    const status: QuestionStatus | undefined =
      existing.status === 'PUBLISHED' && errors.length > 0 ? 'REVIEW' : undefined;

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
        capsCode: capsCode !== undefined ? (capsCode?.trim() || null) : undefined,
        cognitiveLevel: cognitiveLevel !== undefined ? (cognitiveLevel ? Number(cognitiveLevel) : null) : undefined,
        validationErrors: errors,
        status,
      },
    });

    return res.json(q);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/questions/:id/status — move a question through the review pipeline
//   body: { status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'RETIRED' }
router.patch('/:id/status', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const target = req.body?.status as QuestionStatus;
    if (!STATUSES.includes(target)) {
      return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
    }
    const q = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!q) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role === 'TUTOR' && q.createdById !== req.user!.userId) {
      return res.status(403).json({ error: 'You can only change status of your own questions' });
    }

    // GIGO gate — a question with blocking validation errors cannot be PUBLISHED.
    if (target === 'PUBLISHED') {
      const errors = validateQuestion(q).errors;
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Cannot publish — fix validation errors first', validationErrors: errors });
      }
    }

    const updated = await prisma.question.update({
      where: { id: req.params.id },
      data: {
        status: target,
        reviewedAt: target === 'PUBLISHED' ? new Date() : q.reviewedAt,
        reviewedById: target === 'PUBLISHED' ? req.user!.userId : q.reviewedById,
      },
    });
    await audit(req, 'question.status', 'Question', q.id, { from: q.status, to: target });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/questions/bulk-delete — delete many at once (group delete in the UI)
router.post('/bulk-delete', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? (req.body.ids as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 500)
      : [];
    if (!ids.length) return res.status(400).json({ error: 'No question ids provided' });

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

// POST /api/questions/import — bulk text import (lands as REVIEW)
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
        const errors = validateQuestion({ question: qt, options: opts, answer: ans, solution: sol, topic: tp, subject: subRaw }).errors;
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
            status: 'REVIEW',
            validationErrors: errors,
            createdById: req.user!.userId,
          },
        });
        created.push(q);
      }
    }

    await audit(req, 'questions.import', 'Question', null, {
      count: created.length, flagged: created.filter((q) => q.validationErrors.length > 0).length,
    });
    return res.json({ created, count: created.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Quality signals (usage + correctness + discrimination) ──────
// GET /api/questions/stats?ids=id1,id2,...
router.get('/stats', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const idsParam = (req.query.ids as string) || '';
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 500);
    if (!ids.length) return res.json({});

    const stats = await computeQuestionStats(ids);

    const out: Record<string, { used: number; packCount: number; attempts: number; correctRate: number; discrimination: number; qualityFlag: QualityFlag }> = {};
    for (const id of ids) {
      const s = stats[id] || { packCount: 0, attempts: 0, correctRate: 0, discrimination: 0 };
      out[id] = {
        used: s.packCount,
        packCount: s.packCount,
        attempts: s.attempts,
        correctRate: s.correctRate,
        discrimination: s.discrimination,
        qualityFlag: computeQualityFlag(s),
      };
    }
    return res.json(out);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/questions/quality-report — admin overview of flagged questions
router.get('/quality-report', authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const questions = await prisma.question.findMany({
      where: { status: { in: ['PUBLISHED', 'REVIEW'] } },
      select: { id: true, question: true, topic: true, subject: true, grade: true, status: true, difficulty: true },
      orderBy: { createdAt: 'desc' },
    });
    const ids = questions.map((q) => q.id);
    const stats = await computeQuestionStats(ids);

    const counts = { broken: 0, trivial: 0, low_discrimination: 0, no_attempts: 0, healthy: 0 };
    const flagged: {
      id: string; question: string; topic: string; subject: string; grade: number;
      status: string; difficulty: string; attempts: number; correctRate: number;
      discrimination: number; flag: string;
    }[] = [];

    for (const q of questions) {
      const s = stats[q.id] || { packCount: 0, attempts: 0, correctRate: 0, discrimination: 0 };
      const flag = computeQualityFlag(s);
      if (flag === 'broken') counts.broken++;
      else if (flag === 'trivial') counts.trivial++;
      else if (flag === 'low_discrimination') counts.low_discrimination++;
      else if (flag === 'no_attempts') counts.no_attempts++;
      else counts.healthy++;

      if (flag === 'broken' || flag === 'trivial' || flag === 'low_discrimination') {
        flagged.push({
          id: q.id, question: q.question.slice(0, 160), topic: q.topic,
          subject: q.subject, grade: q.grade, status: q.status, difficulty: q.difficulty,
          attempts: s.attempts, correctRate: s.correctRate, discrimination: s.discrimination, flag,
        });
      }
    }
    // Worst first: broken, then low_discrimination, then trivial
    const order: Record<string, number> = { broken: 0, low_discrimination: 1, trivial: 2 };
    flagged.sort((a, b) => (order[a.flag] - order[b.flag]) || (a.correctRate - b.correctRate));

    return res.json({ total: questions.length, counts, flagged: flagged.slice(0, 200) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/questions/recompute-flags — admin: refresh qualityFlag on every question
router.post('/recompute-flags', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const questions = await prisma.question.findMany({ select: { id: true } });
    const ids = questions.map((q) => q.id);
    const stats = await computeQuestionStats(ids);

    // Group ids by their computed flag, then one updateMany per flag value.
    const buckets: Record<string, string[]> = {};
    for (const id of ids) {
      const s = stats[id] || { packCount: 0, attempts: 0, correctRate: 0, discrimination: 0 };
      const flag = computeQualityFlag(s);
      const key = flag ?? '__null__';
      (buckets[key] ??= []).push(id);
    }
    let updated = 0;
    for (const [key, bucketIds] of Object.entries(buckets)) {
      const r = await prisma.question.updateMany({
        where: { id: { in: bucketIds } },
        data: { qualityFlag: key === '__null__' ? null : key },
      });
      updated += r.count;
    }
    await audit(req, 'questions.recomputeFlags', 'Question', null, { updated, total: ids.length });
    return res.json({ updated, total: ids.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Generation batches (history + review) ───────────────────────
// GET /api/questions/batches  — current user's recent generation batches
router.get('/batches', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const batches = await prisma.questionBatch.findMany({
      where: { createdById: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        items: { select: { question: { select: { status: true, validationErrors: true } } } },
      },
    });
    return res.json(batches.map((b) => {
      const items = b.items.map((i) => i.question);
      return {
        id: b.id, subject: b.subject, grade: b.grade, topic: b.topic,
        requestedCount: b.requestedCount, difficulty: b.difficulty, status: b.status,
        createdAt: b.createdAt, questionCount: items.length,
        publishedCount: items.filter((q) => q.status === 'PUBLISHED').length,
        reviewCount: items.filter((q) => q.status === 'REVIEW').length,
        flaggedCount: items.filter((q) => q.validationErrors.length > 0).length,
      };
    }));
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
      requestedCount: batch.requestedCount, difficulty: batch.difficulty, status: batch.status,
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

// POST /api/questions/batches/:id/approve — sign off a whole generation run.
// Every question in the batch that passes validation is PUBLISHED; any that
// still has blocking errors is left as REVIEW and reported back.
router.post('/batches/:id/approve', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const batch = await prisma.questionBatch.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { question: true } } },
    });
    if (!batch) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role !== 'ADMIN' && batch.createdById !== req.user!.userId) {
      return res.status(403).json({ error: 'Not your batch' });
    }

    const okIds: string[] = [];
    const failed: { id: string; errors: string[] }[] = [];
    for (const item of batch.items) {
      const errors = validateQuestion(item.question).errors;
      if (errors.length === 0) okIds.push(item.question.id);
      else failed.push({ id: item.question.id, errors });
    }

    if (okIds.length) {
      await prisma.question.updateMany({
        where: { id: { in: okIds } },
        data: { status: 'PUBLISHED', reviewedAt: new Date(), reviewedById: req.user!.userId },
      });
    }
    // Make sure any failing ones keep their errors recorded + sit in REVIEW.
    for (const f of failed) {
      await prisma.question.update({
        where: { id: f.id },
        data: { status: 'REVIEW', validationErrors: f.errors },
      });
    }
    await prisma.questionBatch.update({
      where: { id: batch.id },
      data: { status: failed.length ? 'PARTIAL' : 'APPROVED' },
    });
    await audit(req, 'questions.batchApprove', 'QuestionBatch', batch.id, {
      approved: okIds.length, failed: failed.length,
    });
    return res.json({ approved: okIds.length, failed: failed.length, failedQuestions: failed });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/questions/batches/:id/discard — bin a whole generation run.
// Deletes every question in the batch AND the batch record.
router.post('/batches/:id/discard', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const batch = await prisma.questionBatch.findUnique({
      where: { id: req.params.id },
      include: { items: { select: { questionId: true } } },
    });
    if (!batch) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role !== 'ADMIN' && batch.createdById !== req.user!.userId) {
      return res.status(403).json({ error: 'Not your batch' });
    }

    const qIds = batch.items.map((i) => i.questionId);
    // Only delete questions that are NOT already bundled into a pack — a
    // question someone already published + packed is no longer "just batch junk".
    const packed = await prisma.packQuestion.findMany({
      where: { questionId: { in: qIds } }, select: { questionId: true },
    });
    const packedSet = new Set(packed.map((p) => p.questionId));
    const deletableIds = qIds.filter((id) => !packedSet.has(id));

    const result = await prisma.question.deleteMany({ where: { id: { in: deletableIds } } });
    await prisma.questionBatch.delete({ where: { id: batch.id } });
    await audit(req, 'questions.batchDiscard', 'QuestionBatch', batch.id, {
      deleted: result.count, keptBecausePacked: qIds.length - deletableIds.length,
    });
    return res.json({ deleted: result.count, keptBecausePacked: qIds.length - deletableIds.length });
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
