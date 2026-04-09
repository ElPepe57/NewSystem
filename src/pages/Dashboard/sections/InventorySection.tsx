import React from 'react';
import { Warehouse, AlertTriangle, Package, Box } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Badge } from '../../../components/common';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';
import { formatCurrencyPEN } from '../../../utils/format';

interface InventorySectionProps {
  valorInventarioPEN: number;
  stockCritico: number;
  productosActivos: number;
  totalProductos: number;
  distribucionInventario: { name: string; value: number; color: string }[];
  resumenInventario: any;
  tipoCambioDelDia: any;
  inventario: any[];
  productos: any[];
}

const fmt = (v: number) => formatCurrencyPEN(v);

export const InventorySection: React.FC<InventorySectionProps> = ({
  valorInventarioPEN,
  stockCritico,
  productosActivos,
  totalProductos,
  distribucionInventario,
  resumenInventario,
  tipoCambioDelDia,
  inventario,
  productos
}) => {
  const totalUnidades = distribucionInventario.reduce((sum, item) => sum + item.value, 0);
  const tcCompra = tipoCambioDelDia?.compra || 0;

  const productosStockCritico = (inventario || [])
    .filter(inv => {
      const producto = productos?.find(p => p.id === inv.productoId);
      return inv.stockCritico || (inv.disponibles > 0 && producto?.stockMinimo && inv.disponibles <= producto.stockMinimo);
    })
    .slice(0, 5);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* KPIs de inventario */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Link to="/inventario">
          <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl p-4 lg:p-5 border border-blue-100 hover:shadow-md transition-shadow h-full">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs lg:text-sm font-medium text-blue-700 truncate">Valor Inventario</p>
                <p className="text-xl lg:text-3xl font-bold text-blue-900 mt-1 leading-tight">
                  {fmt(valorInventarioPEN)}
                </p>
                <p className="text-xs text-blue-600 mt-2">En stock disponible</p>
              </div>
              <Warehouse className="h-10 w-10 lg:h-12 lg:w-12 text-blue-300 flex-shrink-0 opacity-60" />
            </div>
          </div>
        </Link>

        <Link to="/inventario">
          <div className={`rounded-xl p-4 lg:p-5 border hover:shadow-md transition-shadow h-full ${
            stockCritico > 0
              ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'
              : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'
          }`}>
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className={`text-xs lg:text-sm font-medium truncate ${stockCritico > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  Stock Critico
                </p>
                <p className={`text-2xl lg:text-4xl font-bold mt-1 leading-tight ${stockCritico > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                  {stockCritico}
                </p>
                <p className={`text-xs mt-2 ${stockCritico > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {stockCritico > 0 ? 'Bajo minimo' : 'Todo en orden'}
                </p>
              </div>
              <AlertTriangle className={`h-10 w-10 lg:h-12 lg:w-12 flex-shrink-0 opacity-60 ${stockCritico > 0 ? 'text-amber-300' : 'text-green-300'}`} />
            </div>
          </div>
        </Link>

        <Link to="/productos">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 lg:p-5 border border-indigo-100 hover:shadow-md transition-shadow h-full">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs lg:text-sm font-medium text-indigo-700 truncate">Productos Activos</p>
                <p className="text-2xl lg:text-4xl font-bold text-indigo-900 mt-1 leading-tight">
                  {productosActivos}
                </p>
                <p className="text-xs text-indigo-600 mt-2">{totalProductos} total en catalogo</p>
              </div>
              <Package className="h-10 w-10 lg:h-12 lg:w-12 text-indigo-300 flex-shrink-0 opacity-60" />
            </div>
          </div>
        </Link>

        <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 lg:p-5 border border-slate-100 h-full">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-medium text-slate-700 truncate">Total Unidades</p>
              <p className="text-2xl lg:text-4xl font-bold text-slate-900 mt-1 leading-tight">
                {totalUnidades.toLocaleString()}
              </p>
              <p className="text-xs text-slate-600 mt-2">Distribuidas en almacenes</p>
            </div>
            <Box className="h-10 w-10 lg:h-12 lg:w-12 text-slate-300 flex-shrink-0 opacity-60" />
          </div>
        </div>
      </div>

      {/* Gráfico distribución + lista stock crítico */}
      <div className="hidden sm:grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* PieChart distribución */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-blue-500" />
              Distribucion de Inventario
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="h-48">
              {distribucionInventario.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribucionInventario}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {distribucionInventario.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} unidades`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Box className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-xs">Sin inventario</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center space-y-3">
              {distribucionInventario.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-gray-600">{item.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
              {distribucionInventario.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Total</span>
                    <span className="font-bold text-gray-900">{totalUnidades}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Valor Peru</div>
                <div className="font-semibold text-green-700 text-sm">
                  {fmt((resumenInventario?.peru?.valorTotalUSD || 0) * tcCompra)}
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Valor USA</div>
                <div className="font-semibold text-blue-700 text-sm">
                  $ {(resumenInventario?.usa?.valorTotalUSD || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Top 5 stock crítico */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Alertas de Inventario
            </h3>
            <Link to="/inventario" className="text-sm text-primary-600 hover:text-primary-700">
              Ver todo
            </Link>
          </div>

          {productosStockCritico.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No hay productos con stock critico</p>
            </div>
          ) : (
            <div className="space-y-2">
              {productosStockCritico.map(item => {
                const producto = productos?.find(p => p.id === item.productoId);
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">
                        {producto?.marca} {producto?.nombreComercial}
                      </div>
                      <div className="text-xs text-gray-500">
                        {producto?.sku} · {item.almacenNombre}
                      </div>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <Badge variant="warning">{item.disponibles} uds</Badge>
                      <div className="text-xs text-gray-500 mt-1">Min: {producto?.stockMinimo}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
