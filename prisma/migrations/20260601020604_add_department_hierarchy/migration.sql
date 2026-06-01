/*
  Warnings:

  - A unique constraint covering the columns `[headEmployeeId]` on the table `departments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "headEmployeeId" UUID,
ADD COLUMN     "parentDepartmentId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "departments_headEmployeeId_key" ON "departments"("headEmployeeId");

-- CreateIndex
CREATE INDEX "departments_headEmployeeId_idx" ON "departments"("headEmployeeId");

-- CreateIndex
CREATE INDEX "departments_parentDepartmentId_idx" ON "departments"("parentDepartmentId");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_headEmployeeId_fkey" FOREIGN KEY ("headEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parentDepartmentId_fkey" FOREIGN KEY ("parentDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
