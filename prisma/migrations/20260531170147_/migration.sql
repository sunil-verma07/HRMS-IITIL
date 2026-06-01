/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `employees` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdByHrId` to the `job_postings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pipelineStages` to the `job_postings` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OnboardingProgressStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "EmployeeStatus" ADD VALUE 'ON_LEAVE';

-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'ARCHIVED';

-- AlterEnum
ALTER TYPE "LeaveRequestStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "actorId" UUID,
ADD COLUMN     "actorName" VARCHAR(160),
ADD COLUMN     "entityName" VARCHAR(180);

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "browser" VARCHAR(80),
ADD COLUMN     "deviceType" VARCHAR(40),
ADD COLUMN     "isLate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "platform" VARCHAR(80);

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "action" VARCHAR(120),
ADD COLUMN     "actorId" UUID,
ADD COLUMN     "entityId" UUID,
ADD COLUMN     "entityType" VARCHAR(80),
ADD COLUMN     "newValue" JSONB,
ADD COLUMN     "previousValue" JSONB;

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "resumeUrl" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "departmentId" UUID,
ADD COLUMN     "designationId" UUID,
ADD COLUMN     "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "userId" UUID;

-- AlterTable
ALTER TABLE "job_applications" ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "job_postings" ADD COLUMN     "createdByHrId" UUID NOT NULL,
ADD COLUMN     "pipelineStages" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "referenceId" UUID,
ADD COLUMN     "type" VARCHAR(80) NOT NULL DEFAULT 'IN_APP';

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "actions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "level" VARCHAR(40),
ADD COLUMN     "roleId" UUID,
ADD COLUMN     "scope" VARCHAR(160);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "departmentId" UUID,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_notes" (
    "id" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "authorId" UUID,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "candidate_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_configs" (
    "id" UUID NOT NULL,
    "requiredDocuments" JSONB NOT NULL,
    "mandatoryFields" JSONB NOT NULL,
    "optionalFields" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_progress" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "completedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submittedDocuments" JSONB NOT NULL,
    "status" "OnboardingProgressStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "reviewedById" UUID,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "approverId" UUID,
    "type" VARCHAR(80) NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "attendanceDate" TIMESTAMP(3),
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "reason" TEXT,
    "remarks" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "region" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE INDEX "departments_deletedAt_idx" ON "departments"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "designations_code_key" ON "designations"("code");

-- CreateIndex
CREATE INDEX "designations_deletedAt_idx" ON "designations"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "designations_departmentId_title_key" ON "designations"("departmentId", "title");

-- CreateIndex
CREATE INDEX "candidate_notes_candidateId_idx" ON "candidate_notes"("candidateId");

-- CreateIndex
CREATE INDEX "candidate_notes_authorId_idx" ON "candidate_notes"("authorId");

-- CreateIndex
CREATE INDEX "candidate_notes_deletedAt_idx" ON "candidate_notes"("deletedAt");

-- CreateIndex
CREATE INDEX "onboarding_configs_updatedById_idx" ON "onboarding_configs"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_progress_employeeId_key" ON "onboarding_progress"("employeeId");

-- CreateIndex
CREATE INDEX "onboarding_progress_status_idx" ON "onboarding_progress"("status");

-- CreateIndex
CREATE INDEX "onboarding_progress_reviewedById_idx" ON "onboarding_progress"("reviewedById");

-- CreateIndex
CREATE INDEX "approval_requests_employeeId_idx" ON "approval_requests"("employeeId");

-- CreateIndex
CREATE INDEX "approval_requests_approverId_idx" ON "approval_requests"("approverId");

-- CreateIndex
CREATE INDEX "approval_requests_type_idx" ON "approval_requests"("type");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE INDEX "holidays_date_idx" ON "holidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_region_key" ON "holidays"("date", "region");

-- CreateIndex
CREATE INDEX "activity_logs_actorId_idx" ON "activity_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_userId_idx" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_departmentId_idx" ON "employees"("departmentId");

-- CreateIndex
CREATE INDEX "employees_designationId_idx" ON "employees"("designationId");

-- CreateIndex
CREATE INDEX "job_postings_createdByHrId_idx" ON "job_postings"("createdByHrId");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "permissions_roleId_idx" ON "permissions"("roleId");

-- CreateIndex
CREATE INDEX "permissions_scope_idx" ON "permissions"("scope");

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designations" ADD CONSTRAINT "designations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_createdByHrId_fkey" FOREIGN KEY ("createdByHrId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_configs" ADD CONSTRAINT "onboarding_configs_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
