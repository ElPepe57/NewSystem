import React from 'react';

export interface HealthIndicator {
  label: string;
  status: 'ok' | 'warn' | 'critical';
  detail: string;
}

interface HealthSemaphoreProps {
  indicators: HealthIndicator[];
}

export const HealthSemaphore: React.FC<HealthSemaphoreProps> = ({ indicators }) => {
  const colors: Record<string, string> = {
    ok: 'bg-emerald-400 shadow-emerald-400/50',
    warn: 'bg-amber-400 shadow-amber-400/50',
    critical: 'bg-rose-500 shadow-rose-500/50 animate-pulse',
  };

  return (
    <div className="flex items-center gap-6 flex-wrap">
      {indicators.map((ind) => (
        <div
          key={ind.label}
          className="flex items-center gap-2"
          title={ind.detail}
        >
          <div className={`w-2.5 h-2.5 rounded-full shadow-lg ${colors[ind.status]}`} />
          <span className="text-xs text-slate-600 whitespace-nowrap font-medium">
            {ind.label}
          </span>
        </div>
      ))}
    </div>
  );
};
