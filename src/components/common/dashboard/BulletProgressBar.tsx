import React from 'react';

interface BulletProgressBarProps {
  progress: number;
  dangerThreshold?: number;
  warningThreshold?: number;
  showMarker?: boolean;
}

export const BulletProgressBar: React.FC<BulletProgressBarProps> = ({
  progress,
  dangerThreshold = 40,
  warningThreshold = 70,
  showMarker = true,
}) => {
  const clamped = Math.min(Math.max(progress, 0), 100);
  const barColor = clamped < dangerThreshold
    ? '#f43f5e'
    : clamped < warningThreshold
      ? '#f59e0b'
      : '#10b981';

  return (
    <div className="relative h-3 w-full rounded-full overflow-hidden bg-slate-100">
      {/* Zonas de fondo */}
      <div className="absolute inset-0 flex">
        <div className="bg-red-50" style={{ width: `${dangerThreshold}%` }} />
        <div className="bg-amber-50" style={{ width: `${warningThreshold - dangerThreshold}%` }} />
        <div className="bg-emerald-50" style={{ width: `${100 - warningThreshold}%` }} />
      </div>
      {/* Barra real */}
      <div
        className="absolute top-0.5 bottom-0.5 left-0.5 rounded-full transition-all duration-700 shadow-lg"
        style={{ width: `calc(${clamped}% - 4px)`, backgroundColor: barColor }}
      />
    </div>
  );
};
