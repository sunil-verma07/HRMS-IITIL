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

export class NotificationController {
  notifications = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = parsePagination(request);
    const userId = request.user?.id;
    const where = userId ? { userId } : {};

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where }),
    ]);

    return sendSuccess(
      response,
      "Notifications retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  createNotification = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const { type, referenceId, message } = request.body;
    const userId = request.user?.id;

    if (!userId) throw new BadRequestError("Authenticated user required");
    if (!type || !message) {
      throw new BadRequestError("Missing required fields: type, message");
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        referenceId: referenceId ?? null,
        message,
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
    const { id } = request.params;

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