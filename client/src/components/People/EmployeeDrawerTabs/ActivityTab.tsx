import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { endpoints } from '@/services/api/endpoints';
import type { ApiEnvelope, EmployeeProfile } from '../types';

type ActivityTabProps = {
  employeeId: string;
  enabled: boolean;
};

export function ActivityTab({ employeeId, enabled }: ActivityTabProps) {
  const query = useQuery({
    queryKey: ['people', 'detail', employeeId],
    enabled,
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<EmployeeProfile>>(endpoints.people.detail(employeeId));
      return response.data.data;
    }
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading activity...</p>;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-white/[0.03] p-4 text-sm text-muted-foreground">
        Onboarding: {query.data?.onboardingStatus ? `${query.data.onboardingStatus.status} · Step ${query.data.onboardingStatus.currentStep}` : 'No onboarding workflow'}
      </div>
      <div className="rounded-xl border border-border bg-white/[0.03] p-4 text-sm text-muted-foreground">
        Direct reports: {query.data?.directReports?.map((report) => report.name).join(', ') || 'None'}
      </div>
    </div>
  );
}
