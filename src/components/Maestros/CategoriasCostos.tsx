import React, { useEffect, useState } from 'react';
import { ChevronRight, Plus, Edit2, FolderTree } from 'lucide-react';
import { useCategoriaCostoStore } from '../../store/categoriaCostoStore';
import { useAuthStore } from '../../store/authStore';
import { Card, Button, Badge } from '../common';
import type { BloqueCosto, CategoriaCosto } from '../../types/categoriaCosto.types';

const BLOQUE_CONFIG: Record<BloqueCosto, { nombre: string; color: string; descripcion: string }> = {
  producto: {
    nombre: 'Producto',
    color: 'blue',
    descripcion: 'Costos directos del producto \u00b7 landed en env\u00edos (flete, aranceles, seguros) \u00b7 IMPACTA CTRU',
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
  const [bloqueActivo, setBloqueActivo] = useState<BloqueCosto>('producto');

  useEffect(() => {
    fetchArbol();
  }, [fetchArbol]);

  if (loading && categorias.length === 0) {
    return <div className="text-center py-8 text-slate-500">Cargando categor\u00edas...</div>;
  }

  const bloques: BloqueCosto[] = ['producto', 'venta', 'periodo'];
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
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {config.nombre} ({count})
            </button>
          );
        })}
      </div>

      {/* Descripcion del bloque */}
      <div className="text-sm text-slate-500 px-1">
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
                    <FolderTree className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-slate-900">{padre.nombre}</span>
                    <Badge variant="outline" className="text-xs">
                      {padre.codigo}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-400">
                    {hijos.length} sub-categor\u00edas
                  </span>
                </div>

                {hijos.length > 0 && (
                  <div className="mt-2 ml-6 space-y-1">
                    {hijos.map(hijo => (
                      <div
                        key={hijo.id}
                        className="flex items-center gap-2 text-sm text-slate-600 py-1"
                      >
                        <ChevronRight className="h-3 w-3 text-slate-300" />
                        <span>{hijo.nombre}</span>
                        <span className="text-xs text-slate-400">{hijo.codigo}</span>
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
      <div className="text-xs text-slate-400 text-center pt-2">
        {categorias.length} categor\u00edas en 3 bloques
      </div>
    </div>
  );
};
