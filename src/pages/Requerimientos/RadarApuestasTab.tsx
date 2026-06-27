/**
 * RadarApuestasTab · F4+ · cierra el BUCLE de la apuesta (mockup requerimientos-creacion-guiada · acto 6/7/8).
 *
 * La creación guiada CREA la apuesta (subtipo='apuesta' + tesis + ROI pre-compra) · este radar la TRACKEA:
 * ¿la tesis se cumplió? 100% DERIVADO (cero schema nuevo): cruza requerimientos subtipo='apuesta' con la
 * recuperación de CTRU + la rotación de productoIntel. El ensamblado vive en `useRadarApuestas`; el veredicto
 * y el resumen en el núcleo PURO `radarApuestas.helper`. Acá solo presentación (canon DS · chrome BLUE).
 *
 * Acciones por veredicto (acto 6):
 *   - Ver        (en evaluación) → abre el dossier de recuperación REUSANDO ProductoCTRUDossier (read-only).
 *   - Graduar    (acierto)       → abre el dossier · NO muta (no existe un camino limpio estado='catálogo'
 *                                  sin inventar schema · decisión pendiente · ver reporte).
 *   - Descontinuar (fallida)     → abre el dossier · NO muta (el único soft-delete existente marca
 *                                  estado='eliminado' ≠ 'descontinuado' y toca métricas de marca · no es
 *                                  el camino semánticamente correcto · decisión pendiente · ver reporte).
 */
import React, { useState } from 'react';
import { Trophy, Loader, TrendingDown, Award, Archive, Info, Target, Eye } from 'lucide-react';
import { ProductoCTRUDossier } from '../../components/modules/ctru/ProductoCTRUDossier';
import { useCanalVentaStore } from '../../store/canalVentaStore';
import { tonoRecuperacion, type FilaApuesta, type VeredictoApuesta } from './radarApuestas.helper';
import { useRadarApuestas } from './useRadarApuestas';
import type { CTRUProductoDetalle } from '../../store/ctruStore';
import type { Requerimiento } from '../../types/requerimiento.types';

interface Props {
  /** Requerimientos del hub (ya filtrados por línea de negocio). */
  requerimientos: Requerimiento[];
}

const fmtUSD = (n: number) => `$ ${Math.round(n).toLocaleString('en-US')}`;

// Config del badge de veredicto (color semántico en el DATO · canon).
const VEREDICTO_CFG: Record<VeredictoApuesta, { label: string; cls: string; Icon: typeof Trophy }> = {
  acierto: { label: 'acierto', cls: 'text-emerald-700 bg-emerald-100', Icon: Trophy },
  en_evaluacion: { label: 'en evaluación', cls: 'text-slate-600 bg-slate-100', Icon: Loader },
  fallida: { label: 'fallida', cls: 'text-rose-700 bg-rose-100', Icon: TrendingDown },
};

// Tono semántico de la barra de recuperación → clase de fondo (bg-{tono}-500).
const BARRA_BG: Record<ReturnType<typeof tonoRecuperacion>, string> = {
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  rose: 'bg-rose-500',
};
const PCT_TEXT: Record<ReturnType<typeof tonoRecuperacion>, string> = {
  emerald: 'text-emerald-700',
  sky: 'text-sky-700',
  rose: 'text-rose-700',
};
const ROTACION_TEXT: Record<FilaApuesta['rotacionTono'], string> = {
  emerald: 'text-emerald-700',
  slate: 'text-slate-600',
  rose: 'text-rose-600',
};

const VeredictoBadge: React.FC<{ veredicto: VeredictoApuesta }> = ({ veredicto }) => {
  const cfg = VEREDICTO_CFG[veredicto];
  return (
    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 inline-flex items-center gap-1 ${cfg.cls}`}>
      <cfg.Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
};

const BarraRecuperacion: React.FC<{ pct: number }> = ({ pct }) => {
  const tono = tonoRecuperacion(pct);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${BARRA_BG[tono]}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-[11px] font-bold tabular-nums ${PCT_TEXT[tono]}`}>{Math.round(pct)}%</span>
    </div>
  );
};

export const RadarApuestasTab: React.FC<Props> = ({ requerimientos }) => {
  const { filas, resumen, loading, detallePorProducto } = useRadarApuestas(requerimientos);
  const canalesActivos = useCanalVentaStore((s) => s.canalesActivos);
  const fetchCanalesActivos = useCanalVentaStore((s) => s.fetchCanalesActivos);
  const [productoDossier, setProductoDossier] = useState<CTRUProductoDetalle | null>(null);

  // Abre el dossier de recuperación del producto (read-only) · carga los canales si hicieran falta.
  const abrirDossier = (productoId: string) => {
    const detalle = detallePorProducto.get(productoId);
    if (!detalle) return;
    if (canalesActivos.length === 0) void fetchCanalesActivos();
    setProductoDossier(detalle);
  };

  // ── Loading · motor calculando (acto 7) ──
  if (loading) {
    return (
      <div className="p-3 sm:p-4 md:p-6">
        <div className="space-y-2">
          <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Empty · sin apuestas que trackear (acto 7 adaptado) ──
  if (filas.length === 0) {
    return (
      <div className="p-3 sm:p-4 md:p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-[13px] font-semibold text-slate-800">Sin apuestas que trackear</div>
          <p className="text-[11px] text-slate-500 mt-1">
            Cuando crees un requerimiento de tipo <b>Apuesta</b> (producto nuevo + tesis), acá vas a ver si la tesis se cumple: recuperación de CTRU, rotación y veredicto a 365 días.
          </p>
        </div>
      </div>
    );
  }

  const accionPorVeredicto = (fila: FilaApuesta) => {
    if (fila.veredicto === 'acierto') {
      return (
        <button
          type="button"
          onClick={() => abrirDossier(fila.productoId)}
          className="text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-2.5 py-1 inline-flex items-center gap-1"
        >
          <Award className="w-3 h-3" /> Graduar
        </button>
      );
    }
    if (fila.veredicto === 'fallida') {
      return (
        <button
          type="button"
          onClick={() => abrirDossier(fila.productoId)}
          className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg px-2.5 py-1 inline-flex items-center gap-1"
        >
          <Archive className="w-3 h-3" /> Descontinuar
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => abrirDossier(fila.productoId)}
        className="text-[11px] font-medium text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1 hover:bg-slate-50"
      >
        Ver
      </button>
    );
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* ── KPI strip 4 (acto 6) · color semántico en el dato ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-100 border-b border-slate-200">
          <div className="bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">En evaluación</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{resumen.enEvaluacion}</div>
          </div>
          <div className="bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-wide text-emerald-600 font-bold">Aciertos</div>
            <div className="text-2xl font-bold text-emerald-700 tabular-nums">{resumen.aciertos}</div>
          </div>
          <div className="bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-wide text-rose-600 font-bold">Fallidas</div>
            <div className="text-2xl font-bold text-rose-700 tabular-nums">{resumen.fallidas}</div>
          </div>
          <div className="bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-wide text-amber-600 font-bold">Tasa de acierto</div>
            <div className="text-2xl font-bold text-amber-700 tabular-nums">
              {resumen.tasaAciertoPct === null ? '—' : <>{resumen.tasaAciertoPct}<span className="text-amber-400">%</span></>}
            </div>
          </div>
        </div>

        {/* ── Tabla 7 columnas · desktop (acto 6) ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[12px] min-w-[860px]">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wide">
              <tr>
                <th className="text-left font-semibold px-5 py-2.5">Producto · tesis</th>
                <th className="text-right font-semibold px-4 py-2.5">CTRU invertido</th>
                <th className="text-left font-semibold px-4 py-2.5 w-44">Recuperación</th>
                <th className="text-left font-semibold px-4 py-2.5">Rotación</th>
                <th className="text-right font-semibold px-4 py-2.5">Día / 365</th>
                <th className="text-left font-semibold px-4 py-2.5">Veredicto</th>
                <th className="text-right font-semibold px-5 py-2.5">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((f) => (
                <tr key={f.requerimientoId} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-slate-800">{f.nombre}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[220px]">{f.tesis || 'Sin tesis registrada'}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-700">{fmtUSD(f.ctruInvertidoUSD)}</td>
                  <td className="px-4 py-3"><BarraRecuperacion pct={f.recuperacionPct} /></td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-medium ${ROTACION_TEXT[f.rotacionTono]}`}>{f.rotacionLabel}</span></td>
                  <td className={`px-4 py-3 text-right tabular-nums ${f.veredicto === 'fallida' ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>{f.diasDesdeCreacion}</td>
                  <td className="px-4 py-3"><VeredictoBadge veredicto={f.veredicto} /></td>
                  <td className="px-5 py-3 text-right">{accionPorVeredicto(f)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Cards · mobile (acto 8) ── */}
        <div className="md:hidden p-3 space-y-2">
          {filas.map((f) => (
            <div key={f.requerimientoId} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] font-semibold text-slate-800 truncate">{f.nombre}</div>
                <VeredictoBadge veredicto={f.veredicto} />
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                {f.veredicto === 'en_evaluacion' && f.tesis
                  ? f.tesis
                  : `Día ${f.diasDesdeCreacion}/365 · ${f.rotacionLabel}`}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 tabular-nums">CTRU invertido <b className="text-slate-600">{fmtUSD(f.ctruInvertidoUSD)}</b></div>
              <div className="mt-2"><BarraRecuperacion pct={f.recuperacionPct} /></div>
              <div className="mt-2">
                {f.veredicto === 'acierto' ? (
                  <button type="button" onClick={() => abrirDossier(f.productoId)} className="w-full text-[11px] font-semibold text-white bg-emerald-600 rounded-lg py-1.5 inline-flex items-center justify-center gap-1">
                    <Award className="w-3 h-3" /> Graduar a catálogo
                  </button>
                ) : f.veredicto === 'fallida' ? (
                  <button type="button" onClick={() => abrirDossier(f.productoId)} className="w-full text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg py-1.5 inline-flex items-center justify-center gap-1">
                    <Archive className="w-3 h-3" /> Descontinuar
                  </button>
                ) : (
                  <button type="button" onClick={() => abrirDossier(f.productoId)} className="w-full text-[11px] font-medium text-slate-600 border border-slate-200 rounded-lg py-1.5 inline-flex items-center justify-center gap-1">
                    <Eye className="w-3 h-3" /> Ver recuperación
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Footer · todo derivado (acto 6) ── */}
        <div className="px-5 py-2.5 bg-slate-50/60 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
          <Info className="w-3 h-3" /> Todo derivado: cruza requerimientos subtipo=apuesta con productoIntel (rotación) + recuperación de CTRU. Cero campos nuevos en el producto.
        </div>
      </div>

      {/* Dossier de recuperación (read-only · reusa ProductoCTRUDossier) */}
      {productoDossier && (
        <ProductoCTRUDossier
          producto={productoDossier}
          canales={canalesActivos}
          onClose={() => setProductoDossier(null)}
        />
      )}
    </div>
  );
};
