import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { endpoints } from '@/services/api/endpoints';
import type { ApiEnvelope, EmployeeProfile } from '../types';

type PermissionsTabProps = {
  employeeId: string;
  enabled: boolean;
};

export function PermissionsTab({ employeeId, enabled }: PermissionsTabProps) {
  const query = useQuery({
    queryKey: ['people', 'detail', employeeId],
    enabled,
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<EmployeeProfile>>(endpoints.people.detail(employeeId));
      return response.data.data;
    }
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading permissions...</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-white/[0.03] p-4 text-sm text-muted-foreground">
        Roles: {query.data?.permissionsSummary?.roles.join(', ') ?? 'Restricted'}
      </div>
      <div className="flex flex-wrap gap-2">
        {query.data?.permissionsSummary?.permissions?.map((permission) => (
          <Badge key={permission} variant="muted">{permission}</Badge>
        )) ?? <p className="text-sm text-muted-foreground">No permission summary available.</p>}
      </div>
    </div>
  );
}
