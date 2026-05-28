import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { genericColumns, type GenericRecord } from '@/modules/shared/module-columns';

export function AuditLogsPage() {
  return (
    <OperationalModulePage<GenericRecord>
      config={{
        resource: 'audit-logs',
        endpoint: endpoints.auditLogs,
        eyebrow: 'Security audit',
        title: 'Audit logs',
        description: 'Review login history, failed login attempts, IP addresses, device details, and session activity.',
        createLabel: 'Export audit',
        columns: genericColumns,
        emptyTitle: 'No audit logs',
        emptyDescription: 'Security audit events will appear after authentication and session events are recorded.'
      }}
    />
  );
}
