import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { genericColumns, type GenericRecord } from '@/modules/shared/module-columns';

export function PermissionsPage() {
  return (
    <OperationalModulePage<GenericRecord>
      config={{
        resource: 'permissions',
        endpoint: endpoints.permissions,
        eyebrow: 'RBAC matrix',
        title: 'Permissions',
        description: 'Review permission codes, resources, and actions that drive route protection and permission-based UI rendering.',
        createLabel: 'Attach permission',
        columns: genericColumns,
        emptyTitle: 'No permissions returned',
        emptyDescription: 'Permission records from RBAC will appear here.',
        filters: [{ key: 'mode', label: 'Mode', value: 'Permission matrix ready' }]
      }}
    />
  );
}
