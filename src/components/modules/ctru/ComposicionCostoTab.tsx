/**
 * ComposicionCostoTab — Tab "¿Dónde se va la plata?" del hub CTRU (F5c).
 *
 * Desglose del COSTO del producto (CTRU) por componente, con labels del modelo VIVO
 * (producto · flete · impuesto · landed) — sin GA/GO ni capas 1-6 del modelo muerto.
 * El detalle por ÁMBITO (envío vs etapa) y los costos ocultos de venta viven en el
 * mini-dossier de cada producto (§ costo · § dónde se va la plata).
 */
import React from 'react';
import { TrendingDown } from 'lucide-react';
import type { CTRUProductoDetalle } from '../../../store/ctruStore';

interface Props {
  productos: CTRUProductoDetalle[];
  onSelectProducto: (p: CTRUProductoDetalle) => void;
}

const fmt = (n: number) => `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;

// Componentes del CTRU (caja producto) · color por naturaleza (no chrome).
const COMPS = [
  { key: 'producto', label: 'Producto', color: 'bg-blue-500', get: (p: CTRUProductoDetalle) => p.costoCompraPENProm || 0 },
  { key: 'flete', label: 'Flete', color: 'bg-indigo-500', get: (p: CTRUProductoDetalle) => p.costoFleteIntlPENProm || 0 },
  { key: 'impuesto', label: 'Impuesto', color: 'bg-amber-500', get: (p: CTRUProductoDetalle) => p.costoImpuestoPENProm || 0 },
  { key: 'landed', label: 'Landed / cargos', color: 'bg-slate-400', get: (p: CTRUProductoDetalle) => (p.costoEnvioPENProm || 0) + (p.costoOtrosPENProm || 0) },
] as const;

export const ComposicionCostoTab: React.FC<Props> = ({ productos, onSelectProducto }) => {
  if (productos.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-3"><TrendingDown className="w-6 h-6 text-indigo-400" /></div>
        <h3 className="text-[15px] font-semibold text-slate-900">Sin costos para desglosar</h3>
        <p className="text-[12px] text-slate-500 mt-1 max-w-md">Cuando tengas productos con costo, acá vas a ver en qué se va la plata de cada CTRU.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="text-[14px] font-semibold text-slate-900 mb-1 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-indigo-600" /> ¿En qué se va el costo de cada producto?</h3>
      <p className="text-[11px] text-slate-500 mb-3">Desglose del CTRU por componente. El detalle por ámbito (envío vs etapa) y los costos ocultos de venta están en el dossier de cada producto.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead><tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
            <th className="text-left font-bold py-2">Producto</th>
            {COMPS.map((c) => <th key={c.key} className="text-right font-bold py-2 px-2 whitespace-nowrap">{c.label}</th>)}
            <th className="text-right font-bold py-2 px-2">CTRU</th>
            <th className="text-left font-bold py-2 pl-3 w-[160px]">Composición</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {productos.map((p) => {
              const ctru = p.ctruContableProm || 0;
              return (
                <tr key={p.productoId} onClick={() => onSelectProducto(p)} className="cursor-pointer hover:bg-slate-50">
                  <td className="py-2 font-medium text-slate-800">{p.productoNombre}</td>
                  {COMPS.map((c) => <td key={c.key} className="text-right tabular-nums px-2 text-slate-600">{fmt(c.get(p))}</td>)}
                  <td className="text-right tabular-nums px-2 font-bold text-indigo-700">{fmt(ctru)}</td>
                  <td className="pl-3">
                    <div className="h-2.5 rounded-full overflow-hidden bg-slate-100 flex">
                      {COMPS.map((c) => {
                        const pct = ctru > 0 ? (c.get(p) / ctru) * 100 : 0;
                        return pct > 0 ? <div key={c.key} className={c.color} style={{ width: `${pct}%` }} title={`${c.label} ${Math.round(pct)}%`} /> : null;
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Leyenda */}
      <div className="flex items-center gap-3 flex-wrap mt-3 text-[10px] text-slate-500">
        {COMPS.map((c) => <span key={c.key} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${c.color}`} /> {c.label}</span>)}
      </div>
    </div>
  );
};
