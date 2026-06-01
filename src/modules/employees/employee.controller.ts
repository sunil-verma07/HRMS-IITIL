import type { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { sendSuccess } from "../../common/http/api-response";
import { HttpStatus } from "../../common/http/status-codes";
import { BadRequestError, NotFoundError, ConflictError, ForbiddenError } from "../../common/errors/app-error";
import { parsePagination, paginated, currentUser, pageArgs } from "../../common/utils/controller-helpers";
import { 
  buildDirectoryVisibilityWhere, 
  buildUserManagementVisibilityWhere,
  buildEmployeeSearchWhere,
  publicEmployeeSelect,
  userManagementEmployeeSelect 
} from "./employee-visibility.policy";
import { employeeDropdownWhere } from "./employee-filters";

function requireParam(value: string | undefined, label: string): string {
  if (!value) {
    throw new BadRequestError(`${label} is required`);
  }

  return value;
}

const disallowedReportingManagerRoles = ['SUPER_ADMIN', 'ADMIN'];

function requireAdminRole(roles: string[]): void {
  if (!roles.includes('SUPER_ADMIN') && !roles.includes('ADMIN')) {
    throw new ForbiddenError('Only SUPER_ADMIN and ADMIN can perform this action');
  }
}

export class EmployeeController {
  // GET /employee-directory
  employeeDirectory = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const where = {
      deletedAt: null,
      AND: [
        buildDirectoryVisibilityWhere(currentUser(request)),
        buildEmployeeSearchWhere(query.search),
        employeeDropdownWhere(request),
      ],
    };

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
        select: publicEmployeeSelect,
      }),
      prisma.employee.count({ where }),
    ]);

    return sendSuccess(response, "Employee directory retrieved", paginated(items, total, query), HttpStatus.OK);
  };

  // GET /employee-directory/:id
  employeeDirectoryProfile = async (request: Request, response: Response): Promise<Response> => {
    const employeeId = requireParam(request.params.id, "Employee id");
    const where = {
      id: employeeId,
      deletedAt: null,
      AND: [buildDirectoryVisibilityWhere(currentUser(request))],
    };

    const employee = await prisma.employee.findFirst({
      where,
      select: publicEmployeeSelect,
    });

    if (!employee) {
      throw new NotFoundError("Employee not found");
    }

    return sendSuccess(response, "Employee public profile retrieved", employee, HttpStatus.OK);
  };

  // GET /user-management/users & /employees
  userManagementEmployees = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const where = {
      deletedAt: null,
      AND: [
        buildDirectoryVisibilityWhere(currentUser(request)),
        buildEmployeeSearchWhere(query.search),
        employeeDropdownWhere(request),
      ],
    };

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
        select: userManagementEmployeeSelect,
      }),
      prisma.employee.count({ where }),
    ]);

    return sendSuccess(response, "User management employees retrieved", paginated(items, total, query), HttpStatus.OK);
  };

  // GET /user-management/options
  employeeOptions = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const visibility = buildDirectoryVisibilityWhere(currentUser(request));
    const employeeWhere = { deletedAt: null, AND: [visibility, buildEmployeeSearchWhere(query.search)] };

    const [employees, deptConfig, desigConfig] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere,
        take: Math.min(query.limit, 50),
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, employeeId: true, firstName: true, lastName: true, designation: true, department: true },
      }),
      prisma.appConfig.findUnique({ where: { key: 'hr.departments' } }),
      prisma.appConfig.findUnique({ where: { key: 'hr.designations' } }),
    ]);

    return sendSuccess(response, "Employee form options retrieved", {
      employees,
      departments: (deptConfig?.value as string[]) ?? [],
      designations: (desigConfig?.value as string[]) ?? [],
    }, HttpStatus.OK);
  };

  // GET /employees/reporting-manager-options
  reportingManagerOptions = async (request: Request, response: Response): Promise<Response> => {
    const search = typeof request.query.search === 'string' ? request.query.search.trim() : undefined;
    const excludeId = typeof request.query.excludeId === 'string' ? request.query.excludeId : undefined;

    const where = {
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      AND: [
        {
          OR: [
            { user: null },
            {
              user: {
                roles: {
                  none: {
                    role: {
                      code: {
                        in: disallowedReportingManagerRoles
                      },
                      deletedAt: null
                    }
                  }
                }
              }
            }
          ]
        },
        ...(search
          ? [
              {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' as const } },
                  { lastName: { contains: search, mode: 'insensitive' as const } },
                  { employeeId: { contains: search, mode: 'insensitive' as const } },
                  { email: { contains: search, mode: 'insensitive' as const } }
                ]
              }
            ]
          : [])
      ]
    };

    const managers = await prisma.employee.findMany({
      where,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 50,
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        designation: true,
        department: true,
        profilePhoto: true
      }
    });

    return sendSuccess(response, 'Reporting manager options retrieved', managers, HttpStatus.OK);
  };

  // POST /user-management/users & /employees
  createEmployee = async (request: Request, response: Response): Promise<Response> => {
    const input = request.body;
    if (input.reportingManagerId) {
      await this.ensureReportingManagerExists(input.reportingManagerId);
    }

    const employee = await prisma.$transaction(async (tx) => {
      const employeeId = input.employeeId ?? await this.generateEmployeeId(tx);
      const existing = await tx.employee.findFirst({
        where: { OR: [{ employeeId }, { email: input.email }], deletedAt: null },
      });
      if (existing) {
        throw new ConflictError(
          existing.email === input.email ? "Employee email already exists" : "Employee ID already exists"
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
          ...(input.phone && { phone: input.phone }), 
          ...(input.reportingManagerId && { reportingManagerId: input.reportingManagerId }) 
        },
        select: userManagementEmployeeSelect,
      });
    });
    return sendSuccess(response, "Employee created", employee, HttpStatus.CREATED);
  };

  // PATCH /user-management/users/:id & /employees/:id
  updateEmployee = async (request: Request, response: Response): Promise<Response> => {
    const id = requireParam(request.params.id, "Employee id");
    const input = request.body;
    const visibility = buildUserManagementVisibilityWhere(currentUser(request));

    const exists = await prisma.employee.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundError('Employee not found');
    }

    const existing = await prisma.employee.findFirst({ 
      where: { id, deletedAt: null, AND: [visibility] }, 
      select: { id: true } 
    });
    
    if (!existing) {
      throw new ForbiddenError('You do not have permission to manage this employee');
    }

    if (input.reportingManagerId !== undefined) {
      await this.validateReportingManagerHierarchy(id, input.reportingManagerId ?? null);
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...(input.employeeId && { employeeId: input.employeeId }),
        ...(input.firstName && { firstName: input.firstName }),
        ...(input.lastName && { lastName: input.lastName }),
        ...(input.email && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.designation && { designation: input.designation }),
        ...(input.department && { department: input.department }),
        ...(input.joiningDate && { joiningDate: input.joiningDate }),
        ...(input.employmentType && { employmentType: input.employmentType }),
        ...(input.status && { status: input.status }),
        ...(input.reportingManagerId !== undefined && { reportingManagerId: input.reportingManagerId }),
      },
      select: userManagementEmployeeSelect,
    });
    return sendSuccess(response, "Employee updated", employee, HttpStatus.OK);
  };

  // PATCH /employees/:id/reporting-manager
  updateEmployeeReportingManager = async (request: Request, response: Response): Promise<Response> => {
    requireAdminRole(request.user?.roles ?? []);

    const id = requireParam(request.params.id, 'Employee id');
    const body = request.body as { reportingManagerId?: string | null };

    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null },
      select: { id: true }
    });

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    await this.validateReportingManagerHierarchy(id, body.reportingManagerId ?? null);

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        reportingManagerId: body.reportingManagerId ?? null
      },
      select: userManagementEmployeeSelect
    });

    return sendSuccess(response, 'Reporting manager updated', updated, HttpStatus.OK);
  };

  // DELETE /user-management/users/:id & /employees/:id
  deleteEmployee = async (request: Request, response: Response): Promise<Response> => {
    const id = requireParam(request.params.id, "Employee id");
    const visibility = buildUserManagementVisibilityWhere(currentUser(request));

    const exists = await prisma.employee.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundError('Employee not found');
    }

    const existing = await prisma.employee.findFirst({ 
      where: { id, deletedAt: null, AND: [visibility] }, 
      select: { id: true } 
    });
    
    if (!existing) {
      throw new ForbiddenError('You do not have permission to manage this employee');
    }

    await prisma.employee.update({ 
      where: { id }, 
      data: { deletedAt: new Date(), status: "INACTIVE" } 
    });
    return sendSuccess(response, "Employee deleted", null, HttpStatus.OK);
  };

  private generateEmployeeId = async (tx: any): Promise<string> => {
    const latest = await tx.employee.findFirst({
      where: { employeeId: { startsWith: "IITIL" } },
      orderBy: { employeeId: "desc" },
      select: { employeeId: true },
    });
    const match = latest?.employeeId.match(/^IITIL(\d+)$/);
    const next = match ? Number(match[1]) + 1 : 1;
    return `IITIL${String(next).padStart(4, "0")}`;
  };

  private async ensureReportingManagerExists(reportingManagerId: string): Promise<void> {
    const manager = await prisma.employee.findFirst({
      where: { id: reportingManagerId, deletedAt: null },
      select: { id: true }
    });

    if (!manager) {
      throw new BadRequestError('Reporting manager not found');
    }
  }

  private async validateReportingManagerHierarchy(employeeId: string, reportingManagerId: string | null): Promise<void> {
    if (!reportingManagerId) {
      return;
    }

    if (employeeId === reportingManagerId) {
      throw new BadRequestError('Circular reporting hierarchy detected');
    }

    await this.ensureReportingManagerExists(reportingManagerId);

    let cursor: string | null = reportingManagerId;
    let safetyCounter = 0;

    while (cursor) {
      if (safetyCounter > 1000) {
        throw new BadRequestError('Circular reporting hierarchy detected');
      }

      const managerNode: { reportingManagerId: string | null } | null = await prisma.employee.findFirst({
        where: { id: cursor, deletedAt: null },
        select: { reportingManagerId: true }
      });

      const nextManagerId: string | null = managerNode?.reportingManagerId ?? null;
      if (!nextManagerId) {
        return;
      }

      if (nextManagerId === employeeId) {
        throw new BadRequestError('Circular reporting hierarchy detected');
      }

      cursor = nextManagerId;
      safetyCounter += 1;
    }
  }
}