// src/modules/recruitment/PipelineBoard.tsx
import { useQuery } from '@tanstack/react-query';
import { httpClient } from '@/services/api/http-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type PipelineStage = {
  count: number;
  items: Array<{
    id: string;
    candidate: { firstName: string; lastName: string; email: string };
    job: { title: string };
    stage: string;
    updatedAt: string;
  }>;
};

type PipelineData = Record<string, PipelineStage>;

export function PipelineBoard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pipeline'],
    queryFn: async () => {
      const res = await httpClient.get<{ data: PipelineData }>('/applications/pipeline');
      return res.data.data;
    }
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 overflow-x-auto md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-muted-foreground">Failed to load pipeline data.</div>;
  }

  if (!data) return null;

  const stages = Object.entries(data);

  return (
    <div className="grid gap-4 overflow-x-auto md:grid-cols-2 xl:grid-cols-4">
      {stages.map(([stage, { count, items }]) => (
        <Card key={stage} className="flex flex-col h-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex justify-between items-center text-base">
              {stage.replace(/_/g, ' ')}
              <Badge variant="secondary">{count}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {items.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">No candidates</div>
              ) : (
                items.map((app) => (
                  <div key={app.id} className="rounded-lg border p-2 text-sm">
                    <div className="font-medium">
                      {app.candidate.firstName} {app.candidate.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{app.job.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Updated {new Date(app.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}