export type AuthenticatedUser = {
  id: string;
  userId: string;
  employeeId?: string;
  departmentId?: string;
  department?: string;
  sessionId: string;
  permissions: string[];
  roles: string[];
  hierarchyLevel: number;
};
