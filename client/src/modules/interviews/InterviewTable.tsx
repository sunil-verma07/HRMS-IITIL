import { useState, useCallback, memo, useMemo } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  Pencil,
  RefreshCw,
  Ban,
  CheckCircle,
  MessageSquarePlus,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInterviewStore } from "./useInterviewStore";
import { useUpdateInterview, useDeleteInterview } from "./useInterviews";
import type { InterviewRecord } from "@/modules/recruitment/recruitment-columns";

type SortKey = "scheduledAt" | "status" | "mode";
type SortDir = "asc" | "desc" | null;

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  COMPLETED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  CANCELLED: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  NO_SHOW: "bg-orange-500/15 text-orange-300 border-orange-500/25",
  RESCHEDULED: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  FEEDBACK_PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/25",
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ["COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"],
  RESCHEDULED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: ["FEEDBACK_PENDING"],
  FEEDBACK_PENDING: [],
  CANCELLED: [],
  NO_SHOW: [],
};

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="h-7 w-7 rounded-full bg-white/8 border border-white/10 flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-medium text-white/60">{initials}</span>
    </div>
  );
}

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === "asc") return <ChevronUp size={12} />;
  if (dir === "desc") return <ChevronDown size={12} />;
  return <ChevronsUpDown size={12} className="opacity-30" />;
}

function RowSkeleton() {
  return (
    <tr className="border-b border-white/[0.04] animate-pulse">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 rounded bg-white/5" style={{ width: `${40 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  );
}

const InterviewRow = memo(function InterviewRow({
  interview,
  index,
}: {
  interview: InterviewRecord;
  index: number;
}) {
  const { openDrawer, openEditModal, openRescheduleModal } = useInterviewStore();
  const updateMutation = useUpdateInterview();
  const deleteMutation = useDeleteInterview();

  const dt = new Date(interview.scheduledAt);
  const candidate = interview.application?.candidate;
  const job = interview.application?.job;
  const candidateName = candidate
    ? `${candidate.firstName} ${candidate.lastName}`
    : "—";
  const interviewerName = interview.interviewer
    ? `${interview.interviewer.firstName} ${interview.interviewer.lastName}`
    : "—";

  const canTransition = (VALID_TRANSITIONS[interview.status] ?? []).length > 0;

  const handleStatusUpdate = useCallback(
    (status: string) => {
      updateMutation.mutate({ id: interview.id, payload: { status } });
    },
    [interview.id, updateMutation],
  );

  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer group transition-colors"
      onClick={() => openDrawer(interview)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={candidateName} />
          <div className="min-w-0">
            <p className="text-sm text-white/80 font-medium truncate leading-tight">
              {candidateName}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-white/60 truncate block max-w-[160px]">
          {job?.title ?? "—"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-white/40 rounded-md border border-white/10 px-2 py-0.5">
          {interview.mode}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Avatar name={interviewerName} />
          <span className="text-sm text-white/60 truncate max-w-[120px]">
            {interviewerName}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-white/70">{format(dt, "MMM d, yyyy")}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-white/50 tabular-nums">{format(dt, "HH:mm")}</span>
      </td>
      <td className="px-4 py-3">
        <Badge
          className={cn(
            "border text-[11px] px-2 py-0.5",
            STATUS_STYLES[interview.status] ?? "bg-white/10 text-white/50 border-white/10",
          )}
        >
          {interview.status.replace("_", " ")}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <span className="text-white/30 text-xs">—</span>
      </td>
      <td
        className="px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-white"
            >
              <MoreHorizontal size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => openDrawer(interview)}>
              <Eye size={13} className="mr-2" /> View details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openEditModal(interview)}>
              <Pencil size={13} className="mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openRescheduleModal(interview)}>
              <RefreshCw size={13} className="mr-2" /> Reschedule
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {VALID_TRANSITIONS[interview.status]?.includes("COMPLETED") && (
              <DropdownMenuItem onClick={() => handleStatusUpdate("COMPLETED")}>
                <CheckCircle size={13} className="mr-2 text-emerald-400" /> Mark Complete
              </DropdownMenuItem>
            )}
            {VALID_TRANSITIONS[interview.status]?.includes("FEEDBACK_PENDING") && (
              <DropdownMenuItem onClick={() => handleStatusUpdate("FEEDBACK_PENDING")}>
                <MessageSquarePlus size={13} className="mr-2 text-amber-400" /> Request Feedback
              </DropdownMenuItem>
            )}
            {VALID_TRANSITIONS[interview.status]?.includes("CANCELLED") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-rose-400 focus:text-rose-400"
                  onClick={() => deleteMutation.mutate(interview.id)}
                >
                  <Ban size={13} className="mr-2" /> Cancel
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </motion.tr>
  );
});

type Props = {
  interviews: InterviewRecord[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  onPageChange: (p: number) => void;
};

export function InterviewTable({
  interviews,
  total,
  page,
  limit,
  isLoading,
  onPageChange,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev !== key) { setSortDir("asc"); return key; }
      setSortDir((d) => {
        if (d === "asc") return "desc";
        if (d === "desc") { setSortKey(null); return null; }
        return "asc";
      });
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return interviews;
    return [...interviews].sort((a, b) => {
      let av: string, bv: string;
      if (sortKey === "scheduledAt") {
        av = a.scheduledAt;
        bv = b.scheduledAt;
      } else {
        av = (a as any)[sortKey] ?? "";
        bv = (b as any)[sortKey] ?? "";
      }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [interviews, sortKey, sortDir]);

  const totalPages = Math.ceil(total / limit);

  const SortTh = ({
    label,
    sortable,
    k,
  }: {
    label: string;
    sortable?: SortKey;
    k?: string;
  }) => (
    <th
      key={k}
      className={cn(
        "px-4 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider whitespace-nowrap select-none",
        sortable && "cursor-pointer hover:text-white/60 transition-colors",
      )}
      onClick={() => sortable && toggleSort(sortable)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortable && (
          <SortIcon dir={sortKey === sortable ? sortDir : null} />
        )}
      </div>
    </th>
  );

  return (
    <div className="flex flex-col rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-white/8 sticky top-0 bg-[#0d0d0f] z-10">
            <tr>
              <SortTh label="Candidate" k="c" />
              <SortTh label="Job Role" k="j" />
              <SortTh label="Mode" k="m" />
              <SortTh label="Interviewer" k="i" />
              <SortTh label="Date" sortable="scheduledAt" k="d" />
              <SortTh label="Time" k="t" />
              <SortTh label="Status" sortable="status" k="s" />
              <SortTh label="Rating" k="r" />
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
              : sorted.map((iv, idx) => (
                  <InterviewRow key={iv.id} interview={iv} index={idx} />
                ))}
          </tbody>
        </table>
      </div>

      {!isLoading && interviews.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
            <motion.div
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            >
              <span className="text-2xl">📅</span>
            </motion.div>
          </div>
          <p className="text-sm font-medium text-white/50">
            No interviews scheduled yet.
          </p>
          <p className="mt-1 text-xs text-white/30 max-w-xs">
            Start scheduling candidate interviews and manage hiring workflows.
          </p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/8">
          <span className="text-xs text-white/30">
            {total} interview{total !== 1 ? "s" : ""} · Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="h-7 w-7 p-0 text-white/40 hover:text-white disabled:opacity-25"
            >
              <ChevronLeft size={14} />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={cn(
                    "h-7 w-7 rounded-md text-xs transition-colors",
                    page === p
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "text-white/30 hover:text-white/60",
                  )}
                >
                  {p}
                </button>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="h-7 w-7 p-0 text-white/40 hover:text-white disabled:opacity-25"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}