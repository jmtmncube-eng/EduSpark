#!/usr/bin/env bash
#
# Fixes the eduspark.athera.co.za 502 caused by:
#   • the umbrella `athera-projects` config already declaring the hostname
#     (pointing at the wrong port 3002)
#   • our earlier setup-subdomain.sh creating a duplicate solo config
#
# What it does:
#   1. Removes the duplicate solo config (sites-available + sites-enabled)
#   2. Rewrites the proxy_pass in athera-projects: 3002 → APP_PORT (default 3007)
#   3. Adds upload + websocket headers to the eduspark block (idempotent)
#   4. Tests nginx + reloads
#   5. Tightens CORS in /var/www/projects/eduspark/.env to https://$DOMAIN
#   6. Restarts the eduspark backend container so CORS takes effect
#   7. Prints a smoke-test of https://$DOMAIN
#
# Usage:
#   sudo bash scripts/fix-subdomain.sh
#
# Optional env vars:
#   DOMAIN     (default: eduspark.athera.co.za)
#   APP_PORT   (default: 3007)
#   OLD_PORT   (default: 3002 — the port currently in athera-projects)

set -e

DOMAIN="${DOMAIN:-eduspark.athera.co.za}"
APP_PORT="${APP_PORT:-3007}"
OLD_PORT="${OLD_PORT:-3002}"
UMBRELLA_CONF="/etc/nginx/sites-available/athera-projects"
SOLO_AVAIL="/etc/nginx/sites-available/${DOMAIN}"
SOLO_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"
ENV_FILE="/var/www/projects/eduspark/.env"

if [ "$EUID" -ne 0 ]; then
  echo "✗ Please run as root (use sudo)."
  exit 1
fi

if [ ! -f "$UMBRELLA_CONF" ]; then
  echo "✗ Cannot find $UMBRELLA_CONF — nothing to fix."
  exit 1
fi

# ── 1. Remove our duplicate config ─────────────────────────────────
echo "→ Removing duplicate solo config (if present)"
rm -f "$SOLO_ENABLED" "$SOLO_AVAIL" && echo "  ✓ Cleaned" || true

# ── 2. Repoint the eduspark block to the right port ────────────────
if grep -q "proxy_pass http://localhost:${OLD_PORT};" "$UMBRELLA_CONF"; then
  echo "→ Repointing proxy_pass: localhost:${OLD_PORT} → 127.0.0.1:${APP_PORT}"
  sed -i "s|proxy_pass http://localhost:${OLD_PORT};|proxy_pass http://127.0.0.1:${APP_PORT};|" "$UMBRELLA_CONF"
  echo "  ✓ Updated"
elif grep -q "proxy_pass http://127.0.0.1:${APP_PORT};" "$UMBRELLA_CONF"; then
  echo "  • proxy_pass already on port ${APP_PORT} — no change needed"
else
  echo "  ⚠ Could not find a proxy_pass for localhost:${OLD_PORT} — check $UMBRELLA_CONF manually"
fi

# ── 3. Inject upload + ws headers into the eduspark block (idempotent) ─
if ! grep -A 20 "server_name eduspark.athera.co.za" "$UMBRELLA_CONF" \
     | grep -q "client_max_body_size 30m"; then
  echo "→ Adding upload-size + forwarded-headers to eduspark block"
  # Insert after the proxy_cache_bypass line that belongs to the eduspark block
  awk -v added=0 '
    /server_name eduspark.athera.co.za;/ { in_block=1 }
    in_block && /proxy_cache_bypass \$http_upgrade;/ && !added {
      print
      print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
      print "        proxy_set_header X-Forwarded-Proto $scheme;"
      print "        proxy_read_timeout 120s;"
      print "        client_max_body_size 30m;"
      added=1
      in_block=0
      next
    }
    { print }
  ' "$UMBRELLA_CONF" > "${UMBRELLA_CONF}.tmp" && mv "${UMBRELLA_CONF}.tmp" "$UMBRELLA_CONF"
  echo "  ✓ Headers added"
else
  echo "  • Headers already present"
fi

# ── 4. Test + reload nginx ─────────────────────────────────────────
echo "→ Testing nginx config"
nginx -t
echo "→ Reloading nginx"
systemctl reload nginx
echo "  ✓ Reloaded"

# ── 5. Tighten CORS in .env ────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  if ! grep -q "^CORS_ORIGIN=https://${DOMAIN}$" "$ENV_FILE"; then
    echo "→ Locking CORS_ORIGIN to https://${DOMAIN}"
    sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://${DOMAIN}|" "$ENV_FILE"
    echo "  ✓ Updated"
  else
    echo "  • CORS_ORIGIN already correct"
  fi
fi

# ── 6. Restart backend so CORS sticks ──────────────────────────────
if [ -d "$(dirname "$ENV_FILE")" ] && command -v docker >/dev/null; then
  echo "→ Restarting eduspark backend"
  cd "$(dirname "$ENV_FILE")"
  docker compose -f docker-compose.yml --env-file .env restart backend

  # ── 6b. Wait for backend to actually be ready ────────────────────
  echo "→ Waiting for backend to be ready"
  for i in $(seq 1 30); do
    sleep 1
    if curl -s --max-time 3 "https://${DOMAIN}/api/packs" -o /dev/null -w '%{http_code}' \
         | grep -q '^401$'; then
      echo "  ✓ Backend is up (${i}s)"
      break
    fi
    [ "$i" = 30 ] && echo "  ⚠ Backend not responding after 30s — continuing anyway"
  done

  # ── 6c. Ensure demo tutors exist (idempotent) ───────────────────
  echo "→ Ensuring demo tutors exist"
  docker compose -f docker-compose.yml --env-file .env exec -T backend node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const count = await p.user.count({ where: { role: 'TUTOR' } });
    if (count > 0) { console.log(`  • ${count} tutor(s) already in DB — skipping`); return; }
    await p.user.upsert({
      where: { pin: 'TCH-D5VA' }, update: {},
      create: { name: 'Moses', role: 'TUTOR', pin: 'TCH-D5VA', active: true,
                subjects: ['MATHEMATICS','PHYSICAL_SCIENCES'], teachGrades: [10,11] }
    });
    await p.user.upsert({
      where: { pin: 'TCH-GDBR' }, update: {},
      create: { name: 'John',  role: 'TUTOR', pin: 'TCH-GDBR', active: true,
                subjects: ['MATHEMATICS'], teachGrades: [11,12] }
    });
    console.log('  ✓ Created tutors: Moses (TCH-D5VA), John (TCH-GDBR)');
  } catch (e) { console.error('  ✗ Tutor seed failed:', e.message); }
  finally { await p.$disconnect(); }
})();
NODE
fi

# ── 7. Smoke test ──────────────────────────────────────────────────
echo
echo "→ Smoke test:"
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "https://${DOMAIN}/")"
API_CODE="$(curl -s -o /dev/null -w '%{http_code}' "https://${DOMAIN}/api/packs")"
printf "    %-40s → %s  (expect 200)\n" "https://${DOMAIN}/" "$HTTP_CODE"
printf "    %-40s → %s  (expect 401)\n" "https://${DOMAIN}/api/packs" "$API_CODE"
echo

if [ "$HTTP_CODE" = "200" ] && [ "$API_CODE" = "401" ]; then
  cat <<DONE
✅ All clear — EduSpark is live at https://${DOMAIN}

   Sign in as admin: ADM-ALIS
DONE
else
  cat <<WARN
⚠ One of the smoke tests didn't return the expected status code.

   Inspect:
     sudo nginx -T | sed -n '/eduspark.athera.co.za/,/^}/p'
     docker logs eduspark-frontend --tail 30
     docker logs eduspark-backend  --tail 30
WARN
fi
