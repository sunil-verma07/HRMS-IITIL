import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { sendSuccess } from "../../common/http/api-response";
import { HttpStatus } from "../../common/http/status-codes";
import { parsePagination, paginated, pageArgs } from "../../common/utils/controller-helpers";
import { summarizeActivityLog, summarizeAuditLog } from "../../common/utils/log-formatters";

export class AuditController {
  activityLogs = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const search = typeof request.query.search === "string" ? request.query.search.trim() : "";

    const where: Prisma.ActivityLogWhereInput = search
      ? {
          OR: [
            { action: { contains: search, mode: "insensitive" } },
            { entityType: { contains: search, mode: "insensitive" } },
            { entityName: { contains: search, mode: "insensitive" } },
            { actorName: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return sendSuccess(
      response,
      "Activity logs retrieved",
      paginated(
        items.map((item) => ({
          ...item,
          summary: summarizeActivityLog(item),
          actorLabel: item.actorName ?? item.actorUserId ?? "System",
          entityLabel: item.entityName ?? item.entityType,
        })),
        total,
        query,
      ),
      HttpStatus.OK,
    );
  };

  auditLogs = async (request: Request, response: Response): Promise<Response> => {
    const query = parsePagination(request);
    const search = typeof request.query.search === "string" ? request.query.search.trim() : "";

    const where: Prisma.AuditLogWhereInput = search
      ? {
          OR: [
            { action: { contains: search, mode: "insensitive" } },
            { event: { contains: search, mode: "insensitive" } },
            { entityType: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return sendSuccess(
      response,
      "Audit logs retrieved",
      paginated(
        items.map((item) => ({
          ...item,
          summary: summarizeAuditLog(item),
          actorLabel: item.actorUserId ?? "System",
          entityLabel: item.entityType ?? "System",
        })),
        total,
        query,
      ),
      HttpStatus.OK,
    );
  };
}