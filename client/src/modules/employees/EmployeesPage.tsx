import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { endpoints } from '@/services/api/endpoints';
import { resourceApi } from '@/services/api/resource.api';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { makeEmployeeColumns, type GenericRecord } from '@/modules/shared/module-columns';

export function EmployeesPage() {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      resourceApi.remove(endpoints.userManagement.users, id),
    onSuccess: () => {
      toast.success('Employee deleted successfully');
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: () => toast.error('Failed to delete employee')
  });

  const columns = makeEmployeeColumns((id) => {
    if (window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  });

  return (
    <OperationalModulePage<GenericRecord>
      config={{
        resource: 'employees',
        endpoint: endpoints.userManagement.users,
        eyebrow: 'Core HRMS',
        title: 'Employee management',
        description: 'Manage employee records, profiles, reporting hierarchy, documents, onboarding status, attendance, leaves, and activity trail.',
        createLabel: 'Create employee',
        columns,
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