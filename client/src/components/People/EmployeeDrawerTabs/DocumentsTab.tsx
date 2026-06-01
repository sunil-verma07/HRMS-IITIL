import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { endpoints } from '@/services/api/endpoints';
import type { ApiEnvelope, EmployeeProfile } from '../types';

type DocumentsTabProps = {
  employeeId: string;
  enabled: boolean;
};

export function DocumentsTab({ employeeId, enabled }: DocumentsTabProps) {
  const query = useQuery({
    queryKey: ['people', 'detail', employeeId],
    enabled,
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<EmployeeProfile>>(endpoints.people.detail(employeeId));
      return response.data.data;
    }
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading documents...</p>;

  return (
    <div className="space-y-3">
      {query.data?.documents?.length ? (
        query.data.documents.map((document) => (
          <div key={document} className="flex items-center gap-3 rounded-xl border border-border bg-white/[0.03] p-4 text-sm text-muted-foreground">
            <FileText className="size-4" />
            {document}
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No documents available.</p>
      )}
    </div>
  );
}
