import { EmployeeStatus, EmploymentType } from '@prisma/client';
import { z } from 'zod';

export const peopleQuerySchema = z.object({
  search: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  roleId: z.string().trim().optional(),
  reportingManagerId: z.string().uuid().optional(),
  status: z.nativeEnum(EmployeeStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['name', 'employeeId', 'email', 'department', 'designation', 'status', 'joinDate', 'lastActive'])
    .default('joinDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const peopleIdParamSchema = z.object({
  id: z.string().uuid()
});

export const importConfirmRowSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(40).optional(),
  department: z.string().trim().min(1).max(140),
  designation: z.string().trim().min(1).max(140),
  joiningDate: z.coerce.date(),
  employmentType: z.nativeEnum(EmploymentType),
  status: z.nativeEnum(EmployeeStatus).default(EmployeeStatus.ACTIVE),
  roleCode: z.string().trim().min(1).max(80),
  userId: z.string().trim().min(3).max(64),
  reportingManagerEmail: z.string().trim().email().optional()
});

export const importConfirmSchema = z.object({
  rows: z.array(importConfirmRowSchema).min(1)
});

export type PeopleQuery = z.infer<typeof peopleQuerySchema>;
export type ImportConfirmRow = z.infer<typeof importConfirmRowSchema>;
