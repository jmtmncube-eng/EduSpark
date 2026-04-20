-- CreateTable
CREATE TABLE "parent_access" (
    "id" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parent_access_pin_key" ON "parent_access"("pin");

-- AddForeignKey
ALTER TABLE "parent_access" ADD CONSTRAINT "parent_access_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
