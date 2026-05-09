/**
 * UnidadCard · card apilada canónica (F4 default · S3.6 M1 chk4.4)
 *
 * Layout horizontal denso · 1 fila visual coherente con StockProductoCard.
 *
 * Estructura:
 *   [icon + SKU + nombre + chips línea/país]
 *   [lote + almacén + vencimiento + costo (tabular-nums)]
 *   [badge estado + indicadores problema]
 *   [botón Ver]
 *
 * Canon F4 (cards apiladas) · F7 (tabular-nums) · F8 (lucide únicos).
 */

import React from 'react';
import {
  Package,
  Warehouse,
  MapPin,
  Clock,
  AlertTriangle,
  Eye,
  Calendar,
  Hash,
} from 'lucide-react';
import { Badge, Button, LineaNegocioBadge, PaisOrigenBadge } from '../../../../components/common';
import type { Unidad, EstadoUnidad } from '../../../../types/unidad.types';
import { getLabelEstadoUnidad, esEstadoEnOrigen, esEstadoEnTransitoOrigen, getPaisEmoji } from '../../../../utils/multiOrigen.helpers';
import { formatFecha, calcularDiasParaVencer as calcularDiasParaVencerUtil } from '../../../../utils/dateFormatters';
import { formatCurrency } from '../../../../utils/format';
import { getDescripcionProducto } from '../../../../utils/producto.helpers';

interface UnidadCardProps {
  unidad: Unidad;
  productoInfo?: { presentacion?: string; contenido?: string; dosaje?: string; sabor?: string; atributosSkincare?: any };
  onVerDetalle: () => void;
}

const getEstadoVariant = (estado: EstadoUnidad): 'success' | 'info' | 'warning' | 'default' | 'danger' => {
  if (esEstadoEnOrigen(estado)) return 'success';
  if (esEstadoEnTransitoOrigen(estado)) return 'info';
  switch (estado) {
    case 'en_transito_peru': return 'info';
    case 'disponible_peru': return 'success';
    case 'reservada':
    case 'asignada_pedido': return 'warning';
    case 'vendida': return 'default';
    case 'vencida':
    case 'danada': return 'danger';
    default: return 'default';
  }
};

const getColorVencimiento = (dias: number): string => {
  if (dias < 0) return 'text-rose-700';
  if (dias <= 30) return 'text-amber-700';
  if (dias <= 90) return 'text-yellow-700';
  return 'text-slate-700';
};

export const UnidadCard: React.FC<UnidadCardProps> = ({
  unidad,
  productoInfo,
  onVerDetalle,
}) => {
  const diasParaVencer = calcularDiasParaVencerUtil(unidad.fechaVencimiento) ?? 999;
  const variant = getEstadoVariant(unidad.estado);
  const estadoLabel = getLabelEstadoUnidad(unidad.estado, unidad.paisOrigen || unidad.pais);

  const esProblematico = unidad.estado === 'vencida' || unidad.estado === 'danada';
  const proximoAVencer = diasParaVencer <= 30 && diasParaVencer >= 0 && unidad.estado !== 'vendida';

  const ringClass = esProblematico
    ? 'border-rose-200 ring-1 ring-rose-100'
    : proximoAVencer
      ? 'border-amber-200 ring-1 ring-amber-100'
      : 'border-slate-200';

  const descripcion = productoInfo ? getDescripcionProducto(productoInfo) : '';

  return (
    <div
      className={`bg-white border rounded-xl px-4 py-3 hover:border-slate-300 hover:shadow-sm transition-all ${ringClass}`}
    >
      <div className="flex items-center gap-4 flex-wrap lg:flex-nowrap">
        {/* Bloque 1: Identidad producto */}
        <div className="flex items-center gap-3 min-w-[240px] flex-1">
          <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-slate-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                {unidad.productoSKU || '-'}
              </span>
              <LineaNegocioBadge lineaNegocioId={unidad.lineaNegocioId} />
              <PaisOrigenBadge paisOrigen={unidad.paisOrigen} />
            </div>
            <div className="text-sm text-slate-700 truncate">
              {unidad.productoNombre || '-'}
            </div>
            {descripcion && (
              <div className="text-xs text-slate-500 truncate">
                {descripcion}
              </div>
            )}
          </div>
        </div>

        {/* Bloque 2: Datos operativos (lote · almacén · venc · costo) */}
        <div className="flex items-center gap-4 flex-shrink-0 px-2 border-l border-slate-100 pl-4 flex-wrap">
          {/* Lote */}
          <div className="flex flex-col items-start min-w-[80px]">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
              <Hash className="h-3 w-3" />
              Lote
            </div>
            <span className="text-sm font-medium text-slate-900 tabular-nums">
              {unidad.lote || '-'}
            </span>
          </div>

          {/* Almacén */}
          <div className="flex flex-col items-start min-w-[110px]">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
              {unidad.pais === 'Peru'
                ? <MapPin className="h-3 w-3" />
                : <Warehouse className="h-3 w-3" />}
              Almacén
            </div>
            <span className="text-sm font-medium text-slate-900 truncate max-w-[180px]">
              {getPaisEmoji(unidad.pais)} {unidad.almacenNombre || '-'}
            </span>
          </div>

          {/* Vencimiento */}
          <div className="flex flex-col items-start min-w-[100px]">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
              <Calendar className="h-3 w-3" />
              Vence
            </div>
            <span className={`text-sm font-medium tabular-nums ${getColorVencimiento(diasParaVencer)}`}>
              {formatFecha(unidad.fechaVencimiento)}
            </span>
            {diasParaVencer < 0 && (
              <span className="text-[10px] text-rose-600 tabular-nums">
                Vencido {Math.abs(diasParaVencer)}d
              </span>
            )}
          </div>

          {/* Costo */}
          <div className="flex flex-col items-end min-w-[80px]">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
              Costo
            </div>
            <span className="text-sm font-semibold text-emerald-700 tabular-nums">
              {formatCurrency(unidad.costoUnitarioUSD || 0)}
            </span>
          </div>
        </div>

        {/* Bloque 3: Estado + chips problema + acción */}
        <div className="flex items-center gap-2 flex-shrink-0 border-l border-slate-100 pl-4">
          <div className="flex flex-col items-end gap-1">
            <Badge variant={variant} size="sm">{estadoLabel}</Badge>
            {proximoAVencer && (
              <Badge variant="warning" size="sm">
                <Clock className="h-3 w-3 mr-1" />
                {diasParaVencer}d
              </Badge>
            )}
            {esProblematico && (
              <Badge variant="danger" size="sm">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Problema
              </Badge>
            )}
          </div>
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

      {unidad.ordenCompraNumero && (
        <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
          OC: <span className="font-medium text-slate-700 tabular-nums">{unidad.ordenCompraNumero}</span>
          {unidad.envioNumero && <> · Envío: <span className="font-medium text-sky-600 tabular-nums">{unidad.envioNumero}</span></>}
        </div>
      )}
    </div>
  );
};
