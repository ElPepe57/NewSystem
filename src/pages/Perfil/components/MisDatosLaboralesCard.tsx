/**
 * MisDatosLaboralesCard · F10.F.1.D · 2026-05-27
 *
 * Card sky con datos planilla del empleado · vista propia (read-only para sí mismo).
 * Solo aparece si el user tiene datosLaborales (rol vendedor/gerente/comprador/etc).
 *
 * Canon v8.0 N1 · color semántico sky (operacional · laboral)
 * Canon v9.0 · copy-paste literal del mockup perfil-v5.4-personalizado.html ACTO 4
 *
 * NO permite editar (eso requiere permiso GESTIONAR_PLANILLA). Si el user
 * ve un dato desactualizado, debe pedírselo al admin (link mailto opcional).
 */
import React from 'react';
import { Briefcase, Calendar, Building2, FileText, Coins } from 'lucide-react';
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
    return (
      <div className="bg-gradient-to-br from-slate-50 to-slate-100/40 ring-1 ring-slate-200/50 rounded-2xl p-5 text-center">
        <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <div className="text-[13px] font-semibold text-slate-700">Sin datos laborales registrados</div>
        <div className="text-[11px] text-slate-500 mt-1">
          Si trabajás en el negocio, contactá al admin para configurar tu perfil laboral.
        </div>
      </div>
    );
  }

  const fechaIngreso = datos.fechaIngreso?.toDate?.() ?? null;
  const mesesEnNegocio = fechaIngreso
    ? Math.floor((Date.now() - fechaIngreso.getTime()) / (1000 * 60 * 60 * 24 * 30.5))
    : 0;
  const antiguedadLabel =
    mesesEnNegocio < 1
      ? 'Recién ingresó'
      : mesesEnNegocio < 12
      ? `${mesesEnNegocio} mes${mesesEnNegocio > 1 ? 'es' : ''}`
      : `${Math.floor(mesesEnNegocio / 12)} año${Math.floor(mesesEnNegocio / 12) > 1 ? 's' : ''} ${mesesEnNegocio % 12 > 0 ? `· ${mesesEnNegocio % 12}m` : ''}`;

  return (
    <div className="bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50 rounded-2xl overflow-hidden">
      {/* Header card */}
      <div className="px-4 py-3 border-b border-sky-200/60 flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-sky-700 flex-shrink-0" />
        <span className="text-[11px] uppercase tracking-wider text-sky-700 font-bold">
          Mis datos laborales
        </span>
        {datos.activo === false && (
          <span className="ml-auto text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold">
            Inactivo
          </span>
        )}
      </div>

      {/* Body · 2-col grid mobile-friendly */}
      <div className="bg-white p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {/* Cargo (heredado del UserProfile.cargo) · este card lo muestra como label */}
        {datos.tipo && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Tipo</div>
            <div className="text-[13px] font-semibold text-slate-900 capitalize mt-0.5">{datos.tipo}</div>
          </div>
        )}

        {/* Área */}
        {datos.area && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Área</div>
            <div className="text-[13px] font-semibold text-slate-900 mt-0.5">{datos.area}</div>
          </div>
        )}

        {/* Fecha ingreso · con antigüedad calculada */}
        {fechaIngreso && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" />
              Ingreso
            </div>
            <div className="text-[13px] font-semibold text-slate-900 mt-0.5">
              {fechaIngreso.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{antiguedadLabel} en el negocio</div>
          </div>
        )}

        {/* Tipo contrato */}
        {datos.tipoContrato && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
              <FileText className="w-2.5 h-2.5" />
              Contrato
            </div>
            <div className="text-[13px] font-semibold text-slate-900 mt-0.5">{TIPO_CONTRATO_LABEL[datos.tipoContrato]}</div>
          </div>
        )}

        {/* Modalidad */}
        {datos.modalidad && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
              <Building2 className="w-2.5 h-2.5" />
              Modalidad
            </div>
            <div className="text-[13px] font-semibold text-slate-900 mt-0.5">{MODALIDAD_LABEL[datos.modalidad]}</div>
          </div>
        )}

        {/* Sueldo bruto · solo visible para sí mismo (admin lo ve en Usuarios) */}
        {mostrarSueldo && datos.salarioBase !== undefined && datos.salarioBase > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
              <Coins className="w-2.5 h-2.5" />
              Sueldo bruto
            </div>
            <div className="text-[13px] font-bold text-sky-900 tabular-nums mt-0.5">
              {formatCurrencyPEN(datos.salarioBase)}
              <span className="text-[10px] font-normal text-slate-500"> · {datos.monedaSalario}/mes</span>
            </div>
          </div>
        )}

        {/* Vacaciones disponibles */}
        {typeof datos.vacacionesDisponibles === 'number' && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Vacaciones</div>
            <div className="text-[13px] font-bold text-emerald-700 tabular-nums mt-0.5">
              {datos.vacacionesDisponibles}
              <span className="text-[10px] font-normal text-slate-500"> días</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer informativo · si quiere actualizar */}
      <div className="bg-sky-50/60 border-t border-sky-200/60 px-4 py-2.5 text-[11px] text-sky-700 flex items-center gap-1.5">
        <FileText className="w-3 h-3 flex-shrink-0" />
        <span>Si algún dato está desactualizado, contactá al admin de RRHH.</span>
      </div>
    </div>
  );
};

export default MisDatosLaboralesCard;
