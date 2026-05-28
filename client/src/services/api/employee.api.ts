import { endpoints } from './endpoints';
import { resourceApi } from './resource.api';
import type { EmployeeFormValues } from '@/schemas/employee.schemas';

export const employeeApi = {
  create(payload: EmployeeFormValues) {
    return resourceApi.create<EmployeeFormValues, unknown>(endpoints.userManagement.users, payload);
  },

  update(id: string, payload: EmployeeFormValues) {
    return resourceApi.update<EmployeeFormValues, unknown>(endpoints.userManagement.users, id, payload);
  },

  remove(id: string) {
    return resourceApi.remove(endpoints.userManagement.users, id);
  }
};
