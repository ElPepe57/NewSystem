import { useState, useEffect, useRef } from 'react';
import { Tag, Plus, X, Check } from 'lucide-react';
import { useEtiquetaStore } from '../../../store/etiquetaStore';
import { useAuthStore } from '../../../store/authStore';
import type { Etiqueta, EtiquetaSnapshot, TipoEtiqueta } from '../../../types/etiqueta.types';

interface EtiquetaSelectorProps {
  value: string[];                   // IDs de etiquetas seleccionadas
  onChange: (etiquetaIds: string[], snapshots: EtiquetaSnapshot[]) => void;
  tiposPermitidos?: TipoEtiqueta[];  // Filtrar por tipos
  disabled?: boolean;
  className?: string;
}

const TIPO_LABELS: Record<TipoEtiqueta, string> = {
  atributo: 'Atributos',
  marketing: 'Marketing',
  origen: 'Origen'
};

const TIPO_ORDER: TipoEtiqueta[] = ['atributo', 'marketing', 'origen'];

export function EtiquetaSelector({
  value = [],
  onChange,
  tiposPermitidos = ['atributo', 'marketing', 'origen'],
  disabled = false,
  className = ''
}: EtiquetaSelectorProps) {
  const { user } = useAuthStore();
  const {
    etiquetasAgrupadas,
    etiquetasActivas,
    fetchEtiquetasAgrupadas,
    fetchEtiquetasActivas,
    crearRapida,
    loading
  } = useEtiquetaStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoParaCrear, setTipoParaCrear] = useState<TipoEtiqueta>('atributo');
  const [showCreateOption, setShowCreateOption] = useState(false);
  const [creating, setCreating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Cargar etiquetas al montar
  useEffect(() => {
    if (!etiquetasAgrupadas) {
      fetchEtiquetasAgrupadas();
    }
    if (etiquetasActivas.length === 0) {
      fetchEtiquetasActivas();
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

  // Obtener etiquetas seleccionadas
  const etiquetasSeleccionadas = etiquetasActivas.filter(e => value.includes(e.id));

  // Filtrar etiquetas por busqueda
  const etiquetasFiltradas = searchTerm
    ? etiquetasActivas.filter(e => {
        if (!tiposPermitidos.includes(e.tipo)) return false;
        const term = searchTerm.toLowerCase();
        return (
          e.nombre.toLowerCase().includes(term) ||
          e.codigo.toLowerCase().includes(term)
        );
      })
    : null;

  // Mostrar opcion de crear si no hay coincidencia exacta
  useEffect(() => {
    if (searchTerm.length >= 2) {
      const existeExacto = etiquetasActivas.some(
        e => e.nombre.toLowerCase() === searchTerm.toLowerCase()
      );
      setShowCreateOption(!existeExacto);
    } else {
      setShowCreateOption(false);
    }
  }, [searchTerm, etiquetasActivas]);

  // Seleccionar/deseleccionar etiqueta
  const handleToggle = (etiqueta: Etiqueta) => {
    const isSelected = value.includes(etiqueta.id);

    let newIds: string[];
    if (isSelected) {
      newIds = value.filter(id => id !== etiqueta.id);
    } else {
      newIds = [...value, etiqueta.id];
    }

    // Generar snapshots
    const snapshots: EtiquetaSnapshot[] = newIds.map(id => {
      const etq = etiquetasActivas.find(e => e.id === id)!;
      return {
        etiquetaId: etq.id,
        codigo: etq.codigo,
        nombre: etq.nombre,
        slug: etq.slug,
        tipo: etq.tipo,
        icono: etq.icono,
        colorFondo: etq.colorFondo,
        colorTexto: etq.colorTexto,
        colorBorde: etq.colorBorde
      };
    });

    onChange(newIds, snapshots);
  };

  // Crear nueva etiqueta rapida
  const handleCreateNew = async () => {
    if (!user || !searchTerm.trim()) return;

    setCreating(true);
    try {
      const nuevaEtiqueta = await crearRapida(searchTerm.trim(), tipoParaCrear, user.uid);
      const snapshot: EtiquetaSnapshot = {
        etiquetaId: nuevaEtiqueta.id,
        codigo: nuevaEtiqueta.codigo,
        nombre: nuevaEtiqueta.nombre,
        slug: nuevaEtiqueta.slug,
        tipo: nuevaEtiqueta.tipo,
        icono: nuevaEtiqueta.icono,
        colorFondo: nuevaEtiqueta.colorFondo,
        colorTexto: nuevaEtiqueta.colorTexto,
        colorBorde: nuevaEtiqueta.colorBorde
      };

      onChange(
        [...value, nuevaEtiqueta.id],
        [...etiquetasSeleccionadas.map(e => ({
          etiquetaId: e.id,
          codigo: e.codigo,
          nombre: e.nombre,
          slug: e.slug,
          tipo: e.tipo,
          icono: e.icono,
          colorFondo: e.colorFondo,
          colorTexto: e.colorTexto,
          colorBorde: e.colorBorde
        })), snapshot]
      );
      setSearchTerm('');
    } catch (error) {
      console.error('Error al crear etiqueta:', error);
    } finally {
      setCreating(false);
    }
  };

  // Remover etiqueta
  const handleRemove = (etiquetaId: string) => {
    const newIds = value.filter(id => id !== etiquetaId);
    const snapshots = etiquetasSeleccionadas
      .filter(e => e.id !== etiquetaId)
      .map(e => ({
        etiquetaId: e.id,
        codigo: e.codigo,
        nombre: e.nombre,
        slug: e.slug,
        tipo: e.tipo,
        icono: e.icono,
        colorFondo: e.colorFondo,
        colorTexto: e.colorTexto,
        colorBorde: e.colorBorde
      }));

    onChange(newIds, snapshots);
  };

  // Renderizar badge de etiqueta
  const renderEtiquetaBadge = (etiqueta: Etiqueta, showRemove = true) => (
    <div
      key={etiqueta.id}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm"
      style={{
        backgroundColor: etiqueta.colorFondo || '#F3F4F6',
        color: etiqueta.colorTexto || '#4B5563',
        border: `1px solid ${etiqueta.colorBorde || '#D1D5DB'}`
      }}
    >
      {etiqueta.icono && <span>{etiqueta.icono}</span>}
      <span>{etiqueta.nombre}</span>
      {showRemove && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleRemove(etiqueta.id);
          }}
          className="p-0.5 hover:opacity-70 rounded-full"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  // Renderizar etiqueta en lista
  const renderEtiquetaItem = (etiqueta: Etiqueta) => {
    const isSelected = value.includes(etiqueta.id);

    return (
      <button
        key={etiqueta.id}
        type="button"
        onClick={() => handleToggle(etiqueta)}
        className={`
          w-full px-3 py-2 flex items-center gap-2 text-left transition-colors
          ${isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'}
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
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm"
          style={{
            backgroundColor: etiqueta.colorFondo || '#F3F4F6',
            color: etiqueta.colorTexto || '#4B5563'
          }}
        >
          {etiqueta.icono && <span>{etiqueta.icono}</span>}
          <span>{etiqueta.nombre}</span>
        </div>
      </button>
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 mb-1">
        <Tag className="inline-block w-4 h-4 mr-1 text-gray-400" />
        Etiquetas
        <span className="text-gray-400 font-normal ml-2">(opcional)</span>
      </label>

      {/* Etiquetas seleccionadas */}
      <div className="mb-2 min-h-[32px]">
        {etiquetasSeleccionadas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {etiquetasSeleccionadas.map(etq => renderEtiquetaBadge(etq))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin etiquetas</p>
        )}
      </div>

      {/* Boton para abrir selector */}
      {!disabled && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left flex items-center gap-2 hover:border-primary-400 transition-colors"
        >
          <Plus className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500">Agregar etiqueta...</span>
        </button>
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
              placeholder="Buscar etiqueta..."
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
                  <div className="border-b border-gray-100">
                    <div className="px-3 py-2 flex items-center gap-2">
                      <span className="text-sm text-gray-600">Crear como:</span>
                      {TIPO_ORDER.filter(t => tiposPermitidos.includes(t)).map(tipo => (
                        <button
                          key={tipo}
                          type="button"
                          onClick={() => setTipoParaCrear(tipo)}
                          className={`
                            px-2 py-1 text-xs rounded-full transition-colors
                            ${tipoParaCrear === tipo
                              ? 'bg-primary-100 text-primary-700 border border-primary-300'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }
                          `}
                        >
                          {TIPO_LABELS[tipo]}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateNew}
                      disabled={creating}
                      className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-primary-50 text-primary-600"
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        {creating ? 'Creando...' : `Crear "${searchTerm}"`}
                      </span>
                    </button>
                  </div>
                )}

                {/* Lista filtrada o agrupada */}
                {etiquetasFiltradas ? (
                  // Mostrar resultados de busqueda
                  etiquetasFiltradas.length > 0 ? (
                    etiquetasFiltradas.map(etq => renderEtiquetaItem(etq))
                  ) : (
                    !showCreateOption && (
                      <div className="px-4 py-3 text-center text-gray-500">
                        No se encontraron etiquetas
                      </div>
                    )
                  )
                ) : (
                  // Mostrar agrupadas por tipo
                  etiquetasAgrupadas && (
                    TIPO_ORDER.filter(tipo => tiposPermitidos.includes(tipo)).map(tipo => {
                      const etiquetasDelTipo = etiquetasAgrupadas[tipo];
                      if (etiquetasDelTipo.length === 0) return null;

                      return (
                        <div key={tipo}>
                          <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                            {TIPO_LABELS[tipo]}
                          </div>
                          {etiquetasDelTipo.map(etq => renderEtiquetaItem(etq))}
                        </div>
                      );
                    })
                  )
                )}

                {/* Si no hay etiquetas */}
                {!etiquetasFiltradas && etiquetasAgrupadas &&
                  Object.values(etiquetasAgrupadas).every(arr => arr.length === 0) && (
                  <div className="px-4 py-3 text-center text-gray-500">
                    No hay etiquetas creadas
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Hint */}
      <p className="mt-1 text-xs text-gray-500">
        Agrega atributos como vegano, organico, best-seller, importado USA
      </p>
    </div>
  );
}
