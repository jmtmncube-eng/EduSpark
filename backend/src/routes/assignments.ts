import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOrTutorOnly } from '../middleware/auth';
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
    const { role, userId } = req.user!;

    if (role === 'ADMIN') {
      // SuperAdmin sees all assignments
      const all = await prisma.assignment.findMany({
        include: {
          questions: { include: { question: true }, orderBy: { order: 'asc' } },
          documents: true,
          _count: { select: { results: true } },
          createdBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(all);
    }

    if (role === 'TUTOR') {
      // Tutor sees only their own assignments
      const tutorAssignments = await prisma.assignment.findMany({
        where: { tutorId: userId },
        include: {
          questions: { include: { question: true }, orderBy: { order: 'asc' } },
          documents: true,
          _count: { select: { results: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(tutorAssignments);
    }

    // STUDENT — see global admin assignments + their tutor's assignments
    const student = await prisma.user.findUnique({ where: { id: userId } });
    const all = await prisma.assignment.findMany({
      where: {
        OR: [
          { tutorId: null },                                   // global admin assignments
          { tutorId: student?.teacherId ?? '__none__' },       // their tutor's assignments
        ],
      },
      include: {
        questions: { include: { question: true }, orderBy: { order: 'asc' } },
        documents: true,
        results: { where: { userId } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const visible = all.filter((a) => isAssignedTo(a.assignTo, student?.grade ?? null, userId));
    return res.json(visible);
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
        createdBy: { select: { id: true, name: true, role: true } },
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
router.post('/', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { title, subject, grade, topic, dueDate, assignTo, maxAttempts, questionIds, documents } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
    if (!dueDate) return res.status(400).json({ error: 'Due date required' });

    const sub = subjectMap[subject as string] || 'MATHEMATICS';
    const isTutor = req.user!.role === 'TUTOR';
    let qIds: string[] = questionIds || [];

    if (!qIds.length) {
      const existing = await prisma.question.findMany({ where: { subject: sub as Subject, topic }, take: 5 });
      if (existing.length < 2) {
        for (let i = 0; i < 5; i++) {
          const d = generateQuestion(topic, subject, Number(grade));
          const q = await prisma.question.create({
            data: {
              subject: sub as Subject, grade: Number(grade), topic,
              difficulty: diffMap[d.diff] || 'EASY',
              question: d.q, options: d.opts, answer: d.ans, solution: d.sol,
              visibility: 'ALL', createdById: req.user!.userId,
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
        maxAttempts: Number(maxAttempts) || 3,
        tutorId: isTutor ? req.user!.userId : null,
        createdById: req.user!.userId,
        questions: { create: qIds.map((qId: string, order: number) => ({ questionId: qId, order })) },
        documents: {
          create: (documents || []).map((d: { title: string; content?: string; imageData?: string; documentType?: string }) => ({
            title: d.title || 'Document', content: d.content || null, imageData: d.imageData || null,
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
router.put('/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    // Tutors can only edit their own assignments
    if (req.user!.role === 'TUTOR') {
      const existing = await prisma.assignment.findUnique({ where: { id: req.params.id } });
      if (!existing || existing.tutorId !== req.user!.userId) {
        return res.status(403).json({ error: 'You can only edit your own assignments' });
      }
    }

    const { title, subject, grade, topic, dueDate, assignTo, maxAttempts, questionIds, documents } = req.body;
    await prisma.assignmentQuestion.deleteMany({ where: { assignmentId: req.params.id } });
    await prisma.assignmentDocument.deleteMany({ where: { assignmentId: req.params.id } });

    const sub = subjectMap[subject as string] || undefined;
    const assignment = await prisma.assignment.update({
      where: { id: req.params.id },
      data: {
        title: title?.trim(), subject: sub as Subject | undefined,
        grade: grade ? Number(grade) : undefined, topic,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        assignTo, maxAttempts: maxAttempts ? Number(maxAttempts) : undefined,
        questions: { create: (questionIds || []).map((qId: string, order: number) => ({ questionId: qId, order })) },
        documents: {
          create: (documents || []).map((d: { title: string; content?: string; imageData?: string; documentType?: string }) => ({
            title: d.title || 'Document', content: d.content || null, imageData: d.imageData || null,
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
router.delete('/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    if (req.user!.role === 'TUTOR') {
      const existing = await prisma.assignment.findUnique({ where: { id: req.params.id } });
      if (!existing || existing.tutorId !== req.user!.userId) {
        return res.status(403).json({ error: 'You can only delete your own assignments' });
      }
    }
    await prisma.assignment.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
