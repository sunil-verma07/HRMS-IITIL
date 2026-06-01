import { Badge } from '@/components/ui/badge';
import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import type { ActivityLog } from '@/types/domain';

type ActivityLogRow = ActivityLog;

const columns = [
  {
    accessorKey: 'summary',
    header: 'Action',
    cell: ({ row }: { row: { original: ActivityLogRow } }) => (
      <div className="space-y-1">
        <div className="font-medium text-foreground">{row.original.summary ?? row.original.action}</div>
        <div className="text-xs text-muted-foreground">{row.original.entityLabel ?? row.original.entityName ?? row.original.entityType}</div>
      </div>
    )
  },
  {
    accessorKey: 'actorLabel',
    header: 'Actor',
    cell: ({ row }: { row: { original: ActivityLogRow } }) => <Badge variant="muted">{row.original.actorLabel ?? row.original.actorName ?? row.original.actorUserId ?? 'System'}</Badge>
  },
  {
    accessorKey: 'createdAt',
    header: 'Time',
    cell: ({ row }: { row: { original: ActivityLogRow } }) => new Date(row.original.createdAt).toLocaleString()
  }
] as const;

export function ActivityLogsPage() {
  return (
    <OperationalModulePage<ActivityLogRow>
      config={{
        resource: 'activity-logs',
        endpoint: endpoints.activityLogs,
        eyebrow: 'Traceability',
        title: 'Activity logs',
        description: 'Track user actions, affected entities, old values, new values, and operational timeline.',
        createLabel: 'Export logs',
        columns: columns as unknown as never,
        emptyTitle: 'No activity logs',
        emptyDescription: 'Activity logs will appear when auditable domain actions are recorded.'
      }}
    />
  );
}
