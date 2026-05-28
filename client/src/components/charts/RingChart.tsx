import { motion } from 'framer-motion';

type RingSegment = {
  label: string;
  value: number;
  color: string;
};

type RingChartProps = {
  segments: RingSegment[];
  totalLabel: string;
};

const circumference = 2 * Math.PI * 42;

export function RingChart({ segments, totalLabel }: RingChartProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
      <div className="relative mx-auto size-52">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="10" />
          {segments.map((segment) => {
            const dash = total > 0 ? (segment.value / total) * circumference : 0;
            const currentOffset = offset;
            offset += dash;

            return (
              <motion.circle
                key={segment.label}
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={segment.color}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-currentOffset}
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${dash} ${circumference - dash}` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-3xl font-semibold">{total}</p>
            <p className="text-xs text-muted-foreground">{totalLabel}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.035] px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: segment.color }} />
              {segment.label}
            </span>
            <span className="text-sm font-semibold">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
