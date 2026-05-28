import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { genericColumns, type GenericRecord } from '@/modules/shared/module-columns';

export function ActivityLogsPage() {
  return (
    <OperationalModulePage<GenericRecord>
      config={{
        resource: 'activity-logs',
        endpoint: endpoints.activityLogs,
        eyebrow: 'Traceability',
        title: 'Activity logs',
        description: 'Track user actions, affected entities, old values, new values, and operational timeline.',
        createLabel: 'Export logs',
        columns: genericColumns,
        emptyTitle: 'No activity logs',
        emptyDescription: 'Activity logs will appear when auditable domain actions are recorded.'
      }}
    />
  );
}
