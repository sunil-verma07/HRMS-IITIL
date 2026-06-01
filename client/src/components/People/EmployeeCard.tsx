import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { getInitials, type EmployeeListItem } from './types';

type EmployeeCardProps = {
  employee: EmployeeListItem;
  onClick: (id: string) => void;
};

export function EmployeeCard({ employee, onClick }: EmployeeCardProps) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => onClick(employee.id)}
      className="group w-full rounded-2xl border border-border bg-white/[0.03] p-5 text-left transition-colors hover:border-cyan-400/40 hover:bg-cyan-400/[0.05]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-cyan-300/10 font-semibold text-cyan-200">
            {getInitials(employee.name)}
          </div>
          <div>
            <p className="font-medium text-foreground">{employee.name}</p>
            <p className="text-xs text-muted-foreground">{employee.employeeId}</p>
          </div>
        </div>
        <Badge variant={employee.status === 'ACTIVE' ? 'success' : 'muted'}>{employee.status}</Badge>
      </div>
      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        <p>{employee.email}</p>
        <p>{employee.department} · {employee.designation}</p>
        <p>Role: {employee.role ?? 'Unassigned'}</p>
        <p>Manager: {employee.reportingManager ?? 'Not assigned'}</p>
      </div>
    </motion.button>
  );
}
