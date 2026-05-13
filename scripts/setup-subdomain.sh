#!/usr/bin/env bash
#
# Set up eduspark.athera.co.za reverse-proxy + Let's Encrypt cert.
#
# Usage (from the repo root):
#   sudo bash scripts/setup-subdomain.sh
#
# Optional env vars:
#   DOMAIN  (default: eduspark.athera.co.za)
#   APP_PORT (default: 3007)
#
# Pre-requisites:
#   • DNS A-record for $DOMAIN already pointed at this VPS
#   • nginx + certbot installed (as you have for resihub)
#   • The EduSpark compose stack already running

set -e

DOMAIN="${DOMAIN:-eduspark.athera.co.za}"
APP_PORT="${APP_PORT:-3007}"
NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"

echo "→ Domain:  $DOMAIN"
echo "→ Backend: 127.0.0.1:$APP_PORT"
echo

if [ "$EUID" -ne 0 ]; then
  echo "✗ Please run as root (use sudo)."
  exit 1
fi

# ── 1. Pre-flight: confirm DNS resolves to this machine ─────────────
echo "→ Checking DNS for $DOMAIN ..."
VPS_IP="$(curl -s ifconfig.me || true)"
DNS_IP="$(dig +short "$DOMAIN" | head -1 || true)"
if [ -z "$DNS_IP" ]; then
  echo "⚠ DNS for $DOMAIN does not resolve yet. Add an A-record pointing to $VPS_IP first."
  read -rp "  Continue anyway? [y/N] " yn
  [[ "$yn" =~ ^[Yy]$ ]] || exit 1
elif [ "$DNS_IP" != "$VPS_IP" ]; then
  echo "⚠ DNS points to $DNS_IP but this VPS is $VPS_IP."
  read -rp "  Continue anyway? [y/N] " yn
  [[ "$yn" =~ ^[Yy]$ ]] || exit 1
else
  echo "✓ DNS OK ($DNS_IP)"
fi

# ── 2. Write the nginx site config (HTTP only — certbot adds 443) ──
echo "→ Writing $NGINX_SITE"
cat > "$NGINX_SITE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        client_max_body_size 30m;
    }
}
NGINX

mkdir -p /var/www/letsencrypt
ln -sf "$NGINX_SITE" "$NGINX_ENABLED"

echo "→ Testing nginx config ..."
nginx -t
systemctl reload nginx

# ── 3. Issue cert via certbot's --nginx plugin (it edits the conf) ──
echo "→ Issuing Let's Encrypt cert for $DOMAIN ..."
certbot --nginx -d "$DOMAIN" --redirect --non-interactive --agree-tos \
  -m "${EMAIL:-admin@athera.co.za}" || {
    echo "⚠ certbot failed. You can re-run interactively:"
    echo "    sudo certbot --nginx -d $DOMAIN --redirect"
    exit 1
  }

systemctl reload nginx

# ── 4. Smoke test ──────────────────────────────────────────────────
echo "→ Verifying HTTPS ..."
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "https://${DOMAIN}/")"
API_CODE="$(curl -s -o /dev/null -w '%{http_code}' "https://${DOMAIN}/api/packs")"
echo "    GET https://${DOMAIN}/         → $HTTP_CODE  (expect 200)"
echo "    GET https://${DOMAIN}/api/packs → $API_CODE  (expect 401)"

# ── 5. Tighten CORS in the running stack ───────────────────────────
ENV_FILE="$(dirname "$(realpath "$0")")/../.env"
if [ -f "$ENV_FILE" ]; then
  echo "→ Updating CORS_ORIGIN in $ENV_FILE"
  sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://${DOMAIN}|" "$ENV_FILE"

  cd "$(dirname "$ENV_FILE")"
  echo "→ Restarting backend with new CORS origin ..."
  docker compose -f docker-compose.yml --env-file .env restart backend
fi

cat <<DONE

✅ Done.

   Site: https://${DOMAIN}
   Sign in as admin: ADM-ALIS

   Auto-renewal is handled by certbot.timer (already on if resihub is renewing).

DONE
