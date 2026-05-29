import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { EmployeeStatus, EmploymentType } from "@prisma/client";

export function employeeDropdownWhere(request: Request): Prisma.EmployeeWhereInput {
  const department = typeof request.query.department === "string" ? request.query.department : undefined;
  const status = typeof request.query.status === "string" ? request.query.status : undefined;
  const employmentType = typeof request.query.employmentType === "string" ? request.query.employmentType : undefined;
  const role = typeof request.query.role === "string" ? request.query.role : undefined;
  
  const where: Prisma.EmployeeWhereInput = {};

  if (department) where.department = department;
  
  if (status && Object.values(EmployeeStatus).includes(status as EmployeeStatus)) {
    where.status = status as EmployeeStatus;
  }
  
  if (employmentType && Object.values(EmploymentType).includes(employmentType as EmploymentType)) {
    where.employmentType = employmentType as EmploymentType;
  }
  
  if (role) {
    where.user = {
      roles: {
        some: {
          role: { code: role, deletedAt: null },
        },
      },
    };
  }
  
  return where;
}