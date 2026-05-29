/**
 * DatosPersonalesFields.tsx · chk5.PERSONAS-v5.8 · E2 (2026-05-28)
 *
 * Campos presentacionales para la sección "Datos personales" del alta de usuario.
 * Usado en NuevoEmpleadoModal y NuevoSocioModal.
 *
 * NO es un modal · es un bloque de campos embebible en cualquier modal F6-A.
 * El estado y onChange viven en el componente padre.
 */

import React from 'react';
import { User as UserIcon, Mail, Phone, Lock } from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export interface DatosPersonalesValues {
  displayName: string;
  email: string;
  telefono: string;
  password: string;
}

export interface DatosPersonalesFieldsProps {
  values: DatosPersonalesValues;
  onChange: (field: keyof DatosPersonalesValues, value: string) => void;
  errors?: Partial<Record<keyof DatosPersonalesValues, string>>;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPER INTERNO · Field con label e icono
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

export const DatosPersonalesFields: React.FC<DatosPersonalesFieldsProps> = ({
  values,
  onChange,
  errors,
}) => {
  return (
    <div className="space-y-3">
      <Field
        label="Nombre completo"
        icon={UserIcon}
        required
        error={errors?.displayName}
      >
        <input
          type="text"
          value={values.displayName}
          onChange={(e) => onChange('displayName', e.target.value)}
          placeholder="Ej. Carlos Mendoza Ruiz"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          autoComplete="name"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="Email"
          icon={Mail}
          required
          error={errors?.email}
        >
          <input
            type="email"
            value={values.email}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="carlos@empresa.pe"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
            autoComplete="email"
          />
        </Field>

        <Field
          label="Teléfono"
          icon={Phone}
          error={errors?.telefono}
        >
          <input
            type="tel"
            value={values.telefono}
            onChange={(e) => onChange('telefono', e.target.value)}
            placeholder="+51 987 654 321"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
            autoComplete="tel"
          />
        </Field>
      </div>

      <Field
        label="Password inicial"
        icon={Lock}
        hint="El usuario podrá cambiarlo en cualquier momento · mínimo 8 caracteres."
        required
        error={errors?.password}
      >
        <input
          type="password"
          value={values.password}
          onChange={(e) => onChange('password', e.target.value)}
          placeholder="••••••••"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
          autoComplete="new-password"
        />
      </Field>
    </div>
  );
};
