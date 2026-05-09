/**
 * StockProductoCard · card apilada canónica (F4 default · S3.6 M1 chk4.3)
 *
 * Layout horizontal denso · 1 fila visual aprovechando todo el ancho de columna
 * (no es grid de 4 col vertical · ese era el legacy pre-canon).
 *
 * Estructura:
 *   [icono] [SKU + nombre + marca + chip línea]
 *   [mini-distribución stock: 6 cifras inline con colores]
 *   [total + valor (tabular-nums)]
 *   [chips problema · si aplica]
 *   [botón Ver]
 *
 * Canon F4 (cards apiladas) · F7 (tabular-nums obligatorio) · F8 (lucide únicos).
 *
 * Patrón visual referencia: CompraCard.tsx + EnvioCardSimple.tsx (canon Era 2 vigente).
 */

import React from 'react';
import {
  Package,
  Warehouse,
  Plane,
  MapPin,
  ShoppingBag,
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
}

interface StockChipProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'sky' | 'amber' | 'emerald' | 'purple' | 'slate';
}

const StockChip: React.FC<StockChipProps> = ({ icon, label, value, color }) => {
  const colorMap = {
    sky: 'text-sky-700',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    purple: 'text-purple-700',
    slate: 'text-slate-600',
  };
  const isZero = value === 0;
  return (
    <div className="flex flex-col items-center min-w-[52px]">
      <div className={`flex items-center gap-1 ${isZero ? 'text-slate-400' : colorMap[color]}`}>
        {icon}
        <span className={`text-sm font-bold tabular-nums ${isZero ? 'text-slate-400' : ''}`}>
          {value}
        </span>
      </div>
      <div className={`text-[10px] uppercase tracking-wide font-medium mt-0.5 ${isZero ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </div>
    </div>
  );
};

export const StockProductoCard: React.FC<StockProductoCardProps> = ({
  producto,
  onVerDetalle,
}) => {
  const tieneProblemas = producto.stockCritico || producto.proximasAVencer30Dias > 0 || producto.problemas > 0;
  const descripcion = getDescripcionProducto(producto);

  return (
    <div
      className={`
        bg-white border rounded-xl px-4 py-3
        hover:border-slate-300 hover:shadow-sm transition-all
        ${producto.stockCritico ? 'border-rose-200 ring-1 ring-rose-100' : 'border-slate-200'}
      `.trim().replace(/\s+/g, ' ')}
    >
      <div className="flex items-center gap-4 flex-wrap lg:flex-nowrap">
        {/* Bloque 1: Identidad (icon + SKU + nombre + marca + línea) */}
        <div className="flex items-center gap-3 min-w-[240px] flex-1">
          <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-slate-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                {producto.sku}
              </span>
              <LineaNegocioBadge lineaNegocioId={producto.lineaNegocioId} />
            </div>
            <div className="text-sm text-slate-700 truncate">
              {producto.nombre}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {producto.marca}
              {descripcion && <span className="text-slate-400"> · {descripcion}</span>}
            </div>
          </div>
        </div>

        {/* Bloque 2: Distribución horizontal (6 chips) */}
        <div className="flex items-center gap-3 flex-shrink-0 px-2 border-l border-slate-100 pl-4">
          <StockChip
            icon={<Warehouse className="h-3.5 w-3.5" />}
            label="Origen"
            value={producto.enOrigen}
            color="sky"
          />
          <StockChip
            icon={<Plane className="h-3.5 w-3.5" />}
            label="Tránsito"
            value={producto.enTransitoOrigen + producto.enTransitoPeru}
            color="amber"
          />
          <StockChip
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Perú"
            value={producto.disponiblePeru}
            color="emerald"
          />
          <StockChip
            icon={<ShoppingBag className="h-3.5 w-3.5" />}
            label="Reserva"
            value={producto.reservadaOrigen + producto.reservadaPeru}
            color="purple"
          />
          <StockChip
            icon={<CheckCircle className="h-3.5 w-3.5" />}
            label="Vendidas"
            value={producto.vendida}
            color="slate"
          />
        </div>

        {/* Bloque 3: Total + Valor */}
        <div className="flex flex-col items-end min-w-[120px] flex-shrink-0 border-l border-slate-100 pl-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
            Total · Valor
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-slate-900 tabular-nums">
              {producto.totalUnidades}
            </span>
            <span className="text-xs text-slate-400">u</span>
          </div>
          <div className="text-sm font-semibold text-emerald-700 tabular-nums">
            {formatCurrency(producto.valorTotalUSD)}
          </div>
          <div className="text-[10px] text-slate-400 tabular-nums">
            Prom {formatCurrency(producto.costoPromedioUSD)}
          </div>
        </div>

        {/* Bloque 4: Problemas + Acción */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {tieneProblemas && (
            <div className="flex flex-col gap-1 items-end">
              {producto.stockCritico && (
                <Badge variant="danger" size="sm">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Crítico
                </Badge>
              )}
              {producto.proximasAVencer30Dias > 0 && (
                <Badge variant="warning" size="sm">
                  <Clock className="h-3 w-3 mr-1" />
                  {producto.proximasAVencer30Dias} vencen
                </Badge>
              )}
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={onVerDetalle}
          >
            <Eye className="h-3 w-3 mr-1" />
            Ver
          </Button>
        </div>
      </div>
    </div>
  );
};
