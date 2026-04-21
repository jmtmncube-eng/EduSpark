import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRouter from './routes/auth';
import questionsRouter from './routes/questions';
import assignmentsRouter from './routes/assignments';
import studentsRouter from './routes/students';
import resultsRouter from './routes/results';
import calendarRouter from './routes/calendar';
import analyticsRouter from './routes/analytics';
import parentRouter from './routes/parent';
import tutorRequestsRouter from './routes/tutor-requests';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'eduspark-api' }));

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
