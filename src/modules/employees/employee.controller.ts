import type { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { sendSuccess } from "../../common/http/api-response";
import { HttpStatus } from "../../common/http/status-codes";
import { NotFoundError, ConflictError } from "../../common/errors/app-error";
import { parsePagination, paginated, currentUser, pageArgs } from "../../common/utils/controller-helpers";
import { 
  buildDirectoryVisibilityWhere, 
  buildUserManagementVisibilityWhere,
  buildEmployeeSearchWhere,
  publicEmployeeSelect,
  userManagementEmployeeSelect 
} from "./employee-visibility.policy";
import { employeeDropdownWhere } from "./employee-filters";

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
    const employeeId = request.params.id;
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
        buildUserManagementVisibilityWhere(currentUser(request)),
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
    const visibility = buildUserManagementVisibilityWhere(currentUser(request));
    const employeeWhere = { deletedAt: null, AND: [visibility, buildEmployeeSearchWhere(query.search)] };

    const [employees, departments, designations] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere,
        take: Math.min(query.limit, 50),
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, employeeId: true, firstName: true, lastName: true, designation: true, department: true },
      }),
      prisma.employee.findMany({ 
        where: { deletedAt: null }, 
        distinct: ["department"], 
        orderBy: { department: "asc" }, 
        select: { department: true } 
      }),
      prisma.employee.findMany({ 
        where: { deletedAt: null }, 
        distinct: ["designation"], 
        orderBy: { designation: "asc" }, 
        select: { designation: true } 
      }),
    ]);

    return sendSuccess(response, "Employee form options retrieved", {
      employees,
      departments: departments.map((item) => item.department),
      designations: designations.map((item) => item.designation),
    }, HttpStatus.OK);
  };

  // POST /user-management/users & /employees
  createEmployee = async (request: Request, response: Response): Promise<Response> => {
    const input = request.body;
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
    const id = request.params.id;
    const input = request.body;
    const visibility = buildUserManagementVisibilityWhere(currentUser(request));
    const existing = await prisma.employee.findFirst({ 
      where: { id, deletedAt: null, AND: [visibility] }, 
      select: { id: true } 
    });
    
    if (!existing) throw new NotFoundError("Employee not found or not visible");

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

  // DELETE /user-management/users/:id & /employees/:id
  deleteEmployee = async (request: Request, response: Response): Promise<Response> => {
    const id = request.params.id;
    const visibility = buildUserManagementVisibilityWhere(currentUser(request));
    const existing = await prisma.employee.findFirst({ 
      where: { id, deletedAt: null, AND: [visibility] }, 
      select: { id: true } 
    });
    
    if (!existing) throw new NotFoundError("Employee not found or not visible");

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
}