import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';
import { dashboardRoutes } from '../modules/dashboard/dashboard.routes';
import { portalReadRoutes } from '../modules/portal-read/portal-read.routes';
import { rbacRoutes } from '../modules/rbac/rbac.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/rbac', rbacRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/', portalReadRoutes);

router.get('/health', (_request, response) => {
  response.json({
    success: true,
    message: 'IITIL Portal API is healthy',
    data: {
      uptime: process.uptime()
    }
  });
});

export { router as v1Routes };
