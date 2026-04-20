import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { generateQuestion, CAPS_TOPICS } from '../utils/questionGenerators';
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
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { subject, visibility, search, grade } = req.query;
    const user = req.user!;

    const where: Record<string, unknown> = {};

    if (subject) where.subject = subjectMap[subject as string] || subject;
    if (visibility && user.role === 'ADMIN') where.visibility = visMap[visibility as string] || visibility;

    // Students only see visible questions for their grade
    if (user.role === 'STUDENT') {
      const studentData = await prisma.user.findUnique({ where: { id: user.userId } });
      const g = studentData?.grade || 10;
      where.visibility = { in: ['ALL', `GR${g}` as Visibility] };
    }

    if (search) {
      where.OR = [
        { question: { contains: search as string, mode: 'insensitive' } },
        { topic: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (grade && user.role === 'ADMIN') where.grade = Number(grade);

    const questions = await prisma.question.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.json(questions);
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
router.post('/generate', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { subject, grade, topic, count = 5 } = req.body;
    const sub = subjectMap[subject as string] || 'MATHEMATICS';
    const n = Math.min(Number(count), 20);
    const created = [];

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
          createdById: req.user!.userId,
        },
      });
      created.push(q);
    }

    return res.json({ created, count: created.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/questions
router.post('/', authMiddleware, adminOnly, async (req: Request, res: Response) => {
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
router.put('/:id', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
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

// DELETE /api/questions/:id
router.delete('/:id', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    await prisma.question.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/questions/import — bulk text import
router.post('/import', authMiddleware, adminOnly, async (req: Request, res: Response) => {
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

export default router;
