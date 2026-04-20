import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { signToken } from '../middleware/auth';
import { makeUniquePin } from '../utils/pinGenerator';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { value, role } = req.body as { value: string; role: 'student' | 'admin' };

    if (!value?.trim()) {
      return res.status(400).json({ error: 'Please enter your name or PIN' });
    }

    const input = value.trim();
    const upperInput = input.toUpperCase();

    // PIN login (works for both students and admins with PIN)
    if (/^SPK-[A-Z0-9]{4}$/i.test(upperInput)) {
      const user = await prisma.user.findUnique({ where: { pin: upperInput } });
      if (user) {
        if (!user.active) return res.status(403).json({ error: 'Account deactivated. Contact your teacher.' });
        const token = signToken({ userId: user.id, role: user.role as 'STUDENT' | 'ADMIN' });
        return res.json({ token, user: sanitize(user) });
      }
      return res.status(401).json({ error: 'PIN not found. Check your PIN and try again.' });
    }

    // Admin login by name — find existing or create
    if (role === 'admin') {
      let adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN', name: { equals: input, mode: 'insensitive' } },
      });
      if (!adminUser) {
        adminUser = await prisma.user.create({
          data: { name: input, role: 'ADMIN', pin: null },
        });
      }
      const token = signToken({ userId: adminUser.id, role: 'ADMIN' });
      return res.json({ token, user: sanitize(adminUser) });
    }

    // Student name input — only allowed for NEW students
    const existing = await prisma.user.findFirst({
      where: { role: 'STUDENT', name: { equals: input, mode: 'insensitive' } },
    });

    if (existing) {
      // Existing student must use their PIN
      return res.status(401).json({
        error: 'You already have an account. Please sign in with your PIN (SPK-XXXX) instead.',
        hasAccount: true,
      });
    }

    // New student — return signal to confirm grade
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

    // Prevent duplicate registration
    const exists = await prisma.user.findFirst({
      where: { role: 'STUDENT', name: { equals: name.trim(), mode: 'insensitive' } },
    });
    if (exists) {
      return res.status(409).json({
        error: 'A student with this name already exists. Use your PIN to sign in.',
        hasAccount: true,
      });
    }

    const pin = await makeUniquePin(async (p) => {
      const e = await prisma.user.findUnique({ where: { pin: p } });
      return !!e;
    });

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
  const { ...rest } = u;
  return rest;
}

export default router;
