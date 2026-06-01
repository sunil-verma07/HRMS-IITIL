import type { Request, Response } from 'express';
import { EmployeeStatus, EmploymentType, Prisma } from '@prisma/client';
import XLSX from 'xlsx';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import { sendSuccess } from '../../common/http/api-response';
import { HttpStatus } from '../../common/http/status-codes';
import { hashPassword } from '../../common/utils/password';
import { prisma } from '../../database/prisma';
import type { AuthenticatedUser } from '../../types/authenticated-user';
import type { ImportConfirmRow, PeopleQuery } from './people.validation';

type EmployeeListItem = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string | null;
  department: string;
  designation: string;
  reportingManager: string | null;
  status: EmployeeStatus;
  joinDate: Date;
  lastActive: Date | null;
};

type ImportRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department: string;
  designation: string;
  joiningDate: Date;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  roleCode: string;
  userId: string;
  reportingManagerEmail?: string;
};

type InvalidImportRow = {
  row: number;
  errors: string[];
};

const HR_ROLE_CODES = ['SUPER_ADMIN', 'PORTAL_ADMIN', 'ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'HR'];
const IMPORT_HEADERS = [
  'First Name',
  'Last Name',
  'Email',
  'Phone',
  'Department',
  'Designation',
  'Joining Date',
  'Employment Type',
  'Status',
  'Role Code',
  'User ID',
  'Reporting Manager Email'
] as const;

function isHrCaller(user: AuthenticatedUser): boolean {
  return user.roles.some((role) => HR_ROLE_CODES.includes(role));
}

function resolveEmployeeScope(permissions: string[]): 'self' | 'team' | 'department' | 'all' {
  const allScopes = [
    'employee.manage.all',
    'employee.view.all',
    'employee.manage.department',
    'employee.view.department',
    'employee.manage.team',
    'employee.view.team',
    'employee.manage.self',
    'employee.view.self'
  ];

  const available = new Set(permissions.filter((permission) => allScopes.includes(permission)));

  if (available.has('employee.manage.all') || available.has('employee.view.all')) {
    return 'all';
  }

  if (available.has('employee.manage.department') || available.has('employee.view.department')) {
    return 'department';
  }

  if (available.has('employee.manage.team') || available.has('employee.view.team')) {
    return 'team';
  }

  return 'self';
}

function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const millis = Math.round((value - 25569) * 86400 * 1000);
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function requireParam(value: string | undefined, label: string): string {
  if (!value) {
    throw new BadRequestError(`${label} is required`);
  }

  return value;
}

function buildScopeWhere(user: AuthenticatedUser): Prisma.EmployeeWhereInput {
  const scope = resolveEmployeeScope(user.permissions);

  if (scope === 'all') {
    return {};
  }

  if (scope === 'department') {
    if (user.department) {
      return { department: user.department };
    }

    return user.employeeId ? { id: user.employeeId } : { employeeId: '__none__' };
  }

  if (scope === 'team') {
    if (!user.employeeId) {
      return { employeeId: '__none__' };
    }

    return {
      OR: [{ id: user.employeeId }, { reportingManagerId: user.employeeId }]
    };
  }

  return user.employeeId ? { id: user.employeeId } : { employeeId: '__none__' };
}

export class PeopleController {
  listPeople = async (request: Request, response: Response): Promise<Response> => {
    const query = request.query as unknown as PeopleQuery;
    const user = request.user as AuthenticatedUser;
    const departmentIds = query.departmentId?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    const roleIds = query.roleId?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];

    const searchWhere: Prisma.EmployeeWhereInput = query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { employeeId: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } }
          ]
        }
      : {};

    const filterWhere: Prisma.EmployeeWhereInput = {
      ...(departmentIds.length > 0 ? { departmentId: { in: departmentIds } } : {}),
      ...(query.reportingManagerId ? { reportingManagerId: query.reportingManagerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(roleIds.length > 0
        ? {
            user: {
              is: {
                roles: {
                  some: {
                    roleId: { in: roleIds }
                  }
                }
              }
            }
          }
        : {})
    };

    const where: Prisma.EmployeeWhereInput = {
      deletedAt: null,
      AND: [buildScopeWhere(user), searchWhere, filterWhere]
    };

    const sortOrder = query.sortOrder;
    const orderBy: Prisma.EmployeeOrderByWithRelationInput[] =
      query.sortBy === 'name'
        ? [{ firstName: sortOrder }, { lastName: sortOrder }]
        : query.sortBy === 'joinDate'
          ? [{ joiningDate: sortOrder }]
          : query.sortBy === 'employeeId'
            ? [{ employeeId: sortOrder }]
            : query.sortBy === 'email'
              ? [{ email: sortOrder }]
              : query.sortBy === 'department'
                ? [{ department: sortOrder }]
                : query.sortBy === 'designation'
                  ? [{ designation: sortOrder }]
                  : query.sortBy === 'status'
                    ? [{ status: sortOrder }]
                    : [{ createdAt: 'desc' }];

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy,
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          profilePhoto: true,
          department: true,
          designation: true,
          status: true,
          joiningDate: true,
          reportingManager: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          user: {
            select: {
              lastLoginAt: true,
              roles: {
                select: {
                  role: {
                    select: {
                      name: true
                    }
                  }
                },
                take: 1
              }
            }
          }
        }
      }),
      prisma.employee.count({ where })
    ]);

    const mappedItems: EmployeeListItem[] = items.map((item) => ({
      id: item.id,
      employeeId: item.employeeId,
      name: `${item.firstName} ${item.lastName}`.trim(),
      email: item.email,
      avatar: item.profilePhoto,
      role: item.user?.roles[0]?.role.name ?? null,
      department: item.department,
      designation: item.designation,
      reportingManager: item.reportingManager
        ? `${item.reportingManager.firstName} ${item.reportingManager.lastName}`.trim()
        : null,
      status: item.status,
      joinDate: item.joiningDate,
      lastActive: item.user?.lastLoginAt ?? null
    }));

    return sendSuccess(
      response,
      'People list retrieved',
      {
        items: mappedItems,
        meta: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit)
        }
      },
      HttpStatus.OK
    );
  };

  getPerson = async (request: Request, response: Response): Promise<Response> => {
    const user = request.user as AuthenticatedUser;
    const personId = requireParam(request.params.id, 'Person id');

    const person = await prisma.employee.findFirst({
      where: {
        id: personId,
        deletedAt: null,
        AND: [buildScopeWhere(user)]
      },
      include: {
        reportingManager: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            designation: true,
            profilePhoto: true
          }
        },
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        directReports: {
          where: { deletedAt: null },
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            designation: true,
            status: true
          }
        }
      }
    });

    if (!person) {
      throw new NotFoundError('Person not found');
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [attendanceSummary, leaveBalances, onboardingStatus, documents] = await Promise.all([
      prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: {
          employeeId: person.id,
          attendanceDate: { gte: thirtyDaysAgo }
        },
        _count: { _all: true },
        _avg: { workMinutes: true }
      }),
      prisma.leaveBalance.findMany({
        where: { employeeId: person.id },
        include: {
          leaveType: {
            select: {
              name: true,
              code: true
            }
          }
        }
      }),
      prisma.onboardingWorkflow.findFirst({
        where: {
          employeeId: person.id,
          deletedAt: null
        },
        select: {
          id: true,
          status: true,
          currentStep: true
        }
      }),
      prisma.document.findMany({
        where: {
          entityType: 'employee',
          entityId: person.id,
          deletedAt: null
        },
        select: {
          key: true
        }
      })
    ]);

    const isHr = isHrCaller(user);
    const profileBase = {
      id: person.id,
      employeeId: person.employeeId,
      name: `${person.firstName} ${person.lastName}`.trim(),
      email: person.email,
      avatar: person.profilePhoto,
      department: person.department,
      designation: person.designation,
      status: person.status,
      joinDate: person.joiningDate
    };

    if (!isHr) {
      return sendSuccess(response, 'Person public profile retrieved', profileBase, HttpStatus.OK);
    }

    const permissions = person.user
      ? [
          ...new Set(
            person.user.roles.flatMap((userRole) =>
              userRole.role.permissions.map((rolePermission) => rolePermission.permission.code)
            )
          )
        ]
      : [];

    return sendSuccess(
      response,
      'Person profile retrieved',
      {
        ...profileBase,
        phone: person.phone,
        reportingManagerId: person.reportingManagerId,
        reportingManager: person.reportingManager
          ? {
              id: person.reportingManager.id,
              employeeId: person.reportingManager.employeeId,
              name: `${person.reportingManager.firstName} ${person.reportingManager.lastName}`.trim(),
              designation: person.reportingManager.designation,
              avatar: person.reportingManager.profilePhoto
            }
          : null,
        attendanceSummary: {
          periodDays: 30,
          byStatus: attendanceSummary.map((item) => ({ status: item.status, count: item._count._all })),
          averageWorkMinutes:
            attendanceSummary.length > 0
              ? Math.round(
                  attendanceSummary.reduce((sum, item) => sum + (item._avg.workMinutes ?? 0), 0) /
                    attendanceSummary.length
                )
              : 0
        },
        leaveBalances: leaveBalances.map((balance) => ({
          leaveType: balance.leaveType.name,
          leaveTypeCode: balance.leaveType.code,
          year: balance.year,
          allocated: Number(balance.allocated),
          used: Number(balance.used),
          remaining: Number(balance.allocated) - Number(balance.used)
        })),
        onboardingStatus: onboardingStatus
          ? {
              id: onboardingStatus.id,
              status: onboardingStatus.status,
              currentStep: onboardingStatus.currentStep
            }
          : null,
        documents: documents.map((document) => {
          const parts = document.key.split('/');
          return parts[parts.length - 1] ?? document.key;
        }),
        directReports: person.directReports.map((report) => ({
          id: report.id,
          employeeId: report.employeeId,
          name: `${report.firstName} ${report.lastName}`.trim(),
          designation: report.designation,
          status: report.status
        })),
        permissionsSummary: {
          roles: person.user?.roles.map((userRole) => userRole.role.code) ?? [],
          totalPermissions: permissions.length,
          permissions
        }
      },
      HttpStatus.OK
    );
  };

  bulkImport = async (request: Request, response: Response): Promise<Response> => {
    if (!request.file) {
      throw new BadRequestError('XLSX file is required');
    }

    const workbook = XLSX.read(request.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      throw new BadRequestError('Workbook is empty');
    }

    const sheet = workbook.Sheets[firstSheetName];

    if (!sheet) {
      throw new BadRequestError('Workbook sheet is invalid');
    }

    const headerRow = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      blankrows: false
    })[0] ?? [];

    const actualHeaders = headerRow.map((header) => String(header ?? '').trim());

    if (actualHeaders.length !== IMPORT_HEADERS.length || actualHeaders.some((header, index) => header !== IMPORT_HEADERS[index])) {
      throw new BadRequestError(`Invalid template headers. Expected: ${IMPORT_HEADERS.join(', ')}`);
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      range: 1
    });

    const invalid: InvalidImportRow[] = [];
    const valid: ImportRow[] = [];
    const seenEmails = new Set<string>();
    const seenUserIds = new Set<string>();
    let duplicateEmails = 0;
    let duplicateIds = 0;

    rawRows.forEach((row, index) => {
      const rowNumber = index + 2;
      const errors: string[] = [];

      const firstName = cleanString(row['First Name']);
      const lastName = cleanString(row['Last Name']);
      const email = cleanString(row['Email']).toLowerCase();
      const phone = cleanString(row['Phone']);
      const department = cleanString(row['Department']);
      const designation = cleanString(row['Designation']);
      const joiningDate = parseExcelDate(row['Joining Date']);
      const employmentTypeRaw = cleanString(row['Employment Type']).toUpperCase();
      const statusRaw = cleanString(row['Status']).toUpperCase();
      const roleCode = cleanString(row['Role Code']).toUpperCase();
      const userId = cleanString(row['User ID']);
      const reportingManagerEmail = cleanString(row['Reporting Manager Email']).toLowerCase();

      if (!firstName) errors.push('First Name is required');
      if (!lastName) errors.push('Last Name is required');
      if (!email || !email.includes('@')) errors.push('Valid Email is required');
      if (!department) errors.push('Department is required');
      if (!designation) errors.push('Designation is required');
      if (!joiningDate) errors.push('Valid Joining Date is required');
      if (!employmentTypeRaw || !Object.values(EmploymentType).includes(employmentTypeRaw as EmploymentType)) {
        errors.push('Employment Type is invalid');
      }
      if (statusRaw && !Object.values(EmployeeStatus).includes(statusRaw as EmployeeStatus)) {
        errors.push('Status is invalid');
      }
      if (!roleCode) errors.push('Role Code is required');
      if (!userId) errors.push('User ID is required');

      if (email) {
        if (seenEmails.has(email)) {
          duplicateEmails += 1;
          errors.push('Duplicate Email in file');
        }
        seenEmails.add(email);
      }

      if (userId) {
        const normalized = userId.toLowerCase();
        if (seenUserIds.has(normalized)) {
          duplicateIds += 1;
          errors.push('Duplicate User ID in file');
        }
        seenUserIds.add(normalized);
      }

      if (errors.length > 0) {
        invalid.push({ row: rowNumber, errors });
        return;
      }

      valid.push({
        firstName,
        lastName,
        email,
        ...(phone ? { phone } : {}),
        department,
        designation,
        joiningDate: joiningDate as Date,
        employmentType: employmentTypeRaw as EmploymentType,
        status: (statusRaw || EmployeeStatus.ACTIVE) as EmployeeStatus,
        roleCode,
        userId,
        ...(reportingManagerEmail ? { reportingManagerEmail } : {})
      });
    });

    const existingMatches = await prisma.user.findMany({
      where: {
        OR: [
          { userId: { in: valid.map((row) => row.userId) } },
          { employee: { is: { email: { in: valid.map((row) => row.email) } } } }
        ]
      },
      select: {
        userId: true,
        employee: {
          select: {
            email: true
          }
        }
      }
    });

    const existingUserIds = new Set(existingMatches.map((item) => item.userId.toLowerCase()));
    const existingEmails = new Set(
      existingMatches.map((item) => item.employee?.email.toLowerCase()).filter((email): email is string => Boolean(email))
    );

    const stillValid: ImportRow[] = [];
    for (let index = 0; index < valid.length; index += 1) {
      const row = valid[index];
      if (!row) {
        continue;
      }
      const errors: string[] = [];

      if (existingEmails.has(row.email.toLowerCase())) {
        errors.push('Email already exists');
        duplicateEmails += 1;
      }

      if (existingUserIds.has(row.userId.toLowerCase())) {
        errors.push('User ID already exists');
        duplicateIds += 1;
      }

      if (errors.length > 0) {
        invalid.push({ row: index + 2, errors });
        continue;
      }

      stillValid.push(row);
    }

    return sendSuccess(
      response,
      'Bulk import validated',
      {
        valid: stillValid,
        invalid,
        summary: {
          total: rawRows.length,
          valid: stillValid.length,
          invalid: invalid.length,
          duplicateEmails,
          duplicateIds
        }
      },
      HttpStatus.OK
    );
  };

  confirmBulkImport = async (request: Request, response: Response): Promise<Response> => {
    const rows = request.body.rows as ImportConfirmRow[];
    if (!rows || rows.length === 0) {
      throw new BadRequestError('At least one validated row is required');
    }

    const allRoleCodes = [...new Set(rows.map((row) => row.roleCode.toUpperCase()))];
    const roles = await prisma.role.findMany({
      where: {
        code: { in: allRoleCodes },
        deletedAt: null
      },
      select: {
        id: true,
        code: true
      }
    });

    const roleMap = new Map(roles.map((role) => [role.code.toUpperCase(), role.id]));
    const missingRole = allRoleCodes.find((code) => !roleMap.has(code));

    if (missingRole) {
      throw new BadRequestError(`Role not found: ${missingRole}`);
    }

    const managersByEmail = await prisma.employee.findMany({
      where: {
        email: {
          in: rows
            .map((row) => row.reportingManagerEmail?.toLowerCase())
            .filter((email): email is string => Boolean(email))
        },
        deletedAt: null
      },
      select: {
        id: true,
        email: true
      }
    });

    const managerMap = new Map(managersByEmail.map((manager) => [manager.email.toLowerCase(), manager.id]));

    const latestEmployee = await prisma.employee.findFirst({
      where: { employeeId: { startsWith: 'IITIL' } },
      orderBy: { employeeId: 'desc' },
      select: { employeeId: true }
    });

    const match = latestEmployee?.employeeId.match(/^IITIL(\d+)$/);
    let sequence = match ? Number(match[1]) : 0;

    const failures: Array<{ row: number; reason: string }> = [];
    let createdCount = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row) {
        continue;
      }

      try {
        sequence += 1;
        const employeeCode = `IITIL${String(sequence).padStart(4, '0')}`;
        const passwordHash = await hashPassword(`${row.userId}@123`);
        const roleId = roleMap.get(row.roleCode.toUpperCase());

        if (!roleId) {
          throw new BadRequestError(`Role not found for row ${index + 1}`);
        }

        const reportingManagerId = row.reportingManagerEmail
          ? managerMap.get(row.reportingManagerEmail.toLowerCase())
          : undefined;

        await prisma.$transaction(async (tx) => {
          const existing = await tx.employee.findFirst({
            where: {
              OR: [{ email: row.email }, { employeeId: employeeCode }],
              deletedAt: null
            },
            select: { id: true }
          });

          if (existing) {
            throw new ConflictError(`Duplicate employee email or employeeId at row ${index + 1}`);
          }

          const existingUser = await tx.user.findFirst({
            where: { userId: row.userId },
            select: { id: true }
          });

          if (existingUser) {
            throw new ConflictError(`Duplicate userId at row ${index + 1}`);
          }

          const employee = await tx.employee.create({
            data: {
              employeeId: employeeCode,
              firstName: row.firstName,
              lastName: row.lastName,
              email: row.email,
              ...(row.phone ? { phone: row.phone } : {}),
              designation: row.designation,
              department: row.department,
              joiningDate: row.joiningDate,
              joinDate: row.joiningDate,
              employmentType: row.employmentType,
              status: row.status,
              ...(reportingManagerId ? { reportingManagerId } : {})
            },
            select: { id: true }
          });

          const user = await tx.user.create({
            data: {
              userId: row.userId,
              passwordHash,
              status: 'PASSWORD_RESET_REQUIRED',
              forcePasswordReset: true,
              employeeId: employee.id
            },
            select: { id: true }
          });

          await tx.employee.update({
            where: { id: employee.id },
            data: { userId: user.id }
          });

          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId
            }
          });
        });

        createdCount += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error';
        failures.push({ row: index + 1, reason });
      }
    }

    return sendSuccess(
      response,
      'Bulk import execution completed',
      {
        createdCount,
        failures
      },
      HttpStatus.OK
    );
  };

  peopleFilters = async (_request: Request, response: Response): Promise<Response> => {
    const [departments, roles, designations, reportingManagers] = await Promise.all([
      prisma.department.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true }
      }),
      prisma.role.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true }
      }),
      prisma.designation.findMany({
        where: { deletedAt: null },
        orderBy: { title: 'asc' },
        select: { id: true, title: true }
      }),
      prisma.employee.findMany({
        where: { deletedAt: null },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      })
    ]);

    return sendSuccess(
      response,
      'People filters retrieved',
      {
        departments,
        roles,
        designations: designations.map((item) => ({ id: item.id, name: item.title })),
        reportingManagers: reportingManagers.map((manager) => ({
          id: manager.id,
          name: `${manager.firstName} ${manager.lastName}`.trim()
        }))
      },
      HttpStatus.OK
    );
  };
}
