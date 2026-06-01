import type { Prisma } from '@prisma/client';
import { getHighestScope } from '../../common/utils/scope-filter';
import type { AuthenticatedUser } from '../../types/authenticated-user';

function hasScopedActionPermission(permissions: string[], resource: string, action: string): boolean {
  return permissions.some((permission) => permission.startsWith(`${resource}:${action}:`));
}

function getLegacyScope(permissions: string[], resource: string, action: 'read' | 'write' | 'manage'): 'none' | 'self' | 'team' | 'department' | 'all' {
  const codes = new Set(permissions);

  if (resource !== 'employee') {
    return 'none';
  }

  if (action === 'read') {
    if (codes.has('employee.read') || codes.has('employee.directory.read')) {
      return 'all';
    }
    return 'none';
  }

  if (action === 'write') {
    if (codes.has('employee.write') || codes.has('employee.user.manage')) {
      return 'all';
    }
    return 'none';
  }

  if (codes.has('employee.user.manage')) {
    return 'all';
  }

  return 'none';
}

function buildRoleExclusionFilter(viewerRoles: string[]): Prisma.EmployeeWhereInput {
  const alwaysHidden = ['SUPER_ADMIN'];
  const hiddenFromNonAdmin = ['SUPER_ADMIN', 'ADMIN'];
  const hiddenFromHR = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'HR', 'HR_EXECUTIVE'];
  const hiddenFromTeamLead = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'HR', 'HR_EXECUTIVE', 'TEAM_LEAD'];

  const isSuperAdmin = viewerRoles.includes('SUPER_ADMIN');
  const isAdmin = viewerRoles.includes('ADMIN');
  const isHRManager = viewerRoles.includes('HR_MANAGER');
  const isHR = viewerRoles.includes('HR') || viewerRoles.includes('HR_EXECUTIVE');
  const isTeamLead = viewerRoles.includes('TEAM_LEAD');

  let excludedRoles: string[];

  if (isSuperAdmin) {
    excludedRoles = alwaysHidden;
  } else if (isAdmin) {
    excludedRoles = hiddenFromNonAdmin;
  } else if (isHRManager || isHR) {
    excludedRoles = hiddenFromHR;
  } else if (isTeamLead) {
    excludedRoles = hiddenFromTeamLead;
  } else {
    excludedRoles = hiddenFromTeamLead;
  }

  if (excludedRoles.length === 0) {
    return {};
  }

  return {
    OR: [
      { user: null },
      {
        user: {
          roles: {
            none: {
              role: {
                code: { in: excludedRoles },
                deletedAt: null
              }
            }
          }
        }
      }
    ]
  };
}

export const publicEmployeeSelect = {
  id: true,
  employeeId: true,
  profilePhoto: true,
  firstName: true,
  lastName: true,
  email: true,
  designation: true,
  department: true,
  joiningDate: true,
  reportingManager: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      designation: true,
      department: true,
      email: true,
      profilePhoto: true
    }
  }
} satisfies Prisma.EmployeeSelect;

export const userManagementEmployeeSelect = {
  id: true,
  employeeId: true,
  profilePhoto: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  designation: true,
  department: true,
  joiningDate: true,
  employmentType: true,
  reportingManagerId: true,
  status: true,
  emergencyContact: true,
  address: true,
  createdAt: true,
  updatedAt: true,
  reportingManager: {
    select: publicEmployeeSelect
  },
  user: {
    select: {
      id: true,
      userId: true,
      status: true,
      forcePasswordReset: true,
      lastLoginAt: true,
      roles: {
        select: {
          role: {
            select: {
              code: true,
              name: true
            }
          }
        }
      }
    }
  }
} satisfies Prisma.EmployeeSelect;

export function buildEmployeeSearchWhere(search?: string): Prisma.EmployeeWhereInput {
  if (!search) {
    return {};
  }

  return {
    OR: [
      { employeeId: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { department: { contains: search, mode: 'insensitive' } },
      { designation: { contains: search, mode: 'insensitive' } }
    ]
  };
}

export function buildDirectoryVisibilityWhere(user: AuthenticatedUser): Prisma.EmployeeWhereInput {
  const isSuperAdmin = user.roles.includes('SUPER_ADMIN');
  const isAdmin = user.roles.includes('ADMIN');
  const roleExclusion = buildRoleExclusionFilter(user.roles);

  if (isSuperAdmin) {
    return roleExclusion;
  }

  if (isAdmin) {
    return roleExclusion;
  }

  let readScope = getHighestScope(user.permissions, 'employee', 'read');
  if (readScope === 'none' && !hasScopedActionPermission(user.permissions, 'employee', 'read')) {
    readScope = getLegacyScope(user.permissions, 'employee', 'read');
  }

  switch (readScope) {
    case 'all':
      return roleExclusion;
    case 'department':
      return {
        AND: [roleExclusion, { department: user.department ?? '__none__' }]
      };
    case 'team':
      return {
        AND: [roleExclusion, { reportingManagerId: user.employeeId ?? '__none__' }]
      };
    case 'self':
      return { id: user.employeeId ?? '__none__' };
    default:
      return { id: '__none__' };
  }
}

export function buildUserManagementVisibilityWhere(user: AuthenticatedUser): Prisma.EmployeeWhereInput {
  const isSuperAdmin = user.roles.includes('SUPER_ADMIN');
  const isAdmin = user.roles.includes('ADMIN');
  const roleExclusion = buildRoleExclusionFilter(user.roles);

  if (isSuperAdmin) {
    return roleExclusion;
  }

  if (isAdmin) {
    return roleExclusion;
  }

  let manageScope = getHighestScope(user.permissions, 'employee', 'manage');
  if (manageScope === 'none' && !hasScopedActionPermission(user.permissions, 'employee', 'manage')) {
    manageScope = getHighestScope(user.permissions, 'employee', 'write');
  }

  if (
    manageScope === 'none' &&
    !hasScopedActionPermission(user.permissions, 'employee', 'manage') &&
    !hasScopedActionPermission(user.permissions, 'employee', 'write')
  ) {
    manageScope = getLegacyScope(user.permissions, 'employee', 'manage');
    if (manageScope === 'none') {
      manageScope = getLegacyScope(user.permissions, 'employee', 'write');
    }
  }

  switch (manageScope) {
    case 'all':
      return roleExclusion;
    case 'department':
      return {
        AND: [roleExclusion, { department: user.department ?? '__none__' }]
      };
    case 'team':
      return {
        AND: [roleExclusion, { reportingManagerId: user.employeeId ?? '__none__' }]
      };
    case 'self':
      return { id: user.employeeId ?? '__none__' };
    default:
      return { id: '__none__' };
  }
}
