/**
 * TabCostosLanded — Tab "Costos landed" del hub de Envíos.
 *
 * Vista operativa del costo puesto en almacén por envío:
 *   §A · callout amber (estado honesto · Parcial)
 *   §B · KPI cards semánticas (indigo · slate · amber · emerald)
 *   §C · filtro período (pills · chrome orange)
 *   §D · tabla expandible: fila-envío + desglose costos + CTRU por unidad
 *   §E · nota drill-down (anti-redundancia)
 *
 * Alineado PIXEL-PERFECT al master · docs/mockups/envios-master-v1.html · ACTO 6.
 * Chrome = orange (grupo Inventario). Datos reales vía useEnvioStore.
 * Métricas sin fuente calculable se muestran "—" · no se inventan.
 * NO clona el KPI strip persistente del hub.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Wrench,
  DollarSign,
  Calculator,
  Hourglass,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Ship,
  Stamp,
  PackageCheck,
  ChevronDown,
  ChevronRight,
  Plus,
  Info,
  Layers,
  Package,
} from 'lucide-react';
import { useEnvioStore } from '../../store/envioStore';
import type { Envio, CostoLanded } from '../../types/envio.types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Label de sección (canon Stcap: uppercase · text-[10px] · tracking-wider). */
const Stcap: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span className={`text-[10px] font-bold uppercase tracking-wider text-slate-500 ${className ?? ''}`}>
    {children}
  </span>
);

const formatPEN = (n: number): string =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPENk = (n: number): string => {
  if (n >= 1000) return `S/ ${(n / 1000).toFixed(1)}k`;
  return formatPEN(n);
};

/** Clasifica un CostoLanded en categoría visual para el ícono del desglose. */
function categorizarCosto(c: CostoLanded): 'flete' | 'aduana' | 'fee' | 'otro' {
  const nombre = (c.categoriaCostoNombre || '').toLowerCase();
  const id = (c.categoriaCostoId || '').toLowerCase();
  if (nombre.includes('flete') || id === 'flete') return 'flete';
  if (nombre.includes('aduana') || id === 'aduana' || id === 'impuesto' || nombre.includes('arancel')) return 'aduana';
  if (nombre.includes('recepcion') || nombre.includes('fee') || id === 'fee') return 'fee';
  return 'otro';
}

const ICONO_CATEGORIA: Record<string, React.ElementType> = {
  flete: Ship,
  aduana: Stamp,
  fee: PackageCheck,
  otro: DollarSign,
};

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────────────────────────────────────

type FiltroPeriodo = 'mes_actual' | 'trimestre' | 'anio';

interface EnvioConCostos {
  envio: Envio;
  costos: CostoLanded[];
  totalPEN: number;
  unidades: number;
  porUnidad: number;
  estimados: number;
  confirmados: number;
  finalizado: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export const TabCostosLanded: React.FC = () => {
  const { envios, fetchEnvios } = useEnvioStore();
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('mes_actual');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (envios.length === 0) fetchEnvios();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Dataset: envíos que tienen al menos 1 costo landed ──────────────────
  const enviosConCostos = useMemo<EnvioConCostos[]>(() => {
    return envios
      .filter((e) => (e.costosLanded ?? []).length > 0)
      .map((envio) => {
        const costos = envio.costosLanded ?? [];
        const totalPEN =
          envio.costoLandedTotalPEN ||
          costos.reduce((s, c) => s + (c.montoPEN || 0), 0);
        const unidades = envio.totalUnidades || 1;
        const estimados = costos.filter((c) => (c.estado ?? 'estimado') === 'estimado').length;
        const confirmados = costos.filter((c) => c.estado === 'confirmado').length;
        return {
          envio,
          costos,
          totalPEN,
          unidades,
          porUnidad: totalPEN / unidades,
          estimados,
          confirmados,
          finalizado: envio.costosFinalizados === true,
        };
      });
  }, [envios]);

  // ─── Filtro período ───────────────────────────────────────────────────────
  const filtrados = useMemo<EnvioConCostos[]>(() => {
    const now = Date.now();
    const MES = 30 * 24 * 60 * 60 * 1000;
    return enviosConCostos.filter((e) => {
      const ts = e.envio.fechaCreacion?.toMillis?.() ?? 0;
      if (filtroPeriodo === 'mes_actual') return ts >= now - MES;
      if (filtroPeriodo === 'trimestre') return ts >= now - 3 * MES;
      return ts >= now - 12 * MES; // anio
    });
  }, [enviosConCostos, filtroPeriodo]);

  // ─── KPIs de la tab ───────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalPEN = filtrados.reduce((s, e) => s + e.totalPEN, 0);
    const totalUnidades = filtrados.reduce((s, e) => s + e.unidades, 0);
    const estimados = filtrados.filter((e) => !e.finalizado && e.estimados > 0).length;
    const cerrados = filtrados.filter((e) => e.finalizado).length;
    const ctrPromedio = totalUnidades > 0 ? totalPEN / totalUnidades : 0;
    return { totalPEN, ctrPromedio, estimados, cerrados };
  }, [filtrados]);

  // ─── Expand/colapso ──────────────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* §A · callout amber · estado honesto ─────────────────────────────── */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-100/30 ring-1 ring-amber-200/60 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Wrench className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-amber-900 flex items-center gap-2">
            Estado de la tab
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Parcial
            </span>
          </div>
          <div className="text-[12px] text-amber-800/90 leading-snug mt-0.5">
            La <span className="font-semibold">DATA existe</span> en{' '}
            <code className="text-[11px] bg-amber-100/60 px-1 py-0.5 rounded">envio.costosLanded[]</code> y el
            CTRU se calcula bien, pero la vista usa <code className="text-[11px] bg-amber-100/60 px-1 py-0.5 rounded">DataTable</code>{' '}
            + primitivas <code className="text-[11px] bg-amber-100/60 px-1 py-0.5 rounded">common/</code> (Badge/Button).
            El gap es migrar al kit (fila expandible + FormModalV2 al agregar/finalizar costos).
          </div>
        </div>
      </div>

      {/* §B · KPI cards semánticas (4 · N2) ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Total landed · indigo (dinero comprometido/fijo) */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Stcap className="text-indigo-700">Total landed</Stcap>
            <DollarSign className="w-3.5 h-3.5 text-indigo-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-indigo-900">
            {formatPENk(kpis.totalPEN)}
          </div>
          <div className="text-[11px] text-indigo-700 flex items-center gap-1 mt-1">
            <Layers className="w-3 h-3" /> prorrateado al CTRU
          </div>
        </div>

        {/* CTRU promedio · slate (neutro / referencia) */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/40 ring-1 ring-slate-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Stcap>CTRU promedio</Stcap>
            <Calculator className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-800">
            {kpis.ctrPromedio > 0 ? formatPEN(kpis.ctrPromedio) : <span className="text-slate-300">—</span>}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
            <Package className="w-3 h-3" /> por unidad recibida
          </div>
        </div>

        {/* Estimados · amber (pendientes de confirmar) */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Stcap className="text-amber-700">Estimados</Stcap>
            <Hourglass className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-900">
            {kpis.estimados}
          </div>
          <div className="text-[11px] text-amber-700 flex items-center gap-1 mt-1">
            <AlertTriangle className="w-3 h-3" /> costos sin confirmar
          </div>
        </div>

        {/* Cerrados · emerald (CTRU definitivo) */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Stcap className="text-emerald-700">Cerrados</Stcap>
            <Lock className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">
            {kpis.cerrados}
          </div>
          <div className="text-[11px] text-emerald-700 flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3 h-3" /> CTRU definitivo
          </div>
        </div>

      </div>

      {/* §C · filtro período (pills · chrome orange · scroll-x N6) ────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        <Stcap className="text-slate-400 flex-shrink-0 mr-1">Período</Stcap>
        {(
          [
            { id: 'mes_actual', label: 'Este mes' },
            { id: 'trimestre', label: 'Trimestre' },
            { id: 'anio', label: 'Año' },
          ] as { id: FiltroPeriodo; label: string }[]
        ).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setFiltroPeriodo(p.id)}
            className={`text-[12px] font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0 border transition-colors ${
              filtroPeriodo === p.id
                ? 'bg-orange-50 text-orange-700 border-orange-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* §D · tabla expandible ───────────────────────────────────────────── */}
      {filtrados.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center">
          <DollarSign className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <div className="text-[13px] font-medium text-slate-500">
            Sin envíos con costos landed en este período
          </div>
          <div className="text-[12px] text-slate-400 mt-1">
            Cambiá el filtro de período o registrá costos desde el detalle de un envío.
          </div>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">

          {/* Head (oculto en mobile) */}
          <div className="hidden sm:grid grid-cols-[32px_140px_1fr_140px_120px] gap-3 items-center bg-slate-50 border-b border-slate-200 px-4 py-2.5">
            <span />
            <Stcap className="text-slate-500">Envío</Stcap>
            <Stcap className="text-slate-500">Productos</Stcap>
            <Stcap className="text-slate-500 text-right block">Total landed</Stcap>
            <Stcap className="text-slate-500 text-center block">Cierre</Stcap>
          </div>

          {/* Filas */}
          {filtrados.map((item, idx) => {
            const expandido = expandidos.has(item.envio.id);
            const isLast = idx === filtrados.length - 1;
            const skuCount = item.envio.productosSummary?.length ?? 0;

            return (
              <React.Fragment key={item.envio.id}>
                {/* Fila principal */}
                <div
                  onClick={() => toggleExpand(item.envio.id)}
                  className={`grid grid-cols-1 sm:grid-cols-[32px_140px_1fr_140px_120px] gap-3 items-center px-4 py-3 cursor-pointer transition-colors ${
                    expandido
                      ? 'bg-indigo-50/30 ring-1 ring-inset ring-indigo-200/50'
                      : 'hover:bg-slate-50'
                  } ${!isLast || expandido ? 'border-b border-slate-100' : ''}`}
                >
                  {/* Chevron */}
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleExpand(item.envio.id); }}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                        expandido
                          ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {expandido
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />
                      }
                    </button>
                  </div>

                  {/* Número de envío */}
                  <div className="text-[13px] font-bold tabular-nums text-slate-900">
                    {item.envio.numeroEnvio}
                  </div>

                  {/* Productos / unidades */}
                  <div className="text-[12px] text-slate-600">
                    {skuCount > 0 ? (
                      <>{skuCount} SKU{skuCount !== 1 ? 's' : ''} <span className="text-slate-300">·</span> <span className="tabular-nums">{item.unidades}</span> und</>
                    ) : (
                      <><span className="tabular-nums">{item.unidades}</span> und</>
                    )}
                  </div>

                  {/* Total */}
                  <div className={`text-right text-[14px] font-bold tabular-nums ${expandido ? 'text-indigo-900' : 'text-slate-900'}`}>
                    {formatPEN(item.totalPEN).replace('S/ ', 'S/ ').split('.')[0]}
                    <span className={expandido ? 'text-indigo-400' : 'text-slate-400'}>
                      .{item.totalPEN.toFixed(2).split('.')[1]}
                    </span>
                  </div>

                  {/* Badge cierre */}
                  <div className="sm:text-center">
                    {item.finalizado ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                        <Lock className="w-2.5 h-2.5" /> Definitivo
                      </span>
                    ) : item.estimados > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                        <Hourglass className="w-2.5 h-2.5" /> Pendiente
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Listo
                      </span>
                    )}
                  </div>
                </div>

                {/* Desglose expandido */}
                {expandido && (
                  <div className={`bg-indigo-50/20 px-4 sm:px-6 py-4 ${!isLast ? 'border-b border-slate-100' : ''}`}>
                    <div className="max-w-2xl space-y-2">
                      {item.costos.map((c) => {
                        const cat = categorizarCosto(c);
                        const IconoCat = ICONO_CATEGORIA[cat] ?? DollarSign;
                        const esEstimado = (c.estado ?? 'estimado') === 'estimado';
                        return (
                          <div key={c.id} className="flex items-center justify-between text-[12px]">
                            <span className="flex items-center gap-2 text-slate-600">
                              <IconoCat className="w-3.5 h-3.5 text-slate-400" />
                              {c.categoriaCostoNombre || cat}
                              {esEstimado ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                                  <Hourglass className="w-2.5 h-2.5" /> Estimado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Confirmado
                                </span>
                              )}
                            </span>
                            <span className={`font-semibold tabular-nums ${esEstimado ? 'text-amber-800' : 'text-slate-800'}`}>
                              {formatPEN(c.montoPEN).split('.')[0]}
                              <span className={esEstimado ? 'text-amber-400' : 'text-slate-400'}>
                                .{c.montoPEN.toFixed(2).split('.')[1]}
                              </span>
                            </span>
                          </div>
                        );
                      })}

                      {/* Total + CTRU derivado */}
                      <div className="flex items-center justify-between text-[13px] pt-2 mt-1 border-t border-indigo-200/60">
                        <span className="font-bold text-slate-900">Total landed</span>
                        <span className="font-bold tabular-nums text-indigo-900">
                          {formatPEN(item.totalPEN).split('.')[0]}
                          <span className="text-indigo-400">.{item.totalPEN.toFixed(2).split('.')[1]}</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-indigo-50 ring-1 ring-indigo-200/60 rounded-lg px-3 py-2 mt-2">
                        <span className="text-[11px] font-semibold text-indigo-700 flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5" />
                          CTRU por unidad
                          <span className="text-indigo-400 font-normal">· {item.unidades} und</span>
                        </span>
                        <span className="text-[14px] font-bold tabular-nums text-indigo-900">
                          {formatPEN(item.porUnidad).split('.')[0]}
                          <span className="text-indigo-400">.{item.porUnidad.toFixed(2).split('.')[1]}</span>
                        </span>
                      </div>
                    </div>

                    {/* Acciones del envío expandido */}
                    <div className="flex items-center gap-2 mt-3">
                      {!item.finalizado && (
                        <>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                          >
                            <Plus className="w-3.5 h-3.5" /> Agregar costo
                          </button>
                          <button
                            type="button"
                            disabled={item.estimados > 0}
                            className="flex items-center gap-1.5 bg-white border border-slate-200 text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:text-slate-400 disabled:cursor-not-allowed text-slate-600 hover:enabled:bg-slate-50"
                          >
                            <Lock className="w-3.5 h-3.5" /> Finalizar CTRU
                          </button>
                          {item.estimados > 0 && (
                            <span className="text-[11px] text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {item.estimados === 1
                                ? 'hay 1 costo estimado'
                                : `hay ${item.estimados} costos estimados`}
                            </span>
                          )}
                        </>
                      )}
                      {item.finalizado && (
                        <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> CTRU definitivo · cerrado
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* §E · nota drill-down (anti-redundancia) ────────────────────────── */}
      <div className="flex items-start gap-2 text-[11px] text-slate-500">
        <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
        <span>
          Esta tab es el{' '}
          <span className="font-semibold text-slate-600">desglose del KPI "Valor landed"</span>{' '}
          del strip del shell — no lo clona, lo{' '}
          <span className="font-semibold text-slate-600">abre</span>{' '}
          en sus componentes (flete · aduana · fee de recepción). El{' '}
          <span className="font-semibold text-slate-600">CTRU se congela en la recepción del envío</span>{' '}
          (dueño Envíos): mientras haya un costo{' '}
          <span className="text-amber-600 font-semibold">Estimado</span>{' '}
          el cierre queda Pendiente y no se puede finalizar.
        </span>
      </div>

    </div>
  );
};
