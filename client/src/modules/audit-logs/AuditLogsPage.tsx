import { Badge } from '@/components/ui/badge';
import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import type { AuditLog } from '@/types/domain';

type AuditLogRow = AuditLog;

const columns = [
  {
    accessorKey: 'summary',
    header: 'Event',
    cell: ({ row }: { row: { original: AuditLogRow } }) => (
      <div className="space-y-1">
        <div className="font-medium text-foreground">{row.original.summary ?? row.original.event}</div>
        <div className="text-xs text-muted-foreground">{row.original.entityLabel ?? row.original.entityType ?? 'System'}</div>
      </div>
    )
  },
  {
    accessorKey: 'actorLabel',
    header: 'Actor',
    cell: ({ row }: { row: { original: AuditLogRow } }) => <Badge variant="violet">{row.original.actorLabel ?? row.original.actorUserId ?? 'System'}</Badge>
  },
  {
    accessorKey: 'createdAt',
    header: 'Time',
    cell: ({ row }: { row: { original: AuditLogRow } }) => new Date(row.original.createdAt).toLocaleString()
  }
] as const;

export function AuditLogsPage() {
  return (
    <OperationalModulePage<AuditLogRow>
      config={{
        resource: 'audit-logs',
        endpoint: endpoints.auditLogs,
        eyebrow: 'Security audit',
        title: 'Audit logs',
        description: 'Review login history, failed login attempts, IP addresses, device details, and session activity.',
        createLabel: 'Export audit',
        columns: columns as unknown as never,
        emptyTitle: 'No audit logs',
        emptyDescription: 'Security audit events will appear after authentication and session events are recorded.'
      }}
    />
  );
}
