import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validateRequest } from '../../middlewares/validate-request';
import { RbacController } from './rbac.controller';
import {
  assignRoleSchema,
  attachPermissionSchema,
  createRoleSchema,
  roleIdParamSchema,
  rolePermissionParamSchema,
  setRolePermissionSchema,
  updateRoleSchema
} from './rbac.validation';

const router = Router();
const controller = new RbacController();

router.use(authenticate, authorize('rbac.manage'));
router.get('/roles', asyncHandler(controller.listRoles));
router.post('/roles', validateRequest({ body: createRoleSchema }), asyncHandler(controller.createRole));
router.patch('/roles/:id', validateRequest({ params: roleIdParamSchema, body: updateRoleSchema }), asyncHandler(controller.updateRole));
router.delete('/roles/:id', validateRequest({ params: roleIdParamSchema }), asyncHandler(controller.deleteRole));
router.get('/permissions', asyncHandler(controller.listPermissions));
router.post('/assign-role', validateRequest({ body: assignRoleSchema }), asyncHandler(controller.assignRole));
router.post('/attach-permission', validateRequest({ body: attachPermissionSchema }), asyncHandler(controller.attachPermission));
router.put(
  '/roles/:roleId/permissions/:permissionId',
  validateRequest({ params: rolePermissionParamSchema, body: setRolePermissionSchema }),
  asyncHandler(controller.setRolePermission)
);

export { router as rbacRoutes };
