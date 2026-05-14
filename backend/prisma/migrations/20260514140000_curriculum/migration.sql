-- v2.10 — Curriculum (CAPS / IEB).
-- Adds a curriculum tag to questions + generation batches, and a curriculum
-- preference to users (students). CAPS & IEB share the Gr 10-12 topic
-- framework, so this is a tag/preference — not a hard content wall.
--
-- Written defensively (IF NOT EXISTS / guarded blocks) so it is safe whether
-- or not a prior `prisma db push` already created these objects.

-- ─── Curriculum enum ───────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "Curriculum" AS ENUM ('CAPS', 'IEB');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── questions.curriculum ──────────────────────────────────────────
ALTER TABLE "questions"        ADD COLUMN IF NOT EXISTS "curriculum" "Curriculum" NOT NULL DEFAULT 'CAPS';
ALTER TABLE "question_batches" ADD COLUMN IF NOT EXISTS "curriculum" "Curriculum" NOT NULL DEFAULT 'CAPS';

-- ─── users.curriculum (nullable — existing accounts stay null = CAPS) ──
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "curriculum" "Curriculum";

-- ─── Index for curriculum-sliced queries ───────────────────────────
CREATE INDEX IF NOT EXISTS "questions_curriculum_subject_grade_idx"
  ON "questions" ("curriculum", "subject", "grade");
