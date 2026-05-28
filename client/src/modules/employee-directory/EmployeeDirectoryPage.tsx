import type { ColumnDef } from '@tanstack/react-table';
import { Building2, Network, UserRound } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { PageTransition } from '@/components/animations/PageTransition';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { endpoints } from '@/services/api/endpoints';

type DirectoryEmployee = Record<string, unknown> & {
  firstName?: string;
  lastName?: string;
  designation?: string;
  department?: string;
  email?: string;
  reportingManager?: {
    firstName?: string;
    lastName?: string;
  } | null;
};

export function EmployeeDirectoryPage() {
  const columns = useMemo<ColumnDef<DirectoryEmployee>[]>(
    () => [
      {
        id: 'name',
        header: 'Employee',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-cyan-300/10 text-xs font-semibold text-cyan-200">
              {(row.original.firstName?.[0] ?? 'I')}{(row.original.lastName?.[0] ?? 'T')}
            </div>
            <div>
              <p className="font-medium text-foreground">{row.original.firstName} {row.original.lastName}</p>
              <p className="text-xs text-muted-foreground">{row.original.email}</p>
            </div>
          </div>
        )
      },
      { accessorKey: 'designation', header: 'Designation' },
      { accessorKey: 'department', header: 'Department' },
      {
        id: 'manager',
        header: 'Reporting Manager',
        cell: ({ row }) => {
          const manager = row.original.reportingManager;
          return manager ? `${manager.firstName ?? ''} ${manager.lastName ?? ''}`.trim() : '-';
        }
      },
      {
        id: 'visibility',
        header: 'Visibility',
        cell: () => <Badge variant="success">Public</Badge>
      }
    ],
    []
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Company visibility"
          title="Employee directory"
          description="A collaboration-safe directory filtered by hierarchy, department, and role visibility. Sensitive HRMS fields are never returned by this API."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: 'Public profile only', icon: UserRound, text: 'Name, designation, department, work email, manager, and optional joining date.' },
            { title: 'Hierarchy filtered', icon: Network, text: 'Team leads see assigned or department employees. Employees and interns do not see admin users.' },
            { title: 'Department grouping', icon: Building2, text: 'Use department filters and search without leaking restricted accounts.' }
          ].map((item) => (
            <SectionCard key={item.title} title={item.title}>
              <item.icon className="mb-4 size-5 text-cyan-200" />
              <p className="text-sm text-muted-foreground">{item.text}</p>
            </SectionCard>
          ))}
        </div>
        <OperationalModulePage<DirectoryEmployee>
          config={{
            resource: 'employee-directory',
            endpoint: endpoints.employeeDirectory,
            eyebrow: 'Directory',
            title: 'Visible employees',
            description: 'Only public employee fields returned by the directory endpoint are rendered here.',
            createLabel: 'Invite disabled',
            columns,
            emptyTitle: 'No visible employees',
            emptyDescription: 'No employees are visible under your current role and hierarchy policy.',
            filters: [
              { key: 'department', label: 'Department', value: 'All visible' },
              { key: 'scope', label: 'Scope', value: 'Public only' }
            ]
          }}
        />
      </div>
    </PageTransition>
  );
}
