import prisma from '../db/client';

export type NotificationType =
  | 'pack_shared'
  | 'pack_unlocked'
  | 'assignment_new'
  | 'tutor_approved'
  | 'tutor_denied'
  | 'tutor_requested'
  | 'result_posted'
  | 'due_soon';

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Create a persistent notification for a single user.
 * Fails silently — notification failures must never break the parent operation.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body || null,
        link: input.link || null,
      },
    });
  } catch (err) {
    console.error('[notify] failed:', err);
  }
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  if (!inputs.length) return;
  try {
    await prisma.notification.createMany({
      data: inputs.map((n) => ({
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body || null,
        link: n.link || null,
      })),
    });
  } catch (err) {
    console.error('[notifyMany] failed:', err);
  }
}
