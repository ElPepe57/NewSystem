import React, { useEffect, useMemo, useState } from 'react';
import {
  Package,
  Search,
  ScanLine,
  X,
  Info,
  Plus,
  Minus,
  ExternalLink,
} from 'lucide-react';
import { cn } from '../../../design-system';
import type { EnvioWizardState, EnvioWizardAction } from './envioWizardTypes';
import type { Unidad } from '../../../types/unidad.types';
import type { Producto } from '../../../types/producto.types';
import { unidadService } from '../../../services/unidad.service';
import { getDescripcionProducto } from '../../../utils/producto.helpers';
import { BarcodeScanner } from '../../../components/common/BarcodeScanner';
import { getEmojiPorProducto } from '../../../components/modules/ordenCompra/OCWizardV3/productoEmoji';

// ════════════════════════════════════════════════════════════════════════════
// EnvioStepProductos — Paso 2 EnvioWizardV2 (reescritura alineada al mockup S40)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Estructura fiel al mockup `rework-maestro-s40.html` pane-env-2:
 *
 *   Header dinámico con nombres de casillas origen/destino
 *   Search + Escanear
 *   Banner teal: "X de Y unidades seleccionadas · Z productos" + Limpiar/Todas
 *   Lista productos con:
 *     - Emoji gradient + nombre + SKU + chip marca + descripción rica
 *       + "N disponibles en [origen]"
 *     - Stepper ± cantidad a mover
 *     - Ratio "M/N" a la derecha (teal si seleccionado)
 *     - Border teal-500 si cantidad > 0
 *
 * MODELO DE SELECCIÓN: el usuario elige cantidad agregada por producto.
 * Internamente seleccionamos las primeras N unidades disponibles (FIFO por
 * fechaVencimiento asc, luego por id) y actualizamos `unidadesIdsSeleccionadas`.
 */

interface EnvioStepProductosProps {
  state: EnvioWizardState;
  dispatch: React.Dispatch<EnvioWizardAction>;
  productosMap: Map<string, Producto>;
}

// ─── Main component ─────────────────────────────────────────────────────────

export const EnvioStepProductos: React.FC<EnvioStepProductosProps> = ({
  state,
  dispatch,
  productosMap,
}) => {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);

  // ─── Cargar unidades disponibles al entrar al paso ──────────────────────
  useEffect(() => {
    if (!state.origenCasillaId) return;
    if (state.unidadesDisponibles.length > 0) return;

    let cancelled = false;
    setLoading(true);
    unidadService
      .getDisponiblesPorAlmacen(state.origenCasillaId)
      .then((unidades) => {
        if (!cancelled) {
          dispatch({ type: 'SET_UNIDADES_DISPONIBLES', unidades });
        }
      })
      .catch(() => {
        if (!cancelled) {
          dispatch({ type: 'SET_UNIDADES_DISPONIBLES', unidades: [] });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [state.origenCasillaId, dispatch, state.unidadesDisponibles.length]);

  // ─── Agrupación por producto + orden FIFO ───────────────────────────────
  const agrupadas = useMemo(() => {
    const m = new Map<
      string,
      {
        productoId: string;
        producto: Producto | null;
        unidades: Unidad[];
      }
    >();
    // Orden global por fechaVencimiento asc (FIFO) para que el stepper seleccione
    // siempre las primeras N unidades con vencimiento más próximo
    const sortedUnidades = [...state.unidadesDisponibles].sort((a, b) => {
      const ta = a.fechaVencimiento
        ? (a.fechaVencimiento as any)?.toMillis?.() ?? new Date(a.fechaVencimiento as any).getTime()
        : 0;
      const tb = b.fechaVencimiento
        ? (b.fechaVencimiento as any)?.toMillis?.() ?? new Date(b.fechaVencimiento as any).getTime()
        : 0;
      if (ta !== tb) return (ta || Infinity) - (tb || Infinity);
      return a.id.localeCompare(b.id);
    });

    sortedUnidades.forEach((u) => {
      if (!m.has(u.productoId)) {
        m.set(u.productoId, {
          productoId: u.productoId,
          producto: productosMap.get(u.productoId) || null,
          unidades: [],
        });
      }
      m.get(u.productoId)!.unidades.push(u);
    });
    return Array.from(m.values());
  }, [state.unidadesDisponibles, productosMap]);

  // ─── Filtrado por search ────────────────────────────────────────────────
  const agrupadasFiltradas = useMemo(() => {
    if (!searchTerm.trim()) return agrupadas;
    const q = searchTerm.toLowerCase().trim();
    return agrupadas.filter((g) => {
      const p = g.producto;
      if (!p) return false;
      return (
        p.nombreComercial?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.marca?.toLowerCase().includes(q)
      );
    });
  }, [agrupadas, searchTerm]);

  // ─── Derivados ──────────────────────────────────────────────────────────
  const unidadesSelec = state.unidadesIdsSeleccionadas.length;
  const totalDisponibles = state.unidadesDisponibles.length;
  const productosConSeleccion = agrupadas.filter((g) =>
    g.unidades.some((u) => state.unidadesIdsSeleccionadas.includes(u.id))
  ).length;

  // ─── Handlers ───────────────────────────────────────────────────────────
  /**
   * Actualiza la cantidad a mover de un producto. Internamente selecciona las
   * primeras N unidades (FIFO ya ordenado arriba).
   */
  const setCantidadParaProducto = (productoId: string, nuevaCantidad: number) => {
    const grupo = agrupadas.find((g) => g.productoId === productoId);
    if (!grupo) return;

    const maxDisponible = grupo.unidades.length;
    const cantidadClamped = Math.max(0, Math.min(maxDisponible, nuevaCantidad));

    // IDs del producto actual
    const idsDelProducto = new Set(grupo.unidades.map((u) => u.id));

    // Seleccionados actuales que NO son de este producto (preservar)
    const otrosSeleccionados = state.unidadesIdsSeleccionadas.filter(
      (id) => !idsDelProducto.has(id)
    );

    // Primeras N unidades del grupo (ya ordenadas FIFO)
    const primerasN = grupo.unidades.slice(0, cantidadClamped).map((u) => u.id);

    dispatch({
      type: 'SET_UNIDADES_SELECCIONADAS',
      ids: [...otrosSeleccionados, ...primerasN],
    });
  };

  const cantidadSeleccionadaDeProducto = (productoId: string): number => {
    const grupo = agrupadas.find((g) => g.productoId === productoId);
    if (!grupo) return 0;
    return grupo.unidades.filter((u) =>
      state.unidadesIdsSeleccionadas.includes(u.id)
    ).length;
  };

  const handleLimpiar = () => {
    dispatch({ type: 'SET_UNIDADES_SELECCIONADAS', ids: [] });
  };

  const handleSeleccionarTodas = () => {
    const allIds = state.unidadesDisponibles.map((u) => u.id);
    dispatch({ type: 'SET_UNIDADES_SELECCIONADAS', ids: allIds });
  };

  const handleBarcodeScan = (barcode: string) => {
    setScannerVisible(false);
    // Buscar producto por SKU en los agrupados
    const grupo = agrupadas.find(
      (g) => g.producto?.sku === barcode || g.producto?.sku === barcode.toUpperCase()
    );
    if (!grupo) {
      // eslint-disable-next-line no-alert
      alert(`Producto ${barcode} no encontrado en ${state.origenCasillaNombre}`);
      return;
    }
    // Incrementar cantidad actual
    const actual = cantidadSeleccionadaDeProducto(grupo.productoId);
    setCantidadParaProducto(grupo.productoId, actual + 1);
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-slate-900">Productos a mover</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Selecciona cuántas unidades de los productos disponibles en{' '}
          <strong>{state.origenCasillaNombre || 'el origen'}</strong>
          {state.destinoCasillaNombre && (
            <>
              {' '}se mueven a <strong>{state.destinoCasillaNombre}</strong>
            </>
          )}
          .
        </p>
      </div>

      {/* Search + Escanear */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setScannerVisible(!scannerVisible)}
          className={cn(
            'px-3 py-2 border rounded-lg text-sm flex items-center gap-1.5 transition-colors',
            scannerVisible
              ? 'border-teal-500 bg-teal-50 text-teal-700'
              : 'border-slate-300 text-slate-700 hover:bg-slate-50'
          )}
        >
          <ScanLine className="w-4 h-4" />
          Escanear
        </button>
      </div>

      {/* Panel escáner */}
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

      {/* Banner selección */}
      {totalDisponibles > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 flex items-center justify-between">
          <div className="text-sm">
            <div className="font-semibold text-slate-900">
              {unidadesSelec} de {totalDisponibles} unidades seleccionadas
            </div>
            <div className="text-xs text-slate-600">
              {productosConSeleccion} producto{productosConSeleccion !== 1 ? 's' : ''}
              {unidadesSelec === 0 && ' · nada seleccionado aún'}
            </div>
          </div>
          <div className="flex gap-2">
            {unidadesSelec > 0 && (
              <button
                type="button"
                onClick={handleLimpiar}
                className="text-xs text-slate-700 px-2 py-1 hover:bg-white rounded"
              >
                Limpiar
              </button>
            )}
            {unidadesSelec < totalDisponibles && (
              <button
                type="button"
                onClick={handleSeleccionarTodas}
                className="text-xs text-teal-700 font-semibold px-2 py-1 hover:bg-teal-100 rounded"
              >
                Todas
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-sm text-slate-500">
          Cargando unidades disponibles...
        </div>
      )}

      {/* Empty state */}
      {!loading && agrupadas.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-amber-300 rounded-xl bg-amber-50">
          <Package className="w-10 h-10 text-amber-400 mx-auto mb-2" />
          <div className="text-sm font-semibold text-amber-900 mb-1">
            Sin unidades disponibles en {state.origenCasillaNombre}
          </div>
          <div className="text-xs text-amber-700 mb-3">
            Esta casilla no tiene inventario disponible.
          </div>
          <a
            href={`/inventario?casilla=${state.origenCasillaId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 underline"
          >
            <ExternalLink className="w-3 h-3" />
            Ver inventario de esta casilla
          </a>
        </div>
      )}

      {/* Lista productos */}
      {!loading && agrupadasFiltradas.length === 0 && agrupadas.length > 0 && (
        <div className="text-center py-8 text-sm text-slate-500 italic">
          Sin resultados para "{searchTerm}"
        </div>
      )}

      {!loading && agrupadasFiltradas.length > 0 && (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {agrupadasFiltradas.map((grupo) => (
            <ProductoFila
              key={grupo.productoId}
              grupo={grupo}
              origenNombre={state.origenCasillaNombre}
              cantidadSeleccionada={cantidadSeleccionadaDeProducto(grupo.productoId)}
              onChangeCantidad={(n) => setCantidadParaProducto(grupo.productoId, n)}
            />
          ))}
        </div>
      )}

      {/* Advertencia si nada seleccionado */}
      {!loading && totalDisponibles > 0 && unidadesSelec === 0 && (
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
          <span>
            Usa el stepper <strong>±</strong> en cada producto para definir cuántas
            unidades mover. El sistema selecciona automáticamente las primeras N (por
            fecha de vencimiento, FIFO).
          </span>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// ProductoFila — estilo mockup: emoji + chip marca + stepper + ratio
// ════════════════════════════════════════════════════════════════════════════

const ProductoFila: React.FC<{
  grupo: { productoId: string; producto: Producto | null; unidades: Unidad[] };
  origenNombre: string;
  cantidadSeleccionada: number;
  onChangeCantidad: (nueva: number) => void;
}> = ({ grupo, origenNombre, cantidadSeleccionada, onChangeCantidad }) => {
  const maxDisponible = grupo.unidades.length;
  const tieneSeleccion = cantidadSeleccionada > 0;
  const emoji = grupo.producto
    ? getEmojiPorProducto(grupo.producto)
    : { emoji: '📦', bgClass: 'bg-gradient-to-br from-slate-100 to-gray-100' };
  const descripcion = grupo.producto ? getDescripcionProducto(grupo.producto) : '';

  if (!grupo.producto) {
    return (
      <div className="border-2 border-slate-200 rounded-xl p-3 text-sm text-slate-500 italic">
        Producto no encontrado · ID: {grupo.productoId}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl p-3 border-2 transition-colors',
        tieneSeleccion
          ? 'border-teal-500 bg-teal-50/30'
          : 'border-slate-200 bg-white hover:border-teal-300'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Emoji gradient */}
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            emoji.bgClass
          )}
        >
          <span className="text-lg">{emoji.emoji}</span>
        </div>

        {/* Info producto */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900 text-sm truncate">
            {grupo.producto.nombreComercial}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="font-mono">{grupo.producto.sku}</span>
            {grupo.producto.marca && (
              <>
                <span>·</span>
                <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded text-[10px] font-medium">
                  {grupo.producto.marca}
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
            <span>·</span>
            <span className="text-slate-700">
              {maxDisponible} disponibles en {origenNombre.split(' ')[0]}
            </span>
          </div>
        </div>

        {/* Stepper cantidad */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg flex-shrink-0">
          <button
            type="button"
            onClick={() => onChangeCantidad(cantidadSeleccionada - 1)}
            disabled={cantidadSeleccionada <= 0}
            className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded-l-lg disabled:opacity-40"
            aria-label="Disminuir"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="number"
            value={cantidadSeleccionada}
            onChange={(e) => onChangeCantidad(Number(e.target.value) || 0)}
            className="w-14 text-center text-sm font-semibold bg-transparent border-0 focus:ring-0 tabular-nums"
            min={0}
            max={maxDisponible}
          />
          <button
            type="button"
            onClick={() => onChangeCantidad(cantidadSeleccionada + 1)}
            disabled={cantidadSeleccionada >= maxDisponible}
            className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded-r-lg disabled:opacity-40"
            aria-label="Aumentar"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Ratio M/N */}
        <span
          className={cn(
            'text-xs font-semibold w-12 text-right flex-shrink-0 tabular-nums',
            tieneSeleccion ? 'text-teal-700' : 'text-slate-400'
          )}
        >
          {cantidadSeleccionada}/{maxDisponible}
        </span>
      </div>
    </div>
  );
};
