/**
 * OC FORM WIZARD - STEP 2: PRICE INTELLIGENCE
 * Fetches and displays pricing intelligence for all products in the order.
 * Provides evaluation summary, margin projections, and suggested prices.
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Zap,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { PriceIntelligenceService } from '../../../../services/priceIntelligence.service';
import { usePaisOrigenStore } from '../../../../store/paisOrigenStore';
import { ProductIntelCard } from './ProductIntelCard';
import type { OCFormState, OCFormAction } from './ocFormTypes';
import type { Producto } from '../../../../types/producto.types';
import type { PriceIntelligenceConfig, NivelPrecio } from '../../../../types/priceIntelligence.types';

// ============================================
// TYPES
// ============================================

interface OCFormStep2Props {
  state: OCFormState;
  dispatch: React.Dispatch<OCFormAction>;
  productos: Producto[];
}

// ============================================
// HELPERS
// ============================================

const NIVEL_ORDER: NivelPrecio[] = ['excelente', 'bueno', 'aceptable', 'alto', 'muy_alto'];

const NIVEL_SUMMARY: Record<NivelPrecio, { icon: React.FC<any>; color: string; label: string }> = {
  excelente: { icon: CheckCircle, color: 'text-green-600', label: 'excelentes' },
  bueno:     { icon: CheckCircle, color: 'text-blue-600',  label: 'buenos' },
  aceptable: { icon: TrendingUp,  color: 'text-gray-600',  label: 'aceptables' },
  alto:      { icon: AlertTriangle, color: 'text-amber-600', label: 'altos' },
  muy_alto:  { icon: XCircle,     color: 'text-red-600',    label: 'muy altos' },
};

function getCategoryMargins(productoId: string, productoCatalog: Producto[]) {
  const prod = productoCatalog.find(p => p.id === productoId);
  if (!prod) return { margenObjetivo: 35, margenMinimo: 15 };
  const cat = prod.categorias?.find(c => c.categoriaId === prod.categoriaPrincipalId) || prod.categorias?.[0];
  return {
    margenObjetivo: cat?.margenObjetivo ?? 35,
    margenMinimo: cat?.margenMinimo ?? 15,
  };
}

// ============================================
// COMPONENT
// ============================================

export const OCFormStep2: React.FC<OCFormStep2Props> = ({ state, dispatch, productos }) => {
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const getFleteEstimado = usePaisOrigenStore(s => s.getFleteEstimado);

  // Products with IDs assigned
  const validProducts = useMemo(
    () => state.productos.filter(p => p.productoId),
    [state.productos]
  );

  // ── Fetch intelligence for a single product ──
  const fetchIntelligence = useCallback(async (productoId: string, precioCompra: number) => {
    if (!productoId || precioCompra <= 0 || state.tcCompra <= 0) return;

    dispatch({ type: 'SET_INTELLIGENCE_LOADING', payload: { productoId, loading: true } });

    try {
      const { margenObjetivo, margenMinimo } = getCategoryMargins(productoId, productos);
      const costoFlete = getFleteEstimado?.(state.paisOrigenOC || 'US') ?? 0;

      const config: PriceIntelligenceConfig = {
        tipoCambio: state.tcCompra,
        margenObjetivo,
        margenMinimo,
        costoFleteInternacional: costoFlete,
        proveedorActual: state.proveedor?.nombre,
      };

      const result = await PriceIntelligenceService.analizarPrecio({
        productoId,
        precioCompra,
        config,
      });

      dispatch({ type: 'SET_INTELLIGENCE', payload: { productoId, result } });
    } catch (err) {
      console.error(`Error fetching intelligence for ${productoId}:`, err);
    } finally {
      dispatch({ type: 'SET_INTELLIGENCE_LOADING', payload: { productoId, loading: false } });
    }
  }, [state.tcCompra, state.paisOrigenOC, state.proveedor, productos, dispatch, getFleteEstimado]);

  // ── On mount / product changes, fetch intelligence for all valid products ──
  useEffect(() => {
    validProducts.forEach(p => {
      if (p.productoId && p.costoUnitario > 0) {
        // Only fetch if not already cached for this price
        const cached = state.intelligenceCache[p.productoId];
        if (!cached || cached.precioIngresado !== p.costoUnitario) {
          fetchIntelligence(p.productoId, p.costoUnitario);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validProducts.length]);

  // ── Price change handler with debounce ──
  const handlePriceChange = useCallback((index: number, precio: number) => {
    dispatch({ type: 'UPDATE_PRODUCTO', payload: { index, field: 'costoUnitario', value: precio } });

    const productoId = state.productos[index]?.productoId;
    if (!productoId || precio <= 0) return;

    // Clear existing debounce
    if (debounceTimers.current[productoId]) {
      clearTimeout(debounceTimers.current[productoId]);
    }

    debounceTimers.current[productoId] = setTimeout(() => {
      fetchIntelligence(productoId, precio);
    }, 500);
  }, [state.productos, dispatch, fetchIntelligence]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  // ── Use suggested price ──
  const handleUsarSugerido = useCallback((index: number, precio: number) => {
    dispatch({ type: 'APPLY_SUGGESTED_PRICE', payload: { index, precio } });
    const productoId = state.productos[index]?.productoId;
    if (productoId) {
      fetchIntelligence(productoId, precio);
    }
  }, [state.productos, dispatch, fetchIntelligence]);

  // ── Summary computation ──
  const summary = useMemo(() => {
    const counts: Partial<Record<NivelPrecio, number>> = {};
    let totalMargen = 0;
    let margenCount = 0;
    let totalAlertas = 0;
    let totalUSD = 0;

    validProducts.forEach(p => {
      const analysis = state.intelligenceCache[p.productoId];
      if (!analysis) return;

      const nivel = analysis.evaluacion.nivel;
      counts[nivel] = (counts[nivel] || 0) + 1;

      if (analysis.proyeccionRentabilidad) {
        totalMargen += analysis.proyeccionRentabilidad.margenEstimado;
        margenCount++;
      }

      totalAlertas += analysis.alertas.length;
      totalUSD += p.costoUnitario * p.cantidad;
    });

    return {
      counts,
      avgMargen: margenCount > 0 ? totalMargen / margenCount : 0,
      totalAlertas,
      totalUSD,
      analyzedCount: Object.values(counts).reduce((s, c) => s + (c || 0), 0),
    };
  }, [validProducts, state.intelligenceCache]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-4">
      {/* ── Summary bar ── */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white border border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-4 w-4 text-primary-600" />
          <h3 className="text-sm font-semibold text-gray-800">Resumen OC</h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
          <span>
            <span className="font-medium text-gray-900">{validProducts.length}</span> productos
          </span>
          <span className="text-gray-300">|</span>
          <span>
            <span className="font-medium text-gray-900">${summary.totalUSD.toFixed(2)}</span> USD
          </span>
          {summary.avgMargen > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span>
                Margen prom: <span className={`font-medium ${
                  summary.avgMargen >= 30 ? 'text-green-700' :
                  summary.avgMargen >= 15 ? 'text-amber-700' :
                  'text-red-700'
                }`}>{summary.avgMargen.toFixed(0)}%</span>
              </span>
            </>
          )}
        </div>

        {/* Nivel chips */}
        {summary.analyzedCount > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {NIVEL_ORDER.map(nivel => {
              const count = summary.counts[nivel];
              if (!count) return null;
              const cfg = NIVEL_SUMMARY[nivel];
              const Icon = cfg.icon;
              return (
                <span key={nivel} className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {count} {cfg.label}
                </span>
              );
            })}
            {summary.totalAlertas > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                {summary.totalAlertas} alerta{summary.totalAlertas !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── No products message ── */}
      {validProducts.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay productos seleccionados</p>
          <p className="text-xs mt-1">Regresa al paso anterior para agregar productos</p>
        </div>
      )}

      {/* ── Product intel cards ── */}
      <div className="space-y-3">
        {state.productos.map((producto, index) => {
          if (!producto.productoId) return null;
          return (
            <ProductIntelCard
              key={`${producto.productoId}-${index}`}
              producto={producto}
              index={index}
              analysis={state.intelligenceCache[producto.productoId] ?? null}
              loading={state.intelligenceLoading[producto.productoId] ?? false}
              tcCompra={state.tcCompra}
              onPriceChange={handlePriceChange}
              onUsarSugerido={handleUsarSugerido}
            />
          );
        })}
      </div>
    </div>
  );
};
