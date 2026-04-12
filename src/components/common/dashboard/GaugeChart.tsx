import React from 'react';

interface GaugeChartProps {
  value: number;
  max: number;
  label: string;
  unit?: string;
  dangerBelow?: number;
  warningBelow?: number;
}

export const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  max,
  label,
  unit = '',
  dangerBelow = 1,
  warningBelow = 3,
}) => {
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? clamped / max : 0;
  const angle = percent * 180;

  const radius = 70;
  const cx = 90;
  const cy = 85;

  const startAngle = 180;
  const endAngle = 180 - angle;
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy - radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy - radius * Math.sin(endRad);

  const largeArc = angle > 180 ? 1 : 0;
  const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

  const color = value < dangerBelow
    ? '#f43f5e'
    : value < warningBelow
      ? '#f59e0b'
      : '#10b981';

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="110" viewBox="0 0 180 110">
        {/* Fondo del arco */}
        <path
          d="M 20 85 A 70 70 0 0 1 160 85"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Arco de progreso */}
        {angle > 0 && (
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="-mt-8 text-center">
        <div className="text-3xl font-bold text-slate-900">
          {value.toFixed(1)}{unit && <span className="text-lg text-slate-400 ml-1">{unit}</span>}
        </div>
        <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">{label}</div>
      </div>
    </div>
  );
};
