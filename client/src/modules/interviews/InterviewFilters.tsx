import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useInterviewStore } from "./useInterviewStore";

const STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "RESCHEDULED",
  "FEEDBACK_PENDING",
] as const;

const MODES = [
  "Google Meet",
  "Zoom",
  "Teams",
  "Phone Call",
  "Offline",
] as const;

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  COMPLETED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  CANCELLED: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  NO_SHOW: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  RESCHEDULED: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  FEEDBACK_PENDING: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

function MultiChip({
  label,
  active,
  color,
  onToggle,
}: {
  label: string;
  active: boolean;
  color?: string | undefined;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-medium transition-all select-none",
        active
          ? color ?? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
          : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60",
      )}
    >
      {label.replace("_", " ")}
    </button>
  );
}

function ActiveChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/25 bg-cyan-500/8 px-2 py-0.5 text-[11px] text-cyan-300">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X size={10} />
      </button>
    </span>
  );
}

type Props = {
  open: boolean;
};

export function InterviewFilters({ open }: Props) {
  const { filters, setFilters, clearFilters, activeFilterCount } =
    useInterviewStore();

  const toggleStatus = useCallback(
    (s: string) => {
      const next = filters.status.includes(s)
        ? filters.status.filter((x) => x !== s)
        : [...filters.status, s];
      setFilters({ status: next });
    },
    [filters.status, setFilters],
  );

  const toggleMode = useCallback(
    (m: string) => {
      const next = filters.mode.includes(m)
        ? filters.mode.filter((x) => x !== m)
        : [...filters.mode, m];
      setFilters({ mode: next });
    },
    [filters.mode, setFilters],
  );

  const activeChips: { label: string; onRemove: () => void }[] = [
    ...filters.status.map((s) => ({
      label: s.replace("_", " "),
      onRemove: () => toggleStatus(s),
    })),
    ...filters.mode.map((m) => ({
      label: m,
      onRemove: () => toggleMode(m),
    })),
    ...(filters.dateFrom || filters.dateTo
      ? [
          {
            label: `${filters.dateFrom || "…"} → ${filters.dateTo || "…"}`,
            onRemove: () => setFilters({ dateFrom: "", dateTo: "" }),
          },
        ]
      : []),
    ...(filters.candidateSearch
      ? [
          {
            label: `Candidate: ${filters.candidateSearch}`,
            onRemove: () => setFilters({ candidateSearch: "" }),
          },
        ]
      : []),
    ...(filters.jobSearch
      ? [
          {
            label: `Role: ${filters.jobSearch}`,
            onRemove: () => setFilters({ jobSearch: "" }),
          },
        ]
      : []),
  ];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium">
                    Status
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map((s) => (
                      <MultiChip
                        key={s}
                        label={s}
                        active={filters.status.includes(s)}
                        color={STATUS_COLORS[s]}
                        onToggle={() => toggleStatus(s)}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium">
                    Mode
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {MODES.map((m) => (
                      <MultiChip
                        key={m}
                        label={m}
                        active={filters.mode.includes(m)}
                        onToggle={() => toggleMode(m)}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium">
                    Candidate
                  </p>
                  <input
                    type="text"
                    value={filters.candidateSearch}
                    onChange={(e) =>
                      setFilters({ candidateSearch: e.target.value })
                    }
                    placeholder="Search candidate…"
                    className="w-full h-8 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white/70 placeholder:text-white/25 outline-none focus:border-white/20 transition-colors"
                  />
                  <input
                    type="text"
                    value={filters.jobSearch}
                    onChange={(e) => setFilters({ jobSearch: e.target.value })}
                    placeholder="Search job role…"
                    className="w-full h-8 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white/70 placeholder:text-white/25 outline-none focus:border-white/20 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium">
                    Date Range
                  </p>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ dateFrom: e.target.value })}
                    className="w-full h-8 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white/70 outline-none focus:border-white/20 transition-colors"
                  />
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ dateTo: e.target.value })}
                    className="w-full h-8 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white/70 outline-none focus:border-white/20 transition-colors"
                  />
                </div>
              </div>

              {activeFilterCount > 0 && (
                <div className="flex items-center gap-2 pt-1 border-t border-white/6 flex-wrap">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider shrink-0">
                    Active:
                  </span>
                  {activeChips.map((chip, i) => (
                    <ActiveChip
                      key={i}
                      label={chip.label}
                      onRemove={chip.onRemove}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ml-auto text-[11px] text-white/30 hover:text-rose-400 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeChips.map((chip, i) => (
            <ActiveChip key={i} label={chip.label} onRemove={chip.onRemove} />
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="text-[11px] text-white/30 hover:text-rose-400 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </>
  );
}

export function FilterToggleButton() {
  const { filtersOpen, setFiltersOpen, activeFilterCount } =
    useInterviewStore();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setFiltersOpen(!filtersOpen)}
      className={cn(
        "h-8 gap-1.5 text-xs transition-all",
        filtersOpen
          ? "border border-cyan-500/30 bg-cyan-500/8 text-cyan-300"
          : "border border-white/10 text-white/50 hover:text-white hover:border-white/20",
      )}
    >
      <SlidersHorizontal size={13} />
      Filters
      {activeFilterCount > 0 && (
        <Badge className="h-4 min-w-4 px-1 text-[10px] bg-cyan-500 text-white border-0 rounded-full">
          {activeFilterCount}
        </Badge>
      )}
    </Button>
  );
}
