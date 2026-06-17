/**
 * ProductoCTRUDossier — Mini-dossier de UN producto (F5d · mockup ctru-recuperacion-hub-v2 §Acto 3).
 *
 * Reemplaza el modal legacy ProductoCTRUDetail (sub-tabs + labels muertos Capas 1-6/GA-GO).
 * Todo de ese producto JUNTO, ordenado por DECISIÓN, cada sección cierra en una acción:
 *   signos vitales (CTRU/piso/utilidad/recuperado/mejor canal) →
 *   Veredicto + acción · ¿En qué canal? · Recuperación · Costo (componentes) · Precio por canal.
 *
 * Wireado a las funciones puras del modelo (precioMinimo + recuperación).
 */
import React from 'react';
import { Gavel, GitBranch, TrendingUp, DollarSign, Tag, Lightbulb, AlertTriangle, Lock } from 'lucide-react';
import { Modal } from '../../common';
import type { CTRUProductoDetalle } from '../../../store/ctruStore';
import type { CanalVenta } from '../../../types/canalVenta.types';
import { buildPisosPorCanal } from '../../../utils/precioMinimo.utils';
import { calcularCurvaRecuperacion } from '../../../utils/recuperacion.utils';

interface Props {
  producto: CTRUProductoDetalle;
  canales: CanalVenta[];
  onClose: () => void;
}

const fmt = (n: number) => (Number.isFinite(n) ? `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}` : '—');

const Seccion: React.FC<{ icon: React.ReactNode; titulo: string; nota?: React.ReactNode; children: React.ReactNode; destacada?: boolean }> = ({ icon, titulo, nota, children, destacada }) => (
  <div className={`bg-white border rounded-2xl overflow-hidden ${destacada ? 'border-indigo-200' : 'border-slate-200'}`}>
    <div className={`px-4 py-3 flex items-center gap-2 ${destacada ? 'bg-indigo-50/50' : 'bg-slate-50/50'}`}>
      <span className="text-[13px] font-bold text-slate-900 flex items-center gap-2">{icon} {titulo}</span>
      {nota && <span className="text-[11px] font-normal">{nota}</span>}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

export const ProductoCTRUDossier: React.FC<Props> = ({ producto: p, canales, onClose }) => {
  const ctru = p.ctruContableProm || 0;
  const precioActual = p.precioVentaProm || 0;
  const utilidadPct = p.margenNetoProm || 0;

  // Recuperación
  const base = ctru * (p.totalUnidades || 0);
  const curva = calcularCurvaRecuperacion(
    p.ventasDetalle.map((v) => ({ fecha: v.fecha, cantidad: v.cantidad, contribucionUnitaria: v.contribucionUnitaria, costoUnitario: v.costoUnitario, canal: v.canal })),
    base,
  );

  // Precio mínimo por canal
  const pisos = buildPisosPorCanal(ctru, canales);
  const pisoDirecto = pisos.length ? Math.min(...pisos.map((x) => x.pisoAbsoluto)) : ctru;

  // Análisis por canal (margen al precio actual, descontando comisión)
  const canalAnalisis = canales
    .map((c) => {
      const comision = (c.comisionPorcentaje ?? 0) / 100;
      const margenPct = precioActual > 0 ? ((precioActual * (1 - comision) - ctru) / precioActual) * 100 : 0;
      return { nombre: c.nombre, comisionPct: c.comisionPorcentaje ?? 0, margenPct };
    })
    .sort((a, b) => b.margenPct - a.margenPct);
  const mejorCanal = canalAnalisis[0];
  const peorCanal = canalAnalisis[canalAnalisis.length - 1];

  // Veredicto + acción
  const pierde = utilidadPct < 0;
  const recuperado = curva.pctRecuperado;
  const veredicto = pierde
    ? `Este producto pierde plata en utilidad real (${Math.round(utilidadPct)}%). Solo recuperó ${Math.round(recuperado)}% de lo invertido.`
    : recuperado < 50
    ? `Rinde (${Math.round(utilidadPct)}% de utilidad real) pero recuperó solo ${Math.round(recuperado)}% de lo invertido — rota lento.`
    : `Rinde bien (${Math.round(utilidadPct)}% de utilidad real) y ya recuperó ${Math.round(recuperado)}% de lo invertido.`;
  const accion = pierde && mejorCanal && peorCanal && mejorCanal.nombre !== peorCanal.nombre && mejorCanal.margenPct > 0
    ? `Sacarlo de ${peorCanal.nombre} y empujarlo en ${mejorCanal.nombre} (ahí deja ${Math.round(mejorCanal.margenPct)}%).`
    : recuperado < 50
    ? 'Rota lento — evaluá reponer menos o bajar el precio para acelerar la recuperación.'
    : 'Reponer: rinde y ya amortizó su costo.';

  const componentes = [
    { label: 'Producto', color: 'bg-blue-500', monto: p.costoCompraPENProm || 0 },
    { label: 'Flete', color: 'bg-indigo-500', monto: p.costoFleteIntlPENProm || 0 },
    { label: 'Impuesto', color: 'bg-amber-500', monto: p.costoImpuestoPENProm || 0 },
    { label: 'Landed / cargos', color: 'bg-slate-400', monto: (p.costoEnvioPENProm || 0) + (p.costoOtrosPENProm || 0) },
  ].filter((c) => Math.abs(c.monto) > 0.005);

  const vital = (label: string, valor: string, tono?: 'rose' | 'emerald') => (
    <div className={`rounded-lg p-2 text-center ${tono === 'rose' ? 'bg-rose-50' : tono === 'emerald' ? 'bg-emerald-50' : 'bg-slate-50'}`}>
      <div className={`text-[9px] uppercase tracking-wider font-bold ${tono === 'rose' ? 'text-rose-500' : tono === 'emerald' ? 'text-emerald-600' : 'text-slate-400'}`}>{label}</div>
      <div className={`text-[15px] font-bold tabular-nums ${tono === 'rose' ? 'text-rose-600' : tono === 'emerald' ? 'text-emerald-700' : 'text-slate-900'}`}>{valor}</div>
    </div>
  );

  return (
    <Modal isOpen onClose={onClose} title={p.productoNombre} size="xl">
      <div className="space-y-3">
        {/* Signos vitales */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {vital('CTRU', fmt(ctru))}
          {vital('Piso (directo)', fmt(pisoDirecto))}
          {vital('Utilidad real', `${Math.round(utilidadPct)}%`, pierde ? 'rose' : undefined)}
          {vital('Recuperado', `${Math.round(recuperado)}%`)}
          {vital('Mejor canal', mejorCanal?.nombre ?? '—', 'emerald')}
        </div>

        {/* §1 Veredicto + acción */}
        <Seccion icon={<Gavel className="w-4 h-4 text-indigo-600" />} titulo="Veredicto" destacada>
          <p className="text-[13px] text-slate-700 mb-3">{veredicto}</p>
          <div className="bg-indigo-600 text-white rounded-lg px-3 py-2.5 flex items-start gap-2 text-[13px] font-semibold">
            <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" /> Acción sugerida: {accion}
          </div>
        </Seccion>

        {/* §2 ¿En qué canal? */}
        {canalAnalisis.length > 0 && precioActual > 0 && (
          <Seccion icon={<GitBranch className="w-4 h-4 text-slate-500" />} titulo="¿En qué canal conviene?">
            <table className="w-full text-[12px]">
              <tbody className="divide-y divide-slate-100">
                {canalAnalisis.map((c) => (
                  <tr key={c.nombre} className={c.margenPct < 0 ? 'bg-rose-50/40' : c === mejorCanal ? 'bg-emerald-50/40' : ''}>
                    <td className="py-2 font-medium">{c.nombre}</td>
                    <td className="text-right tabular-nums text-slate-500">{c.comisionPct > 0 ? `comisión ${c.comisionPct}%` : 'sin comisión'}</td>
                    <td className={`text-right tabular-nums font-bold ${c.margenPct < 0 ? 'text-rose-600' : c.margenPct < 10 ? 'text-amber-600' : 'text-emerald-700'}`}>{Math.round(c.margenPct)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Seccion>
        )}

        {/* §3 Recuperación */}
        <Seccion icon={<TrendingUp className="w-4 h-4 text-slate-500" />} titulo="Recuperación" nota={<span className="text-rose-400">· {Math.round(recuperado)}% de lo invertido</span>}>
          <div className="flex items-center justify-between text-[12px] mb-1.5">
            <span className="text-slate-600">Invertido {fmt(base)} · recuperado {fmt(curva.totalRecuperado)}</span>
            <span className={`font-bold tabular-nums ${recuperado >= 100 ? 'text-emerald-600' : 'text-rose-600'}`}>{Math.round(recuperado)}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${recuperado >= 100 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, recuperado)}%` }} />
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {curva.breakEvenIndex !== null ? 'Ya cruzó el break-even (recuperó toda la inversión).' : `Faltan ${fmt(curva.porRecuperar)} para el break-even.`}
          </div>
          {curva.ventasSinCosto > 0 && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-[11px] text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {curva.ventasSinCosto} venta{curva.ventasSinCosto === 1 ? '' : 's'} sin costo asignado quedó fuera de la curva · la recuperación real podría ser algo menor.
            </div>
          )}
        </Seccion>

        {/* §4 Costo · componentes */}
        <Seccion icon={<DollarSign className="w-4 h-4 text-slate-500" />} titulo="Costo · componentes">
          <div className="space-y-1 text-[12px]">
            {componentes.map((c) => (
              <div key={c.label} className="flex justify-between py-0.5">
                <span className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${c.color}`} /> {c.label}</span>
                <span className="tabular-nums">{fmt(c.monto)}</span>
              </div>
            ))}
            <div className="flex justify-between py-1 font-bold border-t-2 border-slate-300 mt-1"><span>= CTRU /unidad</span><span className="tabular-nums text-indigo-700">{fmt(ctru)}</span></div>
          </div>
          <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] text-slate-500 flex items-center gap-2"><Lock className="w-3 h-3 text-slate-400 flex-shrink-0" /> Costo congelado al recibir (inmutable).</div>
        </Seccion>

        {/* §5 Precio mínimo por canal */}
        {pisos.length > 0 && (
          <Seccion icon={<Tag className="w-4 h-4 text-slate-500" />} titulo="Precio mínimo por canal">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  <th className="text-left font-bold py-1.5">Canal</th><th className="text-right font-bold py-1.5 px-2">Piso (no perder)</th><th className="text-right font-bold py-1.5 px-2">Margen 20%</th><th className="text-right font-bold py-1.5 px-2">Margen 30%</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {pisos.map((x) => (
                    <tr key={x.canalId}>
                      <td className="py-1.5 font-medium">{x.canalNombre}{x.comisionPct > 0 && <span className="text-slate-300"> · {x.comisionPct}%</span>}</td>
                      <td className="text-right tabular-nums px-2 font-semibold text-rose-700">{fmt(x.pisoAbsoluto)}</td>
                      <td className="text-right tabular-nums px-2 text-amber-700">{fmt(x.piso20)}</td>
                      <td className="text-right tabular-nums px-2 text-emerald-700">{fmt(x.piso30)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {precioActual > 0 && (
              <div className="mt-2 text-[11px] text-slate-500">Vendés a <b className="text-slate-700">{fmt(precioActual)}</b>.</div>
            )}
          </Seccion>
        )}
      </div>
    </Modal>
  );
};
