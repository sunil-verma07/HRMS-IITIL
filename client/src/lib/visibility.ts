import type { UserProfile } from '@/types';
import type { PermissionScope } from './permissions';
import { getScopeLevel } from './permissions';

type VisibilityScope = 'self' | 'team' | 'department' | 'all';

export function filterByScope<
  T extends { createdBy?: string; department?: string; reportingManagerId?: string }
>(
  items: T[],
  scope: VisibilityScope,
  currentUserId: string,
  currentUserDepartment: string,
  directReportIds: string[]
): T[] {
  const directReportSet = new Set(directReportIds);

  if (scope === 'all') {
    return [...items];
  }

  if (scope === 'self') {
    return items.filter((item) => item.createdBy === currentUserId);
  }

  if (scope === 'team') {
    return items.filter(
      (item) =>
        item.createdBy === currentUserId ||
        (typeof item.createdBy === 'string' && directReportSet.has(item.createdBy)) ||
        item.reportingManagerId === currentUserId
    );
  }

  return items.filter(
    (item) =>
      item.department === currentUserDepartment ||
      item.createdBy === currentUserId ||
      (typeof item.createdBy === 'string' && directReportSet.has(item.createdBy))
  );
}

export function canViewEmployee(viewer: UserProfile, target: UserProfile, scope: PermissionScope): boolean {
  const level = getScopeLevel(scope);

  if (level === 'all') {
    return true;
  }

  if (level === 'self') {
    return viewer.id === target.id;
  }

  if (level === 'team') {
    return target.id === viewer.id || target.reportingManagerId === viewer.id;
  }

  if (!viewer.departmentId || !target.departmentId) {
    return target.id === viewer.id;
  }

  return viewer.departmentId === target.departmentId;
}

function getBestEmployeeViewScope(permissions: PermissionScope[]): VisibilityScope {
  const preference: PermissionScope[] = [
    'employee.view.all',
    'employee.view.department',
    'employee.view.team',
    'employee.view.self'
  ];

  const selected = preference.find((scope) => permissions.includes(scope));

  if (!selected) {
    return 'self';
  }

  return getScopeLevel(selected);
}

export function getVisibleEmployeeIds(viewer: UserProfile, allEmployees: UserProfile[]): string[] {
  const visibilityScope = getBestEmployeeViewScope(viewer.permissions);
  const scopeMap: Record<VisibilityScope, PermissionScope> = {
    self: 'employee.view.self',
    team: 'employee.view.team',
    department: 'employee.view.department',
    all: 'employee.view.all'
  };
  const selectedScope = scopeMap[visibilityScope];

  return allEmployees
    .filter((employee) => canViewEmployee(viewer, employee, selectedScope))
    .map((employee) => employee.id);
}
