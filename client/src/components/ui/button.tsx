import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-[0_0_28px_rgba(34,211,238,0.24)] hover:bg-cyan-300',
        secondary: 'bg-secondary/16 text-secondary-foreground ring-1 ring-secondary/25 hover:bg-secondary/25',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-rose-400',
        ghost: 'text-muted-foreground hover:bg-white/7 hover:text-foreground',
        outline: 'border border-border bg-white/[0.03] text-foreground hover:border-primary/40 hover:bg-primary/10',
        premium: 'gradient-border bg-white/[0.04] text-foreground shadow-[0_0_32px_rgba(139,92,246,0.18)] hover:bg-white/[0.07]',
        success: "bg-emerald-600 text-white hover:bg-emerald-700",

      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-xl px-5',
        icon: 'h-10 w-10 px-0'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
