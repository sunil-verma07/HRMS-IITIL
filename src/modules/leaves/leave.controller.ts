import type { Request, Response } from "express";
import { LeaveRequestStatus, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { HttpStatus } from "../../common/http/status-codes";
import { sendSuccess } from "../../common/http/api-response";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import type { AuthenticatedUser } from "../../types/authenticated-user";
import { LeaveValidationService } from "./leave-validation.service";

type PaginatedResult<T> = {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

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

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const toIsoDate = (value: Date) => value.toISOString();

const makeDate = (year: number, month: number, day: number) => new Date(year, month, day);

const isSuperAdmin = (user: AuthenticatedUser) => user.roles.includes("SUPER_ADMIN");

const hasPermission = (user: AuthenticatedUser, permission: string) => user.permissions.includes(permission);

const canViewDepartment = (user: AuthenticatedUser) => hasPermission(user, "leave.view.department") || user.roles.some((role) => ["HR_MANAGER", "HR_EXECUTIVE", "HR", "ADMIN", "PORTAL_ADMIN", "SUPER_ADMIN"].includes(role));

const canViewAll = (user: AuthenticatedUser) => hasPermission(user, "leave.view.all") || user.roles.some((role) => ["ADMIN", "PORTAL_ADMIN", "SUPER_ADMIN"].includes(role));

const canViewTeam = (user: AuthenticatedUser) => hasPermission(user, "leave.view.team") || user.roles.includes("TEAM_LEAD");

export class LeaveController {
  getLeaveBalances = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    if (!user.employeeId) {
      throw new ForbiddenError("Employee record required");
    }

    const balances = await prisma.leaveBalance.findMany({
      where: {
        employeeId: user.employeeId,
        year: new Date().getFullYear(),
      },
      include: { leaveType: true },
      orderBy: { leaveType: { name: "asc" } },
    });

    return sendSuccess(response, "Leave balances retrieved", balances, HttpStatus.OK);
  };

  getLeaveTypes = async (_request: Request, response: Response): Promise<Response> => {
    const leaveTypes = await prisma.leaveType.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
    });

    return sendSuccess(response, "Leave types retrieved", leaveTypes, HttpStatus.OK);
  };

  applyLeave = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    if (!user.employeeId) {
      throw new ForbiddenError("Only employees can apply for leave");
    }

    const body = request.body as {
      leaveTypeId?: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
    };

    if (!body.leaveTypeId || !body.startDate || !body.endDate) {
      throw new BadRequestError("Leave type, start date, and end date are required");
    }

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestError("Invalid leave dates");
    }

    if (startDate > endDate) {
      throw new BadRequestError("Start date must be before end date");
    }

    const validated = await LeaveValidationService.validateApply({
      employeeId: user.employeeId,
      leaveTypeId: body.leaveTypeId,
      startDate,
      endDate,
    });

    const employee = await prisma.employee.findUnique({
      where: { id: validated.employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        reportingManagerId: true,
        accountUser: { select: { id: true } },
      },
    });

    if (!employee?.reportingManagerId) {
      throw new BadRequestError("No reporting manager assigned — contact HR");
    }

    const approverId = employee.reportingManagerId;

    const leaveRequest = await prisma.$transaction(async (tx) => {
      const record = await tx.leaveRequest.create({
        data: {
          employeeId: validated.employeeId,
          leaveTypeId: validated.leaveTypeId,
          startDate: validated.startDate,
          endDate: validated.endDate,
          days: validated.days,
          reason: body.reason ?? null,
          status: "PENDING",
          approvals: {
            create: {
              approverId,
              level: 1,
              decision: "PENDING",
            },
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
          leaveType: true,
          approvals: {
            include: {
              approver: {
                select: { id: true, employeeId: true, firstName: true, lastName: true },
              },
            },
          },
        },
      });

      if (employee.accountUser?.id) {
        await tx.notification.create({
          data: {
            userId: employee.accountUser.id,
            channel: "IN_APP",
            type: "LEAVE_REQUEST",
            title: "Leave request submitted",
            body: `${employee.firstName} ${employee.lastName} submitted a leave request`,
            data: { leaveRequestId: record.id },
          },
        });
      }

      return record;
    });

    await LeaveValidationService.recalculateBalances(validated.employeeId, validated.startDate.getFullYear());

    return sendSuccess(response, "Leave request submitted", leaveRequest, HttpStatus.CREATED);
  };

  getLeaveRequests = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    const query = parsePagination(request);
    const statusFilter = typeof request.query.status === "string" ? request.query.status.split(",").filter(Boolean) : [];

    const where: Prisma.LeaveRequestWhereInput = { deletedAt: null };

    if (statusFilter.length > 0) {
      const enumStatuses = statusFilter.filter(
        (status): status is LeaveRequestStatus =>
          Object.values(LeaveRequestStatus).includes(status as LeaveRequestStatus),
      );

      if (enumStatuses.length > 0) {
        where.status = { in: enumStatuses };
      }
    }

    if (user.employeeId && !canViewAll(user) && !canViewDepartment(user) && !canViewTeam(user)) {
      where.employeeId = user.employeeId;
    } else if (canViewTeam(user) && user.employeeId && !canViewAll(user) && !canViewDepartment(user)) {
      where.employee = { is: { reportingManagerId: user.employeeId } };
    } else if (canViewDepartment(user) && !canViewAll(user) && user.department) {
      where.employee = { is: { department: user.department } };
    }

    const [items, total] = await Promise.all([
      prisma.leaveRequest.findMany({
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
          leaveType: true,
          approvals: {
            orderBy: { level: "asc" },
            include: {
              approver: {
                select: { id: true, employeeId: true, firstName: true, lastName: true, designation: true },
              },
            },
          },
        },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return sendSuccess(response, "Leave requests retrieved", paginated(items, total, query), HttpStatus.OK);
  };

  pendingApprovals = async (request: Request, response: Response): Promise<Response> => {
    request.query = { ...request.query, status: "PENDING" };
    return this.getLeaveRequests(request, response);
  };

  reviewLeaveRequest = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    const body = request.body as { decision?: string; remarks?: string };
    const id = requireParam(request.params.id, "Leave request id");

    if (!body.decision || !["APPROVED", "REJECTED"].includes(body.decision)) {
      throw new BadRequestError("Decision must be APPROVED or REJECTED");
    }

    const decision = body.decision;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            reportingManagerId: true,
            accountUser: { select: { id: true } },
          },
        },
        approvals: true,
      },
    });

    if (!leaveRequest) {
      throw new NotFoundError("Leave request not found");
    }

    const isDirectManager = user.employeeId && leaveRequest.employee.reportingManagerId === user.employeeId;
    const hasDepartmentScope = canViewDepartment(user);
    const hasAllScope = canViewAll(user);

    if (!isDirectManager && !hasDepartmentScope && !hasAllScope) {
      throw new ForbiddenError("Insufficient permissions to review this leave request");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const pendingApproval = leaveRequest.approvals.find((approval: { decision: string }) => approval.decision === "PENDING");

      if (pendingApproval) {
        await tx.leaveApproval.update({
          where: { id: pendingApproval.id },
          data: {
            decision,
            remarks: body.remarks ?? null,
            decidedAt: new Date(),
          },
        });
      }

      const nextStatus = decision === "APPROVED" ? "APPROVED" : "REJECTED";
      const record = await tx.leaveRequest.update({
        where: { id },
        data: { status: nextStatus },
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
          leaveType: true,
          approvals: {
            orderBy: { level: "asc" },
            include: {
              approver: {
                select: { id: true, employeeId: true, firstName: true, lastName: true, designation: true },
              },
            },
          },
        },
      });

      if (leaveRequest.employee.accountUser?.id) {
        await tx.notification.create({
          data: {
            userId: leaveRequest.employee.accountUser.id,
            channel: "IN_APP",
            type: "LEAVE_DECISION",
            title: `Leave request ${decision.toLowerCase()}`,
            body: `Your leave request was ${decision.toLowerCase()}${body.remarks ? `: ${body.remarks}` : ""}`,
            data: { leaveRequestId: record.id },
          },
        });
      }

      return record;
    });

    await LeaveValidationService.recalculateBalances(updated.employeeId, updated.startDate.getFullYear());

    return sendSuccess(response, `Leave request ${decision.toLowerCase()}`, updated, HttpStatus.OK);
  };

  leaveCalendar = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    const year = Number.parseInt(String(request.query.year ?? new Date().getFullYear()), 10);
    const month = Number.parseInt(String(request.query.month ?? new Date().getMonth() + 1), 10) - 1;

    if (Number.isNaN(year) || Number.isNaN(month) || month < 0 || month > 11) {
      throw new BadRequestError("year and month are required");
    }

    const daysInMonth = getDaysInMonth(year, month);
    const workingSetting = await prisma.attendanceSetting.findFirst({
      where: { isActive: true, deletedAt: null },
      select: { workingDays: true },
    });
    const workingDays = Array.isArray(workingSetting?.workingDays)
      ? workingSetting.workingDays.filter((item): item is string => typeof item === "string")
      : ["MON", "TUE", "WED", "THU", "FRI"];

    const weekendDates: string[] = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = makeDate(year, month, day);
      const dayCode = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getDay()] ?? "SUN";
      if (!workingDays.includes(dayCode)) {
        weekendDates.push(toIsoDate(date));
      }
    }

    const holidayRows = await prisma.holiday.findMany({
      where: {
        isActive: true,
        date: {
          gte: startOfLocalDay(makeDate(year, month, 1)),
          lte: endOfLocalDay(makeDate(year, month, daysInMonth)),
        },
      },
      orderBy: { date: "asc" },
    });

    const visibleEmployeeWhere: Prisma.LeaveRequestWhereInput = { deletedAt: null, status: "APPROVED" };
    if (user.employeeId && !canViewAll(user) && !canViewDepartment(user) && !canViewTeam(user)) {
      visibleEmployeeWhere.employeeId = user.employeeId;
    } else if (canViewTeam(user) && user.employeeId && !canViewAll(user) && !canViewDepartment(user)) {
      visibleEmployeeWhere.employee = { is: { reportingManagerId: user.employeeId } };
    } else if (canViewDepartment(user) && !canViewAll(user) && user.department) {
      visibleEmployeeWhere.employee = { is: { department: user.department } };
    }

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        ...visibleEmployeeWhere,
        startDate: { lte: endOfLocalDay(makeDate(year, month, daysInMonth)) },
        endDate: { gte: startOfLocalDay(makeDate(year, month, 1)) },
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
        leaveType: true,
      },
      orderBy: { startDate: "asc" },
    });

    return sendSuccess(
      response,
      "Leave calendar retrieved",
      {
        holidays: holidayRows.filter((holiday) => holiday.type === "HOLIDAY" || holiday.type === "REGIONAL"),
        optionalHolidays: holidayRows.filter((holiday) => holiday.type === "OPTIONAL"),
        weekends: weekendDates,
        leaves,
        month: month + 1,
        year,
      },
      HttpStatus.OK,
    );
  };

  createHoliday = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    if (!isSuperAdmin(user)) {
      throw new ForbiddenError("Super Admin only");
    }

    const body = request.body as {
      name?: string;
      date?: string;
      type?: string;
      region?: string;
      description?: string;
      isActive?: boolean;
    };
    if (!body.name || !body.date || !body.type) {
      throw new BadRequestError("Name, date, and type are required");
    }

    const date = new Date(body.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestError("Invalid holiday date");
    }

    const normalizedDate = startOfLocalDay(date);
    const region = body.region?.trim() || null;

    const existing = await prisma.holiday.findFirst({
      where: {
        date: {
          gte: startOfLocalDay(normalizedDate),
          lte: endOfLocalDay(normalizedDate),
        },
        region,
      },
    });

    if (existing) {
      throw new BadRequestError("Holiday already exists for this date and region");
    }

    const holiday = await prisma.holiday.create({
      data: {
        name: body.name.trim(),
        date: normalizedDate,
        type: body.type.trim().toUpperCase(),
        region,
        ...(body.description?.trim() ? { description: body.description.trim() } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        createdById: user.id,
      },
    });

    return sendSuccess(response, "Holiday created", holiday, HttpStatus.CREATED);
  };
}