type PermissionResource =
  | 'attendance'
  | 'leave'
  | 'employee'
  | 'payroll'
  | 'onboarding'
  | 'recruitment'
  | 'interviews'
  | 'documents'
  | 'notifications'
  | 'audit_logs'
  | 'activity_logs'
  | 'templates'
  | 'roles'
  | 'permissions';

type PermissionVerb = 'view' | 'manage';
type ScopeLevel = 'self' | 'team' | 'department' | 'all';

export type PermissionScope = `${PermissionResource}.${PermissionVerb}.${ScopeLevel}`;

export type PermissionLevel = 'none' | 'read' | 'write' | 'manage' | 'full';

export type PermissionAction = 'create' | 'update' | 'delete' | 'export' | 'approve';

export function hasPermission(userScopes: PermissionScope[], required: PermissionScope): boolean {
  return userScopes.includes(required);
}

export function hasAnyPermission(userScopes: PermissionScope[], required: PermissionScope[]): boolean {
  if (required.length === 0) {
    return true;
  }

  return required.some((scope) => userScopes.includes(scope));
}

export function hasAllPermissions(userScopes: PermissionScope[], required: PermissionScope[]): boolean {
  if (required.length === 0) {
    return true;
  }

  return required.every((scope) => userScopes.includes(scope));
}

export function getScopeLevel(scope: PermissionScope): ScopeLevel {
  if (scope.endsWith('.self')) {
    return 'self';
  }

  if (scope.endsWith('.team')) {
    return 'team';
  }

  if (scope.endsWith('.department')) {
    return 'department';
  }

  return 'all';
}
