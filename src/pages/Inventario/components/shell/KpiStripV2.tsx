/**
 * KpiStripV2 · strip horizontal canónico de KPIs (canon F2 variante B + S58f)
 *
 * Render banking-grade pixel-perfect mockup stock-rediseno-s58f.
 *   - 5 KPIs · 1 línea con dividers verticales
 *   - tabular-nums obligatorio en valores numéricos (canon F7)
 *   - Cada KPI: label uppercase · valor 2xl bold · subtítulo 11px
 *   - Color teaming consistente (slate · emerald · sky · amber · rose)
 *
 * Esta versión es page-scoped (S3.6 M1 chk4.2). Si otros módulos adoptan
 * la misma estructura de 5 KPIs operativos se promueve a design-system.
 */

import React from 'react';
import { Check, Truck, AlertTriangle } from 'lucide-react';

export interface KpiStripStats {
  total: number;
  productos: number;
  disponiblePeru: number;
  pctDisponiblesPeru: number;
  reservada: number;
  reservadaOrigen: number;
  reservadaPeru: number;
  enTransito: number;
  proximasAVencer: number;
}

interface KpiStripV2Props {
  stats: KpiStripStats;
}

export const KpiStripV2: React.FC<KpiStripV2Props> = ({ stats }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
      {/* Unidades totales */}
      <div className="p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Unidades totales
        </div>
        <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
          {stats.total.toLocaleString('es-PE')}
        </div>
        <div className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
          {stats.productos.toLocaleString('es-PE')} productos
        </div>
      </div>

      {/* Disponibles */}
      <div className="p-4">
        <div className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1.5">
          Disponibles
        </div>
        <div className="text-2xl font-bold text-emerald-600 tabular-nums tracking-tight">
          {stats.disponiblePeru.toLocaleString('es-PE')}
        </div>
        <div className="text-[11px] text-emerald-600 mt-1.5 tabular-nums flex items-center gap-1">
          <Check className="w-3 h-3" />
          {stats.pctDisponiblesPeru}% libres en PE
        </div>
      </div>

      {/* Reservadas */}
      <div className="p-4">
        <div className="text-[10px] font-semibold text-sky-700 uppercase tracking-wider mb-1.5">
          Reservadas
        </div>
        <div className="text-2xl font-bold text-sky-700 tabular-nums tracking-tight">
          {stats.reservada.toLocaleString('es-PE')}
        </div>
        <div className="text-[11px] text-sky-700 mt-1.5 tabular-nums">
          {stats.reservadaOrigen > 0 && `Origen: ${stats.reservadaOrigen}`}
          {stats.reservadaOrigen > 0 && stats.reservadaPeru > 0 && ' · '}
          {stats.reservadaPeru > 0 && `PE: ${stats.reservadaPeru}`}
          {stats.reservada === 0 && 'Sin reservas activas'}
        </div>
      </div>

      {/* En tránsito */}
      <div className="p-4">
        <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1.5">
          En tránsito
        </div>
        <div className="text-2xl font-bold text-amber-700 tabular-nums tracking-tight">
          {stats.enTransito.toLocaleString('es-PE')}
        </div>
        <div className="text-[11px] text-amber-700 mt-1.5 tabular-nums flex items-center gap-1">
          <Truck className="w-3 h-3" />
          Origen + Perú
        </div>
      </div>

      {/* Vencen < 30d */}
      <div className="p-4">
        <div className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider mb-1.5">
          Vencen &lt; 30d
        </div>
        <div className={`text-2xl font-bold tabular-nums tracking-tight ${stats.proximasAVencer > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
          {stats.proximasAVencer.toLocaleString('es-PE')}
        </div>
        <div className={`text-[11px] mt-1.5 tabular-nums flex items-center gap-1 ${stats.proximasAVencer > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
          <AlertTriangle className="w-3 h-3" />
          {stats.proximasAVencer > 0 ? 'Atención · revisar lotes' : 'Todo OK'}
        </div>
      </div>
    </div>
  );
};
