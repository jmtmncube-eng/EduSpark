# EduSpark — Project Tracker

CAPS & IEB learning platform for South African Grades 10–12 (Mathematics & Physical Sciences).

---

## Status: ✅ Shipped — v2.10.4

Live at **https://eduspark.athera.co.za** · Source: `github.com/jmtmncube-eng/EduSpark`.

The platform is a 3-container Docker stack (Postgres + Express/Prisma backend + React/Vite frontend behind nginx). Three persona roles in the DB (Admin / Tutor / Student) plus an ephemeral Parent view via expiring `PAR-XXXX` PINs.

---

## Architecture

```
EduSpark/
├── backend/          Node.js + Express + TypeScript + Prisma (PostgreSQL 16)
├── frontend/         React 18 + TypeScript + Vite + Chart.js
├── nginx/            Reverse-proxy config (production frontend container)
├── scripts/          preflight.sh — typecheck + build + 190 tests + 70+ feature assertions
├── docker-compose.yml          Production (db + backend + nginx-frontend)
├── docker-compose.dev.yml      Development (db + tsx-watched backend + Vite frontend)
└── .env.production.example
```

---

## Quick Start

### Development

```bash
docker compose -f docker-compose.dev.yml up -d --build
# Frontend  http://localhost:3001
# Backend   http://localhost:8000
# Postgres  localhost:5433
```

Source folders are bind-mounted: Vite hot-reloads the frontend, `tsx watch` hot-reloads the backend.

### Production

See [DEPLOY.md](DEPLOY.md) — full playbook for the Athera VPS (env, reverse proxy, backups, smoke test).

```bash
cp .env.production.example .env       # JWT_SECRET, POSTGRES_PASSWORD, APP_PORT, CORS_ORIGIN
docker compose --env-file .env up -d --build
```

---

## Seeded Accounts

| Role    | Login        | Profile                                |
|---------|--------------|----------------------------------------|
| Admin   | `ADM-ALIS`   | Alistair Sabe                          |
| Admin   | `ADM-MBON`   | Mbongeni Mncube                        |
| Admin   | `ADM-GLAD`   | Glad Mpala                             |
| Tutor   | `TCH-D5VA`   | Moses · Maths + Physics · Grades 10-11 |
| Tutor   | `TCH-GDBR`   | John · Mathematics · Grades 11-12      |
| Student | `SPK-AM1D`   | Amahle Dlamini · Grade 10              |
| Student | `SPK-SN2K`   | Sipho Nkosi · Grade 10                 |
| Student | `SPK-ZM3K`   | Zanele Mokoena · Grade 10              |
| Student | `SPK-LM4M`   | Lebo Mokwena · Grade 11                |

---

## Features

### Admin
- [x] Dashboard with KPI strip, content-health chips, audit top-actions
- [x] Question Bank — generate / add / import / approve · DRAFT → IN_REVIEW → PUBLISHED pipeline
- [x] **One-button generator** — single button opens a stepped wizard for every detail (curriculum → subject → grade → topic → count → difficulty)
- [x] **Half-diagram coin flip** — ~50% of generated questions ship with a topic-relevant SVG diagram
- [x] Packs — templates, sharing with tutors, student unlocks
- [x] Assignments — quizzes targeted at all / grade / one student, max-retake control
- [x] Students — triage Sort, filters, bulk-assign-to-tutor
- [x] Tutors — create, set subjects + teaching grades, bulk-assign
- [x] Analytics — **separate Maths and Physics topic graphs**, difficulty, weekly trend
- [x] Calendar — broadcasts, maintenance, **prominent banner for student requests**
- [x] Audit log + top-actions strip
- [x] Parent PINs — short-lived `PAR-XXXX`
- [x] Worksheet / Memo PDF export — embedded Unicode font, diagrams included

### Tutor
- [x] Scoped to their own students; owns their content; shares packs
- [x] Mints parent PINs for their own students
- [x] Calendar — sessions, class notes, broadcasts, share-with-admin maintenance

### Student
- [x] PIN login (`SPK-XXXX`)
- [x] Dashboard — XP, streak, assigned quizzes, unlocked packs, cold-start "connect a tutor" card
- [x] Question Bank — grade-filtered, expandable solutions, timed practice
- [x] Quiz engine — attempt tracking, instant marking, full review
- [x] Exam Readiness — per-topic mastery, teacher comment, parent-shareable
- [x] Calendar — read-only, request session changes

### Parent (ephemeral)
- [x] Public `/parent/PAR-XXXX` view — no account, 7-day expiry

### Quality / Tooling
- [x] CAPS + IEB curriculum enum end-to-end (schema, generators, UI, seed)
- [x] Multi-variant difficulty-aware generators (190 vitest assertions)
- [x] WCAG-AA contrast pass
- [x] No native dropdowns in content-creation flows — pills / cards everywhere
- [x] Idle auto-logout (2 min)
- [x] Mobile pass on small screens
- [x] `scripts/preflight.sh` env-aware gate (74 assertions, runs full build + tests on dev, gracefully skips on VPS)

---

## API Surface (high level)

| Group | Highlights |
|---|---|
| **Auth** | `POST /api/auth/login`, `POST /api/auth/register` |
| **Questions** | CRUD · `POST /api/questions/generate` · `POST /api/questions/import` · batch approve/discard |
| **Packs** | CRUD · templates · share · unlock · `GET /api/packs/:id/pdf?mode=worksheet\|memo` |
| **Assignments** | CRUD + documents + prefill deep-links |
| **Results** | `POST /api/results` · `GET /api/results/:id` |
| **Students / Tutors** | profiles · PIN reset · `PATCH /api/students/bulk-assign-tutor` |
| **Analytics** | overview · per-topic (subject-tagged) · per-student report |
| **Calendar** | notes (admin/tutor) · student requests · approve/deny |
| **PDF Library** | upload · list · segmented drawers · preview · delete |
| **Audit** | log · top-actions strip |
| **Parent** | mint PIN · revoke · public `/parent/:pin` view |

Full route list in `backend/src/routes/`.

---

## Database Models

`User` · `Question` · `QuestionBatch` · `QuestionBatchItem` · `Assignment` · `AssignmentQuestion` · `AssignmentDocument` · `QuizResult` · `ResultDetail` · `Pack` · `PackQuestion` · `PackDocument` · `PackShare` · `StudentUnlock` · `PdfDocument` · `CalendarNote` · `CalendarRequest` · `TutorRequest` · `ParentAccess` · `Notification` · `AuditLog` · `OnboardingState`

**Enums:** `Role` (STUDENT · TUTOR · ADMIN) · `Subject` (MATHEMATICS · PHYSICAL_SCIENCES) · `Curriculum` (CAPS · IEB) · `Difficulty` · `QuestionStatus` · `Visibility` · `ResultType`

---

## Environment Variables

| Variable           | Default            | Required in prod |
|--------------------|--------------------|------------------|
| `DATABASE_URL`     | (set by compose)   | ✅               |
| `JWT_SECRET`       | `change_me`        | ✅ change me     |
| `POSTGRES_USER`    | `eduspark`         | —                |
| `POSTGRES_PASSWORD`| `eduspark_pass`    | ✅ change me     |
| `POSTGRES_DB`      | `eduspark`         | —                |
| `NODE_ENV`         | `production`       | —                |
| `PORT`             | `8000`             | —                |
| `APP_PORT`         | `3007`             | —                |
| `CORS_ORIGIN`      | `*`                | ✅ set to FQDN   |

---

## Development Notes

- TypeScript strict on both apps. Vitest files excluded from the prod `tsc` build.
- **PDF renderer** embeds DejaVu Sans (via the `dejavu-fonts-ttf` runtime dep) for full Unicode coverage — minus sign, Greek, roots, arrows, sub/superscripts. Question diagrams (stored as SVG data-URIs) are rasterised with `sharp`.
- Frontend proxies `/api` → backend in dev via `vite.config.ts`.
- Prisma migrations are idempotent (`IF NOT EXISTS`). The prod Dockerfile runs `migrate deploy` + `db push --accept-data-loss --skip-generate` on boot as a self-heal.
- Auth tokens expire in 7 days. Idle auto-logout at 2 min.

---

## Recent Releases

See [CHANGELOG.md](CHANGELOG.md) for the full log.

| Version  | Highlights                                                                                       |
|----------|--------------------------------------------------------------------------------------------------|
| 2.10.4   | Worksheet/Memo PDFs — embedded Unicode font (fixes the mojibake) + diagrams                      |
| 2.10.3   | Login: trimmed feature cards, CAPS & IEB only                                                    |
| 2.10.2   | Prominent calendar request banner; Grades 10–12 in every generator/picker                        |
| 2.10.1   | One-button generator wizard, half-diagram coin flip, separate Maths/Physics graphs, CAPS+IEB branding sweep |
| 2.10.0   | CAPS + IEB curriculum, varied difficulty-aware generators, list scaling, automated tests (190)   |
| 2.9.x    | Quality pipeline, packs, PDFs, no-dropdown content flows, WCAG-AA, sticky bank header            |
