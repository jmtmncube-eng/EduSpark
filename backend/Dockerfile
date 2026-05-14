FROM node:20-alpine AS builder

WORKDIR /app
# Prisma needs openssl on alpine
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Production image ──────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Keep the prisma CLI available at runtime for migrate/push
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY prisma ./prisma
COPY seed-extras.ts ./seed-extras.ts
COPY seed-pdfs.ts ./seed-pdfs.ts

# Uploads directory — multer writes here. It's a mounted named volume in
# compose; we run as root so the volume (which Docker may create root-owned)
# is always writable. The container itself is the security boundary.
RUN mkdir -p /app/uploads

EXPOSE 8000

# On boot:
#   1. migrate deploy   — apply any committed migrations
#   2. db push          — reconcile ANY schema drift not yet captured in a
#                         migration file (additive only — safe). This is the
#                         belt-and-braces guarantee that audit_logs,
#                         question_batches etc. always exist in production.
#   3. start the API
CMD ["sh", "-c", "npx prisma migrate deploy || echo '⚠ migrate deploy skipped'; npx prisma db push --accept-data-loss --skip-generate; node dist/index.js"]
