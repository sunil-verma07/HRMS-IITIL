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

export const permissionMatrixScopeSchema = z.enum(['none', 'self', 'team', 'department', 'all']);

export const permissionMatrixEntrySchema = z.object({
  resource: z.string().trim().min(1).max(80),
  action: z.string().trim().min(1).max(80),
  scope: permissionMatrixScopeSchema,
});

export const permissionMatrixRoleSchema = z.object({
  roleCode: z.string().trim().min(2).max(80),
  permissions: z.array(permissionMatrixEntrySchema),
});

export const permissionMatrixChangeSchema = z.object({
  roleCode: z.string().trim().min(2).max(80),
  resource: z.string().trim().min(1).max(80),
  action: z.string().trim().min(1).max(80),
  scope: permissionMatrixScopeSchema,
});

export const updatePermissionMatrixSchema = z.object({
  changes: z.array(permissionMatrixChangeSchema),
});

export type AssignRoleDto = z.infer<typeof assignRoleSchema>;
export type CreateRoleDto = z.infer<typeof createRoleSchema>;
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
export type AttachPermissionDto = z.infer<typeof attachPermissionSchema>;
export type SetRolePermissionDto = z.infer<typeof setRolePermissionSchema>;
export type PermissionMatrixEntryDto = z.infer<typeof permissionMatrixEntrySchema>;
export type PermissionMatrixRoleDto = z.infer<typeof permissionMatrixRoleSchema>;
export type PermissionMatrixChangeDto = z.infer<typeof permissionMatrixChangeSchema>;
export type UpdatePermissionMatrixDto = z.infer<typeof updatePermissionMatrixSchema>;
