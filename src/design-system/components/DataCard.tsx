import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../utils';
import { text, border, radius, transition, statusColors } from '../tokens';
import type { StatusVariant } from '../tokens';
import { StatusBadge } from './StatusBadge';

interface DataCardProps {
  title: string;
  subtitle?: string;
  code?: string;
  status?: { label: string; variant: StatusVariant };
  stats?: Array<{ label: string; value: string | number }>;
  badges?: Array<{ label: string; variant: StatusVariant }>;
  meta?: Array<{ icon: LucideIcon; text: string }>;
  onClick?: () => void;
  actions?: React.ReactNode;
  accentVariant?: StatusVariant;
  className?: string;
}

/**
 * DataCard — Card unificada para items de listas (OC, venta, envio, etc.)
 */
export const DataCard: React.FC<DataCardProps> = ({
  title, subtitle, code, status, stats, badges, meta,
  onClick, actions, accentVariant, className,
}) => {
  const accent = accentVariant ? statusColors[accentVariant] : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white', border.default, radius.md, transition.fast,
        'overflow-hidden',
        accent && `border-l-4 ${accent.border.replace('border-', 'border-l-')}`,
        onClick && 'cursor-pointer hover:shadow-md',
        className,
      )}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {code && <span className={cn(text.caption, 'font-mono')}>{code}</span>}
              {status && <StatusBadge variant={status.variant} dot>{status.label}</StatusBadge>}
            </div>
            <h3 className={cn(text.bodyStrong, 'mt-1 truncate')}>{title}</h3>
            {subtitle && <p className={cn(text.caption, 'mt-0.5 truncate')}>{subtitle}</p>}
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </div>

        {/* Stats */}
        {stats && stats.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 bg-slate-50 rounded-lg p-2.5">
            {stats.map(s => (
              <div key={s.label}>
                <p className={text.label}>{s.label}</p>
                <p className={cn(text.bodyStrong, 'mt-0.5')}>
                  {typeof s.value === 'number' ? s.value.toLocaleString('es-PE') : s.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Badges */}
        {badges && badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {badges.map(b => (
              <StatusBadge key={b.label} variant={b.variant}>{b.label}</StatusBadge>
            ))}
          </div>
        )}

        {/* Meta */}
        {meta && meta.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-3">
            {meta.map(m => (
              <div key={m.text} className="flex items-center gap-1.5">
                <m.icon className="w-3.5 h-3.5 text-slate-400" />
                <span className={text.caption}>{m.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
