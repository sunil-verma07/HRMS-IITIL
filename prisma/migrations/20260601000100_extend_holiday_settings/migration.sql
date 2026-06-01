-- AlterTable
ALTER TABLE "holidays"
ADD COLUMN "description" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "createdById" UUID;

-- CreateIndex
CREATE INDEX "holidays_isActive_idx" ON "holidays"("isActive");

-- CreateIndex
CREATE INDEX "holidays_createdById_idx" ON "holidays"("createdById");

-- AddForeignKey
ALTER TABLE "holidays"
ADD CONSTRAINT "holidays_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
