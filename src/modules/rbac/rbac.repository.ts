import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../common/errors/app-error";
import type {
  AssignRoleDto,
  AttachPermissionDto,
  CreateRoleDto,
  SetRolePermissionDto,
  UpdateRoleDto,
} from "./rbac.validation";

export type PermissionMatrix = Record<string, Record<string, Record<string, string>>>;

export type PermissionMatrixChange = {
  roleCode: string;
  resource: string;
  action: string;
  scope: string;
};

const scopeLevel: Record<string, number> = {
  none: 0,
  self: 1,
  team: 2,
  department: 3,
  all: 4,
};

function parsePermissionToMatrixCell(permission: { code: string; resource?: string | null; action?: string | null; scope?: string | null }): {
  resource: string;
  action: string;
  scope: string;
} | null {
  const code = permission.code;

  if (code.includes(':')) {
    const parts = code.split(':');
    if (parts.length !== 3) {
      return null;
    }

    const [resource, action, scope] = parts;
    if (!resource || !action || !scope) {
      return null;
    }

    return { resource, action, scope };
  }

  // Legacy dot permissions (for example employee.read) are unscoped and historically behaved like all.
  if (code.includes('.')) {
    const parts = code.split('.').filter(Boolean);
    const resource = permission.resource ?? parts[0];
    const action = permission.action ?? parts[parts.length - 1];

    if (!resource || !action) {
      return null;
    }

    return { resource, action, scope: 'all' };
  }

  return null;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class RbacRepository {
  listRoles() {
    return prisma.role
      .findMany({
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      })
      .then((roles) =>
        roles.map((role) => ({
          ...role,
          status: role.isSystem ? "SYSTEM" : "ACTIVE",
        })),
      );
  }

  async updateRole(id: string, input: UpdateRoleDto, actorUserId?: string) {
    const existing = await prisma.role.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundError("Role not found");
    }

    if (existing.isSystem && (input.code || input.hierarchyLevel)) {
      throw new BadRequestError(
        "System role code and hierarchy cannot be changed",
      );
    }

    return prisma.$transaction(async (tx) => {
      const role = await tx.role.update({
        where: { id },
        data: {
          ...(input.code ? { code: input.code } : {}),
          ...(input.name ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description || null }
            : {}),
          ...(input.hierarchyLevel !== undefined
            ? { hierarchyLevel: input.hierarchyLevel }
            : {}),
        },
      });

      await tx.activityLog.create({
        data: {
          actorUserId: actorUserId ?? null,
          action: "ROLE_UPDATED",
          entityType: "Role",
          entityId: id,
          oldValues: toJson(existing),
          newValues: toJson(role),
        },
      });

      return role;
    });
  }

  async deleteRole(id: string, actorUserId?: string): Promise<void> {
    const existing = await prisma.role.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundError("Role not found");
    }

    if (existing.isSystem) {
      throw new BadRequestError("System roles cannot be deleted");
    }

    const assignedUsers = await prisma.userRole.count({
      where: { roleId: id },
    });

    if (assignedUsers > 0) {
      throw new ConflictError(
        "Role is assigned to users and cannot be deleted",
      );
    }

    await prisma.$transaction([
      prisma.role.update({ where: { id }, data: { deletedAt: new Date() } }),
      prisma.activityLog.create({
        data: {
          actorUserId: actorUserId ?? null,
          action: "ROLE_DELETED",
          entityType: "Role",
          entityId: id,
          oldValues: toJson(existing),
        },
      }),
    ]);
  }

  listPermissions() {
    return prisma.permission.findMany({
      where: { deletedAt: null },
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });
  }

  async getPermissionMatrix(): Promise<PermissionMatrix> {
    const roles = await prisma.role.findMany({
      where: {
        deletedAt: null,
        code: { not: 'SUPER_ADMIN' },
      },
      orderBy: { hierarchyLevel: 'asc' },
      include: {
        permissions: {
          where: { permission: { deletedAt: null } },
          include: {
            permission: {
              select: { code: true, resource: true, action: true, scope: true },
            },
          },
        },
      },
    });

    const matrix: PermissionMatrix = {};

    for (const role of roles) {
      matrix[role.code] = {};

      for (const rolePermission of role.permissions) {
        const parsed = parsePermissionToMatrixCell(rolePermission.permission);
        if (!parsed) {
          continue;
        }

        const { resource, action, scope } = parsed;

        if (!matrix[role.code]?.[resource]) {
          matrix[role.code]![resource] = {};
        }

        const current = matrix[role.code]?.[resource]?.[action];
        if (!current || (scopeLevel[scope] ?? 0) > (scopeLevel[current] ?? 0)) {
          matrix[role.code]![resource]![action] = scope;
        }
      }
    }

    return matrix;
  }

  createRole(input: CreateRoleDto) {
    return prisma.role.create({
      data: {
        code: input.code,
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        ...(input.hierarchyLevel !== undefined
          ? { hierarchyLevel: input.hierarchyLevel }
          : {}),
      },
    });
  }

  async setRolePermission(
    roleId: string,
    permissionId: string,
    input: SetRolePermissionDto,
    actorUserId?: string,
  ): Promise<void> {
    const role = await prisma.role.findFirst({
      where: { id: roleId, deletedAt: null },
      select: { id: true, code: true, isSystem: true },
    });

    if (!role) {
      throw new NotFoundError("Role not found");
    }

    if (role.isSystem || role.code === "SUPER_ADMIN") {
      throw new BadRequestError("Super Admin permissions cannot be changed");
    }

    await prisma.$transaction(async (tx) => {
      if (input.enabled) {
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId } },
          update: {},
          create: { roleId, permissionId },
        });
      } else {
        await tx.rolePermission.deleteMany({ where: { roleId, permissionId } });
      }

      await tx.activityLog.create({
        data: {
          actorUserId: actorUserId ?? null,
          action: input.enabled
            ? "ROLE_PERMISSION_ATTACHED"
            : "ROLE_PERMISSION_DETACHED",
          entityType: "Role",
          entityId: roleId,
          newValues: { permissionId, enabled: input.enabled },
        },
      });
    });
  }

  async savePermissionMatrix(changes: PermissionMatrixChange[], actorUserId?: string): Promise<void> {
    if (changes.length === 0) {
      return;
    }

    const normalizedByKey = new Map<string, PermissionMatrixChange>();
    for (const change of changes) {
      const key = `${change.roleCode}::${change.resource}::${change.action}`;
      normalizedByKey.set(key, {
        roleCode: change.roleCode.trim(),
        resource: change.resource.trim(),
        action: change.action.trim(),
        scope: change.scope.trim(),
      });
    }

    const normalizedChanges = [...normalizedByKey.values()];
    const roleCodes = [...new Set(normalizedChanges.map((change) => change.roleCode))];

    const roles = await prisma.role.findMany({
      where: {
        code: { in: roleCodes },
        deletedAt: null,
      },
      select: { id: true, code: true },
    });

    const roleByCode = new Map(roles.map((role) => [role.code, role]));
    const missingRoles = roleCodes.filter((code) => !roleByCode.has(code));
    if (missingRoles.length > 0) {
      throw new NotFoundError(`Role not found: ${missingRoles.join(', ')}`);
    }

    await prisma.$transaction(async (tx) => {
      for (const change of normalizedChanges) {
        const role = roleByCode.get(change.roleCode);
        if (!role) {
          throw new NotFoundError(`Role not found: ${change.roleCode}`);
        }

        const existingPermissions = await tx.permission.findMany({
          where: {
            deletedAt: null,
            resource: change.resource,
            action: change.action,
          },
          select: { id: true },
        });

        await tx.rolePermission.deleteMany({
          where: {
            roleId: role.id,
            permissionId: { in: existingPermissions.map((permission) => permission.id) },
          },
        });

        if (change.scope !== 'none') {
          const permissionCode = `${change.resource}:${change.action}:${change.scope}`;
          let permission = await tx.permission.findFirst({
            where: { code: permissionCode, deletedAt: null },
          });

          if (!permission) {
            permission = await tx.permission.create({
              data: {
                code: permissionCode,
                resource: change.resource,
                action: change.action,
                scope: change.scope,
                description: `${change.action} ${change.resource} with ${change.scope} scope`,
              },
            });
          }

          await tx.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permission.id,
              },
            },
            update: {},
            create: {
              roleId: role.id,
              permissionId: permission.id,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            actorUserId: actorUserId ?? null,
            action: 'ROLE_PERMISSION_MATRIX_CHANGE_SAVED',
            entityType: 'Role',
            entityId: role.id,
            newValues: toJson(change),
          },
        });
      }
    });
  }

  assignRole(input: AssignRoleDto): Promise<void> {
    return prisma.userRole
      .create({
        data: input,
      })
      .then(() => undefined);
  }

  attachPermission(input: AttachPermissionDto): Promise<void> {
    return prisma.rolePermission
      .create({
        data: {
          roleId: input.roleId,
          permissionId: input.permissionId,
        },
      })
      .then(() => undefined);
  }

  findPermissionsByUserId(userId: string): Promise<string[]> {
    return prisma.userRole
      .findMany({
        where: {
          userId,
          role: {
            deletedAt: null,
          },
        },
        select: {
          role: {
            select: {
              permissions: {
                where: {
                  permission: {
                    deletedAt: null,
                  },
                },
                select: {
                  permission: {
                    select: {
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
      .then((roles) => [
        ...new Set(
          roles.flatMap((userRole) =>
            userRole.role.permissions.map(
              (rolePermission) => rolePermission.permission.code,
            ),
          ),
        ),
      ]);
  }

  findRolesByUserId(userId: string): Promise<string[]> {
    return prisma.userRole
      .findMany({
        where: {
          userId,
          role: {
            deletedAt: null,
          },
        },
        select: {
          role: {
            select: {
              code: true,
            },
          },
        },
      })
      .then((roles) => roles.map((userRole) => userRole.role.code));
  }

  findRoleHierarchyLevelByUserId(userId: string): Promise<number> {
    return prisma.$queryRaw<Array<{ hierarchyLevel: number }>>`
        SELECT MIN(r."hierarchyLevel")::int AS "hierarchyLevel"
        FROM "user_roles" ur
        INNER JOIN "roles" r ON r."id" = ur."roleId"
        WHERE ur."userId" = ${userId}::uuid
          AND r."deletedAt" IS NULL
      `.then((rows) => rows[0]?.hierarchyLevel ?? 100);
  }
}
