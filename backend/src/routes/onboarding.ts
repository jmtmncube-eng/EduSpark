import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/onboarding  — current user's state
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    let state = await prisma.onboardingState.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!state) {
      state = await prisma.onboardingState.create({
        data: { userId: req.user!.userId, completedSteps: [] },
      });
    }
    return res.json(state);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/onboarding  — mark step done or dismiss
router.patch('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { step, dismissed } = req.body as { step?: string; dismissed?: boolean };

    let state = await prisma.onboardingState.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!state) {
      state = await prisma.onboardingState.create({
        data: {
          userId: req.user!.userId,
          completedSteps: step ? [step] : [],
          dismissed: dismissed ?? false,
        },
      });
      return res.json(state);
    }

    const completed = new Set(state.completedSteps);
    if (step) completed.add(step);

    const updated = await prisma.onboardingState.update({
      where: { userId: req.user!.userId },
      data: {
        completedSteps: Array.from(completed),
        ...(typeof dismissed === 'boolean' ? { dismissed } : {}),
      },
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
