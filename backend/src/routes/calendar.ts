import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOrTutorOnly, adminOnly } from '../middleware/auth';
import { notify, notifyMany } from '../utils/notify';

const router = Router();

/**
 * Calendar scoping rules (Phase 7)
 *
 *  ADMIN:
 *    sees · all admin-created notes
 *          · all tutor notes flagged `sharedWithAdmin` (maintenance / heads-up)
 *
 *  TUTOR:
 *    sees · their own notes (scoped to their class)
 *          · admin notes with kind = "broadcast" (school-wide / maintenance)
 *
 *  STUDENT:
 *    sees · admin broadcasts
 *          · their tutor's notes that target them OR have no studentId (whole-class)
 *
 *  Tutors create notes scoped to a single student (studentId set) or to their
 *  whole class (studentId null). Tutors may flag a note "share with admin" to
 *  surface it to admin (e.g. "Need extra projector for Saturday session").
 *
 *  Students may submit CalendarRequests:
 *    requestType = "move"   — change date of an existing tutor note
 *    requestType = "new"    — propose a new tutoring session
 *    requestType = "cancel" — request a session be cancelled
 *  The owning tutor approves/denies. Approving a "move" updates the note's
 *  date; approving a "new" creates a new note.
 */

const ALLOWED_KINDS = new Set(['note', 'class', 'session', 'maintenance', 'broadcast', 'up']);

// ─── GET /api/calendar/notes  — role-scoped ───────────────────────
router.get('/notes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, userId } = req.user!;
    let where: Record<string, unknown> = {};

    if (role === 'ADMIN') {
      where = {
        OR: [
          { tutorId: null }, // admin-authored / legacy global notes
          { sharedWithAdmin: true },
        ],
      };
    } else if (role === 'TUTOR') {
      where = {
        OR: [
          { tutorId: userId },
          { kind: 'broadcast' },
          { AND: [{ tutorId: null }, { kind: 'maintenance' }] },
        ],
      };
    } else if (role === 'STUDENT') {
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { teacherId: true } });
      where = {
        OR: [
          { kind: 'broadcast' },
          { AND: [{ tutorId: null }, { studentId: null }] }, // legacy admin notes visible to all
          {
            AND: [
              { tutorId: me?.teacherId ?? '__none__' },
              { OR: [{ studentId: null }, { studentId: userId }] },
            ],
          },
        ],
      };
    }

    const notes = await prisma.calendarNote.findMany({
      where,
      include: {
        tutor:   { select: { id: true, name: true } },
        student: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });
    return res.json(notes);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/calendar/notes ─────────────────────────────────────
router.post('/notes', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { date, title, content, color, studentId, kind, sharedWithAdmin } = req.body as {
      date: string; title: string; content?: string; color?: string;
      studentId?: string | null;
      kind?: string;
      sharedWithAdmin?: boolean;
    };
    if (!date || !title?.trim()) return res.status(400).json({ error: 'Date and title required' });

    const { role, userId } = req.user!;
    const isTutor = role === 'TUTOR';

    // Validate studentId — must be one of the tutor's students if provided by a tutor
    let resolvedStudentId: string | null = null;
    if (studentId) {
      const target = await prisma.user.findUnique({ where: { id: studentId } });
      if (!target || target.role !== 'STUDENT') return res.status(400).json({ error: 'Invalid studentId' });
      if (isTutor && target.teacherId !== userId) {
        return res.status(403).json({ error: 'You can only schedule for your own students' });
      }
      resolvedStudentId = studentId;
    }

    const cleanKind = ALLOWED_KINDS.has(kind || '') ? kind! : (isTutor ? 'session' : 'note');

    const note = await prisma.calendarNote.create({
      data: {
        date,
        title: title.trim(),
        content: content || null,
        color: color || (cleanKind === 'session' ? 'session' : 'note'),
        createdById: userId,
        tutorId: isTutor ? userId : null,
        studentId: resolvedStudentId,
        kind: cleanKind,
        sharedWithAdmin: !!sharedWithAdmin && isTutor,
      },
      include: {
        tutor: { select: { id: true, name: true } },
        student: { select: { id: true, name: true } },
      },
    });

    // ─── Notify affected audience ──────────────────────────────────
    try {
      const link = '/app/calendar';
      const titleEmoji = cleanKind === 'session' ? '📅' : cleanKind === 'maintenance' ? '🛠' : cleanKind === 'broadcast' ? '📢' : '🗓';

      if (isTutor) {
        // Notify student(s)
        const students = resolvedStudentId
          ? await prisma.user.findMany({ where: { id: resolvedStudentId } })
          : await prisma.user.findMany({ where: { role: 'STUDENT', teacherId: userId, active: true } });

        await notifyMany(students.map((s) => ({
          userId: s.id,
          type: 'assignment_new' as const,
          title: `${titleEmoji} ${title.trim()}`,
          body: `${date}${content ? ' · ' + content : ''}`,
          link,
        })));

        // If shared with admin, notify admins
        if (note.sharedWithAdmin) {
          const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
          const tutor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
          await notifyMany(admins.map((a) => ({
            userId: a.id,
            type: 'assignment_new' as const,
            title: `🛠 Tutor calendar: ${title.trim()}`,
            body: `From ${tutor?.name ?? 'a tutor'} · ${date}`,
            link,
          })));
        }
      } else if (role === 'ADMIN' && cleanKind === 'broadcast') {
        // Admin → broadcast to all active students + tutors
        const recipients = await prisma.user.findMany({
          where: { role: { in: ['STUDENT', 'TUTOR'] }, active: true },
          select: { id: true },
        });
        await notifyMany(recipients.map((r) => ({
          userId: r.id,
          type: 'assignment_new' as const,
          title: `📢 ${title.trim()}`,
          body: `${date}${content ? ' · ' + content : ''}`,
          link,
        })));
      }
    } catch (e) { console.error('[calendar notify]', e); }

    return res.status(201).json(note);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── PUT /api/calendar/notes/:id ──────────────────────────────────
router.put('/notes/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const existing = await prisma.calendarNote.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    // Authorization: tutor can only edit their own notes
    if (req.user!.role === 'TUTOR' && existing.tutorId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not your note' });
    }
    // Admin can only edit notes they own (tutorId === null) — they don't edit tutor notes
    if (req.user!.role === 'ADMIN' && existing.tutorId !== null) {
      return res.status(403).json({ error: "Cannot edit a tutor's calendar note" });
    }

    const { date, title, content, color, studentId, kind, sharedWithAdmin } = req.body;

    let resolvedStudentId: string | null | undefined = undefined;
    if (studentId !== undefined) {
      if (studentId === null || studentId === '') {
        resolvedStudentId = null;
      } else {
        const target = await prisma.user.findUnique({ where: { id: studentId } });
        if (!target || target.role !== 'STUDENT') return res.status(400).json({ error: 'Invalid studentId' });
        if (req.user!.role === 'TUTOR' && target.teacherId !== req.user!.userId) {
          return res.status(403).json({ error: 'Not your student' });
        }
        resolvedStudentId = studentId;
      }
    }

    const note = await prisma.calendarNote.update({
      where: { id: req.params.id },
      data: {
        date, title: title?.trim(), content, color,
        ...(resolvedStudentId !== undefined ? { studentId: resolvedStudentId } : {}),
        ...(kind && ALLOWED_KINDS.has(kind) ? { kind } : {}),
        ...(typeof sharedWithAdmin === 'boolean' ? { sharedWithAdmin } : {}),
      },
      include: { tutor: { select: { id: true, name: true } }, student: { select: { id: true, name: true } } },
    });
    return res.json(note);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /api/calendar/notes/:id ──────────────────────────────
router.delete('/notes/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const existing = await prisma.calendarNote.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role === 'TUTOR' && existing.tutorId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not your note' });
    }
    if (req.user!.role === 'ADMIN' && existing.tutorId !== null) {
      return res.status(403).json({ error: "Cannot delete a tutor's note" });
    }
    await prisma.calendarNote.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Requests ─────────────────────────────────────────────────────

// POST /api/calendar/requests  — student creates a request (move | new | cancel)
router.post('/requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'STUDENT') return res.status(403).json({ error: 'Student access required' });

    const { noteId, message, requestType, proposedDate, proposedTitle } = req.body as {
      noteId?: string;
      message: string;
      requestType?: 'move' | 'new' | 'cancel';
      proposedDate?: string;
      proposedTitle?: string;
    };
    const rt = requestType || 'move';

    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
    if (rt === 'new' && !proposedDate) return res.status(400).json({ error: 'proposedDate required for new sessions' });
    if (rt !== 'new' && !noteId) return res.status(400).json({ error: 'noteId required for move/cancel' });

    const student = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { name: true, teacherId: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (!student.teacherId) return res.status(400).json({ error: 'You must be paired with a tutor first' });

    // Validate noteId if provided — must be a note the student can see
    let targetTutorId: string | null = student.teacherId;
    if (noteId) {
      const note = await prisma.calendarNote.findUnique({ where: { id: noteId } });
      if (!note) return res.status(404).json({ error: 'Note not found' });
      if (note.tutorId && note.tutorId !== student.teacherId) {
        return res.status(403).json({ error: "Cannot request changes on another tutor's note" });
      }
      if (note.tutorId) targetTutorId = note.tutorId;
    }

    const request = await prisma.calendarRequest.create({
      data: {
        noteId: noteId || null,
        studentId: req.user!.userId,
        studentName: student.name,
        message: message.trim(),
        requestType: rt,
        proposedDate: proposedDate || null,
        proposedTitle: proposedTitle?.trim() || null,
        tutorId: targetTutorId,
      },
      include: { note: true, student: { select: { id: true, name: true, grade: true } } },
    });

    // Notify the tutor
    if (targetTutorId) {
      const verb = rt === 'new' ? 'requested a new session' : rt === 'cancel' ? 'wants to cancel' : 'wants to move';
      await notify({
        userId: targetTutorId,
        type: 'tutor_requested',
        title: `📅 ${student.name} ${verb}`,
        body: rt === 'new'
          ? `Proposed: ${proposedTitle || 'Tutoring session'} on ${proposedDate}`
          : message.trim(),
        link: '/app/calendar',
      });
    }

    return res.status(201).json(request);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/calendar/requests
router.get('/requests', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { role, userId } = req.user!;
    const where: Record<string, unknown> = { status: 'pending' };
    if (role === 'TUTOR') where.tutorId = userId;

    const requests = await prisma.calendarRequest.findMany({
      where,
      include: {
        note: true,
        student: { select: { id: true, name: true, grade: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/calendar/requests/:id — approve / deny
router.patch('/requests/:id', authMiddleware, adminOrTutorOnly, async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status: 'approved' | 'denied' };
    if (!['approved', 'denied'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const request = await prisma.calendarRequest.findUnique({
      where: { id: req.params.id },
      include: { note: true, student: { select: { id: true, name: true } } },
    });
    if (!request) return res.status(404).json({ error: 'Not found' });

    // Tutor can only handle their own requests; admin can handle anything
    if (req.user!.role === 'TUTOR' && request.tutorId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not for you' });
    }

    // If approved, perform the side effect
    if (status === 'approved') {
      if (request.requestType === 'move' && request.noteId && request.proposedDate) {
        await prisma.calendarNote.update({
          where: { id: request.noteId },
          data: { date: request.proposedDate },
        });
      } else if (request.requestType === 'cancel' && request.noteId) {
        await prisma.calendarNote.delete({ where: { id: request.noteId } });
      } else if (request.requestType === 'new' && request.proposedDate) {
        await prisma.calendarNote.create({
          data: {
            date: request.proposedDate,
            title: request.proposedTitle || `Session with ${request.student.name}`,
            createdById: req.user!.userId,
            tutorId: request.tutorId || req.user!.userId,
            studentId: request.studentId,
            kind: 'session',
            color: 'session',
          },
        });
      }
    }

    const updated = await prisma.calendarRequest.update({
      where: { id: req.params.id },
      data: { status },
    });

    // Notify the student of the decision
    await notify({
      userId: request.studentId,
      type: status === 'approved' ? 'tutor_approved' : 'tutor_denied',
      title: status === 'approved'
        ? `✅ Calendar request approved`
        : `❌ Calendar request denied`,
      body: request.message,
      link: '/app/calendar',
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Re-export adminOnly so the bundler doesn't warn about it being unused
void adminOnly;

export default router;
