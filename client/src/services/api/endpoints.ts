export const endpoints = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    changePassword: '/auth/change-password',
    me: '/auth/me'
  },
  dashboard: {
    stats: '/dashboard/stats',
    activity: '/dashboard/activity',
    notifications: '/notifications'
  },
  employeeDirectory: '/employee-directory',
  userManagement: {
    users: '/user-management/users'
  },
  employees: '/employees',
  attendance: '/attendance',
  leaves: '/leaves',
  recruitment: {
    jobs: '/jobs',
    candidates: '/candidates',
    applications: '/applications',
    interviews: '/interviews'
  },
  onboarding: '/onboarding',
  offerLetters: '/offer-letters',
  templates: '/templates',
  roles: '/rbac/roles',
  permissions: '/rbac/permissions',
  settings: '/settings',
  activityLogs: '/activity-logs',
  auditLogs: '/audit-logs',
  profile: '/profile'
} as const;
