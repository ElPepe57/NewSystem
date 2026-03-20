/**
 * PRODUCT INTEL CARD
 * Compact, expandable card showing pricing intelligence for a single product
 * in the OC Form Wizard (Step 2).
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Loader2,
  Package,
  TrendingUp,
  Users,
  Lightbulb,
  Zap,
} from 'lucide-react';
import type { PriceIntelligenceResult, NivelPrecio } from '../../../../types/priceIntelligence.types';
import type { ProductoOrdenItem } from './ocFormTypes';

// ============================================
// TYPES
// ============================================

interface ProductIntelCardProps {
  producto: ProductoOrdenItem;
  index: number;
  analysis: PriceIntelligenceResult | null;
  loading: boolean;
  tcCompra: number;
  onPriceChange: (index: number, precio: number) => void;
  onUsarSugerido: (index: number, precio: number) => void;
}

// ============================================
// STYLE HELPERS
// ============================================

const NIVEL_STYLES: Record<NivelPrecio, { bg: string; text: string; bar: string; label: string }> = {
  excelente: { bg: 'bg-green-50', text: 'text-green-700', bar: 'bg-green-500', label: 'Excelente' },
  bueno:     { bg: 'bg-blue-50',  text: 'text-blue-700',  bar: 'bg-blue-500',  label: 'Bueno' },
  aceptable: { bg: 'bg-gray-50',  text: 'text-gray-700',  bar: 'bg-gray-500',  label: 'Aceptable' },
  alto:      { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', label: 'Alto' },
  muy_alto:  { bg: 'bg-red-50',   text: 'text-red-700',   bar: 'bg-red-500',   label: 'Muy alto' },
};

const ALERTA_STYLES: Record<string, { bg: string; border: string; text: string; Icon: React.FC<any> }> = {
  success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', Icon: CheckCircle },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', Icon: AlertTriangle },
  danger:  { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', Icon: XCircle },
  info:    { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', Icon: Info },
};

// ============================================
// COMPONENT
// ============================================

export const ProductIntelCard: React.FC<ProductIntelCardProps> = ({
  producto,
  index,
  analysis,
  loading,
  tcCompra,
  onPriceChange,
  onUsarSugerido,
}) => {
  const [expanded, setExpanded] = useState(true);

  const nivelStyle = analysis ? NIVEL_STYLES[analysis.evaluacion.nivel] : null;

  // Suggested price from best provider or historical average
  const precioSugerido = analysis
    ? analysis.comparativaProveedores.find(p => p.esRecomendado)?.precioConImpuesto
      ?? (analysis.tieneHistorico ? analysis.estadisticasHistorico.promedio : null)
    : null;

  // ── Loading state ──────────────────────────
  if (loading) {
    return (
      <div className="border border-gray-200 rounded-xl p-4 bg-white animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-40 bg-gray-200 rounded" />
            <div className="h-4 w-20 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-gray-100 rounded" />
          <div className="h-8 w-32 bg-gray-100 rounded" />
          <div className="h-3 w-3/4 bg-gray-100 rounded" />
        </div>
        <div className="flex items-center gap-2 mt-3 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analizando precio...
        </div>
      </div>
    );
  }

  // ── No analysis yet ────────────────────────
  if (!analysis) {
    return (
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 text-sm truncate max-w-[260px]">
              {producto.nombreComercial || 'Producto sin seleccionar'}
            </span>
            {producto.sku && (
              <span className="text-xs text-gray-400 font-mono">{producto.sku}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Precio USD:</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={producto.costoUnitario || ''}
            onChange={(e) => onPriceChange(index, parseFloat(e.target.value) || 0)}
            className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="0.00"
          />
        </div>
        <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
          <Info className="h-3.5 w-3.5" />
          Ingresa un precio para ver el analisis
        </p>
      </div>
    );
  }

  // ── Full card with analysis ────────────────
  return (
    <div className={`border rounded-xl overflow-hidden bg-white transition-shadow ${
      analysis.evaluacion.nivel === 'muy_alto' ? 'border-red-300 shadow-sm shadow-red-100' :
      analysis.evaluacion.nivel === 'alto' ? 'border-amber-300' :
      'border-gray-200'
    }`}>
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-gray-900 text-sm truncate max-w-[260px]">
            {producto.nombreComercial}
          </span>
          <span className="text-xs text-gray-400 font-mono flex-shrink-0">{producto.sku}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {nivelStyle && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${nivelStyle.bg} ${nivelStyle.text}`}>
              {nivelStyle.label}
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* ── Price input row ── */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 whitespace-nowrap">Precio actual:</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={producto.costoUnitario || ''}
                onChange={(e) => onPriceChange(index, parseFloat(e.target.value) || 0)}
                className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* ── Evaluacion section ── */}
          <div className={`p-3 rounded-lg border ${nivelStyle?.bg || 'bg-gray-50'} border-gray-200`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Evaluacion</span>
              <span className={`text-xs font-semibold ${nivelStyle?.text || 'text-gray-600'}`}>
                {analysis.evaluacion.puntuacion}/100
              </span>
            </div>
            {/* Score bar */}
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${nivelStyle?.bar || 'bg-gray-400'}`}
                style={{ width: `${Math.min(100, Math.max(0, analysis.evaluacion.puntuacion))}%` }}
              />
            </div>
            {/* Comparison chips */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className={`inline-flex items-center gap-1 ${
                analysis.evaluacion.vsPromedioHistorico <= 0 ? 'text-green-700' : 'text-amber-700'
              }`}>
                vs Promedio: {analysis.evaluacion.vsPromedioHistorico > 0 ? '+' : ''}
                {analysis.evaluacion.vsPromedioHistorico.toFixed(1)}%
                {analysis.evaluacion.vsPromedioHistorico <= 0
                  ? <CheckCircle className="h-3.5 w-3.5" />
                  : <AlertTriangle className="h-3.5 w-3.5" />}
              </span>
              <span className={`inline-flex items-center gap-1 ${
                analysis.evaluacion.vsMejorHistorico <= 5 ? 'text-green-700' : 'text-amber-700'
              }`}>
                vs Mejor: {analysis.evaluacion.vsMejorHistorico > 0 ? '+' : ''}
                {analysis.evaluacion.vsMejorHistorico.toFixed(1)}%
                {analysis.evaluacion.vsMejorHistorico <= 5
                  ? <CheckCircle className="h-3.5 w-3.5" />
                  : <AlertTriangle className="h-3.5 w-3.5" />}
              </span>
            </div>
          </div>

          {/* ── Margin projection ── */}
          {analysis.proyeccionRentabilidad && (
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-600">Proyeccion de Margen</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">CTRU est:</span>
                  <span className="font-medium text-gray-900">
                    S/ {analysis.proyeccionRentabilidad.ctruProyectado.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Precio min venta:</span>
                  <span className="font-medium text-gray-900">
                    S/ {analysis.proyeccionRentabilidad.precioVentaSugerido.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-gray-500">Margen estimado:</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          analysis.proyeccionRentabilidad.margenEstimado >= 30 ? 'bg-green-500' :
                          analysis.proyeccionRentabilidad.margenEstimado >= 15 ? 'bg-amber-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, analysis.proyeccionRentabilidad.margenEstimado))}%` }}
                      />
                    </div>
                    <span className={`font-semibold ${
                      analysis.proyeccionRentabilidad.margenEstimado >= 30 ? 'text-green-700' :
                      analysis.proyeccionRentabilidad.margenEstimado >= 15 ? 'text-amber-700' :
                      'text-red-700'
                    }`}>
                      {analysis.proyeccionRentabilidad.margenEstimado.toFixed(1)}%
                    </span>
                    {analysis.proyeccionRentabilidad.margenEstimado >= 30
                      ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      : analysis.proyeccionRentabilidad.alertaMargenBajo
                        ? <XCircle className="h-3.5 w-3.5 text-red-500" />
                        : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Context section ── */}
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-1.5 mb-2">
              <Info className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-600">Contexto</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              {/* Stock info from historico */}
              {analysis.tieneHistorico && (
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-gray-400" />
                  <span>{analysis.estadisticasHistorico.totalCompras} compras previas</span>
                </div>
              )}
              {/* Trend */}
              {analysis.tieneHistorico && (
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-gray-400" />
                  <span>Tendencia: <span className="font-medium capitalize">{analysis.estadisticasHistorico.tendencia}</span></span>
                </div>
              )}
              {/* Providers */}
              {analysis.comparativaProveedores.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-gray-400" />
                  <span>{analysis.comparativaProveedores.length} proveedores comparados</span>
                </div>
              )}
              {/* Investigation status */}
              {analysis.tieneInvestigacion && (
                <div className="flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-gray-400" />
                  <span className={analysis.investigacionVigente ? 'text-green-600' : 'text-amber-600'}>
                    Inv. {analysis.investigacionVigente
                      ? `vigente (${analysis.diasDesdeInvestigacion}d)`
                      : `desactualizada (${analysis.diasDesdeInvestigacion}d)`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Alerts ── */}
          {analysis.alertas.length > 0 && (
            <div className="space-y-1.5">
              {analysis.alertas.slice(0, 3).map((alerta, i) => {
                const style = ALERTA_STYLES[alerta.tipo] || ALERTA_STYLES.info;
                const { Icon } = style;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 p-2 rounded-lg text-xs border ${style.bg} ${style.border}`}
                  >
                    <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${style.text}`} />
                    <div>
                      <span className={`font-medium ${style.text}`}>{alerta.titulo}</span>
                      {alerta.mensaje && (
                        <span className="text-gray-600 ml-1">{alerta.mensaje}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Suggested price button ── */}
          {precioSugerido && precioSugerido !== producto.costoUnitario && (
            <button
              type="button"
              onClick={() => onUsarSugerido(index, precioSugerido)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg
                bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-colors"
            >
              <Zap className="h-4 w-4" />
              Usar precio sugerido: ${precioSugerido.toFixed(2)}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
