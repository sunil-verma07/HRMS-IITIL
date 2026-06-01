import { Prisma } from '@prisma/client';
import { ForbiddenError } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../types/authenticated-user';

type AttendanceScope = 'self' | 'team' | 'department' | 'all';

const scopePermissions: Record<AttendanceScope, string[]> = {
  self: ['attendance.read', 'attendance.view.self', 'attendance:read:self'],
  team: ['attendance.view.team', 'attendance:read:team'],
  department: ['attendance.view.department', 'attendance:read:department'],
  all: ['attendance.view.all', 'attendance:read:all'],
};

function hasAnyPermission(user: AuthenticatedUser, permissions: string[]): boolean {
  return permissions.some((permission) => user.permissions.includes(permission));
}

export function resolveAttendanceScope(user: AuthenticatedUser): AttendanceScope {
  if (hasAnyPermission(user, scopePermissions.all)) {
    return 'all';
  }

  if (hasAnyPermission(user, scopePermissions.department)) {
    return 'department';
  }

  if (hasAnyPermission(user, scopePermissions.team)) {
    return 'team';
  }

  return 'self';
}

export function buildAttendanceScopeWhere(
  user: AuthenticatedUser,
  requestedEmployeeId?: string,
): Prisma.AttendanceRecordWhereInput {
  const scope = resolveAttendanceScope(user);

  if (requestedEmployeeId && scope === 'self' && requestedEmployeeId !== user.employeeId) {
    throw new ForbiddenError('Insufficient attendance scope');
  }

  if (scope === 'all') {
    return {
      deletedAt: null,
      ...(requestedEmployeeId ? { employeeId: requestedEmployeeId } : {}),
    };
  }

  if (scope === 'department') {
    return {
      deletedAt: null,
      AND: [
        user.department ? { employee: { department: user.department } } : { employeeId: '__none__' },
        ...(requestedEmployeeId ? [{ employeeId: requestedEmployeeId }] : []),
      ],
    };
  }

  if (scope === 'team') {
    return {
      deletedAt: null,
      AND: [
        {
          OR: [
            ...(user.employeeId ? [{ employeeId: user.employeeId }] : []),
            ...(user.employeeId ? [{ employee: { reportingManagerId: user.employeeId } }] : []),
            ...(user.department ? [{ employee: { department: user.department } }] : []),
          ],
        },
        ...(requestedEmployeeId ? [{ employeeId: requestedEmployeeId }] : []),
      ],
    };
  }

  return {
    deletedAt: null,
    employeeId: user.employeeId ?? '__none__',
    ...(requestedEmployeeId && requestedEmployeeId !== user.employeeId ? { employeeId: '__none__' } : {}),
  };
}
