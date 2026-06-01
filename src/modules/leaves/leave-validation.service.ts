import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { BadRequestError } from "../../common/errors/app-error";

type ValidationResult = {
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  days: number;
  startDate: Date;
  endDate: Date;
  balanceId?: string;
};

const weekdayCodes = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

const normalizeDayCode = (value: string) => value.trim().toUpperCase().slice(0, 3);

const getWorkingDays = (value: Prisma.JsonValue | null | undefined) => {
  if (!Array.isArray(value)) {
    return ["MON", "TUE", "WED", "THU", "FRI"];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map(normalizeDayCode);
};

const toLocalDate = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const eachDate = (startDate: Date, endDate: Date) => {
  const dates: Date[] = [];
  const cursor = toLocalDate(startDate);
  const end = toLocalDate(endDate);

  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const isWorkingDay = (date: Date, workingDays: string[]) => workingDays.includes(weekdayCodes[date.getDay()] ?? "SUN");

export class LeaveValidationService {
  static async validateApply(input: {
    employeeId: string;
    leaveTypeId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<ValidationResult> {
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: {
        id: true,
        status: true,
        reportingManagerId: true,
        departmentId: true,
        department: true,
      },
    });

    if (!employee || employee.status !== "ACTIVE") {
      throw new BadRequestError("Employee must be ACTIVE");
    }

    if (!employee.reportingManagerId) {
      throw new BadRequestError("No reporting manager assigned");
    }

    const leaveType = await prisma.leaveType.findUnique({
      where: { id: input.leaveTypeId },
      select: {
        id: true,
        name: true,
        annualQuota: true,
      },
    });

    if (!leaveType) {
      throw new BadRequestError("Leave type not found");
    }

    const currentYear = input.startDate.getFullYear();
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          year: currentYear,
        },
      },
    });

    const dates = eachDate(input.startDate, input.endDate);
    const days = dates.length;
    const available = Number(balance?.allocated ?? leaveType.annualQuota) - Number(balance?.used ?? 0);

    if (available < days) {
      throw new BadRequestError("Insufficient leave balance");
    }

    const overlappingRequest = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        deletedAt: null,
        status: { in: ["PENDING", "PENDING_TEAM_LEAD", "PENDING_HR", "APPROVED"] },
        startDate: { lte: input.endDate },
        endDate: { gte: input.startDate },
      },
    });

    if (overlappingRequest) {
      throw new BadRequestError("Overlapping leave request exists");
    }

    const workingDays = await prisma.attendanceSetting.findFirst({
      where: { isActive: true, deletedAt: null },
      select: { workingDays: true },
    });
    const allowedDays = getWorkingDays(workingDays?.workingDays);

    if (dates.some((date) => !isWorkingDay(date, allowedDays))) {
      throw new BadRequestError("Leave dates cannot include weekends");
    }

    const holiday = await prisma.holiday.findFirst({
      where: {
        isActive: true,
        date: {
          in: dates,
        },
        type: { not: "OPTIONAL" },
      },
    });

    if (holiday) {
      throw new BadRequestError("Leave dates cannot include holidays");
    }

    const duplicatePending = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: "PENDING",
        deletedAt: null,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });

    if (duplicatePending) {
      throw new BadRequestError("Duplicate pending leave request exists");
    }

    return {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      leaveTypeName: leaveType.name,
      days,
      startDate: input.startDate,
      endDate: input.endDate,
      ...(balance?.id ? { balanceId: balance.id } : {}),
    };
  }

  static async recalculateBalances(employeeId: string, year: number): Promise<void> {
    const leaveTypes = await prisma.leaveType.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, annualQuota: true },
    });

    const requests = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        deletedAt: null,
        status: { in: ["PENDING", "PENDING_TEAM_LEAD", "PENDING_HR", "APPROVED"] },
        startDate: { gte: new Date(year, 0, 1) },
        endDate: { lte: new Date(year, 11, 31, 23, 59, 59, 999) },
      },
      select: {
        leaveTypeId: true,
        days: true,
      },
    });

    const grouped = new Map<string, number>();
    for (const request of requests) {
      grouped.set(request.leaveTypeId, (grouped.get(request.leaveTypeId) ?? 0) + Number(request.days));
    }

    await Promise.all(
      leaveTypes.map(async (leaveType) => {
        const used = grouped.get(leaveType.id) ?? 0;
        await prisma.leaveBalance.upsert({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId,
              leaveTypeId: leaveType.id,
              year,
            },
          },
          update: {
            allocated: leaveType.annualQuota,
            used,
          },
          create: {
            employeeId,
            leaveTypeId: leaveType.id,
            year,
            allocated: leaveType.annualQuota,
            used,
          },
        });
      }),
    );
  }
}