/**
 * OCLandedCard — re-home del costo LANDED en el detalle de OC (F3 · 2026-06-18).
 *
 * Responde la pregunta del usuario: "¿cuánto gasté en total por esta OC?" — el costo ya
 * ATERRIZADO (comercial + flete/recojo/impuesto de Envíos), que antes vivía expulsado al
 * módulo CTRU vía un link. Suma getCTRU sobre las unidades aterrizadas de la OC (componentes
 * congelados · misma fuente que CTRU = cero "dos números"). El delta vs comercial es
 * "sobrecosto logístico" — CONTRASTE, no suma (sin doble-conteo).
 *
 * Fetch dirigido por OC (unidadService.buscar · NO clobbea el store global). Lógica de cálculo
 * en resumirLandedOC (puro · testeado · invariante landed === Σ capas).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { TrendingUp, Package, AlertTriangle, RefreshCw } from 'lucide-react';
import type { OrdenCompra } from '../../../types/ordenCompra.types';
import { unidadService } from '../../../services/unidad.service';
import { resumirLandedOC, type ResumenLandedOC } from '../../../utils/ctru.utils';

interface Props {
  orden: OrdenCompra;
  /** Total comercial de la OC en USD (getCargosEfectivosOC.total) para el contraste. */
  comercialTotalUSD: number;
  /** TC de referencia para llevar el comercial a PEN. */
  tcRef: number;
}

const fmt = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt0 = (n: number) => `S/ ${Math.round(n).toLocaleString('es-PE')}`;

export const OCLandedCard: React.FC<Props> = ({ orden, comercialTotalUSD, tcRef }) => {
  const [estado, setEstado] = useState<'loading' | 'ok' | 'error'>('loading');
  const [resumen, setResumen] = useState<ResumenLandedOC | null>(null);

  const cargar = useCallback(() => {
    let cancelado = false;
    setEstado('loading');
    unidadService
      .buscar({ ordenCompraId: orden.id })
      .then((unidades) => {
        if (cancelado) return;
        setResumen(resumirLandedOC(unidades));
        setEstado('ok');
      })
      .catch(() => {
        if (!cancelado) setEstado('error');
      });
    return () => {
      cancelado = true;
    };
  }, [orden.id]);

  useEffect(() => cargar(), [cargar]);

  // En borrador/cancelada aún no existen unidades creadas → no hay landed que mostrar.
  if (orden.estado === 'borrador' || orden.estado === 'cancelada') return null;

  const titulo = (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
        ¿Cuánto gasté en total por esta OC?
      </span>
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200 normal-case">
        landed · ya aterrizado
      </span>
    </div>
  );

  if (estado === 'loading') {
    return (
      <div>
        {titulo}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
          <div className="h-7 w-40 bg-slate-100 rounded animate-pulse" />
          <div className="h-2.5 w-full bg-slate-100 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (estado === 'error') {
    return (
      <div>
        {titulo}
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[12px] text-rose-700">
            <AlertTriangle className="w-4 h-4" /> No se pudo calcular el landed.
          </div>
          <button
            type="button"
            onClick={cargar}
            className="text-[12px] font-semibold text-rose-700 border border-rose-300 rounded-lg px-2.5 py-1 hover:bg-rose-100 inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  const r = resumen!;

  // Empty: ninguna unidad aterrizada todavía (en tránsito / sin recibir).
  if (r.unidadesConCosto === 0) {
    return (
      <div>
        {titulo}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center text-center">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-2">
            <Package className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-[13px] font-semibold text-slate-900">Costo landed pendiente</div>
          <div className="text-[11px] text-slate-500 mt-1 max-w-xs">
            El landed total estará disponible cuando se reciban las unidades de esta OC. Por ahora ves
            solo el comercial ↑.
          </div>
        </div>
      </div>
    );
  }

  const fullyLanded = r.unidadesConCosto === r.unidadesTotal && r.unidadesTotal > 0;
  const comercialPEN = comercialTotalUSD * (tcRef || 0);
  // Solo mostramos el delta cuando TODA la OC aterrizó (comparar landed parcial vs comercial
  // total sería apples-to-oranges).
  const sobrecosto = fullyLanded && comercialPEN > 0 ? r.landedTotalPEN - comercialPEN : null;
  const total = r.landedTotalPEN || 1;
  const pct = (n: number) => Math.max(0, Math.round((n / total) * 100));

  return (
    <div>
      {titulo}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100/40 ring-1 ring-blue-200/60 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-blue-700 font-bold mb-1">Landed total</div>
            <div className="text-2xl font-bold tabular-nums text-blue-900">{fmt(r.landedTotalPEN)}</div>
            <div className="text-[11px] text-blue-700 mt-1">
              {r.unidadesConCosto} de {r.unidadesTotal} unidades recibidas
            </div>
          </div>
          {sobrecosto != null && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Sobrecosto logístico</div>
              <div className="text-base font-bold tabular-nums text-slate-700 flex items-center justify-end gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> {sobrecosto >= 0 ? '+' : ''}{fmt0(sobrecosto)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">vs comercial · NO suma (contraste)</div>
            </div>
          )}
        </div>
        {/* Composición por capa (¿dónde se va la plata?) */}
        <div className="mt-3 pt-3 border-t border-blue-200/60">
          <div className="h-2.5 rounded-full overflow-hidden bg-white/60 flex mb-2">
            <div className="bg-blue-500" style={{ width: `${pct(r.capas.producto)}%` }} />
            <div className="bg-amber-500" style={{ width: `${pct(r.capas.impuesto)}%` }} />
            <div className="bg-indigo-500" style={{ width: `${pct(r.capas.flete)}%` }} />
            <div className="bg-slate-400" style={{ width: `${pct(Math.max(0, r.capas.otros))}%` }} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Producto {fmt0(r.capas.producto)}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Impuesto {fmt0(r.capas.impuesto)}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Flete {fmt0(r.capas.flete)}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Otros {fmt0(r.capas.otros)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
