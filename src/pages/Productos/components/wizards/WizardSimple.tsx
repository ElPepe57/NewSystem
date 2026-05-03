/**
 * WizardSimple · Wizard crear PRODUCTO ÚNICO · F5(D) Modal 1 paso
 *
 * Mockup canónico: docs/mockups/productos/17-wizard-crear-simple.html
 *
 * Estructura:
 *   - Modal centrado max-w-3xl con header gradient F6.1
 *   - 4 secciones colapsables (acordeón):
 *     1. Origen · País + método envío + flete + peso
 *     2. Básico · Nombre + marca + presentación + dosaje + contenido + UPC
 *     3. Clasificación · Línea negocio + tipo + categorías + etiquetas (placeholder)
 *     4. Inventario · Stock mínimo + stock máximo
 *   - Solo 1 expandida a la vez (acordeón) · numeración + estado visual
 *   - Footer: cancelar / "Crear producto" disabled si campos requeridos vacíos
 *
 * Output: llama onSubmit(data) con ProductoFormData mínimo · el padre maneja
 *         la persistencia (productoStore.createProducto).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Package, Check, Lightbulb } from 'lucide-react';
import type { ProductoFormData, Presentacion } from '../../../../types/producto.types';
import { SeccionColapsable } from './SeccionColapsable';

interface WizardSimpleProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ProductoFormData>) => Promise<void> | void;
  /** Lista de líneas de negocio disponibles (id + nombre) */
  lineasNegocio?: Array<{ id: string; nombre: string }>;
}

type SeccionKey = 'origen' | 'basico' | 'clasificacion' | 'inventario';

const PRESENTACIONES: { value: Presentacion; label: string }[] = [
  { value: 'capsulas', label: 'Cápsulas' },
  { value: 'capsulas_blandas', label: 'Cápsulas blandas' },
  { value: 'tabletas', label: 'Tabletas' },
  { value: 'gomitas', label: 'Gomitas' },
  { value: 'polvo', label: 'Polvo' },
  { value: 'liquido', label: 'Líquido' },
];

// GAP-143 fix · paisOrigen ahora se guarda como CODIGO ('USA', 'KOR', etc.)
// para coherencia con productos legacy y filtros · label es solo display
const PAISES = [
  { value: 'USA', label: 'Estados Unidos', emoji: '🇺🇸' },
  { value: 'KOR', label: 'Corea del Sur', emoji: '🇰🇷' },
  { value: 'CHN', label: 'China', emoji: '🇨🇳' },
  { value: 'FRA', label: 'Francia', emoji: '🇫🇷' },
  { value: 'PER', label: 'Perú', emoji: '🇵🇪' },
];

export const WizardSimple: React.FC<WizardSimpleProps> = ({ open, onClose, onSubmit, lineasNegocio = [] }) => {
  const [seccionAbierta, setSeccionAbierta] = useState<SeccionKey>('origen');
  const [submitting, setSubmitting] = useState(false);

  // Estado del form
  const [paisOrigen, setPaisOrigen] = useState('USA');
  const [costoFlete, setCostoFlete] = useState<string>('');
  const [pesoLibras, setPesoLibras] = useState<string>('');

  const [nombreComercial, setNombreComercial] = useState('');
  const [marca, setMarca] = useState('');
  const [presentacion, setPresentacion] = useState<Presentacion>('capsulas');
  const [dosaje, setDosaje] = useState('');
  const [contenido, setContenido] = useState('');
  const [codigoUPC, setCodigoUPC] = useState('');
  const [sabor, setSabor] = useState('');

  const [lineaNegocioId, setLineaNegocioId] = useState('');

  const [stockMinimo, setStockMinimo] = useState<string>('5');
  const [stockMaximo, setStockMaximo] = useState<string>('100');

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setSeccionAbierta('origen');
      setSubmitting(false);
    }
  }, [open]);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Validación de cada sección
  const seccionesEstado = useMemo(() => ({
    origen: paisOrigen.length > 0,
    basico: nombreComercial.trim().length > 0 && marca.trim().length > 0,
    clasificacion: true, // opcional
    inventario: parseInt(stockMinimo) >= 0 && parseInt(stockMaximo) > 0,
  }), [paisOrigen, nombreComercial, marca, stockMinimo, stockMaximo]);

  const camposRequeridosOK = seccionesEstado.basico && seccionesEstado.origen && seccionesEstado.inventario;

  const toggleSeccion = (s: SeccionKey) => {
    setSeccionAbierta(prev => (prev === s ? prev : s));
  };

  const handleSubmit = async () => {
    if (!camposRequeridosOK || submitting) return;
    setSubmitting(true);
    try {
      const data: Partial<ProductoFormData> = {
        marca: marca.trim(),
        nombreComercial: nombreComercial.trim(),
        presentacion,
        dosaje: dosaje.trim(),
        contenido: contenido.trim(),
        sabor: sabor.trim() || undefined,
        codigoUPC: codigoUPC.trim(),
        // Legacy compat (deprecated pero requeridos por el shape)
        grupo: '',
        subgrupo: '',
        // Origen
        paisOrigen,
        costoFleteInternacional: costoFlete ? parseFloat(costoFlete) : undefined,
        pesoLibras: pesoLibras ? parseFloat(pesoLibras) : undefined,
        // Clasificación
        lineaNegocioId: lineaNegocioId || undefined,
        // Stock
        stockMinimo: parseInt(stockMinimo) || 0,
        stockMaximo: parseInt(stockMaximo) || 100,
      };
      await onSubmit(data);
      // El parent cierra el modal después de éxito
    } catch (err) {
      console.error('[WizardSimple] error en submit', err);
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
        aria-label="Cerrar wizard"
      />

      <div className="relative w-full lg:w-auto lg:max-w-3xl lg:mx-auto bg-white lg:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Drag handle mobile */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-4 lg:px-6 py-3 lg:py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 lg:gap-3 min-w-0">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 lg:w-5 lg:h-5 text-teal-700" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base lg:text-lg font-bold text-slate-900">Crear producto único</h2>
                <p className="text-[11px] lg:text-xs text-slate-500 mt-0.5">Sin variantes · 1 SKU único en el catálogo</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 flex-shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body · 4 secciones acordeón */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-5 space-y-3">
          {/* Sección 1 · Origen */}
          <SeccionColapsable
            numero={1}
            titulo="Origen"
            subtitulo="País + método de envío"
            expanded={seccionAbierta === 'origen'}
            onToggle={() => toggleSeccion('origen')}
            estado={seccionAbierta === 'origen' ? 'active' : seccionesEstado.origen ? 'complete' : 'inactive'}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Field label="País origen *" required>
                <select
                  value={paisOrigen}
                  onChange={e => setPaisOrigen(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  {PAISES.map(p => (
                    <option key={p.value} value={p.value}>
                      {p.emoji} {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Costo flete intl. (USD)">
                <input
                  type="number"
                  step="0.01"
                  value={costoFlete}
                  onChange={e => setCostoFlete(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                />
              </Field>
              <Field label="Peso unitario (lb)">
                <input
                  type="number"
                  step="0.01"
                  value={pesoLibras}
                  onChange={e => setPesoLibras(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                />
              </Field>
            </div>
          </SeccionColapsable>

          {/* Sección 2 · Básico */}
          <SeccionColapsable
            numero={2}
            titulo="Básico"
            subtitulo="Nombre, marca, presentación"
            expanded={seccionAbierta === 'basico'}
            onToggle={() => toggleSeccion('basico')}
            estado={seccionAbierta === 'basico' ? 'active' : seccionesEstado.basico ? 'complete' : 'inactive'}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Field label="Nombre comercial *" required className="sm:col-span-2">
                <input
                  type="text"
                  value={nombreComercial}
                  onChange={e => setNombreComercial(e.target.value)}
                  placeholder="ej. Vitamin C Brightening Serum"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Marca *" required>
                <input
                  type="text"
                  value={marca}
                  onChange={e => setMarca(e.target.value)}
                  placeholder="ej. SkinCeuticals"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Presentación *" required>
                <select
                  value={presentacion}
                  onChange={e => setPresentacion(e.target.value as Presentacion)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  {PRESENTACIONES.map(p => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Dosaje">
                <input
                  type="text"
                  value={dosaje}
                  onChange={e => setDosaje(e.target.value)}
                  placeholder="ej. 1000mg"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Contenido">
                <input
                  type="text"
                  value={contenido}
                  onChange={e => setContenido(e.target.value)}
                  placeholder="ej. 60 cápsulas / 30 ml"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Sabor (opcional)">
                <input
                  type="text"
                  value={sabor}
                  onChange={e => setSabor(e.target.value)}
                  placeholder="ej. Limón"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Código UPC (opcional)">
                <input
                  type="text"
                  value={codigoUPC}
                  onChange={e => setCodigoUPC(e.target.value)}
                  placeholder="ej. 7501234567890"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                />
              </Field>
            </div>
          </SeccionColapsable>

          {/* Sección 3 · Clasificación */}
          <SeccionColapsable
            numero={3}
            titulo="Clasificación"
            subtitulo="Línea de negocio + atributos"
            expanded={seccionAbierta === 'clasificacion'}
            onToggle={() => toggleSeccion('clasificacion')}
            estado={seccionAbierta === 'clasificacion' ? 'active' : 'inactive'}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Field label="Línea de negocio">
                <select
                  value={lineaNegocioId}
                  onChange={e => setLineaNegocioId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Sin línea</option>
                  {lineasNegocio.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="text-[11px] text-slate-500 italic mt-2">
              Categorías, etiquetas y atributos avanzados se pueden agregar después editando el producto.
            </div>
          </SeccionColapsable>

          {/* Sección 4 · Inventario */}
          <SeccionColapsable
            numero={4}
            titulo="Inventario"
            subtitulo="Stock mínimo + máximo"
            expanded={seccionAbierta === 'inventario'}
            onToggle={() => toggleSeccion('inventario')}
            estado={seccionAbierta === 'inventario' ? 'active' : seccionesEstado.inventario ? 'complete' : 'inactive'}
          >
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Stock mínimo *" required>
                <input
                  type="number"
                  min="0"
                  value={stockMinimo}
                  onChange={e => setStockMinimo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                />
              </Field>
              <Field label="Stock máximo *" required>
                <input
                  type="number"
                  min="1"
                  value={stockMaximo}
                  onChange={e => setStockMaximo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                />
              </Field>
            </div>
            <div className="text-[11px] text-slate-500 italic mt-2">
              El stock mínimo dispara la alerta "Stock crítico" en el listado.
            </div>
          </SeccionColapsable>

          {/* Banner sugerencia variantes (placeholder · Fase 9 hará la detección real) */}
          {nombreComercial.length >= 5 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs flex-1">
                <div className="font-bold text-amber-900">¿Es una variante de un producto existente?</div>
                <div className="text-amber-800">
                  Si {nombreComercial.split(' ')[0]} ya existe en otra presentación, considera usar "Variante de producto
                  existente" en lugar de crear duplicado.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-2.5 lg:py-3 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500">
            {camposRequeridosOK ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span>Listo para crear</span>
              </>
            ) : (
              <span>Completa los campos marcados con *</span>
            )}
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
              disabled={!camposRequeridosOK || submitting}
              className="px-4 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              {submitting ? 'Creando...' : 'Crear producto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Field helper ────────────────────────────────────────────────────────────

const Field: React.FC<{ label: string; required?: boolean; className?: string; children: React.ReactNode }> = ({
  label,
  required,
  className = '',
  children,
}) => (
  <div className={className}>
    <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
      {label}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);
