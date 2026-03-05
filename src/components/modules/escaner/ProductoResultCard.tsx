import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  MapPin,
  Plane,
  ArrowRightLeft,
  ShoppingBag,
  DollarSign,
  ExternalLink,
  ScanLine,
  Box
} from 'lucide-react';
import type { Producto } from '../../../types/producto.types';

interface ProductoResultCardProps {
  producto: Producto;
  onScanAgain: () => void;
}

export const ProductoResultCard: React.FC<ProductoResultCardProps> = ({
  producto,
  onScanAgain
}) => {
  const navigate = useNavigate();

  const stockItems = [
    { label: 'Peru', value: producto.stockPeru || 0, icon: MapPin, color: 'green' },
    { label: 'USA', value: producto.stockUSA || 0, icon: Plane, color: 'blue' },
    { label: 'Transito', value: producto.stockTransito || 0, icon: ArrowRightLeft, color: 'amber' },
    { label: 'Reservado', value: producto.stockReservado || 0, icon: ShoppingBag, color: 'purple' },
    { label: 'Disponible', value: producto.stockDisponible || 0, icon: Box, color: 'emerald' },
  ];

  return (
    <div className="bg-white border border-green-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-3 py-2.5 sm:px-4 sm:py-3 border-b border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 sm:p-1.5 bg-green-100 rounded-lg">
              <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
            </div>
            <div>
              <span className="text-xs text-green-600 font-medium">Producto encontrado</span>
              <div className="font-mono text-xs sm:text-sm text-green-800 font-bold">{producto.sku}</div>
            </div>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            producto.estado === 'activo'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {producto.estado}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Product info */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight">
            {producto.marca} - {producto.nombreComercial}
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {producto.presentacion} · {producto.dosaje} · {producto.contenido}
          </p>
          {producto.codigoUPC && (
            <p className="text-xs text-gray-400 mt-1 font-mono">
              UPC: {producto.codigoUPC}
            </p>
          )}
        </div>

        {/* Stock grid - 3 cols on mobile (top 3), 5 cols on desktop */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
          {stockItems.map((item, idx) => (
            <div
              key={item.label}
              className={`text-center p-1.5 sm:p-2 bg-gray-50 rounded-lg ${
                idx >= 3 ? 'hidden sm:block' : ''
              }`}
            >
              <item.icon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 mx-auto mb-0.5 text-${item.color}-500`} />
              <div className={`text-base sm:text-lg font-bold text-${item.color}-600`}>
                {item.value}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-500">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Extra stock on mobile (Reservado + Disponible inline) */}
        <div className="flex gap-3 sm:hidden text-xs text-gray-500">
          <span>Reservado: <span className="font-semibold text-purple-600">{producto.stockReservado || 0}</span></span>
          <span>Disponible: <span className="font-semibold text-emerald-600">{producto.stockDisponible || 0}</span></span>
        </div>

        {/* Pricing */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {producto.precioSugerido > 0 && (
            <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 bg-blue-50 rounded-lg">
              <DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-500" />
              <span className="text-xs sm:text-sm text-gray-600">Sug:</span>
              <span className="text-xs sm:text-sm font-bold text-blue-700">S/{producto.precioSugerido.toFixed(2)}</span>
            </div>
          )}
          {producto.ctruPromedio > 0 && (
            <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 bg-amber-50 rounded-lg">
              <DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-500" />
              <span className="text-xs sm:text-sm text-gray-600">CTRU:</span>
              <span className="text-xs sm:text-sm font-bold text-amber-700">S/{producto.ctruPromedio.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Actions - full width stacked on mobile */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1 sm:pt-2">
          <button
            type="button"
            onClick={() => navigate('/productos')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Ver Producto
          </button>
          <button
            type="button"
            onClick={onScanAgain}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <ScanLine className="h-4 w-4" />
            Escanear Otro
          </button>
        </div>
      </div>
    </div>
  );
};
