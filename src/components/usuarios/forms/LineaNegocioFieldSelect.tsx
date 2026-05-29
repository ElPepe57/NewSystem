/**
 * LineaNegocioFieldSelect.tsx · chk5.PERSONAS-v5.x-LINEAS (2026-05-29)
 *
 * Selector SINGLE de línea de negocio para los forms de alta (empleado · socio ·
 * honorarios · externo). Modelo consistente con todo el sistema:
 *   - value '' → compartido / empresa global (lineaNegocioId ausente)
 *   - value = id de línea → relación atribuida a esa línea específica
 *
 * Reusa useLineaNegocioStore (líneas ya cargadas en memoria · no hace fetch).
 * NO crea infraestructura nueva · es solo un <select> presentacional + preview chip.
 *
 * Dos modos según el tipo de relación:
 *   - 'trabajo' (empleado/honorarios/externo): "Compartido / sin asignar"
 *   - 'entidad' (socio): "Empresa global · cap table principal"
 */

import React from 'react';
import { Layers } from 'lucide-react';
import { useLineaNegocioStore } from '../../../store/lineaNegocioStore';

export interface LineaNegocioFieldSelectProps {
  /** Id de línea seleccionado · '' = compartido / empresa global */
  value: string;
  onChange: (lineaNegocioId: string) => void;
  /** 'trabajo' para empleado/honorarios/externo · 'entidad' para socio */
  modo?: 'trabajo' | 'entidad';
}

const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <div>
    <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-1.5">
      <Layers className="w-3 h-3 inline mr-1 text-slate-500" />
      {label}
    </label>
    {children}
    {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
  </div>
);

export const LineaNegocioFieldSelect: React.FC<LineaNegocioFieldSelectProps> = ({
  value,
  onChange,
  modo = 'trabajo',
}) => {
  const lineasActivas = useLineaNegocioStore((s) => s.lineasActivas);

  // Si no hay líneas configuradas, no renderizar (el negocio no usa líneas).
  if (lineasActivas.length === 0) return null;

  const esEntidad = modo === 'entidad';
  const label = esEntidad ? '¿De qué entidad es socio?' : 'Línea de negocio';
  const opcionVacia = esEntidad ? 'Empresa global · cap table principal' : 'Compartido / sin asignar';
  const hint = esEntidad
    ? 'El equity es por entidad legal · empresa global o una línea específica.'
    : 'En qué línea opera · vacío = compartido (se incluye en todas las líneas).';

  const seleccionada = lineasActivas.find((l) => l.id === value);

  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        {/* Preview del color de la línea seleccionada */}
        <span
          className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-slate-200"
          style={{ backgroundColor: seleccionada?.color || '#94a3b8' }}
        />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500"
        >
          <option value="">{opcionVacia}</option>
          {lineasActivas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.icono ? `${l.icono} ` : ''}{l.nombre}
            </option>
          ))}
        </select>
      </div>
    </Field>
  );
};
