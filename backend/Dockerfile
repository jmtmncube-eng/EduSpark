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
COPY prisma ./prisma

# Uploads directory — must exist for the multer destination; in compose it's a mounted volume
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node

EXPOSE 8000

# Apply pending DB migrations, then start the API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
