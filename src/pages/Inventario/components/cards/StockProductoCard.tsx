/**
 * StockProductoCard · pixel-perfect mockup stock-canon-s3.6-X.html (chk4.8)
 *
 * Refinamiento de la paleta del chk4.7f:
 *   - Avatar coloreado por línea de negocio (ProductoAvatar) · NO gris
 *   - LineaChipInline (rounded plano · paleta Tailwind directa) · NO LineaNegocioBadge legacy
 *   - EstadoChipInline para Crítico / Vence Nd / Solo origen / Activo / Pack
 *   - Tinte de fila por estado: rose-50/30 (crítico) · amber-50/30 (vencen)
 *   - Stock bar h-1.5 rounded (NO h-2 rounded-full)
 *   - Stock total: rose-600 cuando crítico · slate-900 normal
 *   - Valor USD: slate-900 (NO emerald)
 *   - Acciones hover-only (Eye + MoreHorizontal/Tag) con opacity-0 group-hover:opacity-100
 *
 * Layout grid 12 cols del mockup:
 *   col-1 (avatar+chk) · col-4 (identidad) · col-3 (stock bar) · col-2 (total) · col-1 (valor) · col-1 (acciones)
 */

import React from 'react';
import { Eye, MoreHorizontal, Tag, Check, AlertCircle, Clock, Warehouse } from 'lucide-react';
import type { ProductoConUnidades } from '../sections/ProductoInventarioTable';
import type { LineaNegocio } from '../../../../types/lineaNegocio.types';
import { formatCurrency } from '../../../../utils/format';
import { getDescripcionProducto } from '../../../../utils/producto.helpers';
import { ProductoAvatar, LineaChipInline, EstadoChipInline } from '../shell/ProductoAvatar';

interface StockProductoCardProps {
  producto: ProductoConUnidades;
  /** Línea de negocio del producto · objeto completo del store (BD) · NO código hardcoded */
  linea?: LineaNegocio | null;
  /** True si es un pack · render con avatar especial + badge contador + chip "Pack" */
  esPack?: boolean;
  /** Cantidad de productos vinculados al pack (badge contador en avatar) */
  packCount?: number;
  selected?: boolean;
  onToggleSelect?: () => void;
  onVerDetalle: () => void;
  onCrearPromocion?: () => void;
}

export const StockProductoCard: React.FC<StockProductoCardProps> = ({
  producto,
  linea,
  esPack = false,
  packCount,
  selected = false,
  onToggleSelect,
  onVerDetalle,
  onCrearPromocion,
}) => {
  const descripcion = getDescripcionProducto(producto);

  // Tinte de fila según estado prioritario (mockup canónico)
  const tinteFila = producto.stockCritico
    ? 'bg-rose-50/30'
    : producto.proximasAVencer30Dias > 0
      ? 'bg-amber-50/30'
      : '';

  // Color del stock total (mockup: rose cuando crítico)
  const stockTotalColor = producto.stockCritico ? 'text-rose-600' : 'text-slate-900';

  // Indicador secundario debajo del stock total (mockup canónico)
  const renderIndicadorStock = () => {
    if (producto.stockCritico) {
      return (
        <div className="text-[10px] text-rose-600 tabular-nums font-bold flex items-center gap-1 justify-end">
          <AlertCircle className="w-3 h-3" />
          Bajo mínimo
        </div>
      );
    }
    if (producto.proximasAVencer30Dias > 0) {
      return (
        <div className="text-[10px] text-amber-600 tabular-nums font-medium flex items-center gap-1 justify-end">
          <Clock className="w-3 h-3" />
          {producto.proximasAVencer30Dias} vencen pronto
        </div>
      );
    }
    if (producto.disponiblePeru > 0) {
      return (
        <div className="text-[10px] text-emerald-600 tabular-nums flex items-center gap-1 justify-end">
          <Check className="w-3 h-3" />
          {producto.disponiblePeru} disp. PE
        </div>
      );
    }
    if (producto.enOrigen > 0 && producto.disponiblePeru === 0) {
      return (
        <div className="text-[10px] text-sky-600 tabular-nums flex items-center gap-1 justify-end">
          <Warehouse className="w-3 h-3" />
          USA
        </div>
      );
    }
    return null;
  };

  // Segmentos de la stock-bar · mockup usa colores Tailwind 500
  const segmentos: { count: number; color: string; label: string }[] = [
    { count: producto.enOrigen,                                          color: 'bg-sky-500',     label: 'En origen' },
    { count: producto.enTransitoOrigen + producto.enTransitoPeru,        color: 'bg-amber-500',   label: 'En tránsito' },
    { count: producto.disponiblePeru,                                    color: 'bg-emerald-500', label: 'Disponible Perú' },
    { count: producto.reservadaOrigen + producto.reservadaPeru,          color: 'bg-violet-500',  label: 'Reservadas' },
  ];

  // Solo packs vendidas se muestran al final (mockup row 4)
  if (producto.vendida > 0 && esPack) {
    segmentos.push({ count: producto.vendida, color: 'bg-slate-400', label: 'Vendidas' });
  }

  const totalSegmentos = segmentos.reduce((s, x) => s + x.count, 0);
  const filler = Math.max(0, producto.totalUnidades - totalSegmentos);

  // Estado especial inline (mockup row 5: "Solo origen")
  const soloOrigen = producto.enOrigen > 0 && producto.disponiblePeru === 0
    && producto.enTransitoOrigen + producto.enTransitoPeru === 0
    && producto.reservada === 0;

  return (
    <div
      className={`px-4 py-3 grid grid-cols-12 gap-3 items-center cursor-pointer group transition-all hover:bg-slate-50/50 ${tinteFila}`}
      onClick={onVerDetalle}
    >
      {/* COL 1 · Checkbox + avatar coloreado por línea */}
      <div className="col-span-1 flex items-center gap-2.5">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={e => e.stopPropagation()}
            className="rounded border-slate-300 text-orange-600 w-3.5 h-3.5 focus:ring-orange-500"
          />
        )}
        <ProductoAvatar linea={linea} esPack={esPack} packCount={packCount} />
      </div>

      {/* COL 2-5 · Identidad: nombre + SKU + marca + chips inline */}
      <div className="col-span-4 min-w-0">
        <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
          {producto.nombre}
          {esPack && <EstadoChipInline variant="pack" />}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 flex-wrap">
          <span className="font-mono">{producto.sku}</span>
          <span>·</span>
          <span className="truncate max-w-[120px]">{producto.marca}</span>
          <span>·</span>
          <LineaChipInline linea={linea} />
          {producto.stockCritico && <EstadoChipInline variant="critico" />}
          {!producto.stockCritico && producto.proximasAVencer30Dias > 0 && (
            <EstadoChipInline variant="vencen" label={`Vence pronto`} />
          )}
          {!producto.stockCritico && producto.proximasAVencer30Dias === 0 && soloOrigen && (
            <EstadoChipInline variant="solo_origen" />
          )}
        </div>
        {descripcion && !esPack && (
          <div className="text-[10px] text-slate-400 truncate mt-0.5">
            {descripcion}
          </div>
        )}
      </div>

      {/* COL 6-8 · Stock bar segmentado + leyenda numérica */}
      <div className="col-span-3">
        {producto.totalUnidades > 0 ? (
          <>
            <div className="h-1.5 rounded bg-slate-100 overflow-hidden flex mb-1.5 group/bar">
              {segmentos.map((seg, idx) =>
                seg.count > 0 ? (
                  <div
                    key={idx}
                    className={`${seg.color} transition-opacity hover:opacity-90 relative cursor-help`}
                    style={{ flex: seg.count }}
                  >
                    {/* Tooltip estilizado on-hover · canon Notion/Linear (chk4.22) */}
                    <div className="absolute left-1/2 -translate-x-1/2 -top-8 hidden group-hover/bar:hidden hover:!block pointer-events-none z-10">
                      <div className="bg-slate-900 text-white text-[10px] font-medium px-2 py-1 rounded shadow-lg whitespace-nowrap tabular-nums">
                        {seg.label}: {seg.count}
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900"></div>
                    </div>
                  </div>
                ) : null
              )}
              {filler > 0 && producto.stockCritico && (
                <div
                  className="bg-slate-100 cursor-help"
                  style={{ flex: filler }}
                  title={`Espacio libre hasta stock mínimo: ${filler}`}
                />
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] tabular-nums text-slate-500">
              {producto.enOrigen > 0 && <span className="text-sky-600">{producto.enOrigen}</span>}
              {(producto.enTransitoOrigen + producto.enTransitoPeru) > 0 && (
                <span className="text-amber-600">{producto.enTransitoOrigen + producto.enTransitoPeru} tránsito</span>
              )}
              {producto.disponiblePeru > 0 && (
                <span className="text-emerald-600">{producto.disponiblePeru} disp.</span>
              )}
              {(producto.reservadaOrigen + producto.reservadaPeru) > 0 && (
                <span className="text-violet-600">{producto.reservadaOrigen + producto.reservadaPeru} reserv.</span>
              )}
              {producto.stockCritico && (
                <span className="text-rose-600 font-bold">
                  {producto.totalDisponibles} {producto.totalDisponibles === 1 ? 'mín' : '/ mín'}
                </span>
              )}
              {producto.proximasAVencer30Dias > 0 && (
                <span className="text-amber-600 font-bold">{producto.proximasAVencer30Dias} vencen</span>
              )}
            </div>
          </>
        ) : (
          <div className="text-[10px] text-slate-400 italic">Sin unidades activas</div>
        )}
      </div>

      {/* COL 9-10 · Stock total + indicador */}
      <div className="col-span-2 text-right">
        <div className={`text-sm font-bold tabular-nums ${stockTotalColor}`}>
          {producto.totalUnidades.toLocaleString('es-PE')} uds
        </div>
        {renderIndicadorStock()}
      </div>

      {/* COL 11 · Valor USD */}
      <div className="col-span-1 text-right">
        <div className="text-sm font-semibold text-slate-900 tabular-nums">
          {formatCurrency(producto.valorTotalUSD)}
        </div>
      </div>

      {/* COL 12 · Acciones hover-only */}
      <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {producto.proximasAVencer30Dias > 0 && onCrearPromocion ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCrearPromocion(); }}
            className="p-1.5 rounded hover:bg-amber-100 text-amber-600 transition-colors"
            title="Crear promoción"
          >
            <Tag className="w-4 h-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onVerDetalle(); }}
          className="p-1.5 rounded hover:bg-orange-50 text-slate-500 hover:text-orange-600 transition-colors"
          title="Ver detalle"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors"
          title="Más acciones"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/**
 * StockListHeader · header de columnas tipo tabla canónico (mockup X)
 *
 * bg-slate-50 · text-[10px] uppercase tracking-wider text-slate-500 font-semibold
 * Distribución exacta para alinear con StockProductoCard (col-1+4+3+2+1+1).
 */

interface StockListHeaderProps {
  total: number;
  hasSelection?: boolean;
  allSelected?: boolean;
  onToggleAll?: () => void;
}

export const StockListHeader: React.FC<StockListHeaderProps> = ({
  total,
  hasSelection = false,
  allSelected = false,
  onToggleAll,
}) => {
  return (
    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 grid grid-cols-12 gap-3 items-center text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
      <div className="col-span-5 flex items-center gap-3">
        {hasSelection && onToggleAll && (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            className="rounded border-slate-300 text-orange-600 w-3.5 h-3.5 focus:ring-orange-500"
          />
        )}
        <span>Producto · <span className="tabular-nums">{total.toLocaleString('es-PE')}</span> resultados</span>
      </div>
      <div className="col-span-3">Estados</div>
      <div className="col-span-2 text-right">Stock total</div>
      <div className="col-span-1 text-right">Valor USD</div>
      <div className="col-span-1" />
    </div>
  );
};
