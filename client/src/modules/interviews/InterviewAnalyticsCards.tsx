import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  CalendarCheck2,
  MessageSquareWarning,
  CheckCircle2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useInterviewAnalytics } from "./useInterviews";

type CardConfig = {
  key: keyof import("./useInterviews").InterviewAnalytics;
  label: string;
  icon: React.ElementType;
  accent: string;
  glow: string;
};

const CARDS: CardConfig[] = [
  {
    key: "todayCount",
    label: "Today's Interviews",
    icon: CalendarClock,
    accent: "text-cyan-300",
    glow: "from-cyan-500/10",
  },
  {
    key: "upcomingCount",
    label: "Upcoming",
    icon: CalendarCheck2,
    accent: "text-violet-300",
    glow: "from-violet-500/10",
  },
  {
    key: "pendingFeedbackCount",
    label: "Pending Feedback",
    icon: MessageSquareWarning,
    accent: "text-amber-300",
    glow: "from-amber-500/10",
  },
  {
    key: "completedCount",
    label: "Completed",
    icon: CheckCircle2,
    accent: "text-emerald-300",
    glow: "from-emerald-500/10",
  },
  {
    key: "selectedCount",
    label: "Selected",
    icon: UserCheck,
    accent: "text-sky-300",
    glow: "from-sky-500/10",
  },
  {
    key: "cancelledCount",
    label: "Cancelled",
    icon: XCircle,
    accent: "text-rose-300",
    glow: "from-rose-500/10",
  },
];

function useCountUp(target: number, duration = 900) {
  const ref = useRef<HTMLSpanElement>(null);
  const frame = useRef<number>(0);

  useEffect(() => {
    if (ref.current === null) return;
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (target - from) * eased);
      if (ref.current) ref.current.textContent = String(current);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return ref;
}

function SkeletonCard() {
  return (
    <div className="relative rounded-xl border border-white/8 bg-white/[0.02] p-4 animate-pulse overflow-hidden">
      <div className="flex items-start justify-between mb-4">
        <div className="h-8 w-8 rounded-lg bg-white/5" />
      </div>
      <div className="h-7 w-12 rounded bg-white/5 mb-1.5" />
      <div className="h-3 w-24 rounded bg-white/[0.03]" />
    </div>
  );
}

function AnalyticsCard({
  config,
  value,
  index,
}: {
  config: CardConfig;
  value: number;
  index: number;
}) {
  const countRef = useCountUp(value);
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
        "relative rounded-xl border border-white/8 bg-white/[0.02] p-4 overflow-hidden",
        "hover:border-white/12 hover:bg-white/[0.035] transition-colors cursor-default",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none",
          config.glow,
          "to-transparent",
        )}
      />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] border border-white/8">
            <Icon size={15} className={config.accent} />
          </div>
        </div>
        <p className={cn("text-2xl font-semibold tabular-nums", config.accent)}>
          <span ref={countRef}>0</span>
        </p>
        <p className="text-xs text-white/35 mt-0.5 font-medium">{config.label}</p>
      </div>
    </motion.div>
  );
}

export function InterviewAnalyticsCards() {
  const { data, isLoading } = useInterviewAnalytics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {CARDS.map((card, i) => (
        <AnalyticsCard key={card.key} config={card} value={data[card.key]} index={i} />
      ))}
    </div>
  );
}
