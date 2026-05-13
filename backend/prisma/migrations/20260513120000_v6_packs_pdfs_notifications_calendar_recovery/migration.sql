-- AlterTable
ALTER TABLE "calendar_notes" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'note',
ADD COLUMN     "sharedWithAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "studentId" TEXT,
ADD COLUMN     "tutorId" TEXT;

-- AlterTable
ALTER TABLE "calendar_requests" ADD COLUMN     "proposedDate" TEXT,
ADD COLUMN     "proposedTitle" TEXT,
ADD COLUMN     "requestType" TEXT NOT NULL DEFAULT 'move',
ADD COLUMN     "tutorId" TEXT,
ALTER COLUMN "noteId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "securityAnswerHash" TEXT,
ADD COLUMN     "securityQuestion" TEXT;

-- CreateTable
CREATE TABLE "packs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subject" "Subject" NOT NULL,
    "grade" INTEGER NOT NULL,
    "topic" TEXT,
    "coverEmoji" TEXT NOT NULL DEFAULT '📦',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_questions" (
    "packId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pack_questions_pkey" PRIMARY KEY ("packId","questionId")
);

-- CreateTable
CREATE TABLE "pack_documents" (
    "packId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pack_documents_pkey" PRIMARY KEY ("packId","documentId")
);

-- CreateTable
CREATE TABLE "pack_shares" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "note" TEXT,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pack_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_unlocks" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "unlockedById" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "extractedText" TEXT,
    "documentKind" TEXT NOT NULL DEFAULT 'practice',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdf_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedSteps" TEXT[],
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pack_shares_packId_tutorId_key" ON "pack_shares"("packId", "tutorId");

-- CreateIndex
CREATE UNIQUE INDEX "student_unlocks_studentId_packId_key" ON "student_unlocks"("studentId", "packId");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_states_userId_key" ON "onboarding_states"("userId");

-- CreateIndex
CREATE INDEX "calendar_notes_tutorId_idx" ON "calendar_notes"("tutorId");

-- CreateIndex
CREATE INDEX "calendar_notes_studentId_idx" ON "calendar_notes"("studentId");

-- AddForeignKey
ALTER TABLE "calendar_notes" ADD CONSTRAINT "calendar_notes_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_notes" ADD CONSTRAINT "calendar_notes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packs" ADD CONSTRAINT "packs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_questions" ADD CONSTRAINT "pack_questions_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_questions" ADD CONSTRAINT "pack_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_documents" ADD CONSTRAINT "pack_documents_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_documents" ADD CONSTRAINT "pack_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "pdf_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_shares" ADD CONSTRAINT "pack_shares_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_shares" ADD CONSTRAINT "pack_shares_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_shares" ADD CONSTRAINT "pack_shares_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_unlocks" ADD CONSTRAINT "student_unlocks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_unlocks" ADD CONSTRAINT "student_unlocks_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_unlocks" ADD CONSTRAINT "student_unlocks_unlockedById_fkey" FOREIGN KEY ("unlockedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_documents" ADD CONSTRAINT "pdf_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_states" ADD CONSTRAINT "onboarding_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

