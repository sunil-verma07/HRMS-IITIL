import { DndContext, PointerSensor, closestCenter, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquarePlus, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { endpoints } from '@/services/api/endpoints';
import type { ApiResponse } from '@/types/api';
import { RECRUITMENT_PIPELINE, type CandidatePipelineItem, type RecruitmentStage } from './types';

type KanbanPayload = {
  job: {
    id: string;
    title: string;
    status: string;
    pipelineStages?: string[];
  };
  items: CandidatePipelineItem[];
};

type KanbanBoardProps = {
  jobId: string | null;
  readOnly?: boolean;
  onCandidateOpen?: (candidateId: string) => void;
};

type SortableCardProps = {
  candidate: CandidatePipelineItem;
  onClick: (candidateId: string) => void;
};

function stageLabel(stage: string): string {
  return stage.replace(/_/g, ' ');
}

function stageColor(stage: string): string {
  switch (stage) {
    case 'SCREENING':
      return 'bg-cyan-500/10 text-cyan-200 border-cyan-500/20';
    case 'INTERVIEW':
      return 'bg-violet-500/10 text-violet-200 border-violet-500/20';
    case 'TECHNICAL':
      return 'bg-blue-500/10 text-blue-200 border-blue-500/20';
    case 'OFFER':
      return 'bg-amber-500/10 text-amber-200 border-amber-500/20';
    case 'HIRED':
      return 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20';
    case 'REJECTED':
      return 'bg-rose-500/10 text-rose-200 border-rose-500/20';
    default:
      return 'bg-white/[0.04] text-muted-foreground border-border';
  }
}

function SortableCard({ candidate, onClick }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: candidate.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.button
      layout
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      type="button"
      onClick={() => onClick(candidate.id)}
      className={cn(
        'w-full rounded-2xl border border-border bg-slate-950/70 p-4 text-left shadow-sm transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.04]',
        isDragging && 'opacity-60 ring-2 ring-cyan-400/40'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{candidate.candidate.firstName} {candidate.candidate.lastName}</p>
          <p className="text-xs text-muted-foreground">{candidate.candidate.email}</p>
        </div>
        <div className="flex items-center gap-1 text-amber-300">
          <Star className="size-3.5" />
          <span className="text-xs">{candidate.score.toFixed(1)}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge className={stageColor(candidate.stage)}>{stageLabel(candidate.stage)}</Badge>
        {candidate.currentInterviewStatus ? <Badge variant="outline">{candidate.currentInterviewStatus.replace(/_/g, ' ')}</Badge> : null}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">Applied {formatDistanceToNow(new Date(candidate.appliedAt), { addSuffix: true })}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(candidate.tags ?? []).slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-full border border-border bg-white/[0.04] px-2 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
        ))}
        {candidate.tags.length === 0 ? <span className="text-[11px] text-muted-foreground">No tags</span> : null}
      </div>
    </motion.button>
  );
}

function StageColumn({
  stage,
  items,
  onCandidateOpen,
  readOnly,
}: {
  stage: string;
  items: CandidatePipelineItem[];
  onCandidateOpen: (candidateId: string) => void;
  readOnly?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-full min-h-[36rem] w-72 min-w-[16rem] flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-border bg-white/[0.03]',
        isOver && 'ring-2 ring-cyan-400/30'
      )}
    >
      <div className="space-y-2 border-b border-border/50 p-4 pb-3">
        <div className="flex min-w-0 items-start justify-between gap-2 text-sm font-semibold uppercase tracking-wide text-foreground">
          <span className="min-w-0 flex-1 break-words pr-2 leading-5">{stageLabel(stage)}</span>
          <Badge variant="secondary" className="shrink-0">{items.length}</Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          {items.length > 0 ? <div className="space-y-3">{items.map((item) => <SortableCard key={item.id} candidate={item} onClick={onCandidateOpen} />)}</div> : (
            <div className="flex min-h-[12rem] flex-1 items-center justify-center rounded-2xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
              Drop candidates here
            </div>
          )}
        </SortableContext>
        {readOnly ? <p className="pt-2 text-center text-xs text-muted-foreground">Read only</p> : null}
      </div>
    </div>
  );
}

export function KanbanBoard({ jobId, readOnly, onCandidateOpen }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const stageOrder = RECRUITMENT_PIPELINE as readonly string[];

  const pipelineQuery = useQuery({
    queryKey: ['recruitment', 'job-candidates', jobId],
    enabled: Boolean(jobId),
    queryFn: async () => {
      const response = await api.get<ApiResponse<KanbanPayload>>(`${endpoints.recruitment.jobs}/${jobId}/candidates`);
      return response.data.data;
    },
    staleTime: 0,
  });

  const optimisticItems = pipelineQuery.data?.items ?? [];

  const moveMutation = useMutation({
    mutationFn: async ({ candidateId, nextStage }: { candidateId: string; nextStage: string }) => {
      if (!jobId) {
        throw new Error('Job is required');
      }

      await api.patch(endpoints.recruitment.candidateStage(candidateId), {
        jobId,
        stage: nextStage,
      });
    },
    onMutate: async ({ candidateId, nextStage }) => {
      if (!jobId) return;

      await queryClient.cancelQueries({ queryKey: ['recruitment', 'job-candidates', jobId] });
      const previous = queryClient.getQueryData<ApiResponse<KanbanPayload>>(['recruitment', 'job-candidates', jobId]);

      queryClient.setQueryData<ApiResponse<KanbanPayload>>(['recruitment', 'job-candidates', jobId], (current) => {
        if (!current?.data) return current;

        return {
          ...current,
          data: {
            ...current.data,
            items: current.data.items.map((item) =>
              item.id === candidateId ? { ...item, stage: nextStage } : item,
            ),
          },
        };
      });

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (jobId && context?.previous) {
        queryClient.setQueryData(['recruitment', 'job-candidates', jobId], context.previous);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to update candidate stage');
    },
    onSettled: () => {
      if (jobId) {
        queryClient.invalidateQueries({ queryKey: ['recruitment', 'job-candidates', jobId] });
      }
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const grouped = useMemo(() => {
    const map = new Map<string, CandidatePipelineItem[]>();
    stageOrder.forEach((stage) => map.set(stage, []));
    optimisticItems.forEach((item) => {
      const stage = stageOrder.includes(item.stage as RecruitmentStage) ? item.stage : 'APPLIED';
      map.get(stage)?.push(item);
    });
    return map;
  }, [optimisticItems, stageOrder]);

  const updateStage = async (candidateId: string, nextStage: string) => {
    moveMutation.mutate({ candidateId, nextStage });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCandidateId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCandidateId(null);

    if (!over || readOnly) return;
    const overId = String(over.id);
    const activeId = String(active.id);
    const activeItem = optimisticItems.find((item) => item.id === activeId);

    if (!activeItem || !stageOrder.includes(overId)) return;
    if (activeItem.stage === overId) return;

    void updateStage(activeId, overId);
  };

  if (!jobId) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Select a job to view its candidate pipeline.
      </div>
    );
  }

  if (pipelineQuery.isLoading) {
    return (
      <div className="w-full overflow-x-auto">
        <div className="inline-flex min-w-full gap-4 whitespace-nowrap pb-2 align-top">
          {stageOrder.map((stage) => (
            <div key={stage} className="flex h-[36rem] w-72 min-w-[16rem] flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-border bg-white/[0.03] align-top whitespace-normal">
              <div className="border-b border-border/50 p-4 pb-3">
                <p className="break-words text-sm uppercase tracking-wide text-muted-foreground">{stageLabel(stage)}</p>
              </div>
              <div className="space-y-3 p-3">
                <div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
                <div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const columns = stageOrder.map((stage) => ({ stage, items: grouped.get(stage) ?? [] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquarePlus className="size-4" />
          Drag candidates across the pipeline stages
        </div>
        {readOnly ? <Badge variant="outline">Archived job</Badge> : null}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="w-full overflow-x-auto">
          <div className="inline-flex min-w-full gap-4 whitespace-nowrap pb-2 align-top">
            {columns.map(({ stage, items }) => (
              <div key={stage} className="align-top whitespace-normal">
                <StageColumn stage={stage} items={items} onCandidateOpen={onCandidateOpen ?? (() => undefined)} readOnly={Boolean(readOnly)} />
              </div>
            ))}
          </div>
        </div>
      </DndContext>

      {activeCandidateId ? <div className="text-xs text-muted-foreground">Moving candidate {activeCandidateId}</div> : null}
    </div>
  );
}
