import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../../../design-system';
import { StatusBadge } from '../../../../design-system';
import type { ProductoOrden } from '../../../../types/ordenCompra.types';
import { OrdenCompraService } from '../../../../services/ordenCompra.service';

// ---- Types ----

interface PrecioHistoricoResumen {
  ultimoPrecio: number | null;
  promedio: number | null;
  totalCompras: number;
}

interface IntelProducto {
  precioHistorico: PrecioHistoricoResumen;
  loading: boolean;
}

// ---- Props ----

interface WizardStepInteligenciaProps {
  productos: ProductoOrden[];
  tcCompra: number;
}

// ---- Helpers ----

function getPriceLevel(
  costoActual: number,
  historico: PrecioHistoricoResumen,
): { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral'; tendencia: 'up' | 'down' | 'flat' | 'none' } {
  if (!historico.ultimoPrecio || historico.ultimoPrecio === 0) {
    return { label: 'Primera compra', variant: 'neutral', tendencia: 'none' };
  }
  const diff = ((costoActual - historico.ultimoPrecio) / historico.ultimoPrecio) * 100;
  if (diff <= -5) return { label: `${Math.abs(diff).toFixed(1)}% más barato`, variant: 'success', tendencia: 'down' };
  if (diff >= 10) return { label: `${diff.toFixed(1)}% más caro`, variant: 'danger', tendencia: 'up' };
  if (diff > 0) return { label: `${diff.toFixed(1)}% sobre histórico`, variant: 'warning', tendencia: 'up' };
  if (diff < 0) return { label: `${Math.abs(diff).toFixed(1)}% bajo histórico`, variant: 'success', tendencia: 'down' };
  return { label: 'Igual al histórico', variant: 'neutral', tendencia: 'flat' };
}

const TendenciaIcon: React.FC<{ tendencia: 'up' | 'down' | 'flat' | 'none' }> = ({ tendencia }) => {
  if (tendencia === 'up') return <TrendingUp className="w-3.5 h-3.5 text-red-500" />;
  if (tendencia === 'down') return <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />;
  if (tendencia === 'flat') return <Minus className="w-3.5 h-3.5 text-slate-400" />;
  return <Info className="w-3.5 h-3.5 text-slate-400" />;
};

// ---- Main Component ----

export const WizardStepInteligencia: React.FC<WizardStepInteligenciaProps> = ({
  productos,
  tcCompra,
}) => {
  const [intel, setIntel] = useState<Record<string, IntelProducto>>({});

  // Load price history for each product
  useEffect(() => {
    productos.forEach(async (p) => {
      if (!p.productoId) return;
      // Skip if already loaded or loading
      if (intel[p.productoId]) return;

      setIntel((prev) => ({
        ...prev,
        [p.productoId]: { precioHistorico: { ultimoPrecio: null, promedio: null, totalCompras: 0 }, loading: true },
      }));

      try {
        const historico = await OrdenCompraService.getPreciosHistoricos(p.productoId);
        const precios = historico.map((h) => h.costoUnitarioUSD).filter((x) => x > 0);
        const ultimoPrecio = precios.length > 0 ? precios[precios.length - 1] : null;
        const promedio =
          precios.length > 0
            ? precios.reduce((a, b) => a + b, 0) / precios.length
            : null;

        setIntel((prev) => ({
          ...prev,
          [p.productoId]: {
            precioHistorico: { ultimoPrecio, promedio, totalCompras: historico.length },
            loading: false,
          },
        }));
      } catch {
        setIntel((prev) => ({
          ...prev,
          [p.productoId]: {
            precioHistorico: { ultimoPrecio: null, promedio: null, totalCompras: 0 },
            loading: false,
          },
        }));
      }
    });
  }, [productos]);

  // Summary totals
  const totalUnidades = productos.reduce((s, p) => s + (p.cantidad || 0), 0);
  const subtotalUSD = productos.reduce((s, p) => s + (p.costoUnitario || 0) * (p.cantidad || 0), 0);
  const ctruEstimadoProm =
    totalUnidades > 0 && tcCompra > 0 ? (subtotalUSD * tcCompra) / totalUnidades : 0;

  if (productos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <p className="text-slate-500 text-sm">No hay productos en esta orden.</p>
        <p className="text-slate-400 text-xs">Agrega productos en el paso anterior.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">Inteligencia Comercial</h2>
        <p className="text-sm text-slate-500 mt-1">
          Análisis de tu selección antes de crear la orden
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        {/* Product cards */}
        {productos.map((prod) => {
          const data = intel[prod.productoId];
          const loading = data?.loading ?? true;
          const historico = data?.precioHistorico ?? { ultimoPrecio: null, promedio: null, totalCompras: 0 };
          const priceEval =
            prod.costoUnitario > 0
              ? getPriceLevel(prod.costoUnitario, historico)
              : null;
          const ctruUnitario = prod.costoUnitario > 0 && tcCompra > 0
            ? prod.costoUnitario * tcCompra
            : null;
          const inversion = (prod.costoUnitario || 0) * (prod.cantidad || 0);

          return (
            <div
              key={prod.productoId}
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
            >
              {/* Product header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-mono text-[10px] text-slate-400 block">{prod.sku}</span>
                  <h4 className="font-medium text-slate-900 text-sm leading-snug">{prod.nombreComercial}</h4>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                    <span className="text-xs text-slate-500">{prod.marca}</span>
                    {prod.presentacion && <span className="text-xs text-slate-400">· {prod.presentacion}</span>}
                    {prod.contenido && <span className="text-xs text-slate-400">· {prod.contenido}</span>}
                    {prod.dosaje && <span className="text-xs text-slate-400">· {prod.dosaje}</span>}
                    {prod.sabor && <span className="text-xs text-slate-400">· {prod.sabor}</span>}
                    {prod.pesoLibras && <span className="text-xs text-slate-400">· {prod.pesoLibras} lb</span>}
                  </div>
                </div>
                {priceEval && !loading && (
                  <div className="flex-shrink-0">
                    <StatusBadge variant={priceEval.variant} className="flex items-center gap-1">
                      <TendenciaIcon tendencia={priceEval.tendencia} />
                      {priceEval.label}
                    </StatusBadge>
                  </div>
                )}
                {loading && (
                  <div className="w-24 h-5 bg-slate-100 rounded animate-pulse flex-shrink-0" />
                )}
              </div>

              {/* Metric grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 rounded-lg p-3">
                <div>
                  <p className="text-[10px] text-slate-500">Precio compra</p>
                  <p className="text-sm font-bold text-slate-900">
                    {prod.costoUnitario > 0 ? `$${prod.costoUnitario.toFixed(2)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">CTRU estimado</p>
                  <p className="text-sm font-bold text-slate-900">
                    {ctruUnitario !== null ? `S/ ${ctruUnitario.toFixed(2)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Cantidad</p>
                  <p className="text-sm font-bold text-slate-900">{prod.cantidad} uds</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Inversión</p>
                  <p className="text-sm font-bold text-slate-900">
                    {inversion > 0 ? `$${inversion.toFixed(2)}` : '—'}
                  </p>
                </div>
              </div>

              {/* Historical reference */}
              {!loading && historico.totalCompras > 0 && (
                <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                  {historico.ultimoPrecio !== null && (
                    <span>
                      Último precio:{' '}
                      <span className="font-medium text-slate-700">
                        ${historico.ultimoPrecio.toFixed(2)}
                      </span>
                    </span>
                  )}
                  {historico.promedio !== null && (
                    <span>
                      Promedio histórico:{' '}
                      <span className="font-medium text-slate-700">
                        ${historico.promedio.toFixed(2)}
                      </span>
                    </span>
                  )}
                  <span className="text-slate-400">({historico.totalCompras} OC previas)</span>
                </div>
              )}

              {/* First purchase notice */}
              {!loading && historico.totalCompras === 0 && (
                <p className="text-xs text-slate-400 flex items-center gap-1 pt-1">
                  <Info className="w-3 h-3" />
                  Primera compra de este producto — sin histórico de precios
                </p>
              )}

              {/* Price too high alert */}
              {!loading && priceEval?.variant === 'danger' && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700">
                    El precio ingresado es significativamente mayor al histórico. Verifica antes de continuar.
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* Summary card */}
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-teal-800">Resumen de la compra</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-teal-600">Total inversión</p>
              <p className="text-base font-bold text-teal-900">
                {subtotalUSD > 0 ? `$${subtotalUSD.toFixed(2)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-teal-600">CTRU estimado (prom.)</p>
              <p className="text-base font-bold text-teal-900">
                {ctruEstimadoProm > 0 ? `S/ ${ctruEstimadoProm.toFixed(2)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-teal-600">Productos / unidades</p>
              <p className="text-base font-bold text-teal-900">
                {productos.length} prod · {totalUnidades} uds
              </p>
            </div>
          </div>
          {tcCompra > 0 && (
            <p className="text-[10px] text-teal-500">
              TC usado: S/ {tcCompra.toFixed(3)} · CTRU solo incluye costo de producto (sin fletes ni cargos)
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
