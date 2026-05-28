import { EmployeeStatus, EmploymentType } from '@prisma/client';
import { z } from 'zod';

export const employeeIdParamSchema = z.object({
  id: z.string().uuid()
});

export const createEmployeeSchema = z.object({
  employeeId: z.string().trim().min(2).max(64).optional(),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(40).optional(),
  designation: z.string().trim().min(1).max(140),
  department: z.string().trim().min(1).max(140),
  joiningDate: z.coerce.date(),
  employmentType: z.nativeEnum(EmploymentType),
  reportingManagerId: z.string().uuid().optional(),
  status: z.nativeEnum(EmployeeStatus).default(EmployeeStatus.ACTIVE)
});

export const updateEmployeeSchema = createEmployeeSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required'
});

export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>;
