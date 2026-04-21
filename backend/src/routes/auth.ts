import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { signToken } from '../middleware/auth';
import { makeUniquePin, generateTutorPin } from '../utils/pinGenerator';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { value, role } = req.body as { value: string; role: 'student' | 'tutor' | 'admin' };
    if (!value?.trim()) return res.status(400).json({ error: 'Please enter your name or PIN' });

    const input = value.trim();
    const upperInput = input.toUpperCase();

    // PIN login — SPK-XXXX (students), TCH-XXXX (tutors), ADM-XXXX (admins)
    if (/^(SPK|TCH|ADM)-[A-Z0-9]{4}$/i.test(upperInput)) {
      const user = await prisma.user.findUnique({ where: { pin: upperInput } });
      if (user) {
        if (!user.active) return res.status(403).json({ error: 'Account deactivated. Contact the admin.' });
        const token = signToken({ userId: user.id, role: user.role as 'STUDENT' | 'TUTOR' | 'ADMIN' });
        return res.json({ token, user: sanitize(user) });
      }
      return res.status(401).json({ error: 'PIN not found. Check your PIN and try again.' });
    }

    // Admin: PIN only — no name-based login
    if (role === 'admin') {
      return res.status(401).json({ error: 'Please enter your Admin PIN (ADM-XXXX) to sign in.' });
    }

    // Tutor: name → create account with TCH pin, or redirect to PIN if already exists
    if (role === 'tutor') {
      const existing = await prisma.user.findFirst({
        where: { role: 'TUTOR', name: { equals: input, mode: 'insensitive' } },
      });
      if (existing) {
        return res.status(401).json({
          error: 'You already have an account. Please sign in with your PIN (TCH-XXXX).',
          hasAccount: true,
        });
      }
      const pin = await makeUniquePin(
        async (p) => !!(await prisma.user.findUnique({ where: { pin: p } })),
        generateTutorPin
      );
      const tutor = await prisma.user.create({
        data: { name: input, role: 'TUTOR', pin, active: true },
      });
      const token = signToken({ userId: tutor.id, role: 'TUTOR' });
      return res.json({ token, user: sanitize(tutor), isNew: true });
    }

    // Student: name → check if returning, else show grade picker
    const existing = await prisma.user.findFirst({
      where: { role: 'STUDENT', name: { equals: input, mode: 'insensitive' } },
    });
    if (existing) {
      return res.status(401).json({
        error: 'You already have an account. Please sign in with your PIN (SPK-XXXX) instead.',
        hasAccount: true,
      });
    }

    return res.json({ needsGrade: true, name: input });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, grade } = req.body as { name: string; grade: number };
    if (!name?.trim() || !grade) return res.status(400).json({ error: 'Name and grade required' });

    const exists = await prisma.user.findFirst({
      where: { role: 'STUDENT', name: { equals: name.trim(), mode: 'insensitive' } },
    });
    if (exists) {
      return res.status(409).json({ error: 'A student with this name already exists. Use your PIN to sign in.', hasAccount: true });
    }

    const pin = await makeUniquePin(async (p) => !!(await prisma.user.findUnique({ where: { pin: p } })));
    const user = await prisma.user.create({
      data: { name: name.trim(), role: 'STUDENT', pin, grade: Number(grade), xp: 0 },
    });

    const token = signToken({ userId: user.id, role: 'STUDENT' });
    return res.json({ token, user: sanitize(user), isNew: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

function sanitize(u: Record<string, unknown>) {
  return { ...u };
}

export default router;
