/**
 * ProductoDetailPane · drill-down pane derecha · Cost Intelligence
 *
 * chk5.B7 (S3.6 M1.bis · Cost Intelligence) · refactor pixel-perfect canon F6
 * UnidadDetailsModal pattern.
 *
 * Estructura:
 *   - Header gradient amber + ProductoAvatar + nombre + chips
 *   - 3 tabs sticky: Resumen · Costo · Mercado
 *   - Contenido scrolleable según tab activo:
 *       Resumen → 4 KPIs + Score gauge + Recomendación
 *       Costo   → Proveedores top + breakdown
 *       Mercado → Competidores + posición + banner análisis
 *   - Footer: "Ver en Productos" + "Generar OC" (teal primary)
 *
 * Mockup canónico: docs/mockups/cost-intelligence-canon-productos.html · Sec 1
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ExternalLink, ShoppingCart, AlertTriangle, ClipboardCheck, ArrowRight, ThumbsUp } from 'lucide-react';
import { ProductoAvatar, inferLineaFromProducto } from '../../../Productos/components/shared/ProductoAvatar';
import type { ProductoEnriquecido } from './CatalogoWorkspace';

interface ProductoDetailPaneProps {
  item: ProductoEnriquecido;
  onClose: () => void;
}

type Tab = 'resumen' | 'costo' | 'mercado';

const fmtPEN = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSD = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function scoreColor(score: number): { text: string; stroke: string; bg: string } {
  if (score >= 70) return { text: 'text-emerald-700', stroke: '#10b981', bg: 'from-emerald-50 to-emerald-100/40 border-emerald-200' };
  if (score >= 40) return { text: 'text-amber-700',   stroke: '#f59e0b', bg: 'from-amber-50 to-amber-100/40 border-amber-200' };
  return { text: 'text-rose-700', stroke: '#e11d48', bg: 'from-rose-50 to-rose-100/40 border-rose-200' };
}

function lineaBadgeClasses(linea: string | undefined): string {
  const code = (linea ?? '').toLowerCase();
  if (code.includes('skin')) return 'bg-amber-50 text-amber-700';
  if (code.includes('sup') || code.includes('vita')) return 'bg-indigo-50 text-indigo-700';
  return 'bg-slate-50 text-slate-600';
}

export const ProductoDetailPane: React.FC<ProductoDetailPaneProps> = ({ item, onClose }) => {
  const p = item.producto;
  const inv = p.investigacion;
  const tieneInv = item.tieneInvestigacion;
  const [tab, setTab] = useState<Tab>('resumen');

  const linea = inferLineaFromProducto({
    linea: p.lineaNegocioNombre,
    tipo: p.tipoProducto?.nombre,
    esPack: p.esPack,
  });

  const sc = scoreColor(item.score);

  return (
    <aside className="bg-white border border-slate-200 rounded-xl flex flex-col max-h-[calc(100vh-200px)] overflow-hidden sticky top-4">
      {/* Header pane · gradient según línea */}
      <div className={`px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2 bg-gradient-to-br ${
        linea === 'skincare'   ? 'from-amber-50/60 to-white' :
        linea === 'suplemento' ? 'from-indigo-50/60 to-white' :
        linea === 'pack'       ? 'from-purple-50/60 to-white' :
        'from-slate-50/60 to-white'
      }`}>
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <ProductoAvatar linea={linea} size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-mono text-slate-500 mb-0.5">{p.sku ?? '—'}</div>
            <div className="font-bold text-slate-900 text-sm truncate" title={p.nombreComercial ?? undefined}>
              {p.nombreComercial ?? '—'}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 flex-wrap">
              {p.marca && <span>{p.marca}</span>}
              {p.marca && p.lineaNegocioNombre && <span>·</span>}
              {p.lineaNegocioNombre && (
                <span className={`px-1.5 py-0.5 rounded font-bold ${lineaBadgeClasses(p.lineaNegocioNombre)}`}>
                  {p.lineaNegocioNombre}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 p-1 -m-1 rounded"
          aria-label="Cerrar (esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs sticky · canon F6 */}
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
        <TabButton active={tab === 'resumen'} onClick={() => setTab('resumen')}>Resumen</TabButton>
        <TabButton active={tab === 'costo'}   onClick={() => setTab('costo')}>Costo</TabButton>
        <TabButton active={tab === 'mercado'} onClick={() => setTab('mercado')}>Mercado</TabButton>
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {!tieneInv ? (
          <EmptyInvestigacion productoId={p.id} />
        ) : (
          <>
            {tab === 'resumen' && (
              <>
                {/* 4 KPIs canon F2 mini */}
                <div className="grid grid-cols-2 gap-2">
                  <Kpi label="Costo unit." valueClass="text-slate-900">S/ {fmtPEN(item.costoPEN)}</Kpi>
                  <Kpi label="Precio venta" valueClass="text-slate-900">
                    {item.precioEfectivo > 0 ? `S/ ${fmtPEN(item.precioEfectivo)}` : '—'}
                  </Kpi>
                  <Kpi label="Margen" valueClass={item.margenPct !== null && item.margenPct >= 20 ? 'text-emerald-700' : 'text-amber-700'} bg="emerald">
                    {item.margenPct !== null ? `${item.margenPct.toFixed(1)}%` : '—'}
                  </Kpi>
                  <Kpi label="Utilidad/u" valueClass={item.utilidad !== null && item.utilidad > 0 ? 'text-emerald-700' : 'text-rose-700'} bg="emerald">
                    {item.utilidad !== null ? `S/ ${fmtPEN(item.utilidad)}` : '—'}
                  </Kpi>
                </div>

                {/* Score gauge SVG circular · canon */}
                <div className={`bg-gradient-to-br border rounded-lg p-3 ${sc.bg}`}>
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14 flex-shrink-0">
                      <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke={sc.stroke}
                          strokeWidth="3"
                          strokeDasharray={`${(item.score / 100) * 94.2} 94.2`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className={`absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums ${sc.text}`}>
                        {item.score}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${sc.text}`}>
                        Cost Intelligence Score
                      </div>
                      <div className="text-[11px] text-slate-700 mt-0.5">
                        {item.score >= 70 ? 'Producto óptimo · listo para escalar' :
                         item.score >= 40 ? 'Producto medio · margen mejorable' :
                                            'Producto pobre · datos faltantes'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recomendación · si existe */}
                {inv?.recomendacion && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ThumbsUp className="w-3.5 h-3.5 text-emerald-700" />
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Recomendación</span>
                    </div>
                    <div className="text-[11px] text-slate-700 font-semibold capitalize">
                      {inv.recomendacion.replace(/_/g, ' ')}
                    </div>
                    {inv.razonamiento && (
                      <div className="text-[10px] text-slate-500 italic mt-0.5">"{inv.razonamiento}"</div>
                    )}
                  </div>
                )}
              </>
            )}

            {tab === 'costo' && (
              <>
                {/* Breakdown costo */}
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Breakdown costo</div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Costo USD</span>
                      <span className="font-semibold tabular-nums">$ {fmtUSD(item.costoUSD)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">TC aplicado</span>
                      <span className="font-semibold tabular-nums">{item.tc.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 pt-2 border-t-2 border-slate-200">
                      <span className="text-slate-900 font-bold">Costo total PEN</span>
                      <span className="font-bold tabular-nums">S/ {fmtPEN(item.costoPEN)}</span>
                    </div>
                  </div>
                </div>

                {/* Top proveedores */}
                {inv?.proveedoresUSA && inv.proveedoresUSA.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Proveedores</span>
                      <span className="text-[9px] text-slate-400 tabular-nums">{inv.proveedoresUSA.length}</span>
                    </div>
                    <ul className="space-y-0.5">
                      {inv.proveedoresUSA
                        .slice()
                        .sort((a, b) => (a.precio ?? 0) - (b.precio ?? 0))
                        .slice(0, 5)
                        .map((prov, idx) => (
                          <li
                            key={idx}
                            className={`flex items-center justify-between gap-2 text-[11px] py-1.5 ${
                              idx < (inv.proveedoresUSA.length - 1) ? 'border-b border-slate-100' : ''
                            }`}
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              {idx === 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
                              <span className="text-slate-700 truncate">{prov.nombre ?? `Prov. ${idx + 1}`}</span>
                              {idx === 0 && (
                                <span className="px-1 py-0.5 text-[8px] rounded bg-emerald-50 text-emerald-700 font-bold flex-shrink-0">
                                  MEJOR
                                </span>
                              )}
                            </span>
                            <span className="font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                              $ {fmtUSD(prov.precio ?? 0)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {tab === 'mercado' && (
              <>
                {inv?.competidoresPeru && inv.competidoresPeru.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Competidores en Perú</span>
                      <span className="text-[9px] text-slate-400 tabular-nums">{inv.competidoresPeru.length}</span>
                    </div>
                    <ul className="space-y-0.5">
                      {inv.competidoresPeru
                        .slice()
                        .sort((a, b) => (a.precio ?? 0) - (b.precio ?? 0))
                        .slice(0, 5)
                        .map((comp, idx) => (
                          <li
                            key={idx}
                            className={`flex items-center justify-between gap-2 text-[11px] py-1.5 ${
                              idx < (inv.competidoresPeru.length - 1) ? 'border-b border-slate-100' : ''
                            }`}
                          >
                            <span className="text-slate-700 truncate">{comp.nombre ?? `Comp. ${idx + 1}`}</span>
                            <span className="font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                              S/ {fmtPEN(comp.precio ?? 0)}
                            </span>
                          </li>
                        ))}
                    </ul>

                    {/* Banner posición competitiva */}
                    {item.precioEfectivo > 0 && (() => {
                      const preciosComp = inv.competidoresPeru.map((c) => c.precio ?? 0).filter((p) => p > 0).sort((a, b) => a - b);
                      const posicion = preciosComp.findIndex((pc) => item.precioEfectivo <= pc) + 1;
                      const minComp = preciosComp[0] ?? 0;
                      const diffPct = minComp > 0 ? ((minComp - item.precioEfectivo) / minComp) * 100 : 0;
                      const isCheaper = item.precioEfectivo < minComp;
                      const totalComp = preciosComp.length;
                      const posStr = posicion > 0 ? `${posicion}/${totalComp}` : `${totalComp + 1}/${totalComp}`;
                      return (
                        <div className={`mt-3 px-2 py-1.5 rounded text-[10px] ${
                          isCheaper ? 'bg-sky-50 border border-sky-200 text-sky-800' : 'bg-amber-50 border border-amber-200 text-amber-800'
                        }`}>
                          <span className="font-bold">Posición:</span> {posStr}
                          {' · '}
                          {isCheaper
                            ? <>más barato que mercado por <span className="font-bold tabular-nums">{Math.abs(diffPct).toFixed(1)}%</span></>
                            : <>arriba del mercado por <span className="font-bold tabular-nums">{Math.abs(diffPct).toFixed(1)}%</span></>
                          }
                        </div>
                      );
                    })()}
                  </div>
                )}

                {(!inv?.competidoresPeru || inv.competidoresPeru.length === 0) && (
                  <div className="text-center text-xs text-slate-500 py-6">
                    Sin datos de competencia
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer · acciones canon */}
      <div className="border-t border-slate-200 p-2.5 flex items-center gap-2 bg-slate-50">
        <Link
          to={`/productos?p=${p.id}`}
          className="flex-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md px-2 py-1.5 flex items-center justify-center gap-1.5"
        >
          Ver en Productos
          <ExternalLink className="w-3 h-3" />
        </Link>
        <button
          type="button"
          className="flex-1 text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-md px-2 py-1.5 flex items-center justify-center gap-1.5"
          title="Crear orden de compra · próximamente"
          onClick={() => alert('Crear OC desde Cost Intelligence · próximamente')}
        >
          <ShoppingCart className="w-3 h-3" />
          Generar OC
        </button>
      </div>
    </aside>
  );
};

interface TabButtonProps { active: boolean; onClick: () => void; children: React.ReactNode }
const TabButton: React.FC<TabButtonProps> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 py-2 text-[11px] font-medium border-b-2 transition-colors ${
      active ? 'text-teal-700 border-teal-600 font-bold' : 'text-slate-500 border-transparent hover:text-slate-700'
    }`}
  >
    {children}
  </button>
);

interface KpiProps { label: string; children: React.ReactNode; valueClass?: string; bg?: 'slate' | 'emerald' }
const Kpi: React.FC<KpiProps> = ({ label, children, valueClass = 'text-slate-900', bg = 'slate' }) => {
  const bgClasses = bg === 'emerald'
    ? 'bg-emerald-50 border-emerald-200'
    : 'bg-slate-50 border-slate-200';
  const labelClasses = bg === 'emerald' ? 'text-emerald-700' : 'text-slate-500';
  return (
    <div className={`${bgClasses} border rounded-md p-2`}>
      <div className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${labelClasses}`}>{label}</div>
      <div className={`text-sm font-bold tabular-nums ${valueClass}`}>{children}</div>
    </div>
  );
};

const EmptyInvestigacion: React.FC<{ productoId: string }> = ({ productoId }) => (
  <div className="flex flex-col items-center text-center py-6 px-3">
    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
      <AlertTriangle className="w-6 h-6 text-amber-600" />
    </div>
    <h4 className="text-sm font-bold text-slate-900 mb-1">Sin investigación de mercado</h4>
    <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
      Sin investigación no podemos calcular costo · margen · score.
      Registra proveedores y competidores en el módulo de Productos.
    </p>
    <Link
      to={`/productos?p=${productoId}`}
      className="text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-md px-3 py-1.5 flex items-center gap-1.5"
    >
      <ClipboardCheck className="w-3 h-3" />
      Investigar producto
      <ArrowRight className="w-3 h-3" />
    </Link>
  </div>
);
