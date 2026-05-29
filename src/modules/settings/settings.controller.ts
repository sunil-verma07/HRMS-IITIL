import type { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { sendSuccess } from "../../common/http/api-response";
import { HttpStatus } from "../../common/http/status-codes";
import { BadRequestError } from "../../common/errors/app-error";

export class SettingsController {
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