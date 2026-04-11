import React, { useEffect, useState } from 'react';
import { ChevronRight, Plus, Edit2, FolderTree } from 'lucide-react';
import { useCategoriaCostoStore } from '../../store/categoriaCostoStore';
import { useAuthStore } from '../../store/authStore';
import { Card, Button, Badge } from '../common';
import type { BloqueCosto, CategoriaCosto } from '../../types/categoriaCosto.types';

const BLOQUE_CONFIG: Record<BloqueCosto, { nombre: string; color: string; descripcion: string }> = {
  importacion: {
    nombre: 'Importaci\u00f3n',
    color: 'blue',
    descripcion: 'Costos landed en env\u00edos (flete, aranceles, seguros)',
  },
  venta: {
    nombre: 'Venta',
    color: 'purple',
    descripcion: 'Costos directos por cada venta (comisiones, delivery, empaque)',
  },
  periodo: {
    nombre: 'Per\u00edodo',
    color: 'amber',
    descripcion: 'Gastos fijos del mes (personal, local, servicios)',
  },
};

export const CategoriasCostos: React.FC = () => {
  const { categorias, arbol, loading, fetchArbol } = useCategoriaCostoStore();
  const [bloqueActivo, setBloqueActivo] = useState<BloqueCosto>('importacion');

  useEffect(() => {
    fetchArbol();
  }, [fetchArbol]);

  if (loading && categorias.length === 0) {
    return <div className="text-center py-8 text-gray-500">Cargando categor\u00edas...</div>;
  }

  const bloques: BloqueCosto[] = ['importacion', 'venta', 'periodo'];
  const datosBloque = arbol?.[bloqueActivo];

  return (
    <div className="space-y-4">
      {/* Tabs de bloques */}
      <div className="flex gap-2">
        {bloques.map(bloque => {
          const config = BLOQUE_CONFIG[bloque];
          const count = categorias.filter(c => c.bloque === bloque).length;
          return (
            <button
              key={bloque}
              onClick={() => setBloqueActivo(bloque)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                bloqueActivo === bloque
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {config.nombre} ({count})
            </button>
          );
        })}
      </div>

      {/* Descripcion del bloque */}
      <div className="text-sm text-gray-500 px-1">
        {BLOQUE_CONFIG[bloqueActivo].descripcion}
      </div>

      {/* Arbol de categorias */}
      {datosBloque && (
        <div className="space-y-2">
          {datosBloque.padres.map(padre => {
            const hijos = datosBloque.hijos[padre.id] || [];
            return (
              <Card key={padre.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderTree className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{padre.nombre}</span>
                    <Badge variant="outline" className="text-xs">
                      {padre.codigo}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-400">
                    {hijos.length} sub-categor\u00edas
                  </span>
                </div>

                {hijos.length > 0 && (
                  <div className="mt-2 ml-6 space-y-1">
                    {hijos.map(hijo => (
                      <div
                        key={hijo.id}
                        className="flex items-center gap-2 text-sm text-gray-600 py-1"
                      >
                        <ChevronRight className="h-3 w-3 text-gray-300" />
                        <span>{hijo.nombre}</span>
                        <span className="text-xs text-gray-400">{hijo.codigo}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Resumen */}
      <div className="text-xs text-gray-400 text-center pt-2">
        {categorias.length} categor\u00edas en 3 bloques
      </div>
    </div>
  );
};
