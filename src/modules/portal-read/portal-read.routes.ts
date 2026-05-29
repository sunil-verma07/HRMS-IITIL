// src/modules/portal-read/portal-read.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validateRequest } from '../../middlewares/validate-request';
import { createEmployeeSchema, employeeIdParamSchema, updateEmployeeSchema } from '../employees/employee-management.validation';
import { PortalReadController } from './portal-read.controller';

const router = Router();
const controller = new PortalReadController();

router.get('/employee-directory', authenticate, authorize('employee.directory.read'), asyncHandler(controller.employeeDirectory));
router.get('/employee-directory/:id', authenticate, authorize('employee.directory.read'), asyncHandler(controller.employeeDirectoryProfile));
router.get('/user-management/users', authenticate, authorize('employee.user.manage'), asyncHandler(controller.userManagementEmployees));
router.get('/user-management/options', authenticate, authorize('employee.user.manage'), asyncHandler(controller.employeeOptions));
router.post('/user-management/users', authenticate, authorize('employee.user.manage'), validateRequest({ body: createEmployeeSchema }), asyncHandler(controller.createEmployee));
router.patch('/user-management/users/:id', authenticate, authorize('employee.user.manage'), validateRequest({ params: employeeIdParamSchema, body: updateEmployeeSchema }), asyncHandler(controller.updateEmployee));
router.delete('/user-management/users/:id', authenticate, authorize('employee.user.manage'), validateRequest({ params: employeeIdParamSchema }), asyncHandler(controller.deleteEmployee));
router.get('/employees', authenticate, authorize('employee.user.manage'), asyncHandler(controller.userManagementEmployees));
router.post('/employees', authenticate, authorize('employee.user.manage'), validateRequest({ body: createEmployeeSchema }), asyncHandler(controller.createEmployee));
router.patch('/employees/:id', authenticate, authorize('employee.user.manage'), validateRequest({ params: employeeIdParamSchema, body: updateEmployeeSchema }), asyncHandler(controller.updateEmployee));
router.delete('/employees/:id', authenticate, authorize('employee.user.manage'), validateRequest({ params: employeeIdParamSchema }), asyncHandler(controller.deleteEmployee));

// Attendance routes
router.get('/attendance', authenticate, authorize('attendance.read'), asyncHandler(controller.attendance));
router.post('/attendance/check-in', authenticate, authorize('attendance.write'), asyncHandler(controller.checkIn));
router.post('/attendance/check-out', authenticate, authorize('attendance.write'), asyncHandler(controller.checkOut));

// Regularization routes
router.get('/attendance/regularizations', authenticate, authorize('attendance.read'), asyncHandler(controller.getRegularizations));
router.post('/attendance/regularizations', authenticate, authorize('attendance.write'), asyncHandler(controller.createRegularization));
router.patch('/attendance/regularizations/:id', authenticate, authorize('attendance.write'), asyncHandler(controller.reviewRegularization));

// Leave routes
router.get('/leaves', authenticate, authorize('leave.read'), asyncHandler(controller.leaves));
router.post('/leaves', authenticate, authorize('leave.write'), asyncHandler(controller.createLeaveRequest));
router.patch('/leaves/:id', authenticate, authorize('leave.approve'), asyncHandler(controller.reviewLeaveRequest));
router.get('/leaves/balances', authenticate, authorize('leave.read'), asyncHandler(controller.leaveBalances));
router.get('/leaves/pending-approvals', authenticate, authorize('leave.approve'), asyncHandler(controller.pendingApprovals));
router.get('/leaves/calendar', authenticate, authorize('leave.read'), asyncHandler(controller.leaveCalendar));
router.post('/leaves/calendar', authenticate, authorize('leave.approve'), asyncHandler(controller.createCalendarEvent));
router.delete('/leaves/calendar/:id', authenticate, authorize('leave.approve'), asyncHandler(controller.deleteCalendarEvent));
router.get('/leave-types', authenticate, authorize('leave.read'), asyncHandler(controller.leaveTypes));
router.post('/leave-types', authenticate, authorize('rbac.manage'), asyncHandler(controller.createLeaveType));
router.patch('/leave-types/:id', authenticate, authorize('rbac.manage'), asyncHandler(controller.updateLeaveType));
router.delete('/leave-types/:id', authenticate, authorize('rbac.manage'), asyncHandler(controller.deleteLeaveType));

// Existing routes
router.get('/jobs', authenticate, authorize('job.read'), asyncHandler(controller.jobs));
router.get('/interviews', authenticate, authorize('interview.manage'), asyncHandler(controller.interviews));
router.get('/onboarding', authenticate, authorize('employee.write'), asyncHandler(controller.onboarding));
router.get('/offer-letters', authenticate, authorize('job.write'), asyncHandler(controller.offerLetters));
router.post('/offer-letters/generate', authenticate, authorize('job.write'), asyncHandler(controller.generateOfferLetter));
router.get('/offer-letters/:id/download', authenticate, authorize('job.write'), asyncHandler(controller.downloadOfferLetter));
router.get('/templates', authenticate, authorize('job.write'), asyncHandler(controller.templates));
router.post('/templates', authenticate, authorize('job.write'), asyncHandler(controller.createTemplate));
router.patch('/templates/:id', authenticate, authorize('job.write'), asyncHandler(controller.updateTemplate));
router.get('/notifications', authenticate, asyncHandler(controller.notifications));
router.get('/activity-logs', authenticate, authorize('rbac.manage'), asyncHandler(controller.activityLogs));
router.get('/audit-logs', authenticate, authorize('rbac.manage'), asyncHandler(controller.auditLogs));
router.get('/settings', authenticate, authorize('rbac.manage'), asyncHandler(controller.getSettings));
router.patch('/settings', authenticate, authorize('rbac.manage'), asyncHandler(controller.updateSettings));
router.get('/config', authenticate, authorize('rbac.manage'), asyncHandler(controller.listAppConfigs));
router.get('/config/:key', authenticate, asyncHandler(controller.getAppConfig));
router.put('/config/:key', authenticate, authorize('rbac.manage'), asyncHandler(controller.updateAppConfig));

export { router as portalReadRoutes };