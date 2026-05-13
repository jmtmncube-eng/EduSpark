import prisma from '../db/client';
import type { Request } from 'express';

/**
 * Record an audit log entry. Never throws — auditing must not break the
 * surrounding business operation. Captures actor + IP for forensic clarity.
 *
 *   audit(req, 'pack.share', 'Pack', pack.id, { tutors: [...], note });
 */
export type AuditAction =
  | 'user.create' | 'user.update' | 'user.deactivate' | 'user.assign-tutor'
  | 'tutorRequest.create' | 'tutorRequest.approve' | 'tutorRequest.deny'
  | 'pack.create' | 'pack.update' | 'pack.delete' | 'pack.share' | 'pack.unshare' | 'pack.unlock' | 'pack.revoke'
  | 'document.upload' | 'document.delete'
  | 'questions.generate' | 'questions.create' | 'questions.delete'
  | 'assignment.create' | 'assignment.update' | 'assignment.delete'
  | 'calendar.note.create' | 'calendar.note.update' | 'calendar.note.delete'
  | 'calendar.request.create' | 'calendar.request.approve' | 'calendar.request.deny'
  | 'auth.login' | 'auth.register' | 'auth.recover.success'
  | 'security.set-question';

export async function audit(
  req: Request | null,
  action: AuditAction,
  entityType: string,
  entityId: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req?.user?.userId ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        meta: meta ? (meta as object) : undefined,
        ip: req
          ? (req.headers['x-forwarded-for']?.toString().split(',')[0].trim()
            || req.socket?.remoteAddress
            || null)
          : null,
      },
    });
  } catch (err) {
    console.error('[audit] failed:', err);
  }
}
