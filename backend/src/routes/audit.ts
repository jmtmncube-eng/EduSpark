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
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (actorId) where.actorId = actorId;

    // Date range
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (from) { const d = new Date(from); if (!isNaN(d.getTime())) dateFilter.gte = d; }
    if (to)   { const d = new Date(to);   if (!isNaN(d.getTime())) dateFilter.lte = d; }
    if (dateFilter.gte || dateFilter.lte) where.createdAt = dateFilter;

    // Free-text search across action / entityType / entityId
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { action:     { contains: term, mode: 'insensitive' } },
        { entityType: { contains: term, mode: 'insensitive' } },
        { entityId:   { contains: term, mode: 'insensitive' } },
        { ip:         { contains: term, mode: 'insensitive' } },
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

// Snapshot — counts per action / per day, for the filter chips at the top
router.get('/summary', authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [total, last7d, today] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);
    const byAction = await prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: since } },
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 10,
    });
    return res.json({
      total, last7d, today,
      topActions: byAction.map((b) => ({ action: b.action, count: b._count.action })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
