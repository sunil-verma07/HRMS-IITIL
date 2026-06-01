import { motion } from 'framer-motion';
import { ArrowDownUp, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { EmployeeListItem } from './types';

type SortField = 'name' | 'department' | 'role' | 'joinDate' | 'status';
type SortOrder = 'asc' | 'desc';

type EmployeeTableProps = {
  data: EmployeeListItem[];
  isLoading: boolean;
  onRowClick: (id: string) => void;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (limit: number) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  onSortChange?: (sortBy: SortField, sortOrder: SortOrder) => void;
};

const sortableFields: Array<{ key: SortField; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'department', label: 'Department' },
  { key: 'role', label: 'Role' },
  { key: 'joinDate', label: 'Join date' },
  { key: 'status', label: 'Status' }
];

export function EmployeeTable({
  data,
  isLoading,
  onRowClick,
  page = 1,
  limit = 20,
  total = data.length,
  totalPages = 1,
  onPageChange,
  onPageSizeChange,
  selectedIds = [],
  onSelectionChange,
  sortBy = 'joinDate',
  sortOrder = 'desc',
  onSortChange
}: EmployeeTableProps) {
  const allSelected = data.length > 0 && data.every((row) => selectedIds.includes(row.id));
  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = Math.min(page * limit, total);

  function toggleSort(field: SortField): void {
    const nextOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    onSortChange?.(field, nextOrder);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-white/[0.03]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-white/[0.03] text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => {
                      onSelectionChange?.(checked ? data.map((row) => row.id) : []);
                    }}
                  />
                </th>
                {sortableFields.map((column) => (
                  <th key={column.key} className="px-4 py-3">
                    <button type="button" className="inline-flex items-center gap-2 hover:text-foreground" onClick={() => toggleSort(column.key)}>
                      {column.label}
                      <ArrowDownUp className="size-3.5" />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3">Manager</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <motion.tr
                      key={index}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="border-t border-border"
                    >
                      <td className="px-4 py-4"><div className="h-4 w-4 rounded bg-white/10" /></td>
                      {Array.from({ length: 6 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-4"><div className="h-4 rounded bg-white/10" /></td>
                      ))}
                    </motion.tr>
                  ))
                : data.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-14 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                          <Users className="size-8" />
                          <p className="font-medium text-foreground">No employees found</p>
                          <p className="text-sm">Try adjusting your filters or search criteria.</p>
                        </div>
                      </td>
                    </tr>
                    )
                  : data.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => onRowClick(row.id)}
                        className="cursor-pointer border-t border-border transition-colors duration-200 hover:bg-cyan-400/[0.05]"
                      >
                        <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.includes(row.id)}
                            onCheckedChange={(checked) => {
                              const next = checked
                                ? [...selectedIds, row.id]
                                : selectedIds.filter((value) => value !== row.id);
                              onSelectionChange?.(next);
                            }}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-foreground">{row.name}</p>
                            <p className="text-xs text-muted-foreground">{row.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{row.department}</td>
                        <td className="px-4 py-4 text-muted-foreground">{row.role ?? 'Unassigned'}</td>
                        <td className="px-4 py-4 text-muted-foreground">{new Date(row.joinDate).toLocaleDateString()}</td>
                        <td className="px-4 py-4"><Badge variant={row.status === 'ACTIVE' ? 'success' : 'muted'}>{row.status}</Badge></td>
                        <td className="px-4 py-4 text-muted-foreground">{row.reportingManager ?? 'Not assigned'}</td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {showingFrom}-{showingTo} of {total}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={String(limit)} onValueChange={(value) => onPageSizeChange?.(Number(value))}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>{size} / page</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)}>
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {Math.max(totalPages, 1)}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange?.(page + 1)}>
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
