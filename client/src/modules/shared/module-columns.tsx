import type { ColumnDef } from '@tanstack/react-table';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/guards/PermissionGate';
import { permissions } from '@/constants/permissions';
import { useAuthStore } from '@/store/auth.store';

export type GenericRecord = Record<string, unknown>;

function value(record: GenericRecord, key: string): string {
  const raw = record[key];
  return raw === null || raw === undefined ? '-' : String(raw);
}

type DeleteCellProps = {
  record: GenericRecord;
  onDelete: (record: GenericRecord) => void;
  canManage: boolean;
};

function DeleteCell({ record, onDelete, canManage }: DeleteCellProps) {
  const currentUser = useAuthStore((s) => s.user);
  const recordId = value(record, 'id');
  const isOwnRecord = currentUser?.employeeId === recordId;

  if (!canManage || isOwnRecord) return null;

  return (
    <PermissionGate permissions={[permissions.employeeDelete, permissions.employeeUserManage]}>
      <Button
        variant="ghost"
        size="sm"
        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
        onClick={() => onDelete(record)}
      >
        <Trash2 className="size-4" />
      </Button>
    </PermissionGate>
  );
}

export function makeEmployeeColumns(
  onDelete: (record: GenericRecord) => void,
  canManage: boolean
): ColumnDef<GenericRecord>[] {
  const columns: ColumnDef<GenericRecord>[] = [
    {
      accessorKey: 'employeeId',
      header: 'Employee ID',
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {value(row.original, 'employeeId')}
        </span>
      )
    },
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {value(row.original, 'firstName')} {value(row.original, 'lastName')}
        </span>
      )
    },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'designation', header: 'Designation' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="success">{value(row.original, 'status')}</Badge>
      )
    }
  ];

  if (canManage) {
    columns.push({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DeleteCell record={row.original} onDelete={onDelete} canManage={canManage} />
      )
    });
  }

  return columns;
}

export const genericColumns: ColumnDef<GenericRecord>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {value(row.original, 'id').slice(0, 12)}
      </span>
    )
  },
  {
    id: 'primary',
    header: 'Primary',
    cell: ({ row }) => (
      <span className="font-medium text-foreground">
        {value(row.original, 'title') !== '-'
          ? value(row.original, 'title')
          : value(row.original, 'name') !== '-'
          ? value(row.original, 'name')
          : value(row.original, 'userId')}
      </span>
    )
  },
  {
    id: 'secondary',
    header: 'Secondary',
    cell: ({ row }) =>
      value(row.original, 'email') !== '-'
        ? value(row.original, 'email')
        : value(row.original, 'department')
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant="violet">{value(row.original, 'status')}</Badge>
    )
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => value(row.original, 'createdAt')
  }
];