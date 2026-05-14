#!/usr/bin/env bash
#
# EduSpark Preflight — run before every push.
#
# Two jobs:
#   1. Prove the codebase still compiles and builds (backend + frontend).
#   2. Assert that the specific fixes we shipped are actually present in the
#      source — a regression tripwire so a future edit can't quietly revert them.
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

# ── 3. Shipped fixes are present (regression tripwire) ─────────────
# These run everywhere — they only read source files.
hdr "3. Shipped fixes present"

# v2.9.1 — PDF viewer
has   "PDF auth accepts ?token= query param"        "req.query.token"  backend/src/middleware/auth.ts
has   "Blob-based PdfViewer component exists"       "fileBlob"         frontend/src/components/PdfViewer.tsx

# v2.9.2 — student cold-start + dead-route fixes
gone  frontend/src/pages/student/Questions.tsx      "Orphaned student/Questions.tsx removed"
has   "Student cold-start 'connect a tutor' card"   "Connect with a tutor" frontend/src/pages/student/Dashboard.tsx
has   "analytics/overview returns questions count"  "questionCount"    backend/src/routes/analytics.ts

# Question Bank — no native dropdowns, guided pill UI
lacks "Question Bank has zero <select> dropdowns"   "<select"          frontend/src/pages/admin/Questions.tsx
has   "PillSelect guided control exists"            "PillOption"       frontend/src/components/PillSelect.tsx
has   "Add-question modal is a numbered prompt"     "Which subject?"   frontend/src/pages/admin/Questions.tsx

# Idle auto-logout
has   "Idle auto-logout after 2 minutes"            "IDLE_LIMIT_MS"    frontend/src/context/AuthContext.tsx

# Tier 3 — tutor
has   "Tutor: per-student attempt history list"     "Attempt history"  frontend/src/pages/admin/Students.tsx
has   "TutorSpotlight rows have inline Assign"      "onAssign"         frontend/src/components/TutorSpotlight.tsx
has   "Assignments page honours prefill deep-link"  "prefillHandled"   frontend/src/pages/admin/Assignments.tsx

# Tier 3 — admin
has   "analytics/overview returns content-health"   "reviewQueue"      backend/src/routes/analytics.ts
has   "Dashboard shows content-health chips"        "CONTENT HEALTH"   frontend/src/pages/admin/Dashboard.tsx
has   "AuditLog renders top-actions strip"          "MOST ACTIVE"      frontend/src/pages/admin/AuditLog.tsx

# Tier 3 — dead-code cleanup
if grep -rqF "grade-segments" backend/src 2>/dev/null; then
  bad "Dead /grade-segments endpoint removed — still referenced in backend/src"
else
  ok "Dead /grade-segments endpoint removed"
fi

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
