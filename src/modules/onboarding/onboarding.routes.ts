import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { singleFileUpload } from '../../middlewares/file-upload';
import { OnboardingController } from './onboarding.controller';

const router = Router();
const controller = new OnboardingController();

router.get('/onboarding/config', authenticate, asyncHandler(controller.getConfig));
router.put('/onboarding/config', authenticate, authorize('onboarding.manage.all'), asyncHandler(controller.updateConfig));
router.get('/onboarding/my-progress', authenticate, asyncHandler(controller.getMyProgress));
router.put('/onboarding/my-progress', authenticate, asyncHandler(controller.updateMyProgress));
router.post('/onboarding/submit', authenticate, asyncHandler(controller.submit));
router.post('/onboarding/:employeeId/review', authenticate, authorize('onboarding.manage.all'), asyncHandler(controller.review));
router.post('/onboarding/:employeeId/activate', authenticate, authorize('onboarding.manage.all'), asyncHandler(controller.activate));
router.post(
  '/onboarding/documents/upload',
  authenticate,
  singleFileUpload({
    fieldName: 'file',
    allowedMimeTypes: [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ],
  }),
  asyncHandler(controller.uploadDocument),
);

export { router as onboardingRoutes };
