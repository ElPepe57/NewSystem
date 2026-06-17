/**
 * PrecioPorCanalTab — Tab "¿A cuánto vendo?" del hub CTRU (F5b).
 *
 * Catálogo de productos con su PISO DE PRECIO POR CANAL (don't-lose), wireando
 * `buildPisosPorCanal` (pata 2 del modelo) con los canales activos del maestro.
 * El piso de cada canal descuenta su comisión (ML ~13% sube el piso vs directo 0%).
 * Resalta en rose cuando el precio actual del producto cae por DEBAJO del piso de un canal.
 */
import React from 'react';
import { Tag, Settings2 } from 'lucide-react';
import type { CTRUProductoDetalle } from '../../../store/ctruStore';
import type { CanalVenta } from '../../../types/canalVenta.types';
import { buildPisosPorCanal } from '../../../utils/precioMinimo.utils';

interface Props {
  productos: CTRUProductoDetalle[];
  canales: CanalVenta[];
  onSelectProducto: (p: CTRUProductoDetalle) => void;
}

const fmt = (n: number) => (Number.isFinite(n) ? `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}` : '—');

export const PrecioPorCanalTab: React.FC<Props> = ({ productos, canales, onSelectProducto }) => {
  if (productos.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-3"><Tag className="w-6 h-6 text-indigo-400" /></div>
        <h3 className="text-[15px] font-semibold text-slate-900">Sin productos para fijar precio</h3>
        <p className="text-[12px] text-slate-500 mt-1 max-w-md">Cuando tengas productos con costo, acá vas a ver el piso de precio de cada uno por canal.</p>
      </div>
    );
  }

  if (canales.length === 0) {
    return (
      <div className="bg-white border border-amber-200 rounded-2xl p-8 flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-3"><Settings2 className="w-6 h-6 text-amber-500" /></div>
        <h3 className="text-[15px] font-semibold text-slate-900">No hay canales de venta configurados</h3>
        <p className="text-[12px] text-slate-500 mt-1 max-w-md">El piso por canal usa la comisión de cada canal. Configurá los canales (Mercado Libre, directo, tienda…) en Maestros para verlo.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="text-[14px] font-semibold text-slate-900 mb-1 flex items-center gap-2"><Tag className="w-4 h-4 text-indigo-600" /> Piso de precio por canal</h3>
      <p className="text-[11px] text-slate-500 mb-3">
        El <b>piso don't-lose</b> es el precio mínimo para NO PERDER, ya descontada la comisión de cada canal. Vender por debajo = sangrar.
        Las celdas en <span className="text-rose-600 font-medium">rose</span> son canales donde el precio actual no cubre el piso.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
              <th className="text-left font-bold py-2">Producto</th>
              <th className="text-right font-bold py-2 px-3">CTRU</th>
              <th className="text-right font-bold py-2 px-3">Precio actual</th>
              {canales.map((c) => (
                <th key={c.id} className="text-right font-bold py-2 px-3 whitespace-nowrap">
                  {c.nombre}
                  {(c.comisionPorcentaje ?? 0) > 0 && <span className="text-slate-300 font-medium"> · {c.comisionPorcentaje}%</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {productos.map((p) => {
              const ctru = p.ctruContableProm || 0;
              const precioActual = p.precioVentaProm || 0;
              const pisos = buildPisosPorCanal(ctru, canales);
              return (
                <tr key={p.productoId} onClick={() => onSelectProducto(p)} className="cursor-pointer hover:bg-slate-50">
                  <td className="py-2 font-medium text-slate-800">{p.productoNombre}</td>
                  <td className="text-right tabular-nums px-3 text-slate-600">{fmt(ctru)}</td>
                  <td className="text-right tabular-nums px-3 font-semibold">{precioActual > 0 ? fmt(precioActual) : '—'}</td>
                  {canales.map((c) => {
                    const piso = pisos.find((x) => x.canalId === c.id)?.pisoAbsoluto ?? Infinity;
                    const bajoPiso = precioActual > 0 && precioActual < piso;
                    return (
                      <td key={c.id} className={`text-right tabular-nums px-3 ${bajoPiso ? 'bg-rose-50 text-rose-700 font-bold' : 'text-slate-700'}`}>
                        {fmt(piso)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
