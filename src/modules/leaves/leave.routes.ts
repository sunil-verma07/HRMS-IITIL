import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { LeaveController } from "./leave.controller";

const router = Router();
const controller = new LeaveController();

router.get("/leave/requests", authenticate, authorize("leave.read"), asyncHandler(controller.getLeaveRequests));
router.post("/leave/apply", authenticate, authorize("leave.write"), asyncHandler(controller.applyLeave));
router.patch("/leave/requests/:id", authenticate, authorize("leave.approve"), asyncHandler(controller.reviewLeaveRequest));
router.get("/leave/balances", authenticate, authorize("leave.read"), asyncHandler(controller.getLeaveBalances));
router.get("/leave/calendar", authenticate, authorize("leave.read"), asyncHandler(controller.leaveCalendar));
router.post("/calendar/holidays", authenticate, authorize("rbac.manage"), asyncHandler(controller.createHoliday));
router.get("/leave-types", authenticate, authorize("leave.read"), asyncHandler(controller.getLeaveTypes));

router.get("/leaves", authenticate, authorize("leave.read"), asyncHandler(controller.getLeaveRequests));
router.post("/leaves", authenticate, authorize("leave.write"), asyncHandler(controller.applyLeave));
router.patch("/leaves/:id", authenticate, authorize("leave.approve"), asyncHandler(controller.reviewLeaveRequest));
router.get("/leaves/balances", authenticate, authorize("leave.read"), asyncHandler(controller.getLeaveBalances));
router.get("/leaves/calendar", authenticate, authorize("leave.read"), asyncHandler(controller.leaveCalendar));
router.get("/leaves/pending-approvals", authenticate, authorize("leave.approve"), asyncHandler(controller.pendingApprovals));

export { router as leaveRoutes };