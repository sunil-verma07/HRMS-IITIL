import type { Request, Response } from "express";
import {
  AttendanceStatus,
  EmployeeStatus,
  EmploymentType,
  LeaveRequestStatus,
  type Prisma,
} from "@prisma/client";
import {
  paginationSchema,
  type PaginationQuery,
} from "../../common/utils/pagination";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import { sendSuccess } from "../../common/http/api-response";
import { HttpStatus } from "../../common/http/status-codes";
import { interpolateTemplate, sanitizeHtml } from "../../common/utils/html";
import { prisma } from "../../database/prisma";
import type { AuthenticatedUser } from "../../types/authenticated-user";
import { buildAttendanceScopeWhere, resolveAttendanceScope } from "../attendance/attendance-scope.policy";
import {
  buildDirectoryVisibilityWhere,
  buildEmployeeSearchWhere,
  buildUserManagementVisibilityWhere,
  publicEmployeeSelect,
  userManagementEmployeeSelect,
} from "../employees/employee-visibility.policy";
import type {
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from "../employees/employee-management.validation";

type PaginatedData<T> = {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

function parsePagination(request: Request): PaginationQuery {
  return paginationSchema.parse(request.query);
}

function paginated<T>(
  items: T[],
  total: number,
  query: PaginationQuery,
): PaginatedData<T> {
  return {
    items,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

function pageArgs(query: PaginationQuery): { skip: number; take: number } {
  return {
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  };
}

function currentUser(request: Request): AuthenticatedUser {
  return request.user as AuthenticatedUser;
}

function requireParam(value: string | undefined, label: string): string {
  if (!value) {
    throw new BadRequestError(`${label} is required`);
  }

  return value;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseTime(value: string): { hours: number; minutes: number } {
  const [hours = "0", minutes = "0"] = value.split(":");
  return {
    hours: Number(hours),
    minutes: Number(minutes),
  };
}

function minutesSinceMidnight(value: Date): number {
  return value.getHours() * 60 + value.getMinutes();
}

function attendanceStatusWithGrace(
  checkInTime: Date,
  setting?: { officeStart: string; graceMinutes: number } | null,
): AttendanceStatus {
  if (!setting) {
    return AttendanceStatus.PRESENT;
  }

  const officeStart = parseTime(setting.officeStart);
  // Add 15-minute buffer after grace period
  const lateThreshold =
    officeStart.hours * 60 + officeStart.minutes + setting.graceMinutes + 15;
  const checkInMinutes = minutesSinceMidnight(checkInTime);

  return checkInMinutes > lateThreshold
    ? AttendanceStatus.LATE
    : AttendanceStatus.PRESENT;
}

function employeeDropdownWhere(request: Request): Prisma.EmployeeWhereInput {
  const department =
    typeof request.query.department === "string"
      ? request.query.department
      : undefined;
  const status =
    typeof request.query.status === "string" ? request.query.status : undefined;
  const employmentType =
    typeof request.query.employmentType === "string"
      ? request.query.employmentType
      : undefined;
  const role =
    typeof request.query.role === "string" ? request.query.role : undefined;
  const where: Prisma.EmployeeWhereInput = {};

  if (department) where.department = department;

  if (
    status &&
    Object.values(EmployeeStatus).includes(status as EmployeeStatus)
  ) {
    where.status = status as EmployeeStatus;
  }

  if (
    employmentType &&
    Object.values(EmploymentType).includes(employmentType as EmploymentType)
  ) {
    where.employmentType = employmentType as EmploymentType;
  }

  if (role) {
    where.user = {
      roles: {
        some: {
          role: { code: role, deletedAt: null },
        },
      },
    };
  }

  return where;
}

function calculateWorkHoursStatus(
  checkInAt: Date,
  checkOutAt: Date,
  setting?: { officeStart: string; officeEnd: string } | null,
): { workMinutes: number; status: AttendanceStatus } {
  const workMinutes = Math.max(
    0,
    Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60000),
  );

  if (workMinutes < 240) {
    return { workMinutes, status: AttendanceStatus.HALF_DAY };
  }

  return { workMinutes, status: AttendanceStatus.PRESENT };
}

export class PortalReadController {
  private readonly generateEmployeeId = async (
    tx: Prisma.TransactionClient,
  ): Promise<string> => {
    const latest = await tx.employee.findFirst({
      where: {
        employeeId: {
          startsWith: "IITIL",
        },
      },
      orderBy: { employeeId: "desc" },
      select: { employeeId: true },
    });
    const match = latest?.employeeId.match(/^IITIL(\d+)$/);
    const next = match ? Number(match[1]) + 1 : 1;

    return `IITIL${String(next).padStart(4, "0")}`;
  };

  employeeDirectory = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = parsePagination(request);
    const where = {
      deletedAt: null,
      AND: [
        buildDirectoryVisibilityWhere(currentUser(request)),
        buildEmployeeSearchWhere(query.search),
        employeeDropdownWhere(request),
      ],
    } satisfies Prisma.EmployeeWhereInput;

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
        select: publicEmployeeSelect,
      }),
      prisma.employee.count({ where }),
    ]);

    return sendSuccess(
      response,
      "Employee directory retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  userManagementEmployees = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = parsePagination(request);
    const where = {
      deletedAt: null,
      AND: [
        buildUserManagementVisibilityWhere(currentUser(request)),
        buildEmployeeSearchWhere(query.search),
        employeeDropdownWhere(request),
      ],
    } satisfies Prisma.EmployeeWhereInput;

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
        select: userManagementEmployeeSelect,
      }),
      prisma.employee.count({ where }),
    ]);

    return sendSuccess(
      response,
      "User management employees retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  employeeOptions = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = parsePagination(request);
    const visibility = buildUserManagementVisibilityWhere(currentUser(request));
    const search = query.search;
    const employeeWhere = {
      deletedAt: null,
      AND: [visibility, buildEmployeeSearchWhere(search)],
    } satisfies Prisma.EmployeeWhereInput;

    const [employees, departments, designations] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere,
        take: Math.min(query.limit, 50),
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          designation: true,
          department: true,
        },
      }),
      prisma.employee.findMany({
        where: { deletedAt: null },
        distinct: ["department"],
        orderBy: { department: "asc" },
        select: { department: true },
      }),
      prisma.employee.findMany({
        where: { deletedAt: null },
        distinct: ["designation"],
        orderBy: { designation: "asc" },
        select: { designation: true },
      }),
    ]);

    return sendSuccess(
      response,
      "Employee form options retrieved",
      {
        employees,
        departments: departments.map((item) => item.department),
        designations: designations.map((item) => item.designation),
      },
      HttpStatus.OK,
    );
  };

  createEmployee = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const input = request.body as CreateEmployeeDto;
    const employee = await prisma.$transaction(async (tx) => {
      const employeeId =
        input.employeeId ?? (await this.generateEmployeeId(tx));
      const existing = await tx.employee.findFirst({
        where: {
          OR: [{ employeeId }, { email: input.email }],
          deletedAt: null,
        },
        select: { employeeId: true, email: true },
      });

      if (existing) {
        throw new ConflictError(
          existing.email === input.email
            ? "Employee email already exists"
            : "Employee ID already exists",
        );
      }

      return tx.employee.create({
        data: {
          employeeId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          designation: input.designation,
          department: input.department,
          joiningDate: input.joiningDate,
          employmentType: input.employmentType,
          status: input.status,
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.reportingManagerId
            ? { reportingManagerId: input.reportingManagerId }
            : {}),
        },
        select: userManagementEmployeeSelect,
      });
    });

    return sendSuccess(
      response,
      "Employee created",
      employee,
      HttpStatus.CREATED,
    );
  };

  updateEmployee = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const id = request.params.id as string;
    const input = request.body as UpdateEmployeeDto;
    const visibility = buildUserManagementVisibilityWhere(currentUser(request));
    const existing = await prisma.employee.findFirst({
      where: {
        id,
        deletedAt: null,
        AND: [visibility],
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError("Employee not found or not visible");
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...(input.employeeId ? { employeeId: input.employeeId } : {}),
        ...(input.firstName ? { firstName: input.firstName } : {}),
        ...(input.lastName ? { lastName: input.lastName } : {}),
        ...(input.email ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.designation ? { designation: input.designation } : {}),
        ...(input.department ? { department: input.department } : {}),
        ...(input.joiningDate ? { joiningDate: input.joiningDate } : {}),
        ...(input.employmentType
          ? { employmentType: input.employmentType }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.reportingManagerId !== undefined
          ? { reportingManagerId: input.reportingManagerId }
          : {}),
      },
      select: userManagementEmployeeSelect,
    });

    return sendSuccess(response, "Employee updated", employee, HttpStatus.OK);
  };

  deleteEmployee = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const id = request.params.id as string;
    const visibility = buildUserManagementVisibilityWhere(currentUser(request));
    const existing = await prisma.employee.findFirst({
      where: {
        id,
        deletedAt: null,
        AND: [visibility],
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError("Employee not found or not visible");
    }

    await prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });

    return sendSuccess(response, "Employee deleted", null, HttpStatus.OK);
  };

  employeeDirectoryProfile = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const employeeId = request.params.id as string;
    const where = {
      id: employeeId,
      deletedAt: null,
      AND: [buildDirectoryVisibilityWhere(currentUser(request))],
    } satisfies Prisma.EmployeeWhereInput;

    const employee = await prisma.employee.findFirst({
      where,
      select: publicEmployeeSelect,
    });

    return sendSuccess(
      response,
      "Employee public profile retrieved",
      employee,
      HttpStatus.OK,
    );
  };

  attendance = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = parsePagination(request);
    const user = currentUser(request);
    const where = buildAttendanceScopeWhere(user);

    const [items, total] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where,
        ...pageArgs(query),
        orderBy: { attendanceDate: "desc" },
        include: {
          employee: {
            select: {
              employeeId: true,
              firstName: true,
              lastName: true,
              department: true,
            },
          },
        },
      }),
      prisma.attendanceRecord.count({ where }),
    ]);

    return sendSuccess(
      response,
      "Attendance records retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  checkIn = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);

    if (!user.employeeId) {
      throw new ForbiddenError("Only linked employee accounts can check in");
    }

    const now = new Date();
    const attendanceDate = startOfToday();

    const setting = await prisma.attendanceSetting.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { officeStart: true, graceMinutes: true, officeEnd: true },
    });

    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: user.employeeId,
          attendanceDate,
        },
      },
    });

    if (existing?.checkInAt && !existing.deletedAt) {
      throw new ConflictError("Employee is already checked in for today");
    }

    const meta = {
      deviceInfo: request.body.deviceInfo ?? null,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null,
    };

    const attendance = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_attendanceDate: {
          employeeId: user.employeeId,
          attendanceDate,
        },
      },
      create: {
        employeeId: user.employeeId,
        attendanceDate,
        checkInAt: now,
        status: attendanceStatusWithGrace(now, setting),
        checkInMeta: meta,
      },
      update: {
        deletedAt: null,
        checkInAt: now,
        status: attendanceStatusWithGrace(now, setting),
        checkInMeta: meta,
      },
      include: {
        employee: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
          },
        },
      },
    });

    return sendSuccess(
      response,
      "Check-in recorded",
      attendance,
      HttpStatus.CREATED,
    );
  };

  checkOut = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const user = currentUser(request);

    if (!user.employeeId) {
      throw new ForbiddenError("Only linked employee accounts can check out");
    }

    const attendanceDate = startOfToday();
    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: user.employeeId,
          attendanceDate,
        },
      },
    });

    if (!existing?.checkInAt || existing.deletedAt) {
      throw new BadRequestError(
        "Check-out requires an active check-in for today",
      );
    }

    if (existing.checkOutAt) {
      throw new ConflictError("Employee is already checked out for today");
    }

    const now = new Date();
    const setting = await prisma.attendanceSetting.findFirst({
      where: { isActive: true, deletedAt: null },
      select: { officeStart: true, officeEnd: true },
    });

    const { workMinutes, status } = calculateWorkHoursStatus(
      existing.checkInAt,
      now,
      setting,
    );

    const attendance = await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        checkOutAt: now,
        workMinutes,
        status,
        checkOutMeta: {
          deviceInfo: request.body.deviceInfo ?? null,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        },
      },
      include: {
        employee: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
          },
        },
      },
    });

    return sendSuccess(
      response,
      "Check-out recorded",
      attendance,
      HttpStatus.OK,
    );
  };

  // Regularization endpoints
  createRegularization = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const user = currentUser(request);

    if (!user.employeeId) {
      throw new ForbiddenError(
        "Only employees can submit regularization requests",
      );
    }

    const employeeId = user.employeeId;

    const { date, reason, requestedCheckIn, requestedCheckOut } = request.body;

    if (!date || !reason) {
      throw new BadRequestError("Date and reason are required");
    }

    // Check monthly limit
    const settings = await prisma.appConfig.findUnique({
      where: { key: "attendance.regularization.limit" },
    });
    const monthlyLimit = (settings?.value as number) ?? 5;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyCount = await prisma.attendanceRegularization.count({
      where: {
        employeeId,
        createdAt: { gte: startOfMonth },
        status: { in: ["PENDING", "APPROVED"] },
      },
    });

    if (monthlyCount >= monthlyLimit) {
      throw new BadRequestError(
        `You have reached the monthly limit of ${monthlyLimit} regularization requests`,
      );
    }

    const regularization = await prisma.$transaction(async (tx) => {
      const record = await tx.attendanceRegularization.create({
        data: {
          employeeId,
          attendanceDate: new Date(date),
          requestedCheckIn: requestedCheckIn
            ? new Date(requestedCheckIn)
            : null,
          requestedCheckOut: requestedCheckOut
            ? new Date(requestedCheckOut)
            : null,
          reason,
          status: "PENDING",
        },
        include: {
          employee: {
            select: {
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              reportingManager: {
                select: {
                  id: true,
                  userId: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // Create notification for reporting manager
      if (record.employee.reportingManager) {
        const reportingManagerUserId = record.employee.reportingManager.userId;
        if (!reportingManagerUserId) {
          throw new BadRequestError("Reporting manager account is not linked");
        }

        await tx.notification.create({
          data: {
            userId: reportingManagerUserId,
            channel: "IN_APP",
            title: "Attendance Regularization Request",
            body: `${record.employee.firstName} ${record.employee.lastName} has requested attendance regularization for ${new Date(date).toLocaleDateString()}`,
            data: { regularizationId: record.id, type: "regularization" },
          },
        });
      }

      return record;
    });

    return sendSuccess(
      response,
      "Regularization request submitted",
      regularization,
      HttpStatus.CREATED,
    );
  };

  getRegularizations = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const user = currentUser(request);
    const query = parsePagination(request);
    const attendanceScope = resolveAttendanceScope(user);
    const where: Prisma.AttendanceRegularizationWhereInput = {
      deletedAt: null,
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
      prisma.attendanceRegularization.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
        include: {
          employee: {
            select: {
              employeeId: true,
              firstName: true,
              lastName: true,
              department: true,
            },
          },
          reviewedBy: {
            select: { firstName: true, lastName: true },
          },
        },
      }),
      prisma.attendanceRegularization.count({ where }),
    ]);

    return sendSuccess(
      response,
      "Regularizations retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  reviewRegularization = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const user = currentUser(request);
    const id = requireParam(request.params.id, "Regularization id");
    const { status, remarks } = request.body;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      throw new BadRequestError("Status must be APPROVED or REJECTED");
    }

    const regularization = await prisma.$transaction(async (tx) => {
      const record = await tx.attendanceRegularization.update({
        where: { id },
        data: {
          status,
          remarks: remarks || null,
          reviewedById: user.employeeId ?? null,
          reviewedAt: new Date(),
        },
        include: {
          employee: {
            include: {
              user: { select: { id: true } },
            },
          },
        },
      });

      // If approved, update or create attendance record
      if (status === "APPROVED" && record.requestedCheckIn) {
        const attendanceDate = new Date(record.attendanceDate);
        attendanceDate.setHours(0, 0, 0, 0);

        const checkInAt = record.requestedCheckIn;
        const checkOutAt = record.requestedCheckOut;

        const workMinutes =
          checkInAt && checkOutAt
            ? Math.max(
                0,
                Math.floor(
                  (checkOutAt.getTime() - checkInAt.getTime()) / 60000,
                ),
              )
            : 0;

        const setting = await tx.attendanceSetting.findFirst({
          where: { isActive: true },
        });

        const status_attendance =
          workMinutes < 240
            ? AttendanceStatus.HALF_DAY
            : AttendanceStatus.PRESENT;

        await tx.attendanceRecord.upsert({
          where: {
            employeeId_attendanceDate: {
              employeeId: record.employeeId,
              attendanceDate,
            },
          },
          update: {
            checkInAt,
            checkOutAt,
            workMinutes,
            status: status_attendance,
          },
          create: {
            employeeId: record.employeeId,
            attendanceDate,
            checkInAt,
            checkOutAt,
            workMinutes,
            status: status_attendance,
          },
        });
      }

      // Notify employee
      await tx.notification.create({
        data: {
          userId: record.employee.user?.id || "",
          channel: "IN_APP",
          title: `Regularization Request ${status === "APPROVED" ? "Approved" : "Rejected"}`,
          body: `Your attendance regularization request for ${record.attendanceDate.toLocaleDateString()} has been ${status.toLowerCase()}${remarks ? `: ${remarks}` : ""}`,
          data: { regularizationId: record.id },
        },
      });

      return record;
    });

    return sendSuccess(
      response,
      `Regularization ${status.toLowerCase()}`,
      regularization,
      HttpStatus.OK,
    );
  };

  leaves = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const user = currentUser(request);

    // Build where clause based on user role
    let where: Prisma.LeaveRequestWhereInput = {
      deletedAt: null,
    };

    // Super Admin, Portal Admin, Admin can see ALL leaves
    if (
      user.roles.includes("SUPER_ADMIN") ||
      user.roles.includes("PORTAL_ADMIN") ||
      user.roles.includes("ADMIN")
    ) {
      where = { deletedAt: null };
    }
    // HR roles can see ALL leaves
    else if (
      user.roles.some((r) => ["HR_MANAGER", "HR_EXECUTIVE", "HR"].includes(r))
    ) {
      where = { deletedAt: null };
    }
    // Team Lead can see their team's leaves + their own
    else if (user.roles.includes("TEAM_LEAD") && user.employeeId) {
      where = {
        deletedAt: null,
        OR: [
          { employeeId: user.employeeId }, // Their own leaves
          { employee: { reportingManagerId: user.employeeId } }, // Their team's leaves
        ],
      };
    }
    // Regular employees see only their own leaves
    else if (user.employeeId) {
      where = {
        deletedAt: null,
        employeeId: user.employeeId,
      };
    }

    const [items, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
        include: {
          employee: {
            select: {
              employeeId: true,
              firstName: true,
              lastName: true,
              department: true,
              reportingManager: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          leaveType: {
            select: { code: true, name: true, annualQuota: true },
          },
          approvals: {
            include: {
              approver: {
                select: { firstName: true, lastName: true, designation: true },
              },
            },
          },
        },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return sendSuccess(
      response,
      "Leave requests retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  leaveBalances = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const user = currentUser(request);

    if (!user.employeeId) {
      throw new ForbiddenError("Employee record required");
    }

    const currentYear = new Date().getFullYear();

    const balances = await prisma.leaveBalance.findMany({
      where: {
        employeeId: user.employeeId,
        year: currentYear,
      },
      include: {
        leaveType: true,
      },
    });

    return sendSuccess(
      response,
      "Leave balances retrieved",
      balances,
      HttpStatus.OK,
    );
  };

  createLeaveRequest = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const user = currentUser(request);

    if (!user.employeeId) {
      throw new ForbiddenError("Only employees can apply for leave");
    }

    const employeeId = user.employeeId;

    const { leaveTypeId, startDate, endDate, reason } = request.body;

    if (!leaveTypeId || !startDate || !endDate) {
      throw new BadRequestError(
        "Leave type, start date, and end date are required",
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new BadRequestError("Start date must be before end date");
    }

    // Calculate days (excluding weekends - simplified)
    const days =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leaveRequest = await prisma.$transaction(async (tx) => {
      // Check balance
      const currentYear = new Date().getFullYear();
      const balance = await tx.leaveBalance.findFirst({
        where: {
          employeeId,
          leaveTypeId,
          year: currentYear,
        },
      });

      if (balance && Number(balance.used) + days > Number(balance.allocated)) {
        throw new BadRequestError("Insufficient leave balance");
      }

      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        include: {
          reportingManager: {
            include: {
              user: { select: { id: true } },
            },
          },
          user: { select: { id: true } },
        },
      });

      const isReportingManagerLeave =
        employee?.reportingManagerId === user.employeeId;

      // Determine initial status
      let status: LeaveRequestStatus;
      const approvalsData: Array<{
        approverId: string;
        level: number;
        decision: string;
      }> = [];

      if (
        user.roles.includes("SUPER_ADMIN") ||
        user.roles.includes("PORTAL_ADMIN")
      ) {
        status = "APPROVED";
      } else if (user.roles.includes("ADMIN")) {
        status = "APPROVED";
      } else if (isReportingManagerLeave) {
        status = "PENDING_HR";
        // Find Portal Admin to approve
        const portalAdmin = await tx.user.findFirst({
          where: {
            roles: { some: { role: { code: "PORTAL_ADMIN" } } },
            employee: { isNot: null },
          },
          include: { employee: true },
        });
        if (portalAdmin?.employee) {
          approvalsData.push({
            approverId: portalAdmin.employee.id,
            level: 1,
            decision: "PENDING",
          });
        }
      } else {
        status = "PENDING_TEAM_LEAD";
        if (employee?.reportingManagerId) {
          approvalsData.push({
            approverId: employee.reportingManagerId,
            level: 1,
            decision: "PENDING",
          });
        }
      }

      const request_record = await tx.leaveRequest.create({
        data: {
          employeeId,
          leaveTypeId,
          startDate: start,
          endDate: end,
          days,
          reason: reason || null,
          status,
          approvals: {
            create: approvalsData,
          },
        },
        include: {
          employee: {
            include: {
              reportingManager: {
                include: {
                  user: { select: { id: true } },
                },
              },
              user: { select: { id: true } },
            },
          },
          leaveType: true,
        },
      });

      // Create notifications
      if (status === "PENDING_TEAM_LEAD" && employee?.reportingManager) {
        const reportingManagerUserId = employee.reportingManager.user?.id;
        if (!reportingManagerUserId) {
          throw new BadRequestError("Reporting manager account is not linked");
        }

        await tx.notification.create({
          data: {
            userId: reportingManagerUserId,
            channel: "IN_APP",
            title: "Leave Request Pending Approval",
            body: `${employee.firstName} ${employee.lastName} has requested ${days} day(s) of leave`,
            data: { leaveRequestId: request_record.id },
          },
        });
      } else if (status === "PENDING_HR") {
        const hrUsers = await tx.user.findMany({
          where: {
            roles: {
              some: {
                role: { code: { in: ["HR_MANAGER", "HR_EXECUTIVE", "HR"] } },
              },
            },
          },
          select: { id: true },
        });

        for (const hrUser of hrUsers) {
          await tx.notification.create({
            data: {
              userId: hrUser.id,
              channel: "IN_APP",
              title: "Leave Request Pending HR Approval",
              body: `${employee?.firstName} ${employee?.lastName} has requested ${days} day(s) of leave`,
              data: { leaveRequestId: request_record.id },
            },
          });
        }
      }

      return request_record;
    });

    return sendSuccess(
      response,
      "Leave request submitted",
      leaveRequest,
      HttpStatus.CREATED,
    );
  };

  reviewLeaveRequest = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const user = currentUser(request);
    const id = requireParam(request.params.id, "Leave request id");
    const { decision, remarks } = request.body;

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      throw new BadRequestError("Decision must be APPROVED or REJECTED");
    }

    const leaveRequest = await prisma.$transaction(async (tx) => {
      const request_record = await tx.leaveRequest.findUnique({
        where: { id },
        include: {
          employee: {
            include: { user: { select: { id: true } } },
          },
          approvals: true,
        },
      });

      if (!request_record) {
        throw new NotFoundError("Leave request not found");
      }

      // Update approval
      const pendingApproval = request_record.approvals.find(
        (a) => a.decision === "PENDING",
      );
      if (pendingApproval) {
        await tx.leaveApproval.update({
          where: { id: pendingApproval.id },
          data: {
            decision,
            remarks: remarks || null,
            decidedAt: new Date(),
          },
        });
      }

      let newStatus = request_record.status;

      if (decision === "REJECTED") {
        newStatus = "REJECTED";
      } else if (decision === "APPROVED") {
        // Check if there are more approvals needed
        const remainingApprovals = await tx.leaveApproval.findMany({
          where: {
            leaveRequestId: id,
            decision: "PENDING",
          },
        });

        if (remainingApprovals.length === 0) {
          newStatus = "APPROVED";

          // Update leave balance
          const currentYear = new Date().getFullYear();
          await tx.leaveBalance.updateMany({
            where: {
              employeeId: request_record.employeeId,
              leaveTypeId: request_record.leaveTypeId,
              year: currentYear,
            },
            data: {
              used: { increment: request_record.days },
            },
          });
        }
      }

      const updated = await tx.leaveRequest.update({
        where: { id },
        data: { status: newStatus as LeaveRequestStatus },
        include: { leaveType: true },
      });

      // Notify employee
      const employeeUserId = request_record.employee.user?.id;
      if (!employeeUserId) {
        throw new BadRequestError("Employee account is not linked");
      }

      await tx.notification.create({
        data: {
          userId: employeeUserId,
          channel: "IN_APP",
          title: `Leave Request ${decision === "APPROVED" ? "Approved" : "Rejected"}`,
          body: `Your leave request from ${request_record.startDate.toLocaleDateString()} to ${request_record.endDate.toLocaleDateString()} has been ${decision.toLowerCase()}${remarks ? `: ${remarks}` : ""}`,
          data: { leaveRequestId: id },
        },
      });

      return updated;
    });

    return sendSuccess(
      response,
      `Leave request ${decision.toLowerCase()}`,
      leaveRequest,
      HttpStatus.OK,
    );
  };

  leaveCalendar = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const { year, month } = request.query;
    const currentYear = year
      ? parseInt(year as string)
      : new Date().getFullYear();
    const currentMonth = month
      ? parseInt(month as string)
      : new Date().getMonth();

    const startDate = new Date(currentYear, currentMonth, 1);
    const endDate = new Date(currentYear, currentMonth + 1, 0);

    const events = await prisma.leaveCalendarEvent.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: "asc" },
    });

    return sendSuccess(
      response,
      "Calendar events retrieved",
      events,
      HttpStatus.OK,
    );
  };

  createCalendarEvent = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const user = currentUser(request);
    const { title, date, type, description } = request.body;

    if (!title || !date || !type) {
      throw new BadRequestError("Title, date, and type are required");
    }

    if (!user.employeeId) {
      throw new BadRequestError("Employee record required");
    }

    const event = await prisma.leaveCalendarEvent.create({
      data: {
        title,
        date: new Date(date),
        type,
        description: description || null,
        createdById: user.employeeId,
      },
    });

    return sendSuccess(
      response,
      "Calendar event created",
      event,
      HttpStatus.CREATED,
    );
  };

  updateCalendarEvent = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const id = requireParam(request.params.id, "Calendar event id");
    const { title, date, type, description } = request.body as {
      title?: string;
      date?: string;
      type?: string;
      description?: string | null;
    };

    const existing = await prisma.leaveCalendarEvent.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError("Calendar event not found");
    }

    if (
      title === undefined &&
      date === undefined &&
      type === undefined &&
      description === undefined
    ) {
      throw new BadRequestError("At least one field must be provided");
    }

    if (date !== undefined) {
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new BadRequestError("Invalid event date");
      }
    }

    const updatedEvent = await prisma.leaveCalendarEvent.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(date !== undefined ? { date: new Date(date) } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
      },
    });

    return sendSuccess(
      response,
      "Calendar event updated",
      updatedEvent,
      HttpStatus.OK,
    );
  };

  deleteCalendarEvent = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const id = requireParam(request.params.id, "Calendar event id");

    await prisma.leaveCalendarEvent.delete({ where: { id } });

    return sendSuccess(response, "Calendar event deleted", null, HttpStatus.OK);
  };

  leaveTypes = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const leaveTypes = await prisma.leaveType.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
    });

    return sendSuccess(
      response,
      "Leave types retrieved",
      leaveTypes,
      HttpStatus.OK,
    );
  };

  createLeaveType = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const { name, code, annualQuota, isPaid } = request.body;

    if (!name || !code || annualQuota === undefined) {
      throw new BadRequestError("Name, code, and annual quota are required");
    }

    const leaveType = await prisma.leaveType.create({
      data: {
        name,
        code: code.toUpperCase(),
        annualQuota,
        isPaid: isPaid !== undefined ? isPaid : true,
      },
    });

    return sendSuccess(
      response,
      "Leave type created",
      leaveType,
      HttpStatus.CREATED,
    );
  };

  updateLeaveType = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const id = requireParam(request.params.id, "Leave type id");
    const { name, annualQuota, isPaid, isActive } = request.body;

    const leaveType = await prisma.leaveType.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(annualQuota !== undefined && { annualQuota }),
        ...(isPaid !== undefined && { isPaid }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return sendSuccess(
      response,
      "Leave type updated",
      leaveType,
      HttpStatus.OK,
    );
  };

  deleteLeaveType = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const id = requireParam(request.params.id, "Leave type id");

    await prisma.leaveType.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return sendSuccess(response, "Leave type deleted", null, HttpStatus.OK);
  };

  pendingApprovals = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const user = currentUser(request);
    const query = parsePagination(request);

    let where: Prisma.LeaveRequestWhereInput = {
      deletedAt: null,
      status: { in: ["PENDING_TEAM_LEAD", "PENDING_HR"] },
    };

    // For SUPER_ADMIN, PORTAL_ADMIN, ADMIN - show all pending
    if (
      user.roles.includes("SUPER_ADMIN") ||
      user.roles.includes("PORTAL_ADMIN") ||
      user.roles.includes("ADMIN")
    ) {
      where = {
        deletedAt: null,
        status: { in: ["PENDING_TEAM_LEAD", "PENDING_HR"] },
      };
    }
    // For HR roles - show all pending (they approve at HR level)
    else if (
      user.roles.some((r) => ["HR_MANAGER", "HR_EXECUTIVE", "HR"].includes(r))
    ) {
      where = {
        deletedAt: null,
        status: "PENDING_HR",
      };
    }
    // For team leads - show requests from their direct reports only
    else if (user.roles.includes("TEAM_LEAD") && user.employeeId) {
      where = {
        deletedAt: null,
        status: "PENDING_TEAM_LEAD",
        employee: {
          reportingManagerId: user.employeeId,
        },
      };
    }

    const [items, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "asc" },
        include: {
          employee: {
            select: {
              employeeId: true,
              firstName: true,
              lastName: true,
              department: true,
              designation: true,
            },
          },
          leaveType: true,
          approvals: {
            include: {
              approver: {
                select: { firstName: true, lastName: true, designation: true },
              },
            },
          },
        },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return sendSuccess(
      response,
      "Pending approvals retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  jobs = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const search = query.search;
    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              {
                department: { contains: search, mode: "insensitive" as const },
              },
              { location: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.jobPosting.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
      }),
      prisma.jobPosting.count({ where }),
    ]);

    return sendSuccess(
      response,
      "Job postings retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  interviews = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = parsePagination(request);
    const [items, total] = await Promise.all([
      prisma.interview.findMany({
        where: { deletedAt: null },
        ...pageArgs(query),
        orderBy: { scheduledAt: "desc" },
        include: {
          interviewer: {
            select: { employeeId: true, firstName: true, lastName: true },
          },
          application: {
            select: { id: true, stage: true },
          },
        },
      }),
      prisma.interview.count({ where: { deletedAt: null } }),
    ]);

    return sendSuccess(
      response,
      "Interviews retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  onboarding = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = parsePagination(request);
    const [items, total] = await Promise.all([
      prisma.onboardingWorkflow.findMany({
        where: { deletedAt: null },
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
      }),
      prisma.onboardingWorkflow.count({ where: { deletedAt: null } }),
    ]);

    return sendSuccess(
      response,
      "Onboarding workflows retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  offerLetters = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = parsePagination(request);
    const [items, total] = await Promise.all([
      prisma.offerLetter.findMany({
        where: { deletedAt: null },
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
        include: {
          template: {
            select: { id: true, name: true, key: true },
          },
        },
      }),
      prisma.offerLetter.count({ where: { deletedAt: null } }),
    ]);

    return sendSuccess(
      response,
      "Offer letters retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  generateOfferLetter = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const templateId =
      typeof request.body.templateId === "string"
        ? request.body.templateId
        : undefined;
    const variables =
      request.body.variables && typeof request.body.variables === "object"
        ? (request.body.variables as Record<string, unknown>)
        : {};

    if (!templateId) {
      throw new BadRequestError("Template is required");
    }

    const template = await prisma.template.findFirst({
      where: { id: templateId, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundError("Template not found");
    }

    const finalHtml = sanitizeHtml(
      interpolateTemplate(template.htmlContent, variables),
    );
    const finalCss = template.cssContent
      ? sanitizeHtml(template.cssContent)
      : "";
    const offer = await prisma.offerLetter.create({
      data: {
        templateId,
        variables: variables as Prisma.InputJsonValue,
        generatedUrl: "pending",
        ...(typeof request.body.employeeId === "string"
          ? { employeeId: request.body.employeeId }
          : {}),
        ...(typeof request.body.candidateId === "string"
          ? { candidateId: request.body.candidateId }
          : {}),
      },
      include: {
        template: {
          select: { id: true, name: true, key: true },
        },
      },
    });
    const generatedUrl = `/api/v1/offer-letters/${offer.id}/download`;
    const updated = await prisma.offerLetter.update({
      where: { id: offer.id },
      data: { generatedUrl },
      include: {
        template: {
          select: { id: true, name: true, key: true },
        },
      },
    });

    return sendSuccess(
      response,
      "Offer letter generated",
      {
        ...updated,
        generatedHtml: `<style>${finalCss}</style>${finalHtml}`,
      },
      HttpStatus.CREATED,
    );
  };

  downloadOfferLetter = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    const id = request.params.id;
    if (!id) {
      throw new BadRequestError("Offer letter id is required");
    }

    const offer = await prisma.offerLetter.findFirst({
      where: { id, deletedAt: null },
    });

    if (!offer) {
      throw new NotFoundError("Offer letter not found");
    }

    const template = await prisma.template.findUnique({
      where: { id: offer.templateId },
    });

    if (!template) {
      throw new NotFoundError("Offer template not found");
    }

    const variables =
      offer.variables && typeof offer.variables === "object"
        ? (offer.variables as Record<string, unknown>)
        : {};
    const html = sanitizeHtml(
      interpolateTemplate(template.htmlContent, variables),
    );
    const css = template.cssContent ? sanitizeHtml(template.cssContent) : "";
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="offer-${offer.id}.html"`,
    );
    response.send(
      `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`,
    );
  };

  templates = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = parsePagination(request);
    const search = query.search;
    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { key: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.template.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          key: true,
          htmlContent: true,
          cssContent: true,
          previewImage: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.template.count({ where }),
    ]);

    return sendSuccess(
      response,
      "Templates retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  createTemplate = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const name =
      typeof request.body.name === "string" ? request.body.name.trim() : "";
    const key =
      typeof request.body.key === "string" ? request.body.key.trim() : "";
    const htmlContent =
      typeof request.body.htmlContent === "string"
        ? sanitizeHtml(request.body.htmlContent)
        : "";
    const cssContent =
      typeof request.body.cssContent === "string"
        ? sanitizeHtml(request.body.cssContent)
        : undefined;

    if (!name || !key || !htmlContent) {
      throw new BadRequestError(
        "Template name, key, and HTML content are required",
      );
    }

    const existing = await prisma.template.findFirst({
      where: { key, deletedAt: null },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictError("Template key already exists");
    }

    const template = await prisma.template.create({
      data: {
        name,
        key,
        htmlContent,
        ...(cssContent ? { cssContent } : {}),
      },
    });

    return sendSuccess(
      response,
      "Template created",
      template,
      HttpStatus.CREATED,
    );
  };

  updateTemplate = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const id = request.params.id;
    if (!id) {
      throw new BadRequestError("Template id is required");
    }

    const existing = await prisma.template.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError("Template not found");
    }

    const template = await prisma.template.update({
      where: { id },
      data: {
        ...(typeof request.body.name === "string"
          ? { name: request.body.name.trim() }
          : {}),
        ...(typeof request.body.key === "string"
          ? { key: request.body.key.trim() }
          : {}),
        ...(typeof request.body.htmlContent === "string"
          ? { htmlContent: sanitizeHtml(request.body.htmlContent) }
          : {}),
        ...(typeof request.body.cssContent === "string"
          ? { cssContent: sanitizeHtml(request.body.cssContent) }
          : {}),
      },
    });

    return sendSuccess(response, "Template updated", template, HttpStatus.OK);
  };

  notifications = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = parsePagination(request);
    const userId = request.user?.id;
    const where = userId ? { userId } : {};
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where }),
    ]);

    return sendSuccess(
      response,
      "Notifications retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  activityLogs = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = parsePagination(request);
    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
      }),
      prisma.activityLog.count(),
    ]);

    return sendSuccess(
      response,
      "Activity logs retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  auditLogs = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = parsePagination(request);
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count(),
    ]);

    return sendSuccess(
      response,
      "Audit logs retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  getSettings = async (
    _request: Request,
    response: Response,
  ): Promise<Response> => {
    const [attendanceSetting, leaveTypes, regularizationLimit] =
      await Promise.all([
        prisma.attendanceSetting.findFirst({
          where: { isActive: true, deletedAt: null },
        }),
        prisma.leaveType.findMany({
          where: { deletedAt: null, isActive: true },
        }),
        prisma.appConfig.findUnique({
          where: { key: "attendance.regularization.limit" },
        }),
      ]);

    return sendSuccess(
      response,
      "Settings retrieved",
      {
        attendanceSetting,
        leaveTypes,
        regularizationLimit: (regularizationLimit?.value as number) ?? 5,
      },
      HttpStatus.OK,
    );
  };

  updateSettings = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const body = request.body as {
      officeStart?: string;
      officeEnd?: string;
      graceMinutes?: number;
      workingDays?: string[];
      regularizationLimit?: number;
    };

    const [existingAttendance] = await Promise.all([
      prisma.attendanceSetting.findFirst({
        where: { isActive: true, deletedAt: null },
      }),
    ]);

    const updatedAttendance = existingAttendance
      ? await prisma.attendanceSetting.update({
          where: { id: existingAttendance.id },
          data: {
            ...(body.officeStart ? { officeStart: body.officeStart } : {}),
            ...(body.officeEnd ? { officeEnd: body.officeEnd } : {}),
            ...(body.graceMinutes !== undefined
              ? { graceMinutes: Number(body.graceMinutes) }
              : {}),
            ...(body.workingDays ? { workingDays: body.workingDays } : {}),
          },
        })
      : await prisma.attendanceSetting.create({
          data: {
            officeStart: body.officeStart ?? "09:00",
            officeEnd: body.officeEnd ?? "18:00",
            graceMinutes: body.graceMinutes ? Number(body.graceMinutes) : 10,
            workingDays: body.workingDays ?? [
              "MON",
              "TUE",
              "WED",
              "THU",
              "FRI",
            ],
            isActive: true,
          },
        });

    // Update regularization limit if provided
    if (body.regularizationLimit !== undefined) {
      await prisma.appConfig.upsert({
        where: { key: "attendance.regularization.limit" },
        update: { value: body.regularizationLimit },
        create: {
          key: "attendance.regularization.limit",
          value: body.regularizationLimit,
        },
      });
    }

    return sendSuccess(
      response,
      "Settings updated",
      { attendanceSetting: updatedAttendance },
      HttpStatus.OK,
    );
  };

  getAppConfig = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const key = request.params.key as string;
    if (!key) throw new BadRequestError("Config key is required");
    const config = await prisma.appConfig.findUnique({ where: { key } });
    return sendSuccess(
      response,
      "Config retrieved",
      config ?? { key, value: [] },
      HttpStatus.OK,
    );
  };

  updateAppConfig = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const key = request.params.key as string;
    const { value } = request.body as { value: unknown };
    if (!key) throw new BadRequestError("Config key is required");
    if (!Array.isArray(value))
      throw new BadRequestError("Value must be an array");
    const config = await prisma.appConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return sendSuccess(response, "Config updated", config, HttpStatus.OK);
  };

  listAppConfigs = async (
    _request: Request,
    response: Response,
  ): Promise<Response> => {
    const configs = await prisma.appConfig.findMany({
      where: { key: { in: ["hr.departments", "hr.designations"] } },
    });
    return sendSuccess(response, "Configs retrieved", configs, HttpStatus.OK);
  };
}
