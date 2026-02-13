import React, { useEffect, useState } from 'react';
import {
  Tag,
  Package,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  BarChart3,
  Percent,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { Button, Badge, Modal } from '../../common';
import { clasificacionAnalyticsService, type ClasificacionAnalyticsResult } from '../../../services/clasificacion.analytics.service';
import type { Etiqueta } from '../../../types/etiqueta.types';

interface EtiquetaDetalleProps {
  isOpen: boolean;
  onClose: () => void;
  etiqueta: Etiqueta | null;
}

type PeriodoFiltro = '1m' | '3m' | '6m' | '12m';

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  atributo: { label: 'Atributo', color: 'bg-green-100 text-green-700' },
  marketing: { label: 'Marketing', color: 'bg-yellow-100 text-yellow-700' },
  origen: { label: 'Origen', color: 'bg-blue-100 text-blue-700' }
};

export function EtiquetaDetalle({ isOpen, onClose, etiqueta }: EtiquetaDetalleProps) {
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<ClasificacionAnalyticsResult | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('3m');

  useEffect(() => {
    if (isOpen && etiqueta) {
      cargarAnalytics();
    }
  }, [isOpen, etiqueta, periodo]);

  const cargarAnalytics = async () => {
    if (!etiqueta) return;

    setLoading(true);
    try {
      const ahora = new Date();
      let fechaInicio: Date;

      switch (periodo) {
        case '1m':
          fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
          break;
        case '3m':
          fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth() - 3, 1);
          break;
        case '6m':
          fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth() - 6, 1);
          break;
        case '12m':
          fechaInicio = new Date(ahora.getFullYear() - 1, ahora.getMonth(), 1);
          break;
      }

      const result = await clasificacionAnalyticsService.getAnalyticsEtiqueta(
        etiqueta.id,
        fechaInicio,
        ahora
      );
      setAnalytics(result);
    } catch (error) {
      console.error('Error cargando analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!etiqueta) return null;

  const m = analytics?.metricas;
  const tipoInfo = TIPO_LABELS[etiqueta.tipo] || TIPO_LABELS.atributo;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="xl"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-lg text-2xl flex items-center justify-center"
              style={{
                backgroundColor: etiqueta.colorFondo || '#F3F4F6',
                border: `1px solid ${etiqueta.colorBorde || '#D1D5DB'}`
              }}
            >
              {etiqueta.icono || <Tag className="h-6 w-6" style={{ color: etiqueta.colorTexto || '#4B5563' }} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400">{etiqueta.codigo}</span>
                <Badge variant={etiqueta.estado === 'activa' ? 'success' : 'default'}>
                  {etiqueta.estado}
                </Badge>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${tipoInfo.color}`}>
                  {tipoInfo.label}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{etiqueta.nombre}</h2>
              {etiqueta.grupo && (
                <p className="text-sm text-gray-500">Grupo: {etiqueta.grupo}</p>
              )}
            </div>
          </div>

          {/* Selector de periodo */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as PeriodoFiltro)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1"
            >
              <option value="1m">Ultimo mes</option>
              <option value="3m">Ultimos 3 meses</option>
              <option value="6m">Ultimos 6 meses</option>
              <option value="12m">Ultimo ano</option>
            </select>
            <Button variant="ghost" size="sm" onClick={cargarAnalytics} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : analytics && m ? (
          <>
            {/* KPIs principales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-teal-600 mb-1">
                  <Package className="h-4 w-4" />
                  <span className="text-xs font-medium">Productos</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{m.totalProductos}</p>
                <p className="text-xs text-gray-500">{m.productosActivos} activos</p>
              </div>

              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-cyan-600 mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs font-medium">Ventas</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">S/ {m.ventasTotalPEN.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-gray-500">{m.numeroVentas} transacciones</p>
              </div>

              <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-pink-600 mb-1">
                  <Percent className="h-4 w-4" />
                  <span className="text-xs font-medium">Margen</span>
                </div>
                <p className={`text-2xl font-bold ${m.margenPromedio >= 30 ? 'text-green-600' : m.margenPromedio >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {m.margenPromedio.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">Utilidad: S/ {m.utilidadBruta.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>

              <div className="bg-gradient-to-br from-lime-50 to-lime-100 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-lime-600 mb-1">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="text-xs font-medium">Unidades</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{m.unidadesVendidas}</p>
                <p className="text-xs text-gray-500">Ticket: S/ {m.ticketPromedio.toFixed(2)}</p>
              </div>
            </div>

            {/* Participacion y Stock */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Participacion */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Participacion en el Negocio
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">% de Ventas Totales</span>
                      <span className="font-medium">{m.participacionVentas.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.min(m.participacionVentas, 100)}%`,
                          backgroundColor: etiqueta.colorTexto || '#14B8A6'
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">% de Unidades Vendidas</span>
                      <span className="font-medium">{m.participacionUnidades.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full opacity-70"
                        style={{
                          width: `${Math.min(m.participacionUnidades, 100)}%`,
                          backgroundColor: etiqueta.colorTexto || '#06B6D4'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stock */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Inventario
                </h3>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <p className="text-xs text-gray-500">Peru</p>
                    <p className="text-lg font-bold text-gray-900">{m.stockPeru}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <p className="text-xs text-gray-500">USA</p>
                    <p className="text-lg font-bold text-gray-900">{m.stockUSA}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <p className="text-xs text-gray-500">Transito</p>
                    <p className="text-lg font-bold text-blue-600">{m.stockTransito}</p>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Valor del inventario:</span>
                  <span className="font-medium">S/ {m.valorInventario.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                {(m.productosStockCritico > 0 || m.productosAgotados > 0) && (
                  <div className="mt-2 flex gap-2">
                    {m.productosStockCritico > 0 && (
                      <Badge variant="warning">{m.productosStockCritico} stock critico</Badge>
                    )}
                    {m.productosAgotados > 0 && (
                      <Badge variant="danger">{m.productosAgotados} agotados</Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Productos destacados */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {m.productoMasVendido && m.productoMasVendido.unidades > 0 && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                  <p className="text-xs text-teal-600 font-medium mb-1">Mas Vendido</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{m.productoMasVendido.nombre}</p>
                  <p className="text-xs text-gray-500">{m.productoMasVendido.unidades} unidades</p>
                </div>
              )}
              {m.productoMasRentable && (
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                  <p className="text-xs text-pink-600 font-medium mb-1">Mas Rentable</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{m.productoMasRentable.nombre}</p>
                  <p className="text-xs text-gray-500">{m.productoMasRentable.margen.toFixed(1)}% margen</p>
                </div>
              )}
              {m.productoMenosStock && (
                <div className="bg-lime-50 border border-lime-200 rounded-lg p-3">
                  <p className="text-xs text-lime-600 font-medium mb-1">Menor Stock</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{m.productoMenosStock.nombre}</p>
                  <p className="text-xs text-gray-500">{m.productoMenosStock.stock} unidades</p>
                </div>
              )}
            </div>

            {/* Tabla de productos */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <h3 className="text-sm font-semibold text-gray-700">
                  Productos con esta etiqueta ({analytics.productos.length})
                </h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Producto</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">Stock</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">Vendidos</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">Ventas</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">Margen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {analytics.productos.map(prod => (
                      <tr key={prod.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{prod.marca}</span>
                            <span className="text-gray-500">{prod.nombreComercial}</span>
                            {prod.estado !== 'activo' && (
                              <Badge variant="default" className="text-xs">{prod.estado}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">{prod.sku}</div>
                        </td>
                        <td className="text-right px-4 py-2">
                          <span className={prod.stockPeru <= 0 ? 'text-red-600 font-medium' : ''}>
                            {prod.stockPeru}
                          </span>
                        </td>
                        <td className="text-right px-4 py-2">{prod.unidadesVendidas}</td>
                        <td className="text-right px-4 py-2">S/ {prod.ventasPEN.toFixed(0)}</td>
                        <td className="text-right px-4 py-2">
                          <span className={`font-medium ${prod.margen >= 30 ? 'text-green-600' : prod.margen >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {prod.margen.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tendencia */}
            {analytics.tendenciaVentas.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Tendencia de Ventas (por semana)
                </h3>
                <div className="flex items-end gap-1 h-24">
                  {analytics.tendenciaVentas.slice(-12).map((semana, idx) => {
                    const maxVentas = Math.max(...analytics.tendenciaVentas.map(s => s.ventas));
                    const altura = maxVentas > 0 ? (semana.ventas / maxVentas) * 100 : 0;
                    return (
                      <div
                        key={idx}
                        className="flex-1 rounded-t hover:opacity-80 transition-opacity cursor-pointer group relative"
                        style={{
                          height: `${Math.max(altura, 2)}%`,
                          backgroundColor: etiqueta.colorTexto || '#14B8A6'
                        }}
                        title={`${semana.fecha}: S/ ${semana.ventas.toFixed(0)} (${semana.unidades} uds)`}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          S/ {semana.ventas.toFixed(0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{analytics.tendenciaVentas[Math.max(0, analytics.tendenciaVentas.length - 12)]?.fecha}</span>
                  <span>{analytics.tendenciaVentas[analytics.tendenciaVentas.length - 1]?.fecha}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No hay datos disponibles para esta etiqueta
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
