import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOrTutorOnly } from '../middleware/auth';
import { expectedSecondsFor } from '../utils/questionGenerators';
import { generateForTopic } from '../generators';
import { makeDiagramOfKind } from '../utils/diagramTemplates';
import { validateQuestion } from '../utils/questionValidation';
import { Difficulty, Subject } from '@prisma/client';
import { notifyMany } from '../utils/notify';
import { audit } from '../utils/audit';

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
    const { role, userId } = req.user!;
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

    if (role === 'STUDENT') {
      const student = await prisma.user.findUnique({ where: { id: userId } });
      const fromTheirTutor = assignment.tutorId === null || assignment.tutorId === student?.teacherId;
      const assignedToThem = isAssignedTo(assignment.assignTo, student?.grade ?? null, userId);
      if (!fromTheirTutor || !assignedToThem) {
        return res.status(403).json({ error: 'This assignment is not assigned to you' });
      }
    }

    if (role === 'TUTOR' && assignment.tutorId !== userId) {
      return res.status(403).json({ error: 'You can only view your own assignments' });
    }

    // Enrich with expectedSeconds per question for the live timer
    const enriched = {
      ...assignment,
      questions: assignment.questions.map((aq) => ({
        ...aq,
        question: { ...aq.question, expectedSeconds: expectedSecondsFor(aq.question) },
      })),
    };
    return res.json(enriched);
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
      // Only pull PUBLISHED questions into an auto-built assignment.
      const existing = await prisma.question.findMany({
        where: { subject: sub as Subject, topic, status: 'PUBLISHED' }, take: 5,
      });
      if (existing.length < 2) {
        // Spread the auto-built set across difficulties so it isn't all warm-ups.
        const planDiffs: ('EASY' | 'MEDIUM' | 'HARD')[] = ['EASY', 'EASY', 'MEDIUM', 'MEDIUM', 'HARD'];
        for (let i = 0; i < 5; i++) {
          const { question: d, meta } = generateForTopic(topic, subject, Number(grade), planDiffs[i]);
          const errors = validateQuestion({
            question: d.q, options: d.opts, answer: d.ans, solution: d.sol, topic, subject,
          }).errors;
          const clean = errors.length === 0;
          const q = await prisma.question.create({
            data: {
              subject: sub as Subject, grade: Number(grade), topic,
              difficulty: diffMap[d.diff] || planDiffs[i],
              question: d.q, options: d.opts, answer: d.ans, solution: d.sol,
              visibility: 'ALL',
              imageData: makeDiagramOfKind(meta.diagram),
              capsCode: meta.caps,
              cognitiveLevel: meta.cognitiveLevel,
              status: clean ? 'PUBLISHED' : 'REVIEW',
              validationErrors: errors,
              reviewedAt: clean ? new Date() : null,
              reviewedById: clean ? req.user!.userId : null,
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

    // ─── Phase 4: notify affected students ─────────────────────────────
    try {
      const studentFilter: Record<string, unknown> = { role: 'STUDENT', active: true };
      if (isTutor) studentFilter.teacherId = req.user!.userId;
      if (assignment.assignTo === 'gr10') studentFilter.grade = 10;
      else if (assignment.assignTo === 'gr11') studentFilter.grade = 11;
      else if (assignment.assignTo === 'gr12') studentFilter.grade = 12;
      else if (assignment.assignTo !== 'all') studentFilter.id = assignment.assignTo;

      const students = await prisma.user.findMany({ where: studentFilter, select: { id: true } });
      await notifyMany(students.map((s) => ({
        userId: s.id,
        type: 'assignment_new' as const,
        title: `📋 New assignment: ${assignment.title}`,
        body: `Due ${new Date(assignment.dueDate).toLocaleDateString('en-ZA')} · ${assignment.topic}`,
        link: '/app/my-work',
      })));
    } catch (e) { console.error('[notify on assignment create]', e); }

    await audit(req, 'assignment.create', 'Assignment', assignment.id, {
      title: assignment.title, subject: assignment.subject, grade: assignment.grade,
      topic: assignment.topic, assignTo: assignment.assignTo, dueDate: assignment.dueDate,
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

    await audit(req, 'assignment.update', 'Assignment', assignment.id, { title: assignment.title });
    return res.json(assignment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/assignments/:id/live — submission progress tray
// Returns { eligible, submitted, inProgress, avgScore, latest }
router.get('/:id/live', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    if (!assignment) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role === 'TUTOR' && assignment.tutorId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not your assignment' });
    }

    // Who is eligible to take this assignment?
    const studentWhere: Record<string, unknown> = { role: 'STUDENT', active: true };
    if (assignment.tutorId) studentWhere.teacherId = assignment.tutorId;
    if (assignment.assignTo === 'gr10') studentWhere.grade = 10;
    else if (assignment.assignTo === 'gr11') studentWhere.grade = 11;
    else if (assignment.assignTo === 'gr12') studentWhere.grade = 12;
    else if (assignment.assignTo !== 'all') studentWhere.id = assignment.assignTo;

    const [eligible, results] = await Promise.all([
      prisma.user.count({ where: studentWhere }),
      prisma.quizResult.findMany({
        where: { assignmentId: assignment.id, resultType: 'ASSIGNMENT' },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { completedAt: 'desc' },
        take: 200,
      }),
    ]);

    const submitterIds = new Set(results.map((r) => r.userId));
    const submitted = submitterIds.size;
    const avgScore = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;
    const latest = results.slice(0, 5).map((r) => ({
      id: r.id, userId: r.userId, userName: r.user?.name ?? 'Student',
      score: r.score, correct: r.correct, total: r.total, completedAt: r.completedAt,
    }));
    return res.json({ eligible, submitted, avgScore, latest });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/assignments/:id/heatmap — per-question correctness across all submissions
router.get('/:id/heatmap', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: { questions: { include: { question: true }, orderBy: { order: 'asc' } } },
    });
    if (!assignment) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role === 'TUTOR' && assignment.tutorId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not your assignment' });
    }

    const qIds = assignment.questions.map((aq) => aq.question.id);
    const details = await prisma.resultDetail.findMany({
      where: {
        questionId: { in: qIds },
        result: { assignmentId: assignment.id, resultType: 'ASSIGNMENT' },
      },
      select: { questionId: true, isCorrect: true },
    });

    const acc: Record<string, { attempts: number; correct: number }> = {};
    for (const d of details) {
      if (!d.questionId) continue;
      const a = acc[d.questionId] || { attempts: 0, correct: 0 };
      a.attempts++;
      if (d.isCorrect) a.correct++;
      acc[d.questionId] = a;
    }

    const rows = assignment.questions.map((aq, i) => {
      const a = acc[aq.question.id] || { attempts: 0, correct: 0 };
      const correctRate = a.attempts ? Math.round((a.correct / a.attempts) * 100) : 0;
      return {
        index: i + 1,
        questionId: aq.question.id,
        question: aq.question.question,
        difficulty: aq.question.difficulty,
        attempts: a.attempts,
        correctRate,
      };
    });
    return res.json({ rows });
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
    await audit(req, 'assignment.delete', 'Assignment', req.params.id);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
