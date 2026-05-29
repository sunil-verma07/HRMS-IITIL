import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { AuditController } from './audit.controller';

const router = Router();
const controller = new AuditController();

router.get('/activity-logs', authenticate, authorize('rbac.manage'), asyncHandler(controller.activityLogs));
router.get('/audit-logs', authenticate, authorize('rbac.manage'), asyncHandler(controller.auditLogs));

export { router as auditRoutes };