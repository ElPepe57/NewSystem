import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../utils';
import { statusColors, radius } from '../tokens';
import type { StatusVariant } from '../tokens';

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: StatusVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  icon?: LucideIcon;
  className?: string;
}

/**
 * StatusBadge — Badge unificado con variantes semanticas.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  children, variant = 'neutral', size = 'sm', dot, icon: Icon, className,
}) => {
  const colors = statusColors[variant] || statusColors.neutral;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 font-medium',
      radius.full,
      colors.bg, colors.text,
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      className,
    )}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />}
      {Icon && <Icon className={cn(size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5')} />}
      {children}
    </span>
  );
};
