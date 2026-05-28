import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../types/authenticated-user';

const superAdminRoles = ['SUPER_ADMIN'];
const portalAdminRoles = ['PORTAL_ADMIN', 'ADMIN'];
const hrRoles = ['HR_MANAGER', 'HR_EXECUTIVE', 'HR'];
const teamLeadRoles = ['TEAM_LEAD'];
const employeeRoles = ['EMPLOYEE', 'INTERN'];
const publicDirectoryRoles = ['TEAM_LEAD', 'EMPLOYEE', 'INTERN'];

function hasAnyRole(user: AuthenticatedUser, roles: string[]): boolean {
  return roles.some((role) => user.roles.includes(role));
}

function roleIn(codes: string[]): Prisma.EmployeeWhereInput {
  return {
    user: {
      roles: {
        some: {
          role: {
            code: {
              in: codes
            },
            deletedAt: null
          }
        }
      }
    }
  };
}

function roleNotIn(codes: string[]): Prisma.EmployeeWhereInput {
  return {
    OR: [
      {
        user: null
      },
      {
        user: {
          roles: {
            none: {
              role: {
                code: {
                  in: codes
                }
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
  if (hasAnyRole(user, superAdminRoles)) {
    return {};
  }

  if (hasAnyRole(user, portalAdminRoles)) {
    return user.permissions.includes('employee.visibility.super_admin') ? {} : roleNotIn(superAdminRoles);
  }

  if (hasAnyRole(user, hrRoles)) {
    return roleIn(publicDirectoryRoles);
  }

  if (hasAnyRole(user, teamLeadRoles)) {
    return {
      AND: [
        roleIn(publicDirectoryRoles),
        {
          OR: [
            ...(user.employeeId ? [{ id: user.employeeId }, { reportingManagerId: user.employeeId }] : []),
            ...(user.department ? [{ department: user.department }] : [])
          ]
        }
      ]
    };
  }

  if (hasAnyRole(user, employeeRoles)) {
    return roleIn(publicDirectoryRoles);
  }

  return {
    employeeId: '__none__'
  };
}

export function buildUserManagementVisibilityWhere(user: AuthenticatedUser): Prisma.EmployeeWhereInput {
  if (hasAnyRole(user, superAdminRoles)) {
    return {};
  }

  if (hasAnyRole(user, portalAdminRoles)) {
    return user.permissions.includes('employee.visibility.super_admin') ? {} : roleNotIn(superAdminRoles);
  }

  if (hasAnyRole(user, hrRoles)) {
    return roleIn(publicDirectoryRoles);
  }

  if (hasAnyRole(user, teamLeadRoles)) {
    return {
      AND: [
        roleIn(employeeRoles),
        user.employeeId
          ? {
          reportingManagerId: user.employeeId
            }
          : {
              employeeId: '__none__'
            }
      ]
    };
  }

  return user.employeeId ? { id: user.employeeId } : { employeeId: '__none__' };
}
