import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../common/utils/async-handler';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { OfferLetterController } from './offer-letter.controller';

const router = Router();
const controller = new OfferLetterController();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/offer-letters', authenticate, authorize('job.write'), asyncHandler(controller.offerLetters));
router.post('/offer-letters/generate', authenticate, authorize('job.write'), asyncHandler(controller.generateOfferLetter));
router.get('/offer-letters/:id/download', authenticate, authorize('job.write'), asyncHandler(controller.downloadOfferLetter));

router.get('/templates', authenticate, authorize('job.write'), asyncHandler(controller.templates));
router.post('/templates', authenticate, authorize('job.write'), asyncHandler(controller.createTemplate));
router.patch('/templates/:id', authenticate, authorize('job.write'), asyncHandler(controller.updateTemplate));
router.patch('/templates/:id/set-default', authenticate, authorize('job.write'), asyncHandler(controller.setDefaultTemplate));
router.delete('/templates/:id', authenticate, authorize('job.write'), asyncHandler(controller.deleteTemplate));
router.post('/templates/upload-image', authenticate, authorize('job.write'), upload.single('image'), asyncHandler(controller.uploadTemplateImage));

export { router as offerLetterRoutes };