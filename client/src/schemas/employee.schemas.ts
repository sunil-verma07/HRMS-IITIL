import { z } from 'zod';

export const employeeFormSchema = z.object({
  employeeId: z.string().trim().min(2, 'Employee ID is required'),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('Valid work email is required'),
  phone: z.string().trim().optional(),
  designation: z.string().trim().min(1, 'Designation is required'),
  department: z.string().trim().min(1, 'Department is required'),
  joiningDate: z.string().min(1, 'Joining date is required'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_NOTICE', 'TERMINATED'])
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;
