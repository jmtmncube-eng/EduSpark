-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "maxAttempts" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "quiz_results" ADD COLUMN     "attemptNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "calendar_requests" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "calendar_requests" ADD CONSTRAINT "calendar_requests_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "calendar_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_requests" ADD CONSTRAINT "calendar_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
