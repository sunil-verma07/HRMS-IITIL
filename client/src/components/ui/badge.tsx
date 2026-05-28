import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset', {
  variants: {
    variant: {
      default: 'bg-primary/12 text-cyan-200 ring-primary/24',
      success: 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/24',
      warning: 'bg-amber-400/10 text-amber-200 ring-amber-400/24',
      danger: 'bg-rose-400/10 text-rose-200 ring-rose-400/24',
      muted: 'bg-white/6 text-muted-foreground ring-white/10',
      violet: 'bg-violet-400/10 text-violet-200 ring-violet-400/24'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
