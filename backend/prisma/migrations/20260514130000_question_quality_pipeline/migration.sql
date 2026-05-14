-- v2.9 — Question quality & review pipeline.
-- Adds: review status, CAPS + cognitive-level tags, auto quality flag,
-- validation errors, reviewer trail on Question; review status on batches.
--
-- Written defensively (IF NOT EXISTS / guarded DO-blocks) so it is safe
-- whether or not a prior `prisma db push` already created these objects.

-- ─── QuestionStatus enum ───────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'RETIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── questions: new columns ────────────────────────────────────────
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "capsCode" TEXT;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "cognitiveLevel" INTEGER;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "qualityFlag" TEXT;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "validationErrors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;

-- Existing questions are already in circulation — treat them as PUBLISHED so
-- packs/assignments keep working. Only rows added AFTER this migration get the
-- DRAFT default. Guarded: only runs the first time (when nothing is PUBLISHED yet).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "questions" WHERE "status" = 'PUBLISHED') THEN
    UPDATE "questions" SET "status" = 'PUBLISHED';
  END IF;
END $$;

-- ─── questions: reviewer FK + indexes ──────────────────────────────
DO $$ BEGIN
  ALTER TABLE "questions"
    ADD CONSTRAINT "questions_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "questions_status_subject_grade_idx"
  ON "questions" ("status", "subject", "grade");
CREATE INDEX IF NOT EXISTS "questions_qualityFlag_idx"
  ON "questions" ("qualityFlag");

-- ─── question_batches: review status ───────────────────────────────
ALTER TABLE "question_batches" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'REVIEW';
