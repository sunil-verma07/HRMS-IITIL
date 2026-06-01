import { EmployeeTable } from '@/components/People/EmployeeTable';
import type { EmployeeListItem } from '@/components/People/types';

type EmployeesTabProps = {
  data: EmployeeListItem[];
  isLoading: boolean;
  onRowClick: (id: string) => void;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (limit: number) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  sortBy: 'name' | 'department' | 'role' | 'joinDate' | 'status';
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: 'name' | 'department' | 'role' | 'joinDate' | 'status', sortOrder: 'asc' | 'desc') => void;
};

export function EmployeesTab(props: EmployeesTabProps) {
  return <EmployeeTable {...props} />;
}
