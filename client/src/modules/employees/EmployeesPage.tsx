import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { endpoints } from '@/services/api/endpoints';
import { resourceApi } from '@/services/api/resource.api';
import { permissions } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { makeEmployeeColumns, type GenericRecord } from '@/modules/shared/module-columns';
import { ConfirmModal } from '@/components/ui/confirm-modal';

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const { can, canDo } = usePermissions();
  const [deleteTarget, setDeleteTarget] = useState<GenericRecord | null>(null);

  const canManage =
    can(permissions.employeeDelete) ||
    can(permissions.employeeUserManage) ||
    canDo('employee', 'delete') ||
    canDo('employee', 'manage');

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      resourceApi.remove(endpoints.userManagement.users, id),
    onSuccess: () => {
      toast.success('Employee deleted successfully');
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: () => toast.error('Failed to delete employee')
  });

  const columns = makeEmployeeColumns(
    (record) => setDeleteTarget(record),
    canManage
  );

  const targetName = deleteTarget
    ? `${String(deleteTarget.firstName ?? '')} ${String(deleteTarget.lastName ?? '')}`.trim()
    : '';

  return (
    <>
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
      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete Employee"
        description={`Are you sure you want to delete ${targetName}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(String(deleteTarget.id));
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}