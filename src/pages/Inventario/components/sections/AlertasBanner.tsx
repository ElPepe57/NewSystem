/**
 * AlertasBanner · banner amber con resumen de alertas activas (chk4.7a)
 *
 * Pixel-perfect mockup stock-canon-s3.6-X.html · render entre KpiStripV2 y Tabs.
 *
 * Estructura:
 *   [icon AlertTriangle amber] [N alertas requieren atención inmediata]
 *   [resumen en línea de las primeras 3 alertas separadas por · ]
 *   [CTA "Ver todas en Atención →"  → onClick lleva al tab Atención]
 *
 * Solo se renderiza cuando alertas.length > 0.
 */

import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { AlertaProducto } from './AlertasPrioritarias';

interface AlertasBannerProps {
  alertas: AlertaProducto[];
  onIrAtencion: () => void;
}

const TIPO_RESUMEN: Record<AlertaProducto['tipo'], (a: AlertaProducto) => string> = {
  vencimiento: (a) =>
    `${a.producto.nombre} vence en ${a.diasRestantes ?? '?'} días`,
  stock_critico: (a) =>
    `${a.producto.nombre} está bajo stock mínimo`,
  sin_movimiento: (a) =>
    `${a.producto.nombre} sin movimiento`,
};

export const AlertasBanner: React.FC<AlertasBannerProps> = ({ alertas, onIrAtencion }) => {
  if (alertas.length === 0) return null;

  const top3 = alertas.slice(0, 3);
  const resumen = top3.map(a => TIPO_RESUMEN[a.tipo](a)).join(' · ');

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start justify-between gap-4 flex-wrap lg:flex-nowrap">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0 mt-0.5">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-amber-900 tabular-nums">
            {alertas.length} {alertas.length === 1 ? 'alerta requiere' : 'alertas requieren'} atención inmediata
          </div>
          <div className="text-xs text-amber-800 mt-0.5">
            {resumen}
            {alertas.length > 3 && <span className="text-amber-700"> · y {alertas.length - 3} más</span>}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onIrAtencion}
        className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors flex-shrink-0"
      >
        Ver todas en Atención
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
