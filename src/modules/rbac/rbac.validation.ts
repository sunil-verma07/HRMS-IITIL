import { z } from 'zod';

export const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid()
});

export const createRoleSchema = z.object({
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  hierarchyLevel: z.number().int().min(1).max(999).optional()
});

export const updateRoleSchema = createRoleSchema.partial();

export const attachPermissionSchema = z.object({
  roleId: z.string().uuid(),
  permissionId: z.string().uuid()
});

export const roleIdParamSchema = z.object({
  id: z.string().uuid()
});

export const rolePermissionParamSchema = z.object({
  roleId: z.string().uuid(),
  permissionId: z.string().uuid()
});

export const setRolePermissionSchema = z.object({
  enabled: z.boolean()
});

export type AssignRoleDto = z.infer<typeof assignRoleSchema>;
export type CreateRoleDto = z.infer<typeof createRoleSchema>;
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
export type AttachPermissionDto = z.infer<typeof attachPermissionSchema>;
export type SetRolePermissionDto = z.infer<typeof setRolePermissionSchema>;
