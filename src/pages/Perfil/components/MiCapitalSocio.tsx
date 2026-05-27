/**
 * MiCapitalSocio · F10.F.1.I-FIX · 2026-05-27
 *
 * PIXEL-PERFECT REWRITE · canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 7 (líneas 848-866).
 *
 * Patrón canon mockup:
 *   - bg-violet-50/40 border border-violet-200 rounded-xl p-5
 *   - h3 text-[14px] font-bold con icon briefcase text-violet-700
 *   - chip "FOUNDER" text-[10px] bg-violet-100 text-violet-700 uppercase
 *   - grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[12px]
 *   - ítems: flex justify-between border-b border-violet-100 pb-1.5
 *     label text-slate-600 · valor font-bold text-violet-900 (+ tabular si número)
 *
 * NOTA: Este componente cubre SOLO el card "Mis datos como socio" del ACTO 7.
 * El "Cap table mini" y "Cross-link CTA grande" se implementan en F10.F.1.M
 * (sub-componentes separados).
 */
import React from 'react';
import { Briefcase, Coins } from 'lucide-react';
import { formatCurrencyPEN } from '../../../utils/format';
import {
  TIPO_PARTICIPACION_LABEL,
  type DatosSocio,
  type TipoParticipacionSocio,
} from '../../../types/datosSocio.types';

interface Props {
  datos: DatosSocio | null;
  /** Chip top-right · default deriva de tipoParticipacion */
  chipLabel?: string;
}

const TIPO_PARTICIPACION_DISPLAY: Record<TipoParticipacionSocio, string> = {
  cash_puro: 'Cash puro',
  mixta: 'Cash + Valor',
  valor_puro: 'Solo valor',
};

const chipFromTipo = (tipo: TipoParticipacionSocio): string =>
  tipo === 'cash_puro' ? 'INVERSOR' : tipo === 'valor_puro' ? 'SILENT PARTNER' : 'FOUNDER';

export const MiCapitalSocio: React.FC<Props> = ({ datos, chipLabel }) => {
  if (!datos) {
    return (
      <div className="bg-violet-50/40 border border-violet-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-violet-700" />
            Mis datos como socio
          </h3>
        </div>
        <div className="text-[11px] text-slate-600">
          Datos de socio pendientes de configuración. Contactá al admin.
        </div>
      </div>
    );
  }

  const fechaIngreso = datos.fechaIngresoNegocio?.toDate?.();
  const fechaIngresoLabel = fechaIngreso
    ? fechaIngreso.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  const cashAportado = datos.aporteDeValor?.valuacionEstimadaPEN ?? 0;
  // En el mockup el cash y el valor se muestran separados. Si el tipo es cash_puro,
  // no se muestra "Capital aportado (valor)". Si es valor_puro, no se muestra cash.
  const mostrarCash = datos.tipoParticipacion !== 'valor_puro';
  const mostrarValor = datos.tipoParticipacion !== 'cash_puro';

  const chip = chipLabel ?? chipFromTipo(datos.tipoParticipacion);

  return (
    // Canon mockup ACTO 7 · líneas 850-866 · copy-paste literal
    <div className="bg-violet-50/40 border border-violet-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
          <Briefcase className="w-4 h-4 text-violet-700" />
          Mis datos como socio
        </h3>
        <span className="text-[10px] bg-violet-100 text-violet-700 font-bold px-2 py-0.5 rounded uppercase">
          {chip}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
        <div className="flex justify-between border-b border-violet-100 pb-1.5">
          <span className="text-slate-600">Tipo de participación</span>
          <span
            className="font-bold text-violet-900"
            title={TIPO_PARTICIPACION_LABEL[datos.tipoParticipacion]}
          >
            {TIPO_PARTICIPACION_DISPLAY[datos.tipoParticipacion]}
          </span>
        </div>
        <div className="flex justify-between border-b border-violet-100 pb-1.5">
          <span className="text-slate-600">% participación</span>
          <span className="font-bold text-violet-900 tabular-nums">
            {datos.porcentajeParticipacion.toFixed(0)}%
          </span>
        </div>
        {mostrarCash && (
          <div className="flex justify-between border-b border-violet-100 pb-1.5">
            <span className="text-slate-600">Capital aportado (cash)</span>
            <span className="font-bold text-violet-900 tabular-nums">
              {/* cash_puro · si no hay desglose · usar valuacion como proxy */}
              {datos.tipoParticipacion === 'cash_puro'
                ? formatCurrencyPEN(datos.aporteDeValor?.valuacionEstimadaPEN ?? 0)
                : formatCurrencyPEN(cashAportado)}
            </span>
          </div>
        )}
        {mostrarValor && datos.aporteDeValor?.valuacionEstimadaPEN !== undefined && (
          <div className="flex justify-between border-b border-violet-100 pb-1.5">
            <span className="text-slate-600">Capital aportado (valor)</span>
            <span className="font-bold text-violet-900 tabular-nums">
              {formatCurrencyPEN(datos.aporteDeValor.valuacionEstimadaPEN)}
            </span>
          </div>
        )}
        <div className="flex justify-between border-b border-violet-100 pb-1.5">
          <span className="text-slate-600">Fecha de alta</span>
          <span className="font-bold text-violet-900">{fechaIngresoLabel}</span>
        </div>
        {datos.rolEnNegocio && (
          <div className="flex justify-between border-b border-violet-100 pb-1.5">
            <span className="text-slate-600">Rol en el negocio</span>
            <span className="font-bold text-violet-900">{datos.rolEnNegocio}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MiCapitalSocio;
