import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';
import { dashboardRoutes } from '../modules/dashboard/dashboard.routes';
import { rbacRoutes } from '../modules/rbac/rbac.routes';
import { employeeRoutes } from '../modules/employees/employee.routes';
import { attendanceRoutes } from '../modules/attendance/attendance.routes';
import { leaveRoutes } from '../modules/leaves/leave.routes';
import { recruitmentRoutes } from '../modules/recruitment/recruitment.routes';
import { offerLetterRoutes } from '../modules/offer-letter/offer-letter.routes';
import { notificationRoutes } from '../modules/notifications/notification.routes';
import { auditRoutes } from '../modules/audit/audit.routes';
import { settingsRoutes } from '../modules/settings/settings.routes';
import { portalReadRoutes } from '../modules/portal-read/portal-read.routes';
import { peopleRoutes } from '../modules/people/people.routes';
import { onboardingRoutes } from '../modules/onboarding/onboarding.routes';
import { departmentsRoutes } from '../modules/departments/departments.routes';

const router = Router();

// Auth & RBAC
router.use('/auth', authRoutes);
router.use('/rbac', rbacRoutes);

// Dashboard
router.use('/dashboard', dashboardRoutes);

// Core Modules
router.use('/', employeeRoutes);
router.use('/', peopleRoutes);
router.use('/', attendanceRoutes);
router.use('/', leaveRoutes);
router.use('/', onboardingRoutes);

// Recruitment & Documents
router.use('/', recruitmentRoutes);
router.use('/', offerLetterRoutes);

// System Modules
router.use('/', notificationRoutes);
router.use('/', auditRoutes);
router.use('/', settingsRoutes);
router.use('/', departmentsRoutes);

// Deprecated module (kept for backward compatibility)
router.use('/', portalReadRoutes);

// Health check
router.get('/health', (_request, response) => {
  response.json({
    success: true,
    message: 'IITIL Portal API is healthy',
    data: { uptime: process.uptime() }
  });
});

export { router as v1Routes };