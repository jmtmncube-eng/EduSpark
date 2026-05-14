#!/usr/bin/env bash
#
# EduSpark Doctor — one command to catch (almost) every production problem.
#
# Runs a battery of health checks against a live deployment and prints a
# PASS / WARN / FAIL line for each. Exits non-zero if anything FAILed, so it
# can double as a CI / post-deploy gate.
#
# What it checks:
#   1. Docker containers are up (db · backend · frontend)
#   2. Postgres is reachable + accepting connections
#   3. Critical tables exist  (audit_logs, question_batches,
#      question_batch_items, pdf_documents) — i.e. migrations actually ran
#   4. users table has the PIN-recovery security columns
#   5. The uploads directory is present AND writable by the backend
#   6. At least one ADMIN user is seeded
#   7. HTTP smoke test: site root → 200, /api/packs → 401
#   8. Backend container has no recent crash-loop / error spam in its logs
#   9. Disk space on the host is not critically low
#
# Usage:
#   sudo bash scripts/doctor.sh
#
# Optional env vars:
#   DOMAIN     (default: eduspark.athera.co.za)
#   APP_DIR    (default: /var/www/projects/eduspark)
#   COMPOSE    (default: docker-compose.yml)

DOMAIN="${DOMAIN:-eduspark.athera.co.za}"
APP_DIR="${APP_DIR:-/var/www/projects/eduspark}"
COMPOSE="${COMPOSE:-docker-compose.yml}"

PASS=0; WARN=0; FAIL=0

ok()   { printf "  \033[32m✓ PASS\033[0m  %s\n" "$1"; PASS=$((PASS+1)); }
warn() { printf "  \033[33m⚠ WARN\033[0m  %s\n" "$1"; WARN=$((WARN+1)); }
bad()  { printf "  \033[31m✗ FAIL\033[0m  %s\n" "$1"; FAIL=$((FAIL+1)); }
hdr()  { printf "\n\033[1m%s\033[0m\n" "$1"; }

# Run a command inside the backend container, quietly.
dc() { docker compose -f "$COMPOSE" exec -T "$@" 2>/dev/null; }
# Run a psql query inside the db container; echoes the trimmed result.
psql_q() {
  dc db psql -U "${POSTGRES_USER:-eduspark}" -d "${POSTGRES_DB:-eduspark}" -tAc "$1" 2>/dev/null | tr -d '[:space:]'
}

echo "🩺 EduSpark Doctor — $(date '+%Y-%m-%d %H:%M:%S')"
echo "   Domain: $DOMAIN   ·   App dir: $APP_DIR"

# ── 0. Pre-flight ──────────────────────────────────────────────────
if ! command -v docker >/dev/null; then
  echo "✗ docker not found on PATH — cannot continue."
  exit 2
fi
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR" || { echo "✗ Cannot cd into $APP_DIR"; exit 2; }
  [ -f .env ] && set -a && . ./.env 2>/dev/null && set +a
else
  warn "App dir $APP_DIR not found — container checks may be skipped"
fi

# ── 1. Containers up ───────────────────────────────────────────────
hdr "1. Docker containers"
for svc in db backend frontend; do
  state="$(docker compose -f "$COMPOSE" ps -q "$svc" 2>/dev/null)"
  if [ -z "$state" ]; then
    bad "Container '$svc' is not running"
  else
    status="$(docker inspect -f '{{.State.Status}}' "$state" 2>/dev/null)"
    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}' "$state" 2>/dev/null)"
    if [ "$status" = "running" ]; then
      ok "Container '$svc' is running (health: $health)"
    else
      bad "Container '$svc' status is '$status'"
    fi
  fi
done

# ── 2. Postgres reachable ──────────────────────────────────────────
hdr "2. Database connectivity"
if [ "$(psql_q 'SELECT 1;')" = "1" ]; then
  ok "Postgres is reachable and accepting queries"
else
  bad "Cannot query Postgres — backend will 500 on every DB call"
fi

# ── 3. Critical tables exist (did migrations run?) ─────────────────
hdr "3. Schema / migrations"
for tbl in users questions packs audit_logs question_batches question_batch_items pdf_documents; do
  exists="$(psql_q "SELECT to_regclass('public.\"${tbl}\"') IS NOT NULL;")"
  if [ "$exists" = "t" ]; then
    ok "Table '$tbl' exists"
  else
    bad "Table '$tbl' is MISSING — run: docker compose exec backend npx prisma db push"
  fi
done

# ── 4. Security columns on users ───────────────────────────────────
hdr "4. PIN-recovery security columns"
for col in securityQuestion securityAnswerHash; do
  has="$(psql_q "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='${col}');")"
  if [ "$has" = "t" ]; then
    ok "users.$col present"
  else
    bad "users.$col MISSING — PIN recovery will crash"
  fi
done

# ── 5. Uploads directory writable ──────────────────────────────────
hdr "5. PDF uploads directory"
probe="__doctor_$(date +%s).tmp"
if dc backend sh -c "mkdir -p /app/uploads && touch /app/uploads/$probe && rm /app/uploads/$probe" ; then
  ok "/app/uploads exists and is writable by the backend"
else
  bad "/app/uploads is NOT writable — PDF uploads will fail. Check the volume owner."
fi

# ── 6. At least one admin seeded ───────────────────────────────────
hdr "6. Seed data"
admins="$(psql_q "SELECT count(*) FROM users WHERE role='ADMIN';")"
if [ -n "$admins" ] && [ "$admins" -ge 1 ] 2>/dev/null; then
  ok "$admins admin user(s) seeded"
else
  warn "No ADMIN users found — run: docker compose exec backend npm run db:seed"
fi
tutors="$(psql_q "SELECT count(*) FROM users WHERE role='TUTOR';")"
[ -n "$tutors" ] && [ "$tutors" -ge 1 ] 2>/dev/null \
  && ok "$tutors tutor(s) seeded" \
  || warn "No TUTOR users — tutors won't be able to log in"
docs="$(psql_q "SELECT count(*) FROM pdf_documents;")"
[ -n "$docs" ] && [ "$docs" -ge 1 ] 2>/dev/null \
  && ok "$docs PDF document(s) in the Library" \
  || warn "No PDF documents — run: docker compose exec backend npm run db:seed-pdfs"

# ── 7. HTTP smoke test ─────────────────────────────────────────────
hdr "7. HTTP smoke test"
root_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "https://${DOMAIN}/" 2>/dev/null)"
api_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "https://${DOMAIN}/api/packs" 2>/dev/null)"
[ "$root_code" = "200" ] \
  && ok "https://${DOMAIN}/ → 200" \
  || bad "https://${DOMAIN}/ → ${root_code:-no response} (expected 200)"
[ "$api_code" = "401" ] \
  && ok "https://${DOMAIN}/api/packs → 401 (auth gate working)" \
  || bad "https://${DOMAIN}/api/packs → ${api_code:-no response} (expected 401)"

# ── 8. Backend log scan ────────────────────────────────────────────
hdr "8. Backend log scan (last 200 lines)"
logs="$(docker compose -f "$COMPOSE" logs --tail 200 backend 2>/dev/null)"
err_count="$(printf '%s\n' "$logs" | grep -ciE 'error|unhandled|ECONN|PrismaClient|cannot find' || true)"
restart_count="$(docker inspect -f '{{.RestartCount}}' "$(docker compose -f "$COMPOSE" ps -q backend 2>/dev/null)" 2>/dev/null || echo 0)"
if [ "${err_count:-0}" -eq 0 ]; then
  ok "No error spam in recent backend logs"
elif [ "${err_count:-0}" -lt 5 ]; then
  warn "$err_count error-ish line(s) in recent backend logs — review with: docker compose logs --tail 200 backend"
else
  bad "$err_count error-ish line(s) in recent backend logs — something is wrong"
fi
if [ "${restart_count:-0}" -le 1 ]; then
  ok "Backend restart count is ${restart_count:-0} (no crash-loop)"
else
  warn "Backend has restarted ${restart_count} times — possible crash-loop"
fi

# ── 9. Disk space ──────────────────────────────────────────────────
hdr "9. Host disk space"
disk_use="$(df -P "$APP_DIR" 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
if [ -n "$disk_use" ]; then
  if [ "$disk_use" -lt 85 ]; then
    ok "Disk usage at ${disk_use}%"
  elif [ "$disk_use" -lt 95 ]; then
    warn "Disk usage at ${disk_use}% — getting tight"
  else
    bad "Disk usage at ${disk_use}% — critically low, uploads/DB writes may fail"
  fi
else
  warn "Could not determine disk usage"
fi

# ── Summary ────────────────────────────────────────────────────────
hdr "Summary"
printf "  \033[32m%d passed\033[0m · \033[33m%d warnings\033[0m · \033[31m%d failed\033[0m\n" "$PASS" "$WARN" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo
  echo "  ✗ One or more critical checks FAILED. Fix the items above before considering this deploy healthy."
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo
  echo "  ⚠ Deploy is up but has warnings worth reviewing."
  exit 0
else
  echo
  echo "  ✅ All checks passed — EduSpark looks healthy."
  exit 0
fi
