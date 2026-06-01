/**
 * KpiStripV2 · strip horizontal canónico de KPIs (canon F2 variante B + S58f)
 *
 * Render banking-grade pixel-perfect mockup stock-hub-completo-v1 (chk5.DS-F3 Fase A).
 *   - 5 KPIs · mini-cards SEPARADOS (gradient sutil + ring colored · canon N2)
 *   - tabular-nums obligatorio en valores numéricos (canon F7)
 *   - Cada card: header (label uppercase + icono tonal) · valor 2xl bold · subtítulo 10px
 *   - Color semántico por naturaleza (slate · emerald · sky · amber · rose · canon N1)
 *
 * Esta versión es page-scoped (S3.6 M1 chk4.2). Si otros módulos adoptan
 * la misma estructura de 5 KPIs operativos se promueve a design-system.
 */

import React from 'react';
import { Boxes, CheckCircle, Lock, Truck, AlertTriangle } from 'lucide-react';

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
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
      {/* Unidades totales · slate (neutro) */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100/60 ring-1 ring-slate-200/60 rounded-2xl p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold">Unidades</span>
          <Boxes className="w-3.5 h-3.5 text-slate-600" />
        </div>
        <div className="text-2xl font-bold tabular-nums text-slate-900">{stats.total.toLocaleString('es-PE')}</div>
        <div className="text-[10px] text-slate-600 tabular-nums">{stats.productos.toLocaleString('es-PE')} productos</div>
      </div>

      {/* Disponibles · emerald (positivo) */}
      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Disponibles</span>
          <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
        </div>
        <div className="text-2xl font-bold tabular-nums text-emerald-900">{stats.disponiblePeru.toLocaleString('es-PE')}</div>
        <div className="text-[10px] text-emerald-700 tabular-nums">{stats.pctDisponiblesPeru}% libres en PE</div>
      </div>

      {/* Reservadas · sky (parcial) */}
      <div className="bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50 rounded-2xl p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">Reservadas</span>
          <Lock className="w-3.5 h-3.5 text-sky-700" />
        </div>
        <div className="text-2xl font-bold tabular-nums text-sky-900">{stats.reservada.toLocaleString('es-PE')}</div>
        <div className="text-[10px] text-sky-700 tabular-nums">
          {stats.reservada === 0
            ? 'Sin reservas activas'
            : [
                stats.reservadaOrigen > 0 ? `Origen: ${stats.reservadaOrigen}` : null,
                stats.reservadaPeru > 0 ? `PE: ${stats.reservadaPeru}` : null,
              ].filter(Boolean).join(' · ')}
        </div>
      </div>

      {/* En tránsito · amber (en camino) */}
      <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">En tránsito</span>
          <Truck className="w-3.5 h-3.5 text-amber-700" />
        </div>
        <div className="text-2xl font-bold tabular-nums text-amber-900">{stats.enTransito.toLocaleString('es-PE')}</div>
        <div className="text-[10px] text-amber-700">Origen + Perú</div>
      </div>

      {/* Vencen < 30d · rose (urgencia) */}
      <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">Vencen &lt; 30d</span>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
        </div>
        <div className="text-2xl font-bold tabular-nums text-rose-900">{stats.proximasAVencer.toLocaleString('es-PE')}</div>
        <div className="text-[10px] text-rose-700">{stats.proximasAVencer > 0 ? 'revisar lotes' : 'Todo OK'}</div>
      </div>
    </div>
  );
};
