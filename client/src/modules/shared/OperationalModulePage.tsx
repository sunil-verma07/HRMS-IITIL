import type { ColumnDef, SortingState } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Plus, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { PageTransition } from '@/components/animations/PageTransition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable } from '@/components/tables/DataTable';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { useDebounce } from '@/hooks/use-debounce';
import { useResourceQuery } from '@/hooks/use-resource-query';
import type { QueryParams } from '@/types/api';

export type ModulePageConfig<T extends Record<string, unknown>> = {
  resource: string;
  endpoint: string;
  eyebrow: string;
  title: string;
  description: string;
  createLabel: string;
  columns: ColumnDef<T>[];
  emptyTitle: string;
  emptyDescription: string;
  filters?: Array<{ key: string; label: string; value: string }>;
  onCreate?: () => void;
  extraActions?: ReactNode;
};

export function OperationalModulePage<T extends Record<string, unknown>>({
  config
}: {
  config: ModulePageConfig<T>;
}) {
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    department: '',
    status: '',
    employmentType: ''
  });
  const debouncedSearch = useDebounce(search);
  const params: QueryParams = useMemo(
    () => ({
      page,
      limit: 20,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(sorting[0] ? { sortBy: sorting[0].id, sortOrder: sorting[0].desc ? 'desc' : 'asc' } : {}),
      filters: {
        ...(filters.department ? { department: filters.department } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.employmentType ? { employmentType: filters.employmentType } : {})
      }
    }),
    [debouncedSearch, filters, page, sorting]
  );
  const query = useResourceQuery<T>(config.resource, config.endpoint, params);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, sorting]);

  const exportCsv = () => {
    const rows = query.data?.items ?? [];
    const csv = rows.map((row) => Object.values(row).map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${config.resource}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow={config.eyebrow}
          title={config.title}
          description={config.description}
          actions={
            <>
              <Button variant="outline" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal className="size-4" />
                Filters
              </Button>
              {config.onCreate ? (
                <Button onClick={config.onCreate}>
                  <Plus className="size-4" />
                  {config.createLabel}
                </Button>
              ) : null}
              {config.extraActions}
            </>
          }
        />

        {query.isError ? <ErrorState message={query.error.message} onRetry={() => void query.refetch()} /> : null}

        <SectionCard
          title={config.title}
          description={`${query.data?.meta?.total ?? 0} records returned from the IITIL API.`}
          actions={
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search records..." />
            </div>
          }
        >
          {config.filters?.length ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {config.filters.map((filter) => (
                <Badge key={filter.key} variant="muted">{filter.label}: {filter.value}</Badge>
              ))}
            </div>
          ) : null}
          <DataTable
            data={query.data?.items ?? []}
            columns={config.columns}
            isLoading={query.isLoading}
            emptyTitle={config.emptyTitle}
            emptyDescription={config.emptyDescription}
            onSortingChange={setSorting}
            onExport={exportCsv}
            page={query.data?.meta?.page ?? page}
            totalPages={query.data?.meta?.totalPages ?? 1}
            total={query.data?.meta?.total ?? 0}
            onPageChange={setPage}
          />
        </SectionCard>
        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Filters</DialogTitle>
              <DialogDescription>Filter this table without changing the underlying visibility policy.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm">
                <span className="text-muted-foreground">Department</span>
                <Input value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))} placeholder="Engineering, HR..." />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="text-muted-foreground">Status</span>
                <Input value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value.toUpperCase() }))} placeholder="ACTIVE, INACTIVE..." />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="text-muted-foreground">Employment type</span>
                <Input value={filters.employmentType} onChange={(event) => setFilters((current) => ({ ...current, employmentType: event.target.value.toUpperCase() }))} placeholder="FULL_TIME, INTERN..." />
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setFilters({ department: '', status: '', employmentType: '' })}>
                  <RotateCcw className="size-4" />
                  Reset
                </Button>
                <Button onClick={() => setFiltersOpen(false)}>Apply filters</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
