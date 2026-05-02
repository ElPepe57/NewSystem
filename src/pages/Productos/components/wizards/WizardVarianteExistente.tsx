/**
 * WizardVarianteExistente · Wizard agregar variante a producto existente
 *
 * Mockups canónicos:
 *   - 19: Wizard variante existente (3 zonas) · vista combinada
 *   - 21: Modal Buscador Grupo (autocomplete con highlight) · 1ra zona
 *   - 22: Form Variante Reducida (cantidad/unidad/etiqueta + SKU auto) · 2da zona
 *
 * Flujo:
 *   1. Modal abre con buscador (autocomplete · solo productos NO packs)
 *   2. Usuario selecciona producto base
 *   3. Form variante reducida: cantidad/unidad/etiqueta · SKU preview
 *   4. Bloque "Otras variantes del mismo producto" como contexto
 *   5. Stock inicial opcional
 *   6. Submit: crea nuevo Producto con grupoVarianteId del seleccionado
 *
 * Output: ProductoFormData con grupoVarianteId + varianteLabel + datos del padre
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Plus,
  Package,
} from 'lucide-react';
import type { Producto, ProductoFormData } from '../../../../types/producto.types';
import { ProductoAvatar, inferLineaFromProducto } from '../shared/ProductoAvatar';

interface WizardVarianteExistenteProps {
  open: boolean;
  onClose: () => void;
  /** Lista de productos del catálogo · se filtran los packs y archivados */
  productosDisponibles: Producto[];
  /** Lista completa para mostrar hermanas del seleccionado */
  todosLosProductos: Producto[];
  onSubmit: (data: Partial<ProductoFormData>) => Promise<void>;
}

const UNIDADES = [
  { value: 'ml', label: 'ml' },
  { value: 'caps', label: 'caps' },
  { value: 'tabs', label: 'tabs' },
  { value: 'g', label: 'g' },
  { value: 'oz', label: 'oz' },
  { value: 'unidades', label: 'unidades' },
];

export const WizardVarianteExistente: React.FC<WizardVarianteExistenteProps> = ({
  open,
  onClose,
  productosDisponibles,
  todosLosProductos,
  onSubmit,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [productoBase, setProductoBase] = useState<Producto | null>(null);
  const [busquedaTerm, setBusquedaTerm] = useState('');

  // Form variante
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState('ml');
  const [etiqueta, setEtiqueta] = useState('');
  const [stockInicial, setStockInicial] = useState('');

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setProductoBase(null);
      setBusquedaTerm('');
      setCantidad('');
      setUnidad('ml');
      setEtiqueta('');
      setStockInicial('');
      setSubmitting(false);
    }
  }, [open]);

  // ESC
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  // Productos elegibles · NO packs · NO eliminados
  const productosElegibles = useMemo(() => {
    return productosDisponibles.filter(p => !p.esPack && p.estado !== 'eliminado');
  }, [productosDisponibles]);

  // Resultados con highlight del término buscado
  const resultados = useMemo(() => {
    const term = busquedaTerm.trim().toLowerCase();
    if (!term) return productosElegibles.slice(0, 8);
    return productosElegibles
      .filter(
        p =>
          p.nombreComercial.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          p.marca.toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [busquedaTerm, productosElegibles]);

  // Hermanas del producto seleccionado (incluye al base)
  const hermanasGrupo = useMemo(() => {
    if (!productoBase) return [];
    const grupoId = productoBase.grupoVarianteId;
    if (!grupoId) return [productoBase];
    return todosLosProductos.filter(p => p.grupoVarianteId === grupoId);
  }, [productoBase, todosLosProductos]);

  // SKU preview · "{producto.sku}-{cantidad}" o derivado
  const skuPreview = useMemo(() => {
    if (!productoBase) return '';
    const baseSku = productoBase.sku.replace(/-\d+(ml|caps|tabs|g|oz)?$/i, '');
    if (!cantidad) return `${baseSku}-?`;
    return `${baseSku}-${cantidad}`;
  }, [productoBase, cantidad]);

  // Validación
  const baseOK = !!productoBase;
  const formOK = baseOK && cantidad.trim().length > 0 && unidad.trim().length > 0;

  const handleSubmit = async () => {
    if (!formOK || !productoBase || submitting) return;
    setSubmitting(true);
    try {
      const cantNum = cantidad.trim();
      const uni = unidad.trim();
      const eti = etiqueta.trim();
      const contenido = `${cantNum} ${uni}`.trim();
      const varianteLabel = eti ? `${contenido} · ${eti}` : contenido;

      const data: Partial<ProductoFormData> = {
        // Heredar del producto base
        marca: productoBase.marca,
        marcaId: productoBase.marcaId,
        nombreComercial: productoBase.nombreComercial,
        presentacion: productoBase.presentacion,
        dosaje: uni === 'caps' || uni === 'tabs' ? cantNum : productoBase.dosaje ?? '',
        contenido,
        codigoUPC: '',
        grupo: '',
        subgrupo: '',
        // Heredar metadatos
        paisOrigen: productoBase.paisOrigen,
        lineaNegocioId: productoBase.lineaNegocioId,
        tipoProductoId: productoBase.tipoProductoId,
        categoriaIds: productoBase.categoriaIds,
        etiquetaIds: productoBase.etiquetaIds,
        atributosSkincare: productoBase.atributosSkincare,
        pesoLibras: productoBase.pesoLibras,
        costoFleteInternacional: productoBase.costoFleteInternacional,
        // Stock
        stockMinimo: productoBase.stockMinimo ?? 5,
        stockMaximo: productoBase.stockMaximo ?? 100,
        // Variante
        grupoVarianteId: productoBase.grupoVarianteId ?? productoBase.id,
        varianteLabel,
        esPrincipalGrupo: false,
      };

      await onSubmit(data);
    } catch (err) {
      console.error('[WizardVarianteExistente] error', err);
      setSubmitting(false);
    }
  };

  if (!open) return null;

  // Vista buscador (paso 1) · sin producto base aún
  if (!productoBase) {
    return (
      <BuscadorView
        term={busquedaTerm}
        onTermChange={setBusquedaTerm}
        resultados={resultados}
        onSelectProducto={setProductoBase}
        onClose={onClose}
      />
    );
  }

  // Vista form (paso 2) · con producto base seleccionado
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        aria-label="Cerrar"
      />

      <div className="relative w-full lg:w-auto lg:max-w-3xl lg:mx-auto bg-white lg:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[95vh] lg:max-h-[90vh]">
        {/* Drag handle mobile */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-4 lg:px-6 py-3 lg:py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 lg:gap-3 min-w-0">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Search className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base lg:text-lg font-bold text-slate-900">Variante de producto existente</h2>
                <p className="text-[11px] lg:text-xs text-slate-500 mt-0.5">
                  Buscar producto base y agregar nueva presentación
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

        {/* Body · 3 zonas */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-5 space-y-4">
          {/* ZONA 1 · Producto seleccionado */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-bold mb-2">
              1 · Producto base seleccionado
            </label>
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3 flex items-center gap-3">
              <ProductoAvatar
                linea={inferLineaFromProducto({
                  linea: productoBase.lineaNegocioNombre,
                  tipo: productoBase.tipoProducto?.nombre,
                })}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900 truncate">{productoBase.nombreComercial}</span>
                  {productoBase.lineaNegocioNombre && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold">
                      {productoBase.lineaNegocioNombre}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {productoBase.marca} · {hermanasGrupo.length} variante{hermanasGrupo.length === 1 ? '' : 's'} ya
                  existente{hermanasGrupo.length === 1 ? '' : 's'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProductoBase(null)}
                className="px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 rounded flex-shrink-0"
              >
                Cambiar
              </button>
            </div>
          </div>

          {/* ZONA 2 · Form variante reducida */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-bold mb-2">
              2 · Nueva variante
            </label>
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Cantidad *</label>
                  <input
                    type="text"
                    value={cantidad}
                    onChange={e => setCantidad(e.target.value)}
                    placeholder="ej. 50"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Unidad *</label>
                  <select
                    value={unidad}
                    onChange={e => setUnidad(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    {UNIDADES.map(u => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                    Etiqueta (opcional)
                  </label>
                  <input
                    type="text"
                    value={etiqueta}
                    onChange={e => setEtiqueta(e.target.value)}
                    placeholder="ej. Tamaño grande"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  SKU automático (preview)
                </label>
                <input
                  type="text"
                  value={skuPreview || '—'}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 font-mono"
                />
              </div>

              {/* Comparación con otras variantes · contexto */}
              {hermanasGrupo.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="text-[11px] font-bold text-amber-900 mb-2 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Otras variantes del mismo producto
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {hermanasGrupo.map(h => (
                      <span
                        key={h.id}
                        className="px-2 py-0.5 rounded bg-white border border-slate-200 tabular-nums"
                      >
                        {h.varianteLabel ?? h.contenido ?? '—'}
                      </span>
                    ))}
                    {cantidad && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-300 tabular-nums">
                        {cantidad} {unidad}
                        {etiqueta && ` · ${etiqueta}`} · NUEVA
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ZONA 3 · Stock inicial (opcional) */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-bold mb-2">
              3 · Stock inicial (opcional)
            </label>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                    Cantidad inicial
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stockInicial}
                    onChange={e => setStockInicial(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                  />
                </div>
                <div className="text-[11px] text-slate-500 italic flex items-end pb-2">
                  El stock se puede ajustar después desde el detalle del producto.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-2.5 lg:py-3 flex items-center justify-between gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setProductoBase(null)}
            disabled={submitting}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1 disabled:opacity-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cambiar producto</span>
            <span className="sm:hidden">Cambiar</span>
          </button>
          <div className="flex items-center gap-2">
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
              disabled={!formOK || submitting}
              className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              {submitting ? 'Creando...' : 'Crear variante'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Vista Buscador (paso 1) ─────────────────────────────────────────────────

const BuscadorView: React.FC<{
  term: string;
  onTermChange: (t: string) => void;
  resultados: Producto[];
  onSelectProducto: (p: Producto) => void;
  onClose: () => void;
}> = ({ term, onTermChange, resultados, onSelectProducto, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        aria-label="Cerrar buscador"
      />

      <div className="relative w-full lg:w-auto lg:max-w-2xl lg:mx-auto bg-white lg:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Drag handle mobile */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-4 lg:px-6 py-3 lg:py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 lg:gap-3 min-w-0">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Search className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base lg:text-lg font-bold text-slate-900">Buscar producto base</h2>
                <p className="text-[11px] lg:text-xs text-slate-500 mt-0.5">
                  ¿A qué producto le agregás la nueva variante?
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

        {/* Buscador input */}
        <div className="px-4 lg:px-5 py-3 lg:py-4 border-b border-slate-100 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={term}
              onChange={e => onTermChange(e.target.value)}
              placeholder="Buscar por nombre, marca, SKU..."
              autoFocus
              className="w-full pl-9 pr-9 py-2.5 text-sm border-2 border-emerald-300 rounded-lg ring-2 ring-emerald-100 focus:outline-none"
            />
            {term && (
              <button
                type="button"
                onClick={() => onTermChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            <span>Busca por nombre, marca, SKU. Solo se muestran productos sin pack.</span>
          </div>
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 lg:px-5 py-2 bg-slate-50 border-b border-slate-200 sticky top-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold tabular-nums">
              {resultados.length === 0
                ? 'Sin resultados'
                : `${resultados.length} resultado${resultados.length === 1 ? '' : 's'}`}
            </div>
          </div>
          {resultados.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Package className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-900 mb-1">
                {term ? `No encontramos "${term}"` : 'No hay productos disponibles'}
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {term
                  ? 'Intenta con otro término · o crea un producto nuevo desde la opción "Producto único".'
                  : 'Necesitas tener al menos 1 producto base para crear variantes.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {resultados.map(p => (
                <ResultadoRow key={p.id} producto={p} term={term} onSelect={() => onSelectProducto(p)} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-2.5 lg:py-3 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="text-[10px] text-slate-500 truncate">
            ¿No encontrás el producto? Crear "Producto único" desde el selector.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex-shrink-0"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

const ResultadoRow: React.FC<{ producto: Producto; term: string; onSelect: () => void }> = ({
  producto,
  term,
  onSelect,
}) => {
  const linea = inferLineaFromProducto({
    linea: producto.lineaNegocioNombre,
    tipo: producto.tipoProducto?.nombre,
  });

  // Renderizar nombre con highlight del término
  const nombreRender = useMemo(() => {
    if (!term) return producto.nombreComercial;
    const idx = producto.nombreComercial.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return producto.nombreComercial;
    return (
      <>
        {producto.nombreComercial.slice(0, idx)}
        <mark className="bg-amber-200 text-amber-900 px-0.5 rounded">
          {producto.nombreComercial.slice(idx, idx + term.length)}
        </mark>
        {producto.nombreComercial.slice(idx + term.length)}
      </>
    );
  }, [producto.nombreComercial, term]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full px-4 lg:px-5 py-3 hover:bg-slate-50 flex items-center gap-3 text-left transition-colors"
    >
      <ProductoAvatar linea={linea} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-900 truncate">{nombreRender}</span>
          {producto.lineaNegocioNombre && (
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold flex-shrink-0">
              {producto.lineaNegocioNombre}
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
          <span className="font-mono">{producto.sku}</span> · {producto.marca}
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
    </button>
  );
};
