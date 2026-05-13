# EduSpark — Production Deployment

A reproducible deploy onto the **athera VPS** (or any Docker host). EduSpark is a
3-container stack: `eduspark-frontend` (nginx + built React), `eduspark-backend`
(Node + Prisma), `eduspark-db` (Postgres 16).

## TL;DR

```bash
# 1. On the VPS, in any directory:
git clone https://github.com/jmtmncube-eng/EduSpark.git
cd EduSpark

# 2. Configure secrets (copy + edit)
cp .env.production.example .env
nano .env                 # set JWT_SECRET, POSTGRES_PASSWORD, APP_PORT, CORS_ORIGIN

# 3. Build + run
docker compose -f docker-compose.yml --env-file .env up -d --build

# 4. Open
curl -s http://localhost:3007            # serves index.html
curl -s http://localhost:3007/api/health # {"status":"ok"...}
```

That's it — Prisma migrations run automatically on container boot.

## Port plan (against the current VPS)

Looking at `docker ps` on the VPS, ports in use are: **3000, 3001, 3004, 5000,
5432, 5433, 5435, 5555**. EduSpark publishes:

| Service | Container | Host port | Notes |
| --- | --- | --- | --- |
| Frontend (nginx) | `eduspark-frontend` | **3007** (override via `APP_PORT`) | Only public port |
| Backend API | `eduspark-backend` | _none_ (compose-internal) | Frontend nginx proxies `/api/` |
| Postgres | `eduspark-db` | _none_ (compose-internal) | Uncomment in compose if you need host access |

The frontend container already proxies `/api/*` requests to the backend container
inside the compose network, so the backend doesn't need a public port.

## Required env vars (`.env`)

| Var | Purpose |
| --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres credentials. Use a strong random password. |
| `JWT_SECRET` | Signs auth tokens. **MUST** be a long random string (64+ chars). |
| `APP_PORT` | Host port for the frontend. Default `3007`. |
| `CORS_ORIGIN` | Public origin of the frontend (e.g. `https://eduspark.yourdomain.com`). `*` is allowed for testing only. |

Generate a secure JWT secret quickly:

```bash
openssl rand -hex 64
```

## First-time setup commands

```bash
# Apply Prisma migrations + seed initial admin/tutor/student accounts
docker compose exec backend npx prisma migrate deploy
docker compose exec backend node dist/db/seed.js     # if you ship the seed
# Or seed-extras (demo pack) — see backend/seed-extras.ts
```

> The Dockerfile already calls `prisma migrate deploy` on container start, so
> the explicit `migrate deploy` step is only needed if you bake new SQL into the
> repo and want to apply it without restarting the container.

## Reverse proxy / TLS

For your `athera` VPS, point an nginx server block at `http://127.0.0.1:3007`
just like you do for resihub. Example:

```nginx
server {
  listen 443 ssl http2;
  server_name eduspark.example.com;

  ssl_certificate     /etc/letsencrypt/live/eduspark.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/eduspark.example.com/privkey.pem;

  client_max_body_size 30m;   # PDF uploads

  location / {
    proxy_pass http://127.0.0.1:3007;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Then set `CORS_ORIGIN=https://eduspark.example.com` in `.env` and redeploy.

## Persistent volumes

The compose declares two named volumes that survive restarts and rebuilds:

| Volume | Mounted at | Holds |
| --- | --- | --- |
| `pgdata` | `/var/lib/postgresql/data` | All Postgres data |
| `uploads` | `/app/uploads` (backend) | PDF documents tutors/admins uploaded |

Back these up with:

```bash
docker run --rm -v eduspark_pgdata:/data -v "$PWD:/backup" alpine \
  tar czf /backup/eduspark-pgdata-$(date +%F).tar.gz -C / data
docker run --rm -v eduspark_uploads:/data -v "$PWD:/backup" alpine \
  tar czf /backup/eduspark-uploads-$(date +%F).tar.gz -C / data
```

## Common operations

```bash
# View live logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart a single service
docker compose restart backend

# Rebuild after a git pull
git pull
docker compose up -d --build

# Open a Postgres shell
docker compose exec db psql -U eduspark

# Wipe and rebuild (destroys all data!)
docker compose down -v
docker compose up -d --build
```

## Smoke test after deploy

```bash
# Frontend serves
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://localhost:3007/

# Proxy + backend reachable
curl -s -o /dev/null -w "api/health: %{http_code}\n" http://localhost:3007/api/health
curl -s -o /dev/null -w "api/packs: %{http_code}\n"  http://localhost:3007/api/packs   # expect 401 (auth required)
```

Then log in via the browser using the seeded admin PIN (see `backend/src/db/seed.ts`).

## Troubleshooting

* **`relation "packs" does not exist`** — first deploy didn't run migrations.
  Try `docker compose exec backend npx prisma migrate deploy`.
* **`Can't reach database server`** — db not healthy yet. `docker compose logs db`
  to inspect; the backend retries on its own.
* **403 on `/api/documents/upload`** — body too large. The nginx limit in
  `frontend/nginx.conf` is 30 MB; bump it and rebuild if you need bigger PDFs.
* **Port clash on 3007** — set `APP_PORT=3008` (or any free port) in `.env`
  and `docker compose up -d`.
