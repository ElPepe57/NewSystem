/**
 * ResumenRequerimientos · Tab "Resumen" del hub (F4 · HUB-2).
 *
 * Dashboard ejecutivo en el orden canónico §A→§F (banner → visualización → insights →
 * acciones → cross-links → alertas · Layout A main+aside). Absorbe el IntelligencePanel
 * (alertas de stock + demanda potencial) en §C. NO clona el KPI strip (canon no-redundancia):
 * el strip da el número, acá va el FLUJO (embudo), la inteligencia y la narrativa.
 *
 * Spec: docs/mockups/compras-f4-requerimientos-hub-target-v1.html (Acto 1).
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Layers, GitCommitHorizontal, ChevronRight, Radar, AlertOctagon,
  Plus, TrendingUp, PackageSearch, Dice5, ShoppingCart, Boxes, ShoppingBag, Bell, Clock, Users,
} from 'lucide-react';
import type { Requerimiento } from '../../types/requerimiento.types';
import type { Venta } from '../../types/venta.types';
import type { SugerenciaStock } from './requerimientos.types';

interface ResumenStats {
  pendientes: number;
  aprobados: number;
  enProceso: number;
  urgentes: number;
  alertasStock: number;
}

interface Props {
  stats: ResumenStats;
  requerimientos: Requerimiento[];
  sugerenciasStock: SugerenciaStock[];
  cotizacionesConfirmadas: Venta[];
  onNuevo: () => void;
  onApuesta: () => void;
  onOCConsolidada: () => void;
  onPendientes: () => void;
  onGenerarOCAprobados: () => void;
  onCrearDesdeSugerencia: (s: SugerenciaStock) => void;
  onVerTodasSugerencias: () => void;
}

const DOT_URGENCIA: Record<SugerenciaStock['urgencia'], string> = {
  critica: 'bg-rose-500',
  alta: 'bg-orange-400',
  media: 'bg-amber-300',
};

export const ResumenRequerimientos: React.FC<Props> = ({
  stats, requerimientos, sugerenciasStock, cotizacionesConfirmadas,
  onNuevo, onApuesta, onOCConsolidada, onPendientes, onGenerarOCAprobados,
  onCrearDesdeSugerencia, onVerTodasSugerencias,
}) => {
  const navigate = useNavigate();

  const completados = requerimientos.filter(r => r.estado === 'completado').length;
  const urgentesSinAprobar = requerimientos.filter(
    r => r.estado === 'pendiente' && (r.prioridad === 'alta' || r.prioridad === 'urgente')
  ).length;
  const aprobadosSinViajero = requerimientos.filter(
    r => r.estado === 'aprobado' && (r.asignaciones?.length ?? 0) === 0
  ).length;

  // §B · embudo (flujo, no conteo · barras proporcionales)
  const embudo = [
    { label: 'Pendiente', count: stats.pendientes, valor: 'text-amber-700', bar: 'bg-amber-400/80' },
    { label: 'Aprobado', count: stats.aprobados, valor: 'text-emerald-700', bar: 'bg-emerald-400/80' },
    { label: 'En proceso', count: stats.enProceso, valor: 'text-sky-700', bar: 'bg-sky-400/80' },
    { label: 'Completado', count: completados, valor: 'text-slate-700', bar: 'bg-slate-300' },
  ];
  const maxEmbudo = Math.max(...embudo.map(e => e.count), 1);

  const sugerenciasTop = sugerenciasStock.slice(0, 4);
  const cotizacionesTop = cotizacionesConfirmadas.slice(0, 3);

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* MAIN · §A §B §C */}
        <div className="md:col-span-2 space-y-4">

          {/* §A · NextAction (narrativa · no clona el strip) */}
          {stats.aprobados > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-blue-100/30 ring-1 ring-blue-200/50 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0"><Sparkles className="w-4 h-4" /></div>
                <div>
                  <div className="text-[13px] font-semibold text-slate-900">{stats.aprobados} requerimiento{stats.aprobados > 1 ? 's' : ''} aprobado{stats.aprobados > 1 ? 's' : ''} listo{stats.aprobados > 1 ? 's' : ''} para comprar</div>
                  <div className="text-[12px] text-slate-500 mt-0.5">Agrúpalos por viajero y emite las OCs en una sola pasada.</div>
                </div>
              </div>
              <button type="button" onClick={onGenerarOCAprobados} className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 flex-shrink-0">
                <Layers className="w-3.5 h-3.5" /> Generar compra
              </button>
            </div>
          )}

          {/* §B · embudo por estado */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold text-slate-800 flex items-center gap-2"><GitCommitHorizontal className="w-4 h-4 text-blue-600" /> Flujo de requerimientos</h3>
              <span className="text-[11px] text-slate-400">por estado</span>
            </div>
            <div className="flex items-end gap-2 h-28">
              {embudo.map((e, i) => (
                <React.Fragment key={e.label}>
                  {i > 0 && <ChevronRight className="w-4 h-4 text-slate-300 mb-6 flex-shrink-0" />}
                  <div className="flex-1 flex flex-col items-center justify-end gap-1">
                    <span className={`text-[12px] font-bold tabular-nums ${e.valor}`}>{e.count}</span>
                    <div className={`w-full rounded-t-lg ${e.bar}`} style={{ height: `${Math.max(8, (e.count / maxEmbudo) * 100)}%` }} />
                    <span className="text-[10px] text-slate-500 text-center">{e.label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* §C · Inteligencia de demanda (ex-IntelligencePanel) */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-slate-800 flex items-center gap-2"><Radar className="w-4 h-4 text-blue-600" /> Inteligencia de demanda</h3>
              <span className="text-[11px] text-slate-400">¿qué deberíamos pedir?</span>
            </div>

            {/* Alertas de stock */}
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-500" /> Alertas de stock
                  {stats.alertasStock > 0 && <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 rounded-full font-bold">{stats.alertasStock}</span>}
                </span>
                {sugerenciasStock.length > 0 && (
                  <button type="button" onClick={onVerTodasSugerencias} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium">Ver todas →</button>
                )}
              </div>
              {sugerenciasTop.length === 0 ? (
                <p className="text-[11px] text-slate-400 py-1">Sin alertas de stock · todo por encima del mínimo.</p>
              ) : (
                <div className="space-y-1.5">
                  {sugerenciasTop.map((s) => (
                    <div key={s.producto.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_URGENCIA[s.urgencia]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-slate-800 truncate">{s.producto.marca ? `${s.producto.marca} · ` : ''}{s.producto.nombreComercial}</div>
                        <div className="text-[11px] text-slate-400">Stock: <b className={s.stockActual === 0 ? 'text-rose-600' : 'text-amber-600'}>{s.stockActual}</b> / Reorden: {s.stockMinimo}{typeof s.cantidadSugerida === 'number' ? ` · pedir ${s.cantidadSugerida}` : ''}</div>
                      </div>
                      <button type="button" onClick={() => onCrearDesdeSugerencia(s)} className="flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-2 py-1 flex-shrink-0">
                        <Plus className="w-3 h-3" /> Crear
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Demanda potencial · señal read-only (no genera requerimiento) */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-sky-500" /> Demanda potencial
                  {cotizacionesConfirmadas.length > 0 && <span className="text-[9px] bg-sky-100 text-sky-700 px-1.5 rounded-full font-bold">{cotizacionesConfirmadas.length}</span>}
                </span>
                <span className="text-[10px] text-slate-400">sin compromiso · solo análisis</span>
              </div>
              {cotizacionesTop.length === 0 ? (
                <p className="text-[11px] text-slate-400 py-1">Sin cotizaciones con faltante pendientes.</p>
              ) : (
                <div className="space-y-1.5">
                  {cotizacionesTop.map((v) => (
                    <div key={v.id} className="flex items-center gap-2.5 p-2 rounded-lg">
                      <span className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-slate-800 truncate">{v.nombreCliente}</div>
                        <div className="text-[11px] text-slate-400">{v.numeroVenta} · {(v.productosConFaltante?.length ?? 0)} producto(s) sin stock · aún sin adelanto</div>
                      </div>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">señal</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-2 leading-snug">Cotizaciones con faltante que aún no comprometieron. <b>No genera requerimiento</b> (eso ocurre solo al adelanto del cliente) — sirve para detectar qué conviene <b>apostar</b>.</p>
            </div>
          </div>
        </div>

        {/* ASIDE · §D §E §F */}
        <aside className="md:col-span-1 space-y-4">
          {/* §D · acciones rápidas */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="text-[12px] font-semibold text-slate-700 mb-3">Acciones rápidas</h3>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onNuevo} className="flex flex-col items-start gap-1 p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-left"><Plus className="w-4 h-4 text-blue-600" /><span className="text-[11px] font-semibold text-slate-800">Nuevo</span></button>
              <button type="button" onClick={onOCConsolidada} className="flex flex-col items-start gap-1 p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-left"><Layers className="w-4 h-4 text-blue-600" /><span className="text-[11px] font-semibold text-slate-800">Generar compra</span></button>
              <button type="button" onClick={onPendientes} className="flex flex-col items-start gap-1 p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-left"><PackageSearch className="w-4 h-4 text-blue-600" /><span className="text-[11px] font-semibold text-slate-800">Pendientes</span></button>
              <button type="button" onClick={onApuesta} className="flex flex-col items-start gap-1 p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-left"><Dice5 className="w-4 h-4 text-blue-600" /><span className="text-[11px] font-semibold text-slate-800">Apuesta</span></button>
            </div>
          </div>

          {/* §E · cross-links 360 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="text-[12px] font-semibold text-slate-700 mb-3">Ir a · 360</h3>
            <div className="space-y-1.5">
              <button type="button" onClick={() => navigate('/compras')} className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-[12px] text-slate-700"><span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-blue-600" /> Órdenes de compra</span><ChevronRight className="w-3.5 h-3.5 text-slate-300" /></button>
              <button type="button" onClick={() => navigate('/stock')} className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-[12px] text-slate-700"><span className="flex items-center gap-2"><Boxes className="w-4 h-4 text-orange-500" /> Stock / Inventario</span><ChevronRight className="w-3.5 h-3.5 text-slate-300" /></button>
              <button type="button" onClick={() => navigate('/ventas')} className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-[12px] text-slate-700"><span className="flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-blue-600" /> Ventas / Cotizaciones</span><ChevronRight className="w-3.5 h-3.5 text-slate-300" /></button>
            </div>
          </div>

          {/* §F · alertas */}
          {(urgentesSinAprobar > 0 || aprobadosSinViajero > 0) && (
            <div className="bg-rose-50 rounded-2xl ring-1 ring-rose-200/60 p-4">
              <h3 className="text-[12px] font-semibold text-rose-800 mb-2 flex items-center gap-1.5"><Bell className="w-4 h-4 text-rose-600" /> Atención</h3>
              <ul className="space-y-1.5 text-[11px] text-rose-700">
                {urgentesSinAprobar > 0 && <li className="flex items-start gap-1.5"><Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {urgentesSinAprobar} urgente{urgentesSinAprobar > 1 ? 's' : ''} sin aprobar.</li>}
                {aprobadosSinViajero > 0 && <li className="flex items-start gap-1.5"><Users className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {aprobadosSinViajero} aprobado{aprobadosSinViajero > 1 ? 's' : ''} sin viajero asignado.</li>}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
