-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TUTOR';

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "tutorId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "teacherId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
