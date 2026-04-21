# Changelog

All notable changes to EduSpark are documented here.  
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

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
