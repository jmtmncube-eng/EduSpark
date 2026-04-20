# 🔬 EduSpark

**Maths and Science Learning Platform** — South African CAPS-aligned for Grades 10–12.

Built for teachers and learners of Mathematics and Physical Sciences. Fully self-hosted, Docker-ready.

---

## ✨ Features

### 👩‍🏫 Admin / Teacher
| Feature | Description |
|---|---|
| Question Bank | Generate 20+ CAPS-aligned MCQs per topic, add manually, bulk import, image attachments, show/hide per student |
| Assignments | Create quiz bundles with supporting documents & images. Assign to all students, by grade, or a specific student only |
| Max Retakes | Set 1–unlimited retakes per assignment. Progress tracked via average across attempts |
| Student Management | View profiles, reset PINs, activate/deactivate accounts, view per-student exam readiness report |
| Parent Access PINs | Generate temporary `PAR-XXXX` PINs for parents — expires after 7 days, read-only child progress view |
| Analytics — Class | 5 smart KPIs: pass rate, topic mastery, engagement score, improvement trend, difficulty insight |
| Analytics — Per Student | Select any student to see individual topic breakdown, recent results, mastery table |
| Calendar | Monthly view with assignment deadlines & notes. Approve/deny student change requests |
| Student Reports | Per-student exam readiness report — circular meter, topic bars, teacher comment, printable PDF |

### 🎒 Student
| Feature | Description |
|---|---|
| PIN Login | Unique `SPK-XXXX` PIN per student. No password needed |
| Dashboard | XP level, streak, stats, assigned quiz cards with retake tracking |
| Question Bank | Grade-filtered bank with step-by-step solutions. Timed 10-question practice drills (30s/question) |
| Quiz Engine | Attempt tracking (N / maxAttempts), history of scores, submit for instant marking |
| Results | Score hero, doughnut chart, full question-by-question review with detailed solutions |
| Exam Readiness | Circular readiness meter, topic breakdown, teacher comment, parent-shareable |
| Calendar | Read-only schedule, request changes to events via message to teacher |
| Progress | XP level bar, 8 achievements, day streak, charts |

### 👨‍👩‍👧 Parent
- Use PIN link: `https://your-domain/parent/PAR-XXXX`
- No account needed — read-only view of child's progress, topic scores, recent quizzes
- Link auto-expires after 7 days

### 🎮 Gamification
- **XP** awarded on every quiz: `(score/100) × questions × 10 + bonus`
- **Levels**: Beginner (0) → Learner (200) → Achiever (500) → Expert (1000+)
- **Streaks**: consecutive days with quiz activity
- **Confetti** animation on scores ≥ 80%

---

## 🏗 Architecture

```
EduSpark/
├── backend/           Node.js + Express + TypeScript + Prisma ORM
│   ├── prisma/        Schema + migrations
│   └── src/
│       ├── routes/    REST API endpoints
│       ├── middleware/ Auth (JWT)
│       └── db/        Prisma client + seed
├── frontend/          React 18 + TypeScript + Vite
│   └── src/
│       ├── pages/     admin/ + student/ + Login + ParentView
│       ├── components/ Sidebar, Modal, Toast, Background
│       ├── services/  api.ts — typed fetch wrapper
│       └── context/   AuthContext
├── nginx/             Reverse proxy config (production)
├── docker-compose.yml           Production stack
├── docker-compose.dev.yml       Development stack
└── .env.example
```

**Database:** PostgreSQL 15  
**Auth:** JWT (7-day tokens). Students use PIN only.  
**Ports (dev):** Frontend `3002` · Backend `3001` · Postgres `5433`

---

## 🚀 Quick Start

### Production (Docker)

```bash
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD and JWT_SECRET to strong values

docker compose up -d --build

# Seed demo data (first run)
docker compose exec backend node dist/db/seed.js
```

App at `http://localhost` (port 80).

### Development

```bash
# Terminal 1 — Postgres + backend (hot reload)
docker compose -f docker-compose.dev.yml up

# Terminal 2 — Vite frontend
cd frontend && npm install && npm run dev
# → http://localhost:3002
```

---

## 🔐 Demo Accounts (after seeding)

| Role    | Login value  | Notes                     |
|---------|-------------|---------------------------|
| Teacher | Ms. Ndlovu  | Select **Teacher** tab    |
| Student | SPK-AM1D    | Amahle Dlamini, Grade 10  |
| Student | SPK-SN2K    | Sipho Nkosi, Grade 11     |
| Student | SPK-ZM3K    | Zanele Mokoena, Grade 12  |

---

## 🌐 API Reference

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/login` | — | PIN / name login |
| POST | `/api/auth/register` | — | Register new student |
| GET | `/api/questions` | Any | List (grade-filtered for students) |
| POST | `/api/questions/generate` | Admin | Auto-generate CAPS questions |
| POST | `/api/questions/import` | Admin | Bulk text import |
| GET/POST/PUT/DELETE | `/api/assignments` | Admin | Assignment CRUD |
| POST | `/api/results` | Student | Submit quiz answers |
| GET | `/api/results/:id` | Any | Full result with solutions |
| GET | `/api/students` | Admin | Student list |
| GET | `/api/students/search?q=` | Admin | Student search by name |
| GET | `/api/analytics/overview` | Admin | Platform-wide 5 KPIs |
| GET | `/api/analytics/student-report/:id` | Admin | Per-student breakdown |
| GET | `/api/parent/view/:pin` | — | Public parent report |
| POST | `/api/parent/pins` | Admin | Create parent PIN |
| GET | `/api/parent/pins` | Admin | List parent PINs |
| DELETE | `/api/parent/pins/:id` | Admin | Revoke parent PIN |
| GET/POST/PUT/DELETE | `/api/calendar/notes` | Admin | Calendar note CRUD |
| POST | `/api/calendar/requests` | Student | Request calendar change |
| GET | `/api/calendar/requests` | Admin | List change requests |

---

## ⚙️ Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | (set by Docker) | Postgres connection string |
| `JWT_SECRET` | `change_me` | **Must change in production** |
| `POSTGRES_PASSWORD` | `change_me` | **Must change in production** |
| `POSTGRES_USER` | `eduspark` | — |
| `POSTGRES_DB` | `eduspark` | — |
| `NODE_ENV` | `production` | — |
| `PORT` | `8000` | Backend port |
| `APP_PORT` | `80` | Nginx external port |

---

## 📦 Database Models

| Model | Purpose |
|---|---|
| `User` | Students + admins, PIN-based auth |
| `Question` | CAPS MCQ, 4 options, visibility control |
| `Assignment` | Quiz bundle with grade/student targeting, maxAttempts |
| `AssignmentQuestion` | Ordered join — questions ↔ assignments |
| `AssignmentDocument` | Text + base64 image attachments |
| `QuizResult` | Score, XP, attemptNumber, completedAt |
| `ResultDetail` | Per-question: selected vs correct, solution |
| `CalendarNote` | Teacher-created events |
| `CalendarRequest` | Student-submitted change requests |
| `ParentAccess` | Temporary parent PIN with 7-day expiry |

---

## 🛠 Development Notes

- Images stored as base64 in DB (`@db.Text`). Compressed to 400px JPEG at 0.65 quality before upload.
- Student PINs: `SPK-XXXX` — 4 chars from unambiguous alphanumeric set.
- Parent PINs: `PAR-XXXX` — same format, stored in `parent_access` table, auto-expires.
- Frontend proxies `/api` → `http://localhost:3001` in dev via `vite.config.ts`.
- TypeScript strict mode enabled on both frontend and backend.
- Prisma migrations live in `backend/prisma/migrations/` — run `npx prisma migrate deploy` on fresh deploy.

---

## 🤝 Contributing

See [CHANGELOG.md](CHANGELOG.md) for a detailed log of all changes.

1. Pull latest: `git pull origin main`
2. Create a branch: `git checkout -b feature/your-feature`
3. Make changes, update `CHANGELOG.md` under `## [Unreleased]`
4. Push and open a PR against `main`

---

*Built for South African learners. CAPS-aligned. Grades 10–12.*
