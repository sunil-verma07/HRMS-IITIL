import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { authenticate } from '../../middlewares/authenticate';
import { validateRequest } from '../../middlewares/validate-request';
import { AuthController } from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordSchema
} from './auth.validation';

const router = Router();
const controller = new AuthController();

router.post('/login', validateRequest({ body: loginSchema }), asyncHandler(controller.login));
router.post('/refresh', validateRequest({ body: refreshTokenSchema.partial() }), asyncHandler(controller.refresh));
router.post('/forgot-password', validateRequest({ body: forgotPasswordSchema }), asyncHandler(controller.forgotPassword));
router.post('/reset-password', validateRequest({ body: resetPasswordSchema }), asyncHandler(controller.resetPassword));
router.post('/logout', authenticate, asyncHandler(controller.logout));
router.post('/change-password', authenticate, validateRequest({ body: changePasswordSchema }), asyncHandler(controller.changePassword));
router.get('/me', authenticate, asyncHandler(controller.me));

export { router as authRoutes };
