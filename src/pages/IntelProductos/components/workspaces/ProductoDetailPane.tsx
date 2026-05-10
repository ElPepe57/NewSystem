/**
 * ProductoDetailPane · drill-down pane derecha · Cost Intelligence
 *
 * Compacto · denso · solo lo accionable. NO duplica el modal #11 de Productos
 * (que es para edición). Acá solo lectura analítica.
 *
 * Secciones:
 *   - Header con nombre + chips
 *   - 4 KPIs ejecutivos del producto
 *   - Investigación: proveedores + competidores (chips compactos)
 *   - Acciones rápidas (ver en Productos · ajustar precio)
 *   - Empty state si no tiene investigación
 */

import React from 'react';
import { X, ExternalLink, AlertTriangle, ClipboardCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ProductoEnriquecido } from './CatalogoWorkspace';

interface ProductoDetailPaneProps {
  item: ProductoEnriquecido;
  onClose: () => void;
}

const fmtPEN = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSD = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ProductoDetailPane: React.FC<ProductoDetailPaneProps> = ({ item, onClose }) => {
  const p = item.producto;
  const inv = p.investigacion;
  const tieneInv = item.tieneInvestigacion;

  return (
    <aside className="bg-white border border-slate-200 rounded-xl flex flex-col max-h-[calc(100vh-200px)] overflow-hidden sticky top-4">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-mono text-slate-500 mb-0.5">{p.sku ?? '—'}</div>
          <div className="font-bold text-slate-900 truncate" title={p.nombreComercial}>
            {p.nombreComercial ?? '—'}
          </div>
          <div className="text-[11px] text-slate-500 truncate mt-0.5">
            {p.marca ?? '—'}
            {p.lineaNegocioNombre ? ` · ${p.lineaNegocioNombre}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 p-1 -m-1 rounded"
          title="Cerrar (esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {!tieneInv ? (
          <EmptyInvestigacion productoId={p.id} />
        ) : (
          <>
            {/* 4 KPIs compactos · canon F2 */}
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Costo unit." valueClass="text-slate-900">S/ {fmtPEN(item.costoPEN)}</Kpi>
              <Kpi label="Precio venta" valueClass="text-slate-900">
                {item.precioEfectivo > 0 ? `S/ ${fmtPEN(item.precioEfectivo)}` : '—'}
              </Kpi>
              <Kpi label="Margen" valueClass={item.margenPct !== null && item.margenPct >= 20 ? 'text-emerald-700' : 'text-amber-700'}>
                {item.margenPct !== null ? `${item.margenPct.toFixed(1)}%` : '—'}
              </Kpi>
              <Kpi label="Utilidad/u" valueClass={item.utilidad !== null && item.utilidad > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                {item.utilidad !== null ? `S/ ${fmtPEN(item.utilidad)}` : '—'}
              </Kpi>
            </div>

            {/* Proveedores · top 3 */}
            {inv?.proveedoresUSA && inv.proveedoresUSA.length > 0 && (
              <Section title="Proveedores" count={inv.proveedoresUSA.length}>
                <ul className="space-y-1">
                  {inv.proveedoresUSA.slice(0, 3).map((prov, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-slate-700">{prov.nombre ?? `Prov. ${idx + 1}`}</span>
                      <span className="font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                        $ {fmtUSD(prov.precio ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Competidores · top 3 */}
            {inv?.competidoresPeru && inv.competidoresPeru.length > 0 && (
              <Section title="Competidores en Perú" count={inv.competidoresPeru.length}>
                <ul className="space-y-1">
                  {inv.competidoresPeru.slice(0, 3).map((comp, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-slate-700">{comp.nombre ?? `Comp. ${idx + 1}`}</span>
                      <span className="font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                        S/ {fmtPEN(comp.precio ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Recomendación · si existe */}
            {inv?.recomendacion && (
              <Section title="Recomendación">
                <div className="text-[11px] text-slate-700 capitalize">
                  {inv.recomendacion.replace(/_/g, ' ')}
                  {inv.razonamiento && (
                    <p className="text-slate-500 mt-1 italic text-[10px]">"{inv.razonamiento}"</p>
                  )}
                </div>
              </Section>
            )}
          </>
        )}

        {/* Score · siempre visible */}
        <Section title="Cost Intelligence Score">
          <div className="flex items-center gap-3">
            <div className={`text-3xl font-bold tabular-nums ${
              item.score >= 70 ? 'text-emerald-600' :
              item.score >= 40 ? 'text-amber-600' : 'text-rose-600'
            }`}>
              {item.score}
            </div>
            <div className="text-[10px] text-slate-500 leading-tight">
              <div>0-39 · pobre · datos faltantes</div>
              <div>40-69 · medio · margen mejorable</div>
              <div>70-100 · óptimo · listo para escalar</div>
            </div>
          </div>
        </Section>
      </div>

      {/* Footer · acciones */}
      <div className="border-t border-slate-200 p-3 flex items-center gap-2">
        <Link
          to={`/productos?p=${p.id}`}
          className="flex-1 text-center text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md px-3 py-1.5 flex items-center justify-center gap-1.5"
        >
          Ver en Productos
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </aside>
  );
};

interface KpiProps { label: string; children: React.ReactNode; valueClass?: string }
const Kpi: React.FC<KpiProps> = ({ label, children, valueClass = 'text-slate-900' }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-md p-2">
    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">{label}</div>
    <div className={`text-sm font-bold tabular-nums ${valueClass}`}>{children}</div>
  </div>
);

interface SectionProps { title: string; count?: number; children: React.ReactNode }
const Section: React.FC<SectionProps> = ({ title, count, children }) => (
  <div>
    <div className="flex items-center gap-1.5 mb-2">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
      {count !== undefined && (
        <span className="text-[9px] text-slate-400 tabular-nums">({count})</span>
      )}
    </div>
    {children}
  </div>
);

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
