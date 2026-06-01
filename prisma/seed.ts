// prisma/seed.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const roles = [
  ["SUPER_ADMIN", "Super Admin"],
  ["PORTAL_ADMIN", "Portal Admin"],
  ["ADMIN", "Admin"],
  ["HR_MANAGER", "HR Manager"],
  ["HR_EXECUTIVE", "HR Executive"],
  ["HR", "HR"],
  ["TEAM_LEAD", "Team Lead"],
  ["EMPLOYEE", "Employee"],
  ["INTERN", "Intern"],
] as const;

const permissions = [
  ["auth.session.manage", "auth", "session.manage"],
  ["rbac.manage", "rbac", "manage"],
  ["employee.directory.read", "employee_directory", "read"],
  ["employee.user.manage", "employee_user_management", "manage"],
  ["employee.visibility.super_admin", "employee_visibility", "super_admin"],
  ["employee.read", "employee", "read"],
  ["employee.write", "employee", "write"],
  ["attendance.read", "attendance", "read"],
  ["attendance.write", "attendance", "write"],
  ["leave.read", "leave", "read"],
  ["leave.write", "leave", "write"],
  ["leave.approve", "leave", "approve"],
  ["job.read", "job", "read"],
  ["job.write", "job", "write"],
  ["application.read", "application", "read"],
  ["application.write", "application", "write"],
  ["interview.manage", "interview", "manage"],
  ["dashboard.read", "dashboard", "read"],
] as const;

const rolePermissions: Record<
  (typeof roles)[number][0],
  Array<(typeof permissions)[number][0]>
> = {
  SUPER_ADMIN: permissions.map(([code]) => code),
  PORTAL_ADMIN: [],
  ADMIN: [],
  HR_MANAGER: [],
  HR_EXECUTIVE: [],
  HR: [],
  TEAM_LEAD: [],
  EMPLOYEE: [],
  INTERN: [],
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
  INTERN: 90,
};

const demoUsers = [
  {
    userId: "admin",
    employeeId: "IITIL-0001",
    firstName: "System",
    lastName: "Admin",
    email: "admin@iitil.com",
    designation: "Super Admin",
    department: "Administration",
    roleCode: "SUPER_ADMIN",
  },
  {
    userId: "portal.admin",
    employeeId: "IITIL-0002",
    firstName: "Portal",
    lastName: "Admin",
    email: "portal.admin@iitil.com",
    designation: "Admin",
    department: "Administration",
    roleCode: "PORTAL_ADMIN",
  },
  {
    userId: "hr",
    employeeId: "IITIL-0003",
    firstName: "Human",
    lastName: "Resources",
    email: "hr@iitil.com",
    designation: "HR Manager",
    department: "Human Resources",
    roleCode: "HR_MANAGER",
  },
  {
    userId: "hr.executive",
    employeeId: "IITIL-0006",
    firstName: "HR",
    lastName: "Executive",
    email: "hr.executive@iitil.com",
    designation: "HR Executive",
    department: "Human Resources",
    roleCode: "HR_EXECUTIVE",
  },
  {
    userId: "teamlead",
    employeeId: "IITIL-0004",
    firstName: "Team",
    lastName: "Lead",
    email: "teamlead@iitil.com",
    designation: "Team Lead",
    department: "Engineering",
    roleCode: "TEAM_LEAD",
  },
  {
    userId: "employee",
    employeeId: "IITIL-0005",
    firstName: "Demo",
    lastName: "Employee",
    email: "employee@iitil.com",
    designation: "Software Engineer",
    department: "Engineering",
    roleCode: "EMPLOYEE",
  },
  {
    userId: "intern",
    employeeId: "IITIL-0007",
    firstName: "Demo",
    lastName: "Intern",
    email: "intern@iitil.com",
    designation: "Software Intern",
    department: "Engineering",
    roleCode: "INTERN",
    employmentType: "INTERN",
  },
] as const;

const demoPassword = "IITIL@12345";

const leaveTypes = [
  { name: "Casual Leave", code: "CL", annualQuota: 12, isPaid: true },
  { name: "Sick Leave", code: "SL", annualQuota: 6, isPaid: true },
  { name: "Earned Leave", code: "EL", annualQuota: 15, isPaid: true },
];

async function main() {
  try {
    console.log("🌱 Starting database seeding...");

    // Seed Roles
    console.log("📋 Seeding roles...");
    for (const [code, name] of roles) {
      await prisma.role.upsert({
        where: { code },
        update: { name, isSystem: true },
        create: { code, name, isSystem: true },
      });

      await prisma.$executeRaw`
        UPDATE "roles"
        SET "hierarchyLevel" = ${roleHierarchy[code]}
        WHERE "code" = ${code}
      `;
    }

    // Seed Permissions
    console.log("🔐 Seeding permissions...");
    for (const [code, resource, action] of permissions) {
      await prisma.permission.upsert({
        where: { code },
        update: { resource, action },
        create: { code, resource, action },
      });
    }

    const persistedRoles = await prisma.role.findMany();
    const persistedPermissions = await prisma.permission.findMany();
    const roleByCode = new Map(persistedRoles.map((role) => [role.code, role]));
    const permissionByCode = new Map(
      persistedPermissions.map((permission) => [permission.code, permission]),
    );

    // Seed Role Permissions
    console.log("🎭 Seeding role permissions...");
    for (const [roleCode, permissionCodes] of Object.entries(rolePermissions)) {
      const role = roleByCode.get(roleCode);
      if (!role) continue;

      await prisma.rolePermission.createMany({
        data: permissionCodes.flatMap((permissionCode) => {
          const permission = permissionCode ? permissionByCode.get(permissionCode) : null;
          return permission ? [{ roleId: role.id, permissionId: permission.id }] : [];
        }),
        skipDuplicates: true,
      });
    }

    // Seed Leave Types
    console.log("📅 Seeding leave types...");
    for (const leaveType of leaveTypes) {
      await prisma.leaveType.upsert({
        where: { code: leaveType.code },
        update: leaveType,
        create: leaveType,
      });
    }

    // Seed Demo Users and Employees
    console.log("👥 Seeding demo users and employees...");
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
          status: "ACTIVE",
          deletedAt: null,
        },
        create: {
          employeeId: demoUser.employeeId,
          firstName: demoUser.firstName,
          lastName: demoUser.lastName,
          email: demoUser.email,
          designation: demoUser.designation,
          department: demoUser.department,
          joiningDate: new Date(),
          employmentType:
            "employmentType" in demoUser ? (demoUser.employmentType as any) : "FULL_TIME",
        },
      });

      const user = await prisma.user.upsert({
        where: { userId: demoUser.userId },
        update: {
          passwordHash,
          status: "ACTIVE",
          forcePasswordReset: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
          employeeId: employee.id,
          deletedAt: null,
        },
        create: {
          userId: demoUser.userId,
          passwordHash,
          status: "ACTIVE",
          forcePasswordReset: false,
          employeeId: employee.id,
        },
      });

      const role = roleByCode.get(demoUser.roleCode);
      if (role) {
        await prisma.userRole.createMany({
          data: [{ userId: user.id, roleId: role.id }],
          skipDuplicates: true,
        });
      }
    }

    // Seed Leave Balances for current year
    console.log("⚖️ Seeding leave balances...");
    const currentYear = new Date().getFullYear();
    const employees = await prisma.employee.findMany({
      where: { deletedAt: null },
      select: { id: true }
    });
    const allLeaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true }
    });

    for (const employee of employees) {
      for (const leaveType of allLeaveTypes) {
        await prisma.leaveBalance.upsert({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: employee.id,
              leaveTypeId: leaveType.id,
              year: currentYear
            }
          },
          update: {},
          create: {
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year: currentYear,
            allocated: leaveType.annualQuota,
            used: 0
          }
        });
      }
    }

    // Seed Attendance Settings - FIXED VERSION (removed hardcoded UUID)
    console.log("⏰ Seeding attendance settings...");
    const existingSetting = await prisma.attendanceSetting.findFirst();
    
    if (!existingSetting) {
      await prisma.attendanceSetting.create({
        data: {
          officeStart: "09:00",
          officeEnd: "18:00",
          graceMinutes: 10,
          workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
          isActive: true,
        },
      });
      console.log("✅ Attendance settings created");
    } else {
      await prisma.attendanceSetting.update({
        where: { id: existingSetting.id },
        data: {
          officeStart: "09:00",
          officeEnd: "18:00",
          graceMinutes: 10,
          workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
          isActive: true,
        },
      });
      console.log("✅ Attendance settings updated");
    }

    // Seed App Configs
    console.log("⚙️ Seeding app configurations...");
    await prisma.appConfig.upsert({
      where: { key: "hr.departments" },
      update: {},
      create: {
        key: "hr.departments",
        value: [
          "Administration",
          "Engineering",
          "Human Resources",
          "Finance",
          "Marketing",
          "Operations",
          "Sales",
          "Design",
          "Legal",
        ],
      },
    });

    await prisma.appConfig.upsert({
      where: { key: "hr.designations" },
      update: {},
      create: {
        key: "hr.designations",
        value: [
          "Super Admin",
          "Admin",
          "HR Manager",
          "HR Executive",
          "Team Lead",
          "Software Engineer",
          "Senior Software Engineer",
          "Software Intern",
          "Finance Manager",
          "Marketing Executive",
          "Operations Manager",
        ],
      },
    });

    await prisma.appConfig.upsert({
      where: { key: "attendance.regularization.limit" },
      update: {},
      create: {
        key: "attendance.regularization.limit",
        value: 5,
      },
    });

    console.log("✅ Seed completed successfully!");
    console.log(`📝 Demo users password: ${demoPassword}`);
    console.log(`📊 Seeded ${allLeaveTypes.length} leave types`);
    console.log(`👥 Seeded leave balances for ${employees.length} employees`);
    
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });