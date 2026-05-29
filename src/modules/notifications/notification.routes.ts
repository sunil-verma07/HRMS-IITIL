import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler";
import { authenticate } from "../../middlewares/authenticate";
import { NotificationController } from "./notification.controller";

const router = Router();
const controller = new NotificationController();

router.get(
  "/notifications",
  authenticate,
  asyncHandler(controller.notifications),
);

router.post(
  "/notifications",
  authenticate,
  asyncHandler(controller.createNotification),
);

router.patch(
  "/notifications/:id/read",
  authenticate,
  asyncHandler(controller.markRead),
);

router.patch(
  "/notifications/read-all",
  authenticate,
  asyncHandler(controller.markAllRead),
);

export { router as notificationRoutes };