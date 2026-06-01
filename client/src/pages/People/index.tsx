import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Building2, Shield, Users } from 'lucide-react';
import { PageTransition } from '@/components/animations/PageTransition';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { endpoints } from '@/services/api/endpoints';
import { PeopleFilters } from '@/components/People/PeopleFilters';
import { BulkImportModal } from '@/components/People/BulkImportModal';
import { EmployeeDrawer } from '@/components/People/EmployeeDrawer';
import type { ApiEnvelope, EmployeeListItem, EmployeeProfile, PeopleFiltersData, PeopleListResponse } from '@/components/People/types';
import { DirectoryTab } from './DirectoryTab';
import { EmployeesTab } from './EmployeesTab';
import { HRMSControlsTab } from './HRMSControlsTab';

type PageTab = 'directory' | 'employees' | 'controls';
type SortField = 'name' | 'department' | 'role' | 'joinDate' | 'status';

export function PeoplePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<PageTab>('employees');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeListItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const page = Number(searchParams.get('page') ?? '1');
  const limit = Number(searchParams.get('limit') ?? '20');
  const sortBy = (searchParams.get('sortBy') ?? 'joinDate') as SortField;
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc';

  const listQuery = useQuery({
    queryKey: ['people', 'list', searchParams.toString()],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<PeopleListResponse>>(endpoints.people.list, {
        params: {
          ...(searchParams.get('search') ? { search: searchParams.get('search') } : {}),
          ...(searchParams.get('departmentId') ? { departmentId: searchParams.get('departmentId') } : {}),
          ...(searchParams.get('roleId') ? { roleId: searchParams.get('roleId') } : {}),
          ...(searchParams.get('reportingManagerId') ? { reportingManagerId: searchParams.get('reportingManagerId') } : {}),
          ...(searchParams.get('status') ? { status: searchParams.get('status') } : {}),
          page,
          limit,
          sortBy,
          sortOrder
        }
      });
      return response.data.data;
    }
  });

  const filtersQuery = useQuery({
    queryKey: ['people', 'filters'],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<PeopleFiltersData>>(endpoints.people.filters);
      return response.data.data;
    }
  });

  const selectedEmployees = useMemo(
    () => (listQuery.data?.items ?? []).filter((employee) => selectedIds.includes(employee.id)),
    [listQuery.data?.items, selectedIds]
  );

  async function openEmployee(id: string): Promise<void> {
    const employee = listQuery.data?.items.find((item) => item.id === id) ?? null;
    if (employee) {
      setSelectedEmployee(employee);
      return;
    }

    try {
      const response = await api.get<ApiEnvelope<EmployeeProfile>>(endpoints.people.detail(id));
      const profile = response.data.data;
      setSelectedEmployee({
        id: profile.id,
        employeeId: profile.employeeId,
        name: profile.name,
        email: profile.email,
        avatar: profile.avatar ?? null,
        role: null,
        department: profile.department,
        designation: profile.designation,
        reportingManager: profile.reportingManager?.name ?? null,
        status: profile.status,
        joinDate: profile.joinDate,
        lastActive: null
      });
    } catch {
      setSelectedEmployee(null);
    }
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="People module"
          title="Employee Management"
          description="Unified directory, HRMS table, and admin controls for employee visibility and operations."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <SectionCard title="Directory + HRMS unified">
            <Users className="mb-4 size-5 text-cyan-200" />
            <p className="text-sm text-muted-foreground">Switch between card-based discovery and the full HRMS table without losing filters or pagination context.</p>
          </SectionCard>
          <SectionCard title="Permission-scoped access">
            <Shield className="mb-4 size-5 text-cyan-200" />
            <p className="text-sm text-muted-foreground">The same page respects scope filtering from the backend while surfacing richer HR data where visibility allows it.</p>
          </SectionCard>
          <SectionCard title="Operations ready">
            <Building2 className="mb-4 size-5 text-cyan-200" />
            <p className="text-sm text-muted-foreground">Bulk import, selection staging, and profile drill-down are now part of one operational surface.</p>
          </SectionCard>
        </div>

        <PeopleFilters options={filtersQuery.data ?? { departments: [], roles: [], designations: [], reportingManagers: [] }} />

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PageTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="directory">Directory</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="controls">HRMS Controls</TabsTrigger>
          </TabsList>

          <TabsContent value="directory">
            <DirectoryTab
              data={listQuery.data?.items ?? []}
              isLoading={listQuery.isLoading}
              onEmployeeClick={openEmployee}
              page={page}
              total={listQuery.data?.meta.total ?? 0}
              limit={limit}
              totalPages={listQuery.data?.meta.totalPages ?? 1}
              onPageChange={(nextPage) => {
                const next = new URLSearchParams(searchParams);
                next.set('page', String(nextPage));
                setSearchParams(next);
              }}
            />
          </TabsContent>

          <TabsContent value="employees">
            <EmployeesTab
              data={listQuery.data?.items ?? []}
              isLoading={listQuery.isLoading}
              onRowClick={openEmployee}
              page={page}
              limit={limit}
              total={listQuery.data?.meta.total ?? 0}
              totalPages={listQuery.data?.meta.totalPages ?? 1}
              onPageChange={(nextPage) => {
                const next = new URLSearchParams(searchParams);
                next.set('page', String(nextPage));
                setSearchParams(next);
              }}
              onPageSizeChange={(nextLimit) => {
                const next = new URLSearchParams(searchParams);
                next.set('limit', String(nextLimit));
                next.set('page', '1');
                setSearchParams(next);
              }}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={(nextSortBy, nextSortOrder) => {
                const next = new URLSearchParams(searchParams);
                next.set('sortBy', nextSortBy);
                next.set('sortOrder', nextSortOrder);
                setSearchParams(next);
              }}
            />
          </TabsContent>

          <TabsContent value="controls">
            <HRMSControlsTab
              selectedEmployees={selectedEmployees}
              onClearSelection={() => setSelectedIds([])}
              onOpenImport={() => setImportOpen(true)}
              onOpenEmployee={openEmployee}
            />
          </TabsContent>
        </Tabs>

        <BulkImportModal
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={() => {
            void listQuery.refetch();
          }}
        />

        <EmployeeDrawer
          employee={selectedEmployee}
          open={Boolean(selectedEmployee)}
          onClose={() => setSelectedEmployee(null)}
          onOpenEmployee={(id) => {
            if (!id) {
              return;
            }
            void openEmployee(id);
          }}
        />
      </div>
    </PageTransition>
  );
}
