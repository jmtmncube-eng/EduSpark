import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { authMiddleware, adminOnly } from '../middleware/auth';

const router = Router();

/**
 * Admin-only audit-log viewer.
 *
 *   GET /api/audit?action=pack.share&entityType=Pack&q=...&limit=100&offset=0
 *
 * Filters are all optional. `q` does a free-text search across action +
 * entityType + a stringified JSON.meta blob.
 */
router.get('/', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { action, entityType, entityId, actorId, q } = req.query as Record<string, string>;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (actorId) where.actorId = actorId;

    const orFilters: object[] = [];
    if (q?.trim()) {
      const term = q.trim();
      orFilters.push({ action: { contains: term, mode: 'insensitive' } });
      orFilters.push({ entityType: { contains: term, mode: 'insensitive' } });
    }
    if (orFilters.length) where.OR = orFilters;

    const [total, entries] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          actor: { select: { id: true, name: true, role: true } },
        },
      }),
    ]);

    return res.json({ total, limit, offset, entries });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Convenience: distinct action types so the UI can populate a filter dropdown
router.get('/actions', authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
      take: 200,
    });
    return res.json(rows.map((r) => r.action));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
