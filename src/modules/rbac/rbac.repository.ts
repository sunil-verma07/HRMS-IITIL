import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors/app-error';
import type { AssignRoleDto, AttachPermissionDto, CreateRoleDto, SetRolePermissionDto, UpdateRoleDto } from './rbac.validation';

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class RbacRepository {
  listRoles() {
    return prisma.role.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    }).then((roles) =>
      roles.map((role) => ({
        ...role,
        status: role.isSystem ? 'SYSTEM' : 'ACTIVE'
      }))
    );
  }

  async updateRole(id: string, input: UpdateRoleDto, actorUserId?: string) {
    const existing = await prisma.role.findFirst({ where: { id, deletedAt: null } });

    if (!existing) {
      throw new NotFoundError('Role not found');
    }

    if (existing.isSystem && (input.code || input.hierarchyLevel)) {
      throw new BadRequestError('System role code and hierarchy cannot be changed');
    }

    return prisma.$transaction(async (tx) => {
      const role = await tx.role.update({
        where: { id },
        data: {
          ...(input.code ? { code: input.code } : {}),
          ...(input.name ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description || null } : {}),
          ...(input.hierarchyLevel !== undefined ? { hierarchyLevel: input.hierarchyLevel } : {})
        }
      });

      await tx.activityLog.create({
        data: {
          actorUserId: actorUserId ?? null,
          action: 'ROLE_UPDATED',
          entityType: 'Role',
          entityId: id,
          oldValues: toJson(existing),
          newValues: toJson(role)
        }
      });

      return role;
    });
  }

  async deleteRole(id: string, actorUserId?: string): Promise<void> {
    const existing = await prisma.role.findFirst({ where: { id, deletedAt: null } });

    if (!existing) {
      throw new NotFoundError('Role not found');
    }

    if (existing.isSystem) {
      throw new BadRequestError('System roles cannot be deleted');
    }

    const assignedUsers = await prisma.userRole.count({ where: { roleId: id } });

    if (assignedUsers > 0) {
      throw new ConflictError('Role is assigned to users and cannot be deleted');
    }

    await prisma.$transaction([
      prisma.role.update({ where: { id }, data: { deletedAt: new Date() } }),
      prisma.activityLog.create({
        data: {
          actorUserId: actorUserId ?? null,
          action: 'ROLE_DELETED',
          entityType: 'Role',
          entityId: id,
          oldValues: toJson(existing)
        }
      })
    ]);
  }

  listPermissions() {
    return prisma.permission.findMany({
      where: { deletedAt: null },
      orderBy: [{ resource: 'asc' }, { action: 'asc' }]
    });
  }

  createRole(input: CreateRoleDto) {
    return prisma.role.create({
      data: {
        code: input.code,
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        ...(input.hierarchyLevel !== undefined ? { hierarchyLevel: input.hierarchyLevel } : {})
      }
    });
  }

  async setRolePermission(roleId: string, permissionId: string, input: SetRolePermissionDto, actorUserId?: string): Promise<void> {
    const role = await prisma.role.findFirst({ where: { id: roleId, deletedAt: null }, select: { id: true, isSystem: true } });

    if (!role) {
      throw new NotFoundError('Role not found');
    }

    if (role.isSystem) {
      throw new BadRequestError('System role permissions cannot be changed from the portal');
    }

    await prisma.$transaction(async (tx) => {
      if (input.enabled) {
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId } },
          update: {},
          create: { roleId, permissionId }
        });
      } else {
        await tx.rolePermission.deleteMany({ where: { roleId, permissionId } });
      }

      await tx.activityLog.create({
        data: {
          actorUserId: actorUserId ?? null,
          action: input.enabled ? 'ROLE_PERMISSION_ATTACHED' : 'ROLE_PERMISSION_DETACHED',
          entityType: 'Role',
          entityId: roleId,
          newValues: { permissionId, enabled: input.enabled }
        }
      });
    });
  }

  assignRole(input: AssignRoleDto): Promise<void> {
    return prisma.userRole
      .create({
        data: input
      })
      .then(() => undefined);
  }

  attachPermission(input: AttachPermissionDto): Promise<void> {
    return prisma.rolePermission
      .create({
        data: {
          roleId: input.roleId,
          permissionId: input.permissionId
        }
      })
      .then(() => undefined);
  }

  findPermissionsByUserId(userId: string): Promise<string[]> {
    return prisma.userRole
      .findMany({
        where: {
          userId,
          role: {
            deletedAt: null
          }
        },
        select: {
          role: {
            select: {
              permissions: {
                where: {
                  permission: {
                    deletedAt: null
                  }
                },
                select: {
                  permission: {
                    select: {
                      code: true
                    }
                  }
                }
              }
            }
          }
        }
      })
      .then((roles) => [
        ...new Set(
          roles.flatMap((userRole) =>
            userRole.role.permissions.map((rolePermission) => rolePermission.permission.code)
          )
        )
      ]);
  }

  findRolesByUserId(userId: string): Promise<string[]> {
    return prisma.userRole
      .findMany({
        where: {
          userId,
          role: {
            deletedAt: null
          }
        },
        select: {
          role: {
            select: {
              code: true
            }
          }
        }
      })
      .then((roles) => roles.map((userRole) => userRole.role.code));
  }

  findRoleHierarchyLevelByUserId(userId: string): Promise<number> {
    return prisma
      .$queryRaw<Array<{ hierarchyLevel: number }>>`
        SELECT MIN(r."hierarchyLevel")::int AS "hierarchyLevel"
        FROM "user_roles" ur
        INNER JOIN "roles" r ON r."id" = ur."roleId"
        WHERE ur."userId" = ${userId}::uuid
          AND r."deletedAt" IS NULL
      `
      .then((rows) => rows[0]?.hierarchyLevel ?? 100);
  }
}
