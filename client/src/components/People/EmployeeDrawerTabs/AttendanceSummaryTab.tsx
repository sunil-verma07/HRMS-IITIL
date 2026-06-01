import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { endpoints } from '@/services/api/endpoints';
import type { ApiEnvelope, EmployeeProfile } from '../types';

type AttendanceSummaryTabProps = {
  employeeId: string;
  enabled: boolean;
};

export function AttendanceSummaryTab({ employeeId, enabled }: AttendanceSummaryTabProps) {
  const query = useQuery({
    queryKey: ['people', 'detail', employeeId],
    enabled,
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<EmployeeProfile>>(endpoints.people.detail(employeeId));
      return response.data.data;
    }
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading attendance summary...</p>;

  return (
    <div className="rounded-xl border border-border bg-white/[0.03] p-4">
      <p className="text-sm text-muted-foreground">Average work minutes: {query.data?.attendanceSummary?.averageWorkMinutes ?? 0}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {query.data?.attendanceSummary?.byStatus.map((item) => (
          <Badge key={item.status} variant="muted">{item.status}: {item.count}</Badge>
        )) ?? <p className="text-sm text-muted-foreground">No attendance data</p>}
      </div>
    </div>
  );
}
