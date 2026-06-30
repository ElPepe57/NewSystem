import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Trash2,
  Plus,
  Minus,
  Search,
  ScanLine,
  X,
  Info,
  Layers,
  Pill,
  Sparkles,
  History,
  Check,
  TrendingUp,
  ArrowDownLeft,
} from 'lucide-react';
import { cn } from '../../../../design-system';
import type { OCWizardState } from './ocWizardTypes';
import type { OCWizardAction } from './ocWizardReducer';
import type { ProductoOrden } from '../../../../types/ordenCompra.types';
import { ProductoAutocomplete } from '../../entidades/ProductoAutocomplete';
import type { ProductoSnapshot } from '../../entidades/ProductoAutocomplete';
import { buildProductoSnapshot, getDescripcionProducto } from '../../../../utils/producto.helpers';
import { useProductoStore } from '../../../../store/productoStore';
import { useOrdenCompraStore } from '../../../../store/ordenCompraStore';
import { BarcodeScanner } from '../../../common/BarcodeScanner';
import { ProductoService } from '../../../../services/producto.service';
// F3 · referencia de precio inline (histórico en-memoria · sin emojis · canon)
import { getReferenciaPreciosEnMemoria } from '../../../../services/ordenCompra.stats.service';
// F3 · motor PURO del semáforo de precio (UNA sola base · 3 bugs corregidos)
import { analizarPrecio } from '../../../../utils/precioInteligencia.helper';

// Referencia de precio que recibe cada fila (histórico + investigado del catálogo)
interface ReferenciaPrecio {
  ultimaCompra: number | null;
  promedio: number | null;
  investigado: number | null;
  nMuestras: number;
}

// Ícono tonal por línea (reemplaza el emoji · canon F8 · espejo de ProductoDisplay)
function iconoDeProducto(p: { atributosSkincare?: unknown; presentacion?: string; dosaje?: string; lineaNegocio?: string }) {
  if (p.atributosSkincare) return { Icon: Sparkles, bg: 'bg-pink-50', text: 'text-pink-600' };
  if (p.presentacion || p.dosaje || p.lineaNegocio === 'SUP') return { Icon: Pill, bg: 'bg-teal-50', text: 'text-teal-600' };
  return { Icon: Package, bg: 'bg-slate-100', text: 'text-slate-500' };
}

// ════════════════════════════════════════════════════════════════════════════
// StepProductos — Paso 2 OCWizardV3 (reescritura alineada al mockup S40)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Estructura fiel al mockup `rework-maestro-s40.html` pane-oc-2:
 *
 *   Header: "¿Qué productos comprar?" + subtítulo
 *   Row controls: [Search input flex-1] + [Botón Escanear]
 *   Tabla con:
 *     - Header "X productos agregados · Subtotal: $Y" bg-slate-50
 *     - Filas producto: emoji gradient + nombre + SKU + chip marca + desc rica
 *       + stepper ± + input precio + subtotal blue + trash
 *     - Footer "+ Agregar otro producto" border dashed
 *   Toggle sub-órdenes: aviso ámbar al final
 */

interface StepProductosProps {
  state: OCWizardState;
  dispatch: React.Dispatch<OCWizardAction>;
}

// ─── Main component ─────────────────────────────────────────────────────────

export const StepProductos: React.FC<StepProductosProps> = ({ state, dispatch }) => {
  const productos = useProductoStore((s) => s.productos);
  const fetchProductos = useProductoStore((s) => s.fetchProductos);
  const loadingProductos = useProductoStore((s) => s.loading);
  // F3 · histórico de OCs para la referencia de precio inline (en-memoria desde el store)
  const ordenes = useOrdenCompraStore((s) => s.ordenes);
  const fetchOrdenes = useOrdenCompraStore((s) => s.fetchOrdenes);

  const [searchVisible, setSearchVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);

  // Cargar catálogo + historial de OCs al montar (para la referencia de precio)
  useEffect(() => {
    if (productos.length === 0) fetchProductos();
    if (ordenes.length === 0) fetchOrdenes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Derivados ──────────────────────────────────────────────────────────
  const subtotal = useMemo(
    () =>
      state.productos.reduce(
        (s, p) => s + (p.costoUnitario || 0) * (p.cantidad || 0),
        0
      ),
    [state.productos]
  );
  const totalUnidades = state.productos.reduce((s, p) => s + (p.cantidad || 0), 0);

  // Filtrar productos del catálogo que ya están en la OC
  const catalogoFiltrado = useMemo(() => {
    const addedIds = new Set(state.productos.map((p) => p.productoId));
    return productos.filter((p) => !addedIds.has(p.id));
  }, [productos, state.productos]);

  // F3 · Referencia de precio por SKU: histórico (OCs en-memoria) + investigado (catálogo)
  const referencias = useMemo(() => {
    const ids = state.productos.map((p) => p.productoId).filter(Boolean) as string[];
    const hist = getReferenciaPreciosEnMemoria(ids, ordenes);
    const map = new Map<string, ReferenciaPrecio>();
    for (const id of ids) {
      const h = hist.get(id) ?? { ultimaCompra: null, promedio: null, nMuestras: 0 };
      const cat = productos.find((c) => c.id === id);
      const inv = cat?.investigacion?.precioUSAPromedio ?? null;
      map.set(id, { ...h, investigado: inv && inv > 0 ? inv : null });
    }
    return map;
  }, [state.productos, ordenes, productos]);

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleAddFromAutocomplete = (snap: ProductoSnapshot | null) => {
    if (!snap) return;
    const catalogProd = productos.find((p) => p.id === snap.productoId);
    const baseSnap = catalogProd
      ? buildProductoSnapshot(catalogProd)
      : buildProductoSnapshot(snap);

    const producto: ProductoOrden = {
      ...baseSnap,
      cantidad: 1,
      costoUnitario: 0,
      subtotal: 0,
    };
    dispatch({ type: 'ADD_PRODUCTO', producto } as OCWizardAction);
    setSearchVisible(false);
  };

  const handleBarcodeScan = async (barcode: string) => {
    setScannerVisible(false);

    // 1. Buscar en catálogo local por SKU
    const local = productos.find(
      (p) => p.sku === barcode || p.sku === barcode.toUpperCase()
    );
    if (local) {
      handleAddFromAutocomplete({
        productoId: local.id,
        sku: local.sku,
        marca: local.marca,
        nombreComercial: local.nombreComercial,
        presentacion: local.presentacion || '',
      });
      return;
    }

    // 2. Buscar por UPC vía servicio
    try {
      const byUPC = await ProductoService.getByCodigoUPC(barcode);
      if (byUPC) {
        handleAddFromAutocomplete({
          productoId: byUPC.id,
          sku: byUPC.sku,
          marca: byUPC.marca,
          nombreComercial: byUPC.nombreComercial,
          presentacion: byUPC.presentacion || '',
        });
        return;
      }
       
      alert(`No se encontró producto con código ${barcode}`);
    } catch {
       
      alert('Error al buscar por código de barras');
    }
  };

  const handleUpdateCantidad = (idx: number, cantidad: number) => {
    const p = state.productos[idx];
    dispatch({
      type: 'UPDATE_PRODUCTO',
      index: idx,
      producto: { ...p, cantidad: Math.max(0, cantidad) },
    } as OCWizardAction);
  };

  const handleUpdateCosto = (idx: number, costoUnitario: number) => {
    const p = state.productos[idx];
    dispatch({
      type: 'UPDATE_PRODUCTO',
      index: idx,
      producto: { ...p, costoUnitario: Math.max(0, costoUnitario) },
    } as OCWizardAction);
  };

  const handleRemove = (idx: number) => {
    dispatch({ type: 'REMOVE_PRODUCTO', index: idx } as OCWizardAction);
  };

  const toggleSubOrdenes = () => {
    dispatch({ type: 'TOGGLE_SUBORDENES' } as OCWizardAction);
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          ¿Qué productos comprar?
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Agrega productos del catálogo. El precio unitario es lo que te cobra el
          proveedor.
        </p>
      </div>

      {/* Search + Escanear */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <button
            type="button"
            onClick={() => setSearchVisible(!searchVisible)}
            className="w-full text-left pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-500 hover:border-slate-400 bg-white"
          >
            Buscar producto por SKU, nombre o marca...
          </button>
        </div>
        <button
          type="button"
          onClick={() => setScannerVisible(!scannerVisible)}
          className={cn(
            'px-3 py-2 border rounded-lg text-sm flex items-center gap-1.5 transition-colors',
            scannerVisible
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-slate-300 text-slate-700 hover:bg-slate-50'
          )}
        >
          <ScanLine className="w-4 h-4" />
          Escanear
        </button>
      </div>

      {/* Panel search (expandible) */}
      {searchVisible && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
              Agregar producto del catálogo
            </div>
            <button
              type="button"
              onClick={() => setSearchVisible(false)}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {loadingProductos ? (
            <div className="py-3 text-sm text-slate-500 text-center">
              Cargando catálogo...
            </div>
          ) : (
            <ProductoAutocomplete
              productos={catalogoFiltrado}
              value={null}
              onChange={handleAddFromAutocomplete}
              placeholder="Buscar por SKU, marca o nombre..."
              showInvestigacionSugerencia={false}
              proveedorSeleccionado={state.configLogistica.proveedorNombre || undefined}
              tc={state.tcCompra}
            />
          )}
        </div>
      )}

      {/* Panel scanner (expandible) */}
      {scannerVisible && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-sky-900 uppercase tracking-wide">
              Escanear código de barras
            </div>
            <button
              type="button"
              onClick={() => setScannerVisible(false)}
              className="text-sky-600 hover:text-sky-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <BarcodeScanner onScan={handleBarcodeScan} compact mode="both" />
        </div>
      )}

      {/* Tabla de productos agregados */}
      {state.productos.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <div className="text-sm font-medium text-slate-700 mb-1">
            Sin productos agregados
          </div>
          <div className="text-xs text-slate-500">
            Usa el buscador o el escáner para agregar productos
          </div>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Header tabla */}
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              {state.productos.length} producto{state.productos.length !== 1 ? 's' : ''}{' '}
              agregado{state.productos.length !== 1 ? 's' : ''} · {totalUnidades}{' '}
              unidades
            </span>
            <span className="text-xs text-slate-500">
              Subtotal:{' '}
              <b className="text-slate-900 tabular-nums">${subtotal.toFixed(2)}</b>
            </span>
          </div>

          {/* Filas */}
          <div className="divide-y divide-slate-100">
            {state.productos.map((p, idx) => (
              <ProductoFila
                key={`${p.productoId}-${idx}`}
                producto={p}
                referenciaPrecio={referencias.get(p.productoId)}
                onUpdateCantidad={(c) => handleUpdateCantidad(idx, c)}
                onUpdateCosto={(c) => handleUpdateCosto(idx, c)}
                onRemove={() => handleRemove(idx)}
              />
            ))}
          </div>

          {/* Footer: Agregar otro */}
          <button
            type="button"
            onClick={() => setSearchVisible(true)}
            className="w-full border-t border-dashed border-slate-300 py-3 text-sm text-slate-500 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Agregar otro producto
          </button>
        </div>
      )}

      {/* Advertencia costo=0 */}
      {state.productos.length > 0 &&
        state.productos.some((p) => p.costoUnitario === 0) && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Hay productos con costo unitario en $0.</strong> Completa el costo
              para poder avanzar.
            </span>
          </div>
        )}

      {/* Toggle sub-órdenes (aviso ámbar) */}
      {state.productos.length > 0 && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Layers className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-amber-900">Sub-órdenes</div>
            <div className="text-xs text-amber-800 mt-0.5">
              Si esta OC llega en tandas desde el proveedor (ej: 2 productos ahora, 1 en
              2 semanas), puedes dividirla en sub-órdenes con rutas distintas.
            </div>
            <button
              type="button"
              onClick={toggleSubOrdenes}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-900 hover:text-amber-950 underline"
            >
              {state.useSubOrdenes ? (
                <>
                  <Check className="w-3 h-3" />
                  Sub-órdenes activadas — se configuran al confirmar
                </>
              ) : (
                'Configurar sub-órdenes →'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// ProductoFila — fila individual estilo mockup (emoji + stepper + chip marca)
// ════════════════════════════════════════════════════════════════════════════

const ProductoFila: React.FC<{
  producto: ProductoOrden;
  referenciaPrecio?: ReferenciaPrecio;
  onUpdateCantidad: (cantidad: number) => void;
  onUpdateCosto: (costo: number) => void;
  onRemove: () => void;
}> = ({ producto, referenciaPrecio, onUpdateCantidad, onUpdateCosto, onRemove }) => {
  const ico = iconoDeProducto(producto);
  const Ico = ico.Icon;
  const descripcion = getDescripcionProducto(producto);
  const subtotalFila = (producto.cantidad || 0) * (producto.costoUnitario || 0);

  // F3 · referencia de precio inline
  const ref = referenciaPrecio;
  const costo = producto.costoUnitario || 0;
  const tieneRef =
    !!ref && (ref.ultimaCompra != null || ref.promedio != null || ref.investigado != null);
  const sugerido = ref?.investigado ?? ref?.ultimaCompra ?? null;
  // Semáforo via motor PURO · UNA sola base (promedio histórico · cae al investigado/mercado).
  // Fixea el bug #3 (la base del delta ya no diverge del número sugerido para llenar).
  const semaforo = analizarPrecio({
    costoUnitarioUSD: costo,
    costoAdicionalPorUnidadUSD: 0,
    tc: 0, // el chip no muestra landed/margen · solo el semáforo crudo-vs-crudo
    referencia: { ultimaCompra: ref?.ultimaCompra ?? null, promedio: ref?.promedio ?? null, nMuestras: ref?.nMuestras ?? 0 },
    investigacion: ref?.investigado != null
      ? { precioMejorProvUSD: ref.investigado, precioEfectivo: 0, tieneProveedores: true, tieneCompetidores: false }
      : null,
  });
  const deltaPct = semaforo.deltaPct;
  const sobrePrecio = semaforo.veredicto === 'caro' || semaforo.veredicto === 'no_recomendable';

  return (
    <div className="px-4 pt-3 pb-2.5 hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3">
        {/* Ícono tonal por línea (canon F8 · sin emoji) */}
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', ico.bg, ico.text)}>
          <Ico className="w-5 h-5" />
        </div>

        {/* Nombre + metadata */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-900 text-sm truncate">
            {producto.nombreComercial}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="font-mono">{producto.sku}</span>
            {producto.marca && (
              <>
                <span>·</span>
                <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded text-[10px] font-medium">
                  {producto.marca}
                </span>
              </>
            )}
            {descripcion && (
              <>
                <span>·</span>
                <span className="text-slate-600">
                  <strong>{descripcion}</strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Stepper cantidad ± */}
        <div className="flex items-center bg-slate-100 rounded-lg flex-shrink-0">
          <button
            type="button"
            onClick={() => onUpdateCantidad(Math.max(0, (producto.cantidad || 0) - 1))}
            className="px-2 py-1 text-slate-500 hover:bg-slate-200 rounded-l-lg"
            aria-label="Disminuir"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="number"
            value={producto.cantidad || 0}
            onChange={(e) => onUpdateCantidad(Number(e.target.value) || 0)}
            className="w-12 text-center text-sm bg-transparent border-0 focus:ring-0 tabular-nums"
            min={0}
          />
          <button
            type="button"
            onClick={() => onUpdateCantidad((producto.cantidad || 0) + 1)}
            className="px-2 py-1 text-slate-500 hover:bg-slate-200 rounded-r-lg"
            aria-label="Aumentar"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Input precio */}
        <div className="text-right w-20 flex-shrink-0">
          <div className="text-xs text-slate-500">USD/u</div>
          <div className="relative">
            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
            <input
              type="number"
              value={producto.costoUnitario || 0}
              onChange={(e) => onUpdateCosto(Number(e.target.value) || 0)}
              step="0.01"
              min={0}
              className={cn(
                'w-full pl-4 pr-1 text-right text-sm font-semibold text-slate-900 border rounded-lg tabular-nums focus:outline-none focus:bg-white focus:ring-2',
                sobrePrecio
                  ? 'border-amber-300 bg-amber-50/40 focus:border-amber-400 focus:ring-amber-500/30'
                  : 'border-transparent focus:border-blue-300 focus:ring-blue-500/30',
              )}
            />
          </div>
        </div>

        {/* Subtotal */}
        <div className="text-right w-20 flex-shrink-0">
          <div className="text-xs text-slate-500">Subtotal</div>
          <div className="text-sm font-bold text-blue-700 tabular-nums">
            ${subtotalFila.toFixed(2)}
          </div>
        </div>

        {/* Trash */}
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
          aria-label="Eliminar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* F3 · Referencia de precio inline (sin sidebar · canon · histórico + investigado) */}
      {ref && (
        <div className="mt-1.5 ml-[52px] flex items-center gap-2 text-[10px] flex-wrap">
          {tieneRef ? (
            <>
              <span className="inline-flex items-center gap-1 text-slate-400 font-semibold uppercase tracking-wider">
                <History className="w-3 h-3" />Referencia
              </span>
              {ref.ultimaCompra != null && (
                <span className="text-slate-500">últ <b className="text-slate-700 tabular-nums">${ref.ultimaCompra.toFixed(0)}</b></span>
              )}
              {ref.promedio != null && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500">prom <b className="text-slate-700 tabular-nums">${ref.promedio.toFixed(0)}</b></span>
                </>
              )}
              {ref.investigado != null && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500">invest <b className="text-slate-700 tabular-nums">${ref.investigado.toFixed(0)}</b></span>
                </>
              )}
              {costo === 0 && sugerido != null && (
                <button
                  type="button"
                  onClick={() => onUpdateCosto(Number(sugerido.toFixed(2)))}
                  className="inline-flex items-center gap-1 ml-1 text-blue-700 font-bold bg-blue-100 hover:bg-blue-200 rounded px-1.5 py-0.5"
                >
                  <ArrowDownLeft className="w-3 h-3" />usar ${sugerido.toFixed(0)}
                </button>
              )}
              {costo > 0 && deltaPct != null && (
                sobrePrecio ? (
                  <span className="inline-flex items-center gap-1 text-amber-600 font-bold ml-1">
                    <TrendingUp className="w-3 h-3" />+{Math.round(deltaPct)}% vs prom · caro
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-bold ml-1">
                    <Check className="w-3 h-3" />{deltaPct < -2 ? `${Math.round(deltaPct)}% vs prom` : 'en rango'}
                  </span>
                )
              )}
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 text-slate-300 font-semibold uppercase tracking-wider">
                <History className="w-3 h-3" />Referencia
              </span>
              <span className="text-slate-400 italic">sin histórico · primera compra de este SKU</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
