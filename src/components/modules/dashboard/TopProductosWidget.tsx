import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Package, ArrowUpRight } from 'lucide-react';
import { Card, Badge } from '../../common';
import { formatCurrencyPEN } from '../../../utils/format';

interface ProductoTop {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  unidadesVendidas: number;
  ventasTotalPEN: number;
  utilidadPEN: number;
  margenPromedio: number;
}

interface TopProductosWidgetProps {
  productos: ProductoTop[];
  maxItems?: number;
  titulo?: string;
}

export const TopProductosWidget: React.FC<TopProductosWidgetProps> = ({
  productos,
  maxItems = 5,
  titulo = 'Top Productos Vendidos'
}) => {
  const formatCurrency = (value: number) => formatCurrencyPEN(value);

  const getMargenColor = (margen: number) => {
    if (margen >= 30) return 'text-emerald-600';
    if (margen >= 15) return 'text-amber-600';
    return 'text-red-600';
  };

  const getPositionBadge = (index: number) => {
    const colors = [
      'bg-yellow-500 text-white', // 1st - gold
      'bg-slate-400 text-white',    // 2nd - silver
      'bg-amber-700 text-white',   // 3rd - bronze
      'bg-slate-200 text-slate-700', // 4th
      'bg-slate-200 text-slate-700'  // 5th
    ];
    return colors[index] || colors[4];
  };

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-emerald-500" />
          {titulo}
        </h3>
        <Badge variant="success">{productos.length} productos</Badge>
      </div>

      {productos.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Package className="h-12 w-12 mx-auto mb-2 text-slate-300" />
          <p className="text-sm">Sin datos de ventas</p>
          <p className="text-xs text-slate-400 mt-1">Realiza ventas para ver estadísticas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {productos.slice(0, maxItems).map((producto, index) => (
            <Link
              key={producto.productoId}
              to={`/productos?id=${producto.productoId}`}
              className="block"
            >
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${getPositionBadge(index)}`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 text-sm truncate">
                      {producto.marca} {producto.nombreComercial}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{producto.sku}</span>
                      <span className="text-slate-300">•</span>
                      <span>{producto.unidadesVendidas} uds vendidas</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-slate-900 text-sm">
                    {formatCurrency(producto.ventasTotalPEN)}
                  </div>
                  <div className={`text-xs flex items-center justify-end ${getMargenColor(producto.margenPromedio)}`}>
                    <ArrowUpRight className="h-3 w-3 mr-0.5" />
                    {producto.margenPromedio.toFixed(1)}% margen
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {productos.length > maxItems && (
            <Link
              to="/reportes/rentabilidad"
              className="block text-center text-sm text-teal-600 hover:text-teal-700 py-2"
            >
              Ver todos los productos →
            </Link>
          )}
        </div>
      )}
    </Card>
  );
};
