import React from 'react';
import { Eye, Pencil, Trash2, Search, CheckCircle, XCircle, Clock, HelpCircle, DollarSign, Tag, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Badge } from '../../common';
import { ProductoService } from '../../../services/producto.service';
import type { Producto } from '../../../types/producto.types';
import type { CategoriaSnapshot } from '../../../types/categoria.types';
import type { EtiquetaSnapshot } from '../../../types/etiqueta.types';

// Tipo para configuración de ordenamiento múltiple
export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface ProductoTableProps {
  productos: Producto[];
  onView: (producto: Producto) => void;
  onEdit: (producto: Producto) => void;
  onDelete: (producto: Producto) => void;
  sortConfigs?: SortConfig[];
  onSort?: (key: string) => void;
}

// Componente para encabezado ordenable
const SortableHeader: React.FC<{
  label: string;
  sortKey: string;
  sortConfigs: SortConfig[];
  onSort: (key: string) => void;
  align?: 'left' | 'center' | 'right';
}> = ({ label, sortKey, sortConfigs, onSort, align = 'left' }) => {
  const sortIndex = sortConfigs.findIndex(s => s.key === sortKey);
  const currentSort = sortIndex >= 0 ? sortConfigs[sortIndex] : null;
  const sortOrder = sortIndex >= 0 ? sortIndex + 1 : null;

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };

  return (
    <th
      className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors select-none ${alignClasses[align]}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1.5 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : ''}`}>
        <span>{label}</span>
        <div className="flex items-center">
          {currentSort ? (
            <span className="flex items-center">
              {currentSort.direction === 'asc' ? (
                <ArrowUp className="h-3.5 w-3.5 text-primary-600" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5 text-primary-600" />
              )}
              {sortConfigs.length > 1 && (
                <span className="ml-0.5 text-[10px] bg-primary-100 text-primary-700 rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {sortOrder}
                </span>
              )}
            </span>
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 text-gray-300" />
          )}
        </div>
      </div>
    </th>
  );
};

export const ProductoTable: React.FC<ProductoTableProps> = ({
  productos,
  onView,
  onEdit,
  onDelete,
  sortConfigs = [],
  onSort
}) => {
  if (productos.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">No hay productos registrados</p>
      </div>
    );
  }

  const handleSort = (key: string) => {
    if (onSort) {
      onSort(key);
    }
  };

  return (
    <div className="overflow-x-auto">
      {/* Indicador de ordenamiento activo */}
      {sortConfigs.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-sm">
          <span className="text-gray-500">Ordenado por:</span>
          <div className="flex items-center gap-2">
            {sortConfigs.map((sort, index) => (
              <span key={sort.key} className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 px-2 py-0.5 rounded text-xs font-medium">
                <span className="bg-primary-200 text-primary-800 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                  {index + 1}
                </span>
                {sort.key === 'sku' && 'SKU'}
                {sort.key === 'marca' && 'Marca'}
                {sort.key === 'nombreComercial' && 'Nombre'}
                {sort.key === 'precioSugerido' && 'Precio'}
                {sort.key === 'stockPeru' && 'Stock'}
                {sort.key === 'estado' && 'Estado'}
                {sort.key === 'margenEstimado' && 'Margen'}
                {sort.key === 'roi' && 'ROI'}
                {sort.direction === 'asc' ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )}
              </span>
            ))}
          </div>
          <span className="text-xs text-gray-400 ml-2">(Ctrl+Click para multiorden)</span>
        </div>
      )}

      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {onSort ? (
              <>
                <SortableHeader label="SKU" sortKey="sku" sortConfigs={sortConfigs} onSort={handleSort} />
                <SortableHeader label="Producto" sortKey="marca" sortConfigs={sortConfigs} onSort={handleSort} />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tipo / Categorías
                </th>
                <SortableHeader label="Precios" sortKey="precioSugerido" sortConfigs={sortConfigs} onSort={handleSort} align="center" />
                <SortableHeader label="Investigación" sortKey="roi" sortConfigs={sortConfigs} onSort={handleSort} align="center" />
                <SortableHeader label="Estado" sortKey="estado" sortConfigs={sortConfigs} onSort={handleSort} />
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </>
            ) : (
              <>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo / Categorías</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Precios</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Investigación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {productos.map((producto) => {
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
                <td className="px-6 py-4">
                  {/* Tipo de Producto */}
                  {producto.tipoProducto ? (
                    <div className="flex items-center gap-1 mb-1">
                      <Tag className="h-3 w-3 text-blue-500" />
                      <span className="text-sm font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {producto.tipoProducto.nombre}
                      </span>
                    </div>
                  ) : producto.subgrupo ? (
                    <div className="text-xs text-gray-500 mb-1">{producto.subgrupo}</div>
                  ) : null}

                  {/* Categorias */}
                  {producto.categorias && producto.categorias.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {producto.categorias.slice(0, 2).map((cat: CategoriaSnapshot) => (
                        <span
                          key={cat.categoriaId}
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            cat.categoriaId === producto.categoriaPrincipalId
                              ? 'bg-primary-100 text-primary-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {cat.nombre}
                        </span>
                      ))}
                      {producto.categorias.length > 2 && (
                        <span className="text-xs text-gray-400">
                          +{producto.categorias.length - 2}
                        </span>
                      )}
                    </div>
                  ) : producto.grupo ? (
                    <div className="text-xs text-gray-500">{producto.grupo}</div>
                  ) : (
                    <span className="text-xs text-gray-400">Sin clasificar</span>
                  )}

                  {/* Etiquetas */}
                  {producto.etiquetasData && producto.etiquetasData.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {producto.etiquetasData.slice(0, 3).map((etq: EtiquetaSnapshot) => (
                        <span
                          key={etq.etiquetaId}
                          className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: etq.colorFondo || '#F3F4F6',
                            color: etq.colorTexto || '#4B5563',
                            fontSize: '10px'
                          }}
                        >
                          {etq.icono && <span className="mr-0.5">{etq.icono}</span>}
                          {etq.nombre}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {producto.precioSugerido > 0 ? (
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        S/ {producto.precioSugerido.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">PVP Sugerido</div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Sin precio
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
