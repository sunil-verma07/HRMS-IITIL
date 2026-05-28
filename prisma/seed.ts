import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const roles = [
  ['SUPER_ADMIN', 'Super Admin'],
  ['PORTAL_ADMIN', 'Portal Admin'],
  ['ADMIN', 'Admin'],
  ['HR_MANAGER', 'HR Manager'],
  ['HR_EXECUTIVE', 'HR Executive'],
  ['HR', 'HR'],
  ['TEAM_LEAD', 'Team Lead'],
  ['EMPLOYEE', 'Employee'],
  ['INTERN', 'Intern']
] as const;

const permissions = [
  ['auth.session.manage', 'auth', 'session.manage'],
  ['rbac.manage', 'rbac', 'manage'],
  ['employee.directory.read', 'employee_directory', 'read'],
  ['employee.user.manage', 'employee_user_management', 'manage'],
  ['employee.visibility.super_admin', 'employee_visibility', 'super_admin'],
  ['employee.read', 'employee', 'read'],
  ['employee.write', 'employee', 'write'],
  ['attendance.read', 'attendance', 'read'],
  ['attendance.write', 'attendance', 'write'],
  ['leave.read', 'leave', 'read'],
  ['leave.write', 'leave', 'write'],
  ['leave.approve', 'leave', 'approve'],
  ['job.read', 'job', 'read'],
  ['job.write', 'job', 'write'],
  ['application.read', 'application', 'read'],
  ['application.write', 'application', 'write'],
  ['interview.manage', 'interview', 'manage'],
  ['dashboard.read', 'dashboard', 'read']
] as const;

const rolePermissions: Record<(typeof roles)[number][0], Array<(typeof permissions)[number][0]>> = {
  SUPER_ADMIN: permissions.map(([code]) => code),
  PORTAL_ADMIN: permissions
    .map(([code]) => code)
    .filter((code) => code !== 'employee.visibility.super_admin'),
  ADMIN: permissions
    .map(([code]) => code)
    .filter((code) => code !== 'employee.visibility.super_admin'),
  HR_MANAGER: [
    'employee.directory.read',
    'employee.user.manage',
    'employee.read',
    'employee.write',
    'attendance.read',
    'leave.read',
    'leave.write',
    'leave.approve',
    'job.read',
    'job.write',
    'application.read',
    'application.write',
    'interview.manage',
    'dashboard.read'
  ],
  HR_EXECUTIVE: [
    'employee.directory.read',
    'employee.user.manage',
    'employee.read',
    'employee.write',
    'attendance.read',
    'leave.read',
    'leave.write',
    'leave.approve',
    'job.read',
    'application.read',
    'application.write',
    'interview.manage',
    'dashboard.read'
  ],
  HR: [
    'employee.directory.read',
    'employee.user.manage',
    'employee.read',
    'employee.write',
    'attendance.read',
    'leave.read',
    'leave.write',
    'leave.approve',
    'job.read',
    'job.write',
    'application.read',
    'application.write',
    'interview.manage',
    'dashboard.read'
  ],
  TEAM_LEAD: [
    'employee.directory.read',
    'employee.read',
    'attendance.read',
    'leave.read',
    'leave.approve',
    'application.read',
    'interview.manage',
    'dashboard.read'
  ],
  EMPLOYEE: ['employee.directory.read', 'attendance.write', 'leave.write', 'dashboard.read'],
  INTERN: ['employee.directory.read', 'attendance.write', 'leave.write', 'dashboard.read']
};

const roleHierarchy: Record<(typeof roles)[number][0], number> = {
  SUPER_ADMIN: 10,
  PORTAL_ADMIN: 20,
  ADMIN: 20,
  HR_MANAGER: 30,
  HR: 30,
  HR_EXECUTIVE: 35,
  TEAM_LEAD: 50,
  EMPLOYEE: 80,
  INTERN: 90
};

const demoUsers = [
  {
    userId: 'admin',
    employeeId: 'IITIL-0001',
    firstName: 'System',
    lastName: 'Admin',
    email: 'admin@iitil.com',
    designation: 'Super Admin',
    department: 'Administration',
    roleCode: 'SUPER_ADMIN'
  },
  {
    userId: 'portal.admin',
    employeeId: 'IITIL-0002',
    firstName: 'Portal',
    lastName: 'Admin',
    email: 'portal.admin@iitil.com',
    designation: 'Admin',
    department: 'Administration',
    roleCode: 'PORTAL_ADMIN'
  },
  {
    userId: 'hr',
    employeeId: 'IITIL-0003',
    firstName: 'Human',
    lastName: 'Resources',
    email: 'hr@iitil.com',
    designation: 'HR Manager',
    department: 'Human Resources',
    roleCode: 'HR_MANAGER'
  },
  {
    userId: 'hr.executive',
    employeeId: 'IITIL-0006',
    firstName: 'HR',
    lastName: 'Executive',
    email: 'hr.executive@iitil.com',
    designation: 'HR Executive',
    department: 'Human Resources',
    roleCode: 'HR_EXECUTIVE'
  },
  {
    userId: 'teamlead',
    employeeId: 'IITIL-0004',
    firstName: 'Team',
    lastName: 'Lead',
    email: 'teamlead@iitil.com',
    designation: 'Team Lead',
    department: 'Engineering',
    roleCode: 'TEAM_LEAD'
  },
  {
    userId: 'employee',
    employeeId: 'IITIL-0005',
    firstName: 'Demo',
    lastName: 'Employee',
    email: 'employee@iitil.com',
    designation: 'Software Engineer',
    department: 'Engineering',
    roleCode: 'EMPLOYEE'
  },
  {
    userId: 'intern',
    employeeId: 'IITIL-0007',
    firstName: 'Demo',
    lastName: 'Intern',
    email: 'intern@iitil.com',
    designation: 'Software Intern',
    department: 'Engineering',
    roleCode: 'INTERN',
    employmentType: 'INTERN'
  }
] as const;

const demoPassword = 'IITIL@12345';

async function main(): Promise<void> {
  for (const [code, name] of roles) {
    await prisma.role.upsert({
      where: { code },
      update: { name, isSystem: true },
      create: { code, name, isSystem: true }
    });

    await prisma.$executeRaw`
      UPDATE "roles"
      SET "hierarchyLevel" = ${roleHierarchy[code]}
      WHERE "code" = ${code}
    `;
  }

  for (const [code, resource, action] of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: { resource, action },
      create: { code, resource, action }
    });
  }

  const persistedRoles = await prisma.role.findMany();
  const persistedPermissions = await prisma.permission.findMany();
  const roleByCode = new Map(persistedRoles.map((role) => [role.code, role]));
  const permissionByCode = new Map(persistedPermissions.map((permission) => [permission.code, permission]));

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissions)) {
    const role = roleByCode.get(roleCode);

    if (!role) {
      continue;
    }

    await prisma.rolePermission.createMany({
      data: permissionCodes.flatMap((permissionCode) => {
        const permission = permissionByCode.get(permissionCode);
        return permission ? [{ roleId: role.id, permissionId: permission.id }] : [];
      }),
      skipDuplicates: true
    });
  }

  const passwordHash = await hash(demoPassword, 12);

  for (const demoUser of demoUsers) {
    const employee = await prisma.employee.upsert({
      where: { employeeId: demoUser.employeeId },
      update: {
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        email: demoUser.email,
        designation: demoUser.designation,
        department: demoUser.department,
        status: 'ACTIVE',
        deletedAt: null
      },
      create: {
        employeeId: demoUser.employeeId,
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        email: demoUser.email,
        designation: demoUser.designation,
        department: demoUser.department,
        joiningDate: new Date(),
        employmentType: 'employmentType' in demoUser ? demoUser.employmentType : 'FULL_TIME'
      }
    });

    const user = await prisma.user.upsert({
      where: { userId: demoUser.userId },
      update: {
        passwordHash,
        status: 'ACTIVE',
        forcePasswordReset: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        employeeId: employee.id,
        deletedAt: null
      },
      create: {
        userId: demoUser.userId,
        passwordHash,
        status: 'ACTIVE',
        forcePasswordReset: false,
        employeeId: employee.id
      }
    });

    const role = roleByCode.get(demoUser.roleCode);

    if (role) {
      await prisma.userRole.createMany({
        data: [{ userId: user.id, roleId: role.id }],
        skipDuplicates: true
      });
    }
  }

  console.info(`Seeded demo users with password: ${demoPassword}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
