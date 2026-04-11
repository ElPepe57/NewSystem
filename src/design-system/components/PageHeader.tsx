import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../utils';
import { text, border, radius } from '../tokens';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

/**
 * PageHeader — Header unificado para todas las paginas.
 * Limpio, sin gradientes. Titulo + subtitulo + acciones.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title, subtitle, icon: Icon, actions, badge, className,
}) => (
  <div className={cn('bg-white border-b border-slate-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 sm:py-5', className)}>
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="flex-shrink-0 w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
            <Icon className="w-5 h-5 text-teal-600" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className={cn(text.display, 'truncate')}>{title}</h1>
            {badge}
          </div>
          {subtitle && <p className={cn(text.caption, 'mt-0.5')}>{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  </div>
);
