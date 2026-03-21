import React from 'react';
import {
  Package,
  Warehouse,
  MapPin,
  Clock,
  AlertTriangle,
  Eye,
  DollarSign,
  Calendar,
  Hash
} from 'lucide-react';
import { Badge, Button, Card, LineaNegocioBadge, PaisOrigenBadge } from '../../common';
import type { Unidad, EstadoUnidad } from '../../../types/unidad.types';
import { getLabelEstadoUnidad, esEstadoEnOrigen, esEstadoEnTransitoOrigen, getPaisEmoji } from '../../../utils/multiOrigen.helpers';
import { formatFecha, calcularDiasParaVencer as calcularDiasParaVencerUtil } from '../../../utils/dateFormatters';
import { formatCurrency } from '../../../utils/format';

interface UnidadCardProps {
  unidad: Unidad;
  productoInfo?: { presentacion?: string; contenido?: string; dosaje?: string; sabor?: string };
  onVerDetalle: () => void;
}

const getEstadoConfig = (estado: EstadoUnidad, pais?: string): { variant: 'success' | 'info' | 'warning' | 'default' | 'danger'; label: string; bgColor: string } => {
  const label = getLabelEstadoUnidad(estado, pais);
  if (esEstadoEnOrigen(estado)) return { variant: 'success', label, bgColor: 'bg-blue-50' };
  if (esEstadoEnTransitoOrigen(estado)) return { variant: 'info', label, bgColor: 'bg-amber-50' };
  switch (estado) {
    case 'en_transito_peru': return { variant: 'info', label, bgColor: 'bg-amber-50' };
    case 'disponible_peru': return { variant: 'success', label, bgColor: 'bg-green-50' };
    case 'reservada': return { variant: 'warning', label, bgColor: 'bg-purple-50' };
    case 'asignada_pedido': return { variant: 'warning', label, bgColor: 'bg-indigo-50' };
    case 'vendida': return { variant: 'default', label, bgColor: 'bg-gray-50' };
    case 'vencida': return { variant: 'danger', label, bgColor: 'bg-red-50' };
    case 'danada': return { variant: 'danger', label, bgColor: 'bg-red-50' };
    default: return { variant: 'default', label, bgColor: 'bg-gray-50' };
  }
};

export const UnidadCard: React.FC<UnidadCardProps> = ({
  unidad,
  productoInfo,
  onVerDetalle
}) => {
  // formatCurrency importado de utils/format (USD por defecto)

  const diasParaVencer = calcularDiasParaVencerUtil(unidad.fechaVencimiento) ?? 999;
  const estado = getEstadoConfig(unidad.estado, unidad.paisOrigen || unidad.pais);

  const esProblematico = unidad.estado === 'vencida' || unidad.estado === 'danada';
  const proximoAVencer = diasParaVencer <= 30 && diasParaVencer >= 0 && unidad.estado !== 'vendida';

  return (
    <Card
      padding="none"
      className={`overflow-hidden hover:shadow-lg transition-shadow ${
        esProblematico ? 'ring-2 ring-red-300' : proximoAVencer ? 'ring-2 ring-amber-300' : ''
      }`}
    >
      {/* Header con estado */}
      <div className={`${estado.bgColor} px-4 py-3 border-b border-gray-200`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant={estado.variant} size="sm">
              {estado.label}
            </Badge>
            <LineaNegocioBadge lineaNegocioId={unidad.lineaNegocioId} />
            <PaisOrigenBadge paisOrigen={unidad.paisOrigen} />
          </div>
          {proximoAVencer && (
            <div className="flex items-center gap-1 text-amber-600">
              <Clock className="h-3 w-3" />
              <span className="text-xs font-medium">{diasParaVencer}d</span>
            </div>
          )}
          {esProblematico && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </div>
      </div>

      {/* Contenido principal */}
      <div className="p-4">
        {/* Producto */}
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-gray-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-sm font-bold text-gray-900">
              {unidad.productoSKU || '-'}
            </div>
            <div className="text-sm text-gray-600 truncate">
              {unidad.productoNombre || '-'}
            </div>
            {productoInfo && (productoInfo.presentacion || productoInfo.contenido || productoInfo.dosaje || productoInfo.sabor) && (
              <div className="text-[10px] text-gray-400 truncate">
                {[productoInfo.presentacion, productoInfo.contenido, productoInfo.dosaje, productoInfo.sabor].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </div>

        {/* Información de la unidad */}
        <div className="space-y-2">
          {/* Lote */}
          <div className="flex items-center gap-2 text-sm">
            <Hash className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">Lote:</span>
            <span className="font-medium text-gray-900">{unidad.lote || '-'}</span>
          </div>

          {/* Ubicación */}
          <div className="flex items-center gap-2 text-sm">
            {unidad.pais === 'Peru' ? (
              <MapPin className="h-4 w-4 text-green-500" />
            ) : (
              <Warehouse className="h-4 w-4 text-blue-500" />
            )}
            <span className="text-gray-500">Almacén:</span>
            <span className="font-medium text-gray-900">
              {getPaisEmoji(unidad.pais)} {unidad.almacenNombre || '-'}
            </span>
          </div>

          {/* Vencimiento */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">Vence:</span>
            <span className={`font-medium ${
              diasParaVencer < 0 ? 'text-red-600' :
              diasParaVencer <= 30 ? 'text-amber-600' :
              diasParaVencer <= 90 ? 'text-yellow-600' :
              'text-gray-900'
            }`}>
              {formatFecha(unidad.fechaVencimiento)}
              {diasParaVencer < 0 && ` (Vencido)`}
            </span>
          </div>

          {/* Costo */}
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">Costo:</span>
            <span className="font-medium text-green-600">
              {formatCurrency(unidad.costoUnitarioUSD || 0)}
            </span>
          </div>
        </div>

        {/* Orden de compra si existe */}
        {unidad.ordenCompraNumero && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              OC: <span className="font-medium text-gray-700">{unidad.ordenCompraNumero}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer con acción */}
      <div className="px-4 pb-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={onVerDetalle}
          className="w-full"
        >
          <Eye className="h-3 w-3 mr-1" />
          Ver Detalles
        </Button>
      </div>
    </Card>
  );
};
