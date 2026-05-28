import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/guards/ProtectedRoute';
import { PageSkeleton } from '@/components/loaders/PageSkeleton';
import { permissions } from '@/constants/permissions';
import { LoginPage } from '@/modules/auth/LoginPage';

const AppShell = lazy(() => import('@/layouts/AppShell').then((module) => ({ default: module.AppShell })));
const ForgotPasswordPage = lazy(() => import('@/modules/auth/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/modules/auth/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));
const SessionExpiredPage = lazy(() => import('@/modules/auth/SessionExpiredPage').then((module) => ({ default: module.SessionExpiredPage })));
const ChangePasswordPage = lazy(() => import('@/modules/auth/ChangePasswordPage').then((module) => ({ default: module.ChangePasswordPage })));
const DashboardPage = lazy(() => import('@/modules/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const EmployeeDirectoryPage = lazy(() => import('@/modules/employee-directory/EmployeeDirectoryPage').then((module) => ({ default: module.EmployeeDirectoryPage })));
const UserManagementPage = lazy(() => import('@/modules/user-management/UserManagementPage').then((module) => ({ default: module.UserManagementPage })));
const AttendancePage = lazy(() => import('@/modules/attendance/AttendancePage').then((module) => ({ default: module.AttendancePage })));
const LeavesPage = lazy(() => import('@/modules/leaves/LeavesPage').then((module) => ({ default: module.LeavesPage })));
const RecruitmentPage = lazy(() => import('@/modules/recruitment/RecruitmentPage').then((module) => ({ default: module.RecruitmentPage })));
const InterviewsPage = lazy(() => import('@/modules/interviews/InterviewsPage').then((module) => ({ default: module.InterviewsPage })));
const OnboardingPage = lazy(() => import('@/modules/onboarding/OnboardingPage').then((module) => ({ default: module.OnboardingPage })));
const OfferLettersPage = lazy(() => import('@/modules/offer-letters/OfferLettersPage').then((module) => ({ default: module.OfferLettersPage })));
const TemplatesPage = lazy(() => import('@/modules/templates/TemplatesPage').then((module) => ({ default: module.TemplatesPage })));
const RolesPage = lazy(() => import('@/modules/roles/RolesPage').then((module) => ({ default: module.RolesPage })));
const PermissionsPage = lazy(() => import('@/modules/permissions/PermissionsPage').then((module) => ({ default: module.PermissionsPage })));
const NotificationsPage = lazy(() => import('@/modules/notifications/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const SettingsPage = lazy(() => import('@/modules/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const ActivityLogsPage = lazy(() => import('@/modules/activity-logs/ActivityLogsPage').then((module) => ({ default: module.ActivityLogsPage })));
const AuditLogsPage = lazy(() => import('@/modules/audit-logs/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })));
const ProfilePage = lazy(() => import('@/modules/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })));

function lazyElement(element: ReactNode) {
  return <Suspense fallback={<PageSkeleton />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: lazyElement(<ForgotPasswordPage />) },
  { path: '/reset-password', element: lazyElement(<ResetPasswordPage />) },
  { path: '/session-expired', element: lazyElement(<SessionExpiredPage />) },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: lazyElement(<AppShell />),
        children: [
          { path: '/change-password', element: lazyElement(<ChangePasswordPage />) },
          { path: '/dashboard', element: lazyElement(<DashboardPage />) },
          {
            element: <ProtectedRoute permissions={[permissions.employeeDirectoryRead]} />,
            children: [{ path: '/employee-directory', element: lazyElement(<EmployeeDirectoryPage />) }]
          },
          {
            element: <ProtectedRoute permissions={[permissions.employeeUserManage]} />,
            children: [
              { path: '/user-management', element: lazyElement(<UserManagementPage />) },
              { path: '/employees', element: lazyElement(<UserManagementPage />) }
            ]
          },
          {
            element: <ProtectedRoute permissions={[permissions.attendanceRead]} />,
            children: [{ path: '/attendance', element: lazyElement(<AttendancePage />) }]
          },
          {
            element: <ProtectedRoute permissions={[permissions.leaveRead]} />,
            children: [{ path: '/leaves', element: lazyElement(<LeavesPage />) }]
          },
          {
            element: <ProtectedRoute permissions={[permissions.jobRead, permissions.applicationRead]} />,
            children: [{ path: '/recruitment', element: lazyElement(<RecruitmentPage />) }]
          },
          {
            element: <ProtectedRoute permissions={[permissions.interviewManage]} />,
            children: [{ path: '/interviews', element: lazyElement(<InterviewsPage />) }]
          },
          {
            element: <ProtectedRoute permissions={[permissions.employeeWrite]} />,
            children: [{ path: '/onboarding', element: lazyElement(<OnboardingPage />) }]
          },
          {
            element: <ProtectedRoute permissions={[permissions.jobWrite]} />,
            children: [
              { path: '/offer-letters', element: lazyElement(<OfferLettersPage />) },
              { path: '/templates', element: lazyElement(<TemplatesPage />) }
            ]
          },
          {
            element: <ProtectedRoute permissions={[permissions.rbacManage]} />,
            children: [
              { path: '/roles', element: lazyElement(<RolesPage />) },
              { path: '/permissions', element: lazyElement(<PermissionsPage />) },
              { path: '/settings', element: lazyElement(<SettingsPage />) },
              { path: '/activity-logs', element: lazyElement(<ActivityLogsPage />) },
              { path: '/audit-logs', element: lazyElement(<AuditLogsPage />) }
            ]
          },
          { path: '/notifications', element: lazyElement(<NotificationsPage />) },
          { path: '/profile', element: lazyElement(<ProfilePage />) }
        ]
      }
    ]
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> }
]);
