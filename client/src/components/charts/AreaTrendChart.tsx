import { motion } from 'framer-motion';

type TrendPoint = {
  label: string;
  primary: number;
  secondary?: number;
};

type AreaTrendChartProps = {
  data?: TrendPoint[];
  height?: number;
};

function buildPath(points: TrendPoint[], key: 'primary' | 'secondary', width: number, height: number): string {
  if (points.length === 0) {
    return '';
  }

  const values = points.map((point) => point[key] ?? 0);
  const max = Math.max(...values, 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;

  return points
    .map((point, index) => {
      const x = index * step;
      const y = height - ((point[key] ?? 0) / max) * (height - 24) - 12;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function AreaTrendChart({ data = [], height = 240 }: AreaTrendChartProps) {
  const width = 900;
  const primaryPath = buildPath(data, 'primary', width, height);
  const secondaryPath = data.some((point) => point.secondary !== undefined) ? buildPath(data, 'secondary', width, height) : '';
  const areaPath = primaryPath ? `${primaryPath} L ${width} ${height} L 0 ${height} Z` : '';

  return (
    <div className="h-full min-h-64 w-full overflow-hidden rounded-xl bg-slate-950/35 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="areaPrimary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(34 211 238)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="rgb(34 211 238)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 5 }).map((_, index) => (
          <line key={index} x1="0" x2={width} y1={(height / 5) * index} y2={(height / 5) * index} stroke="rgba(148,163,184,0.13)" strokeDasharray="6 8" />
        ))}
        {areaPath ? <motion.path initial={{ opacity: 0 }} animate={{ opacity: 1 }} d={areaPath} fill="url(#areaPrimary)" /> : null}
        {primaryPath ? (
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            d={primaryPath}
            fill="none"
            stroke="rgb(34 211 238)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ) : null}
        {secondaryPath ? (
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.12 }}
            d={secondaryPath}
            fill="none"
            stroke="rgb(139 92 246)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <div className="mt-3 grid grid-cols-6 gap-2 text-xs text-muted-foreground md:grid-cols-10">
        {data.slice(0, 10).map((point) => (
          <span key={point.label} className="truncate">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
