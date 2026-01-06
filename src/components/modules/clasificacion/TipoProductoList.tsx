import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, FlaskConical, Search, Package, BarChart3 } from 'lucide-react';
import { Button } from '../../common';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { useTipoProductoStore } from '../../../store/tipoProductoStore';
import { useAuthStore } from '../../../store/authStore';
import { TipoProductoForm } from './TipoProductoForm';
import { TipoProductoDetalle } from './TipoProductoDetalle';
import type { TipoProducto } from '../../../types/tipoProducto.types';

export function TipoProductoList() {
  const { user } = useAuthStore();
  const { tiposActivos, fetchTiposActivos, remove, loading } = useTipoProductoStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoProducto | null>(null);
  const [deletingTipo, setDeletingTipo] = useState<TipoProducto | null>(null);
  const [viewingTipo, setViewingTipo] = useState<TipoProducto | null>(null);

  useEffect(() => {
    fetchTiposActivos();
  }, []);

  const handleEdit = (tipo: TipoProducto) => {
    setEditingTipo(tipo);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deletingTipo || !user) return;
    try {
      await remove(deletingTipo.id, user.uid);
      setDeletingTipo(null);
    } catch (err) {
      // Error manejado por store
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTipo(null);
  };

  const handleFormSuccess = () => {
    fetchTiposActivos();
  };

  // Filtrar por busqueda
  const tiposFiltrados = tiposActivos.filter(tipo => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      tipo.nombre.toLowerCase().includes(term) ||
      tipo.codigo.toLowerCase().includes(term) ||
      tipo.alias?.some(a => a.toLowerCase().includes(term)) ||
      tipo.principioActivo?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Tipos de Producto</h3>
          <span className="text-sm text-gray-500">({tiposActivos.length})</span>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nuevo Tipo
        </Button>
      </div>

      {/* Busqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar tipo..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Cargando...</div>
      ) : tiposFiltrados.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {searchTerm ? 'No se encontraron tipos' : 'No hay tipos de producto creados'}
        </div>
      ) : (
        <div className="space-y-2">
          {tiposFiltrados.map(tipo => (
            <div
              key={tipo.id}
              className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-primary-200 transition-colors cursor-pointer"
              onClick={() => setViewingTipo(tipo)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400">{tipo.codigo}</span>
                  <span className="font-medium text-gray-900">{tipo.nombre}</span>
                </div>
                {tipo.alias && tipo.alias.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tipo.alias.map(alias => (
                      <span key={alias} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                        {alias}
                      </span>
                    ))}
                  </div>
                )}
                {tipo.principioActivo && (
                  <div className="text-xs text-gray-500 mt-1">
                    Principio activo: {tipo.principioActivo}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                {/* Metricas */}
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Package className="h-4 w-4" />
                  <span>{tipo.metricas?.productosActivos || 0}</span>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setViewingTipo(tipo)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Ver Analytics"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(tipo)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeletingTipo(tipo)}
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

      {/* Form Modal */}
      <TipoProductoForm
        isOpen={showForm}
        onClose={handleFormClose}
        tipoProducto={editingTipo}
        onSuccess={handleFormSuccess}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!deletingTipo}
        onClose={() => setDeletingTipo(null)}
        onConfirm={handleDelete}
        title="Eliminar Tipo de Producto"
        message={`¿Estas seguro de eliminar "${deletingTipo?.nombre}"? Los productos asociados mantendran el tipo pero no podras asignarlo a nuevos productos.`}
        confirmText="Eliminar"
        variant="danger"
      />

      {/* Modal de Detalle con Analytics */}
      <TipoProductoDetalle
        isOpen={!!viewingTipo}
        onClose={() => setViewingTipo(null)}
        tipoProducto={viewingTipo}
      />
    </div>
  );
}
