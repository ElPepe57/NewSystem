/**
 * TabResumenEnvios — Tab "Resumen" del hub de Envíos (dashboard ejecutivo §A→§F).
 *
 * Canon HUB: la 1ª tab es Resumen. Orden §A banner salud → §B distribución (donut) →
 * §C insights operativos → §D acciones rápidas → §E conexiones 360 → §F alertas.
 * NO clona el KPI strip persistente (canon no-redundancia).
 *
 * Alineado PIXEL-PERFECT al master · docs/mockups/envios-master-v1.html · ACTO 2.
 * Chrome = orange (grupo Inventario). Datos reales vía props; las métricas sin fuente
 * todavía (fill rate, on-time, flete/lb, damage) se muestran "—" · no se inventan.
 */
import React from 'react';
import {
  Activity, AlertTriangle, Plus, PackageCheck, Stamp, ShoppingCart, Store, Users,
  Bell, ArrowUpRight, HandCoins,
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
  /** COD por cobrar de los despachos F activos (§A banner). */
  codPorCobrar: number;
  /** Lead time promedio de tránsito en días. `null` = sin fuente todavía. */
  leadTimeDias: number | null;
  /** Envíos retenidos en aduana (§D acción). */
  countEnAduana: number;
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

// Config por tipo de alerta (icono · color semántico · acción · tab destino).
const ALERTA_CFG = {
  aduana: { icon: Stamp, box: 'bg-rose-50 ring-rose-200/60', text: 'text-rose-800', icono: 'text-rose-600', btn: 'text-rose-700 border-rose-200 hover:bg-rose-50', accion: 'Liberar →', tab: 'operaciones' as const },
  incidencia: { icon: AlertTriangle, box: 'bg-amber-50 ring-amber-200/60', text: 'text-amber-800', icono: 'text-amber-600', btn: 'text-amber-700 border-amber-200 hover:bg-amber-50', accion: 'Ver →', tab: 'incidencias' as const },
  reclamo: { icon: HandCoins, box: 'bg-slate-50 ring-slate-200/60', text: 'text-slate-700', icono: 'text-slate-500', btn: 'text-slate-600 border-slate-200 hover:bg-slate-50', accion: 'Ver →', tab: 'reclamos' as const },
} as const;

const Stcap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{children}</span>
);
const Dash = () => <span className="text-slate-300">—</span>;

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

  // §A — focos de atención
  const focos = (data.countEnAduana > 0 ? 1 : 0) + (data.incidencias > 0 ? 1 : 0) + (data.pendientesRecepcion > 0 ? 1 : 0);
  const salud = focos > 0;

  // §C — insights operativos (real donde hay fuente · "—" donde no)
  const insights: Array<{ label: string; valor: React.ReactNode }> = [
    { label: 'Lead time prom.', valor: data.leadTimeDias != null ? <b className="tabular-nums text-slate-800">{data.leadTimeDias.toFixed(1)} días</b> : <Dash /> },
    { label: 'Fill rate', valor: <Dash /> },
    { label: 'On-time', valor: <Dash /> },
    { label: 'Flete prom./lb', valor: <Dash /> },
    { label: 'Damage rate', valor: <Dash /> },
  ];

  return (
    <div className="space-y-4">

      {/* §A — banner salud logística */}
      <div className={`rounded-2xl ring-1 p-4 ${salud ? 'bg-gradient-to-r from-amber-50 to-amber-100/30 ring-amber-200/60' : 'bg-gradient-to-r from-emerald-50 to-emerald-100/30 ring-emerald-200/60'}`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${salud ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            <Activity className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-[14px] font-bold flex items-center gap-2 ${salud ? 'text-amber-900' : 'text-emerald-900'}`}>
              {salud ? 'Salud logística · atención' : 'Salud logística · al día'}
              {salud && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {focos} foco{focos !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className={`text-[12px] leading-snug mt-0.5 ${salud ? 'text-amber-800/90' : 'text-emerald-800/90'}`}>
              {data.incidencias} incidencia(s) sin resolver · {data.pendientesRecepcion} recepción(es) pendiente(s) · {data.enTransito} en tránsito
              {data.codPorCobrar > 0 && <> · COD por cobrar <b className="tabular-nums">S/ {data.codPorCobrar.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</b></>}
            </div>
          </div>
        </div>
      </div>

      {/* §B distribución (donut 2/3) + §C insights (1/3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <Stcap>Distribución por tipo de ruta</Stcap>
            <span className="text-[11px] text-slate-400 tabular-nums">{data.activos} activos</span>
          </div>
          {donut.length === 0 ? (
            <div className="text-[12px] text-slate-400 py-6 text-center">Sin envíos activos para distribuir.</div>
          ) : (
            <div className="flex items-center gap-6 flex-wrap">
              <svg width="112" height="112" viewBox="0 0 36 36" className="flex-shrink-0">
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                {donut.map((s) => (
                  <circle key={s.codigo} cx="18" cy="18" r="15.9155" fill="none" stroke={s.color} strokeWidth="4"
                    strokeDasharray={s.dash} strokeDashoffset={s.offset} transform="rotate(-90 18 18)" />
                ))}
                <text x="18" y="17" textAnchor="middle" className="fill-slate-900 font-bold" style={{ fontSize: '6px' }}>{data.activos}</text>
                <text x="18" y="23" textAnchor="middle" className="fill-slate-400" style={{ fontSize: '2.6px' }}>ACTIVOS</text>
              </svg>
              <div className="flex-1 space-y-2 min-w-[180px] text-[12px]">
                {donut.map((s) => (
                  <div key={s.codigo} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-slate-600">{INFO_TIPO_RUTA[s.codigo]?.nombreCorto ?? s.codigo} <span className="text-slate-400">({s.codigo})</span></span>
                    <b className="ml-auto tabular-nums text-slate-800">{s.count}</b>
                    <span className="text-slate-400 tabular-nums w-9 text-right">{Math.round(s.pct)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <Stcap>Insights operativos</Stcap>
          <div className="mt-3 space-y-2.5 text-[12px]">
            {insights.map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-slate-600">{r.label}</span>
                {r.valor}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* §D acciones rápidas */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <Stcap>Acciones rápidas</Stcap>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button onClick={onNuevoEnvio} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-[12px] font-semibold px-3 py-2.5 rounded-lg shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo envío
          </button>
          <button onClick={() => onIrATab('operaciones')} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 text-[12px] font-medium px-3 py-2.5 rounded-lg">
            <PackageCheck className="w-3.5 h-3.5 text-emerald-500" /> Registrar recepción
            <span className="ml-auto text-[10px] text-slate-400 tabular-nums">{data.pendientesRecepcion} pendientes</span>
          </button>
          <button onClick={() => onIrATab('incidencias')} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 text-[12px] font-medium px-3 py-2.5 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Gestionar incidencias
            <span className="ml-auto text-[10px] text-slate-400 tabular-nums">{data.incidencias} abiertas</span>
          </button>
          <button onClick={() => onIrATab('operaciones')} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 text-[12px] font-medium px-3 py-2.5 rounded-lg">
            <Stamp className="w-3.5 h-3.5 text-amber-500" /> Liberar aduana
            <span className="ml-auto text-[10px] text-slate-400 tabular-nums">{data.countEnAduana} retenido{data.countEnAduana !== 1 ? 's' : ''}</span>
          </button>
        </div>
      </div>

      {/* §E conexiones 360 (color del módulo destino) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <Stcap>Conexiones 360</Stcap>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <a href="/compras" className="flex items-center gap-2.5 border border-slate-200 rounded-lg px-3 py-2.5 hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><ShoppingCart className="w-4 h-4 text-blue-600" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-slate-800 flex items-center gap-1.5">Compras <span className="text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">solo lectura</span></div>
              <div className="text-[11px] text-slate-500 truncate">OCs que disparan envíos</div>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          </a>
          <a href="/ventas" className="flex items-center gap-2.5 border border-slate-200 rounded-lg px-3 py-2.5 hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><Store className="w-4 h-4 text-blue-600" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-slate-800">Ventas</div>
              <div className="text-[11px] text-slate-500 truncate">despachos a clientes</div>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          </a>
          <a href="/personas" className="flex items-center gap-2.5 border border-slate-200 rounded-lg px-3 py-2.5 hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0"><Users className="w-4 h-4 text-violet-600" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-slate-800">Red Logística</div>
              <div className="text-[11px] text-slate-500 truncate">couriers y viajeros</div>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          </a>
        </div>
      </div>

      {/* §F alertas */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3"><Bell className="w-4 h-4 text-rose-500" /><Stcap>Alertas</Stcap></div>
        {data.alertas.length === 0 ? (
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <HandCoins className="w-4 h-4 text-emerald-500" /> Sin alertas activas. Todo bajo control.
          </div>
        ) : (
          <div className="space-y-2">
            {data.alertas.map((a, i) => {
              const cfg = ALERTA_CFG[a.icon];
              const Icon = cfg.icon;
              return (
                <div key={i} className={`flex items-center gap-3 ring-1 rounded-lg px-3 py-2.5 ${cfg.box}`}>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.icono}`} />
                  <span className={`text-[12px] flex-1 min-w-0 ${cfg.text}`}>{a.texto}</span>
                  <button onClick={() => onIrATab(cfg.tab)} className={`text-[11px] font-bold bg-white border px-3 py-1.5 rounded-lg flex-shrink-0 ${cfg.btn}`}>
                    {cfg.accion}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
