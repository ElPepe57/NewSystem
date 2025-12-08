import React from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '../../common';
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
              Producto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              SKU
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Clasificación
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Precio
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
          {productos.map((producto) => (
            <tr key={producto.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {producto.marca}
                </div>
                <div className="text-sm text-gray-500">
                  {producto.nombreComercial}
                </div>
                <div className="text-xs text-gray-400">
                  {producto.presentacion}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-mono text-gray-900">{producto.sku}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{producto.clasificacion}</div>
                <div className="text-xs text-gray-500">{producto.subclasificacion}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="text-sm font-semibold text-gray-900">
                  {/* CORRECCIÓN AQUÍ: Protección contra undefined */}
                  S/ {(producto.precioVentaPEN || 0).toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  Margen: {producto.margenObjetivo || 0}%
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <Badge variant={producto.estado === 'activo' ? 'success' : 'default'}>
                  {producto.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </Badge>
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
          ))}
        </tbody>
      </table>
    </div>
  );
};