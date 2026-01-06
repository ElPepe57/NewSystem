import { useState, useEffect, useRef } from 'react';
import { FolderTree, Plus, X, Check, ChevronRight, Star } from 'lucide-react';
import { useCategoriaStore } from '../../../store/categoriaStore';
import { useAuthStore } from '../../../store/authStore';
import type { Categoria, CategoriaSnapshot, CategoriaArbol } from '../../../types/categoria.types';

interface CategoriaSelectorProps {
  value: string[];                   // IDs de categorias seleccionadas
  onChange: (categoriaIds: string[], snapshots: CategoriaSnapshot[]) => void;
  categoriaPrincipalId?: string;     // ID de la categoria principal
  onCategoriaPrincipalChange?: (categoriaId: string | undefined) => void;
  maxCategorias?: number;            // Maximo de categorias (default 5)
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
}

export function CategoriaSelector({
  value = [],
  onChange,
  categoriaPrincipalId,
  onCategoriaPrincipalChange,
  maxCategorias = 5,
  required = false,
  disabled = false,
  className = '',
  error
}: CategoriaSelectorProps) {
  const { user } = useAuthStore();
  const {
    arbol,
    categoriasActivas,
    fetchArbol,
    fetchCategoriasActivas,
    crearRapida,
    loading
  } = useCategoriaStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPadres, setExpandedPadres] = useState<Set<string>>(new Set());
  const [showCreateOption, setShowCreateOption] = useState(false);
  const [creating, setCreating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Cargar categorias al montar
  useEffect(() => {
    if (arbol.length === 0) {
      fetchArbol();
    }
    if (categoriasActivas.length === 0) {
      fetchCategoriasActivas();
    }
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Obtener categorias seleccionadas
  const categoriasSeleccionadas = categoriasActivas.filter(c => value.includes(c.id));

  // Filtrar categorias por busqueda
  const categoriasFiltradas = searchTerm
    ? categoriasActivas.filter(c => {
        const term = searchTerm.toLowerCase();
        return (
          c.nombre.toLowerCase().includes(term) ||
          c.codigo.toLowerCase().includes(term) ||
          c.categoriaPadreNombre?.toLowerCase().includes(term)
        );
      })
    : null;

  // Mostrar opcion de crear si no hay coincidencia exacta
  useEffect(() => {
    if (searchTerm.length >= 2) {
      const existeExacto = categoriasActivas.some(
        c => c.nombre.toLowerCase() === searchTerm.toLowerCase()
      );
      setShowCreateOption(!existeExacto);
    } else {
      setShowCreateOption(false);
    }
  }, [searchTerm, categoriasActivas]);

  // Toggle expansion de categoria padre
  const toggleExpand = (padreId: string) => {
    const newExpanded = new Set(expandedPadres);
    if (newExpanded.has(padreId)) {
      newExpanded.delete(padreId);
    } else {
      newExpanded.add(padreId);
    }
    setExpandedPadres(newExpanded);
  };

  // Seleccionar/deseleccionar categoria
  const handleToggle = (categoria: Categoria) => {
    const isSelected = value.includes(categoria.id);

    let newIds: string[];
    if (isSelected) {
      newIds = value.filter(id => id !== categoria.id);
      // Si se deselecciona la principal, limpiarla
      if (categoria.id === categoriaPrincipalId) {
        onCategoriaPrincipalChange?.(newIds.length > 0 ? newIds[0] : undefined);
      }
    } else {
      if (value.length >= maxCategorias) {
        return; // Limite alcanzado
      }
      newIds = [...value, categoria.id];
      // Si es la primera, hacerla principal
      if (newIds.length === 1) {
        onCategoriaPrincipalChange?.(categoria.id);
      }
    }

    // Generar snapshots
    const snapshots: CategoriaSnapshot[] = newIds.map(id => {
      const cat = categoriasActivas.find(c => c.id === id)!;
      return {
        categoriaId: cat.id,
        codigo: cat.codigo,
        nombre: cat.nombre,
        slug: cat.slug,
        nivel: cat.nivel,
        categoriaPadreId: cat.categoriaPadreId,
        categoriaPadreNombre: cat.categoriaPadreNombre,
        icono: cat.icono,
        color: cat.color
      };
    });

    onChange(newIds, snapshots);
  };

  // Marcar como principal
  const handleSetPrincipal = (categoriaId: string) => {
    if (value.includes(categoriaId)) {
      onCategoriaPrincipalChange?.(categoriaId);
    }
  };

  // Crear nueva categoria rapida (nivel 1)
  const handleCreateNew = async () => {
    if (!user || !searchTerm.trim()) return;

    setCreating(true);
    try {
      const nuevaCategoria = await crearRapida(searchTerm.trim(), 1, user.uid);
      // Seleccionarla automaticamente
      const snapshot: CategoriaSnapshot = {
        categoriaId: nuevaCategoria.id,
        codigo: nuevaCategoria.codigo,
        nombre: nuevaCategoria.nombre,
        slug: nuevaCategoria.slug,
        nivel: nuevaCategoria.nivel,
        icono: nuevaCategoria.icono,
        color: nuevaCategoria.color
      };
      onChange([...value, nuevaCategoria.id], [...categoriasSeleccionadas.map(c => ({
        categoriaId: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        slug: c.slug,
        nivel: c.nivel,
        categoriaPadreId: c.categoriaPadreId,
        categoriaPadreNombre: c.categoriaPadreNombre,
        icono: c.icono,
        color: c.color
      })), snapshot]);
      setSearchTerm('');
    } catch (error) {
      console.error('Error al crear categoria:', error);
    } finally {
      setCreating(false);
    }
  };

  // Remover categoria
  const handleRemove = (categoriaId: string) => {
    const newIds = value.filter(id => id !== categoriaId);
    const snapshots = categoriasSeleccionadas
      .filter(c => c.id !== categoriaId)
      .map(c => ({
        categoriaId: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        slug: c.slug,
        nivel: c.nivel,
        categoriaPadreId: c.categoriaPadreId,
        categoriaPadreNombre: c.categoriaPadreNombre,
        icono: c.icono,
        color: c.color
      }));

    if (categoriaId === categoriaPrincipalId) {
      onCategoriaPrincipalChange?.(newIds.length > 0 ? newIds[0] : undefined);
    }

    onChange(newIds, snapshots);
  };

  // Renderizar categoria en arbol
  const renderCategoria = (categoria: Categoria, isChild = false) => {
    const isSelected = value.includes(categoria.id);
    const isPrincipal = categoria.id === categoriaPrincipalId;

    return (
      <button
        key={categoria.id}
        type="button"
        onClick={() => handleToggle(categoria)}
        disabled={!isSelected && value.length >= maxCategorias}
        className={`
          w-full px-3 py-2 flex items-center gap-2 text-left transition-colors
          ${isChild ? 'pl-8' : ''}
          ${isSelected ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}
          ${!isSelected && value.length >= maxCategorias ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div
          className={`
            w-5 h-5 rounded border flex items-center justify-center flex-shrink-0
            ${isSelected ? 'bg-primary-500 border-primary-500' : 'border-gray-300'}
          `}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
        <span className={`flex-1 ${isChild ? 'text-sm' : 'font-medium'}`}>
          {categoria.nombre}
        </span>
        {isPrincipal && (
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
        )}
      </button>
    );
  };

  // Renderizar categoria padre con hijos
  const renderCategoriaPadre = (padre: CategoriaArbol) => {
    const isExpanded = expandedPadres.has(padre.id);
    const tieneHijos = padre.hijos.length > 0;

    return (
      <div key={padre.id}>
        <div className="flex items-center">
          {tieneHijos && (
            <button
              type="button"
              onClick={() => toggleExpand(padre.id)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight
                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
          <div className={`flex-1 ${!tieneHijos ? 'ml-5' : ''}`}>
            {renderCategoria(padre)}
          </div>
        </div>

        {isExpanded && tieneHijos && (
          <div className="border-l-2 border-gray-100 ml-3">
            {padre.hijos.map(hijo => renderCategoria(hijo, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 mb-1">
        <FolderTree className="inline-block w-4 h-4 mr-1 text-gray-400" />
        Categorias
        {required && <span className="text-red-500 ml-1">*</span>}
        <span className="text-gray-400 font-normal ml-2">
          ({value.length}/{maxCategorias})
        </span>
      </label>

      {/* Categorias seleccionadas */}
      <div className="mb-2">
        {categoriasSeleccionadas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {categoriasSeleccionadas.map((cat) => {
              const isPrincipal = cat.id === categoriaPrincipalId;
              return (
                <div
                  key={cat.id}
                  className={`
                    inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm
                    ${isPrincipal
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                    }
                  `}
                >
                  {isPrincipal && (
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  )}
                  <span>
                    {cat.nivel === 2 && cat.categoriaPadreNombre
                      ? `${cat.categoriaPadreNombre} > `
                      : ''
                    }
                    {cat.nombre}
                  </span>
                  {value.length > 1 && !isPrincipal && (
                    <button
                      type="button"
                      onClick={() => handleSetPrincipal(cat.id)}
                      className="p-0.5 hover:bg-gray-200 rounded-full"
                      title="Marcar como principal"
                    >
                      <Star className="w-3 h-3 text-gray-400" />
                    </button>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemove(cat.id)}
                      className="p-0.5 hover:bg-gray-200 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin categorias seleccionadas</p>
        )}
      </div>

      {/* Boton para abrir selector */}
      {!disabled && value.length < maxCategorias && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full px-3 py-2 border rounded-lg text-left flex items-center gap-2
            hover:border-primary-400 transition-colors
            ${error ? 'border-red-300' : 'border-gray-300'}
          `}
        >
          <Plus className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500">Agregar categoria...</span>
        </button>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Busqueda */}
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar categoria..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
          </div>

          <div className="max-h-60 overflow-auto">
            {loading ? (
              <div className="px-4 py-3 text-center text-gray-500">
                Cargando...
              </div>
            ) : (
              <>
                {/* Opcion de crear nuevo */}
                {showCreateOption && (
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    disabled={creating}
                    className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-primary-50 border-b border-gray-100 text-primary-600"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {creating ? 'Creando...' : `Crear "${searchTerm}"`}
                    </span>
                  </button>
                )}

                {/* Lista filtrada o arbol completo */}
                {categoriasFiltradas ? (
                  // Mostrar resultados de busqueda planos
                  categoriasFiltradas.length > 0 ? (
                    categoriasFiltradas.map(cat => (
                      <div key={cat.id} className="border-b border-gray-50 last:border-0">
                        {renderCategoria(cat)}
                        {cat.nivel === 2 && cat.categoriaPadreNombre && (
                          <span className="text-xs text-gray-400 pl-10 pb-1 block">
                            en {cat.categoriaPadreNombre}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    !showCreateOption && (
                      <div className="px-4 py-3 text-center text-gray-500">
                        No se encontraron categorias
                      </div>
                    )
                  )
                ) : (
                  // Mostrar arbol completo
                  arbol.length > 0 ? (
                    arbol.map(padre => renderCategoriaPadre(padre))
                  ) : (
                    <div className="px-4 py-3 text-center text-gray-500">
                      No hay categorias creadas
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Hint */}
      <p className="mt-1 text-xs text-gray-500">
        Selecciona las areas de salud/beneficio que aplican a este producto
      </p>
    </div>
  );
}
