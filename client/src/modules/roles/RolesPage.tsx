import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { genericColumns, type GenericRecord } from '@/modules/shared/module-columns';

export function RolesPage() {
  return (
    <OperationalModulePage<GenericRecord>
      config={{
        resource: 'roles',
        endpoint: endpoints.roles,
        eyebrow: 'RBAC',
        title: 'Roles',
        description: 'Manage system and business roles without hardcoded frontend checks.',
        createLabel: 'Create role',
        columns: genericColumns,
        emptyTitle: 'No roles returned',
        emptyDescription: 'Roles from the RBAC API will appear here for assignment and governance.'
      }}
    />
  );
}
