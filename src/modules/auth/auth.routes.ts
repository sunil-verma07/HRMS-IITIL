import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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

const authRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', authRateLimit, validateRequest({ body: loginSchema }), asyncHandler(controller.login));
router.post('/refresh', authRateLimit, validateRequest({ body: refreshTokenSchema.partial() }), asyncHandler(controller.refresh));
router.post('/forgot-password', authRateLimit, validateRequest({ body: forgotPasswordSchema }), asyncHandler(controller.forgotPassword));
router.post('/reset-password', validateRequest({ body: resetPasswordSchema }), asyncHandler(controller.resetPassword));
router.post('/logout', authenticate, asyncHandler(controller.logout));
router.post('/change-password', authenticate, validateRequest({ body: changePasswordSchema }), asyncHandler(controller.changePassword));
router.get('/me', authenticate, asyncHandler(controller.me));

export { router as authRoutes };
