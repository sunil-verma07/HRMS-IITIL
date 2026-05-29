import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { SettingsController } from './settings.controller';

const router = Router();
const controller = new SettingsController();

router.get('/settings', authenticate, authorize('rbac.manage'), asyncHandler(controller.getSettings));
router.patch('/settings', authenticate, authorize('rbac.manage'), asyncHandler(controller.updateSettings));
router.get('/config', authenticate, authorize('rbac.manage'), asyncHandler(controller.listAppConfigs));
router.get('/config/:key', authenticate, asyncHandler(controller.getAppConfig));
router.put('/config/:key', authenticate, authorize('rbac.manage'), asyncHandler(controller.updateAppConfig));

export { router as settingsRoutes };