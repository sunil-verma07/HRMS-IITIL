import type { Request, Response } from 'express';
import { AttendanceStatus, EmployeeStatus, EmploymentType, type Prisma } from '@prisma/client';
import { paginationSchema, type PaginationQuery } from '../../common/utils/pagination';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import { sendSuccess } from '../../common/http/api-response';
import { HttpStatus } from '../../common/http/status-codes';
import { prisma } from '../../database/prisma';
import type { AuthenticatedUser } from '../../types/authenticated-user';
import {
  buildDirectoryVisibilityWhere,
  buildEmployeeSearchWhere,
  buildUserManagementVisibilityWhere,
  publicEmployeeSelect,
  userManagementEmployeeSelect
} from '../employees/employee-visibility.policy';
import type { CreateEmployeeDto, UpdateEmployeeDto } from '../employees/employee-management.validation';

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

function paginated<T>(items: T[], total: number, query: PaginationQuery): PaginatedData<T> {
  return {
    items,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit)
    }
  };
}

function pageArgs(query: PaginationQuery): { skip: number; take: number } {
  return {
    skip: (query.page - 1) * query.limit,
    take: query.limit
  };
}

function currentUser(request: Request): AuthenticatedUser {
  return request.user as AuthenticatedUser;
}

function employeeDropdownWhere(request: Request): Prisma.EmployeeWhereInput {
  const department = typeof request.query.department === 'string' ? request.query.department : undefined;
  const status = typeof request.query.status === 'string' ? request.query.status : undefined;
  const employmentType = typeof request.query.employmentType === 'string' ? request.query.employmentType : undefined;
  const where: Prisma.EmployeeWhereInput = {};

  if (department) {
    where.department = department;
  }

  if (status && Object.values(EmployeeStatus).includes(status as EmployeeStatus)) {
    where.status = status as EmployeeStatus;
  }

  if (employmentType && Object.values(EmploymentType).includes(employmentType as EmploymentType)) {
    where.employmentType = employmentType as EmploymentType;
  }

  return where;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseTime(value: string): { hours: number; minutes: number } {
  const [hours = '0', minutes = '0'] = value.split(':');
  return {
    hours: Number(hours),
    minutes: Number(minutes)
  };
}

function minutesSinceMidnight(value: Date): number {
  return value.getHours() * 60 + value.getMinutes();
}

function attendanceStatus(now: Date, setting?: { officeStart: string; graceMinutes: number } | null): AttendanceStatus {
  if (!setting) {
    return AttendanceStatus.PRESENT;
  }

  const officeStart = parseTime(setting.officeStart);
  const startMinutes = officeStart.hours * 60 + officeStart.minutes + setting.graceMinutes;

  return minutesSinceMidnight(now) > startMinutes ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
}

function haversineDistanceMeters(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const earthRadius = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sanitizeHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:.*?\2/gi, '');
}

function interpolateTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export class PortalReadController {
  private readonly generateEmployeeId = async (tx: Prisma.TransactionClient): Promise<string> => {
    const latest = await tx.employee.findFirst({
      where: {
        employeeId: {
          startsWith: 'IITIL'
        }
      },
      orderBy: { employeeId: 'desc' },
      select: { employeeId: true }
    });
    const match = latest?.employeeId.match(/^IITIL(\d+)$/);
    const next = match ? Number(match[1]) + 1 : 1;

    return `IITIL${String(next).padStart(4, '0')}`;
  };

  employeeDirectory = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const where = {
      deletedAt: null,
      AND: [
        buildDirectoryVisibilityWhere(currentUser(request)),
        buildEmployeeSearchWhere(query.search),
        employeeDropdownWhere(request)
      ]
    } satisfies Prisma.EmployeeWhereInput;

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: 'desc' },
        select: publicEmployeeSelect
      }),
      prisma.employee.count({ where })
    ]);

    return sendSuccess(response, 'Employee directory retrieved', paginated(items, total, query), HttpStatus.OK);
  };

  userManagementEmployees = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const where = {
      deletedAt: null,
      AND: [
        buildUserManagementVisibilityWhere(currentUser(request)),
        buildEmployeeSearchWhere(query.search),
        employeeDropdownWhere(request)
      ]
    } satisfies Prisma.EmployeeWhereInput;

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: 'desc' },
        select: userManagementEmployeeSelect
      }),
      prisma.employee.count({ where })
    ]);

    return sendSuccess(response, 'User management employees retrieved', paginated(items, total, query), HttpStatus.OK);
  };

  employeeOptions = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const visibility = buildUserManagementVisibilityWhere(currentUser(request));
    const search = query.search;
    const employeeWhere = {
      deletedAt: null,
      AND: [visibility, buildEmployeeSearchWhere(search)]
    } satisfies Prisma.EmployeeWhereInput;

    const [employees, departments, designations] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere,
        take: Math.min(query.limit, 50),
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: { id: true, employeeId: true, firstName: true, lastName: true, designation: true, department: true }
      }),
      prisma.employee.findMany({
        where: { deletedAt: null },
        distinct: ['department'],
        orderBy: { department: 'asc' },
        select: { department: true }
      }),
      prisma.employee.findMany({
        where: { deletedAt: null },
        distinct: ['designation'],
        orderBy: { designation: 'asc' },
        select: { designation: true }
      })
    ]);

    return sendSuccess(
      response,
      'Employee form options retrieved',
      {
        employees,
        departments: departments.map((item) => item.department),
        designations: designations.map((item) => item.designation)
      },
      HttpStatus.OK
    );
  };

  createEmployee = async (request: Request, response: Response): Promise<Response> => {
    const input = request.body as CreateEmployeeDto;
    const employee = await prisma.$transaction(async (tx) => {
      const employeeId = input.employeeId ?? (await this.generateEmployeeId(tx));
      const existing = await tx.employee.findFirst({
        where: {
          OR: [{ employeeId }, { email: input.email }],
          deletedAt: null
        },
        select: { employeeId: true, email: true }
      });

      if (existing) {
        throw new ConflictError(existing.email === input.email ? 'Employee email already exists' : 'Employee ID already exists');
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
          ...(input.reportingManagerId ? { reportingManagerId: input.reportingManagerId } : {})
        },
        select: userManagementEmployeeSelect
      });
    });

    return sendSuccess(response, 'Employee created', employee, HttpStatus.CREATED);
  };

  updateEmployee = async (request: Request, response: Response): Promise<Response> => {
    const id = request.params.id as string;
    const input = request.body as UpdateEmployeeDto;
    const visibility = buildUserManagementVisibilityWhere(currentUser(request));
    const existing = await prisma.employee.findFirst({
      where: {
        id,
        deletedAt: null,
        AND: [visibility]
      },
      select: { id: true }
    });

    if (!existing) {
      throw new NotFoundError('Employee not found or not visible');
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
        ...(input.employmentType ? { employmentType: input.employmentType } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.reportingManagerId !== undefined ? { reportingManagerId: input.reportingManagerId } : {})
      },
      select: userManagementEmployeeSelect
    });

    return sendSuccess(response, 'Employee updated', employee, HttpStatus.OK);
  };

  deleteEmployee = async (request: Request, response: Response): Promise<Response> => {
    const id = request.params.id as string;
    const visibility = buildUserManagementVisibilityWhere(currentUser(request));
    const existing = await prisma.employee.findFirst({
      where: {
        id,
        deletedAt: null,
        AND: [visibility]
      },
      select: { id: true }
    });

    if (!existing) {
      throw new NotFoundError('Employee not found or not visible');
    }

    await prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' }
    });

    return sendSuccess(response, 'Employee deleted', null, HttpStatus.OK);
  };

  employeeDirectoryProfile = async (request: Request, response: Response): Promise<Response> => {
    const employeeId = request.params.id as string;
    const where = {
      id: employeeId,
      deletedAt: null,
      AND: [buildDirectoryVisibilityWhere(currentUser(request))]
    } satisfies Prisma.EmployeeWhereInput;

    const employee = await prisma.employee.findFirst({
      where,
      select: publicEmployeeSelect
    });

    return sendSuccess(response, 'Employee public profile retrieved', employee, HttpStatus.OK);
  };

  attendance = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const employeeVisibility = buildUserManagementVisibilityWhere(currentUser(request));
    const [items, total] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: {
          deletedAt: null,
          employee: employeeVisibility
        },
        ...pageArgs(query),
        orderBy: { attendanceDate: 'desc' },
        include: {
          employee: {
            select: { employeeId: true, firstName: true, lastName: true, department: true }
          }
        }
      }),
      prisma.attendanceRecord.count({ where: { deletedAt: null, employee: employeeVisibility } })
    ]);

    return sendSuccess(response, 'Attendance records retrieved', paginated(items, total, query), HttpStatus.OK);
  };

  checkIn = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);

    if (!user.employeeId) {
      throw new ForbiddenError('Only linked employee accounts can check in');
    }

    const latitude = typeof request.body.latitude === 'number' ? request.body.latitude : undefined;
    const longitude = typeof request.body.longitude === 'number' ? request.body.longitude : undefined;
    const now = new Date();
    const attendanceDate = startOfToday();

    const [setting, officeLocation] = await Promise.all([
      prisma.attendanceSetting.findFirst({
        where: { isActive: true, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: { officeStart: true, graceMinutes: true }
      }),
      prisma.officeLocation.findFirst({
        where: { isActive: true, deletedAt: null },
        orderBy: { updatedAt: 'desc' }
      })
    ]);

    if (officeLocation) {
      if (latitude === undefined || longitude === undefined) {
        throw new BadRequestError('Latitude and longitude are required for geo-fenced check-in');
      }

      const distance = haversineDistanceMeters(
        { latitude: Number(officeLocation.latitude), longitude: Number(officeLocation.longitude) },
        { latitude, longitude }
      );

      if (distance > officeLocation.allowedRadiusM) {
        throw new ForbiddenError('Check-in location is outside the allowed office radius');
      }
    }

    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: user.employeeId,
          attendanceDate
        }
      }
    });

    if (existing?.checkInAt && !existing.deletedAt) {
      throw new ConflictError('Employee is already checked in for today');
    }

    const meta = {
      latitude,
      longitude,
      deviceInfo: request.body.deviceInfo ?? null,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null
    };

    const attendance = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_attendanceDate: {
          employeeId: user.employeeId,
          attendanceDate
        }
      },
      create: {
        employeeId: user.employeeId,
        attendanceDate,
        checkInAt: now,
        status: attendanceStatus(now, setting),
        checkInMeta: meta
      },
      update: {
        deletedAt: null,
        checkInAt: now,
        status: attendanceStatus(now, setting),
        checkInMeta: meta
      },
      include: {
        employee: {
          select: { employeeId: true, firstName: true, lastName: true, department: true }
        }
      }
    });

    return sendSuccess(response, 'Check-in recorded', attendance, HttpStatus.CREATED);
  };

  checkOut = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);

    if (!user.employeeId) {
      throw new ForbiddenError('Only linked employee accounts can check out');
    }

    const attendanceDate = startOfToday();
    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: user.employeeId,
          attendanceDate
        }
      }
    });

    if (!existing?.checkInAt || existing.deletedAt) {
      throw new BadRequestError('Check-out requires an active check-in for today');
    }

    if (existing.checkOutAt) {
      throw new ConflictError('Employee is already checked out for today');
    }

    const now = new Date();
    const grossMinutes = Math.max(0, Math.floor((now.getTime() - existing.checkInAt.getTime()) / 60_000));
    const workMinutes = Math.max(0, grossMinutes - existing.breakMinutes);
    const status = workMinutes > 0 && workMinutes < 240 ? AttendanceStatus.HALF_DAY : existing.status;

    const attendance = await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        checkOutAt: now,
        workMinutes,
        status,
        checkOutMeta: {
          latitude: typeof request.body.latitude === 'number' ? request.body.latitude : null,
          longitude: typeof request.body.longitude === 'number' ? request.body.longitude : null,
          deviceInfo: request.body.deviceInfo ?? null,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null
        }
      },
      include: {
        employee: {
          select: { employeeId: true, firstName: true, lastName: true, department: true }
        }
      }
    });

    return sendSuccess(response, 'Check-out recorded', attendance, HttpStatus.OK);
  };

  leaves = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const employeeVisibility = buildUserManagementVisibilityWhere(currentUser(request));
    const [items, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: {
          deletedAt: null,
          employee: employeeVisibility
        },
        ...pageArgs(query),
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: { employeeId: true, firstName: true, lastName: true, department: true }
          },
          leaveType: {
            select: { code: true, name: true }
          }
        }
      }),
      prisma.leaveRequest.count({ where: { deletedAt: null, employee: employeeVisibility } })
    ]);

    return sendSuccess(response, 'Leave requests retrieved', paginated(items, total, query), HttpStatus.OK);
  };

  jobs = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const search = query.search;
    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { department: { contains: search, mode: 'insensitive' as const } },
              { location: { contains: search, mode: 'insensitive' as const } }
            ]
          }
        : {})
    };
    const [items, total] = await Promise.all([
      prisma.jobPosting.findMany({ where, ...pageArgs(query), orderBy: { createdAt: 'desc' } }),
      prisma.jobPosting.count({ where })
    ]);

    return sendSuccess(response, 'Job postings retrieved', paginated(items, total, query), HttpStatus.OK);
  };

  interviews = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const [items, total] = await Promise.all([
      prisma.interview.findMany({
        where: { deletedAt: null },
        ...pageArgs(query),
        orderBy: { scheduledAt: 'desc' },
        include: {
          interviewer: {
            select: { employeeId: true, firstName: true, lastName: true }
          },
          application: {
            select: { id: true, stage: true }
          }
        }
      }),
      prisma.interview.count({ where: { deletedAt: null } })
    ]);

    return sendSuccess(response, 'Interviews retrieved', paginated(items, total, query), HttpStatus.OK);
  };

  onboarding = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const [items, total] = await Promise.all([
      prisma.onboardingWorkflow.findMany({
        where: { deletedAt: null },
        ...pageArgs(query),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.onboardingWorkflow.count({ where: { deletedAt: null } })
    ]);

    return sendSuccess(response, 'Onboarding workflows retrieved', paginated(items, total, query), HttpStatus.OK);
  };

  offerLetters = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const [items, total] = await Promise.all([
      prisma.offerLetter.findMany({
        where: { deletedAt: null },
        ...pageArgs(query),
        orderBy: { createdAt: 'desc' },
        include: {
          template: {
            select: { id: true, name: true, key: true }
          }
        }
      }),
      prisma.offerLetter.count({ where: { deletedAt: null } })
    ]);

    return sendSuccess(response, 'Offer letters retrieved', paginated(items, total, query), HttpStatus.OK);
  };

  generateOfferLetter = async (request: Request, response: Response): Promise<Response> => {
    const templateId = typeof request.body.templateId === 'string' ? request.body.templateId : undefined;
    const variables = request.body.variables && typeof request.body.variables === 'object' ? request.body.variables as Record<string, unknown> : {};

    if (!templateId) {
      throw new BadRequestError('Template is required');
    }

    const template = await prisma.template.findFirst({
      where: { id: templateId, deletedAt: null }
    });

    if (!template) {
      throw new NotFoundError('Template not found');
    }

    const finalHtml = sanitizeHtml(interpolateTemplate(template.htmlContent, variables));
    const finalCss = template.cssContent ? sanitizeHtml(template.cssContent) : '';
    const offer = await prisma.offerLetter.create({
      data: {
        templateId,
        variables: variables as Prisma.InputJsonValue,
        generatedUrl: 'pending',
        ...(typeof request.body.employeeId === 'string' ? { employeeId: request.body.employeeId } : {}),
        ...(typeof request.body.candidateId === 'string' ? { candidateId: request.body.candidateId } : {})
      },
      include: {
        template: {
          select: { id: true, name: true, key: true }
        }
      }
    });
    const generatedUrl = `/api/v1/offer-letters/${offer.id}/download`;
    const updated = await prisma.offerLetter.update({
      where: { id: offer.id },
      data: { generatedUrl },
      include: {
        template: {
          select: { id: true, name: true, key: true }
        }
      }
    });

    return sendSuccess(
      response,
      'Offer letter generated',
      {
        ...updated,
        generatedHtml: `<style>${finalCss}</style>${finalHtml}`
      },
      HttpStatus.CREATED
    );
  };

  downloadOfferLetter = async (request: Request, response: Response): Promise<void> => {
    const id = request.params.id;
    if (!id) {
      throw new BadRequestError('Offer letter id is required');
    }

    const offer = await prisma.offerLetter.findFirst({
      where: { id, deletedAt: null }
    });

    if (!offer) {
      throw new NotFoundError('Offer letter not found');
    }

    const template = await prisma.template.findUnique({ where: { id: offer.templateId } });

    if (!template) {
      throw new NotFoundError('Offer template not found');
    }

    const variables = offer.variables && typeof offer.variables === 'object' ? offer.variables as Record<string, unknown> : {};
    const html = sanitizeHtml(interpolateTemplate(template.htmlContent, variables));
    const css = template.cssContent ? sanitizeHtml(template.cssContent) : '';
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="offer-${offer.id}.html"`);
    response.send(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`);
  };

  templates = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const search = query.search;
    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { key: { contains: search, mode: 'insensitive' as const } }
            ]
          }
        : {})
    };
    const [items, total] = await Promise.all([
      prisma.template.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          key: true,
          htmlContent: true,
          cssContent: true,
          previewImage: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.template.count({ where })
    ]);

    return sendSuccess(response, 'Templates retrieved', paginated(items, total, query), HttpStatus.OK);
  };

  createTemplate = async (request: Request, response: Response): Promise<Response> => {
    const name = typeof request.body.name === 'string' ? request.body.name.trim() : '';
    const key = typeof request.body.key === 'string' ? request.body.key.trim() : '';
    const htmlContent = typeof request.body.htmlContent === 'string' ? sanitizeHtml(request.body.htmlContent) : '';
    const cssContent = typeof request.body.cssContent === 'string' ? sanitizeHtml(request.body.cssContent) : undefined;

    if (!name || !key || !htmlContent) {
      throw new BadRequestError('Template name, key, and HTML content are required');
    }

    const existing = await prisma.template.findFirst({ where: { key, deletedAt: null }, select: { id: true } });

    if (existing) {
      throw new ConflictError('Template key already exists');
    }

    const template = await prisma.template.create({
      data: {
        name,
        key,
        htmlContent,
        ...(cssContent ? { cssContent } : {})
      }
    });

    return sendSuccess(response, 'Template created', template, HttpStatus.CREATED);
  };

  updateTemplate = async (request: Request, response: Response): Promise<Response> => {
    const id = request.params.id;
    if (!id) {
      throw new BadRequestError('Template id is required');
    }

    const existing = await prisma.template.findFirst({ where: { id, deletedAt: null }, select: { id: true } });

    if (!existing) {
      throw new NotFoundError('Template not found');
    }

    const template = await prisma.template.update({
      where: { id },
      data: {
        ...(typeof request.body.name === 'string' ? { name: request.body.name.trim() } : {}),
        ...(typeof request.body.key === 'string' ? { key: request.body.key.trim() } : {}),
        ...(typeof request.body.htmlContent === 'string' ? { htmlContent: sanitizeHtml(request.body.htmlContent) } : {}),
        ...(typeof request.body.cssContent === 'string' ? { cssContent: sanitizeHtml(request.body.cssContent) } : {})
      }
    });

    return sendSuccess(response, 'Template updated', template, HttpStatus.OK);
  };

  notifications = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const userId = request.user?.id;
    const where = userId ? { userId } : {};
    const [items, total] = await Promise.all([
      prisma.notification.findMany({ where, ...pageArgs(query), orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where })
    ]);

    return sendSuccess(response, 'Notifications retrieved', paginated(items, total, query), HttpStatus.OK);
  };

  activityLogs = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({ ...pageArgs(query), orderBy: { createdAt: 'desc' } }),
      prisma.activityLog.count()
    ]);

    return sendSuccess(response, 'Activity logs retrieved', paginated(items, total, query), HttpStatus.OK);
  };

  auditLogs = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ ...pageArgs(query), orderBy: { createdAt: 'desc' } }),
      prisma.auditLog.count()
    ]);

    return sendSuccess(response, 'Audit logs retrieved', paginated(items, total, query), HttpStatus.OK);
  };
}
