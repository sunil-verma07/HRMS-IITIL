import type { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { sendSuccess } from "../../common/http/api-response";
import { HttpStatus } from "../../common/http/status-codes";
import { parsePagination, paginated, pageArgs } from "../../common/utils/controller-helpers";

export class AuditController {
  activityLogs = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
      }),
      prisma.activityLog.count(),
    ]);

    return sendSuccess(response, "Activity logs retrieved", paginated(items, total, query), HttpStatus.OK);
  };

  auditLogs = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count(),
    ]);

    return sendSuccess(response, "Audit logs retrieved", paginated(items, total, query), HttpStatus.OK);
  };
}