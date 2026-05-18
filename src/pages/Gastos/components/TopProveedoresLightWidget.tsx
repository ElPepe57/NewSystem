/**
 * TopProveedoresLightWidget · ranking ligero de proveedores del mes · Gastos rework v3
 *
 * chk5.C5 (S3.6 M3 · Gastos Rework) · pixel-perfect contra mockup canon
 * `gastos-rework-v3-final.html · Sección 1 · sidebar · Top proveedores LIGHT`.
 *
 * NO duplica la "VistaPorProveedor" (que es vista alternativa pesada con
 * sparklines + drill). Esta es solo un ranking compacto que vive en el
 * sidebar de la página principal · 5 filas · monto + % del mes · link al
 * análisis completo en Maestros.
 *
 * D-GR-8 · cross-link: análisis profundo de proveedores vive en /maestros,
 * NO en Gastos. Este widget es solo un hint operativo "quién pesa más".
 */

import React, { useMemo } from 'react';
import { Users, ArrowRight } from 'lucide-react';

interface GastoInput {
  proveedor?: string;
  proveedorNombre?: string;
  montoPEN: number;
}

interface TopProveedoresLightWidgetProps {
  /** Gastos del mes seleccionado · YA filtrados por mes/año por el padre */
  gastosDelMes: GastoInput[];
  /** Click en el link footer · navega a /maestros?tab=proveedores */
  onVerAnalisisCompleto: () => void;
  /** Click en una fila de proveedor · pasa el nombre para drill o filtro */
  onClickProveedor?: (nombreProveedor: string) => void;
  /** Cuántos proveedores mostrar · default 5 */
  topN?: number;
}

const formatPEN0 = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(n);

export const TopProveedoresLightWidget: React.FC<TopProveedoresLightWidgetProps> = ({
  gastosDelMes,
  onVerAnalisisCompleto,
  onClickProveedor,
  topN = 5,
}) => {
  // Calcular top proveedores · agregación por nombre
  const { top, totalMes, hayDatos } = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const g of gastosDelMes) {
      const nombre = (g.proveedor || g.proveedorNombre || '').trim();
      if (!nombre) continue; // sin proveedor explícito → ignorar
      const monto = g.montoPEN || 0;
      map.set(nombre, (map.get(nombre) || 0) + monto);
      total += monto;
    }
    const arr = Array.from(map.entries())
      .map(([nombre, monto]) => ({ nombre, monto }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, topN);
    return { top: arr, totalMes: total, hayDatos: arr.length > 0 };
  }, [gastosDelMes, topN]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-slate-600" />
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Top proveedores · mes
        </span>
      </div>

      {hayDatos ? (
        <div className="space-y-1.5 text-[11px]">
          {top.map(({ nombre, monto }) => {
            const pct = totalMes > 0 ? Math.round((monto / totalMes) * 100) : 0;
            return (
              <div key={nombre} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onClickProveedor?.(nombre)}
                  className="text-slate-700 hover:text-teal-700 hover:underline truncate text-left flex-1 min-w-0"
                  title={nombre}
                  disabled={!onClickProveedor}
                >
                  {nombre}
                </button>
                <span className="font-bold tabular-nums text-slate-900 flex-shrink-0">
                  {formatPEN0(monto)}{' '}
                  <span className="text-slate-400 text-[9px] font-normal">{pct}%</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[11px] text-slate-400 italic text-center py-4">
          Sin proveedores este mes.
        </div>
      )}

      <button
        type="button"
        onClick={onVerAnalisisCompleto}
        className="mt-2 w-full text-[10px] text-teal-700 hover:text-teal-800 hover:underline text-center"
      >
        Ver análisis completo
        <ArrowRight className="w-2.5 h-2.5 inline ml-0.5" />
        <span className="text-slate-400 font-normal ml-1">en Maestros</span>
      </button>
    </div>
  );
};
