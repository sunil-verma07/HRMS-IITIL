/*
  Warnings:

  - You are about to drop the column `candidateId` on the `offer_letters` table. All the data in the column will be lost.
  - You are about to drop the column `employeeId` on the `offer_letters` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "offer_letters_candidateId_idx";

-- DropIndex
DROP INDEX "offer_letters_employeeId_idx";

-- AlterTable
ALTER TABLE "offer_letters" DROP COLUMN "candidateId",
DROP COLUMN "employeeId",
ADD COLUMN     "status" VARCHAR(40) NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "category" VARCHAR(80),
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "variables" TEXT[];

-- CreateIndex
CREATE INDEX "offer_letters_createdAt_idx" ON "offer_letters"("createdAt");

-- CreateIndex
CREATE INDEX "templates_isDefault_idx" ON "templates"("isDefault");
