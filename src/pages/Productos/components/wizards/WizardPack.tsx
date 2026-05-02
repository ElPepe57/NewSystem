/**
 * WizardPack · Wizard PACK / KIT · F5(D) Modal con secciones + componentes
 *
 * Mockup canónico: docs/mockups/productos/20-wizard-crear-pack.html
 *
 * 3 secciones (modal único · no stepper):
 *   1. Datos del pack (nombre · marca · línea)
 *   2. Componentes (vinculados o exclusivos · banner regla canónica G4 · tabla
 *      con stock suelto inline canónico G5 · totales)
 *   3. Precio del pack (precio sueltos auto · descuento % · precio final)
 *
 * Output: ProductoFormData con esPack=true + componentesPack[]
 *
 * Decisiones canónicas aplicadas (Sesión 3.1 gaps):
 *   - G4: banner ámbar "Vender pack NO descuenta stock vinculado"
 *   - G5: Stock suelto inline + nombre vinculado con underline
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Gift,
  Plus,
  Trash2,
  Info,
  Check,
  Droplets,
  FileText,
  Search,
} from 'lucide-react';
import type { Producto, ProductoFormData, ComponentePack, Presentacion } from '../../../../types/producto.types';

interface WizardPackProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ProductoFormData>) => Promise<void>;
  /** Productos del catálogo · usado para buscar componentes vinculados */
  productosDisponibles?: Producto[];
  lineasNegocio?: Array<{ id: string; nombre: string }>;
}

interface ComponenteEntry extends ComponentePack {
  _localId: string; // id temporal para react keys
  esVinculado: boolean;
  precioUnit?: number;
  stockSuelto?: number;
  precioRetail?: number; // para calcular ahorro vs sueltos
}

export const WizardPack: React.FC<WizardPackProps> = ({
  open,
  onClose,
  onSubmit,
  productosDisponibles = [],
  lineasNegocio = [],
}) => {
  const [submitting, setSubmitting] = useState(false);

  // Sección 1
  const [nombrePack, setNombrePack] = useState('');
  const [marca, setMarca] = useState('Vita Skin Peru');
  const [lineaNegocioId, setLineaNegocioId] = useState('');

  // Sección 2 · componentes
  const [componentes, setComponentes] = useState<ComponenteEntry[]>([]);
  const [showBuscador, setShowBuscador] = useState(false);
  const [busquedaTerm, setBusquedaTerm] = useState('');

  // Sección 3 · precio
  const [descuentoPct, setDescuentoPct] = useState('15');
  const [precioPackOverride, setPrecioPackOverride] = useState('');

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setNombrePack('');
      setMarca('Vita Skin Peru');
      setLineaNegocioId('');
      setComponentes([]);
      setDescuentoPct('15');
      setPrecioPackOverride('');
      setShowBuscador(false);
      setBusquedaTerm('');
    }
  }, [open]);

  // ESC
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showBuscador) setShowBuscador(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose, showBuscador]);

  // ─── Cálculos ─────────────────────────────────────────────────────────────
  const totales = useMemo(() => {
    const costoTotal = componentes.reduce((acc, c) => acc + (c.precioUnit ?? 0) * (c.cantidad ?? 1), 0);
    const valorSueltos = componentes.reduce(
      (acc, c) => acc + (c.precioRetail ?? (c.precioUnit ?? 0) * 1.5) * (c.cantidad ?? 1),
      0
    );
    const descPct = parseFloat(descuentoPct) || 0;
    const precioCalculado = valorSueltos * (1 - descPct / 100);
    const precioFinal = precioPackOverride ? parseFloat(precioPackOverride) : precioCalculado;
    const margen = precioFinal > 0 && costoTotal > 0 ? Math.round(((precioFinal - costoTotal) / precioFinal) * 100) : 0;
    const ganancia = precioFinal - costoTotal;
    const ahorro = Math.max(0, valorSueltos - precioFinal);
    const ahorroPct = valorSueltos > 0 ? Math.round((ahorro / valorSueltos) * 100) : 0;
    return { costoTotal, valorSueltos, precioCalculado, precioFinal, margen, ganancia, ahorro, ahorroPct };
  }, [componentes, descuentoPct, precioPackOverride]);

  // Validación
  const datosOK = nombrePack.trim().length > 0 && marca.trim().length > 0 && lineaNegocioId.length > 0;
  const componentesOK = componentes.length > 0;
  const precioOK = totales.precioFinal > 0;
  const todoOK = datosOK && componentesOK && precioOK;

  // ─── Handlers componentes ──────────────────────────────────────────────────
  const addExclusivo = () => {
    setComponentes(prev => [
      ...prev,
      {
        _localId: `exc-${Date.now()}`,
        esVinculado: false,
        nombre: '',
        cantidad: 1,
        precioUnit: 0,
      },
    ]);
  };

  const addVinculado = (producto: Producto) => {
    setComponentes(prev => [
      ...prev,
      {
        _localId: `vinc-${Date.now()}-${producto.id}`,
        esVinculado: true,
        productoId: producto.id,
        sku: producto.sku,
        marca: producto.marca,
        nombre: producto.nombreComercial,
        cantidad: 1,
        precioUnit: (producto as any).precioVenta ?? producto.investigacion?.precioSugeridoCalculado ?? 0,
        precioRetail: (producto as any).precioVenta ?? producto.investigacion?.precioSugeridoCalculado ?? 0,
        stockSuelto: (producto as any).stockDisponible ?? (producto as any).stockTotal ?? 0,
      },
    ]);
    setShowBuscador(false);
    setBusquedaTerm('');
  };

  const updateComponente = (localId: string, patch: Partial<ComponenteEntry>) => {
    setComponentes(prev => prev.map(c => (c._localId === localId ? { ...c, ...patch } : c)));
  };

  const removeComponente = (localId: string) => {
    setComponentes(prev => prev.filter(c => c._localId !== localId));
  };

  // Búsqueda de productos vinculables
  const productosFiltrados = useMemo(() => {
    if (!busquedaTerm.trim()) return productosDisponibles.slice(0, 8);
    const term = busquedaTerm.toLowerCase();
    return productosDisponibles
      .filter(
        p =>
          p.nombreComercial.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          p.marca.toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [busquedaTerm, productosDisponibles]);

  // Submit
  const handleSubmit = async () => {
    if (!todoOK || submitting) return;
    setSubmitting(true);
    try {
      const componentesPack: ComponentePack[] = componentes.map(c => {
        const { _localId, esVinculado, precioUnit, stockSuelto, precioRetail, ...rest } = c;
        const compData: any = { ...rest };
        // Asegurar que precio se guarde
        if (precioUnit !== undefined) compData.precio = precioUnit;
        return compData;
      });

      const data: Partial<ProductoFormData> = {
        marca: marca.trim(),
        nombreComercial: nombrePack.trim(),
        presentacion: 'capsulas' as Presentacion, // valor default · pack no usa
        dosaje: '',
        contenido: `${componentes.length} componentes`,
        codigoUPC: '',
        grupo: '',
        subgrupo: '',
        lineaNegocioId,
        stockMinimo: 0,
        stockMaximo: 100,
        esPack: true,
        componentesPack,
        // Campo no oficial pero usado por el modal · el service acepta data: any
        ...({ precioVenta: totales.precioFinal } as any),
      };
      await onSubmit(data);
    } catch (err) {
      console.error('[WizardPack] error', err);
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        aria-label="Cerrar"
      />

      <div className="relative w-full lg:w-auto lg:max-w-4xl lg:mx-auto bg-white lg:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[95vh] lg:max-h-[90vh]">
        {/* Drag handle mobile */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-4 lg:px-6 py-3 lg:py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 lg:gap-3 min-w-0">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Gift className="w-4 h-4 lg:w-5 lg:h-5 text-purple-700" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base lg:text-lg font-bold text-slate-900">Crear Pack / Kit</h2>
                <p className="text-[11px] lg:text-xs text-slate-500 mt-0.5">
                  Cajita armada de fábrica con varios productos adentro · no desarmable
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-5 space-y-3 lg:space-y-4">
          {/* Sección 1 · Datos */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold">
                1
              </span>
              Datos del pack
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Field label="Nombre del pack *" className="sm:col-span-2">
                <input
                  type="text"
                  value={nombrePack}
                  onChange={e => setNombrePack(e.target.value)}
                  placeholder="ej. Skincare Routine Travel Kit"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300"
                />
              </Field>
              <Field label="Marca *">
                <input
                  type="text"
                  value={marca}
                  onChange={e => setMarca(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Línea de negocio *">
                <select
                  value={lineaNegocioId}
                  onChange={e => setLineaNegocioId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Seleccionar línea</option>
                  {lineasNegocio.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* Sección 2 · Componentes */}
          <div className="bg-white border-2 border-purple-300 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold">
                  2
                </span>
                Componentes
                <span className="text-[10px] tabular-nums bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                  {componentes.length} agregados
                </span>
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowBuscador(true)}
                  className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded"
                >
                  + Vinculado
                </button>
                <button
                  type="button"
                  onClick={addExclusivo}
                  className="px-2 py-1 text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded"
                >
                  + Exclusivo
                </button>
              </div>
            </div>

            {/* Banner regla G4 (canónico Sesión 3.1) */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <Info className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 text-xs text-amber-900 leading-relaxed">
                <div className="font-bold mb-0.5">Regla del pack · stock</div>
                <div>
                  Vender este pack <strong>no descuenta</strong> stock de los componentes vinculados (son unidades físicas
                  distintas que viven en su propio SKU). El reporting cruzado se calcula aparte en BI.
                </div>
              </div>
            </div>

            {/* Tabla componentes o empty state */}
            {componentes.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center text-xs text-slate-500">
                Aún no agregaste componentes · usa los botones <strong className="text-emerald-700">+ Vinculado</strong> o{' '}
                <strong className="text-purple-700">+ Exclusivo</strong> arriba.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                {/* Header tabla · solo desktop */}
                <div className="hidden lg:grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  <div className="col-span-1">Tipo</div>
                  <div className="col-span-5">Componente</div>
                  <div className="col-span-1 text-center">Cant.</div>
                  <div className="col-span-2 text-right">Costo unit.</div>
                  <div className="col-span-2 text-right">Subtotal</div>
                  <div className="col-span-1"></div>
                </div>

                <div className="divide-y divide-slate-100">
                  {componentes.map((c, idx) => (
                    <ComponenteRow
                      key={c._localId}
                      comp={c}
                      onUpdate={patch => updateComponente(c._localId, patch)}
                      onRemove={() => removeComponente(c._localId)}
                    />
                  ))}
                </div>

                {/* Totales */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 border-t border-slate-200 text-[11px] font-bold">
                  <div className="col-span-9 text-slate-700">Costo total componentes</div>
                  <div className="col-span-2 text-right text-slate-900 tabular-nums">S/ {totales.costoTotal.toFixed(2)}</div>
                  <div className="col-span-1"></div>
                </div>
              </div>
            )}
          </div>

          {/* Sección 3 · Precio */}
          {componentes.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold">
                  3
                </span>
                Precio del pack
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Precio sueltos (auto)">
                  <input
                    type="text"
                    value={`S/ ${totales.valorSueltos.toFixed(2)}`}
                    disabled
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 tabular-nums"
                  />
                </Field>
                <Field label="Descuento %">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={descuentoPct}
                    onChange={e => {
                      setDescuentoPct(e.target.value);
                      setPrecioPackOverride('');
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                  />
                </Field>
                <Field label="Precio pack final *">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={precioPackOverride || totales.precioCalculado.toFixed(2)}
                    onChange={e => setPrecioPackOverride(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg text-sm tabular-nums font-bold"
                  />
                </Field>
              </div>
              {precioOK && (
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-800">Margen del pack</span>
                    <span className="font-bold text-emerald-700 tabular-nums">
                      {totales.margen}% (S/ {totales.ganancia.toFixed(2)} ganancia)
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-emerald-800">Ahorro para el cliente</span>
                    <span className="font-bold text-emerald-700 tabular-nums">
                      S/ {totales.ahorro.toFixed(2)} ({totales.ahorroPct}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-2.5 lg:py-3 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500 min-w-0">
            <Info className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              El pack se vende como unidad propia · los componentes vinculados conservan su stock independiente.
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!todoOK || submitting}
              className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Gift className="w-3.5 h-3.5" />
              {submitting ? 'Creando...' : 'Crear pack'}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modal · Buscador de productos vinculables */}
      {showBuscador && (
        <BuscadorVinculadosOverlay
          term={busquedaTerm}
          onTermChange={setBusquedaTerm}
          productos={productosFiltrados}
          onSelect={addVinculado}
          onClose={() => setShowBuscador(false)}
          excluirIds={componentes.filter(c => c.esVinculado).map(c => c.productoId!).filter(Boolean)}
        />
      )}
    </div>
  );
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

const ComponenteRow: React.FC<{
  comp: ComponenteEntry;
  onUpdate: (patch: Partial<ComponenteEntry>) => void;
  onRemove: () => void;
}> = ({ comp, onUpdate, onRemove }) => {
  const subtotal = (comp.precioUnit ?? 0) * (comp.cantidad ?? 1);
  return (
    <div className="grid grid-cols-12 gap-2 items-center px-3 py-2.5">
      <div className="col-span-2 lg:col-span-1">
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
            comp.esVinculado ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'
          }`}
        >
          {comp.esVinculado ? 'VINC' : 'EXC'}
        </span>
      </div>
      <div className="col-span-10 lg:col-span-5 flex items-center gap-2 min-w-0">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
            comp.esVinculado ? 'bg-amber-50' : 'bg-slate-100'
          }`}
        >
          {comp.esVinculado ? (
            <Droplets className="w-3.5 h-3.5 text-amber-700" />
          ) : (
            <FileText className="w-3.5 h-3.5 text-slate-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {comp.esVinculado ? (
            <>
              <div className="text-xs font-semibold text-blue-700 hover:underline truncate">{comp.nombre}</div>
              <div className="text-[9px] text-slate-500 truncate">
                <span className="font-mono">{comp.sku}</span>
                {comp.stockSuelto !== undefined && (
                  <>
                    {' · '}
                    <span
                      className={`font-bold ${
                        comp.stockSuelto >= 20
                          ? 'text-emerald-600'
                          : comp.stockSuelto >= 5
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      Stock suelto: {comp.stockSuelto}
                    </span>
                  </>
                )}
              </div>
            </>
          ) : (
            <input
              type="text"
              value={comp.nombre}
              onChange={e => onUpdate({ nombre: e.target.value })}
              placeholder="ej. Tarjeta de bienvenida"
              className="w-full px-2 py-1 text-xs border border-slate-200 rounded italic"
            />
          )}
        </div>
      </div>
      <div className="col-span-3 lg:col-span-1 text-center">
        <input
          type="number"
          min="1"
          value={comp.cantidad ?? 1}
          onChange={e => onUpdate({ cantidad: parseInt(e.target.value) || 1 })}
          className="w-12 px-1.5 py-1 text-xs text-center border border-slate-200 rounded tabular-nums"
        />
      </div>
      <div className="col-span-4 lg:col-span-2 text-right">
        <input
          type="number"
          step="0.01"
          min="0"
          value={comp.precioUnit ?? ''}
          onChange={e => onUpdate({ precioUnit: e.target.value ? parseFloat(e.target.value) : 0 })}
          placeholder="0.00"
          className="w-full px-2 py-1 text-xs text-right border border-slate-200 rounded tabular-nums"
        />
      </div>
      <div className="col-span-4 lg:col-span-2 text-right text-xs font-semibold tabular-nums text-slate-900">
        S/ {subtotal.toFixed(2)}
      </div>
      <div className="col-span-1 text-right">
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-slate-400 hover:text-rose-500"
          aria-label="Eliminar"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

const BuscadorVinculadosOverlay: React.FC<{
  term: string;
  onTermChange: (t: string) => void;
  productos: Producto[];
  onSelect: (p: Producto) => void;
  onClose: () => void;
  excluirIds: string[];
}> = ({ term, onTermChange, productos, onSelect, onClose, excluirIds }) => {
  const filtered = productos.filter(p => !excluirIds.includes(p.id));
  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center pt-12 px-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl flex flex-col max-h-[70vh]">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={term}
            onChange={e => onTermChange(e.target.value)}
            placeholder="Buscar producto vinculado..."
            autoFocus
            className="flex-1 text-sm border-0 outline-none"
          />
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              {term ? `Sin resultados para "${term}"` : 'No hay productos disponibles'}
            </div>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex items-center gap-2.5"
              >
                <div className="w-8 h-8 rounded bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Droplets className="w-4 h-4 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{p.nombreComercial}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">
                    {p.sku} · {p.marca}
                  </div>
                </div>
                <Plus className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({
  label,
  className = '',
  children,
}) => (
  <div className={className}>
    <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">{label}</label>
    {children}
  </div>
);
