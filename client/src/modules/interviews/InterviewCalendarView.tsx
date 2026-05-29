import { useMemo, useRef, useEffect, memo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  addWeeks,
  subWeeks,
  addHours,
  startOfDay,
  getHours,
  getMinutes,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInterviewStore } from "./useInterviewStore";
import type { InterviewRecord } from "@/modules/recruitment/recruitment-columns";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 07:00 – 19:00
const CELL_HEIGHT = 72; // px per hour — taller for better visibility

const STATUS_CELL: Record<string, string> = {
  SCHEDULED: "border-cyan-400/60 bg-cyan-500/20 text-cyan-200",
  COMPLETED: "border-emerald-400/60 bg-emerald-500/20 text-emerald-200",
  CANCELLED: "border-rose-400/60 bg-rose-500/20 text-rose-200",
  NO_SHOW: "border-orange-400/60 bg-orange-500/20 text-orange-200",
  RESCHEDULED: "border-violet-400/60 bg-violet-500/20 text-violet-200",
  FEEDBACK_PENDING: "border-amber-400/60 bg-amber-500/20 text-amber-200",
};

type GroupedInterviews = Record<string, InterviewRecord[]>;

function groupByDay(interviews: InterviewRecord[]): GroupedInterviews {
  const map: GroupedInterviews = {};
  for (const iv of interviews) {
    const key = format(parseISO(iv.scheduledAt), "yyyy-MM-dd");
    if (!map[key]) map[key] = [];
    map[key].push(iv);
  }
  return map;
}

function getTopOffset(date: Date): number {
  const h = getHours(date) - HOURS[0];
  const m = getMinutes(date);
  return (h + m / 60) * CELL_HEIGHT;
}

function getCardHeight(durationMins = 60): number {
  return Math.max((durationMins / 60) * CELL_HEIGHT - 4, 24);
}

const InterviewCard = memo(function InterviewCard({
  interview,
}: {
  interview: InterviewRecord;
}) {
  const { openDrawer } = useInterviewStore();
  const dt = parseISO(interview.scheduledAt);
  const candidate = interview.application?.candidate;
  const name = candidate
    ? `${candidate.firstName} ${candidate.lastName}`
    : "Unknown";

  const top = getTopOffset(dt);
  const height = getCardHeight((interview as any).durationMins);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ top, height, left: 3, right: 3 }}
      className={cn(
        "absolute rounded-md border px-2 py-1 cursor-pointer overflow-hidden z-10",
        "hover:z-20 hover:brightness-110 transition-all duration-150",
        STATUS_CELL[interview.status] ??
          "border-white/25 bg-white/10 text-white/70",
      )}
      onClick={(e) => {
        e.stopPropagation();
        openDrawer(interview);
      }}
    >
      <p className="text-[11px] font-semibold truncate leading-tight">{name}</p>
      {height > 32 && (
        <p className="text-[10px] opacity-75 truncate leading-tight mt-0.5">
          {interview.application?.job?.title ?? "—"} · {format(dt, "HH:mm")}
        </p>
      )}
    </motion.div>
  );
});

// FIX: CurrentTimeIndicator is now rendered INSIDE each DayColumn,
// so it's naturally confined to that column's bounds — no percentage math.
function CurrentTimeIndicatorInColumn() {
  const top = getTopOffset(new Date());
  return (
    <div
      className="absolute left-0 right-0 flex items-center pointer-events-none z-30"
      style={{ top }}
    >
      <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 shrink-0 -ml-1.5 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
      <div className="h-px flex-1 bg-cyan-400/80" />
    </div>
  );
}

function HoverSlot({ date, hour }: { date: Date; hour: number }) {
  const { openCreateModal } = useInterviewStore();
  const slotDate = addHours(startOfDay(date), hour);
  const isPast = slotDate < new Date();

  if (isPast) return null;

  return (
    <div
      className="absolute inset-0 opacity-0 hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity group/slot"
      onClick={() =>
        openCreateModal({
          date: format(slotDate, "yyyy-MM-dd"),
          time: format(slotDate, "HH:mm"),
        })
      }
    >
      <div className="flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/15 px-2 py-0.5 text-cyan-300 shadow-sm">
        <Plus size={11} />
        <span className="text-[10px] font-medium">{format(slotDate, "HH:mm")}</span>
      </div>
    </div>
  );
}

type DayColumnProps = {
  date: Date;
  interviews: InterviewRecord[];
  isCurrentDay: boolean;
};

const DayColumn = memo(function DayColumn({
  date,
  interviews,
  isCurrentDay,
}: DayColumnProps) {
  return (
    <div
      className={cn(
        "relative flex-1 border-l border-white/[0.08] min-w-0",
        isCurrentDay && "bg-cyan-500/[0.03]",
      )}
    >
      {HOURS.map((h) => (
        <div
          key={h}
          style={{ height: CELL_HEIGHT }}
          className="relative border-b border-white/[0.07]"
        >
          <HoverSlot date={date} hour={h} />
        </div>
      ))}
      {/* Time indicator rendered inside the column so it stays bounded */}
      {isCurrentDay && <CurrentTimeIndicatorInColumn />}
      {interviews.map((iv) => (
        <InterviewCard key={iv.id} interview={iv} />
      ))}
    </div>
  );
});

type WeekViewProps = {
  days: Date[];
  grouped: GroupedInterviews;
};

function WeekView({ days, grouped }: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const offset = Math.max(0, (9 - HOURS[0]) * CELL_HEIGHT - 60);
      scrollRef.current.scrollTop = offset;
    }
  }, []);

  return (
    <div className="flex flex-col rounded-xl border border-white/[0.1] bg-[#0a0a0c] overflow-hidden">
      {/* Header row */}
      <div className="flex border-b border-white/[0.1] sticky top-0 z-20 bg-[#0d0d10]">
        <div className="w-14 shrink-0" />
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={cn(
              "flex-1 py-3 text-center border-l border-white/[0.08]",
              isToday(d) && "bg-cyan-500/[0.06]",
            )}
          >
            <p
              className={cn(
                "text-[11px] uppercase tracking-wider font-medium",
                isToday(d) ? "text-cyan-400" : "text-white/45",
              )}
            >
              {format(d, "EEE")}
            </p>
            <p
              className={cn(
                "text-base font-semibold mt-0.5",
                isToday(d) ? "text-cyan-300" : "text-white/70",
              )}
            >
              {format(d, "d")}
            </p>
          </div>
        ))}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="overflow-y-auto max-h-[640px]">
        <div className="flex">
          {/* Time gutter */}
          <div className="w-14 shrink-0 bg-[#0a0a0c]">
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ height: CELL_HEIGHT }}
                className="flex items-start justify-end pr-3 pt-1.5"
              >
                <span className="text-[11px] text-white/35 tabular-nums font-medium">
                  {h.toString().padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex flex-1">
            {days.map((d) => (
              <DayColumn
                key={d.toISOString()}
                date={d}
                interviews={grouped[format(d, "yyyy-MM-dd")] ?? []}
                isCurrentDay={isToday(d)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayView({
  date,
  interviews,
}: {
  date: Date;
  interviews: InterviewRecord[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const offset = Math.max(0, (9 - HOURS[0]) * CELL_HEIGHT - 60);
      scrollRef.current.scrollTop = offset;
    }
  }, []);

  return (
    <div className="flex flex-col rounded-xl border border-white/[0.1] bg-[#0a0a0c] overflow-hidden">
      <div className="border-b border-white/[0.1] px-4 py-3 flex items-center gap-3 bg-[#0d0d10]">
        <p
          className={cn(
            "text-sm font-semibold",
            isToday(date) ? "text-cyan-300" : "text-white/75",
          )}
        >
          {format(date, "EEEE, MMMM d")}
        </p>
        {isToday(date) && (
          <span className="text-[10px] text-cyan-400 border border-cyan-500/40 bg-cyan-500/10 rounded-full px-2 py-0.5">
            Today
          </span>
        )}
        <span className="text-xs text-white/35 ml-auto">
          {interviews.length} interview{interviews.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div ref={scrollRef} className="overflow-y-auto max-h-[640px]">
        <div className="flex">
          <div className="w-14 shrink-0 bg-[#0a0a0c]">
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ height: CELL_HEIGHT }}
                className="flex items-start justify-end pr-3 pt-1.5"
              >
                <span className="text-[11px] text-white/35 tabular-nums font-medium">
                  {h.toString().padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>
          <div className="flex-1 relative border-l border-white/[0.08]">
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ height: CELL_HEIGHT }}
                className="border-b border-white/[0.07] relative"
              >
                <HoverSlot date={date} hour={h} />
              </div>
            ))}
            {isToday(date) && <CurrentTimeIndicatorInColumn />}
            {interviews.map((iv) => (
              <InterviewCard key={iv.id} interview={iv} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type Props = {
  interviews: InterviewRecord[];
  isLoading: boolean;
};

export function InterviewCalendarView({ interviews, isLoading }: Props) {
  const { calendarView, calendarDate, setCalendarView, setCalendarDate } =
    useInterviewStore();

  const weekStart = startOfWeek(calendarDate, { weekStartsOn: 1 });
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const grouped = useMemo(() => groupByDay(interviews), [interviews]);

  const nav = useCallback(
    (dir: 1 | -1) => {
      if (calendarView === "week") {
        setCalendarDate(
          dir === 1 ? addWeeks(calendarDate, 1) : subWeeks(calendarDate, 1),
        );
      } else {
        setCalendarDate(addDays(calendarDate, dir));
      }
    },
    [calendarView, calendarDate, setCalendarDate],
  );

  const dayInterviews = grouped[format(calendarDate, "yyyy-MM-dd")] ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => nav(-1)}
            className="h-7 w-7 p-0 text-white/50 hover:text-white border border-white/12"
          >
            <ChevronLeft size={13} />
          </Button>
          <span className="text-sm font-medium text-white/75 min-w-[180px] text-center">
            {calendarView === "week"
              ? `${format(days[0], "MMM d")} – ${format(days[6], "MMM d, yyyy")}`
              : format(calendarDate, "MMMM d, yyyy")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => nav(1)}
            className="h-7 w-7 p-0 text-white/50 hover:text-white border border-white/12"
          >
            <ChevronRight size={13} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCalendarDate(new Date())}
            className="h-7 px-3 text-xs text-white/40 hover:text-white border border-white/10 ml-1"
          >
            Today
          </Button>
        </div>

        <div className="flex rounded-lg border border-white/12 overflow-hidden">
          {(["week", "day"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setCalendarView(v)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                calendarView === v
                  ? "bg-white/10 text-white/90"
                  : "text-white/35 hover:text-white/65",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-white/[0.1] bg-[#0a0a0c] h-[400px] flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="h-6 w-6 rounded-full border-2 border-white/10 border-t-cyan-400 animate-spin" />
              <p className="text-xs text-white/40">Loading schedule…</p>
            </div>
          </motion.div>
        ) : calendarView === "week" ? (
          <motion.div
            key={`week-${weekStart.toISOString()}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <WeekView days={days} grouped={grouped} />
          </motion.div>
        ) : (
          <motion.div
            key={`day-${calendarDate.toISOString()}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <DayView date={calendarDate} interviews={dayInterviews} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}