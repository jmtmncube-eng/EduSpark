import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { generateQuestion } from '../utils/questionGenerators';
import { Difficulty, Subject } from '@prisma/client';

const router = Router();

const subjectMap: Record<string, Subject> = {
  mathematics: 'MATHEMATICS',
  physical_sciences: 'PHYSICAL_SCIENCES',
};
const diffMap: Record<string, Difficulty> = { Easy: 'EASY', Medium: 'MEDIUM', Hard: 'HARD' };

function isAssignedTo(assignTo: string, userGrade: number | null, userId: string) {
  if (assignTo === 'all') return true;
  if (assignTo === 'gr10') return userGrade === 10;
  if (assignTo === 'gr11') return userGrade === 11;
  if (assignTo === 'gr12') return userGrade === 12;
  return assignTo === userId;
}

// GET /api/assignments
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let assignments;

    if (user.role === 'ADMIN') {
      const rawAssignments = await prisma.assignment.findMany({
        include: {
          questions: { include: { question: true }, orderBy: { order: 'asc' } },
          documents: true,
          results: { select: { userId: true, score: true } },
          _count: { select: { results: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      assignments = rawAssignments.map((a) => ({
        ...a,
        assignedStudentCount: new Set(a.results.map((r) => r.userId)).size,
      }));
    } else {
      const student = await prisma.user.findUnique({ where: { id: user.userId } });
      const allAssignments = await prisma.assignment.findMany({
        include: {
          questions: { include: { question: true }, orderBy: { order: 'asc' } },
          documents: true,
          results: { where: { userId: user.userId } },
        },
        orderBy: { createdAt: 'desc' },
      });
      assignments = allAssignments.filter((a) =>
        isAssignedTo(a.assignTo, student?.grade ?? null, user.userId)
      );
    }

    return res.json(assignments);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/assignments/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: {
        questions: { include: { question: true }, orderBy: { order: 'asc' } },
        documents: true,
        results: { include: { user: { select: { id: true, name: true } }, details: true } },
      },
    });
    if (!assignment) return res.status(404).json({ error: 'Not found' });
    return res.json(assignment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/assignments
router.post('/', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { title, subject, grade, topic, dueDate, assignTo, questionIds, documents } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
    if (!dueDate) return res.status(400).json({ error: 'Due date required' });

    const sub = subjectMap[subject as string] || 'MATHEMATICS';
    let qIds: string[] = questionIds || [];

    // Auto-generate questions if none selected
    if (!qIds.length) {
      const existing = await prisma.question.findMany({
        where: { subject: sub as Subject, topic },
        take: 5,
      });
      if (existing.length < 2) {
        for (let i = 0; i < 5; i++) {
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
          existing.push(q);
        }
      }
      qIds = existing.slice(0, 5).map((q) => q.id);
    }

    const assignment = await prisma.assignment.create({
      data: {
        title: title.trim(),
        subject: sub as Subject,
        grade: Number(grade),
        topic,
        dueDate: new Date(dueDate),
        assignTo: assignTo || 'all',
        createdById: req.user!.userId,
        questions: {
          create: qIds.map((qId: string, order: number) => ({ questionId: qId, order })),
        },
        documents: {
          create: (documents || []).map((d: { title: string; content?: string; imageData?: string; documentType?: string }) => ({
            title: d.title || 'Document',
            content: d.content || null,
            imageData: d.imageData || null,
            documentType: d.documentType || 'text',
          })),
        },
      },
      include: {
        questions: { include: { question: true }, orderBy: { order: 'asc' } },
        documents: true,
      },
    });

    return res.status(201).json(assignment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/assignments/:id
router.put('/:id', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { title, subject, grade, topic, dueDate, assignTo, questionIds, documents } = req.body;

    // Delete existing relations and recreate
    await prisma.assignmentQuestion.deleteMany({ where: { assignmentId: req.params.id } });
    await prisma.assignmentDocument.deleteMany({ where: { assignmentId: req.params.id } });

    const sub = subjectMap[subject as string] || undefined;
    const assignment = await prisma.assignment.update({
      where: { id: req.params.id },
      data: {
        title: title?.trim(),
        subject: sub as Subject | undefined,
        grade: grade ? Number(grade) : undefined,
        topic,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        assignTo,
        questions: {
          create: (questionIds || []).map((qId: string, order: number) => ({ questionId: qId, order })),
        },
        documents: {
          create: (documents || []).map((d: { title: string; content?: string; imageData?: string; documentType?: string }) => ({
            title: d.title || 'Document',
            content: d.content || null,
            imageData: d.imageData || null,
            documentType: d.documentType || 'text',
          })),
        },
      },
      include: {
        questions: { include: { question: true }, orderBy: { order: 'asc' } },
        documents: true,
      },
    });

    return res.json(assignment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/assignments/:id
router.delete('/:id', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    await prisma.assignment.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
