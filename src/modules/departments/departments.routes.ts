import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { authenticate } from '../../middlewares/authenticate';
import { validateRequest } from '../../middlewares/validate-request';
import { DepartmentsController } from './departments.controller';
import {
  assignDepartmentEmployeeSchema,
  createDepartmentSchema,
  departmentIdParamSchema,
  updateDepartmentSchema
} from './departments.validation';

const router = Router();
const controller = new DepartmentsController();

router.get('/departments', authenticate, asyncHandler(controller.listDepartments));
router.get(
  '/departments/:id',
  authenticate,
  validateRequest({ params: departmentIdParamSchema }),
  asyncHandler(controller.getDepartment)
);
router.get(
  '/departments/:id/teams',
  authenticate,
  validateRequest({ params: departmentIdParamSchema }),
  asyncHandler(controller.getDepartmentTeams)
);

router.post(
  '/departments',
  authenticate,
  validateRequest({ body: createDepartmentSchema }),
  asyncHandler(controller.createDepartment)
);
router.patch(
  '/departments/:id',
  authenticate,
  validateRequest({ params: departmentIdParamSchema, body: updateDepartmentSchema }),
  asyncHandler(controller.updateDepartment)
);
router.delete(
  '/departments/:id',
  authenticate,
  validateRequest({ params: departmentIdParamSchema }),
  asyncHandler(controller.deleteDepartment)
);

router.post(
  '/departments/:id/employees',
  authenticate,
  validateRequest({ params: departmentIdParamSchema, body: assignDepartmentEmployeeSchema }),
  asyncHandler(controller.assignEmployeeToDepartment)
);

export { router as departmentsRoutes };
