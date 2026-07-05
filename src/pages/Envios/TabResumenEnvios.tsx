/**
 * TabResumenEnvios — Tab "Resumen" del hub de Envíos (dashboard ejecutivo §A→§F).
 *
 * Canon HUB: la 1ª tab es Resumen. Sigue el orden §A banner salud → §B visualización
 * (donut · composición · canon de charts) → §C insights → §D acciones → §E cross-links
 * → §F alertas. NO clona el KPI strip persistente (canon no-redundancia): aporta
 * composición, narrativa y accesos que el strip no da.
 *
 * Datos REALES vía props (los que el ERP ya computa). Las métricas sin fuente todavía
 * (fill rate, on-time) se omiten — no se inventan.
 *
 * Spec visual: docs/mockups/envios-hub-fase1-shell-resumen-operaciones.html (§A→§F).
 */
import React from 'react';
import {
  Activity, AlertTriangle, Plus, PackageCheck, Stamp, ShoppingCart, Store, Users,
  Bell, ArrowUpRight, Gavel, HandCoins,
} from 'lucide-react';
import { INFO_TIPO_RUTA, type TipoRutaLogistica } from '../../utils/envio.tipoRuta.helpers';

export interface ResumenEnviosAlerta {
  tono: 'rose' | 'amber' | 'slate';
  icon: 'aduana' | 'reclamo' | 'incidencia';
  texto: string;
}

export interface ResumenEnviosData {
  activos: number;
  enTransito: number;
  pendientesRecepcion: number;
  incidencias: number;
  reclamosPendientes: number;
  reclamadoPEN: number;
  countsPorTipoRuta: Partial<Record<TipoRutaLogistica | 'sin_clasificar', number>>;
  alertas: ResumenEnviosAlerta[];
}

interface TabResumenEnviosProps {
  data: ResumenEnviosData;
  onNuevoEnvio: () => void;
  onIrATab: (tab: 'incidencias' | 'reclamos' | 'costos' | 'operaciones') => void;
}

// Colores semánticos categóricos para el donut (NO color de módulo · NO emojis).
const DONUT_COLORS = ['#0ea5e9', '#f59e0b', '#8b5cf6', '#10b981', '#6366f1', '#f43f5e', '#94a3b8'];
const ALERTA_TONO = {
  rose: 'bg-rose-50 border-rose-200 text-rose-800',
  amber: 'bg-amber-50 border-amber-200 text-amber-800',
  slate: 'bg-slate-50 border-slate-200 text-slate-700',
} as const;
const ALERTA_ICON = { aduana: Stamp, reclamo: Gavel, incidencia: AlertTriangle } as const;

export const TabResumenEnvios: React.FC<TabResumenEnviosProps> = ({ data, onNuevoEnvio, onIrATab }) => {
  // §B — segmentos del donut (tipos de ruta con count > 0)
  const segmentos = (Object.entries(data.countsPorTipoRuta) as [TipoRutaLogistica | 'sin_clasificar', number][])
    .filter(([k, v]) => v > 0 && k !== 'sin_clasificar')
    .map(([codigo, count], i) => ({ codigo: codigo as TipoRutaLogistica, count, color: DONUT_COLORS[i % DONUT_COLORS.length] }));
  const totalSeg = segmentos.reduce((s, x) => s + x.count, 0) || 1;
  let acc = 0;
  const donut = segmentos.map((s) => {
    const pct = (s.count / totalSeg) * 100;
    const seg = { ...s, pct, dash: `${pct} ${100 - pct}`, offset: -acc };
    acc += pct;
    return seg;
  });

  const salud = data.incidencias > 0 || data.pendientesRecepcion > 0;

  return (
    <div className="space-y-4">
      {/* §A — Banner de salud */}
      <div className={`rounded-2xl ring-1 p-4 flex items-start gap-3 ${
        salud ? 'bg-gradient-to-r from-amber-50 to-amber-100/30 ring-amber-200/50' : 'bg-gradient-to-r from-emerald-50 to-emerald-100/30 ring-emerald-200/50'
      }`}>
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${salud ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
          <Activity className="w-5 h-5" />
        </span>
        <div className="flex-1">
          <div className="text-[14px] font-bold text-slate-900">
            {salud ? 'Salud logística · atención' : 'Salud logística · al día'}
          </div>
          <div className="text-[12px] text-slate-600 mt-0.5">
            {data.incidencias} incidencia(s) sin resolver · {data.pendientesRecepcion} recepción(es) pendiente(s) · {data.enTransito} en tránsito
            {data.reclamosPendientes > 0 && ` · ${data.reclamosPendientes} reclamo(s) por S/ ${data.reclamadoPEN.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`}
          </div>
        </div>
      </div>

      {/* §B visualización (donut) + §C insights */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] font-bold text-slate-900">Distribución por tipo de ruta</span>
            <span className="text-[11px] text-slate-400 tabular-nums">{data.activos} activos</span>
          </div>
          {donut.length === 0 ? (
            <div className="text-[12px] text-slate-400 py-6 text-center">Sin envíos activos para distribuir.</div>
          ) : (
            <div className="flex items-center gap-6 flex-wrap">
              <svg width="120" height="120" viewBox="0 0 36 36" className="flex-shrink-0">
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                {donut.map((s) => (
                  <circle key={s.codigo} cx="18" cy="18" r="15.9155" fill="none" stroke={s.color} strokeWidth="4"
                    strokeDasharray={s.dash} strokeDashoffset={s.offset} transform="rotate(-90 18 18)" />
                ))}
                <text x="18" y="17" textAnchor="middle" className="fill-slate-900 font-bold" style={{ fontSize: '6px' }}>{data.activos}</text>
                <text x="18" y="23" textAnchor="middle" className="fill-slate-400" style={{ fontSize: '2.6px' }}>ACTIVOS</text>
              </svg>
              <div className="flex-1 space-y-2 min-w-[180px]">
                {donut.map((s) => (
                  <div key={s.codigo} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {INFO_TIPO_RUTA[s.codigo]?.nombreCorto ?? s.codigo} <span className="text-slate-400">({s.codigo})</span>
                    </span>
                    <span className="tabular-nums font-semibold text-slate-700">{s.count} · {Math.round(s.pct)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* §C insights · RATIOS derivados · el strip persistente DA el nº crudo (Activos/
             En tránsito/Pend/Incidencias) · aquí la COMPOSICIÓN y la TASA que el strip NO da
             (canon no-redundancia 2026-06-02 · ELEVAR el clon, no clonarlo). */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-[13px] font-bold text-slate-900 mb-3">Composición & ratios</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-[11px] text-slate-500">En tránsito · % del activo</span><span className="text-[13px] font-bold tabular-nums text-sky-700">{Math.round((data.enTransito / (data.activos || 1)) * 100)}%</span></div>
            <div className="flex items-center justify-between"><span className="text-[11px] text-slate-500">Pend. recepción · % del activo</span><span className="text-[13px] font-bold tabular-nums text-amber-700">{Math.round((data.pendientesRecepcion / (data.activos || 1)) * 100)}%</span></div>
            <div className="flex items-center justify-between"><span className="text-[11px] text-slate-500">Tasa de incidencia</span><span className={`text-[13px] font-bold tabular-nums ${(data.incidencias / (data.activos || 1)) > 0.15 ? 'text-rose-700' : 'text-slate-700'}`}>{Math.round((data.incidencias / (data.activos || 1)) * 100)}%</span></div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2"><span className="text-[11px] text-slate-500">En reclamo</span><span className="text-[13px] font-bold tabular-nums text-amber-700">S/ {data.reclamadoPEN.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</span></div>
          </div>
        </div>
      </div>

      {/* §D acciones + §E cross-links */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-[13px] font-bold text-slate-900 mb-3">Acciones rápidas</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onNuevoEnvio} className="text-left p-3 rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/30 transition-colors"><Plus className="w-4 h-4 text-orange-600 mb-1" /><div className="text-[11px] font-bold text-slate-900">Nuevo envío</div></button>
            <button onClick={() => onIrATab('operaciones')} className="text-left p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"><PackageCheck className="w-4 h-4 text-emerald-600 mb-1" /><div className="text-[11px] font-bold text-slate-900">Ver operaciones</div><div className="text-[10px] text-slate-500">{data.pendientesRecepcion} pend.</div></button>
            <button onClick={() => onIrATab('incidencias')} className="text-left p-3 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50/30 transition-colors"><AlertTriangle className="w-4 h-4 text-rose-600 mb-1" /><div className="text-[11px] font-bold text-slate-900">Gestionar incidencias</div><div className="text-[10px] text-slate-500">{data.incidencias} abiertas</div></button>
            <button onClick={() => onIrATab('reclamos')} className="text-left p-3 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 transition-colors"><Gavel className="w-4 h-4 text-amber-600 mb-1" /><div className="text-[11px] font-bold text-slate-900">Reclamos</div><div className="text-[10px] text-slate-500">{data.reclamosPendientes} pend.</div></button>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-[13px] font-bold text-slate-900 mb-3">Conexiones 360</div>
          <div className="space-y-2">
            <a href="/compras" className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/50 border border-blue-100 hover:bg-blue-50 transition-colors"><span className="text-[12px] text-blue-800 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Compras · OCs que disparan envíos</span><ArrowUpRight className="w-3.5 h-3.5 text-blue-400" /></a>
            <a href="/ventas" className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/50 border border-blue-100 hover:bg-blue-50 transition-colors"><span className="text-[12px] text-blue-800 flex items-center gap-2"><Store className="w-4 h-4" /> Ventas · despachos a clientes</span><ArrowUpRight className="w-3.5 h-3.5 text-blue-400" /></a>
            <a href="/personas" className="flex items-center justify-between p-2.5 rounded-lg bg-violet-50/50 border border-violet-100 hover:bg-violet-50 transition-colors"><span className="text-[12px] text-violet-800 flex items-center gap-2"><Users className="w-4 h-4" /> Red Logística · couriers y viajeros</span><ArrowUpRight className="w-3.5 h-3.5 text-violet-400" /></a>
          </div>
        </div>
      </div>

      {/* §F alertas */}
      {data.alertas.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-[13px] font-bold text-slate-900 mb-3 flex items-center gap-2"><Bell className="w-4 h-4 text-rose-500" /> Alertas</div>
          <div className="space-y-2">
            {data.alertas.map((a, i) => {
              const Icon = ALERTA_ICON[a.icon];
              return (
                <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border ${ALERTA_TONO[a.tono]}`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-[12px] flex-1">{a.texto}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {data.alertas.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-2 text-[12px] text-slate-500">
          <HandCoins className="w-4 h-4 text-emerald-500" /> Sin alertas activas. Todo bajo control.
        </div>
      )}
    </div>
  );
};
