import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validateRequest } from '../../middlewares/validate-request';
import {
	createEmployeeSchema,
	employeeIdParamSchema,
	updateEmployeeSchema,
	updateReportingManagerSchema
} from './employee-management.validation';
import { EmployeeController } from './employee.controller';

const router = Router();
const controller = new EmployeeController();

// Employee directory routes (public within org)
router.get('/employee-directory', authenticate, authorize('employee.directory.read'), asyncHandler(controller.employeeDirectory));
router.get('/employee-directory/:id', authenticate, authorize('employee.directory.read'), asyncHandler(controller.employeeDirectoryProfile));

// User management routes
router.get('/user-management/users', authenticate, authorize('employee.read'), asyncHandler(controller.userManagementEmployees));
router.get('/user-management/options', authenticate, authorize('employee.read'), asyncHandler(controller.employeeOptions));
router.get('/employees/reporting-manager-options', authenticate, authorize('employee.read'), asyncHandler(controller.reportingManagerOptions));
router.post('/user-management/users', authenticate, authorize('employee.write'), validateRequest({ body: createEmployeeSchema }), asyncHandler(controller.createEmployee));
router.patch('/user-management/users/:id', authenticate, authorize('employee.user.manage'), validateRequest({ params: employeeIdParamSchema, body: updateEmployeeSchema }), asyncHandler(controller.updateEmployee));
router.delete('/user-management/users/:id', authenticate, authorize('employee.user.manage'), validateRequest({ params: employeeIdParamSchema }), asyncHandler(controller.deleteEmployee));

// Legacy routes (for backward compatibility)
router.get('/employees', authenticate, authorize('employee.read'), asyncHandler(controller.userManagementEmployees));
router.post('/employees', authenticate, authorize('employee.write'), validateRequest({ body: createEmployeeSchema }), asyncHandler(controller.createEmployee));
router.patch(
	'/employees/:id/reporting-manager',
	authenticate,
	authorize('employee.user.manage'),
	validateRequest({ params: employeeIdParamSchema, body: updateReportingManagerSchema }),
	asyncHandler(controller.updateEmployeeReportingManager)
);
router.patch('/employees/:id', authenticate, authorize('employee.user.manage'), validateRequest({ params: employeeIdParamSchema, body: updateEmployeeSchema }), asyncHandler(controller.updateEmployee));
router.delete('/employees/:id', authenticate, authorize('employee.user.manage'), validateRequest({ params: employeeIdParamSchema }), asyncHandler(controller.deleteEmployee));

export { router as employeeRoutes };