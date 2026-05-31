/**
 * DatosSocioFields.tsx · chk5.PERSONAS-v5.8 · E2 (2026-05-28)
 *
 * Campos presentacionales para la sección "Datos de socio" del alta de socio.
 * Usado en NuevoSocioModal.
 *
 * Nota: Cap table %, monto invertido y distribuciones se configuran DESPUÉS
 * en /inversionistas. Acá solo se captura el rol display y el subtipo para la
 * RelacionLaboral inicial (que es suficiente para crear el vínculo).
 */

import React from 'react';
import { Handshake } from 'lucide-react';
import type { SubTipoSocio } from '../../../types/relacionLaboral.types';
import { LineaNegocioFieldSelect } from './LineaNegocioFieldSelect';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export interface DatosSocioValues {
  cargoDisplay: string;
  subTipo: SubTipoSocio | '';
  /** Id entidad del equity · '' = empresa global · chk5-LINEAS */
  lineaNegocioId: string;
  notas: string;
}

export interface DatosSocioFieldsProps {
  values: DatosSocioValues;
  onChange: (field: keyof DatosSocioValues, value: DatosSocioValues[keyof DatosSocioValues]) => void;
  errors?: Partial<Record<keyof DatosSocioValues, string>>;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPER INTERNO · Field
// ═════════════════════════════════════════════════════════════════════════

const Field: React.FC<{
  label: string;
  icon?: React.FC<{ className?: string }>;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}> = ({ label, icon: Icon, hint, required, error, children }) => (
  <div>
    <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-1.5">
      {Icon && <Icon className="w-3 h-3 inline mr-1 text-slate-500" />}
      {label}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
    {children}
    {hint && !error && (
      <p className="text-[11px] text-slate-400 mt-1">{hint}</p>
    )}
    {error && (
      <p className="text-[11px] text-rose-600 mt-1 font-medium">{error}</p>
    )}
  </div>
);

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const DatosSocioFields: React.FC<DatosSocioFieldsProps> = ({
  values,
  onChange,
  errors,
}) => {
  return (
    <div className="space-y-3">
      <Field
        label="Rol / posición"
        icon={Handshake}
        hint="Ej. Fundador · Inversor estratégico · Socio operativo"
        error={errors?.cargoDisplay}
      >
        <input
          type="text"
          value={values.cargoDisplay}
          onChange={(e) => onChange('cargoDisplay', e.target.value)}
          placeholder="Ej. Fundador · Co-fundador · Inversor ángel"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </Field>

      <Field label="Tipo de socio" error={errors?.subTipo}>
        <select
          value={values.subTipo}
          onChange={(e) => onChange('subTipo', e.target.value as SubTipoSocio | '')}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-violet-500"
        >
          <option value="">— ninguno —</option>
          <option value="fundador">Fundador</option>
          <option value="inversor">Inversor</option>
          <option value="minoritario">Minoritario</option>
          <option value="estrategico">Estratégico</option>
        </select>
      </Field>

      {/* Entidad del equity · single · chk5-LINEAS (empresa global vs línea) */}
      <LineaNegocioFieldSelect
        modo="entidad"
        value={values.lineaNegocioId}
        onChange={(id) => onChange('lineaNegocioId', id)}
      />

      <Field label="Notas" hint="Acuerdos especiales · restricciones de voto · notas para el equipo.">
        <textarea
          value={values.notas}
          onChange={(e) => onChange('notas', e.target.value)}
          placeholder="Ej. Tiene derecho preferente · restricción de transferencia 2 años"
          rows={2}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-violet-500"
        />
      </Field>

      {/* Banner informativo · cap table se configura en /inversionistas */}
      <div className="bg-violet-50 ring-1 ring-violet-200 rounded-lg p-3 text-[12px] text-violet-900">
        <strong className="font-semibold">Cap table, aporte y distribuciones</strong> se configuran
        en el módulo Inversionistas una vez creado el socio. Acá solo registramos el vínculo inicial.
      </div>
    </div>
  );
};
