/**
 * MisDatosLaboralesCard · F10.F.1.I-FIX · 2026-05-27
 *
 * PIXEL-PERFECT REWRITE · canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 6 (líneas 703-719).
 *
 * Patrón canon mockup: card simple Notion-style
 *   - bg-sky-50/40 border border-sky-200 rounded-xl p-5
 *   - h3 text-[14px] font-bold text-slate-900 con icon w-4 h-4 text-sky-700
 *   - chip estado top-right text-[10px] bg-emerald-100 px-2 py-0.5 rounded uppercase
 *   - grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[12px]
 *   - ítems: flex justify-between border-b border-sky-100 pb-1.5
 *     label text-slate-600 · valor font-bold text-sky-900 (+ tabular si número)
 *
 * Solo aparece si el user tiene datosLaborales · si NO · render compacto canon.
 */
import React from 'react';
import { BriefcaseBusiness } from 'lucide-react';
import { formatCurrencyPEN } from '../../../utils/format';
import type { DatosLaborales } from '../../../types/datosLaborales.types';

interface Props {
  datos: DatosLaborales | null;
  /** Si true · puede ver el sueldo (default true para sí mismo) */
  mostrarSueldo?: boolean;
}

const TIPO_CONTRATO_LABEL: Record<NonNullable<DatosLaborales['tipoContrato']>, string> = {
  indefinido: 'Indefinido',
  plazo_fijo: 'Plazo fijo',
  locacion_servicios: 'Locación de servicios',
  practicas: 'Prácticas',
  recibo_honorarios: 'Recibo por honorarios',
  otro: 'Otro',
};

const MODALIDAD_LABEL: Record<NonNullable<DatosLaborales['modalidad']>, string> = {
  presencial: 'Presencial',
  hibrido: 'Híbrido',
  remoto: 'Remoto',
};

export const MisDatosLaboralesCard: React.FC<Props> = ({ datos, mostrarSueldo = true }) => {
  if (!datos) {
    // Empty state · sin datos laborales · NO usar layout legacy
    return (
      <div className="bg-slate-50/40 border border-slate-200 rounded-xl p-5 text-center">
        <BriefcaseBusiness className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <div className="text-[13px] font-semibold text-slate-700">Sin datos laborales registrados</div>
        <div className="text-[11px] text-slate-500 mt-1">
          Si trabajás en el negocio, contactá al admin para configurar tu perfil laboral.
        </div>
      </div>
    );
  }

  const activo = datos.activo !== false;
  // Banco · si tiene datosBancarios usar primero · si no fallback al legacy
  const bancoPrincipal = (() => {
    const banco = datos.banco;
    const num = datos.numeroCuenta;
    if (banco && num) {
      const tail = num.slice(-4);
      return `${banco} ****${tail}`;
    }
    if (banco) return banco;
    return '—';
  })();

  return (
    // Canon mockup ACTO 6 · líneas 703-719 · copy-paste literal
    <div className="bg-sky-50/40 border border-sky-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
          <BriefcaseBusiness className="w-4 h-4 text-sky-700" />
          Mis datos laborales
        </h3>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
            activo ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {activo ? 'Activo' : 'Inactivo'}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
        {datos.area && (
          <div className="flex justify-between border-b border-sky-100 pb-1.5">
            <span className="text-slate-600">Área</span>
            <span className="font-bold text-sky-900">{datos.area}</span>
          </div>
        )}
        <div className="flex justify-between border-b border-sky-100 pb-1.5">
          <span className="text-slate-600">Cargo</span>
          <span className="font-bold text-sky-900 capitalize">{datos.tipo || '—'}</span>
        </div>
        {datos.modalidad && (
          <div className="flex justify-between border-b border-sky-100 pb-1.5">
            <span className="text-slate-600">Modalidad</span>
            <span className="font-bold text-sky-900">{MODALIDAD_LABEL[datos.modalidad]}</span>
          </div>
        )}
        {datos.tipoContrato && (
          <div className="flex justify-between border-b border-sky-100 pb-1.5">
            <span className="text-slate-600">Tipo contrato</span>
            <span className="font-bold text-sky-900">{TIPO_CONTRATO_LABEL[datos.tipoContrato]}</span>
          </div>
        )}
        {mostrarSueldo && datos.salarioBase !== undefined && datos.salarioBase > 0 && (
          <div className="flex justify-between border-b border-sky-100 pb-1.5">
            <span className="text-slate-600">Sueldo actual</span>
            <span className="font-bold text-sky-900 tabular-nums">
              {formatCurrencyPEN(datos.salarioBase)}
            </span>
          </div>
        )}
        <div className="flex justify-between border-b border-sky-100 pb-1.5">
          <span className="text-slate-600">Banco</span>
          <span className="font-bold text-sky-900">{bancoPrincipal}</span>
        </div>
        {datos.fechaIngreso && (
          <div className="flex justify-between border-b border-sky-100 pb-1.5">
            <span className="text-slate-600">Fecha alta</span>
            <span className="font-bold text-sky-900">
              {datos.fechaIngreso.toDate().toLocaleDateString('es-PE', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        )}
        {typeof datos.vacacionesDisponibles === 'number' && (
          <div className="flex justify-between border-b border-sky-100 pb-1.5">
            <span className="text-slate-600">Vacaciones</span>
            <span className="font-bold text-sky-900 tabular-nums">
              {datos.vacacionesDisponibles} días
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MisDatosLaboralesCard;
