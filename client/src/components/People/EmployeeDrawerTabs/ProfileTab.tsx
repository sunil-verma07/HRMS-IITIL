import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { endpoints } from '@/services/api/endpoints';
import type { ApiEnvelope, EmployeeProfile } from '../types';

type ProfileTabProps = {
  employeeId: string;
  enabled: boolean;
  onOpenEmployee?: (id: string) => void;
};

export function ProfileTab({ employeeId, enabled, onOpenEmployee }: ProfileTabProps) {
  const query = useQuery({
    queryKey: ['people', 'detail', employeeId],
    enabled,
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<EmployeeProfile>>(endpoints.people.detail(employeeId));
      return response.data.data;
    }
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading profile...</p>;
  if (!query.data) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-white/[0.03] p-4">
        <h3 className="font-medium text-foreground">Contact</h3>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>{query.data.email}</p>
          <p>{query.data.phone ?? 'No phone available'}</p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-white/[0.03] p-4">
        <h3 className="font-medium text-foreground">Organization</h3>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>{query.data.department}</p>
          <p>{query.data.designation}</p>
          <div className="rounded-lg border border-border/60 bg-white/[0.02] p-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Reporting Manager</p>
            {query.data.reportingManager ? (
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-white/5"
                onClick={() => onOpenEmployee?.(query.data.reportingManager?.id ?? '')}
              >
                <span className="grid size-7 place-items-center rounded-md bg-cyan-300/10 text-[10px] font-semibold text-cyan-200">
                  {query.data.reportingManager.avatar ? (
                    <img
                      src={query.data.reportingManager.avatar}
                      alt={query.data.reportingManager.name}
                      className="h-full w-full rounded-md object-cover"
                    />
                  ) : (
                    query.data.reportingManager.name
                      .split(' ')
                      .map((part) => part[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  )}
                </span>
                <span>
                  <span className="block text-sm font-medium text-foreground">{query.data.reportingManager.name}</span>
                  <span className="block text-xs text-muted-foreground">{query.data.reportingManager.designation}</span>
                </span>
              </button>
            ) : (
              <p className="mt-1 text-sm">No reporting manager assigned</p>
            )}
          </div>
          <Badge variant={query.data.status === 'ACTIVE' ? 'success' : 'muted'}>{query.data.status}</Badge>
        </div>
      </div>
    </div>
  );
}
