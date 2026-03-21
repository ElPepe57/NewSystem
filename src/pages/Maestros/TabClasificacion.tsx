import React from 'react';
import { TipoProductoList, CategoriaList, EtiquetaList } from '../../components/modules/clasificacion';

export const TabClasificacion: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-indigo-900 mb-2">
          Sistema de Clasificacion de Productos
        </h3>
        <p className="text-sm text-indigo-700">
          Gestiona los tipos de producto, categorias y etiquetas para organizar tu catalogo de manera flexible.
          Los productos pueden tener multiples categorias y etiquetas para mejor filtrado y SEO.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <TipoProductoList />
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <CategoriaList />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <EtiquetaList />
      </div>
    </div>
  );
};
