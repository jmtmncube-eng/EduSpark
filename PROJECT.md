# EduSpark — Project Tracker

South African CAPS learning platform for Grades 10–12 (Mathematics & Physical Sciences).

---

## Status: ✅ MVP Complete

---

## Architecture

```
EduSpark/
├── backend/          Node.js + Express + TypeScript + Prisma (PostgreSQL)
├── frontend/         React 18 + TypeScript + Vite + react-chartjs-2
├── docker-compose.yml          Production (Postgres + Backend + Frontend/nginx)
├── docker-compose.dev.yml      Development (Postgres + Backend hot-reload)
└── .env.example
```

---

## Quick Start

### Production (Docker)

```bash
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD and JWT_SECRET

docker compose up -d --build

# Seed demo data (first run only)
docker compose exec backend node dist/db/seed.js
```

App available at `http://localhost` (port 80).

### Development

```bash
# Terminal 1 — database + backend
docker compose -f docker-compose.dev.yml up

# Terminal 2 — frontend dev server
cd frontend && npm install && npm run dev
```

Frontend: `http://localhost:3000`  
Backend: `http://localhost:8000`

---

## Demo Accounts (after seeding)

| Role    | Name / PIN     | Notes                        |
|---------|----------------|------------------------------|
| Admin   | Ms. Ndlovu     | Use name login on Admin card |
| Student | SPK-AM1D       | Amahle Dlamini, Grade 10     |
| Student | SPK-SN2K       | Sipho Nkosi, Grade 11        |
| Student | SPK-ZM3K       | Zanele Mokoena, Grade 12     |
| Student | SPK-LM4M       | Lebo Motaung, Grade 10       |

---

## Features

### Admin
- [x] Dashboard with weekly activity + subject performance charts
- [x] Question Bank — generate (20+ CAPS generators), add manually, import, visibility control
- [x] Assignments — create/edit with question picker + supporting documents (text + images)
- [x] Student management — view profiles, reset PINs, activate/deactivate
- [x] Analytics — score by topic, difficulty breakdown, weakest topics
- [x] Calendar — monthly view, assignment deadlines, add/edit/delete notes

### Student
- [x] Dashboard — XP bar, PIN hero, stats, quiz cards
- [x] Question Bank — grade-filtered, expandable solutions
- [x] Progress — XP level, charts, 8 achievements, day streak
- [x] Quiz History — table with scores, XP earned
- [x] Calendar — read-only schedule with assignment deadlines + notes
- [x] Quiz Engine — 60s timer per question, navigation pills, flag questions, submit
- [x] Results — score hero, doughnut chart, full question review with explanations

### Gamification
- XP awarded on quiz completion: `(score/100) * questions * 10 + bonus`
- 4 levels: Beginner (0 XP) → Learner (200) → Achiever (500) → Expert (1000)
- Confetti animation on scores ≥ 80%
- Day streak tracked from quiz completion dates

---

## API Endpoints

| Method | Path                             | Auth   | Description                    |
|--------|----------------------------------|--------|--------------------------------|
| POST   | /api/auth/login                  | None   | PIN or name login              |
| POST   | /api/auth/register               | None   | Register new student with grade|
| GET    | /api/questions                   | Any    | List (grade-filtered for students)|
| POST   | /api/questions/generate          | Admin  | Auto-generate from CAPS topic  |
| POST   | /api/questions/import            | Admin  | Bulk text import               |
| GET    | /api/assignments                 | Any    | List assignments               |
| GET    | /api/assignments/:id             | Any    | Single assignment with questions|
| POST   | /api/results                     | Student| Submit quiz answers            |
| GET    | /api/results/:id                 | Any    | Full result with details       |
| GET    | /api/students                    | Admin  | Student list with results      |
| POST   | /api/students/:id/reset-pin      | Admin  | Generate new PIN               |
| GET    | /api/analytics/overview          | Admin  | Platform-wide stats            |
| GET    | /api/analytics/topic-performance | Admin  | Avg score per topic            |
| GET/POST/PUT/DELETE | /api/calendar/notes | Admin | Calendar note CRUD |
| GET    | /health                          | None   | Health check                   |

---

## Database Models

- **User** — students + admins, PIN-based auth for students
- **Question** — CAPS-aligned, 4-option MCQ, visibility scoping
- **Assignment** — quiz bundles with documents, grade/topic targeting
- **AssignmentQuestion** — ordered many-to-many join
- **AssignmentDocument** — text + base64 images attached to assignments
- **QuizResult** — score, XP, per-answer details
- **ResultDetail** — per-question: selected vs correct, solution text
- **CalendarNote** — teacher-created events/reminders

---

## Environment Variables

| Variable          | Default          | Required in prod |
|-------------------|------------------|-----------------|
| DATABASE_URL      | (set by compose) | ✅              |
| JWT_SECRET        | change_me        | ✅ Change this! |
| NODE_ENV          | production       | —               |
| PORT              | 8000             | —               |
| POSTGRES_USER     | eduspark         | —               |
| POSTGRES_PASSWORD | eduspark_pass    | ✅ Change this! |
| POSTGRES_DB       | eduspark         | —               |
| APP_PORT          | 80               | —               |

---

## Development Notes

- Images stored as base64 in DB (`@db.Text`). Max upload ~2MB (compressed to 400px JPEG 0.65).
- Student PIN format: `SPK-XXXX` (4 chars from alphanumeric excluding ambiguous chars).
- Questions bank includes 20+ CAPS topic generators for Gr10–12 Maths + Physical Sciences.
- Frontend proxies `/api` → `http://localhost:8000` in dev via Vite config.
- Auth tokens expire in 7 days (JWT).

---

## Changelog

| Date       | Change                                              |
|------------|-----------------------------------------------------|
| 2026-04-20 | MVP complete — full stack converted from HTML prototype |
