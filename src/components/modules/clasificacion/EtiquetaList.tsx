import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Tag, Search, Package } from 'lucide-react';
import { Button } from '../../common';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { useEtiquetaStore } from '../../../store/etiquetaStore';
import { useAuthStore } from '../../../store/authStore';
import { EtiquetaForm } from './EtiquetaForm';
import type { Etiqueta, TipoEtiqueta } from '../../../types/etiqueta.types';

const TIPO_LABELS: Record<TipoEtiqueta, { label: string; color: string }> = {
  atributo: { label: 'Atributos', color: 'bg-green-100 text-green-700' },
  marketing: { label: 'Marketing', color: 'bg-yellow-100 text-yellow-700' },
  origen: { label: 'Origen', color: 'bg-blue-100 text-blue-700' }
};

const TIPO_ORDER: TipoEtiqueta[] = ['atributo', 'marketing', 'origen'];

export function EtiquetaList() {
  const { user } = useAuthStore();
  const { etiquetasAgrupadas, fetchEtiquetasAgrupadas, remove, loading } = useEtiquetaStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEtiqueta, setEditingEtiqueta] = useState<Etiqueta | null>(null);
  const [tipoParaNueva, setTipoParaNueva] = useState<TipoEtiqueta>('atributo');
  const [deletingEtiqueta, setDeletingEtiqueta] = useState<Etiqueta | null>(null);

  useEffect(() => {
    fetchEtiquetasAgrupadas();
  }, []);

  const handleAddEtiqueta = (tipo: TipoEtiqueta) => {
    setTipoParaNueva(tipo);
    setEditingEtiqueta(null);
    setShowForm(true);
  };

  const handleEdit = (etiqueta: Etiqueta) => {
    setEditingEtiqueta(etiqueta);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deletingEtiqueta || !user) return;
    try {
      await remove(deletingEtiqueta.id, user.uid);
      setDeletingEtiqueta(null);
    } catch (err) {
      // Error manejado por store
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingEtiqueta(null);
  };

  const handleFormSuccess = () => {
    fetchEtiquetasAgrupadas();
  };

  // Filtrar por busqueda
  const filtrarEtiquetas = (etiquetas: Etiqueta[]) => {
    if (!searchTerm) return etiquetas;
    const term = searchTerm.toLowerCase();
    return etiquetas.filter(e =>
      e.nombre.toLowerCase().includes(term) ||
      e.codigo.toLowerCase().includes(term)
    );
  };

  // Contar total de etiquetas
  const totalEtiquetas = etiquetasAgrupadas
    ? Object.values(etiquetasAgrupadas).reduce((sum, arr) => sum + arr.length, 0)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Etiquetas</h3>
          <span className="text-sm text-gray-500">({totalEtiquetas})</span>
        </div>
        <Button onClick={() => handleAddEtiqueta('atributo')} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nueva Etiqueta
        </Button>
      </div>

      {/* Busqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar etiqueta..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Lista agrupada por tipo */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Cargando...</div>
      ) : !etiquetasAgrupadas ? (
        <div className="text-center py-8 text-gray-500">No hay etiquetas creadas</div>
      ) : (
        <div className="space-y-4">
          {TIPO_ORDER.map(tipo => {
            const etiquetasDelTipo = filtrarEtiquetas(etiquetasAgrupadas[tipo] || []);
            if (etiquetasDelTipo.length === 0 && searchTerm) return null;

            return (
              <div key={tipo} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Header del tipo */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIPO_LABELS[tipo].color}`}>
                      {TIPO_LABELS[tipo].label}
                    </span>
                    <span className="text-sm text-gray-500">({etiquetasDelTipo.length})</span>
                  </div>
                  <button
                    onClick={() => handleAddEtiqueta(tipo)}
                    className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Agregar
                  </button>
                </div>

                {/* Lista de etiquetas */}
                {etiquetasDelTipo.length === 0 ? (
                  <div className="px-4 py-6 text-center text-gray-400 text-sm">
                    No hay etiquetas de {TIPO_LABELS[tipo].label.toLowerCase()}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {etiquetasDelTipo.map(etiqueta => (
                      <div
                        key={etiqueta.id}
                        className="flex items-center justify-between px-4 py-2 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-gray-400">{etiqueta.codigo}</span>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm"
                            style={{
                              backgroundColor: etiqueta.colorFondo || '#F3F4F6',
                              color: etiqueta.colorTexto || '#4B5563',
                              border: `1px solid ${etiqueta.colorBorde || '#D1D5DB'}`
                            }}
                          >
                            {etiqueta.icono && <span>{etiqueta.icono}</span>}
                            {etiqueta.nombre}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Package className="h-4 w-4" />
                            <span>{etiqueta.metricas?.productosActivos || 0}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEdit(etiqueta)}
                              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingEtiqueta(etiqueta)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      <EtiquetaForm
        isOpen={showForm}
        onClose={handleFormClose}
        etiqueta={editingEtiqueta}
        tipoInicial={tipoParaNueva}
        onSuccess={handleFormSuccess}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!deletingEtiqueta}
        onClose={() => setDeletingEtiqueta(null)}
        onConfirm={handleDelete}
        title="Eliminar Etiqueta"
        message={`¿Estas seguro de eliminar "${deletingEtiqueta?.nombre}"? Los productos que la usan mantendran la referencia pero no aparecera en nuevas asignaciones.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
}
