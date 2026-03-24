import React, { useMemo, useState } from 'react';
import { GitBranch, Link2, Check, Loader2, Search } from 'lucide-react';
import { Modal } from '../../common';
import type { Producto } from '../../../types/producto.types';

interface VincularVariantesModalProps {
  isOpen: boolean;
  onClose: () => void;
  productos: Producto[];
  onVincular: (productoId: string, parentId: string, varianteLabel: string) => Promise<void>;
}

interface GrupoVariante {
  key: string;
  marca: string;
  nombreComercial: string;
  productos: Producto[];
}

export const VincularVariantesModal: React.FC<VincularVariantesModalProps> = ({
  isOpen,
  onClose,
  productos,
  onVincular,
}) => {
  const [procesando, setProcesando] = useState<string | null>(null);
  const [vinculados, setVinculados] = useState<Set<string>>(new Set());
  const [padreSeleccionado, setPadreSeleccionado] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState('');

  // Detectar grupos candidatos: misma marca + nombre, diferente contenido
  const gruposCandidatos = useMemo(() => {
    const activos = productos.filter(p =>
      p.estado === 'activo' && !p.esVariante && !p.parentId
    );

    const grupos: Record<string, Producto[]> = {};
    for (const p of activos) {
      const key = `${(p.marca || '').toLowerCase().trim()}|${(p.nombreComercial || '').toLowerCase().trim()}`;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(p);
    }

    return Object.entries(grupos)
      .filter(([_, prods]) => prods.length >= 2)
      .map(([key, prods]): GrupoVariante => ({
        key,
        marca: prods[0].marca,
        nombreComercial: prods[0].nombreComercial,
        productos: prods.sort((a, b) => (a.sku || '').localeCompare(b.sku || '')),
      }))
      .sort((a, b) => b.productos.length - a.productos.length);
  }, [productos]);

  const gruposFiltrados = busqueda.trim()
    ? gruposCandidatos.filter(g => {
        const q = busqueda.toLowerCase();
        return g.marca.toLowerCase().includes(q) || g.nombreComercial.toLowerCase().includes(q);
      })
    : gruposCandidatos;

  const handleVincular = async (grupo: GrupoVariante) => {
    const padreId = padreSeleccionado[grupo.key];
    if (!padreId) return;

    setProcesando(grupo.key);
    try {
      for (const p of grupo.productos) {
        if (p.id === padreId) continue; // Skip padre
        const label = [p.presentacion, p.dosaje, p.contenido, p.sabor]
          .filter(Boolean)
          .join(' · ') || p.sku;
        await onVincular(p.id, padreId, label);
      }
      setVinculados(prev => new Set([...prev, grupo.key]));
    } finally {
      setProcesando(null);
    }
  };

  const gruposPendientes = gruposFiltrados.filter(g => !vinculados.has(g.key));
  const gruposVinculados = gruposFiltrados.filter(g => vinculados.has(g.key));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agrupar Variantes" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Se detectaron <strong>{gruposCandidatos.length}</strong> grupo{gruposCandidatos.length !== 1 ? 's' : ''} de productos con misma marca y nombre que podrían ser variantes.
        </p>

        {gruposCandidatos.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por marca o nombre..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {gruposPendientes.length === 0 && gruposVinculados.length === 0 && (
          <div className="text-center py-8">
            <GitBranch className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No se detectaron grupos candidatos</p>
            <p className="text-gray-400 text-sm">Todos los productos son únicos o ya están vinculados</p>
          </div>
        )}

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Grupos pendientes */}
          {gruposPendientes.map(grupo => (
            <div key={grupo.key} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{grupo.marca}</p>
                  <p className="text-sm text-gray-500">{grupo.nombreComercial}</p>
                </div>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                  {grupo.productos.length} productos
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-gray-400 font-medium">Selecciona el producto base del grupo:</p>
                {grupo.productos.map(p => {
                  const desc = [p.presentacion, p.dosaje, p.contenido, p.sabor].filter(Boolean).join(' · ');
                  const isSelected = padreSeleccionado[grupo.key] === p.id;
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'bg-purple-50 border border-purple-200' : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`padre-${grupo.key}`}
                        checked={isSelected}
                        onChange={() => setPadreSeleccionado(prev => ({ ...prev, [grupo.key]: p.id }))}
                        className="text-purple-600"
                      />
                      <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{p.sku}</span>
                      <span className="text-sm text-gray-700 flex-1">{desc || '-'}</span>
                      {isSelected && <span className="text-[10px] text-purple-600 font-medium">PADRE</span>}
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => handleVincular(grupo)}
                disabled={!padreSeleccionado[grupo.key] || procesando === grupo.key}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {procesando === grupo.key ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Vinculando...</>
                ) : (
                  <><Link2 className="h-4 w-4" /> Vincular como variantes</>
                )}
              </button>
            </div>
          ))}

          {/* Grupos ya vinculados */}
          {gruposVinculados.map(grupo => (
            <div key={grupo.key} className="border border-green-200 bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">{grupo.marca} — {grupo.nombreComercial}</p>
                  <p className="text-xs text-green-600">{grupo.productos.length} productos vinculados</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
