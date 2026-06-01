import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmployeeCard } from '@/components/People/EmployeeCard';
import type { EmployeeListItem } from '@/components/People/types';

type DirectoryTabProps = {
  data: EmployeeListItem[];
  isLoading: boolean;
  onEmployeeClick: (id: string) => void;
  page: number;
  total: number;
  limit: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function DirectoryTab({ data, isLoading, onEmployeeClick, page, total, limit, totalPages, onPageChange }: DirectoryTabProps) {
  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = Math.min(page * limit, total);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="h-52 rounded-2xl border border-border bg-white/[0.03]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-white/[0.03] text-center text-muted-foreground">
          <Users className="size-8" />
          <p className="font-medium text-foreground">No employees found</p>
          <p className="text-sm">Try broadening the current filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((employee) => (
            <EmployeeCard key={employee.id} employee={employee} onClick={onEmployeeClick} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">Showing {showingFrom}-{showingTo} of {total}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="size-4" />
            Prev
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
