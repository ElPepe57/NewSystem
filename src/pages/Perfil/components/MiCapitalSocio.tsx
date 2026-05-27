/**
 * MiCapitalSocio · F10.F.1.G · 2026-05-27
 *
 * Card violet con resumen del capital del socio · vista propia simplificada.
 * Aparece SOLO si el user tiene rol 'socio' Y tiene datosSocio configurado.
 *
 * Canon v8.0 N1 · color semántico violet (capital · ownership · estratégico)
 * Mismo tinte que el módulo Inversionistas para mantener consistencia cross-módulo.
 *
 * Muestra:
 *   - % participación en el negocio
 *   - Tipo de participación (cash puro · mixta · valor puro)
 *   - Fecha ingreso al negocio (antigüedad)
 *   - Cross-link prominente a /inversionistas
 */
import React from 'react';
import { Coins, ExternalLink, Calendar, PieChart, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  TIPO_PARTICIPACION_LABEL,
  type DatosSocio,
  type TipoParticipacionSocio,
} from '../../../types/datosSocio.types';

interface Props {
  datos: DatosSocio | null;
}

const TIPO_PARTICIPACION_COLOR: Record<TipoParticipacionSocio, { bg: string; text: string; chip: string }> = {
  cash_puro: { bg: 'bg-emerald-50', text: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-700' },
  mixta: { bg: 'bg-violet-50', text: 'text-violet-700', chip: 'bg-violet-100 text-violet-700' },
  valor_puro: { bg: 'bg-amber-50', text: 'text-amber-700', chip: 'bg-amber-100 text-amber-700' },
};

const TIPO_PARTICIPACION_SHORT: Record<TipoParticipacionSocio, string> = {
  cash_puro: 'Cash puro',
  mixta: 'Mixta',
  valor_puro: 'Valor puro',
};

export const MiCapitalSocio: React.FC<Props> = ({ datos }) => {
  const navigate = useNavigate();

  if (!datos) {
    // Empty state · datos socio no configurado · pedagógico
    return (
      <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 ring-1 ring-violet-200/50 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <Coins className="w-5 h-5 text-violet-700" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-violet-700 font-bold">Mi capital · socio</div>
            <div className="text-[14px] font-semibold text-violet-900 leading-tight">Datos de socio pendientes</div>
            <div className="text-[11px] text-slate-600 mt-1">
              Tu participación aún no está configurada. Contactá al admin para asentarla.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fechaIngreso = datos.fechaIngresoNegocio?.toDate?.() ?? null;
  const mesesEnNegocio = fechaIngreso
    ? Math.floor((Date.now() - fechaIngreso.getTime()) / (1000 * 60 * 60 * 24 * 30.5))
    : 0;
  const aniosEnNegocio = Math.floor(mesesEnNegocio / 12);
  const antiguedadLabel =
    aniosEnNegocio >= 1
      ? `${aniosEnNegocio} año${aniosEnNegocio > 1 ? 's' : ''}`
      : `${mesesEnNegocio} mes${mesesEnNegocio !== 1 ? 'es' : ''}`;

  const tipoColor = TIPO_PARTICIPACION_COLOR[datos.tipoParticipacion];

  return (
    <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 ring-1 ring-violet-200/50 rounded-2xl overflow-hidden">
      {/* Header card */}
      <div className="px-4 py-3 border-b border-violet-200/60 flex items-center gap-2">
        <Coins className="w-4 h-4 text-violet-700 flex-shrink-0" />
        <span className="text-[11px] uppercase tracking-wider text-violet-700 font-bold">
          Mi capital · socio
        </span>
        <button
          type="button"
          onClick={() => navigate('/inversionistas')}
          className="ml-auto text-[11px] font-semibold text-violet-700 hover:text-violet-800 inline-flex items-center gap-1"
        >
          Ver detalle
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* % Participación · hero number */}
      <div className="bg-white p-4 sm:p-5">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-violet-700 font-bold flex items-center gap-1">
              <PieChart className="w-3 h-3" />
              Mi participación
            </div>
            <div className="text-[28px] sm:text-[32px] font-bold tabular-nums text-violet-900 leading-none mt-1">
              {datos.porcentajeParticipacion.toFixed(2)}
              <span className="text-violet-400 text-[22px]">%</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {datos.rolEnNegocio || 'Socio del negocio'}
            </div>
          </div>
          <span
            className={`inline-flex items-center text-[10px] px-2 py-1 rounded font-bold ${tipoColor.chip}`}
            title={TIPO_PARTICIPACION_LABEL[datos.tipoParticipacion]}
          >
            {TIPO_PARTICIPACION_SHORT[datos.tipoParticipacion]}
          </span>
        </div>
      </div>

      {/* Footer · meta datos · 2-col mobile */}
      <div className="bg-slate-50/60 border-t border-violet-200/60 px-4 py-3 grid grid-cols-2 gap-3">
        {fechaIngreso && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" />
              Ingreso al negocio
            </div>
            <div className="text-[12px] font-semibold text-slate-900 mt-0.5 tabular-nums">
              {fechaIngreso.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            <div className="text-[10px] text-slate-500">{antiguedadLabel}</div>
          </div>
        )}

        {datos.aporteDeValor && datos.aporteDeValor.tiposDeValor.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Aporte de valor
            </div>
            <div className="text-[12px] font-semibold text-slate-900 mt-0.5">
              {datos.aporteDeValor.tiposDeValor.length} tipo
              {datos.aporteDeValor.tiposDeValor.length > 1 ? 's' : ''}
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {datos.aporteDeValor.tiposDeValor.slice(0, 2).join(' · ').replace(/_/g, ' ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MiCapitalSocio;
