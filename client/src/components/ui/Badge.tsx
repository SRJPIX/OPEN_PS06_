import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant =
  'default' | 'success' | 'warning' | 'danger' | 'electric' | 'teal' | 'neutral';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
  default: {
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    dot: 'bg-blue-400',
  },
  electric: {
    badge: 'bg-blue-600/15 text-blue-300 border-blue-500/30',
    dot: 'bg-blue-400 animate-pulse',
  },
  success: {
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    dot: 'bg-emerald-400',
  },
  warning: {
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    dot: 'bg-amber-400',
  },
  danger: {
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
    dot: 'bg-rose-400',
  },
  teal: {
    badge: 'bg-teal-500/10 text-teal-400 border-teal-500/25',
    dot: 'bg-teal-400',
  },
  neutral: {
    badge: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
    dot: 'bg-slate-400',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[11px] px-2 py-0.5 rounded-full font-medium tracking-wide',
  md: 'text-xs px-2.5 py-1 rounded-full font-medium tracking-wide',
};

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  ...props
}) => {
  const styles = variantStyles[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border leading-none',
        styles.badge,
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', styles.dot)} />}
      {children}
    </span>
  );
};
