import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();

function calcXP(score: number, total: number): number {
  return Math.round((score / 100) * total * 10) + (score >= 80 ? 20 : score >= 60 ? 10 : 0);
}

function calcPracticeXP(score: number, total: number): number {
  // Half XP for practice, no completion bonus
  return Math.round(((score / 100) * total * 10) / 2);
}

function isAssignedTo(assignTo: string, grade: number | null, uid: string) {
  if (assignTo === 'all') return true;
  if (assignTo === 'gr10') return grade === 10;
  if (assignTo === 'gr11') return grade === 11;
  if (assignTo === 'gr12') return grade === 12;
  return assignTo === uid;
}

// POST /api/results — submit assigned quiz
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { assignmentId, answers } = req.body as {
      assignmentId: string;
      answers: { questionId: string; selectedAnswer: string }[];
    };

    const userId = req.user!.userId;

    const [assignment, attemptCount] = await Promise.all([
      prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: { questions: { include: { question: true }, orderBy: { order: 'asc' } } },
      }),
      prisma.quizResult.count({ where: { userId, assignmentId } }),
    ]);

    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    const student = await prisma.user.findUnique({ where: { id: userId } });
    const fromTheirTutor = assignment.tutorId === null || assignment.tutorId === student?.teacherId;
    if (!fromTheirTutor || !isAssignedTo(assignment.assignTo, student?.grade ?? null, userId)) {
      return res.status(403).json({ error: 'This assignment is not assigned to you' });
    }

    if (attemptCount >= assignment.maxAttempts) {
      return res.status(400).json({ error: 'Maximum attempts reached for this assignment' });
    }

    const questions = assignment.questions.map((aq) => aq.question);
    const answerMap: Record<string, string> = {};
    (answers || []).forEach((a) => { answerMap[a.questionId] = a.selectedAnswer; });

    let correct = 0;
    const details = questions.map((q) => {
      const selected = answerMap[q.id] ?? null;
      const ok = selected === q.answer;
      if (ok) correct++;
      return { questionText: q.question, selectedAnswer: selected, correctAnswer: q.answer, isCorrect: ok, solution: q.solution, difficulty: q.difficulty, imageData: q.imageData, questionId: q.id };
    });

    const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    const xpEarned = calcXP(score, questions.length);

    const result = await prisma.quizResult.create({
      data: {
        score, correct, total: questions.length, timeTaken: 0, xpEarned,
        attemptNumber: attemptCount + 1, resultType: 'ASSIGNMENT',
        userId, assignmentId,
        details: { create: details },
      },
      include: { details: { include: { question: { select: { options: true } } } } },
    });

    await prisma.user.update({ where: { id: userId }, data: { xp: { increment: xpEarned } } });

    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/results/practice — save a question bank practice session
router.post('/practice', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { questionIds, answers, topic, subject } = req.body as {
      questionIds: string[];
      answers: { questionId: string; selectedAnswer: string | null; timeSpent: number }[];
      topic: string;
      subject: string;
    };

    const userId = req.user!.userId;

    const questions = await prisma.question.findMany({ where: { id: { in: questionIds } } });
    const answerMap: Record<string, string | null> = {};
    (answers || []).forEach((a) => { answerMap[a.questionId] = a.selectedAnswer; });

    let correct = 0;
    const details = questions.map((q) => {
      const selected = answerMap[q.id] ?? null;
      const ok = selected === q.answer;
      if (ok) correct++;
      return { questionText: q.question, selectedAnswer: selected, correctAnswer: q.answer, isCorrect: ok, solution: q.solution, difficulty: q.difficulty, imageData: q.imageData, questionId: q.id };
    });

    const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    const xpEarned = calcPracticeXP(score, questions.length);

    const result = await prisma.quizResult.create({
      data: {
        score, correct, total: questions.length, timeTaken: 0, xpEarned,
        resultType: 'PRACTICE', practiceTopic: topic, practiceSubject: subject,
        userId,
        details: { create: details },
      },
    });

    await prisma.user.update({ where: { id: userId }, data: { xp: { increment: xpEarned } } });

    return res.status(201).json({ ...result, xpEarned });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/results — get all results for current user (assignments + practice)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const results = await prisma.quizResult.findMany({
      where: { userId: req.user!.userId },
      include: { assignment: { select: { title: true, subject: true, topic: true, grade: true } } },
      orderBy: { completedAt: 'desc' },
    });
    return res.json(results);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/results/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await prisma.quizResult.findUnique({
      where: { id: req.params.id },
      include: {
        assignment: { select: { title: true, subject: true, topic: true, grade: true } },
        details: { include: { question: { select: { options: true } } } },
      },
    });
    if (!result) return res.status(404).json({ error: 'Not found' });
    // Tutors can view results of their own students
    if (result.userId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      if (req.user!.role === 'TUTOR') {
        const student = await prisma.user.findUnique({ where: { id: result.userId } });
        if (student?.teacherId !== req.user!.userId) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      } else {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/results/assignment/:assignmentId
router.get('/assignment/:assignmentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, userId } = req.user!;
    const where: Record<string, unknown> = { assignmentId: req.params.assignmentId };

    if (role === 'ADMIN') {
      // Admin sees all results
    } else if (role === 'TUTOR') {
      const [assignment, tutorStudents] = await Promise.all([
        prisma.assignment.findUnique({ where: { id: req.params.assignmentId } }),
        prisma.user.findMany({ where: { teacherId: userId }, select: { id: true } }),
      ]);
      if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

      const tutorStudentIds = tutorStudents.map((s) => s.id);

      if (assignment.tutorId !== null && assignment.tutorId !== userId) {
        // Belongs to a different tutor
        return res.status(403).json({ error: 'You can only view results for your own assignments' });
      }
      // Global admin assignment OR their own assignment — filter to their students only
      where.userId = { in: tutorStudentIds };
    } else {
      // Student sees only their own results
      where.userId = userId;
    }

    const results = await prisma.quizResult.findMany({
      where,
      include: { user: { select: { id: true, name: true, grade: true } }, details: true },
    });
    return res.json(results);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
