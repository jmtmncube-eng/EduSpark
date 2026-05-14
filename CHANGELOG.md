# Changelog

All notable changes to EduSpark are documented here.  
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [2.9.5] — 2026-05-14 — Login polish: no dropdowns, WCAG-AA contrast pass

### Changed — Login page
- **No dropdowns.** The grade picker is now tappable pills; the recovery-question picker is a vertical list of selectable cards (long question text reads far better as cards than crammed into a `<select>`). The whole sign-in / setup flow is now consistent with the rest of the app.
- The "Why EduSpark" feature cards used a hard-coded translucent-white background that washed out in dark mode — now a theme-aware token, readable in both themes.

### Changed — Colour contrast (designed to the T)
- Re-tuned the text scale so **every step clears WCAG AA (≥4.5:1)** on white card backgrounds — including `--t4`, the subtle hint colour, which previously failed (~3.1:1 in light mode). Dark-theme `--t3`/`--t4` lightened for the same comfort margin.
- Border tokens (`--bd`, `--bd2`) bumped slightly in both themes so pill outlines, table rows and card edges are actually visible instead of ghosting.

---

## [2.9.4] — 2026-05-14 — PDF viewer fixed, Question Bank reorder, no-dropdown content flows, PDF drawers

### Fixed — Critical
- **PDF viewer "Server error"** — the document stream set `Content-Disposition: inline; filename="<title>.pdf"`, but titles like *"Grade 10 Physics — Newton's Laws Notes"* contain an em-dash and a curly apostrophe. HTTP headers are Latin-1 only, so `res.setHeader()` threw and 500'd every request. Now sends an ASCII-safe `filename=` plus an RFC 5987 `filename*=UTF-8''…` for the real name, and the file stream has its own error handler so a mid-stream failure can't crash the response.

### Changed — Question Bank layout
- Reordered as asked: **`📚 My Question Bank` heading + search + filters + actions are pinned to the top**, then the generator, then the grouped questions. After a generation run the bank now **auto-focuses its filters on exactly what you just made**, so new questions are visible immediately (no more "I generated questions but the bank looks empty"). The list loader also surfaces errors with a toast instead of failing silently.

### Changed — No dropdowns left in the content-creation flows
- **Pack-from-template** and the **Assignment create modal** now use the same tappable `PillSelect` prompts as the Question Bank and generator — subject / grade / topic / assign-to / max-attempts are all visible pill choices, no native `<select>` anywhere in the question/pack/assignment creation path.

### Changed — PDF Library: a real filing system
- The flat grid is gone. PDFs are now filed into three labelled **drawers — 📝 Practice · 📊 Tests · 📒 Notes** — each a colour-coded section with its own count. Uploads pick their drawer up front (the drop-zone shows where the file will land), there's a **search box**, and every card carries its drawer's colour down the side. Built to stay scannable as the library grows.

---

## [2.9.3] — 2026-05-14 — Guided Question Bank, idle logout, Tier-3 polish, preflight gate

### Changed — Question Bank: dropdowns out, prompting in
- Every native `<select>` in the Question Bank is gone. New shared **`PillSelect`** control — every option visible, one tap to choose. The browse bar (subject / grade / topic / status) and the **Add-a-Question modal** are now fully tappable, the modal reading as a numbered prompt ("1. Which subject? → 2. Which grade? → …"). Same visual language as the generator wizard.

### Added — Security
- **Idle auto-logout** — after 2 minutes of no interaction the session signs out (with a toast saying why). A single 15-second poll watches activity, so it costs nothing on every mouse-move. Protects shared school-lab machines.

### Added / Changed — Tier-3 polish (tutor)
- **Per-student attempt history** — the tutor's "View" modal now lists *every* attempt (practice + assignment) with date, score and correct/total, sorted newest-first — not just the last 5.
- **TutorSpotlight rows are actionable** — each flagged student now has an inline **📋 Assign** button alongside **📊 Report**. "Assign" deep-links straight into the Assignments create modal, pre-filled with the student and their weakest topic — spot → act in one tap.

### Added / Changed — Tier-3 polish (admin)
- **Dashboard is now a launchpad, not a mini-Analytics** — removed the duplicated Subject-Performance / Weekly-Activity charts (Analytics owns charts). Added a **Content Health** chip row (review-queue size + quality-flagged count) sourced from the v2.9 pipeline, and a role-aware subtitle ("Platform overview" vs "Your class at a glance").
- **Audit Log** now renders the already-computed **"Most active"** top-actions strip (tap to filter), and labels the v2.9 question actions properly.
- Removed the dead, unused `/api/analytics/grade-segments` endpoint + its client method.

### Changed — Tier-3 polish (student)
- De-conflicted **My Work** vs **Quiz History**: My Work's "History" tab is renamed **✅ Completed** (it's the assignment tracker), and Quiz History is now clearly the full attempt log — every row tagged **PRACTICE** or **ASSIGNMENT** with its topic.

### Added — Tooling
- **`scripts/preflight.sh`** — run before every push: type-checks + builds both apps, validates the Prisma schema, then asserts each shipped fix is still present in source (a regression tripwire). 21 checks, exits non-zero on any failure.

---

## [2.9.2] — 2026-05-14 — Full-system audit fixes: student cold-start + verified defects

Outcome of a three-persona audit (student / tutor / admin). Tier 1 (verified defects) + Tier 2 (the student cold-start gap) — refinements only, no scope increase.

### Fixed — Student
- **Dead navigation removed** — the student Dashboard's "Question Bank →" pointed at `/app/questions`, a route that only redirected back to `/app/practice`. It now links straight to Practice, the redirect route is gone, and the orphaned `student/Questions.tsx` (~310 lines of unreachable dead code) was deleted.
- **SmartCoach suggestions now actually open the pack** — the weak-topic "suggested pack", the first-quiz "Start", and the daily-goal "Practice now" buttons previously just dumped the student on the generic Practice list. They now deep-link the specific pack via router state, and Practice auto-opens it.
- **Registration no longer collects-and-discards** — the curriculum dropdown was captured but never sent to the backend. Removed (content is CAPS; the field was a dead promise).

### Added — Student cold-start path
- **"Connect with a tutor" card** on the student Dashboard, shown whenever the student has no tutor assigned. A brand-new student previously landed on a wall of empty screens with no explanation; now the tutor dependency is explicit, with the student's name + grade shown so a teacher can find them. Onboarding modal steps reworded to match (no longer promise practice/assignments that a tutorless student can't reach).

### Fixed — Tutor / Admin
- **Tutor comment no longer silently lost** — `StudentReport`'s comment was local state wiped on navigate. It now persists per-student in the browser (survives navigation + refresh before printing) and the label says so honestly.
- **Admin Dashboard "Questions" stat fixed** — `analytics/overview` never returned a `questions` count, so the card always showed 0. It now returns the real question-bank size.

---

## [2.9.1] — 2026-05-14 — PDF viewer fix + coherent Question Bank & pack/assignment wiring

### Fixed — Critical
- **PDF viewer "No token provided"** — the authenticated file stream is loaded by `<iframe>` / new-tab links that can't send an `Authorization` header. `authMiddleware` now also accepts a `?token=` query param for browser-native requests, so previews and "Open in new tab" work everywhere.
- **New `PdfViewer` component** — fetches the PDF as a blob with the auth header (no token in the URL), embeds it via an object-URL, revokes it on unmount, and falls back to a new-tab link if a browser refuses to render PDFs inline. Wired into the PDF Library preview (now a wide modal with page/size metadata).

### Changed — Question Bank coherence
- Reworked the top of the Question Bank into one coherent panel: a slim **"how it flows"** strip (Create → Review → Publish → Bundle), then the generator, then a single **📚 Your Question Bank** card holding the actions + a modern browse bar — search plus **subject & grade pill toggles** (same visual language as the generator) instead of a dense row of raw dropdowns, with a one-click **✕ Clear**.

### Fixed — Pack / Assignment wiring (GIGO follow-through)
- Pack editors (admin + tutor) and the Assignment question picker now request **PUBLISHED questions only** — a DRAFT/REVIEW question can no longer be silently dropped on save. The backend `GET /api/questions` honours `?status=` for tutors too.
- `Add to Pack` flow surfaces unpublished questions up front (a warning banner before you pick a pack) and reports exactly how many were skipped after saving.

---

## [2.9.0] — 2026-05-14 — Question quality pipeline: review workflow, validation, modular generators, GIGO stats

The Question Bank now has real quality gates — Garbage In, Garbage Out defence at every stage of the store → generate → allocate → track flow.

### Added — Review workflow
- **Question review pipeline** — new `QuestionStatus` (`DRAFT → REVIEW → PUBLISHED → RETIRED`). Generated and imported questions land as **REVIEW**; only **PUBLISHED** questions are eligible for Packs and auto-built Assignments.
- **`POST /api/questions/:id/status`** — move a single question through the pipeline. Publishing is gated: a question with blocking validation errors cannot be PUBLISHED.
- **Batch approve / discard** — `POST /api/questions/batches/:id/approve` publishes every question in a generation run that passes validation (leaving the rest in REVIEW); `POST /api/questions/batches/:id/discard` bins the whole run (keeping any question already bundled into a Pack). Batch status tracks `REVIEW → APPROVED / PARTIAL / DISCARDED`.
- Question Bank UI: per-question status chips + Publish/Review/Retire actions, a per-group **✅ Publish N** action for all validated questions, a status filter (admin), and a "🔍 just generated · in review" hint on the generator. The batch viewer gained **Approve batch** / **Discard batch** with per-question validation readouts.

### Added — Validation pipeline (`questionValidation.ts`)
- Every question — generated, imported, or hand-written — is validated: question text present, ≥2 distinct options, **answer must exactly match an option**, topic set, worked solution present. Blocking errors are stored on `Question.validationErrors` and shown inline in the bank; warnings are advisory.

### Added — Modular generator registry (`src/generators/`)
- Generators are now a registry: one self-describing `TopicGenerator` entry per CAPS topic in `mathematics.ts` / `physics.ts`, behind a shared interface. Adding or tuning a topic is a one-line change. The registry also rebuilds `CAPS_TOPICS` so the topic catalogue can never drift from the actual generators.
- Each generator declares its **CAPS index** and typical **cognitive level**, written onto every question it produces — so analytics can slice by curriculum strand and Bloom level.

### Added — Smarter diagrams
- Each topic generator declares the **one** diagram kind genuinely relevant to it — or `null`. `makeDiagramOfKind()` attaches that diagram or nothing at all. No more random parabola glued to a Statistics question; a question with no relevant diagram simply carries none.

### Added — Quality stats & auto-flagging (`questionQuality.ts`)
- `GET /api/questions/stats` now returns a **discrimination index** (does the question separate strong from weak students?) and an auto **quality flag**: `broken` (almost nobody right — answer key likely wrong), `trivial` (almost everybody right), `low_discrimination`, `no_attempts`.
- **`GET /api/questions/quality-report`** — bank-wide health check: counts per flag + the worst-offending questions. Surfaced in a new **📊 Quality report** modal with a one-click **↻ Recompute flags**.
- New schema fields on `Question`: `status`, `capsCode`, `cognitiveLevel`, `qualityFlag`, `validationErrors`, `reviewedAt/By` — with idempotent migration `20260514130000_question_quality_pipeline` (existing questions migrate to PUBLISHED so live Packs keep working).

### Changed
- Packs only accept PUBLISHED questions — `POST`/`PUT /api/packs` silently drop unpublished ids and report `skippedUnpublished`. `from-template` validates each generated question and only bundles the clean ones.
- Auto-built Assignments pull PUBLISHED questions only; any they generate is validated and tagged.

---

## [2.8.0] — 2026-05-14 — Production fixes: schema drift, PDF uploads, grouped Question Bank

### Fixed — Critical
- **Audit log "Server error" + questions not generating** — root cause was production schema drift. `audit_logs`, `question_batches` and `question_batch_items` were created locally with `prisma db push` (which writes no migration file), so `prisma migrate deploy` in production never created them and every `auditLog`/`questionBatch` call threw.
  - Added hand-written, fully idempotent migration `20260514120000_audit_batches_security` (`IF NOT EXISTS` tables/indexes, FKs guarded by `DO $$ … EXCEPTION WHEN duplicate_object`) covering the audit log, generation batches and the `users.securityQuestion` / `securityAnswerHash` recovery columns.
  - `backend/Dockerfile` now runs `prisma migrate deploy` **then** `prisma db push` on boot — a permanent belt-and-braces guarantee that the production schema can never silently drift again.
- **PDF upload handler breaking** —
  - `documents.ts` now verifies the upload directory is writable at boot (`ensureUploadDir()` with `fs.accessSync(W_OK)`) and again per request.
  - Multer errors are caught by an `uploadSingle` wrapper → clean `413` for oversize files and `400` for rejected types, instead of an opaque `500`.
  - `fileFilter` accepts by MIME type **or** `.pdf` extension (some browsers send `octet-stream`).
  - Upload route confirms the file landed on disk, validates `documentKind`, and cleans up the orphaned file if the DB write fails.
  - `Dockerfile` drops `USER node` so the mounted `uploads` named volume (which Docker may create root-owned) is always writable.

### Added
- **Diagrams on every question** — new `makeDiagram(topic, subject)` in `diagramTemplates.ts` *always* returns a diagram data-URI: topic-aware when a template matches, otherwise a sensible subject fallback (Physics → vector/incline/circuit/wave/projectile, Maths → parabola/grid/bar-chart/triangle). Wired into both the generator route (`questions.ts`) and the pack-from-template route (`packs.ts`) — template-generated questions now get diagrams too.
- **Grouped Question Bank** — questions are now organised into collapsible **Subject · Grade · Topic** groups, each showing a question count and a 🖼 diagram count. Every group has a one-click **🗑 Delete group** action, plus a **☑ Select group** shortcut in multi-select mode. Backed by a new `POST /api/questions/bulk-delete` endpoint (tutors restricted to their own questions, capped at 500 ids, audited).
- **Mock PDF seed** (`backend/src/db/seed-pdfs.ts`, `npm run db:seed-pdfs`) — compiled into `dist/` by the normal build so it runs in the production container with plain `node` (no `tsx` needed). Generates three real, openable PDFs (Gr 10 Algebra practice worksheet + memo, Gr 11 Quadratics class test, Gr 10 Newton's Laws study notes) into `uploads/` and registers them as `PdfDocument` rows. Idempotent and self-healing (regenerates the file if the row exists but the file is missing).
- **`scripts/doctor.sh` health-check** — one command to catch (almost) every production problem: containers up, Postgres reachable, critical tables exist, security columns present, uploads dir writable, admin/tutor/PDF seed data present, HTTP smoke test, backend log scan for crash-loops/error spam, host disk space. Prints PASS/WARN/FAIL per check and exits non-zero on any failure so it doubles as a post-deploy gate.

### Changed
- `backend/package.json` gains `db:seed-extras` and `db:seed-pdfs` scripts.

---

## [2.2.0] — 2026-05-14 — Guided generator, friendly difficulty, PDF-in-tab

### Added
- **`QuestionGenerator` wizard** replaces the cramped 4-input row on the Question Bank page. Sequential prompts: Subject → Grade → Topic → Count → Difficulty mix. Each subject has a distinct visual identity (📐 teal for Maths, ⚗️ purple for Physical Sciences) reused on every question/pack card site-wide via `SUBJECT_THEME`.
- **Friendly difficulty labels** (`utils/difficulty.ts`):
  - `EASY` → 🌱 Warm-up (recall + 1-step · ≈ 45s · builds confidence)
  - `MEDIUM` → 🎯 Core (exam-typical · 2–3 steps · ≈ 75s)
  - `HARD` → 🚀 Stretch (multi-step reasoning · ≈ 2 min+ · top distinctions)
  - Database keeps the academic codes — only the UI rebrands.
- **`DifficultyKey` cheatsheet** — collapsible card shown to tutors/admins on the Question Bank explaining what the friendly labels translate to academically.

### Changed
- **PDF buttons open in a new tab** (`packs.openPdf`). Browser's built-in PDF viewer renders the worksheet/memo and exposes its own Download / Print buttons — which is what users actually wanted. Pop-up-blocker fallback drops a direct download.
- Difficulty propagated everywhere a student or tutor sees a question: Practice screen, Pack editor preview, Tutor Library preview, Admin Assignments question picker.
- Old single-row "Generate" block (subject/grade/topic input/count) removed in favour of the wizard panel.

### Notes
- Backend question-generator API unchanged — the wizard sends the same payload. The "Difficulty mix" selector is a UX hint for now; a follow-up will pass the chosen tier to the server-side generator so output respects it.

### Added
- **Offline write queue** (`frontend/src/services/offlineQueue.ts`) — any non-GET request that fails with a network error is persisted to `localStorage`, retried on `window.online`, on user sign-in, and every 30 s while connected. Mutations stay queued through 5xx errors; 4xx are dropped. Quiz submissions in particular now survive flaky connections — the student sees "Saved offline — will submit when you reconnect" and can move on.
- **OfflineBanner** — fixed top-of-screen status banner that appears when offline or whenever the queue has pending items. Shows per-type counts ("📋 Quiz submission ×2 · 📅 Calendar request ×1") and an explicit "↻ Sync now" button when reconnected.
- **ClockWeather widget** — real-time clock + Open-Meteo weather chip rendered next to the dashboard welcome. Geolocation API (with browser prompt) and a Johannesburg fallback. Reverse-geocode populates the city name. Refreshes every 15 min and caches the coordinates for instant render on next load.

### Added — Mobile polish
- Comprehensive responsive overhaul in `index.css`:
  - Tables get horizontal scroll with a sane min-width
  - Page headers (`.ph`) shrink + headings reduce on phones
  - Cards (`.ca`, `.card`) shrink padding
  - Modals fill the viewport at narrow widths
  - Calendar cells compress; on `< 480px` pill labels are replaced by a single dot indicator
  - Quiz options get a 44 px tap target
  - Topbar wraps and hides the centre identity strip on phones to leave room for the bell
  - Tablet breakpoint (769–1024 px) gives stats a 2-column grid
  - Honours `prefers-reduced-motion`
- Viewport meta upgraded with `viewport-fit=cover`; `theme-color` set to EduSpark teal; description meta added for shareability.

### Added — Seed data
- Rewritten `backend/seed-extras.ts` produces a realistic demo class:
  - 3 packs (Algebra Foundations · Quadratic Practice · Newton's Laws) auto-shared with the first tutor
  - First tutor's class auto-paired and unlocked for grade-appropriate packs
  - 18 synthetic historical practice results across students with varied scores
  - Calendar notes (tutor session + admin broadcast)
  - Welcome notification per student
- Fully idempotent — re-running it is safe and is a no-op if the data is already there.

### Changed
- `api.ts` request function detects network-vs-HTTP errors and enqueues mutations on true network failures; non-mutation reads bubble the error up to the caller.
- Quiz submission flow handles `offline` flag as a soft-success → toast + navigate to My Work.

---

## [2.0.0] — 2026-05-13 — Packs, PDFs, SmartCoach, PIN Recovery, Production Deploy

Major release intended for the VPS hand-off.

### Added — Content distribution
- **Content Packs** model (`Pack` / `PackQuestion` / `PackDocument` / `PackShare` / `StudentUnlock`) — admin curates, tutors share, students unlock
- `GET /api/packs/:id/pdf?mode=worksheet|memo` — EduSpark-branded PDF export via pdfkit (minimalist white + teal accent)
- Tutors can now create their own custom packs and questions (own library tab)
- `PdfDocument` model + `/api/documents` with pdf-parse text indexing
- Question Bank repositioned as Pack source pool with multi-select → "Add to Pack"

### Added — Engagement & outcomes
- `Notification` model + bell with unread badge; hooks wired into every state change
- `OnboardingState` + one-shot `<OnboardingModal>` on login (auto-dismiss when complete)
- `/api/recommendations/me` — SmartCoach (daily goal, streak, weak/strong topics, suggested next pack, trend arrows)
- `/api/recommendations/spotlight` — Class Spotlight (at-risk / inactive / new / on-track / thriving)
- `/api/analytics/a-student-factory` — admin: mastery tiers, class velocity, recovery rate, risers/strugglers, grade segments
- `/api/analytics/grade-segments` — grade-grouped allocation view

### Added — Calendar
- Role-scoped visibility (`tutorId`, `studentId`, `kind`, `sharedWithAdmin`)
- Student requests: `move` / `new` / `cancel` with proposed date + auto-applied side effects on approval

### Added — Security & recovery
- `securityQuestion` + bcrypt `securityAnswerHash` on User
- PIN recovery via security question (`/api/auth/recover/lookup` + `/verify`)
- "I'm returning" vs "I'm new" stance on login with explicit confirm modal

### Added — Content
- 14 new CAPS/IEB topic generators (Euclidean Geometry, Counting & Probability, Vectors, Electrodynamics, Optical Phenomena, etc.)
- `expectedSecondsFor()` — per-question time budgets from difficulty + text length + options count; Quiz timer uses these

### Added — Scale
- `express-rate-limit` (300 req/min general, 20/min auth, 30/5min generators)
- Indexes on Notification + CalendarNote

### Added — Image upload
- All common formats accepted (PNG/JPG/GIF/WebP/BMP/SVG/AVIF); HEIC rejected with clear iOS hint

### Added — Deployment (DEPLOY.md)
- Production `docker-compose.yml` rebuilt for VPS co-existence (default `APP_PORT=3007`, named volumes for `pgdata` + `uploads`)
- Backend Dockerfile: non-root, openssl, multi-stage, `prisma migrate deploy` on boot
- Consolidated migration `20260513120000_v6_packs_pdfs_notifications_calendar_recovery`
- `.env.production.example` + deployment guide with reverse-proxy snippet

### Changed
- Question CRUD opened to tutors (scoped to own)
- `GET /api/questions` for tutors returns own questions OR questions in shared packs
- Sidebar reorganised: Admin = Packs/PDF Library; Tutor = My Library + Question Bank; Student = Practice
- TutorSpotlight compacted (collapsed header by default, one-line rows)
- Onboarding moved off dashboards into a one-shot login modal

### Fixed
- Pre-existing analytics nullable `assignmentId` crash
- Vite dev server bound to `127.0.0.1` (matches Edge IPv4 resolution)
- Container watch via `usePolling` for Windows host bind mounts

---

## [1.6.0] — 2026-04-21 — Practice Result Tracking, Tutor Result Scope & Free-Text Topics

### Added — Backend
- `ResultType` enum (`ASSIGNMENT` | `PRACTICE`) added to Prisma schema; `assignmentId` made optional on `QuizResult` to support practice sessions
- `practiceTopic` and `practiceSubject` fields on `QuizResult` to tag practice sessions by topic
- `POST /api/results/practice` — saves a completed practice session; awards half XP (no completion bonus) to distinguish from formal work
- Prisma migration `add_practice_results` applied

### Fixed — Backend
- `GET /results/assignment/:assignmentId` — tutors now see results for **any assignment completed by their students**, not just their own assignments. For global admin assignments, results are filtered to the tutor's students only
- `GET /results/:id` — tutors can now fetch individual result records for their own students
- All analytics routes (`overview`, `topic-performance`, `subject-performance`, `difficulty-breakdown`) now filter to `resultType: ASSIGNMENT` so practice sessions do not distort formal pass rates and averages
- Student report (`analytics/student-report/:id`) adds `practiceSummary` and `totalPracticeSessions` to the response — tutors can see what topics a student has been self-studying

### Added — Frontend
- Practice sessions now **save to the database** on completion via `POST /results/practice`
- Practice results screen shows an **XP earned badge** (e.g. ⚡ +12 XP) after a session completes
- Topic fields in the Question Bank and Assignments modals are now **free-text inputs with `<datalist>` suggestions** — any custom topic can be typed in; the predefined list still appears as autocomplete options
- `CAPS_TOPICS` renamed `TOPICS` in Assignments.tsx (aligned with Questions.tsx rename from v1.5.0)
- `QuizResult` type updated: `assignmentId` optional, `resultType`, `practiceTopic`, `practiceSubject` fields added

---

## [1.5.0] — 2026-04-21 — Security Fixes, Topic Filter & Multi-Syllabus Support

### Fixed — Backend
- `GET /api/assignments/:id` now validates student access — checks `assignTo` scope and tutor ownership before returning the assignment; students cannot fetch assignments outside their scope
- `POST /api/results` (quiz submission) now validates the student is assigned to the assignment before accepting a submission
- `GET /api/results/assignment/:id` now allows tutors to view all results for their own assignments (previously returned only the tutor's own results as if they were a student)
- `GET /api/questions` now accepts `topic` and `grade` query params for all roles (previously `grade` was admin-only and `topic` was not supported)

### Added — Frontend
- **Question bank topic filter**: selecting a subject and grade reveals a topic dropdown; only questions for that topic are shown — applies to both admin and tutor
- **Question bank grade filter**: visible for all staff; tutors default to their taught grades and cannot be shown grades outside their profile
- **Tutor grade scoping**: question bank grade selector and Add/Edit question form are pre-scoped to the tutor's taught grades; tutors cannot create or browse questions outside their assigned grades
- Visibility filter hidden from tutor view (tutors see all non-hidden questions by design)

### Changed
- Question bank page heading updated from "CAPS questions" to "questions aligned to CAPS, IEB, NSC & Cambridge" — the platform is not limited to one syllabus
- `CAPS_TOPICS` constant renamed to `TOPICS` in the frontend to reflect multi-syllabus scope
- Parent session KPI cards (Avg Score, Best Score, Pass Rate, Quizzes Done) are now hidden until the student has completed at least one quiz — prevents a confusing all-zero state
- Student dashboard empty state now links to the Question Bank so students can practise while waiting for assignments
- XP badge in the top bar is now hidden when XP is 0 (first-time students no longer see "⚡ 0 XP")

---

## [1.4.0] — 2026-04-21 — Parent PIN Sessions, Exam Readiness Gate & Dashboard Cleanup

### Added — Backend
- `examReadinessUnlocked Boolean @default(false)` field on User model; Prisma migration `add_exam_readiness_unlock` applied
- `PATCH /students/:id/toggle-exam-readiness` endpoint (tutor/admin only); tutors restricted to their own cohort
- Analytics `student-report/:id` now returns `recommendations` array computed from topic averages: `< 50%` → urgent, `50–69%` → review, `≥ 70%` → maintain
- Analytics `student-report/:id` returns `{ locked: true }` for STUDENT callers when `examReadinessUnlocked` is false
- `PAR-XXXX` parent PIN auth: validated against `ParentAccess` table, issues JWT with `role: 'PARENT'`; no onboarding step
- `AuthPayload` extended with `'PARENT'` role in `auth.ts` middleware

### Added — Frontend
- **Parent PIN session**: entering a `PAR-XXXX` PIN on the login page authenticates directly (no role card, no onboarding)
- New **ParentSession** component (`/frontend/src/pages/ParentSession.tsx`): in-app read-only dashboard with student header, 4 KPI cards, topic performance bars, and recent quizzes list; no sidebar or navigation
- `AppShell` short-circuits for `PARENT` role and renders `ParentSession` instead of the standard layout
- **Exam readiness lock/unlock toggle** on Admin/Tutor Students page: per-student button (`🔒 Readiness` / `🔓 Readiness`); updates list in-place via API
- ExamReadiness page shows a friendly locked state when `{ locked: true }` is returned by the API
- Student Report (`/app/report/:studentId`): tutor badge added; all "Teacher Comment" labels renamed to "Tutor Comment"; footer updated to reference allocated tutor
- Student **Dashboard** cleanup: completed assignments are filtered out of the pending quiz list; "All done!" empty state with link to My Work shown when no pending work remains

### Changed
- `frontend/src/types/index.ts`: `Role` extended with `'PARENT'`; `User` interface gains `examReadinessUnlocked`, `label`, `studentId`, `daysLeft` fields
- `students` API service gains `toggleExamReadiness(id)` call

---

## [1.3.0] — 2026-04-21 — Student Work Tracker

### Added — Frontend
- New **My Work** page for students (`/app/my-work`): full assignment tracker with filter tabs (All / Pending / Done / Overdue), subject filter, sort by due date / title / score
- Overall completion progress bar with attempt count tracking (X/max attempts used)
- Colour-coded urgency: overdue (red), due ≤2 days (amber), on-track (default)
- Best-score panel on completed assignments showing distinction/merit/pass grade and correct/total breakdown
- Retake button shows remaining attempts; disabled when exhausted
- Sidebar badge on "My Work" showing count of pending (non-overdue, not done) assignments
- Sidebar student nav reorganised: My Work as first learning item

---

## [1.2.1] — 2026-04-20 — Tutor Onboarding, Analytics & Parent PIN Flow

### Changed
- Renamed "Teacher" → "Tutor" throughout all UI labels (nav, badges, modals, headings, column headers)
- Tutor login card updated to show TCH-XXXX PIN format

### Added — Backend
- `subjects String[]` and `teachGrades Int[]` fields on User model for tutor profiles
- `POST /auth/register-tutor` endpoint: creates tutor account with subjects + grade preferences after onboarding
- Tutor name entry now returns `{ needsProfile: true }` — account created only after profile step
- Analytics `/report/:id` now includes allocated tutor (`tutor: { id, name } | null`) in response
- Parent PIN `createPin` accepts `expiryDays` param (7 / 14 / 30 / 60); defaults to 7

### Added — Frontend
- Tutor onboarding modal on login: select subjects (Maths / Phys Sci) and grades (10 / 11 / 12) before account creation
- Tutor profile shows subjects + grades in Sidebar profile modal
- Admin Analytics per-student view: tutor info banner above KPI cards (name or "No tutor assigned")
- Parent PINs: 2-step modal flow — browse full student list (searchable + grade filter) → configure PIN label & expiry
- Admin Tutors page: subject + grade tags on each tutor card
- Removed duplicate "Request Students" button from Tutor My Students empty state (kept header button only)

---

## [1.0.0] — 2026-04-20 — Initial Release 🚀

### Added — Backend
- Node.js + Express + TypeScript + Prisma ORM + PostgreSQL full-stack setup
- JWT authentication (7-day tokens); student PIN login (`SPK-XXXX`), teacher name-based login
- 20+ CAPS-aligned MCQ question generators for Grades 10–12 Maths & Physical Sciences
- Assignment system with `maxAttempts` per student (default 3), `attemptNumber` tracking on results
- Quiz result submission with per-question `ResultDetail` (selected answer, correct answer, solution)
- XP calculation: `(score/100) × questions × 10 + bonus`; stored on User model
- Student management: list, get, toggle active, reset PIN, update photo (base64)
- Assignment documents: text + base64 image attachments, scanned/uploaded material support
- Assignment visibility: assign to `all`, by grade (`gr10/11/12`), specific student (by user ID), or `none` (hidden)
- Analytics endpoints: overview with 5 KPIs (pass rate, topic mastery, improvement trend, difficulty insight, engagement score), topic performance, weekly activity, difficulty breakdown, per-student report
- Calendar notes CRUD (teacher-only create/edit/delete, all users read)
- Calendar change requests: students submit, admin approves/denies
- Parent access: temporary `PAR-XXXX` PINs, 7-day expiry, public `/api/parent/view/:pin` endpoint
- Student search endpoint: `GET /api/students/search?q=name` (case-insensitive, admin only)
- Docker setup: production `docker-compose.yml` + development `docker-compose.dev.yml`
- Prisma migrations: `add_retakes_calendar_requests`, `add_parent_access`
- Seed data: demo teacher + 4 students across Grades 10–12

### Added — Frontend
- React 18 + TypeScript + Vite, react-chartjs-2 for all charts
- Liquid glass UI: polygon mesh canvas background (18 nodes, animated connections), frosted glass cards, animated math/science symbols
- Light and dark mode with toggle (sidebar + login page)
- Login page: role selector (Student / Teacher), motivational quote, grade modal for new students, PIN reveal with copy-before-continue gate
- **Admin — Dashboard**: weekly activity line chart, subject performance doughnut, top students, recent activity
- **Admin — Question Bank**: generate from CAPS topics, manual create, bulk text import, image upload, show/hide toggle, edit/delete
- **Admin — Assignments**: create/edit with question picker, supporting documents (text + image), assign to all/grade/specific student (live search dropdown), max attempts selector; list with submission count, overdue status
- **Admin — Students**: table with XP, grade, last active; reset PIN, activate/deactivate, view exam readiness report
- **Admin — Analytics (Class)**: 5 KPI cards, topic bar chart, correct/incorrect doughnut, difficulty progress bars, weekly trend line, weakest/strongest topics
- **Admin — Analytics (Per Student)**: tab toggle to select individual student; shows KPI cards, topic chart, recent results list, full topic mastery table
- **Admin — Calendar**: monthly calendar, add/edit/delete notes, pending change request badge + approve/deny modal
- **Admin — Student Report** (`/app/report/:studentId`): exam readiness circular SVG meter, topic breakdown, difficulty analysis, editable teacher comment, print/PDF download
- **Admin — Parent Access PINs** (`/app/parent-pins`): create PIN linked to student (live search), copy PIN or full link, revoke, active/expired split view
- **Student — Dashboard**: XP bar, level badge, streak, assigned quizzes with attempt dots + retake button
- **Student — Question Bank**: grade/subject/topic/difficulty filters, expandable step-by-step solutions, timed 10-question practice mode (30s per question, auto-advance, colour-coded timer, results screen)
- **Student — Quiz Engine**: attempt counter (N/max), flag questions, navigation pills, submit confirmation, attempt history dots
- **Student — Results**: score hero, doughnut, full per-question review with formatted step-by-step solutions
- **Student — Exam Readiness**: circular SVG meter, topic bars, difficulty analysis, teacher comment, parent report section
- **Student — Calendar**: read-only schedule, "Request Change" button with message modal
- **Student — Progress**: XP level progress bar, achievements (8 types), day streak, performance charts
- **Student — Quiz History**: table with all past quiz scores and XP
- **Public — Parent View** (`/parent/:pin`): no-auth page showing child progress, KPI cards, topic bars, recent quizzes; expired/invalid PIN error state
- CSS token system: `--p` teal, `--s` green, `--a` cyan, `--wr` amber, `--dr` red; glass card patterns throughout

---

## [Unreleased]

<!-- Add your next changes here before committing -->

---

## [1.2.0] — 2026-04-21 — Tutor-Student Pairing Requests & Allocation Flow

### Added — Backend
- New `TutorRequest` Prisma model (`tutor_requests` table): tutorId, studentId, status (pending/approved/denied), optional note; unique per pair
- Migration `add_tutor_requests` applied
- New route file `/api/tutor-requests`: GET (admin: all; tutor: own), POST (tutor requests student), PATCH (admin approve/deny), DELETE (tutor cancels pending)
- On approval: student `teacherId` set automatically; all other pending requests for same student auto-denied
- `GET /api/students/available` — returns unallocated students (no teacherId), filterable by grade
- Re-request allowed after a previous denial (re-opens as pending)

### Added — Frontend
- **Tutor — My Students**: "Request Students" button always visible; empty-state CTA when no students yet
- **Tutor — Request Students modal**: browse unallocated students by grade; "⭐ REC" badge on students matching tutor's existing cohort grades; optional note per request; shows pending requests with cancel
- **Tutor — Pending requests banner**: compact chip list of pending requests on the My Students page; quick-cancel from banner
- **Admin — Teachers page**: "Pending Pairing Requests" panel at top; shows tutor name → student name with Approve/Deny buttons; auto-dismisses when all resolved
- **Admin — Assign Students modal**: updated description clarifies students can be moved between teachers
- **Sidebar (admin)**: amber badge on Teachers nav link shows count of pending pairing requests; clears when all resolved

---

## [1.1.1] — 2026-04-21 — PIN-Based Auth for All Roles & Seeded Admins

### Changed — Backend
- Tutors now receive a `TCH-XXXX` PIN on first registration (name-based sign-up → PIN issued, same pattern as students)
- Admin login is PIN-only (`ADM-XXXX`); no name-based admin creation via the API
- PIN detection in auth route covers all three prefixes: `SPK` (student), `TCH` (tutor), `ADM` (admin)
- `makeUniquePin` now accepts a `generator` argument — used to emit correct prefix per role
- `pinGenerator.ts`: added `generateTutorPin()` (`TCH-`) and `generateAdminPin()` (`ADM-`) exports
- Reset-pin endpoint detects target user's role and generates `TCH-` or `SPK-` prefix accordingly
- Seed updated: 3 pre-created admin accounts — Alistair Sabe (`ADM-ALIS`), Mbongeni Mncube (`ADM-MBON`), Glad Mpala (`ADM-GLAD`)
- Tutor management routes (`GET /tutors`, `PATCH /tutors/:id/toggle-active`, `PATCH /:id/assign-tutor`) remain admin-only

### Changed — Frontend
- Login page: each role card now shows its PIN format (`SPK-XXXX` / `TCH-XXXX` / `ADM-XXXX`) as a sub-label
- Tutor first sign-up shows the same PIN copy-before-continue modal as students (PIN prefixed `TCH-`)
- Admin tab accepts PIN only; entering a plain name shows a clear error directing to `ADM-XXXX`
- Letter-spacing on the login input activates for any `SPK-`, `TCH-`, or `ADM-` prefix
- Sidebar: masked PIN badge shows correct prefix per role (`ADM-••••` / `TCH-••••` / `SPK-••••`)
- Sidebar profile modal: tutors can reveal and copy their `TCH-XXXX` PIN (same as students)
- Tutors page: each teacher card shows their `TCH-XXXX` PIN (click to reveal/hide, copy button) and a Reset PIN button (admin only)

---

## [1.1.0] — 2026-04-20 — Tutor Role & Multi-Class Support

### Added — Backend
- New `TUTOR` role in `Role` enum (between STUDENT and ADMIN)
- `teacherId` field on User — links a student to their assigned tutor
- Self-relation `TutorStudents` on User model (tutor ↔ students)
- `tutorId` field on Assignment — `null` = global admin assignment; set = scoped to tutor's cohort
- `adminOrTutorOnly` middleware for routes accessible to both roles
- Auth route handles `role: 'tutor'` — find-or-create by name with TUTOR role
- `GET /api/students/tutors` — lists all tutors with their allocated students (admin only)
- `PATCH /api/students/:id/assign-tutor` — assign/unassign a student to a tutor (admin only)
- `PATCH /api/students/tutors/:id/toggle-active` — activate/deactivate a tutor
- All analytics routes scoped to tutor's student cohort when called by TUTOR role
- Assignments: tutors can create/edit/delete only their own assignments (`tutorId` set on create)
- Students: tutors see only their allocated students in list/search/report endpoints
- Calendar: tutors can create/edit/delete notes and manage change requests
- Parent PINs: tutors can create/revoke PINs for their own students only
- Prisma migration `add_tutor_role` applied

### Added — Frontend
- Login page: three-tab role selector — Student 🎒 / Teacher 👩‍🏫 / Admin 👨‍💼
- Sidebar: tutors get their own nav (`My Students`, `My Class` section labels, no Tutors management link)
- Sidebar: role badge shows "Teacher" for TUTOR, "SuperAdmin" for ADMIN
- New page `admin/Tutors.tsx` — admin-only; list all teachers, assign/unassign students, activate/deactivate
- Students page: shows "Teacher" column for admin; heading adapts ("My Students" for tutors)
- App shell: TUTOR role shares admin pages (server-side scoping handles data isolation)
- New sidebar link "👩‍🏫 Teachers" for admin; tutors do not see this link
- `tutors` API service: `list`, `toggleActive`, `assignStudent`
