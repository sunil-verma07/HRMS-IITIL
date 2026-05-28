import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { employeeColumns, type GenericRecord } from '@/modules/shared/module-columns';

export function EmployeesPage() {
  return (
    <OperationalModulePage<GenericRecord>
      config={{
        resource: 'employees',
        endpoint: endpoints.userManagement.users,
        eyebrow: 'Core HRMS',
        title: 'Employee management',
        description: 'Manage employee records, profiles, reporting hierarchy, documents, onboarding status, attendance, leaves, and activity trail.',
        createLabel: 'Create employee',
        columns: employeeColumns,
        emptyTitle: 'No employees found',
        emptyDescription: 'Employee records will appear here after the HRMS employees API returns data.',
        filters: [
          { key: 'status', label: 'Status', value: 'Active' },
          { key: 'department', label: 'Department', value: 'All' }
        ]
      }}
    />
  );
}
