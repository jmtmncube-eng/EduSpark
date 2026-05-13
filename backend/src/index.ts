import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import prisma from './db/client';
import authRouter from './routes/auth';
import questionsRouter from './routes/questions';
import assignmentsRouter from './routes/assignments';
import studentsRouter from './routes/students';
import resultsRouter from './routes/results';
import calendarRouter from './routes/calendar';
import analyticsRouter from './routes/analytics';
import parentRouter from './routes/parent';
import tutorRequestsRouter from './routes/tutor-requests';
import packsRouter from './routes/packs';
import documentsRouter from './routes/documents';
import notificationsRouter from './routes/notifications';
import onboardingRouter from './routes/onboarding';
import recommendationsRouter from './routes/recommendations';
import auditRouter from './routes/audit';

const app = express();
const PORT = Number(process.env.PORT) || 8000;

// ─── Behind a reverse proxy (nginx on the VPS) ─────────────────────
// Trust the first hop so req.ip + rate-limiting reflect the real client IP,
// not the loopback address of the proxy.
app.set('trust proxy', 1);

// ─── Cross-cutting middleware ──────────────────────────────────────
app.use(compression()); // gzip JSON responses + static assets — major bandwidth win
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));

// Hard request timeout — guard against slowloris / wedged DB connections
app.use((req, res, next) => {
  // 30s default; PDF generation + uploads have their own deadlines
  req.setTimeout(30_000, () => {
    if (!res.headersSent) {
      res.status(503).json({ error: 'Request took too long. Please retry.' });
    }
    req.socket.destroy();
  });
  next();
});

// ─── Rate limiting (handles bursty live traffic) ───────────────────
// General API: 300 req/min/IP — plenty of headroom for a busy class
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down and retry in a moment.' },
}));
// Login: tighter — 20 req/min/IP — to dampen brute-force PIN guessing
app.use('/api/auth/', rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Wait a minute and try again.' },
}));
// Heavy generators: 30 / 5 min / IP
app.use('/api/questions/generate', rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: { error: 'Generation limit reached. Try again in a few minutes.' },
}));

// ─── Health checks ─────────────────────────────────────────────────
// Lightweight: container probes hit this every few seconds
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  service: 'eduspark-api',
  version: 'v6',
  uptime: Math.round(process.uptime()),
}));

// Deep: also pings the DB. nginx upstream health-checks can target this.
app.get('/health/deep', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'eduspark-api', db: 'ok' });
  } catch (err) {
    console.error('[health/deep] DB ping failed:', err);
    res.status(503).json({ status: 'degraded', service: 'eduspark-api', db: 'down' });
  }
});

// ─── API Routes ────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/students', studentsRouter);
app.use('/api/results', resultsRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/parent', parentRouter);
app.use('/api/tutor-requests', tutorRequestsRouter);
app.use('/api/packs', packsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/audit', auditRouter);

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── Global error handler ──────────────────────────────────────────
// Catches anything thrown sync or returned as a rejected promise. Never leaks
// the stack trace to the client.
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const code = (err as Error & { status?: number }).status || 500;
  console.error(`[${req.method} ${req.originalUrl}] ${code}:`, err.stack || err.message);
  if (!res.headersSent) {
    res.status(code).json({
      error: code >= 500 ? 'Internal server error' : err.message,
    });
  }
});

// ─── Process-level error nets ──────────────────────────────────────
// Without these, an uncaught promise rejection from a stray async path
// would crash the whole node process — bad in production.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  // Best practice: let the process exit so the orchestrator restarts us clean.
  // Docker's `restart: unless-stopped` will bring us back up in a few seconds.
  setTimeout(() => process.exit(1), 1500);
});

// ─── Start + graceful shutdown ─────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n🔬 EduSpark API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

// Larger keep-alive so the public nginx reuses connections (less TLS handshake)
server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;

async function shutdown(signal: string) {
  console.log(`\n[${signal}] received — closing connections gracefully…`);
  // Stop accepting new connections
  server.close(async (err) => {
    if (err) console.error('[shutdown] server.close error:', err);
    try { await prisma.$disconnect(); console.log('[shutdown] Prisma disconnected'); }
    catch (e) { console.error('[shutdown] Prisma disconnect error:', e); }
    process.exit(err ? 1 : 0);
  });
  // Force-exit if shutdown stalls
  setTimeout(() => {
    console.error('[shutdown] timeout, forcing exit');
    process.exit(1);
  }, 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
