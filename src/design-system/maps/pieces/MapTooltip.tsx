/**
 * MapTooltip — contenido estándar para InfoWindow.
 * Úsalo como `renderTooltip` de MarkersLayer para UX consistente.
 */
import React from 'react';

interface TooltipKPI {
  label: string;
  value: React.ReactNode;
}

interface MapTooltipProps {
  title: string;
  subtitle?: string;
  kpis?: TooltipKPI[];
  /** Contenido libre al final */
  children?: React.ReactNode;
}

export const MapTooltip: React.FC<MapTooltipProps> = ({ title, subtitle, kpis, children }) => (
  <div className="min-w-[200px] max-w-[280px] p-1 font-sans">
    <div className="font-semibold text-sm text-slate-900">{title}</div>
    {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
    {kpis && kpis.length > 0 && (
      <div className="mt-2 space-y-1 text-xs">
        {kpis.map((k, i) => (
          <div key={i} className="flex justify-between gap-3">
            <span className="text-slate-500">{k.label}</span>
            <span className="font-medium text-slate-800">{k.value}</span>
          </div>
        ))}
      </div>
    )}
    {children && <div className="mt-2 pt-2 border-t border-slate-100">{children}</div>}
  </div>
);
