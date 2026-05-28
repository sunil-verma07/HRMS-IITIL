import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { genericColumns, type GenericRecord } from '@/modules/shared/module-columns';

export function LeavesPage() {
  return (
    <OperationalModulePage<GenericRecord>
      config={{
        resource: 'leaves',
        endpoint: endpoints.leaves,
        eyebrow: 'Approval workflow',
        title: 'Leave management',
        description: 'Process leave applications through employee, team lead, and HR approval stages with balance-aware decisions.',
        createLabel: 'Apply leave',
        columns: genericColumns,
        emptyTitle: 'No leave requests',
        emptyDescription: 'Leave requests, balances, approvals, and rejection remarks will appear when the leave API is available.',
        filters: [
          { key: 'workflow', label: 'Workflow', value: 'Team Lead → HR' },
          { key: 'status', label: 'Status', value: 'Pending' }
        ]
      }}
    />
  );
}
