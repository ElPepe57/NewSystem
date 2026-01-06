import React from 'react';
import {
  Package,
  Warehouse,
  Plane,
  MapPin,
  ShoppingBag,
  AlertTriangle,
  Clock,
  DollarSign,
  Eye
} from 'lucide-react';
import { Badge, Button, Card } from '../../common';
import type { ProductoConUnidades } from './ProductoInventarioTable';

interface StockProductoCardProps {
  producto: ProductoConUnidades;
  onVerDetalle: () => void;
}

export const StockProductoCard: React.FC<StockProductoCardProps> = ({
  producto,
  onVerDetalle
}) => {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const tieneProblemas = producto.stockCritico || producto.proximasAVencer30Dias > 0 || producto.problemas > 0;

  return (
    <Card
      padding="none"
      className={`overflow-hidden hover:shadow-lg transition-shadow ${
        producto.stockCritico ? 'ring-2 ring-red-300' : ''
      }`}
    >
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
              <Package className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <div className="font-mono text-sm font-bold text-gray-900">
                {producto.sku}
              </div>
              <div className="text-xs text-gray-500 truncate max-w-[150px]">
                {producto.marca}
              </div>
            </div>
          </div>
          {tieneProblemas && (
            <div className="flex flex-col gap-1">
              {producto.stockCritico && (
                <Badge variant="danger" size="sm">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Crítico
                </Badge>
              )}
              {producto.proximasAVencer30Dias > 0 && (
                <Badge variant="warning" size="sm">
                  <Clock className="h-3 w-3 mr-1" />
                  {producto.proximasAVencer30Dias}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="text-sm text-gray-600 mt-1 truncate">
          {producto.nombre}
        </div>
      </div>

      {/* Distribución de Stock */}
      <div className="p-4">
        <div className="text-xs font-medium text-gray-500 uppercase mb-2">
          Distribución
        </div>
        <div className="grid grid-cols-4 gap-2">
          {/* USA */}
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <Warehouse className="h-4 w-4 text-blue-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-blue-600">
              {producto.recibidaUSA}
            </div>
            <div className="text-[10px] text-blue-500 font-medium">USA</div>
          </div>

          {/* Tránsito */}
          <div className="text-center p-2 bg-amber-50 rounded-lg">
            <Plane className="h-4 w-4 text-amber-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-amber-600">
              {producto.enTransitoUSA + producto.enTransitoPeru}
            </div>
            <div className="text-[10px] text-amber-500 font-medium">Tránsito</div>
          </div>

          {/* Perú */}
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <MapPin className="h-4 w-4 text-green-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-green-600">
              {producto.disponiblePeru}
            </div>
            <div className="text-[10px] text-green-500 font-medium">Perú</div>
          </div>

          {/* Reservadas */}
          <div className="text-center p-2 bg-purple-50 rounded-lg">
            <ShoppingBag className="h-4 w-4 text-purple-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-purple-600">
              {producto.reservada}
            </div>
            <div className="text-[10px] text-purple-500 font-medium">Reserv.</div>
          </div>
        </div>
      </div>

      {/* Valor y Total */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <div className="text-xs text-gray-500">Total Unidades</div>
            <div className="text-xl font-bold text-gray-900">
              {producto.totalUnidades}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Valor Total</div>
            <div className="text-lg font-bold text-green-600">
              {formatCurrency(producto.valorTotalUSD)}
            </div>
          </div>
        </div>
      </div>

      {/* Footer con costo promedio */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <DollarSign className="h-3 w-3" />
          Prom: {formatCurrency(producto.costoPromedioUSD)}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onVerDetalle}
        >
          <Eye className="h-3 w-3 mr-1" />
          Ver Unidades
        </Button>
      </div>
    </Card>
  );
};
