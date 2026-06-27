/**
 * ModoApuesta · F4+ · Creación guiada · modo Apuesta (mockup acto 3 + candado acto 5).
 *
 * Lista los CANDIDATOS investigados (productos nuevos con investigación cumplida ·
 * "candado abierto" · ≥1 proveedor + ≥1 competidor). Al seleccionar uno, captura la
 * TESIS (obligatoria) + precioVentaPEN + cantidad. Crea un req subtipo=apuesta.
 *
 * El CANDADO (acto 5): productos nuevos SIN investigación no aparecen como candidato
 * (seleccionarCandidatosApuesta los filtra). El empty state explica cómo investigar.
 *
 * Estados: empty · sin candidatos (acto 7) con CTA a Investigar.
 */
import React from 'react';
import { Microscope, LockOpen, Truck, Store, Plus } from 'lucide-react';
import type { CandidatoApuesta } from './creacionGuiada.helper';

interface Props {
  candidatos: CandidatoApuesta[];
  /** productoId del candidato seleccionado (apuesta = 1 a la vez). */
  seleccionId: string | null;
  onSelect: (productoId: string) => void;
  cantidad: number;
  onCantidadChange: (cantidad: number) => void;
  tesis: string;
  onTesisChange: (tesis: string) => void;
  precioVentaPEN: number;
  onPrecioVentaChange: (precio: number) => void;
  /** Abre la pantalla de investigación de producto (Productos · candado). */
  onInvestigar: () => void;
}

export const ModoApuesta: React.FC<Props> = ({
  candidatos,
  seleccionId,
  onSelect,
  cantidad,
  onCantidadChange,
  tesis,
  onTesisChange,
  precioVentaPEN,
  onPrecioVentaChange,
  onInvestigar,
}) => {
  // ── Empty · sin candidatos (acto 7) ──
  if (candidatos.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
          <Microscope className="w-5 h-5 text-amber-600" />
        </div>
        <div className="text-[13px] font-semibold text-slate-800">Apuesta · sin candidatos</div>
        <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
          No hay productos investigados sin apostar. Un producto nuevo necesita investigación mínima
          (≥1 proveedor + ≥1 competidor) para poder apostarse.
        </p>
        <button
          type="button"
          onClick={onInvestigar}
          className="mt-3 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 hover:bg-amber-100"
        >
          <Plus className="w-3 h-3" /> Investigar un producto
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-[12px] text-slate-600">
          Candidatos <b className="text-slate-900">investigados</b> y aún no apostados (candado cumplido).
        </div>
        <button
          type="button"
          onClick={onInvestigar}
          className="text-[12px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 hover:bg-amber-100 flex-shrink-0"
        >
          <Microscope className="w-3.5 h-3.5" /> Investigar nuevo
        </button>
      </div>

      <div className="space-y-2">
        {candidatos.map((c) => {
          const id = c.producto.id;
          const seleccionado = seleccionId === id;
          return (
            <div
              key={id}
              className={`rounded-xl p-4 ${
                seleccionado ? 'border border-amber-300 bg-amber-50/30 ring-1 ring-amber-200' : 'border border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={seleccionado}
                  onChange={() => onSelect(seleccionado ? '' : id)}
                  className="mt-1 rounded border-slate-300 text-amber-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13px] font-semibold text-slate-800 truncate">
                      {c.producto.marca} · {c.producto.nombreComercial}
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5 inline-flex items-center gap-1 flex-shrink-0">
                      <LockOpen className="w-3 h-3" /> investigado
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Truck className="w-3 h-3 text-slate-400" /> {c.candado.numProveedores} proveedor{c.candado.numProveedores !== 1 ? 'es' : ''}
                      {c.proveedorMinUSD != null && ` · $${c.proveedorMinUSD.toFixed(2)}${c.proveedorMaxUSD && c.proveedorMaxUSD !== c.proveedorMinUSD ? `–${c.proveedorMaxUSD.toFixed(2)}` : ''}`}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Store className="w-3 h-3 text-slate-400" /> {c.candado.numCompetidores} competidor{c.candado.numCompetidores !== 1 ? 'es' : ''}
                      {c.competidorMinPEN != null && ` · S/ ${c.competidorMinPEN.toFixed(0)}${c.competidorMaxPEN && c.competidorMaxPEN !== c.competidorMinPEN ? `–${c.competidorMaxPEN.toFixed(0)}` : ''}`}
                    </span>
                    {c.margenEstimadoPct != null && (
                      <span className="text-emerald-600 font-medium">margen est. {c.margenEstimadoPct}%</span>
                    )}
                  </div>

                  {/* Tesis + precio (solo en el seleccionado) */}
                  {seleccionado && (
                    <>
                      <div className="mt-3">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          Tesis · por qué apostás (obligatoria)
                        </label>
                        <textarea
                          rows={2}
                          value={tesis}
                          onChange={(e) => onTesisChange(e.target.value)}
                          maxLength={400}
                          placeholder="Tendencia en alza local; ningún competidor cubre el segmento; demanda observada en consultas…"
                          className="w-full mt-1 text-[12px] border border-amber-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-amber-500/40 focus:border-amber-300 resize-none"
                        />
                      </div>
                      <div className="mt-2">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Precio de venta (S/) <span className="font-normal text-slate-400">· para el margen</span>
                        </label>
                        <div className="relative mt-1 max-w-[160px]">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[12px]">S/</span>
                          <input
                            type="number"
                            step="0.01"
                            value={precioVentaPEN || ''}
                            onChange={(e) => onPrecioVentaChange(parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500/40 focus:border-amber-300 tabular-nums"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {seleccionado && (
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">Apostar</div>
                    <input
                      type="number"
                      min={1}
                      value={cantidad}
                      onChange={(e) => onCantidadChange(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 text-center text-[13px] font-bold text-slate-900 tabular-nums border border-slate-200 rounded py-0.5 mt-1"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default ModoApuesta;
