/**
 * StockProductoCard · card apilada canónica (F4 default · S3.6 M1 chk4.7f)
 *
 * Pixel-perfect mockup stock-canon-s3.6-X.html. Estructura tipo "row de tabla
 * apilada" (a diferencia del simple stack de cards · sigue patrón Stripe/Linear):
 *
 *   Layout: 4 columnas alineadas con StockListHeader:
 *     [checkbox + identidad SKU/nombre/marca/línea]
 *     [barra distribución horizontal de colores + leyenda numérica]
 *     [stock total con badge alerta]
 *     [valor USD]
 *
 *   Indicadores:
 *     - Stock crítico: ring-1 rose
 *     - Próx. vencer: badge amber inline
 *     - Botón Ver al final
 *
 * Canon F4 (cards apiladas) + F7 (tabular-nums) + F8 (lucide únicos).
 */

import React from 'react';
import {
  Package,
  AlertTriangle,
  Clock,
  Eye,
  CheckCircle,
} from 'lucide-react';
import { Badge, Button, LineaNegocioBadge } from '../../../../components/common';
import type { ProductoConUnidades } from '../sections/ProductoInventarioTable';
import { formatCurrency } from '../../../../utils/format';
import { getDescripcionProducto } from '../../../../utils/producto.helpers';

interface StockProductoCardProps {
  producto: ProductoConUnidades;
  onVerDetalle: () => void;
  /** Si true, render compacto · si false, expanded con descripción producto */
  selected?: boolean;
  onToggleSelect?: () => void;
}

interface DistribucionSegmentProps {
  count: number;
  total: number;
  label: string;
  color: string;
}

const DistribucionSegment: React.FC<DistribucionSegmentProps> = ({ count, total, color }) => {
  if (count === 0 || total === 0) return null;
  const pct = (count / total) * 100;
  return (
    <div
      className={`h-2 ${color} transition-all`}
      style={{ width: `${pct}%` }}
    />
  );
};

export const StockProductoCard: React.FC<StockProductoCardProps> = ({
  producto,
  onVerDetalle,
  selected = false,
  onToggleSelect,
}) => {
  const tieneProblemas = producto.stockCritico || producto.proximasAVencer30Dias > 0;
  const descripcion = getDescripcionProducto(producto);

  // Distribución para la barra horizontal (canónico mockup X)
  const segmentos = [
    { count: producto.enOrigen, label: 'Origen', color: 'bg-sky-500' },
    { count: producto.enTransitoOrigen + producto.enTransitoPeru, label: 'Tránsito', color: 'bg-amber-500' },
    { count: producto.disponiblePeru, label: 'Perú', color: 'bg-emerald-500' },
    { count: producto.reservadaOrigen + producto.reservadaPeru, label: 'Reservadas', color: 'bg-purple-500' },
    { count: producto.vendida, label: 'Vendidas', color: 'bg-slate-400' },
  ];

  const total = producto.totalUnidades;

  return (
    <div
      className={`
        bg-white border rounded-xl px-4 py-3
        hover:border-slate-300 hover:shadow-sm transition-all
        ${producto.stockCritico ? 'border-rose-200 ring-1 ring-rose-100' : 'border-slate-200'}
      `.trim().replace(/\s+/g, ' ')}
    >
      <div className="grid grid-cols-12 gap-3 items-center">
        {/* COL 1-5 · Identidad: checkbox + icono + SKU/nombre/marca/chip */}
        <div className="col-span-12 lg:col-span-5 flex items-center gap-3 min-w-0">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              onClick={e => e.stopPropagation()}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 flex-shrink-0"
            />
          )}
          <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-slate-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {producto.nombre}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 mt-0.5">
              <span className="font-mono tabular-nums">{producto.sku}</span>
              <span>·</span>
              <span className="truncate">{producto.marca}</span>
              <LineaNegocioBadge lineaNegocioId={producto.lineaNegocioId} />
            </div>
            {descripcion && (
              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                {descripcion}
              </div>
            )}
          </div>
        </div>

        {/* COL 6-9 · Estados (barra distribución horizontal + leyenda numérica) */}
        <div className="col-span-12 lg:col-span-4">
          {total > 0 ? (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
                {segmentos.map((seg, idx) => (
                  <DistribucionSegment
                    key={idx}
                    count={seg.count}
                    total={total}
                    label={seg.label}
                    color={seg.color}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 tabular-nums flex-wrap">
                {producto.enOrigen > 0 && <span className="text-sky-600 font-medium">{producto.enOrigen}</span>}
                {(producto.enTransitoOrigen + producto.enTransitoPeru) > 0 && (
                  <span className="text-amber-600 font-medium">{producto.enTransitoOrigen + producto.enTransitoPeru}</span>
                )}
                {producto.disponiblePeru > 0 && <span className="text-emerald-600 font-medium">{producto.disponiblePeru}</span>}
                {(producto.reservadaOrigen + producto.reservadaPeru) > 0 && (
                  <span className="text-purple-600 font-medium">{producto.reservadaOrigen + producto.reservadaPeru}</span>
                )}
                {producto.vendida > 0 && <span className="text-slate-500 font-medium">{producto.vendida}</span>}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">Sin unidades activas</div>
          )}
        </div>

        {/* COL 10-11 · Stock total + indicador */}
        <div className="col-span-6 lg:col-span-2 text-right">
          <div className="text-base font-bold text-slate-900 tabular-nums">
            {producto.totalUnidades.toLocaleString('es-PE')} <span className="text-xs text-slate-400 font-normal">uds</span>
          </div>
          {producto.stockCritico ? (
            <div className="flex items-center gap-1 justify-end text-[10px] text-rose-600 font-medium tabular-nums">
              <AlertTriangle className="h-2.5 w-2.5" />
              Bajo mínimo
            </div>
          ) : producto.proximasAVencer30Dias > 0 ? (
            <div className="flex items-center gap-1 justify-end text-[10px] text-amber-600 font-medium tabular-nums">
              <Clock className="h-2.5 w-2.5" />
              {producto.proximasAVencer30Dias} vencen
            </div>
          ) : producto.disponiblePeru > 0 ? (
            <div className="flex items-center gap-1 justify-end text-[10px] text-emerald-600 font-medium tabular-nums">
              <CheckCircle className="h-2.5 w-2.5" />
              {producto.disponiblePeru} disp. PE
            </div>
          ) : null}
        </div>

        {/* COL 12 · Valor USD + acción */}
        <div className="col-span-6 lg:col-span-1 flex items-center justify-end gap-2">
          <div className="text-right">
            <div className="text-sm font-semibold text-emerald-700 tabular-nums">
              {formatCurrency(producto.valorTotalUSD)}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onVerDetalle}
            title="Ver unidades"
          >
            <Eye className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Indicadores secundarios extra (problemas múltiples) */}
      {tieneProblemas && producto.stockCritico && producto.proximasAVencer30Dias > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
          <Badge variant="danger" size="sm">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Crítico
          </Badge>
          <Badge variant="warning" size="sm">
            <Clock className="h-3 w-3 mr-1" />
            {producto.proximasAVencer30Dias} vencen pronto
          </Badge>
        </div>
      )}
    </div>
  );
};

/**
 * StockListHeader · header de columnas tipo tabla para alinear con StockProductoCard
 *
 * Mockup canónico stock-canon-s3.6-X.html · 4 columnas:
 *   PRODUCTO · N RESULTADOS  |  ESTADOS  |  STOCK TOTAL  |  VALOR USD
 *
 * Se renderiza arriba de la lista apilada de cards en modo Stock.
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
    <div className="px-4 py-2 grid grid-cols-12 gap-3 items-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
      <div className="col-span-12 lg:col-span-5 flex items-center gap-3">
        {hasSelection && onToggleAll && (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
        )}
        <span>Producto · <span className="tabular-nums">{total.toLocaleString('es-PE')}</span> resultados</span>
      </div>
      <div className="hidden lg:block lg:col-span-4">Estados</div>
      <div className="hidden lg:block lg:col-span-2 text-right">Stock total</div>
      <div className="hidden lg:block lg:col-span-1 text-right">Valor USD</div>
    </div>
  );
};
