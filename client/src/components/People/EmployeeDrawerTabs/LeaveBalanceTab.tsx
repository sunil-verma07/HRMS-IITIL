import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { endpoints } from '@/services/api/endpoints';
import type { ApiEnvelope, EmployeeProfile } from '../types';

type LeaveBalanceTabProps = {
  employeeId: string;
  enabled: boolean;
};

export function LeaveBalanceTab({ employeeId, enabled }: LeaveBalanceTabProps) {
  const query = useQuery({
    queryKey: ['people', 'detail', employeeId],
    enabled,
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<EmployeeProfile>>(endpoints.people.detail(employeeId));
      return response.data.data;
    }
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading leave balances...</p>;

  return (
    <div className="space-y-3">
      {query.data?.leaveBalances?.length ? (
        query.data.leaveBalances.map((balance) => (
          <div key={`${balance.leaveTypeCode}-${balance.year}`} className="rounded-xl border border-border bg-white/[0.03] p-4">
            <p className="font-medium text-foreground">{balance.leaveType}</p>
            <p className="mt-1 text-sm text-muted-foreground">Allocated: {balance.allocated} · Used: {balance.used} · Remaining: {balance.remaining}</p>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No leave balance data available.</p>
      )}
    </div>
  );
}
