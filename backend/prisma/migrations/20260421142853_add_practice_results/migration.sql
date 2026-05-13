-- CreateEnum
CREATE TYPE "ResultType" AS ENUM ('ASSIGNMENT', 'PRACTICE');

-- AlterTable
ALTER TABLE "quiz_results" ADD COLUMN     "practiceSubject" TEXT,
ADD COLUMN     "practiceTopic" TEXT,
ADD COLUMN     "resultType" "ResultType" NOT NULL DEFAULT 'ASSIGNMENT',
ALTER COLUMN "assignmentId" DROP NOT NULL;
