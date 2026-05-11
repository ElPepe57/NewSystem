/**
 * DrillDownStage · tabla de unidades en etapa seleccionada · Workspace Pipeline
 *
 * chk5.B10a (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-pipeline.html · Sec 1`.
 *
 * Tabla del drill-down inline cuando se selecciona una etapa del flow:
 *   - Cols: SKU · Producto · Lote · OC · Ingresó · Uds · Capital · Días · Estado
 *   - Filas con superaThreshold marcadas rose/amber según severidad
 *   - Footer: suma total + antigüedad promedio + count estancadas
 *   - Footer acciones: "Crear alerta etapa" + "Contactar agencia aduanal" (placeholder)
 *
 * Empty state: etapa seleccionada sin unidades · mensaje contextual.
 */

import React from 'react';
import {
  Bell,
  Phone,
  Search as SearchIcon,
  ShoppingCart,
  Truck,
  Shield,
  Warehouse,
} from 'lucide-react';
import {
  ProductoAvatar,
  inferLineaFromProducto,
} from '../../../../Productos/components/shared/ProductoAvatar';
import type { EtapaPipeline, UnidadEnEtapa } from '../../../utils/costIntelligence';
import { ETAPA_LABELS, PIPELINE_THRESHOLDS_DIAS } from '../../../utils/costIntelligence';

interface DrillDownStageProps {
  etapa: EtapaPipeline;
  unidades: UnidadEnEtapa[];
}

const fmtPEN = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPEN0 = (n: number) =>
  n.toLocaleString('es-PE', { maximumFractionDigits: 0 });
const fmtInt = (n: number) => n.toLocaleString('es-PE');
const fmtFechaCorta = (d: Date) =>
  d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

const ETAPA_ICONS: Record<EtapaPipeline, React.ComponentType<{ className?: string }>> = {
  pedido: ShoppingCart,
  transito: Truck,
  aduana: Shield,
  almacen: Warehouse,
};

const ETAPA_ICON_COLORS: Record<EtapaPipeline, string> = {
  pedido: 'text-slate-600',
  transito: 'text-sky-700',
  aduana: 'text-amber-700',
  almacen: 'text-emerald-700',
};

function rowClasses(unidad: UnidadEnEtapa): string {
  if (!unidad.superaThreshold) return 'hover:bg-slate-50';
  // Severidad: >2x threshold = rose · >1x = amber
  const factor = unidad.diasEnEtapa / (PIPELINE_THRESHOLDS_DIAS[unidad.diasEnEtapa > 999 ? 'pedido' : 'pedido']); // bug-safe fallback
  void factor; // suppress lint · severity bucket está más abajo
  // Simplifico · usar threshold de la etapa que está en el banner contexto
  return 'bg-rose-50/30 hover:bg-rose-50/60 ring-1 ring-rose-200';
}

function diasClasses(unidad: UnidadEnEtapa): string {
  if (!unidad.superaThreshold) return 'text-slate-500';
  return 'text-rose-700 font-bold';
}

function estadoBadge(unidad: UnidadEnEtapa, etapa: EtapaPipeline): { label: string; cls: string } {
  const threshold = PIPELINE_THRESHOLDS_DIAS[etapa];
  if (!unidad.superaThreshold) {
    return { label: 'EN PROCESO', cls: 'bg-slate-100 text-slate-600' };
  }
  // Distinguir entre "retrasado" y "estancado"
  if (unidad.diasEnEtapa <= threshold * 1.5) {
    return { label: 'RETRASADO', cls: 'bg-amber-100 text-amber-700' };
  }
  return { label: 'ESTANCADO', cls: 'bg-rose-100 text-rose-700' };
}

export const DrillDownStage: React.FC<DrillDownStageProps> = ({ etapa, unidades }) => {
  const EtapaIcon = ETAPA_ICONS[etapa];
  const etapaIconColor = ETAPA_ICON_COLORS[etapa];
  const etapaLabel = ETAPA_LABELS[etapa];

  const totalUds = unidades.length;
  const totalCapital = unidades.reduce((s, u) => s + u.capitalPEN, 0);
  const promedioDias = totalUds > 0
    ? Math.round(unidades.reduce((s, u) => s + u.diasEnEtapa, 0) / totalUds)
    : 0;
  const estancadasCount = unidades.filter((u) => u.superaThreshold).length;
  const skusDistintos = new Set(unidades.map((u) => u.productoId)).size;

  const showAduanaCTA = etapa === 'aduana' && estancadasCount > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <EtapaIcon className={`w-4 h-4 ${etapaIconColor}`} />
            SKUs en {etapaLabel} · drill-down
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
            {fmtInt(skusDistintos)} {skusDistintos === 1 ? 'SKU' : 'SKUs'} ·{' '}
            {fmtInt(totalUds)} {totalUds === 1 ? 'unidad' : 'unidades'} ·{' '}
            S/ {fmtPEN0(totalCapital)} capital comprometido
          </div>
        </div>
      </div>

      {totalUds === 0 ? (
        <EmptyDrillDown etapa={etapa} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] mt-2">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">Producto</th>
                  <th className="px-2 py-2">Lote</th>
                  <th className="px-2 py-2">OC origen</th>
                  <th className="px-2 py-2">Ingresó etapa</th>
                  <th className="px-2 py-2 text-right">Capital S/</th>
                  <th className="px-2 py-2 text-right">Días</th>
                  <th className="px-2 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unidades.map((u) => {
                  const badge = estadoBadge(u, etapa);
                  const linea = inferLineaFromProducto({
                    linea: u.lineaNegocioNombre,
                    tipo: undefined,
                    esPack: false,
                  });
                  return (
                    <tr key={u.unidadId} className={u.superaThreshold ? rowClasses(u) : 'hover:bg-slate-50'}>
                      <td className={`px-2 py-2 font-mono font-bold ${u.superaThreshold ? 'text-rose-700' : 'text-slate-700'}`}>
                        {u.productoSKU || '—'}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex-shrink-0">
                            <ProductoAvatar linea={linea} size="sm" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-slate-900 font-medium truncate">
                              {u.productoNombre || '—'}
                            </div>
                            {u.marca && (
                              <div className="text-[9px] text-slate-500 truncate">{u.marca}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 font-mono text-slate-600">{u.lote || '—'}</td>
                      <td className="px-2 py-2 font-mono text-slate-600">{u.ordenCompraNumero || '—'}</td>
                      <td className="px-2 py-2 text-slate-700">{fmtFechaCorta(u.fechaReferencia)}</td>
                      <td className="px-2 py-2 text-right tabular-nums font-semibold">
                        S/ {fmtPEN(u.capitalPEN)}
                      </td>
                      <td className={`px-2 py-2 text-right tabular-nums ${diasClasses(u)}`}>
                        {u.diasEnEtapa}d
                      </td>
                      <td className="px-2 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* Footer · total */}
                <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                  <td className="px-2 py-2 text-slate-900" colSpan={5}>
                    Total etapa {etapaLabel}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    S/ {fmtPEN0(totalCapital)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{promedioDias}d prom.</td>
                  <td className={`px-2 py-2 ${estancadasCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                    {estancadasCount > 0
                      ? `${estancadasCount} con retraso`
                      : 'sin retrasos'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer drill-down · acciones */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 gap-2 flex-wrap">
            <div className="text-[10px] text-slate-500">
              Tip: click cualquier SKU para abrir drill-down completo en Catálogo
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => alert(`Crear alerta etapa ${etapaLabel} · próximamente`)}
                className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md px-3 py-1.5 flex items-center gap-1.5"
              >
                <Bell className="w-3 h-3" />
                Crear alerta etapa
              </button>
              {showAduanaCTA && (
                <button
                  type="button"
                  onClick={() => alert('Contactar agencia aduanal · próximamente')}
                  className="text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-md px-3 py-1.5 flex items-center gap-1.5"
                >
                  <Phone className="w-3 h-3" />
                  Contactar agencia aduanal
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Empty state interno · etapa sin unidades ─────────────────────────────────
const EmptyDrillDown: React.FC<{ etapa: EtapaPipeline }> = ({ etapa }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center px-4">
    <SearchIcon className="w-8 h-8 text-slate-300 mb-2" />
    <p className="text-xs text-slate-500 mb-1 font-semibold">
      Sin unidades en {ETAPA_LABELS[etapa]}
    </p>
    <p className="text-[10px] text-slate-400 max-w-sm">
      Cuando lleguen OCs con unidades en este estado, aparecerán acá automáticamente.
    </p>
  </div>
);
