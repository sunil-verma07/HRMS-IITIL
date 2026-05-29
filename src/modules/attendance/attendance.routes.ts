import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { AttendanceController } from './attendance.controller';

const router = Router();
const controller = new AttendanceController();

router.get('/attendance', authenticate, authorize('attendance.read'), asyncHandler(controller.attendance));
router.post('/attendance/check-in', authenticate, authorize('attendance.write'), asyncHandler(controller.checkIn));
router.post('/attendance/check-out', authenticate, authorize('attendance.write'), asyncHandler(controller.checkOut));
router.get('/attendance/regularizations', authenticate, authorize('attendance.read'), asyncHandler(controller.getRegularizations));
router.post('/attendance/regularizations', authenticate, authorize('attendance.write'), asyncHandler(controller.createRegularization));
router.patch('/attendance/regularizations/:id', authenticate, authorize('attendance.write'), asyncHandler(controller.reviewRegularization));

export { router as attendanceRoutes };