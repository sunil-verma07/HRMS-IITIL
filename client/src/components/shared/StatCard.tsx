import { motion, useSpring, useTransform } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { cn, formatCompactNumber } from '@/lib/utils';

type StatCardProps = {
  label: string;
  value: number;
  formattedValue?: string;
  suffix?: string;
  trend?: string;
  icon: LucideIcon;
  tone?: 'cyan' | 'violet' | 'emerald' | 'rose' | 'amber';
};

const tones = {
  cyan: 'from-cyan-300/20 text-cyan-200 ring-cyan-300/25',
  violet: 'from-violet-300/20 text-violet-200 ring-violet-300/25',
  emerald: 'from-emerald-300/20 text-emerald-200 ring-emerald-300/25',
  rose: 'from-rose-300/20 text-rose-200 ring-rose-300/25',
  amber: 'from-amber-300/20 text-amber-200 ring-amber-300/25'
};

export function StatCard({ label, value, formattedValue, suffix = '', trend, icon: Icon, tone = 'cyan' }: StatCardProps) {
  const spring = useSpring(0, { stiffness: 90, damping: 18 });
  const display = useTransform(spring, (latest) => `${formatCompactNumber(Math.round(latest))}${suffix}`);

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return (
    <Card className="gradient-border overflow-hidden p-5 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <motion.p className="mt-5 text-3xl font-semibold tracking-tight">{formattedValue ?? display}</motion.p>
        </div>
        <div className={cn('grid size-12 place-items-center rounded-xl bg-gradient-to-br to-transparent ring-1', tones[tone])}>
          <Icon className="size-5" />
        </div>
      </div>
      {trend ? <p className="mt-5 text-sm text-muted-foreground">{trend}</p> : null}
    </Card>
  );
}
