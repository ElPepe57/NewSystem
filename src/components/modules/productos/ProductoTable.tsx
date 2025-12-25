import React from 'react';
import { Eye, Pencil, Trash2, AlertTriangle, Search, CheckCircle, XCircle, Clock, HelpCircle } from 'lucide-react';
import { Badge } from '../../common';
import { ProductoService } from '../../../services/producto.service';
import type { Producto } from '../../../types/producto.types';

interface ProductoTableProps {
  productos: Producto[];
  onView: (producto: Producto) => void;
  onEdit: (producto: Producto) => void;
  onDelete: (producto: Producto) => void;
}

export const ProductoTable: React.FC<ProductoTableProps> = ({
  productos,
  onView,
  onEdit,
  onDelete
}) => {
  if (productos.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">No hay productos registrados</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              SKU
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Producto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Grupo/Subgrupo
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
              Stock Perú
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
              Stock USA
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              CTRU
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
              Investigación
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Estado
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {productos.map((producto) => {
            const stockCritico = producto.stockPeru <= producto.stockMinimo;
            const invResumen = ProductoService.getResumenInvestigacion(producto);

            return (
              <tr key={producto.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-mono font-semibold text-gray-900">
                    {producto.sku}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {producto.marca}
                  </div>
                  <div className="text-sm text-gray-600">
                    {producto.nombreComercial}
                  </div>
                  <div className="text-xs text-gray-400">
                    {producto.dosaje && `${producto.dosaje} · `}
                    {producto.contenido}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{producto.grupo}</div>
                  {producto.subgrupo && (
                    <div className="text-xs text-gray-500">{producto.subgrupo}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className={`text-sm font-semibold ${stockCritico ? 'text-red-600' : 'text-gray-900'}`}>
                    {producto.stockPeru}
                  </div>
                  {stockCritico && (
                    <div className="flex items-center justify-center mt-1">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="text-sm text-gray-900">{producto.stockUSA}</div>
                  {producto.stockTransito > 0 && (
                    <div className="text-xs text-blue-600">+{producto.stockTransito} tráns.</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    S/ {(producto.ctruPromedio || 0).toFixed(2)}
                  </div>
                  {producto.precioSugerido > 0 && (
                    <div className="text-xs text-gray-500">
                      PVP: S/ {producto.precioSugerido.toFixed(2)}
                    </div>
                  )}
                </td>
                {/* Columna de Investigación */}
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {invResumen.tieneInvestigacion ? (
                    (() => {
                      const inv = producto.investigacion;
                      const precioVenta = inv?.precioEntrada || inv?.precioPERUPromedio || 0;
                      const roi = inv && inv.ctruEstimado > 0 && precioVenta > 0
                        ? ((precioVenta - inv.ctruEstimado) / inv.ctruEstimado) * 100
                        : 0;
                      const multiplicador = inv && inv.ctruEstimado > 0 && precioVenta > 0
                        ? precioVenta / inv.ctruEstimado
                        : 0;

                      return (
                        <div className="flex flex-col items-center gap-1">
                          {/* Badge de recomendación */}
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            inv?.recomendacion === 'importar'
                              ? 'bg-green-100 text-green-800'
                              : inv?.recomendacion === 'descartar'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {inv?.recomendacion === 'importar' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {inv?.recomendacion === 'descartar' && <XCircle className="h-3 w-3 mr-1" />}
                            {inv?.recomendacion === 'investigar_mas' && <Search className="h-3 w-3 mr-1" />}
                            {inv?.recomendacion === 'importar' ? 'Importar' :
                             inv?.recomendacion === 'descartar' ? 'Descartar' : 'Revisar'}
                          </div>
                          {/* Vigencia */}
                          <div className={`text-xs flex items-center ${invResumen.estaVigente ? 'text-green-600' : 'text-red-600'}`}>
                            <Clock className="h-3 w-3 mr-1" />
                            {invResumen.estaVigente ? `${invResumen.diasRestantes}d` : 'Vencida'}
                          </div>
                          {/* ROI y Multiplicador */}
                          {roi > 0 && (
                            <div className={`text-xs font-bold ${roi > 50 ? 'text-green-600' : roi > 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                              ROI {roi.toFixed(0)}% · {multiplicador.toFixed(1)}x
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <HelpCircle className="h-5 w-5" />
                      <span className="text-xs mt-1">Sin inv.</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={producto.estado === 'activo' ? 'success' : 'default'}>
                    {producto.estado === 'activo' ? 'Activo' : producto.estado === 'inactivo' ? 'Inactivo' : 'Descontinuado'}
                  </Badge>
                  {producto.habilitadoML && (
                    <div className="mt-1">
                      <Badge variant="info" className="text-xs">ML</Badge>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onView(producto)}
                      className="text-primary-600 hover:text-primary-900"
                      title="Ver detalles"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onEdit(producto)}
                      className="text-warning-600 hover:text-warning-900"
                      title="Editar"
                    >
                      <Pencil className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onDelete(producto)}
                      className="text-danger-600 hover:text-danger-900"
                      title="Eliminar"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};