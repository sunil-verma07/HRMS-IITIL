import type { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { sendSuccess } from "../../common/http/api-response";
import { HttpStatus } from "../../common/http/status-codes";
import { BadRequestError, NotFoundError } from "../../common/errors/app-error";

const startOfLocalDay = (value = new Date()) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

const endOfLocalDay = (value = new Date()) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);

const parseOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }

    if (value.toLowerCase() === "false") {
      return false;
    }
  }

  return undefined;
};

const normalizeHolidayDate = (value: string): Date => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError("Invalid holiday date");
  }

  return startOfLocalDay(date);
};

export class SettingsController {
  listHolidays = async (request: Request, response: Response): Promise<Response> => {
    const year = Number.parseInt(String(request.query.year ?? ""), 10);
    const isActive = parseOptionalBoolean(request.query.isActive);

    const holidays = await prisma.holiday.findMany({
      where: {
        ...(Number.isFinite(year)
          ? {
              date: {
                gte: new Date(year, 0, 1),
                lte: new Date(year, 11, 31, 23, 59, 59, 999),
              },
            }
          : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { name: "asc" }],
    });

    return sendSuccess(response, "Holidays retrieved", holidays, HttpStatus.OK);
  };

  createHoliday = async (request: Request, response: Response): Promise<Response> => {
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

    const date = normalizeHolidayDate(body.date);
    const region = body.region?.trim() || null;

    const existing = await prisma.holiday.findFirst({
      where: {
        date: {
          gte: startOfLocalDay(date),
          lte: endOfLocalDay(date),
        },
        region,
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestError("Holiday already exists for this date and region");
    }

    const holiday = await prisma.holiday.create({
      data: {
        name: body.name.trim(),
        date,
        type: body.type.trim().toUpperCase(),
        region,
        ...(body.description?.trim() ? { description: body.description.trim() } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(request.user?.id ? { createdById: request.user.id } : {}),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    return sendSuccess(response, "Holiday created", holiday, HttpStatus.CREATED);
  };

  updateHoliday = async (request: Request, response: Response): Promise<Response> => {
    const id = request.params.id;
    const body = request.body as {
      name?: string;
      date?: string;
      type?: string;
      region?: string | null;
      description?: string | null;
      isActive?: boolean;
    };

    if (!id) {
      throw new BadRequestError("Holiday id is required");
    }

    const existingHoliday = await prisma.holiday.findUnique({
      where: { id },
      select: { id: true, date: true, region: true },
    });

    if (!existingHoliday) {
      throw new NotFoundError("Holiday not found");
    }

    const nextDate = body.date ? normalizeHolidayDate(body.date) : existingHoliday.date;
    const nextRegion = body.region === undefined ? existingHoliday.region : body.region?.trim() || null;

    const conflictingHoliday = await prisma.holiday.findFirst({
      where: {
        id: { not: id },
        date: {
          gte: startOfLocalDay(nextDate),
          lte: endOfLocalDay(nextDate),
        },
        region: nextRegion,
      },
      select: { id: true },
    });

    if (conflictingHoliday) {
      throw new BadRequestError("Holiday already exists for this date and region");
    }

    const holiday = await prisma.holiday.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.date !== undefined ? { date: nextDate } : {}),
        ...(body.type !== undefined ? { type: body.type.trim().toUpperCase() } : {}),
        ...(body.region !== undefined ? { region: nextRegion } : {}),
        ...(body.description !== undefined
          ? { description: body.description?.trim() || null }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    return sendSuccess(response, "Holiday updated", holiday, HttpStatus.OK);
  };

  deleteHoliday = async (request: Request, response: Response): Promise<Response> => {
    const id = request.params.id;

    if (!id) {
      throw new BadRequestError("Holiday id is required");
    }

    const holiday = await prisma.holiday.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!holiday) {
      throw new NotFoundError("Holiday not found");
    }

    await prisma.holiday.delete({ where: { id } });

    return sendSuccess(response, "Holiday deleted", null, HttpStatus.OK);
  };

  getSettings = async (_request: Request, response: Response): Promise<Response> => {
    const [attendanceSetting, leaveTypes, regularizationLimit] = await Promise.all([
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

  updateSettings = async (request: Request, response: Response): Promise<Response> => {
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
            ...(body.graceMinutes !== undefined ? { graceMinutes: Number(body.graceMinutes) } : {}),
            ...(body.workingDays ? { workingDays: body.workingDays } : {}),
          },
        })
      : await prisma.attendanceSetting.create({
          data: {
            officeStart: body.officeStart ?? "09:00",
            officeEnd: body.officeEnd ?? "18:00",
            graceMinutes: body.graceMinutes ? Number(body.graceMinutes) : 10,
            workingDays: body.workingDays ?? ["MON", "TUE", "WED", "THU", "FRI"],
            isActive: true,
          },
        });

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

  getAppConfig = async (request: Request, response: Response): Promise<Response> => {
    const key = request.params.key as string;
    if (!key) throw new BadRequestError("Config key is required");
    
    const config = await prisma.appConfig.findUnique({ where: { key } });
    return sendSuccess(response, "Config retrieved", config ?? { key, value: [] }, HttpStatus.OK);
  };

  updateAppConfig = async (request: Request, response: Response): Promise<Response> => {
    const key = request.params.key as string;
    const { value } = request.body as { value: unknown };
    
    if (!key) throw new BadRequestError("Config key is required");
    if (!Array.isArray(value)) throw new BadRequestError("Value must be an array");
    
    const config = await prisma.appConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    
    return sendSuccess(response, "Config updated", config, HttpStatus.OK);
  };

  listAppConfigs = async (_request: Request, response: Response): Promise<Response> => {
    const configs = await prisma.appConfig.findMany({
      where: { key: { in: ["hr.departments", "hr.designations"] } },
    });
    
    return sendSuccess(response, "Configs retrieved", configs, HttpStatus.OK);
  };
}