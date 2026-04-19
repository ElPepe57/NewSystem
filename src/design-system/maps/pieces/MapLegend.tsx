/**
 * MapLegend — leyenda de categorías/colores sobre el mapa.
 * Se posiciona como overlay (absolute) dentro del contenedor.
 */
import React from 'react';
import type { LegendItem } from '../types';

interface MapLegendProps {
  items: LegendItem[];
  title?: string;
  /** 'top-right' default | 'top-left' | 'bottom-right' | 'bottom-left' */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const posClasses: Record<NonNullable<MapLegendProps['position']>, string> = {
  'top-right': 'top-3 right-3',
  'top-left': 'top-3 left-3',
  'bottom-right': 'bottom-3 right-3',
  'bottom-left': 'bottom-3 left-3',
};

export const MapLegend: React.FC<MapLegendProps> = ({ items, title, position = 'top-right' }) => (
  <div
    className={`absolute ${posClasses[position]} bg-white rounded-lg shadow-md border border-slate-200 p-2 z-10 pointer-events-auto`}
  >
    {title && <div className="text-[10px] font-semibold text-slate-600 uppercase mb-1.5">{title}</div>}
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span
            className="inline-block w-3 h-3 rounded-full border border-white shadow-sm flex-shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-slate-700">{item.label}</span>
          {item.count != null && <span className="text-slate-400 ml-auto">{item.count}</span>}
        </div>
      ))}
    </div>
  </div>
);
