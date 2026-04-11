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
  lineaNegocioId?: string;           // Filtrar por linea de negocio
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
  lineaNegocioId,
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

  // Helper para filtrar por linea de negocio
  const matchesLinea = (item: any) => {
    if (!lineaNegocioId) return true;
    const lineaIds = item.lineaNegocioIds as string[] | undefined;
    return !lineaIds || lineaIds.length === 0 || lineaIds.includes(lineaNegocioId);
  };

  // Filtrar categorias por busqueda y linea
  const categoriasFiltradas = searchTerm
    ? categoriasActivas.filter(c => {
        if (!matchesLinea(c)) return false;
        const term = searchTerm.toLowerCase();
        return (
          c.nombre.toLowerCase().includes(term) ||
          c.codigo.toLowerCase().includes(term) ||
          c.categoriaPadreNombre?.toLowerCase().includes(term)
        );
      })
    : null;

  // Filter arbol by linea de negocio
  const arbolFiltrado = lineaNegocioId
    ? arbol.filter(padre => matchesLinea(padre)).map(padre => ({
        ...padre,
        hijos: padre.hijos.filter((hijo: any) => matchesLinea(hijo))
      }))
    : arbol;

  // Mostrar opcion de crear si hay texto y no hay coincidencia exacta
  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      const existeExacto = categoriasActivas.some(
        c => c.nombre.toLowerCase() === searchTerm.trim().toLowerCase()
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
        color: cat.color,
        ...(cat.margenMinimo !== undefined ? { margenMinimo: cat.margenMinimo } : {}),
        ...(cat.margenObjetivo !== undefined ? { margenObjetivo: cat.margenObjetivo } : {}),
        ...(cat.margenMaximo !== undefined ? { margenMaximo: cat.margenMaximo } : {})
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
      const nuevaCategoria = await crearRapida(searchTerm.trim(), 1, user.uid, undefined, lineaNegocioId ? [lineaNegocioId] : undefined);
      // Seleccionarla automaticamente
      const snapshot: CategoriaSnapshot = {
        categoriaId: nuevaCategoria.id,
        codigo: nuevaCategoria.codigo,
        nombre: nuevaCategoria.nombre,
        slug: nuevaCategoria.slug,
        nivel: nuevaCategoria.nivel,
        icono: nuevaCategoria.icono,
        color: nuevaCategoria.color,
        ...(nuevaCategoria.margenMinimo !== undefined ? { margenMinimo: nuevaCategoria.margenMinimo } : {}),
        ...(nuevaCategoria.margenObjetivo !== undefined ? { margenObjetivo: nuevaCategoria.margenObjetivo } : {}),
        ...(nuevaCategoria.margenMaximo !== undefined ? { margenMaximo: nuevaCategoria.margenMaximo } : {})
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
        color: c.color,
        ...(c.margenMinimo !== undefined ? { margenMinimo: c.margenMinimo } : {}),
        ...(c.margenObjetivo !== undefined ? { margenObjetivo: c.margenObjetivo } : {}),
        ...(c.margenMaximo !== undefined ? { margenMaximo: c.margenMaximo } : {})
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
        color: c.color,
        ...(c.margenMinimo !== undefined ? { margenMinimo: c.margenMinimo } : {}),
        ...(c.margenObjetivo !== undefined ? { margenObjetivo: c.margenObjetivo } : {}),
        ...(c.margenMaximo !== undefined ? { margenMaximo: c.margenMaximo } : {})
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
          ${isSelected ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-50'}
          ${!isSelected && value.length >= maxCategorias ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div
          className={`
            w-5 h-5 rounded border flex items-center justify-center flex-shrink-0
            ${isSelected ? 'bg-teal-500 border-teal-500' : 'border-slate-300'}
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
              className="p-1 hover:bg-slate-100 rounded"
            >
              <ChevronRight
                className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
          <div className={`flex-1 ${!tieneHijos ? 'ml-5' : ''}`}>
            {renderCategoria(padre)}
          </div>
        </div>

        {isExpanded && tieneHijos && (
          <div className="border-l-2 border-slate-100 ml-3">
            {padre.hijos.map(hijo => renderCategoria(hijo, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Label */}
      <label className="block text-sm font-medium text-slate-700 mb-1">
        <FolderTree className="inline-block w-4 h-4 mr-1 text-slate-400" />
        Categorias
        {required && <span className="text-red-500 ml-1">*</span>}
        <span className="text-slate-400 font-normal ml-2">
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
                      ? 'bg-teal-100 text-teal-700 border border-teal-300'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
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
                      className="p-0.5 hover:bg-slate-200 rounded-full"
                      title="Marcar como principal"
                    >
                      <Star className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemove(cat.id)}
                      className="p-0.5 hover:bg-slate-200 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Sin categorias seleccionadas</p>
        )}
      </div>

      {/* Boton para abrir selector */}
      {!disabled && value.length < maxCategorias && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full px-3 py-2 border rounded-lg text-left flex items-center gap-2
            hover:border-teal-400 transition-colors
            ${error ? 'border-red-300' : 'border-slate-300'}
          `}
        >
          <Plus className="w-4 h-4 text-slate-400" />
          <span className="text-slate-500">Agregar categoria...</span>
        </button>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Busqueda */}
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar categoria..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              autoFocus
            />
          </div>

          <div className="max-h-60 overflow-auto">
            {loading ? (
              <div className="px-4 py-3 text-center text-slate-500">
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
                    className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-teal-50 border-b border-slate-100 text-teal-600"
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
                      <div key={cat.id} className="border-b border-slate-50 last:border-0">
                        {renderCategoria(cat)}
                        {cat.nivel === 2 && cat.categoriaPadreNombre && (
                          <span className="text-xs text-slate-400 pl-10 pb-1 block">
                            en {cat.categoriaPadreNombre}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    !showCreateOption && (
                      <div className="px-4 py-3 text-center text-slate-500">
                        No se encontraron categorias
                      </div>
                    )
                  )
                ) : (
                  // Mostrar arbol completo (filtrado por linea si aplica)
                  arbolFiltrado.length > 0 ? (
                    arbolFiltrado.map(padre => renderCategoriaPadre(padre))
                  ) : (
                    <div className="px-4 py-3 text-center text-slate-500">
                      No hay categorias creadas
                    </div>
                  )
                )}

                {/* Boton fijo para crear nueva categoria (siempre visible si no hay showCreateOption inline) */}
                {!showCreateOption && !creating && (
                  <div className="border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        const input = containerRef.current?.querySelector('input[type="text"]') as HTMLInputElement;
                        input?.focus();
                      }}
                      className="w-full px-4 py-2.5 flex items-center gap-2 text-left text-sm text-slate-500 hover:bg-slate-50"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Escribe un nombre para crear nueva categoria</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Hint */}
      <p className="mt-1 text-xs text-slate-500">
        Selecciona las areas de salud/beneficio que aplican a este producto
      </p>
    </div>
  );
}
