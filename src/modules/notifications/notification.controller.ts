import type { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { sendSuccess } from "../../common/http/api-response";
import { HttpStatus } from "../../common/http/status-codes";
import { BadRequestError } from "../../common/errors/app-error";
import {
  parsePagination,
  paginated,
  pageArgs,
} from "../../common/utils/controller-helpers";
import { notificationTitleFromType } from "../../common/utils/log-formatters";

const requireParam = (value: string | undefined, label: string): string => {
  if (!value) {
    throw new BadRequestError(`${label} is required`);
  }

  return value;
};

export class NotificationController {
  notifications = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = parsePagination(request);
    const userId = request.user?.id;
    const search =
      typeof request.query.search === "string"
        ? request.query.search.trim()
        : "";
    const readState =
      typeof request.query.readState === "string"
        ? request.query.readState
        : undefined;

    const where = {
      ...(userId ? { userId } : {}),
      ...(readState === "read"
        ? { isRead: true }
        : readState === "unread"
          ? { isRead: false }
          : {}),
      ...(search
        ? {
            OR: [
              { type: { contains: search, mode: "insensitive" as const } },
              { title: { contains: search, mode: "insensitive" as const } },
              { message: { contains: search, mode: "insensitive" as const } },
              { body: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        ...pageArgs(query),
        orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, isRead: false } }),
    ]);

    return sendSuccess(
      response,
      "Notifications retrieved",
      {
        ...paginated(items, total, query),
        unreadCount,
      },
      HttpStatus.OK,
    );
  };

  createNotification = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const {
      userId: targetUserId,
      type,
      title,
      message,
      body,
      channel,
      metadata,
      data,
    } = request.body;
    const userId = targetUserId ?? request.user?.id;

    if (!userId) throw new BadRequestError("Authenticated user required");
    if (!type || (!message && !body)) {
      throw new BadRequestError("Missing required fields: type, message or body");
    }

    const resolvedTitle = title ?? notificationTitleFromType(type);
    const resolvedBody = body ?? message ?? resolvedTitle;
    const resolvedMessage = message ?? resolvedBody;

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title: resolvedTitle,
        message: resolvedMessage,
        body: resolvedBody,
        channel: channel ?? "IN_APP",
        metadata: metadata ?? null,
        data: data ?? null,
        isRead: false,
      },
    });

    return sendSuccess(
      response,
      "Notification created",
      notification,
      HttpStatus.CREATED,
    );
  };

  markRead = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const userId = request.user?.id;
    const id = requireParam(request.params.id, "Notification id");

    if (!userId) throw new BadRequestError("Authenticated user required");

    await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });

    return sendSuccess(response, "Notification marked as read", null, HttpStatus.OK);
  };

  markAllRead = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const userId = request.user?.id;
    if (!userId) throw new BadRequestError("Authenticated user required");

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return sendSuccess(response, "All notifications marked as read", null, HttpStatus.OK);
  };
}