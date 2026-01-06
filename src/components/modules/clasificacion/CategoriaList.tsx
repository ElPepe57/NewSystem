import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, FolderTree, Search, ChevronRight, Package, Globe, BarChart3 } from 'lucide-react';
import { Button } from '../../common';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { useCategoriaStore } from '../../../store/categoriaStore';
import { useAuthStore } from '../../../store/authStore';
import { CategoriaForm } from './CategoriaForm';
import { CategoriaDetalle } from './CategoriaDetalle';
import type { Categoria, CategoriaArbol } from '../../../types/categoria.types';

export function CategoriaList() {
  const { user } = useAuthStore();
  const { arbol, fetchArbol, remove, loading } = useCategoriaStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [categoriaPadreId, setCategoriaPadreId] = useState<string | undefined>();
  const [deletingCategoria, setDeletingCategoria] = useState<Categoria | null>(null);
  const [viewingCategoria, setViewingCategoria] = useState<Categoria | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchArbol();
  }, []);

  const handleAddSubcategoria = (padreId: string) => {
    setCategoriaPadreId(padreId);
    setEditingCategoria(null);
    setShowForm(true);
  };

  const handleEdit = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    setCategoriaPadreId(undefined);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deletingCategoria || !user) return;
    try {
      await remove(deletingCategoria.id, user.uid);
      setDeletingCategoria(null);
    } catch (err) {
      // Error manejado por store
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingCategoria(null);
    setCategoriaPadreId(undefined);
  };

  const handleFormSuccess = () => {
    fetchArbol();
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  // Filtrar por busqueda
  const arbolFiltrado = searchTerm
    ? arbol.filter(padre => {
        const term = searchTerm.toLowerCase();
        const padreMatch = padre.nombre.toLowerCase().includes(term);
        const hijosMatch = padre.hijos.some(h => h.nombre.toLowerCase().includes(term));
        return padreMatch || hijosMatch;
      })
    : arbol;

  // Renderizar categoria
  const renderCategoria = (categoria: Categoria, isChild = false) => (
    <div
      key={categoria.id}
      className={`flex items-center justify-between p-2 ${isChild ? 'pl-10' : ''} hover:bg-gray-50 rounded-lg cursor-pointer`}
      onClick={() => setViewingCategoria(categoria)}
    >
      <div className="flex items-center gap-2 flex-1">
        <span className="text-xs font-mono text-gray-400">{categoria.codigo}</span>
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: categoria.color || '#3B82F6' }}
        />
        <span className={`${isChild ? 'text-sm' : 'font-medium'} text-gray-900`}>
          {categoria.nombre}
        </span>
        {categoria.mostrarEnWeb && (
          <Globe className="h-3 w-3 text-green-500" title="Visible en web" />
        )}
      </div>

      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Package className="h-4 w-4" />
          <span>{categoria.metricas?.productosActivos || 0}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewingCategoria(categoria)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Ver Analytics"
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          {!isChild && (
            <button
              onClick={() => handleAddSubcategoria(categoria.id)}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
              title="Agregar subcategoria"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => handleEdit(categoria)}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeletingCategoria(categoria)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  // Renderizar categoria padre con hijos
  const renderCategoriaPadre = (padre: CategoriaArbol) => {
    const isExpanded = expandedIds.has(padre.id);
    const tieneHijos = padre.hijos.length > 0;

    return (
      <div key={padre.id} className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center bg-white">
          {tieneHijos && (
            <button
              onClick={() => toggleExpand(padre.id)}
              className="p-2 hover:bg-gray-100"
            >
              <ChevronRight
                className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
          <div className={`flex-1 ${!tieneHijos ? 'ml-8' : ''}`}>
            {renderCategoria(padre)}
          </div>
        </div>

        {isExpanded && tieneHijos && (
          <div className="border-t border-gray-100 bg-gray-50">
            {padre.hijos.map(hijo => renderCategoria(hijo, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Categorias</h3>
          <span className="text-sm text-gray-500">({arbol.length})</span>
        </div>
        <Button onClick={() => { setCategoriaPadreId(undefined); setShowForm(true); }} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nueva Categoria
        </Button>
      </div>

      {/* Busqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar categoria..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Cargando...</div>
      ) : arbolFiltrado.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {searchTerm ? 'No se encontraron categorias' : 'No hay categorias creadas'}
        </div>
      ) : (
        <div className="space-y-2">
          {arbolFiltrado.map(padre => renderCategoriaPadre(padre))}
        </div>
      )}

      {/* Form Modal */}
      <CategoriaForm
        isOpen={showForm}
        onClose={handleFormClose}
        categoria={editingCategoria}
        categoriaPadreId={categoriaPadreId}
        onSuccess={handleFormSuccess}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!deletingCategoria}
        onClose={() => setDeletingCategoria(null)}
        onConfirm={handleDelete}
        title="Eliminar Categoria"
        message={`¿Estas seguro de eliminar "${deletingCategoria?.nombre}"? ${deletingCategoria?.metricas?.subcategorias ? 'Esta categoria tiene subcategorias que tambien seran eliminadas.' : ''}`}
        confirmText="Eliminar"
        variant="danger"
      />

      {/* Modal de Detalle con Analytics */}
      <CategoriaDetalle
        isOpen={!!viewingCategoria}
        onClose={() => setViewingCategoria(null)}
        categoria={viewingCategoria}
      />
    </div>
  );
}
