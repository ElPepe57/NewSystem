import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button, Badge } from '../../common';
import type { Producto } from '../../../types/producto.types';

interface ProductoCardProps {
  producto: Producto;
  onEdit: () => void;
  onDelete: () => void;
}

export const ProductoCard: React.FC<ProductoCardProps> = ({ producto, onEdit, onDelete }) => (
  <div className="p-6 space-y-6">
    <div className="flex justify-between items-start">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {producto.marca} {producto.nombreComercial}
        </h2>
        <p className="text-gray-600 mt-1">{producto.presentacion}</p>
        <div className="flex items-center space-x-2 mt-2">
          <span className="text-sm font-mono text-gray-500">{producto.sku}</span>
          <Badge variant={producto.estado === 'activo' ? 'success' : 'default'}>
            {producto.estado === 'activo' ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-1" />
          Editar
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-1" />
          Eliminar
        </Button>
      </div>
    </div>

    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
      <div>
        <span className="text-xs text-gray-500 block">Clasificación</span>
        <p className="font-medium text-gray-900">{producto.clasificacion}</p>
      </div>
      <div>
        <span className="text-xs text-gray-500 block">Precio de Venta</span>
        {/* CORRECCIÓN AQUÍ: Protección con ( || 0 ) */}
        <p className="text-lg font-bold text-primary-600">S/ {(producto.precioVentaPEN || 0).toFixed(2)}</p>
      </div>
      <div>
        <span className="text-xs text-gray-500 block">Margen Objetivo</span>
        <p className="text-lg font-bold text-success-600">{producto.margenObjetivo}%</p>
      </div>
      <div>
        <span className="text-xs text-gray-500 block">Stock Mínimo</span>
        <p className="font-medium text-gray-900">{producto.stockMinimo || 0} unidades</p>
      </div>
    </div>

    <div className="border-t pt-4">
      <p className="text-sm text-gray-600">
        Creado: {producto.fechaCreacion?.toDate().toLocaleDateString('es-PE') || '-'}
      </p>
    </div>
  </div>
);