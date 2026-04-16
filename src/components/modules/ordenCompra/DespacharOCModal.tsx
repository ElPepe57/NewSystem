import React, { useState, useRef, useEffect } from 'react';
import { X, Truck, Package, Search, Plus, Check, Calendar, Hash } from 'lucide-react';
import { Button } from '../../common';
import type { Colaborador, TipoColaborador } from '../../../types/colaborador.types';
import type { OrdenCompra } from '../../../types/ordenCompra.types';

export interface DespacharOCResult {
  courierColaboradorId?: string;   // ID si se eligió uno existente o se creó nuevo
  courierNombre: string;            // siempre el nombre (para guardar en envio.courier)
  numeroTracking?: string;
  fechaDespacho: Date;
  // Si se creó nuevo, datos para que el caller lo persista:
  crearNuevoColaborador?: { nombre: string; tipo: TipoColaborador };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orden: OrdenCompra;
  tituloEstado: string;
  colaboradores: Colaborador[];
  onConfirm: (result: DespacharOCResult) => Promise<void>;
}

export const DespacharOCModal: React.FC<Props> = ({
  isOpen,
  onClose,
  orden,
  tituloEstado,
  colaboradores,
  onConfirm,
}) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Colaborador | null>(null);
  const [tipoNuevo, setTipoNuevo] = useState<TipoColaborador>('courier_externo');
  const [showDropdown, setShowDropdown] = useState(false);
  const [tracking, setTracking] = useState('');
  const [fecha, setFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Couriers disponibles (couriers internacionales + transportistas locales activos)
  const couriersDisponibles = colaboradores.filter(
    c => (c.tipo === 'courier_externo' || c.tipo === 'transportista_local') && c.estado === 'activo'
  );

  // Filtrado por query
  const sugerencias = query.trim().length === 0
    ? couriersDisponibles
    : couriersDisponibles.filter(c => c.nombre.toLowerCase().includes(query.toLowerCase().trim()));

  const matchExacto = sugerencias.find(c => c.nombre.toLowerCase() === query.trim().toLowerCase());
  const puedeCrear = query.trim().length >= 2 && !matchExacto;

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset al cerrar / pre-fill al abrir desde datos de la OC (ida y vuelta)
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelected(null);
      setTracking('');
      setFecha(new Date().toISOString().split('T')[0]);
      setShowDropdown(false);
    } else {
      // S39: Pre-fill courier si la OC ya tiene uno (seleccionado en wizard o despacho previo)
      if (orden.colaboradorTransporteId) {
        const existing = couriersDisponibles.find(c => c.id === orden.colaboradorTransporteId);
        if (existing) {
          setSelected(existing);
          setQuery(existing.nombre);
        } else if (orden.colaboradorTransporteNombre) {
          setQuery(orden.colaboradorTransporteNombre);
        }
      } else if (orden.courier) {
        setQuery(orden.courier);
      }
      if (orden.numeroTracking) setTracking(orden.numeroTracking);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSelectExistente = (c: Colaborador) => {
    setSelected(c);
    setQuery(c.nombre);
    setShowDropdown(false);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery('');
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fechaDate = new Date(fecha);
    if (isNaN(fechaDate.getTime())) return;

    let result: DespacharOCResult;

    if (selected) {
      result = {
        courierColaboradorId: selected.id,
        courierNombre: selected.nombre,
        numeroTracking: tracking.trim() || undefined,
        fechaDespacho: fechaDate,
      };
    } else if (query.trim()) {
      // Crear nuevo
      result = {
        courierNombre: query.trim(),
        numeroTracking: tracking.trim() || undefined,
        fechaDespacho: fechaDate,
        crearNuevoColaborador: { nombre: query.trim(), tipo: tipoNuevo },
      };
    } else {
      return; // sin courier no avanza
    }

    setSubmitting(true);
    try {
      await onConfirm(result);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
              <Truck className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{tituloEstado}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Esto activa el Envío vinculado con info real del despacho
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Context info */}
        <div className="px-6 py-3 bg-slate-50/50 grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-slate-500">Orden</div>
            <div className="font-semibold text-slate-900">{orden.numeroOrden}</div>
          </div>
          <div>
            <div className="text-slate-500">Proveedor</div>
            <div className="font-semibold text-slate-900 truncate">{orden.nombreProveedor || '—'}</div>
          </div>
          {orden.totalUSD != null && (
            <div>
              <div className="text-slate-500">Total</div>
              <div className="font-semibold text-slate-900">${orden.totalUSD.toFixed(2)}</div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Courier autocomplete */}
          <div ref={containerRef} className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Courier <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Buscar o escribir nombre (ej: DHL, Olva...)"
                className={`w-full pl-9 pr-9 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-teal-300 focus:outline-none ${
                  selected ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300'
                }`}
                autoComplete="off"
              />
              {selected && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && (sugerencias.length > 0 || puedeCrear) && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg border border-slate-200 max-h-64 overflow-auto">
                {sugerencias.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectExistente(c)}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 border-b border-slate-50 last:border-0 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {c.tipo === 'courier_externo' ? (
                        <Package className="w-4 h-4 text-sky-500 flex-shrink-0" />
                      ) : (
                        <Truck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      )}
                      <span className="text-sm text-slate-900 truncate">{c.nombre}</span>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {c.tipo === 'courier_externo' ? 'Internacional' : 'Local'}
                    </span>
                  </button>
                ))}

                {puedeCrear && (
                  <div className="bg-teal-50/50 border-t-2 border-teal-100 px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-2">
                      <Plus className="w-4 h-4 text-teal-600" />
                      <span className="text-sm text-slate-700">
                        Crear <span className="font-semibold text-teal-700">"{query.trim()}"</span> como:
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setTipoNuevo('courier_externo'); setShowDropdown(false); }}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                          tipoNuevo === 'courier_externo' && !showDropdown
                            ? 'bg-sky-100 border-sky-300 text-sky-800'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-sky-200'
                        }`}
                      >
                        <Package className="w-3.5 h-3.5 inline mr-1" />
                        Internacional
                      </button>
                      <button
                        type="button"
                        onClick={() => { setTipoNuevo('transportista_local'); setShowDropdown(false); }}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                          tipoNuevo === 'transportista_local' && !showDropdown
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-200'
                        }`}
                      >
                        <Truck className="w-3.5 h-3.5 inline mr-1" />
                        Local Perú
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Indicadores fuera del dropdown */}
            {selected && (
              <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                <Check className="w-3 h-3" /> Existente — tipo: {selected.tipo === 'courier_externo' ? 'internacional' : 'local'}
              </p>
            )}
            {!selected && query.trim() && puedeCrear && !showDropdown && (
              <p className="mt-1.5 text-xs text-teal-600 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Se creará como {tipoNuevo === 'courier_externo' ? 'courier internacional' : 'transportista local'}
              </p>
            )}
          </div>

          {/* Tracking */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Número de tracking <span className="text-slate-400 text-xs">(opcional)</span>
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="Ej: 1Z999AA10123456784"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-300 focus:outline-none"
              />
            </div>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Fecha de despacho
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-300 focus:outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={!query.trim()}
            >
              {tituloEstado}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
