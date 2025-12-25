import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, ExternalLink, Store, TrendingUp, Star, Crown, ChevronDown, Shield, Check, Loader2 } from 'lucide-react';
import { Button, Input } from '../../common';
import { useCompetidorStore } from '../../../store/competidorStore';
import { useAuthStore } from '../../../store/authStore';
import type { CompetidorPeruFormData } from '../../../types/producto.types';
import type { Competidor, CompetidorFormData, PlataformaCompetidor } from '../../../types/entidadesMaestras.types';

// Plataformas disponibles
const PLATAFORMAS = [
  { value: 'mercado_libre', label: 'Mercado Libre' },
  { value: 'web_propia', label: 'Web Propia' },
  { value: 'inkafarma', label: 'Inkafarma' },
  { value: 'mifarma', label: 'MiFarma' },
  { value: 'falabella', label: 'Falabella' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'otra', label: 'Otra' }
];

interface CompetidorPeruListProps {
  competidores: CompetidorPeruFormData[];
  onChange: (competidores: CompetidorPeruFormData[]) => void;
  disabled?: boolean;
}

// Componente de Autocomplete de Competidores del Gestor Maestro
interface CompetidorAutocompleteProps {
  value: string;
  competidorId?: string;
  onChange: (nombre: string, competidorId?: string) => void;
  competidoresMaestro: Competidor[];
  onCreateCompetidor: (nombre: string) => Promise<Competidor | null>;
  disabled?: boolean;
}

const CompetidorAutocomplete: React.FC<CompetidorAutocompleteProps> = ({
  value,
  competidorId,
  onChange,
  competidoresMaestro,
  onCreateCompetidor,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filteredCompetidores = useMemo(() => {
    if (!searchTerm) return competidoresMaestro;
    const term = searchTerm.toLowerCase();
    return competidoresMaestro.filter(c =>
      c.nombre.toLowerCase().includes(term) ||
      c.codigo?.toLowerCase().includes(term) ||
      c.alias?.some(a => a.toLowerCase().includes(term))
    );
  }, [competidoresMaestro, searchTerm]);

  const selectedCompetidor = competidorId
    ? competidoresMaestro.find(c => c.id === competidorId)
    : null;

  const handleSelect = (competidor: Competidor) => {
    onChange(competidor.nombre, competidor.id);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleCreateNew = async () => {
    if (!searchTerm.trim()) return;
    setIsCreating(true);
    try {
      const nuevoCompetidor = await onCreateCompetidor(searchTerm.trim());
      if (nuevoCompetidor) {
        onChange(nuevoCompetidor.nombre, nuevoCompetidor.id);
        setIsOpen(false);
        setSearchTerm('');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const getPlataformaLabel = (plataforma: PlataformaCompetidor) => {
    return PLATAFORMAS.find(p => p.value === plataforma)?.label || plataforma;
  };

  const getNivelAmenazaColor = (nivel: string) => {
    switch (nivel) {
      case 'alto': return 'text-red-600 bg-red-100';
      case 'medio': return 'text-yellow-600 bg-yellow-100';
      case 'bajo': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Competidor
      </label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-left ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-orange-400'
        } ${isOpen ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-300'}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedCompetidor ? (
            <>
              <Shield className={`h-4 w-4 flex-shrink-0 ${
                selectedCompetidor.nivelAmenaza === 'alto' ? 'text-red-500' :
                selectedCompetidor.nivelAmenaza === 'medio' ? 'text-yellow-500' : 'text-green-500'
              }`} />
              <span className="font-medium truncate">{selectedCompetidor.nombre}</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                {selectedCompetidor.codigo}
              </span>
            </>
          ) : value ? (
            <span className="text-gray-700">{value}</span>
          ) : (
            <span className="text-gray-400">Seleccionar competidor...</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-hidden">
          {/* Buscador */}
          <div className="p-2 border-b">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar o crear competidor..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              autoFocus
            />
          </div>

          {/* Lista de competidores */}
          <div className="max-h-48 overflow-y-auto">
            {filteredCompetidores.length === 0 && !searchTerm ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No hay competidores en el Gestor Maestro
              </div>
            ) : filteredCompetidores.length === 0 && searchTerm ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No se encontró "{searchTerm}"
              </div>
            ) : (
              filteredCompetidores.map((competidor) => (
                <button
                  key={competidor.id}
                  type="button"
                  onClick={() => handleSelect(competidor)}
                  className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-orange-50 text-left ${
                    competidorId === competidor.id ? 'bg-orange-100' : ''
                  }`}
                >
                  <Shield className={`h-4 w-4 flex-shrink-0 ${
                    competidor.nivelAmenaza === 'alto' ? 'text-red-500' :
                    competidor.nivelAmenaza === 'medio' ? 'text-yellow-500' : 'text-green-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{competidor.nombre}</span>
                      {competidor.codigo && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          {competidor.codigo}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className={`px-1.5 py-0.5 rounded ${getNivelAmenazaColor(competidor.nivelAmenaza)}`}>
                        {competidor.nivelAmenaza}
                      </span>
                      <span>{getPlataformaLabel(competidor.plataformaPrincipal)}</span>
                      {competidor.esLiderCategoria && (
                        <span className="flex items-center gap-0.5 text-amber-600">
                          <Crown className="h-3 w-3" /> Líder
                        </span>
                      )}
                    </div>
                  </div>
                  {competidorId === competidor.id && (
                    <Check className="h-4 w-4 text-orange-600" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Opción para crear nuevo */}
          {searchTerm && (
            <div className="p-2 border-t bg-gray-50">
              <button
                type="button"
                onClick={handleCreateNew}
                disabled={isCreating}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Crear "{searchTerm}" en Gestor Maestro
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const CompetidorPeruList: React.FC<CompetidorPeruListProps> = ({
  competidores,
  onChange,
  disabled = false
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const user = useAuthStore(state => state.user);

  // Conectar con el store de competidores del Gestor Maestro
  const {
    competidoresActivos,
    fetchCompetidoresActivos,
    createCompetidor
  } = useCompetidorStore();

  // Cargar competidores al montar
  useEffect(() => {
    fetchCompetidoresActivos();
  }, [fetchCompetidoresActivos]);

  // Handler para crear nuevo competidor en el Gestor Maestro
  const handleCreateCompetidor = async (nombre: string): Promise<Competidor | null> => {
    if (!user) return null;
    try {
      const data: CompetidorFormData = {
        nombre,
        plataformaPrincipal: 'mercado_libre',
        reputacion: 'desconocida',
        nivelAmenaza: 'medio'
      };
      const nuevoCompetidor = await createCompetidor(data, user.uid);
      return nuevoCompetidor;
    } catch (error) {
      console.error('Error creando competidor:', error);
      return null;
    }
  };

  const handleAddCompetidor = () => {
    const newCompetidor: CompetidorPeruFormData = {
      id: `comp-${Date.now()}`,
      nombre: '',
      plataforma: 'mercado_libre',
      precio: 0,
      reputacion: 'desconocida'
    };
    onChange([...competidores, newCompetidor]);
    setExpandedId(newCompetidor.id);
  };

  const handleRemoveCompetidor = (id: string) => {
    onChange(competidores.filter(c => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdateCompetidor = (id: string, updates: Partial<CompetidorPeruFormData>) => {
    onChange(competidores.map(c =>
      c.id === id ? { ...c, ...updates } : c
    ));
  };

  const calcularPromedio = () => {
    if (competidores.length === 0) return 0;
    const total = competidores.reduce((sum, c) => sum + (c.precio || 0), 0);
    return total / competidores.length;
  };

  const calcularMinMax = () => {
    if (competidores.length === 0) return { min: 0, max: 0 };
    const precios = competidores.map(c => c.precio || 0).filter(p => p > 0);
    if (precios.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.min(...precios),
      max: Math.max(...precios)
    };
  };

  const getPlataformaLabel = (value: string) => {
    return PLATAFORMAS.find(p => p.value === value)?.label || value;
  };

  const getReputacionIcon = (reputacion?: string) => {
    switch (reputacion) {
      case 'excelente': return <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />;
      case 'buena': return <Star className="h-4 w-4 text-yellow-500" />;
      case 'regular': return <Star className="h-4 w-4 text-gray-400" />;
      case 'mala': return <Star className="h-4 w-4 text-red-400" />;
      default: return null;
    }
  };

  const { min, max } = calcularMinMax();
  const promedio = calcularPromedio();
  const competidoresML = competidores.filter(c => c.plataforma === 'mercado_libre').length;

  return (
    <div className="space-y-4">
      {/* Header con estadísticas */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-orange-600" />
          <h4 className="font-medium text-gray-900">Competencia Perú</h4>
          <span className="text-sm text-gray-500">({competidores.length})</span>
          {competidoresML > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
              {competidoresML} en ML
            </span>
          )}
        </div>
        {competidores.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">
              Min: <span className="font-medium text-green-600">S/{min.toFixed(2)}</span>
            </span>
            <span className="text-gray-500">
              Max: <span className="font-medium text-red-600">S/{max.toFixed(2)}</span>
            </span>
            <span className="text-gray-500">
              Prom: <span className="font-medium text-orange-600">S/{promedio.toFixed(2)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Lista de competidores */}
      <div className="space-y-3">
        {competidores.map((competidor, index) => (
          <div
            key={competidor.id}
            className={`border rounded-lg transition-all ${
              expandedId === competidor.id ? 'border-orange-300 bg-orange-50/50' : 'border-gray-200 bg-white'
            }`}
          >
            {/* Fila compacta */}
            <div
              className="p-3 flex items-center gap-3 cursor-pointer"
              onClick={() => setExpandedId(expandedId === competidor.id ? null : competidor.id)}
            >
              <span className="text-sm font-medium text-gray-400 w-6">#{index + 1}</span>

              <div className="flex-1 grid grid-cols-4 gap-3">
                <div className="flex items-center gap-2">
                  {competidor.esLiderCategoria && (
                    <Crown className="h-4 w-4 text-yellow-500" />
                  )}
                  <span className={competidor.nombre ? 'font-medium' : 'text-gray-400 italic'}>
                    {competidor.nombre || 'Sin nombre'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    competidor.plataforma === 'mercado_libre' ? 'bg-yellow-100 text-yellow-700' :
                    competidor.plataforma === 'inkafarma' ? 'bg-green-100 text-green-700' :
                    competidor.plataforma === 'mifarma' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {getPlataformaLabel(competidor.plataforma)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`font-medium ${
                    competidor.precio === min && min > 0 ? 'text-green-600' :
                    competidor.precio === max && max > 0 ? 'text-red-600' : 'text-gray-700'
                  }`}>
                    S/{(competidor.precio || 0).toFixed(2)}
                  </span>
                  {competidor.precio === min && min > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Más bajo</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {getReputacionIcon(competidor.reputacion)}
                  {competidor.ventas && competidor.ventas > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <TrendingUp className="h-3 w-3" />
                      {competidor.ventas}/mes
                    </span>
                  )}
                  {competidor.url && (
                    <a
                      href={competidor.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>

              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveCompetidor(competidor.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Detalles expandidos */}
            {expandedId === competidor.id && (
              <div className="px-3 pb-3 pt-0 border-t border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <CompetidorAutocomplete
                    value={competidor.nombre}
                    competidorId={competidor.competidorId}
                    onChange={(nombre, competidorId) => handleUpdateCompetidor(competidor.id, { nombre, competidorId })}
                    competidoresMaestro={competidoresActivos}
                    onCreateCompetidor={handleCreateCompetidor}
                    disabled={disabled}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Plataforma
                    </label>
                    <select
                      value={competidor.plataforma}
                      onChange={(e) => handleUpdateCompetidor(competidor.id, {
                        plataforma: e.target.value as CompetidorPeruFormData['plataforma']
                      })}
                      disabled={disabled}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {PLATAFORMAS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label="Precio (PEN)"
                    name="precio"
                    type="number"
                    step="0.01"
                    value={competidor.precio || ''}
                    onChange={(e) => handleUpdateCompetidor(competidor.id, {
                      precio: parseFloat(e.target.value) || 0
                    })}
                    disabled={disabled}
                  />

                  <Input
                    label="URL del producto"
                    name="url"
                    type="url"
                    value={competidor.url || ''}
                    onChange={(e) => handleUpdateCompetidor(competidor.id, { url: e.target.value })}
                    placeholder="https://..."
                    disabled={disabled}
                  />

                  <Input
                    label="Ventas mensuales estimadas"
                    name="ventas"
                    type="number"
                    value={competidor.ventas || ''}
                    onChange={(e) => handleUpdateCompetidor(competidor.id, {
                      ventas: parseInt(e.target.value) || 0
                    })}
                    placeholder="ej: 50"
                    disabled={disabled}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reputación
                    </label>
                    <select
                      value={competidor.reputacion || 'desconocida'}
                      onChange={(e) => handleUpdateCompetidor(competidor.id, {
                        reputacion: e.target.value as CompetidorPeruFormData['reputacion']
                      })}
                      disabled={disabled}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="desconocida">Desconocida</option>
                      <option value="excelente">Excelente</option>
                      <option value="buena">Buena</option>
                      <option value="regular">Regular</option>
                      <option value="mala">Mala</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={competidor.esLiderCategoria || false}
                        onChange={(e) => handleUpdateCompetidor(competidor.id, {
                          esLiderCategoria: e.target.checked
                        })}
                        disabled={disabled}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700 flex items-center gap-1">
                        <Crown className="h-4 w-4 text-yellow-500" />
                        Líder de categoría
                      </span>
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notas
                    </label>
                    <textarea
                      value={competidor.notas || ''}
                      onChange={(e) => handleUpdateCompetidor(competidor.id, { notas: e.target.value })}
                      placeholder="Observaciones sobre este competidor..."
                      rows={2}
                      disabled={disabled}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Botón para cerrar/confirmar edición */}
                  <div className="md:col-span-2 flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      Listo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Botón agregar */}
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          onClick={handleAddCompetidor}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Competidor Perú
        </Button>
      )}

      {competidores.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          No hay competidores registrados. Agrega al menos uno para analizar el mercado.
        </p>
      )}
    </div>
  );
};
