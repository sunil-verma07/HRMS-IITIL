import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getInitials, setCsvSearchParam, setSingleSearchParam, splitCsvParam, type FilterOption, type PeopleFiltersData } from './types';

type PeopleFiltersProps = {
  options: PeopleFiltersData;
};

type SearchableMultiSelectProps = {
  label: string;
  paramKey: string;
  options: FilterOption[];
};

function SearchableMultiSelect({ label, paramKey, options }: SearchableMultiSelectProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedValues = splitCsvParam(searchParams.get(paramKey));
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const filteredOptions = useMemo(
    () => options.filter((option) => option.name.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  return (
    <div ref={containerRef} className="relative min-w-52">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-white/[0.03] px-3 text-sm text-left text-foreground"
      >
        <span className="truncate">{selectedValues.length > 0 ? `${label}: ${selectedValues.length}` : label}</span>
        <span className="text-xs text-muted-foreground">{open ? 'Close' : 'Open'}</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-full rounded-xl border border-border bg-slate-950 p-3 shadow-2xl">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${label.toLowerCase()}`} />
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {filteredOptions.map((option) => {
              const checked = selectedValues.includes(option.id);

              return (
                <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/[0.04]">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(nextChecked) => {
                      const nextValues = nextChecked
                        ? [...selectedValues, option.id]
                        : selectedValues.filter((value) => value !== option.id);

                      setSearchParams((current) => setCsvSearchParam(current, paramKey, nextValues));
                    }}
                  />
                  <span className="text-sm text-foreground">{option.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ManagerSelectProps = {
  managers: FilterOption[];
};

function ManagerSelect({ managers }: ManagerSelectProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedManagerId = searchParams.get('reportingManagerId') ?? '';
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const filteredManagers = useMemo(
    () => managers.filter((manager) => manager.name.toLowerCase().includes(search.toLowerCase())),
    [managers, search]
  );

  const selectedManager = managers.find((manager) => manager.id === selectedManagerId);

  return (
    <div ref={containerRef} className="relative min-w-56">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-white/[0.03] px-3 text-sm text-left text-foreground"
      >
        <span className="truncate">{selectedManager ? selectedManager.name : 'Reporting manager'}</span>
        <span className="text-xs text-muted-foreground">{open ? 'Close' : 'Open'}</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-full rounded-xl border border-border bg-slate-950 p-3 shadow-2xl">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search manager" />
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {filteredManagers.map((manager) => (
              <button
                key={manager.id}
                type="button"
                onClick={() => {
                  setSearchParams((current) => setSingleSearchParam(current, 'reportingManagerId', manager.id));
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/[0.04]',
                  manager.id === selectedManagerId && 'bg-cyan-400/[0.08]'
                )}
              >
                <div className="grid size-9 place-items-center rounded-full bg-cyan-300/10 text-xs font-semibold text-cyan-200">
                  {getInitials(manager.name)}
                </div>
                <span className="text-sm text-foreground">{manager.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PeopleFilters({ options }: PeopleFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('search') ?? '');
  const hasActiveFilters = Boolean(
    searchParams.get('search') ||
      searchParams.get('departmentId') ||
      searchParams.get('roleId') ||
      searchParams.get('reportingManagerId') ||
      searchParams.get('status')
  );

  useEffect(() => {
    setSearchValue(searchParams.get('search') ?? '');
  }, [searchParams]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchParams((current) => setSingleSearchParam(current, 'search', searchValue.trim() || undefined));
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchValue, setSearchParams]);

  const status = searchParams.get('status') ?? 'ALL';

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Search people by name, email, or employee ID" />
        </div>
        <div className="flex flex-wrap gap-3">
          <SearchableMultiSelect label="Departments" paramKey="departmentId" options={options.departments} />
          <SearchableMultiSelect label="Roles" paramKey="roleId" options={options.roles} />
          <ManagerSelect managers={options.reportingManagers} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {['ALL', 'ACTIVE', 'INACTIVE'].map((value) => (
            <Button
              key={value}
              type="button"
              variant={status === value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setSearchParams((current) => setSingleSearchParam(current, 'status', value === 'ALL' ? undefined : value));
              }}
            >
              {value}
            </Button>
          ))}
        </div>

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('search');
              next.delete('departmentId');
              next.delete('roleId');
              next.delete('reportingManagerId');
              next.delete('status');
              next.delete('page');
              setSearchValue('');
              setSearchParams(next);
            }}
          >
            <X className="size-4" />
            Clear all
          </Button>
        ) : null}
      </div>
    </div>
  );
}
