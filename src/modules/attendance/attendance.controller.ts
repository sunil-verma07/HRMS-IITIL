import type { Request, Response } from "express";
import { AttendanceStatus, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { sendSuccess } from "../../common/http/api-response";
import { HttpStatus } from "../../common/http/status-codes";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import type { AuthenticatedUser } from "../../types/authenticated-user";
import { buildAttendanceScopeWhere, resolveAttendanceScope } from "./attendance-scope.policy";
import { buildDirectoryVisibilityWhere } from "../employees/employee-visibility.policy";

type PaginatedResult<T> = {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type AttendanceWithEmployee = Prisma.AttendanceRecordGetPayload<{
  include: {
    employee: {
      select: {
        id: true;
        employeeId: true;
        firstName: true;
        lastName: true;
        department: true;
        designation: true;
      };
    };
  };
}>;

type ApprovalRequestWithEmployee = Prisma.ApprovalRequestGetPayload<{
  include: {
    employee: {
      select: {
        id: true;
        employeeId: true;
        firstName: true;
        lastName: true;
        department: true;
        designation: true;
      };
    };
    approver: {
      select: {
        id: true;
        employeeId: true;
        firstName: true;
        lastName: true;
      };
    };
  };
}>;

const currentUser = (request: Request): AuthenticatedUser => {
  const user = request.user as AuthenticatedUser | undefined;
  if (!user) {
    throw new ForbiddenError("Authentication required");
  }

  return user;
};

const requireParam = (value: string | undefined, label: string): string => {
  if (!value) {
    throw new BadRequestError(`${label} is required`);
  }

  return value;
};

const parsePagination = (request: Request) => ({
  page: Math.max(1, Number.parseInt(String(request.query.page ?? "1"), 10) || 1),
  limit: Math.max(1, Number.parseInt(String(request.query.limit ?? "10"), 10) || 10),
});

const pageArgs = (query: { page: number; limit: number }) => ({
  skip: (query.page - 1) * query.limit,
  take: query.limit,
});

const paginated = <T,>(items: T[], total: number, query: { page: number; limit: number }): PaginatedResult<T> => ({
  items,
  meta: {
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  },
});

const startOfLocalDay = (value = new Date()) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const endOfLocalDay = (value = new Date()) => new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);

const parseTime = (value: string) => {
  const [hours = "0", minutes = "0"] = value.split(":");
  return { hours: Number(hours), minutes: Number(minutes) };
};

const minutesFromDate = (value: Date) => value.getHours() * 60 + value.getMinutes();

const getLocalDateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

const toIsoOrNull = (value: Date | null | undefined) => (value ? value.toISOString() : null);

const userAgentInfo = (userAgent: string | undefined) => {
  const value = userAgent ?? "";
  const lower = value.toLowerCase();

  let deviceType: "desktop" | "mobile" | "tablet" = "desktop";
  if (/ipad|tablet/.test(lower)) {
    deviceType = "tablet";
  } else if (/mobi|android|iphone/.test(lower)) {
    deviceType = "mobile";
  }

  let browser = "Unknown";
  if (/edg\//.test(lower)) {
    browser = "Edge";
  } else if (/chrome\//.test(lower) && !/edg\//.test(lower)) {
    browser = "Chrome";
  } else if (/firefox\//.test(lower)) {
    browser = "Firefox";
  } else if (/safari\//.test(lower) && !/chrome\//.test(lower)) {
    browser = "Safari";
  }

  let platform = "Unknown";
  if (/windows/.test(lower)) {
    platform = "Windows";
  } else if (/mac os|macintosh/.test(lower)) {
    platform = "macOS";
  } else if (/android/.test(lower)) {
    platform = "Android";
  } else if (/iphone|ipad|ios/.test(lower)) {
    platform = "iOS";
  } else if (/linux/.test(lower)) {
    platform = "Linux";
  }

  return { browser, platform, deviceType };
};

const formatStatus = (status: AttendanceStatus, isLate: boolean) =>
  isLate && (status === AttendanceStatus.PRESENT || status === AttendanceStatus.HALF_DAY)
    ? "LATE"
    : status;

const EMPLOYEE_ATTENDANCE_ACCESS_CODES = [
  "attendance.view.team",
  "attendance.view.department",
  "attendance.view.all",
  "attendance:read:team",
  "attendance:read:department",
  "attendance:read:all",
  "employee.visibility.super_admin",
] as const;

const EXCLUDED_EMPLOYEE_TAB_ADMIN_ROLES = ["SUPER_ADMIN", "PORTAL_ADMIN", "ADMIN"] as const;

const canViewOtherEmployeeAttendance = (user: AuthenticatedUser): boolean => {
  const codes = new Set(user.permissions);
  if (EMPLOYEE_ATTENDANCE_ACCESS_CODES.some((code) => codes.has(code))) {
    return true;
  }

  const scope = resolveAttendanceScope(user);
  return scope !== "self";
};

const parseDateOrUndefined = (value: unknown): Date | undefined => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const parseStatusFilter = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized || normalized === "ALL") {
    return undefined;
  }

  if (["PRESENT", "LATE", "HALF_DAY", "ABSENT"].includes(normalized)) {
    return normalized;
  }

  return undefined;
};

const employeeTabRoleExclusionWhere: Prisma.EmployeeWhereInput = {
  OR: [
    { accountUser: null },
    {
      accountUser: {
        roles: {
          none: {
            role: {
              code: { in: [...EXCLUDED_EMPLOYEE_TAB_ADMIN_ROLES] },
              deletedAt: null,
            },
          },
        },
      },
    },
  ],
};

const applyAttendanceStatusFilter = (
  where: Prisma.AttendanceRecordWhereInput,
  status: string | undefined,
): Prisma.AttendanceRecordWhereInput => {
  if (!status) {
    return where;
  }

  return {
    AND: [
      where,
      status === "LATE"
        ? {
            OR: [{ status: AttendanceStatus.LATE }, { isLate: true }],
          }
        : {
            status: status as AttendanceStatus,
          },
    ],
  };
};

export class AttendanceController {
  attendance = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    const query = parsePagination(request);
    const view = typeof request.query.view === "string" ? request.query.view.trim().toLowerCase() : "self";
    const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
    const department = typeof request.query.department === "string" ? request.query.department.trim() : "";
    const status = parseStatusFilter(request.query.status);
    const fromDate = parseDateOrUndefined(request.query.fromDate);
    const toDate = parseDateOrUndefined(request.query.toDate);

    if ((fromDate && !toDate) || (!fromDate && toDate)) {
      throw new BadRequestError("Both fromDate and toDate are required when filtering by date range");
    }

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestError("fromDate must be before or equal to toDate");
    }

    let where: Prisma.AttendanceRecordWhereInput;
    let scopeEmployeeCount: number | undefined;

    if (view === "employees") {
      if (!canViewOtherEmployeeAttendance(user)) {
        throw new ForbiddenError("You do not have permission to view employee attendance");
      }

      const employeeConditions: Prisma.EmployeeWhereInput[] = [
        buildDirectoryVisibilityWhere(user),
        employeeTabRoleExclusionWhere,
      ];

      if (department) {
        employeeConditions.push({ department });
      }

      if (search) {
        employeeConditions.push({
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { employeeId: { contains: search, mode: "insensitive" as const } },
          ],
        });
      }

      const employeeScopeWhere: Prisma.EmployeeWhereInput = {
        AND: employeeConditions,
      };

      scopeEmployeeCount = await prisma.employee.count({
        where: {
          deletedAt: null,
          ...employeeScopeWhere,
        },
      });

      where = {
        deletedAt: null,
        ...(user.employeeId ? { employeeId: { not: user.employeeId } } : {}),
        employee: employeeScopeWhere,
      };
    } else {
      where = buildAttendanceScopeWhere(user, user.employeeId);
    }

    where = applyAttendanceStatusFilter(where, status);

    if (fromDate && toDate) {
      where = {
        AND: [
          where,
          {
            attendanceDate: {
              gte: startOfLocalDay(fromDate),
              lte: endOfLocalDay(toDate),
            },
          },
        ],
      };
    }

    const [items, total] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where,
        ...pageArgs(query),
        orderBy: { attendanceDate: "desc" },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              department: true,
              designation: true,
            },
          },
        },
      }),
      prisma.attendanceRecord.count({ where }),
    ]);

    const result = paginated(items, total, query);

    return sendSuccess(
      response,
      "Attendance records retrieved",
      {
        ...result,
        meta: {
          ...result.meta,
          ...(scopeEmployeeCount !== undefined ? { scopeEmployeeCount } : {}),
        },
      },
      HttpStatus.OK,
    );
  };

  departments = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);

    if (!canViewOtherEmployeeAttendance(user)) {
      throw new ForbiddenError("You do not have permission to view employee attendance");
    }

    const scopedEmployees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        AND: [buildDirectoryVisibilityWhere(user), employeeTabRoleExclusionWhere],
      },
      distinct: ["department"],
      orderBy: { department: "asc" },
      select: { department: true },
    });

    const departments = scopedEmployees
      .map((employee) => employee.department)
      .filter((value, index, self) => Boolean(value) && self.indexOf(value) === index);

    return sendSuccess(response, "Attendance departments retrieved", { departments }, HttpStatus.OK);
  };

  today = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);

    if (!user.employeeId) {
      throw new ForbiddenError("Employee record required");
    }

    const attendanceDate = startOfLocalDay();
    const record = await prisma.attendanceRecord.findFirst({
      where: {
        ...buildAttendanceScopeWhere(user, user.employeeId),
        attendanceDate: {
          gte: attendanceDate,
          lte: endOfLocalDay(attendanceDate),
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
            designation: true,
          },
        },
      },
      orderBy: { attendanceDate: "desc" },
    });

    if (!record) {
      return sendSuccess(response, "Today's attendance retrieved", { hasRecord: false }, HttpStatus.OK);
    }

    return sendSuccess(
      response,
      "Today's attendance retrieved",
      {
        hasRecord: true,
        checkInTime: toIsoOrNull(record.checkInAt),
        checkOutTime: toIsoOrNull(record.checkOutAt),
        status: formatStatus(record.status, record.isLate),
        workedMinutes: record.workMinutes,
        isLate: record.isLate,
        record,
      },
      HttpStatus.OK,
    );
  };

  checkIn = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    if (!user.employeeId) {
      throw new ForbiddenError("Only linked employee accounts can check in");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: user.employeeId },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        reportingManagerId: true,
        reportingManager: {
          select: {
            id: true,
            accountUser: { select: { id: true } },
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundError("Employee not found");
    }

    const attendanceDate = startOfLocalDay();
    const existing = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId: employee.id,
        attendanceDate: {
          gte: attendanceDate,
          lte: endOfLocalDay(attendanceDate),
        },
        deletedAt: null,
        checkOutAt: null,
      },
    });

    if (existing) {
      throw new ConflictError("Already checked in");
    }

    const now = new Date();
    const lateThreshold = parseTime("10:15");
    const isLate = minutesFromDate(now) > lateThreshold.hours * 60 + lateThreshold.minutes;
    const { browser, platform, deviceType } = userAgentInfo(request.get("user-agent"));

    let record: AttendanceWithEmployee;
    try {
      record = await prisma.$transaction(async (tx) => {
        const attendance = await tx.attendanceRecord.create({
          data: {
            employeeId: employee.id,
            attendanceDate,
            checkInAt: now,
            status: isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
            isLate,
            browser,
            platform,
            deviceType,
            checkInMeta: {
              ipAddress: request.ip,
              userAgent: request.get("user-agent"),
              browser,
              platform,
              deviceType,
            },
          },
          include: {
            employee: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                department: true,
                designation: true,
              },
            },
          },
        });

        if ((deviceType === "mobile" || deviceType === "tablet") && employee.reportingManager?.accountUser?.id) {
          await tx.notification.create({
            data: {
              userId: employee.reportingManager.accountUser.id,
              channel: "IN_APP",
              type: "MOBILE_CHECKIN",
              title: "Mobile check-in recorded",
              body: `${employee.firstName} ${employee.lastName} checked in from a ${deviceType} device`,
              data: {
                employeeId: employee.id,
                attendanceId: attendance.id,
                deviceType,
              },
            },
          });
        }

        return attendance;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Attendance already tracked for today.");
      }

      throw error;
    }

    return sendSuccess(response, "Check-in recorded", record, HttpStatus.CREATED);
  };

  checkOut = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    if (!user.employeeId) {
      throw new ForbiddenError("Only linked employee accounts can check out");
    }

    const attendanceDate = startOfLocalDay();
    const existing = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId: user.employeeId,
        attendanceDate: {
          gte: attendanceDate,
          lte: endOfLocalDay(attendanceDate),
        },
        deletedAt: null,
        checkOutAt: null,
      },
    });

    if (!existing || !existing.checkInAt) {
      throw new BadRequestError("Check-out requires an active check-in");
    }

    const now = new Date();
    const workedMinutes = Math.floor((now.getTime() - existing.checkInAt.getTime()) / 60000);
    const status = workedMinutes < 120 ? AttendanceStatus.ABSENT : workedMinutes < 240 ? AttendanceStatus.HALF_DAY : AttendanceStatus.PRESENT;
    const isLate = existing.isLate || minutesFromDate(existing.checkInAt) > (10 * 60 + 15);

    const record = await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        checkOutAt: now,
        workMinutes: workedMinutes,
        status,
        isLate,
        checkOutMeta: {
          ipAddress: request.ip,
          userAgent: request.get("user-agent"),
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
            designation: true,
          },
        },
      },
    });

    return sendSuccess(response, "Check-out recorded", record, HttpStatus.OK);
  };

  analytics = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    const employeeId = typeof request.query.employeeId === "string" ? request.query.employeeId : undefined;
    const startDateValue = typeof request.query.startDate === "string" ? new Date(request.query.startDate) : undefined;
    const endDateValue = typeof request.query.endDate === "string" ? new Date(request.query.endDate) : undefined;

    if (!startDateValue || !endDateValue || Number.isNaN(startDateValue.getTime()) || Number.isNaN(endDateValue.getTime())) {
      throw new BadRequestError("startDate and endDate are required");
    }

    const where: Prisma.AttendanceRecordWhereInput = {
      attendanceDate: {
        gte: startDateValue,
        lte: endDateValue,
      },
      ...buildAttendanceScopeWhere(user, employeeId),
    };

    const [statusGroups, aggregate] = await Promise.all([
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      prisma.attendanceRecord.aggregate({
        where,
        _sum: { workMinutes: true },
        _avg: { workMinutes: true },
        _count: { _all: true },
      }),
    ]);

    const presentDays = statusGroups.find((group) => group.status === AttendanceStatus.PRESENT)?._count._all ?? 0;
    const absentDays = statusGroups.find((group) => group.status === AttendanceStatus.ABSENT)?._count._all ?? 0;
    const halfDays = statusGroups.find((group) => group.status === AttendanceStatus.HALF_DAY)?._count._all ?? 0;
    const lateDays = await prisma.attendanceRecord.count({ where: { ...where, isLate: true } });

    return sendSuccess(
      response,
      "Attendance analytics retrieved",
      {
        presentDays,
        absentDays,
        halfDays,
        lateDays,
        totalWorkedMinutes: aggregate._sum?.workMinutes ?? 0,
        averageWorkedMinutes: Math.floor(aggregate._avg?.workMinutes ?? 0),
      },
      HttpStatus.OK,
    );
  };

  getRegularizations = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    const query = parsePagination(request);

    const attendanceScope = resolveAttendanceScope(user);
    const where: Prisma.ApprovalRequestWhereInput = {
      type: "REGULARIZATION",
      ...(attendanceScope === "all"
        ? {}
        : attendanceScope === "department"
          ? user.department
            ? { employee: { department: user.department } }
            : { employeeId: "__none__" }
          : attendanceScope === "team"
            ? {
                OR: [
                  ...(user.employeeId ? [{ employeeId: user.employeeId }] : []),
                  ...(user.employeeId ? [{ employee: { reportingManagerId: user.employeeId } }] : []),
                  ...(user.department ? [{ employee: { department: user.department } }] : []),
                ],
              }
            : user.employeeId
              ? { employeeId: user.employeeId }
              : { employeeId: "__none__" }),
    };

    const [items, total] = await Promise.all([
      prisma.approvalRequest.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              department: true,
              designation: true,
            },
          },
          approver: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.approvalRequest.count({ where }),
    ]);

    return sendSuccess(response, "Regularizations retrieved", paginated(items, total, query), HttpStatus.OK);
  };

  createRegularization = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    if (!user.employeeId) {
      throw new ForbiddenError("Only employees can submit regularization requests");
    }

    const body = request.body as {
      date?: string;
      reason?: string;
      checkInTime?: string;
      checkOutTime?: string;
    };

    if (!body.date) {
      throw new BadRequestError("Attendance date is required");
    }

    const attendanceDate = new Date(body.date);
    if (Number.isNaN(attendanceDate.getTime())) {
      throw new BadRequestError("Attendance date is invalid");
    }

    const today = startOfLocalDay();
    if (attendanceDate > endOfLocalDay(today)) {
      throw new BadRequestError("Attendance date cannot be in the future");
    }

    const thirtyDaysAgo = startOfLocalDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    if (attendanceDate < thirtyDaysAgo) {
      throw new BadRequestError("Attendance date must be within the last 30 days");
    }

    const attendance = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId: user.employeeId,
        attendanceDate: {
          gte: startOfLocalDay(attendanceDate),
          lte: endOfLocalDay(attendanceDate),
        },
        deletedAt: null,
      },
    });

    if (attendance && attendance.checkInAt && attendance.checkOutAt) {
      throw new BadRequestError("Attendance already has both check-in and check-out");
    }

    const hasCheckIn = Boolean(body.checkInTime);
    const hasCheckOut = Boolean(body.checkOutTime);

    if (hasCheckIn === hasCheckOut) {
      throw new BadRequestError("Either check-in or check-out must be missing, but not both");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: user.employeeId },
      select: {
        id: true,
        reportingManagerId: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!employee?.reportingManagerId) {
      throw new BadRequestError("No reporting manager assigned — contact HR");
    }

    const manager = await prisma.employee.findUnique({
      where: { id: employee.reportingManagerId },
      select: { id: true, accountUser: { select: { id: true } } },
    });

    const existingApproval = await prisma.approvalRequest.findFirst({
      where: {
        employeeId: employee.id,
        type: "REGULARIZATION",
        attendanceDate: {
          gte: startOfLocalDay(attendanceDate),
          lte: endOfLocalDay(attendanceDate),
        },
        status: "PENDING",
      },
    });

    if (existingApproval) {
      throw new ConflictError("Regularization request already exists for this date");
    }

    const approvalRequest = await prisma.approvalRequest.create({
      data: {
        employeeId: employee.id,
        approverId: employee.reportingManagerId,
        type: "REGULARIZATION",
        status: "PENDING",
        attendanceDate: startOfLocalDay(attendanceDate),
        checkInTime: hasCheckIn ? new Date(body.checkInTime as string) : null,
        checkOutTime: hasCheckOut ? new Date(body.checkOutTime as string) : null,
        reason: "Attendance regularization",
        metadata: {
          requestedAt: new Date().toISOString(),
          employeeName: `${employee.firstName} ${employee.lastName}`,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
            designation: true,
          },
        },
        approver: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (manager?.accountUser?.id) {
      await prisma.notification.create({
        data: {
          userId: manager.accountUser.id,
          channel: "IN_APP",
          type: "REGULARIZATION",
          title: "Attendance regularization requested",
          body: `${employee.firstName} ${employee.lastName} requested attendance regularization`,
          data: { approvalRequestId: approvalRequest.id },
        },
      });
    }

    return sendSuccess(response, "Regularization request submitted", approvalRequest, HttpStatus.CREATED);
  };

  reviewRegularization = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    const id = requireParam(request.params.id, "Regularization id");
    const body = request.body as { status?: string; remarks?: string };

    if (!body.status || !["APPROVED", "REJECTED"].includes(body.status)) {
      throw new BadRequestError("Status must be APPROVED or REJECTED");
    }

    const reviewStatus = body.status;

    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!approval || approval.type !== "REGULARIZATION") {
      throw new NotFoundError("Regularization request not found");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.approvalRequest.update({
        where: { id },
        data: {
          status: reviewStatus,
          remarks: body.remarks ?? null,
          approverId: user.employeeId ?? null,
        },
      });

      if (reviewStatus === "APPROVED") {
        const attendanceDate = approval.attendanceDate ?? startOfLocalDay();
        const checkInTime = approval.checkInTime ?? null;
        const checkOutTime = approval.checkOutTime ?? null;
        const workedMinutes = checkInTime && checkOutTime
          ? Math.max(0, Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 60000))
          : 0;
        const status = workedMinutes < 120 ? AttendanceStatus.ABSENT : workedMinutes < 240 ? AttendanceStatus.HALF_DAY : AttendanceStatus.PRESENT;
        const isLate = checkInTime ? minutesFromDate(checkInTime) > (10 * 60 + 15) : false;

        await tx.attendanceRecord.upsert({
          where: {
            employeeId_attendanceDate: {
              employeeId: approval.employeeId,
              attendanceDate,
            },
          },
          create: {
            employeeId: approval.employeeId,
            attendanceDate,
            checkInAt: checkInTime,
            checkOutAt: checkOutTime,
            workMinutes: workedMinutes,
            status,
            isLate,
          },
          update: {
            checkInAt: checkInTime,
            checkOutAt: checkOutTime,
            workMinutes: workedMinutes,
            status,
            isLate,
          },
        });
      }

      return record;
    });

    return sendSuccess(response, `Regularization ${reviewStatus.toLowerCase()}`, updated, HttpStatus.OK);
  };
}