import type { Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { sendSuccess } from '../../common/http/api-response';
import { HttpStatus } from '../../common/http/status-codes';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError
} from '../../common/errors/app-error';

type TeamMemberPayload = {
  id: string;
  employeeId: string;
  name: string;
  designation: string;
  avatar: string | null;
};

type TeamPayload = {
  leadId: string;
  lead: TeamMemberPayload;
  memberCount: number;
  members: TeamMemberPayload[];
};

type DepartmentNode = {
  id: string;
  name: string;
  code: string;
  head: TeamMemberPayload | null;
  employeeCount: number;
  teams: TeamPayload[];
  unassigned: TeamMemberPayload[];
  subDepartments: DepartmentNode[];
};

type DepartmentWithPeople = {
  id: string;
  name: string;
  code: string;
  headEmployeeId: string | null;
  parentDepartmentId: string | null;
  head: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    designation: string;
    profilePhoto: string | null;
  } | null;
  employees: Array<{
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    designation: string;
    profilePhoto: string | null;
    reportingManagerId: string | null;
  }>;
};

function toEmployeePayload(employee: {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation: string;
  profilePhoto: string | null;
}): TeamMemberPayload {
  return {
    id: employee.id,
    employeeId: employee.employeeId,
    name: `${employee.firstName} ${employee.lastName}`.trim(),
    designation: employee.designation,
    avatar: employee.profilePhoto
  };
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function buildTeams(employees: DepartmentWithPeople['employees']): {
  teams: TeamPayload[];
  unassigned: TeamMemberPayload[];
} {
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const teamMembersByLead = new Map<string, DepartmentWithPeople['employees']>();

  for (const employee of employees) {
    if (!employee.reportingManagerId) {
      continue;
    }

    if (!byId.has(employee.reportingManagerId)) {
      continue;
    }

    const members = teamMembersByLead.get(employee.reportingManagerId) ?? [];
    members.push(employee);
    teamMembersByLead.set(employee.reportingManagerId, members);
  }

  const teams: TeamPayload[] = [];

  for (const [leadId, members] of teamMembersByLead.entries()) {
    const lead = byId.get(leadId);
    if (!lead) {
      continue;
    }

    const mappedMembers = sortByName(members.map(toEmployeePayload));

    teams.push({
      leadId,
      lead: toEmployeePayload(lead),
      memberCount: mappedMembers.length,
      members: mappedMembers
    });
  }

  teams.sort((a, b) => a.lead.name.localeCompare(b.lead.name));

  const unassigned = sortByName(
    employees
      .filter((employee) => !employee.reportingManagerId)
      .map(toEmployeePayload)
  );

  return { teams, unassigned };
}

function isAdminRole(roles: string[]): boolean {
  return roles.includes('SUPER_ADMIN') || roles.includes('ADMIN');
}

function ensureAdminRole(request: Request): void {
  const roles = request.user?.roles ?? [];
  if (!isAdminRole(roles)) {
    throw new ForbiddenError('Only SUPER_ADMIN and ADMIN can perform this action');
  }
}

function ensureSuperAdminRole(request: Request): void {
  const roles = request.user?.roles ?? [];
  if (!roles.includes('SUPER_ADMIN')) {
    throw new ForbiddenError('Only SUPER_ADMIN can perform this action');
  }
}

export class DepartmentsController {
  private buildDepartmentNode(
    department: DepartmentWithPeople,
    byParentId: Map<string, DepartmentWithPeople[]>
  ): DepartmentNode {
    const { teams, unassigned } = buildTeams(department.employees);
    const children = byParentId.get(department.id) ?? [];

    return {
      id: department.id,
      name: department.name,
      code: department.code,
      head: department.head ? toEmployeePayload(department.head) : null,
      employeeCount: department.employees.length,
      teams,
      unassigned,
      subDepartments: children
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((child) => this.buildDepartmentNode(child, byParentId))
    };
  }

  private async fetchDepartmentsWithPeople(): Promise<DepartmentWithPeople[]> {
    const departments = await prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        headEmployeeId: true,
        parentDepartmentId: true,
        head: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            designation: true,
            profilePhoto: true
          }
        },
        employees: {
          where: { deletedAt: null },
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            designation: true,
            profilePhoto: true,
            reportingManagerId: true
          }
        }
      }
    });

    if (departments.length === 0) {
      return [];
    }

    const employeesByDepartmentId = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        OR: [
          { departmentId: { in: departments.map((department) => department.id) } },
          { department: { in: departments.map((department) => department.name) } }
        ]
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        designation: true,
        profilePhoto: true,
        reportingManagerId: true,
        departmentId: true,
        department: true
      }
    });

    const grouped = new Map<string, DepartmentWithPeople['employees']>();
    for (const department of departments) {
      grouped.set(department.id, []);
    }

    for (const employee of employeesByDepartmentId) {
      const targetDepartment = employee.departmentId
        ? employee.departmentId
        : departments.find((department) => department.name === employee.department)?.id;

      if (!targetDepartment || !grouped.has(targetDepartment)) {
        continue;
      }

      grouped.get(targetDepartment)?.push({
        id: employee.id,
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        designation: employee.designation,
        profilePhoto: employee.profilePhoto,
        reportingManagerId: employee.reportingManagerId
      });
    }

    return departments.map((department) => ({
      ...department,
      employees: grouped.get(department.id) ?? []
    }));
  }

  listDepartments = async (_request: Request, response: Response): Promise<Response> => {
    const departments = await this.fetchDepartmentsWithPeople();
    const byParentId = new Map<string, DepartmentWithPeople[]>();

    for (const department of departments) {
      const parentKey = department.parentDepartmentId ?? '__root__';
      const list = byParentId.get(parentKey) ?? [];
      list.push(department);
      byParentId.set(parentKey, list);
    }

    const roots = (byParentId.get('__root__') ?? [])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((department) => this.buildDepartmentNode(department, byParentId));

    return sendSuccess(response, 'Departments hierarchy retrieved', { departments: roots }, HttpStatus.OK);
  };

  getDepartment = async (request: Request, response: Response): Promise<Response> => {
    const id = request.params.id;
    if (!id) {
      throw new BadRequestError('Department id is required');
    }

    const departments = await this.fetchDepartmentsWithPeople();
    const target = departments.find((department) => department.id === id);
    if (!target) {
      throw new NotFoundError('Department not found');
    }

    const byParentId = new Map<string, DepartmentWithPeople[]>();
    for (const department of departments) {
      const parentKey = department.parentDepartmentId ?? '__root__';
      const list = byParentId.get(parentKey) ?? [];
      list.push(department);
      byParentId.set(parentKey, list);
    }

    return sendSuccess(
      response,
      'Department hierarchy retrieved',
      { department: this.buildDepartmentNode(target, byParentId) },
      HttpStatus.OK
    );
  };

  getDepartmentTeams = async (request: Request, response: Response): Promise<Response> => {
    const id = request.params.id;
    if (!id) {
      throw new BadRequestError('Department id is required');
    }

    const department = await prisma.department.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        employees: {
          where: { deletedAt: null },
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            designation: true,
            profilePhoto: true,
            reportingManagerId: true
          }
        }
      }
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    const { teams, unassigned } = buildTeams(department.employees);

    return sendSuccess(
      response,
      'Department teams retrieved',
      {
        departmentId: department.id,
        name: department.name,
        code: department.code,
        employeeCount: department.employees.length,
        teams,
        unassigned
      },
      HttpStatus.OK
    );
  };

  createDepartment = async (request: Request, response: Response): Promise<Response> => {
    ensureAdminRole(request);

    const body = request.body as {
      name: string;
      code: string;
      headEmployeeId?: string | null;
      parentDepartmentId?: string | null;
    };

    const normalizedName = body.name.trim();
    const normalizedCode = body.code.trim().toUpperCase();

    if (body.headEmployeeId) {
      const head = await prisma.employee.findFirst({
        where: { id: body.headEmployeeId, deletedAt: null },
        select: { id: true }
      });
      if (!head) {
        throw new BadRequestError('Department head employee not found');
      }
    }

    if (body.parentDepartmentId) {
      const parent = await prisma.department.findFirst({
        where: { id: body.parentDepartmentId, deletedAt: null },
        select: { id: true }
      });
      if (!parent) {
        throw new BadRequestError('Parent department not found');
      }
    }

    const created = await prisma.department.create({
      data: {
        name: normalizedName,
        code: normalizedCode,
        ...(body.headEmployeeId !== undefined ? { headEmployeeId: body.headEmployeeId } : {}),
        ...(body.parentDepartmentId !== undefined ? { parentDepartmentId: body.parentDepartmentId } : {})
      },
      select: {
        id: true,
        name: true,
        code: true,
        headEmployeeId: true,
        parentDepartmentId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return sendSuccess(response, 'Department created', created, HttpStatus.CREATED);
  };

  updateDepartment = async (request: Request, response: Response): Promise<Response> => {
    ensureAdminRole(request);

    const id = request.params.id;
    if (!id) {
      throw new BadRequestError('Department id is required');
    }

    const body = request.body as {
      name?: string;
      code?: string;
      headEmployeeId?: string | null;
      parentDepartmentId?: string | null;
    };

    const existing = await prisma.department.findFirst({
      where: { id, deletedAt: null },
      select: { id: true }
    });
    if (!existing) {
      throw new NotFoundError('Department not found');
    }

    if (body.headEmployeeId) {
      const head = await prisma.employee.findFirst({
        where: { id: body.headEmployeeId, deletedAt: null },
        select: { id: true }
      });
      if (!head) {
        throw new BadRequestError('Department head employee not found');
      }
    }

    if (body.parentDepartmentId) {
      if (body.parentDepartmentId === id) {
        throw new BadRequestError('Department cannot be its own parent');
      }

      const parent = await prisma.department.findFirst({
        where: { id: body.parentDepartmentId, deletedAt: null },
        select: { id: true }
      });
      if (!parent) {
        throw new BadRequestError('Parent department not found');
      }
    }

    const updated = await prisma.department.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.code !== undefined ? { code: body.code.trim().toUpperCase() } : {}),
        ...(body.headEmployeeId !== undefined ? { headEmployeeId: body.headEmployeeId } : {}),
        ...(body.parentDepartmentId !== undefined ? { parentDepartmentId: body.parentDepartmentId } : {})
      },
      select: {
        id: true,
        name: true,
        code: true,
        headEmployeeId: true,
        parentDepartmentId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return sendSuccess(response, 'Department updated', updated, HttpStatus.OK);
  };

  deleteDepartment = async (request: Request, response: Response): Promise<Response> => {
    ensureSuperAdminRole(request);

    const id = request.params.id;
    if (!id) {
      throw new BadRequestError('Department id is required');
    }

    const department = await prisma.department.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true }
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    const assignedEmployees = await prisma.employee.count({
      where: {
        deletedAt: null,
        OR: [{ departmentId: id }, { department: department.name }]
      }
    });

    if (assignedEmployees > 0) {
      throw new BadRequestError('Cannot delete department with assigned employees');
    }

    await prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return sendSuccess(response, 'Department deleted', null, HttpStatus.OK);
  };

  assignEmployeeToDepartment = async (request: Request, response: Response): Promise<Response> => {
    ensureAdminRole(request);

    const id = request.params.id;
    if (!id) {
      throw new BadRequestError('Department id is required');
    }

    const body = request.body as { employeeId: string };
    if (!body.employeeId) {
      throw new BadRequestError('Employee id is required');
    }

    const department = await prisma.department.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true }
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    const employee = await prisma.employee.findFirst({
      where: { id: body.employeeId, deletedAt: null },
      select: { id: true }
    });

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    const updated = await prisma.employee.update({
      where: { id: body.employeeId },
      data: {
        departmentId: department.id,
        department: department.name
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        departmentId: true,
        department: true
      }
    });

    return sendSuccess(response, 'Employee assigned to department', updated, HttpStatus.OK);
  };
}
