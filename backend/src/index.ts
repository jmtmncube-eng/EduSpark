import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

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
const PORT = process.env.PORT || 8000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate limiting (handles bursty live traffic) ──────────────────
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

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'eduspark-api', version: 'v6' }));

// API Routes
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

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🔬 EduSpark API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

export default app;

