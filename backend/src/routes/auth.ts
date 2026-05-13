import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db/client';
import { signToken, authMiddleware } from '../middleware/auth';
import { makeUniquePin, generateTutorPin } from '../utils/pinGenerator';

// Normalise security answers so case + spacing don't matter
function normalizeAnswer(s: string): string {
  return s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { value, role } = req.body as { value: string; role: 'student' | 'tutor' | 'admin' };
    if (!value?.trim()) return res.status(400).json({ error: 'Please enter your name or PIN' });

    const input = value.trim();
    const upperInput = input.toUpperCase();

    // PAR-XXXX — parent temporary PIN login (no User record needed)
    if (/^PAR-[A-Z0-9]{4}$/i.test(upperInput)) {
      const access = await prisma.parentAccess.findUnique({
        where: { pin: upperInput },
        include: { student: { select: { id: true, name: true, grade: true } } },
      });
      if (!access) return res.status(401).json({ error: 'Parent PIN not found. Check the link your teacher shared.' });
      if (new Date() > access.expiresAt) {
        return res.status(401).json({ error: 'This parent PIN has expired. Ask the teacher to generate a new one.' });
      }
      const daysLeft = Math.ceil((access.expiresAt.getTime() - Date.now()) / 86_400_000);
      const token = signToken({ userId: upperInput, role: 'PARENT' });
      return res.json({
        token,
        user: {
          id: upperInput,
          name: access.student.name,
          role: 'PARENT',
          pin: upperInput,
          grade: access.student.grade,
          xp: 0,
          active: true,
          photo: null,
          createdAt: access.createdAt.toISOString(),
          label: access.label,
          studentId: access.studentId,
          daysLeft,
        },
      });
    }

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

    // Tutor: name → check existing, else prompt for profile setup
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
      // New tutor — prompt frontend for subjects + grades before creating account
      return res.json({ needsProfile: true, name: input });
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

// Student registration (after grade picker)
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

// Tutor registration (after subject/grade profile setup)
router.post('/register-tutor', async (req: Request, res: Response) => {
  try {
    const { name, subjects, teachGrades } = req.body as {
      name: string;
      subjects: string[];
      teachGrades: number[];
    };
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

    const exists = await prisma.user.findFirst({
      where: { role: 'TUTOR', name: { equals: name.trim(), mode: 'insensitive' } },
    });
    if (exists) {
      return res.status(409).json({ error: 'A tutor with this name already exists. Use your PIN to sign in.', hasAccount: true });
    }

    const pin = await makeUniquePin(
      async (p) => !!(await prisma.user.findUnique({ where: { pin: p } })),
      generateTutorPin
    );

    const tutor = await prisma.user.create({
      data: {
        name: name.trim(),
        role: 'TUTOR',
        pin,
        active: true,
        subjects: subjects ?? [],
        teachGrades: teachGrades ?? [],
      },
    });

    const token = signToken({ userId: tutor.id, role: 'TUTOR' });
    return res.json({ token, user: sanitize(tutor), isNew: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

function sanitize(u: Record<string, unknown>) {
  // Never leak the security answer hash to clients
  const out = { ...u };
  delete out.securityAnswerHash;
  return out;
}

// ─── PIN Recovery via Security Question ──────────────────────────
//
// Step 1: POST /api/auth/recover/lookup { name, role }
//          → returns { ok: true, question: "..." } if a single match has one,
//            or { ok: false, hint: "no security question set" } / 404 if not found.
//
// Step 2: POST /api/auth/recover/verify { name, role, answer }
//          → on match, returns the PIN. Rate-limit happens via the global /auth limiter.

router.post('/recover/lookup', async (req: Request, res: Response) => {
  try {
    const { name, role } = req.body as { name: string; role: 'student' | 'tutor' | 'admin' };
    if (!name?.trim()) return res.status(400).json({ error: 'Please enter the name you signed up with.' });
    const wantedRole = role === 'admin' ? 'ADMIN' : role === 'tutor' ? 'TUTOR' : 'STUDENT';

    const user = await prisma.user.findFirst({
      where: {
        role: wantedRole,
        name: { equals: name.trim(), mode: 'insensitive' },
      },
      select: { id: true, securityQuestion: true, securityAnswerHash: true, active: true },
    });

    if (!user) {
      // Don't reveal whether the name exists — keep responses uniform
      return res.status(404).json({ error: 'No account with that name. Check the spelling you signed up with.' });
    }
    if (!user.active) {
      return res.status(403).json({ error: 'Account deactivated. Please contact an admin.' });
    }
    if (!user.securityQuestion || !user.securityAnswerHash) {
      return res.status(409).json({
        error: "This account doesn't have a recovery question set. Please ask an admin to reset your PIN.",
        hint: 'no_question',
      });
    }

    return res.json({ ok: true, question: user.securityQuestion });
  } catch (err) {
    console.error('[recover/lookup]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/recover/verify', async (req: Request, res: Response) => {
  try {
    const { name, role, answer } = req.body as { name: string; role: 'student' | 'tutor' | 'admin'; answer: string };
    if (!name?.trim() || !answer?.trim()) return res.status(400).json({ error: 'Please complete all fields.' });

    const wantedRole = role === 'admin' ? 'ADMIN' : role === 'tutor' ? 'TUTOR' : 'STUDENT';
    const user = await prisma.user.findFirst({
      where: {
        role: wantedRole,
        name: { equals: name.trim(), mode: 'insensitive' },
      },
    });
    if (!user || !user.securityAnswerHash || !user.pin) {
      return res.status(404).json({ error: 'Recovery not available for this account.' });
    }

    const ok = await bcrypt.compare(normalizeAnswer(answer), user.securityAnswerHash);
    if (!ok) return res.status(401).json({ error: 'That answer doesn\'t match. Please try again.' });

    // Don't auto-log in — return the PIN and let the user sign in normally
    return res.json({ ok: true, pin: user.pin, name: user.name });
  } catch (err) {
    console.error('[recover/verify]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Authed: set / update own security question ───────────────────
router.post('/security-question', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { question, answer } = req.body as { question: string; answer: string };
    if (!question?.trim() || !answer?.trim()) {
      return res.status(400).json({ error: 'Both question and answer are required.' });
    }
    if (answer.trim().length < 2) {
      return res.status(400).json({ error: 'Answer is too short.' });
    }

    const hash = await bcrypt.hash(normalizeAnswer(answer), 10);
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { securityQuestion: question.trim().slice(0, 200), securityAnswerHash: hash },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[security-question]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Authed: status — does this user have a security question set? ─
router.get('/security-status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const u = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { securityQuestion: true, securityAnswerHash: true },
    });
    return res.json({
      set: !!(u?.securityQuestion && u?.securityAnswerHash),
      question: u?.securityQuestion ?? null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
