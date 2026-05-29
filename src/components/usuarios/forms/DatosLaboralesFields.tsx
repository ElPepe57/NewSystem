/**
 * DatosLaboralesFields.tsx · chk5.PERSONAS-v5.8 · E2 (2026-05-28)
 *
 * Campos presentacionales para la sección "Datos laborales" del alta de empleado.
 * Usado en NuevoEmpleadoModal.
 *
 * subTipo restringido a planilla (full_time · medio_tiempo · por_horas · practicante · tercerizado).
 * montoMensualReferencia = salario bruto mensual (sin descuentos).
 */

import React from 'react';
import { Briefcase, DollarSign } from 'lucide-react';
import type { SubTipoEmpleado } from '../../../types/relacionLaboral.types';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export interface DatosLaboralesValues {
  cargoDisplay: string;
  subTipo: SubTipoEmpleado | '';
  montoMensualReferencia: number | '';
  monedaReferencia: 'PEN' | 'USD';
  notas: string;
}

export interface DatosLaboralesFieldsProps {
  values: DatosLaboralesValues;
  onChange: (field: keyof DatosLaboralesValues, value: DatosLaboralesValues[keyof DatosLaboralesValues]) => void;
  errors?: Partial<Record<keyof DatosLaboralesValues, string>>;
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

export const DatosLaboralesFields: React.FC<DatosLaboralesFieldsProps> = ({
  values,
  onChange,
  errors,
}) => {
  return (
    <div className="space-y-3">
      <Field
        label="Cargo"
        icon={Briefcase}
        hint="Ej. Account Manager · Diseñador Senior · Coordinadora Logística"
        required
        error={errors?.cargoDisplay}
      >
        <input
          type="text"
          value={values.cargoDisplay}
          onChange={(e) => onChange('cargoDisplay', e.target.value)}
          placeholder="Ej. Account Manager"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field
          label="Salario bruto mensual"
          icon={DollarSign}
          hint="Sin descuentos AFP/SNP"
          error={errors?.montoMensualReferencia}
        >
          <input
            type="number"
            value={values.montoMensualReferencia}
            onChange={(e) =>
              onChange(
                'montoMensualReferencia',
                e.target.value === '' ? '' : Number(e.target.value),
              )
            }
            placeholder="3500"
            min={0}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums focus:ring-2 focus:ring-teal-500"
          />
        </Field>

        <Field label="Moneda" error={errors?.monedaReferencia}>
          <select
            value={values.monedaReferencia}
            onChange={(e) => onChange('monedaReferencia', e.target.value as 'PEN' | 'USD')}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500"
          >
            <option value="PEN">PEN (S/)</option>
            <option value="USD">USD ($)</option>
          </select>
        </Field>

        <Field label="Subtipo" error={errors?.subTipo}>
          <select
            value={values.subTipo}
            onChange={(e) => onChange('subTipo', e.target.value as SubTipoEmpleado | '')}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500"
          >
            <option value="">— ninguno —</option>
            <option value="full_time">Full time</option>
            <option value="medio_tiempo">Medio tiempo</option>
            <option value="por_horas">Por horas</option>
            <option value="practicante">Practicante</option>
            <option value="tercerizado">Tercerizado</option>
          </select>
        </Field>
      </div>

      <Field label="Notas" hint="Observaciones opcionales sobre la relación laboral.">
        <textarea
          value={values.notas}
          onChange={(e) => onChange('notas', e.target.value)}
          placeholder="Ej. Inicio en período de prueba · revisión de sueldo en 3 meses"
          rows={2}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-teal-500"
        />
      </Field>
    </div>
  );
};
