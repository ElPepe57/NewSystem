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
import { Badge, Button, Card } from '../../common';
import type { Unidad, EstadoUnidad } from '../../../types/unidad.types';

interface UnidadCardProps {
  unidad: Unidad;
  onVerDetalle: () => void;
}

const estadoConfig: Record<EstadoUnidad, { variant: 'success' | 'info' | 'warning' | 'default' | 'danger'; label: string; bgColor: string }> = {
  'recibida_usa': { variant: 'success', label: 'Recibida USA', bgColor: 'bg-blue-50' },
  'en_transito_usa': { variant: 'info', label: 'En Tránsito USA', bgColor: 'bg-amber-50' },
  'en_transito_peru': { variant: 'info', label: 'En Tránsito → Perú', bgColor: 'bg-amber-50' },
  'disponible_peru': { variant: 'success', label: 'Disponible Perú', bgColor: 'bg-green-50' },
  'reservada': { variant: 'warning', label: 'Reservada', bgColor: 'bg-purple-50' },
  'vendida': { variant: 'default', label: 'Vendida', bgColor: 'bg-gray-50' },
  'vencida': { variant: 'danger', label: 'Vencida', bgColor: 'bg-red-50' },
  'danada': { variant: 'danger', label: 'Dañada', bgColor: 'bg-red-50' }
};

export const UnidadCard: React.FC<UnidadCardProps> = ({
  unidad,
  onVerDetalle
}) => {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatFecha = (timestamp: any): string => {
    if (!timestamp || !timestamp.toDate) return '-';
    return timestamp.toDate().toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calcularDiasParaVencer = (): number => {
    if (!unidad.fechaVencimiento || !unidad.fechaVencimiento.toDate) return 999;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vencimiento = unidad.fechaVencimiento.toDate();
    vencimiento.setHours(0, 0, 0, 0);
    const diffTime = vencimiento.getTime() - hoy.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const diasParaVencer = calcularDiasParaVencer();
  const estado = estadoConfig[unidad.estado] || { variant: 'default' as const, label: unidad.estado, bgColor: 'bg-gray-50' };

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
          <Badge variant={estado.variant} size="sm">
            {estado.label}
          </Badge>
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
            {unidad.pais === 'USA' ? (
              <Warehouse className="h-4 w-4 text-blue-500" />
            ) : (
              <MapPin className="h-4 w-4 text-green-500" />
            )}
            <span className="text-gray-500">Almacén:</span>
            <span className="font-medium text-gray-900">
              {unidad.pais === 'USA' ? '🇺🇸' : '🇵🇪'} {unidad.almacenNombre || '-'}
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
