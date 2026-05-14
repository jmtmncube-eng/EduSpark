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
    const { action, entityType, entityId, actorId, q, from, to, format } = req.query as Record<string, string>;
    const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 100, 1000));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

    const where: Record<string, unknown> = {};
    if (typeof action === 'string' && action.trim())     where.action = action.trim();
    if (typeof entityType === 'string' && entityType.trim()) where.entityType = entityType.trim();
    if (typeof entityId === 'string' && entityId.trim()) where.entityId = entityId.trim();
    if (typeof actorId === 'string' && actorId.trim())   where.actorId = actorId.trim();

    // Date range — only honour valid ISO strings
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (typeof from === 'string' && from) {
      const d = new Date(from); if (!isNaN(d.getTime())) dateFilter.gte = d;
    }
    if (typeof to === 'string' && to) {
      const d = new Date(to);   if (!isNaN(d.getTime())) dateFilter.lte = d;
    }
    if (dateFilter.gte || dateFilter.lte) where.createdAt = dateFilter;

    // Free-text search — limit to 200 chars and skip when the term is empty
    if (typeof q === 'string' && q.trim()) {
      const term = q.trim().slice(0, 200);
      where.OR = [
        { action:     { contains: term, mode: 'insensitive' as const } },
        { entityType: { contains: term, mode: 'insensitive' as const } },
        { entityId:   { contains: term, mode: 'insensitive' as const } },
        { ip:         { contains: term, mode: 'insensitive' as const } },
      ];
    }

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

    // CSV export — caller asks with ?format=csv
    if (format === 'csv') {
      const rows = ['id,createdAt,actor,role,action,entityType,entityId,ip,meta'];
      for (const e of entries) {
        const actor = e.actor ? `${e.actor.name}` : 'system';
        const role  = e.actor ? e.actor.role : '';
        const meta  = e.meta ? JSON.stringify(e.meta).replace(/"/g, '""') : '';
        rows.push([
          e.id, e.createdAt.toISOString(), actor, role,
          e.action, e.entityType, e.entityId ?? '', e.ip ?? '',
          `"${meta}"`,
        ].join(','));
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="eduspark-audit-${Date.now()}.csv"`);
      return res.send(rows.join('\n'));
    }

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

// Distinct entity types — same purpose
router.get('/entities', authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.auditLog.findMany({
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' },
      take: 200,
    });
    return res.json(rows.map((r) => r.entityType));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Snapshot — counts per action / per day, for the filter chips at the top.
// Every sub-query is isolated so one failing aggregate doesn't 500 the page.
router.get('/summary', authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
    try { return await p; } catch (e) { console.error('[audit/summary subquery]', e); return fallback; }
  };
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since7  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000);
  const sinceToday = new Date(new Date().setHours(0, 0, 0, 0));

  const [total, last7d, today, byAction] = await Promise.all([
    safe(prisma.auditLog.count(), 0),
    safe(prisma.auditLog.count({ where: { createdAt: { gte: since7 } } }), 0),
    safe(prisma.auditLog.count({ where: { createdAt: { gte: sinceToday } } }), 0),
    safe(
      prisma.auditLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: since30 } },
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
      [] as { action: string; _count: { action: number } }[],
    ),
  ]);

  return res.json({
    total, last7d, today,
    topActions: byAction.map((b) => ({ action: b.action, count: b._count.action })),
  });
});

export default router;
