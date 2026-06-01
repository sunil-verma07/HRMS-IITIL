import { z } from 'zod';

export const departmentIdParamSchema = z.object({
  id: z.string().uuid()
});

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(140),
  code: z.string().trim().min(1).max(60),
  headEmployeeId: z.string().uuid().optional().nullable(),
  parentDepartmentId: z.string().uuid().optional().nullable()
});

export const updateDepartmentSchema = createDepartmentSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });

export const assignDepartmentEmployeeSchema = z.object({
  employeeId: z.string().uuid()
});

export type CreateDepartmentDto = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentDto = z.infer<typeof updateDepartmentSchema>;
