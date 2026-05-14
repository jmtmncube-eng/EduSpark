-- v2.8 — audit log, generation batches, PIN-recovery security fields.
-- Written defensively (IF NOT EXISTS) so it is safe whether or not a prior
-- `prisma db push` already created these objects on a given environment.

-- ─── User: PIN-recovery security question ──────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "securityQuestion"   TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "securityAnswerHash" TEXT;

-- ─── question_batches ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "question_batches" (
    "id"             TEXT NOT NULL,
    "createdById"    TEXT NOT NULL,
    "subject"        "Subject" NOT NULL,
    "grade"          INTEGER NOT NULL,
    "topic"          TEXT NOT NULL,
    "requestedCount" INTEGER NOT NULL DEFAULT 0,
    "difficulty"     TEXT,
    "note"           TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "question_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "question_batches_createdById_createdAt_idx"
    ON "question_batches" ("createdById", "createdAt");

-- ─── question_batch_items ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "question_batch_items" (
    "batchId"    TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order"      INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "question_batch_items_pkey" PRIMARY KEY ("batchId", "questionId")
);

-- ─── audit_logs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id"         TEXT NOT NULL,
    "actorId"    TEXT,
    "action"     TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId"   TEXT,
    "meta"       JSONB,
    "ip"         TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_actorId_createdAt_idx"
    ON "audit_logs" ("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_entityType_entityId_createdAt_idx"
    ON "audit_logs" ("entityType", "entityId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx"
    ON "audit_logs" ("createdAt");

-- ─── Foreign keys (added only if missing) ──────────────────────────
DO $$ BEGIN
  ALTER TABLE "question_batches"
    ADD CONSTRAINT "question_batches_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "question_batch_items"
    ADD CONSTRAINT "question_batch_items_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "question_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "question_batch_items"
    ADD CONSTRAINT "question_batch_items_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
