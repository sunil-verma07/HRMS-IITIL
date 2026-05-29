-- CreateTable
CREATE TABLE "attendance_regularizations" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "requestedCheckIn" TIMESTAMP(3),
    "requestedCheckOut" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "remarks" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "attendance_regularizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_calendar_events" (
    "id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_regularizations_employeeId_idx" ON "attendance_regularizations"("employeeId");

-- CreateIndex
CREATE INDEX "attendance_regularizations_status_idx" ON "attendance_regularizations"("status");

-- CreateIndex
CREATE INDEX "attendance_regularizations_attendanceDate_idx" ON "attendance_regularizations"("attendanceDate");

-- CreateIndex
CREATE INDEX "attendance_regularizations_reviewedById_idx" ON "attendance_regularizations"("reviewedById");

-- CreateIndex
CREATE INDEX "leave_calendar_events_date_idx" ON "leave_calendar_events"("date");

-- CreateIndex
CREATE INDEX "leave_calendar_events_createdById_idx" ON "leave_calendar_events"("createdById");

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_calendar_events" ADD CONSTRAINT "leave_calendar_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
