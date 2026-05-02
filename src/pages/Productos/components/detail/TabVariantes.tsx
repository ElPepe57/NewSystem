/**
 * TabVariantes · Tab "Variantes" del modal detalle producto
 *
 * Mockup canónico desktop: docs/mockups/productos/12-modal-detalle-variantes.html
 *
 * Layout:
 *   DESKTOP (≥lg): Tabla grid-cols-12 con SKU avatar · stock · precio · margen · ventas · acciones
 *   MOBILE  (<lg): Cards apiladas verticales por variante (F12)
 *
 * Header tab: contador "N variantes activas" + CTA "+ Agregar variante"
 * Footer: totales (stock total, precio promedio, margen promedio, ventas)
 * Banner sugerencia: si hay variante con stock crítico
 */

import React, { useMemo } from 'react';
import { Plus, MoreHorizontal, Lightbulb, AlertTriangle } from 'lucide-react';
import type { Producto } from '../../../../types/producto.types';

interface TabVariantesProps {
  producto: Producto;
  /** Hermanos del grupo de variantes (incluyendo este producto) */
  hermanasGrupo: Producto[];
  onAgregarVariante?: () => void;
  onClickVariante?: (variante: Producto) => void;
  onActionsVariante?: (variante: Producto) => void;
}

const PALETTE = ['#0d9488', '#f59e0b', '#8b5cf6', '#a855f7', '#0ea5e9', '#f43f5e'];

function getPrecioVenta(p: Producto): number {
  return (p as any).precioVenta ?? p.investigacion?.precioSugeridoCalculado ?? 0;
}

function getMargenPct(p: Producto): number | null {
  const precio = getPrecioVenta(p);
  const ctru = p.investigacion?.ctruEstimado ?? p.ctruPromedio ?? 0;
  if (precio <= 0 || ctru <= 0) return null;
  return Math.round(((precio - ctru) / precio) * 100);
}

function getStock(p: Producto): number {
  return (p as any).stockDisponible ?? (p as any).stockTotal ?? 0;
}

function getVentasMes(p: Producto): number {
  return (p as any).ventasMes ?? 0;
}

function getVarianteLabel(p: Producto): string {
  return p.varianteLabel ?? p.contenido ?? p.dosaje ?? '—';
}

function getNumeroVariante(p: Producto): string {
  const label = getVarianteLabel(p);
  const m = label.match(/(\d+)/);
  return m ? m[1] : label.slice(0, 3);
}

export const TabVariantes: React.FC<TabVariantesProps> = ({
  producto,
  hermanasGrupo,
  onAgregarVariante,
  onClickVariante,
  onActionsVariante,
}) => {
  // Si no hay grupo de variantes, mostrar solo este producto
  const variantes = hermanasGrupo.length > 0 ? hermanasGrupo : [producto];

  const totales = useMemo(() => {
    const stockTotal = variantes.reduce((acc, v) => acc + getStock(v), 0);
    const ventasTotal = variantes.reduce((acc, v) => acc + getVentasMes(v), 0);
    const preciosVal = variantes.map(v => getPrecioVenta(v)).filter(p => p > 0);
    const margenesVal = variantes.map(v => getMargenPct(v)).filter((m): m is number => m !== null);
    const precioProm = preciosVal.length > 0 ? Math.round(preciosVal.reduce((a, b) => a + b, 0) / preciosVal.length) : 0;
    const margenProm = margenesVal.length > 0 ? Math.round(margenesVal.reduce((a, b) => a + b, 0) / margenesVal.length) : 0;
    return { stockTotal, ventasTotal, precioProm, margenProm };
  }, [variantes]);

  // Detectar si alguna variante está en stock crítico (para banner)
  const varianteCritica = useMemo(() => {
    return variantes.find(v => {
      const stock = getStock(v);
      const min = v.stockMinimo ?? 0;
      return min > 0 && stock <= min;
    });
  }, [variantes]);

  return (
    <div className="p-3 lg:p-5 max-h-[calc(90vh-220px)] lg:max-h-[480px] overflow-y-auto">
      {/* Header tab */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-900">
            {variantes.length} variante{variantes.length === 1 ? '' : 's'} activa{variantes.length === 1 ? '' : 's'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
            Diferentes presentaciones (tamaño/contenido) del mismo producto base
          </p>
        </div>
        {onAgregarVariante && (
          <button
            type="button"
            onClick={onAgregarVariante}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Agregar variante</span>
            <span className="sm:hidden">Agregar</span>
          </button>
        )}
      </div>

      {/* ═══════ DESKTOP · Tabla ═══════ */}
      <div className="hidden lg:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          <div className="col-span-1"></div>
          <div className="col-span-3">SKU variante</div>
          <div className="col-span-2 text-right">Stock PE</div>
          <div className="col-span-2 text-right">Precio</div>
          <div className="col-span-2 text-right">Margen</div>
          <div className="col-span-1 text-right">Vendido (mes)</div>
          <div className="col-span-1 text-right"></div>
        </div>

        <div className="divide-y divide-slate-100">
          {variantes.map((v, idx) => {
            const stock = getStock(v);
            const precio = getPrecioVenta(v);
            const margen = getMargenPct(v);
            const ventas = getVentasMes(v);
            const stockMin = v.stockMinimo ?? 0;
            const isCritico = stockMin > 0 && stock <= stockMin;
            return (
              <div
                key={v.id}
                onClick={() => onClickVariante?.(v)}
                className={`grid grid-cols-12 gap-2 items-center px-3 py-2.5 hover:bg-slate-50 cursor-pointer ${
                  isCritico ? 'bg-rose-50/30' : ''
                }`}
              >
                <div className="col-span-1">
                  <SkuAvatar label={getNumeroVariante(v)} color={PALETTE[idx % PALETTE.length]} />
                </div>
                <div className="col-span-3">
                  <div className="text-sm font-semibold text-slate-900">{getVarianteLabel(v)}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{v.sku}</div>
                </div>
                <div className="col-span-2 text-right">
                  <div
                    className={`text-sm font-semibold tabular-nums flex items-center justify-end gap-1 ${
                      isCritico ? 'text-rose-700' : 'text-slate-900'
                    }`}
                  >
                    {isCritico && <AlertTriangle className="w-3 h-3" />}
                    {stock} uds
                  </div>
                </div>
                <div className="col-span-2 text-right text-sm font-semibold text-slate-900 tabular-nums">
                  {precio > 0 ? `S/ ${Math.round(precio)}` : <span className="text-slate-400 italic">—</span>}
                </div>
                <div className="col-span-2 text-right text-sm font-semibold tabular-nums">
                  {margen !== null ? (
                    <span className={margen >= 50 ? 'text-emerald-600' : margen >= 35 ? 'text-amber-600' : 'text-rose-600'}>
                      {margen}%
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">—</span>
                  )}
                </div>
                <div className="col-span-1 text-right text-xs text-slate-600 tabular-nums">{ventas}</div>
                <div className="col-span-1 text-right">
                  {onActionsVariante && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onActionsVariante(v);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer · totales */}
        <div className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] font-bold">
          <div className="col-span-4 text-slate-700">Total</div>
          <div className="col-span-2 text-right text-slate-900 tabular-nums">{totales.stockTotal} uds</div>
          <div className="col-span-2 text-right text-slate-500 tabular-nums">prom S/ {totales.precioProm}</div>
          <div className="col-span-2 text-right text-emerald-700 tabular-nums">{totales.margenProm}% prom</div>
          <div className="col-span-1 text-right text-slate-700 tabular-nums">{totales.ventasTotal}</div>
          <div className="col-span-1"></div>
        </div>
      </div>

      {/* ═══════ MOBILE/TABLET · Cards apiladas ═══════ */}
      <div className="lg:hidden space-y-2.5">
        {variantes.map((v, idx) => {
          const stock = getStock(v);
          const precio = getPrecioVenta(v);
          const margen = getMargenPct(v);
          const ventas = getVentasMes(v);
          const stockMin = v.stockMinimo ?? 0;
          const isCritico = stockMin > 0 && stock <= stockMin;
          return (
            <div
              key={v.id}
              onClick={() => onClickVariante?.(v)}
              className={`bg-white border border-slate-200 rounded-xl p-3 cursor-pointer ${
                isCritico ? 'border-l-4 border-l-rose-500' : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <SkuAvatar label={getNumeroVariante(v)} color={PALETTE[idx % PALETTE.length]} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{getVarianteLabel(v)}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{v.sku}</div>
                </div>
                {onActionsVariante && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onActionsVariante(v);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] border-t border-slate-100 pt-2">
                <div>
                  <div className="text-slate-500 uppercase font-bold">Stock</div>
                  <div
                    className={`text-sm font-bold tabular-nums flex items-center gap-0.5 ${
                      isCritico ? 'text-rose-700' : 'text-slate-900'
                    }`}
                  >
                    {isCritico && <AlertTriangle className="w-3 h-3" />}
                    {stock}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase font-bold">Precio</div>
                  <div className="text-sm font-bold text-slate-900 tabular-nums">
                    {precio > 0 ? `S/ ${Math.round(precio)}` : <span className="text-slate-400 italic">—</span>}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase font-bold">Margen</div>
                  <div className="text-sm font-bold tabular-nums">
                    {margen !== null ? (
                      <span
                        className={margen >= 50 ? 'text-emerald-600' : margen >= 35 ? 'text-amber-600' : 'text-rose-600'}
                      >
                        {margen}%
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">—</span>
                    )}
                  </div>
                  {ventas > 0 && <div className="text-[9px] text-slate-500 tabular-nums">{ventas}/mes</div>}
                </div>
              </div>
            </div>
          );
        })}

        {/* Footer mobile · totales */}
        <div className="bg-slate-100 rounded-lg p-3 grid grid-cols-3 gap-2 text-[10px]">
          <div>
            <div className="text-slate-500 uppercase font-bold">Total stock</div>
            <div className="text-sm font-bold text-slate-900 tabular-nums">{totales.stockTotal} uds</div>
          </div>
          <div>
            <div className="text-slate-500 uppercase font-bold">Precio prom</div>
            <div className="text-sm font-bold text-slate-700 tabular-nums">S/ {totales.precioProm}</div>
          </div>
          <div>
            <div className="text-slate-500 uppercase font-bold">Margen prom</div>
            <div className="text-sm font-bold text-emerald-700 tabular-nums">{totales.margenProm}%</div>
          </div>
        </div>
      </div>

      {/* Banner sugerencia · variante crítica */}
      {varianteCritica && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 text-xs text-amber-900">
            <div className="font-bold mb-0.5">
              Sugerencia · {getVarianteLabel(varianteCritica)} está en stock crítico
            </div>
            <div>
              Solo quedan {getStock(varianteCritica)} uds. <strong>Considera reordenar</strong> antes de quedar sin stock.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SkuAvatar: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <div
    className="inline-flex items-center justify-center text-white text-[10px] font-bold tabular-nums"
    style={{
      width: 24,
      height: 24,
      borderRadius: '50%',
      background: color,
      boxShadow: '0 0 0 2px white',
    }}
  >
    {label}
  </div>
);
