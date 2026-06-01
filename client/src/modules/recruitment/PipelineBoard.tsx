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
      <div className="w-full overflow-x-auto">
        <div className="inline-flex min-w-full gap-4 whitespace-nowrap pb-2 align-top">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-72 min-w-[16rem] flex-shrink-0 rounded-xl align-top whitespace-normal" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-muted-foreground">Failed to load pipeline data.</div>;
  }

  if (!data) return null;

  const stages = Object.entries(data);

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-flex min-w-full gap-4 whitespace-nowrap pb-2 align-top">
        {stages.map(([stage, { count, items }]) => (
          <Card key={stage} className="flex h-full w-72 min-w-[16rem] flex-shrink-0 flex-col overflow-hidden align-top whitespace-normal">
            <CardHeader className="pb-2">
              <CardTitle className="flex min-w-0 items-start justify-between gap-2 text-base">
                <span className="min-w-0 flex-1 break-words pr-2 leading-6">{stage.replace(/_/g, ' ')}</span>
                <Badge variant="secondary" className="shrink-0">{count}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <div className="max-h-64 flex-1 overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    Drop candidates here
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((app) => (
                      <div key={app.id} className="rounded-lg border p-2 text-sm">
                        <div className="font-medium">
                          {app.candidate.firstName} {app.candidate.lastName}
                        </div>
                        <div className="mt-0.5 break-words text-xs text-muted-foreground">{app.job.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Updated {new Date(app.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}