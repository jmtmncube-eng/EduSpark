# 🔬 EduSpark

**CAPS & IEB · Mathematics & Physical Sciences · Grades 10–12.**

A self-hosted learning platform for South African high schools — built for teachers and learners of Maths and Physics. Fully Docker-deployable.

Production: [eduspark.athera.co.za](https://eduspark.athera.co.za)

---

## ✨ Features

### 👨‍💼 Admin
| Feature | Description |
|---|---|
| Question Bank | Generate, add, import, edit and approve CAPS/IEB MCQs. Status pipeline (DRAFT → IN_REVIEW → PUBLISHED). |
| **One-button generator** | Single `⚡ Generate Questions` button opens a stepped wizard: curriculum → subject → grade → topic → count → difficulty. Multi-variant generators, real difficulty mix, ~50% of questions ship with a topic-relevant diagram. |
| Packs | Reusable quiz bundles with documents. Templates, share with tutors, students unlock for self-paced practice. |
| Assignments | Targeted quizzes — all / by grade / a specific student. Max-retake control, supporting documents. |
| Students | Profiles, PIN reset, activate/deactivate, bulk-assign-to-tutor, triage Sort (lowest average first). |
| Tutors | Create tutor accounts, set subjects + teaching grades, bulk-assign students. |
| Analytics | Class-wide KPIs, **separate Maths and Physics topic graphs**, difficulty performance, weekly trend. |
| Calendar | Monthly view; broadcasts, maintenance notes, **prominent banner for student requests** needing review. |
| Audit log | Every mutating action recorded — top-actions strip on the dashboard. |
| Parent PINs | Mint short-lived `PAR-XXXX` PINs — 7-day read-only view of a child's progress. |
| Worksheet / Memo PDFs | Download a pack as a branded PDF. Embedded Unicode font, diagrams included, memo highlights answers + solutions. |

### 👨‍🏫 Tutor
- Sees only their assigned students. Owns their question/pack content; shares packs with peers.
- Mints parent PINs for their own students.
- Calendar: sessions, class notes, broadcasts, share-with-admin maintenance flags.

### 🎒 Student
- PIN login (`SPK-XXXX`). No password.
- Dashboard: XP, streak, assigned quizzes, unlocked packs.
- Question Bank: grade-filtered, step-by-step solutions, timed practice drills.
- Quiz engine: attempt tracking, instant marking, full review with explanations.
- Exam Readiness: per-topic mastery meter, teacher comment, parent-shareable.
- Calendar: read-only schedule; can request session moves / cancellations.

### 👨‍👩‍👧 Parent (ephemeral)
- Open `https://your-domain/parent/PAR-XXXX` — no account needed.
- Read-only view of child's progress and recent quizzes.
- PIN expires after 7 days.

### 🎮 Gamification
- **XP** on every quiz: `(score/100) × questions × 10 + bonus`
- **Levels**: Beginner → Learner → Achiever → Expert
- **Streaks** track consecutive active days
- **Confetti** at scores ≥ 80%

---

## 🏗 Architecture

```
EduSpark/
├── backend/          Node.js + Express + TypeScript + Prisma (PostgreSQL)
│   ├── prisma/        Schema + idempotent migrations
│   ├── src/
│   │   ├── routes/      REST endpoints (auth, questions, packs, assignments, analytics, calendar, audit…)
│   │   ├── generators/  Modular per-topic question generators (mathematics.ts, physics.ts)
│   │   ├── utils/       PDF renderer (DejaVu Sans + sharp-rasterised diagrams), diagrams, validation
│   │   ├── db/          Prisma client + seeds (CAPS + IEB)
│   │   └── __tests__/   vitest suites (190 tests on generators, validation, quality pipeline)
│   └── Dockerfile        prod (multi-stage) · Dockerfile.dev (hot-reload)
├── frontend/         React 18 + TypeScript + Vite + Chart.js
│   └── src/
│       ├── pages/        admin/ · tutor/ · student/ · Login · ParentView
│       ├── components/   Sidebar, Modal, Toast, PillSelect, QuestionGenerator, PackTemplatePicker…
│       ├── services/     api.ts — typed fetch wrapper
│       └── context/      AuthContext (idle auto-logout)
├── nginx/                  Reverse-proxy config (production)
├── scripts/preflight.sh    Env-aware safety gate (typecheck + build + 190 tests + 70+ grep assertions)
├── docker-compose.yml      Production stack (db + backend + nginx-frontend)
└── docker-compose.dev.yml  Development stack (db + tsx-watched backend + Vite frontend)
```

**Database:** PostgreSQL 16  
**Auth:** JWT (7-day) — students log in with a PIN only.  
**Dev ports:** Frontend `3001` · Backend `8000` · Postgres `5433`

---

## 🚀 Quick Start

### Development (Docker — recommended)

```bash
docker compose -f docker-compose.dev.yml up -d --build
# → frontend  http://localhost:3001
# → backend   http://localhost:8000
# → postgres  localhost:5433
```

Source folders are bind-mounted, so frontend changes hot-reload via Vite and backend changes hot-reload via `tsx watch`.

### Production

See **[DEPLOY.md](DEPLOY.md)** for the full deploy playbook (VPS, env vars, reverse proxy, backups, smoke tests).

```bash
cp .env.production.example .env       # set JWT_SECRET, POSTGRES_PASSWORD, APP_PORT, CORS_ORIGIN
docker compose --env-file .env up -d --build
```

---

## 🔐 Seeded Accounts

After `docker compose exec backend npx tsx src/db/seed.ts`:

| Role    | Login         | Notes                                  |
|---------|---------------|----------------------------------------|
| Admin   | `ADM-ALIS`    | Alistair Sabe                          |
| Admin   | `ADM-MBON`    | Mbongeni Mncube                        |
| Admin   | `ADM-GLAD`    | Glad Mpala                             |
| Tutor   | `TCH-D5VA`    | Moses · Maths + Physics · Grades 10-11 |
| Tutor   | `TCH-GDBR`    | John · Mathematics · Grades 11-12      |
| Student | `SPK-AM1D`    | Amahle Dlamini · Grade 10              |
| Student | `SPK-SN2K`    | Sipho Nkosi · Grade 10                 |
| Student | `SPK-ZM3K`    | Zanele Mokoena · Grade 10              |
| Student | `SPK-LM4M`    | Lebo Mokwena · Grade 11                |

---

## 🌐 API Surface (high level)

| Group | Routes |
|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/register` |
| Questions | `GET/POST/PUT/DELETE /api/questions`, `POST /api/questions/generate`, `POST /api/questions/import`, batch approve/discard |
| Packs | `GET/POST/PUT/DELETE /api/packs`, templates, share, unlock, `GET /api/packs/:id/pdf?mode=worksheet|memo` |
| Assignments | `GET/POST/PUT/DELETE /api/assignments` (+ docs) |
| Results | `POST /api/results`, `GET /api/results/:id` |
| Students / Tutors | profiles, PIN reset, bulk-assign-to-tutor |
| Analytics | overview KPIs, per-topic (subject-tagged), per-student report |
| Calendar | tutor/admin notes, student requests, approve/deny |
| PDF Library | upload, list, segmented drawers (notes / practice / test), preview, delete |
| Audit | log + top-actions strip |
| Parent | mint PINs, public `/parent/:pin` view |

For the full route list, see `backend/src/routes/`.

---

## 📦 Database Models

`User`, `Question`, `QuestionBatch`, `QuestionBatchItem`, `Assignment`, `AssignmentQuestion`, `AssignmentDocument`, `QuizResult`, `ResultDetail`, `Pack`, `PackQuestion`, `PackDocument`, `PackShare`, `StudentUnlock`, `PdfDocument`, `CalendarNote`, `CalendarRequest`, `TutorRequest`, `ParentAccess`, `Notification`, `AuditLog`, `OnboardingState`.

Enums: `Role` (STUDENT · TUTOR · ADMIN), `Subject`, `Curriculum` (CAPS · IEB), `Difficulty`, `QuestionStatus`, `Visibility`, `ResultType`.

---

## 🛠 Development Notes

- **Strict TypeScript** on both frontend and backend; vitest test files excluded from the production `tsc` build.
- **No native dropdowns** for content-creation flows — everything uses tappable pills / cards (`PillSelect`).
- **PDF renderer** embeds DejaVu Sans (via the `dejavu-fonts-ttf` dep) so the minus sign, Greek letters, roots, arrows and sub/superscripts render correctly. Diagrams are rasterised from SVG via `sharp`.
- **Idle auto-logout** after 2 minutes of inactivity (configurable in `AuthContext`).
- **Prisma migrations** are hand-written and idempotent (`IF NOT EXISTS`). The production Dockerfile runs `prisma migrate deploy` + `prisma db push --accept-data-loss --skip-generate` on every boot as a belt-and-braces self-heal.
- **Preflight gate**: `bash scripts/preflight.sh` runs typecheck + frontend build + backend build + vitest + 70+ grep assertions on shipped features. Required before every push.

---

## 🤝 Contributing

See [CHANGELOG.md](CHANGELOG.md) for the per-release log. Every commit updates the changelog and the relevant preflight assertions before pushing — keep the gate green.

```bash
git pull origin main
# work
bash scripts/preflight.sh                # must be ✅ before push
git commit -m "…" && git push
```

---

*Built for South African learners. CAPS & IEB aligned. Grades 10–12.*
