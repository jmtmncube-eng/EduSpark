#!/usr/bin/env bash
#
# EduSpark Preflight — run before every push.
#
# Two jobs:
#   1. Prove the codebase still compiles and builds (backend + frontend).
#   2. Assert that the specific fixes we shipped are actually present in the
#      source — a regression tripwire so a future edit can't quietly revert them.
#
# KEEP THIS IN SYNC: whenever you ship a fix/feature, add a matching assertion
# under section 3 (grouped by version). The script is only as honest as its
# checklist — an un-asserted fix is a fix that can silently regress.
#
# Environment-aware:
#   • On a DEV machine (where `npm install` has been run) it does the full
#     type-check + build.
#   • On the VPS the host has no node_modules — the app is built INSIDE Docker
#     images — so the compile/build steps are SKIPPED (not failed) and you get
#     the source-assertion checks only. For a real build test on the VPS use
#     `docker compose build`; for runtime health use `scripts/doctor.sh`.
#
# Exits non-zero only on a real FAIL, so it doubles as a pre-push gate.
#
#   bash scripts/preflight.sh
#
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
LOG="$(mktemp)"

ok()   { printf "  \033[32m✓ PASS\033[0m  %s\n" "$1"; PASS=$((PASS + 1)); }
bad()  { printf "  \033[31m✗ FAIL\033[0m  %s\n" "$1"; FAIL=$((FAIL + 1)); }
skip() { printf "  \033[33m• SKIP\033[0m  %s\n" "$1"; SKIP=$((SKIP + 1)); }
hdr()  { printf "\n\033[1m%s\033[0m\n" "$1"; }

# assert a file contains a literal pattern
has() { # <description> <pattern> <file>
  if grep -qF -- "$2" "$3" 2>/dev/null; then ok "$1"; else bad "$1 — expected '$2' in $3"; fi
}
# assert a file does NOT contain a pattern
lacks() { # <description> <pattern> <file>
  if grep -qF -- "$2" "$3" 2>/dev/null; then bad "$1 — unexpected '$2' still in $3"; else ok "$1"; fi
}
# assert a path is gone
gone() { # <path> <description>
  if [ -e "$1" ]; then bad "$2 — $1 still exists"; else ok "$2"; fi
}
# assert a path exists
present() { # <path> <description>
  if [ -e "$1" ]; then ok "$2"; else bad "$2 — $1 is missing"; fi
}
# run a build/check command IF the Node toolchain is actually usable here:
#   • the runner binary (npm/npx) is on PATH, AND
#   • the project's node_modules are installed.
# Otherwise SKIP it — that host (the VPS) builds inside Docker instead.
run_if_deps() { # <description> <dir> <command...>
  local desc="$1" dir="$2"; shift 2
  local bin="$1"
  if ! command -v "$bin" >/dev/null 2>&1; then
    skip "$desc — '$bin' not on PATH (Node toolchain not installed on this host)"
    return
  fi
  if [ ! -d "$dir/node_modules" ]; then
    skip "$desc — $dir/node_modules not installed (build runs inside Docker here)"
    return
  fi
  if ( cd "$dir" && "$@" ) >"$LOG" 2>&1; then
    ok "$desc"
  else
    bad "$desc"
    echo "      ── last 15 lines ──"
    tail -n 15 "$LOG" | sed 's/^/      /'
  fi
}

echo "🛫 EduSpark Preflight — $(date '+%Y-%m-%d %H:%M:%S')"

if ! command -v npm >/dev/null 2>&1 || [ ! -d backend/node_modules ] || [ ! -d frontend/node_modules ]; then
  echo "   ℹ No usable host Node toolchain — compile/build steps will be skipped (this looks like the VPS)."
fi

# ── 1. Compiles ────────────────────────────────────────────────────
hdr "1. Type-check"
run_if_deps "backend type-check (tsc --noEmit)"  backend  npx tsc --noEmit
run_if_deps "frontend type-check (tsc --noEmit)" frontend npx tsc --noEmit
run_if_deps "prisma schema validates"            backend  npx prisma validate

# ── 2. Builds ──────────────────────────────────────────────────────
hdr "2. Production build"
run_if_deps "backend build (tsc)"   backend  npm run build
run_if_deps "frontend build (vite)" frontend npm run build

# ── 2b. Automated tests ────────────────────────────────────────────
hdr "2b. Tests"
run_if_deps "backend unit tests (vitest)" backend npm test

# ── 3. Shipped fixes are present (regression tripwire) ─────────────
# These run everywhere — they only read source files. Grouped by the
# release that introduced them; add a new block whenever you ship.
hdr "3. Shipped fixes present"

echo " v2.8.0 — schema-drift fix, PDF uploads, grouped bank"
present backend/prisma/migrations/20260514120000_audit_batches_security/migration.sql \
        "Audit/batches schema-drift migration committed"
has   "Dockerfile self-heals schema (migrate + db push)"  "prisma db push"  backend/Dockerfile
has   "PDF upload boot-time writability check"      "ensureUploadDir"  backend/src/routes/documents.ts
has   "PDF upload multer error wrapper"             "uploadSingle"     backend/src/routes/documents.ts
has   "Bulk-delete endpoint (group delete)"         "bulk-delete"      backend/src/routes/questions.ts
present backend/src/db/seed-pdfs.ts                 "Mock-PDF seed present"
present scripts/doctor.sh                           "doctor.sh health-check present"

echo " v2.9.0 — question quality pipeline"
has   "QuestionStatus review-pipeline enum"         "enum QuestionStatus"  backend/prisma/schema.prisma
present backend/prisma/migrations/20260514130000_question_quality_pipeline/migration.sql \
        "Quality-pipeline migration committed"
present backend/src/utils/questionValidation.ts     "Validation pipeline present"
present backend/src/generators/index.ts             "Modular generator registry present"
has   "Smarter diagrams — explicit-kind renderer"   "makeDiagramOfKind" backend/src/utils/diagramTemplates.ts
has   "Batch approve/discard endpoint"              "batches/:id/approve"  backend/src/routes/questions.ts

echo " v2.9.1 — PDF viewer + PUBLISHED-only packs"
has   "PDF auth accepts ?token= query param"        "req.query.token"  backend/src/middleware/auth.ts
has   "Blob-based PdfViewer component exists"       "fileBlob"         frontend/src/components/PdfViewer.tsx
has   "Packs accept PUBLISHED questions only"       "publishedOnly"    backend/src/routes/packs.ts

echo " v2.9.2 — student cold-start + verified defects"
gone  frontend/src/pages/student/Questions.tsx      "Orphaned student/Questions.tsx removed"
has   "Student cold-start 'connect a tutor' card"   "Connect with a tutor" frontend/src/pages/student/Dashboard.tsx
has   "analytics/overview returns questions count"  "questionCount"    backend/src/routes/analytics.ts

echo " v2.9.3 — guided Question Bank, idle logout, Tier-3 polish"
lacks "Question Bank has zero <select> dropdowns"   "<select"          frontend/src/pages/admin/Questions.tsx
has   "PillSelect guided control exists"            "PillOption"       frontend/src/components/PillSelect.tsx
has   "Add-question modal is a numbered prompt"     "Which subject?"   frontend/src/pages/admin/Questions.tsx
has   "Idle auto-logout after 2 minutes"            "IDLE_LIMIT_MS"    frontend/src/context/AuthContext.tsx
has   "Tutor: per-student attempt history list"     "Attempt history"  frontend/src/pages/admin/Students.tsx
has   "TutorSpotlight rows have inline Assign"      "onAssign"         frontend/src/components/TutorSpotlight.tsx
has   "Assignments page honours prefill deep-link"  "prefillHandled"   frontend/src/pages/admin/Assignments.tsx
has   "analytics/overview returns content-health"   "reviewQueue"      backend/src/routes/analytics.ts
has   "Dashboard shows content-health chips"        "CONTENT HEALTH"   frontend/src/pages/admin/Dashboard.tsx
has   "AuditLog renders top-actions strip"          "MOST ACTIVE"      frontend/src/pages/admin/AuditLog.tsx
if grep -rqF "grade-segments" backend/src 2>/dev/null; then
  bad "Dead /grade-segments endpoint removed — still referenced in backend/src"
else
  ok "Dead /grade-segments endpoint removed"
fi

echo " v2.9.4 — PDF header fix, bank reorder, no-dropdown content flows, PDF drawers"
has   "PDF Content-Disposition is ASCII/UTF-8 safe"  "filename*=UTF-8"  backend/src/routes/documents.ts
has   "Question Bank heading + search pinned to top" "My Question Bank" frontend/src/pages/admin/Questions.tsx
has   "Pack-from-template uses pill prompts"         "PillSelect"       frontend/src/components/PackTemplatePicker.tsx
has   "Assignment create modal uses pill prompts"    "PillSelect"       frontend/src/pages/admin/Assignments.tsx
has   "PDF Library segments into kind drawers"       "File under"       frontend/src/pages/admin/PdfLibrary.tsx

echo " v2.9.5 — login dropdowns gone, WCAG-AA contrast pass"
lacks "Login page has zero <select> dropdowns"       "<select"          frontend/src/pages/Login.tsx
has   "Login uses pill / card prompts"               "PillSelect"       frontend/src/pages/Login.tsx
has   "Text scale tuned for WCAG-AA contrast"        "--t4:#3C7257"     frontend/src/index.css
has   "Idle auto-logout still wired"                 "IDLE_LIMIT_MS"    frontend/src/context/AuthContext.tsx

echo " v2.10 — CAPS+IEB curriculum, varied difficulty-aware generators, scale, tests"
has   "Curriculum enum in schema"                    "enum Curriculum"  backend/prisma/schema.prisma
present backend/prisma/migrations/20260514140000_curriculum/migration.sql \
        "Curriculum migration committed"
has   "Generators are difficulty-aware"              "GenDiff"          backend/src/utils/questionGenerators.ts
has   "Generators are multi-variant for variety"     "GeneratorFn[]"    backend/src/utils/questionGenerators.ts
has   "Generate route honours the difficulty mix"    "difficultyPlan"   backend/src/routes/questions.ts
has   "Registration captures curriculum"             "curriculum"       frontend/src/pages/Login.tsx
has   "Students list has a triage Sort control"      "Needs attention"  frontend/src/pages/admin/Students.tsx
has   "Admin can bulk-assign students"               "bulk-assign-tutor" backend/src/routes/students.ts
present backend/src/__tests__/generators.test.ts     "Generator test suite committed"
present backend/src/__tests__/questionValidation.test.ts "Validation test suite committed"

echo " v2.10.1 — one-button generator, half-diagram, split analytics, CAPS+IEB branding"
has   "Generator is a one-button guided wizard"      "STEP_LABELS"      frontend/src/components/QuestionGenerator.tsx
has   "~half of generated questions carry a diagram" "Math.random() < 0.5" backend/src/routes/questions.ts
has   "Analytics splits Maths & Physics graphs"      "subjectTopicChart" frontend/src/pages/admin/Analytics.tsx
has   "topic-performance returns per-topic subject"  "subject: r.assignment.subject" backend/src/routes/analytics.ts
lacks "No stale 'SA CAPS' branding in frontend"      "SA CAPS"          frontend/index.html
lacks "No stale 'SA CAPS' branding in sidebar"       "SA CAPS"          frontend/src/components/Sidebar.tsx
lacks "No stale 'SA CAPS' branding in PDF seed"      "SA CAPS"          backend/src/db/seed-pdfs.ts
has   "Sidebar shows CAPS & IEB branding"            "CAPS &amp; IEB"   frontend/src/components/Sidebar.tsx

echo " v2.10.2 — visible calendar requests, Grades 10–12 everywhere"
has   "Calendar requests use a prominent banner"     "cal-req-banner"   frontend/src/pages/admin/Calendar.tsx
has   "Calendar request banner has attention glow"   "reqGlow"          frontend/src/index.css
has   "Generator grade step offers full 10–12 set"   "const GRADES = [10, 11, 12]" frontend/src/components/QuestionGenerator.tsx
has   "Pack template grade picker offers 10–12"      "const GRADES = [10, 11, 12]" frontend/src/components/PackTemplatePicker.tsx
lacks "Generator grade step not narrowed by tutor"   "tutorGrades"      frontend/src/components/QuestionGenerator.tsx

echo " v2.10.3 — login: trimmed feature cards, CAPS & IEB only"
lacks "Login curriculum row drops Cambridge"         "Cambridge"        frontend/src/pages/Login.tsx
lacks "Login curriculum row drops NSC"               "'NSC'"            frontend/src/pages/Login.tsx

rm -f "$LOG"

# ── Summary ────────────────────────────────────────────────────────
hdr "Summary"
printf "  \033[32m%d passed\033[0m · \033[33m%d skipped\033[0m · \033[31m%d failed\033[0m\n" "$PASS" "$SKIP" "$FAIL"
if [ "$FAIL" -ne 0 ]; then
  echo "  ✗ Preflight failed — fix the above before pushing."
  exit 1
fi
if [ "$SKIP" -ne 0 ]; then
  echo "  ✅ All checks that could run here passed."
  echo "    ($SKIP build step(s) skipped — run preflight on your dev machine for the full"
  echo "     compile+build gate, or 'docker compose build' here for an in-image build test.)"
  exit 0
fi
echo "  ✅ Preflight clean — safe to push."
exit 0
