/**
 * ChipsCerrados · Componente reutilizable para vocabulario CERRADO (Fase E2)
 *
 * Implementa el patrón "CHIPS cerrados" del mockup #41 v4 para:
 *   - Tipo SKC, Paso rutina, Textura (single · ~14-25 opciones · estilo "rectangular")
 *   - Tipo de piel, Preocupaciones, Zona aplicación (multi · ~9-17 opciones · estilo "pill")
 *   - Presentación SUP, Toma con/sin comida, Edad recomendada (single)
 *   - Momento del día (multi)
 *
 * Pattern:
 *   - Caja gris con todos los chips visibles SIEMPRE (no se ocultan)
 *   - Chip activo: border-2 + bg-tema + texto bold + ✓
 *   - Chip inactivo: border-1 + bg-blanco + texto slate
 *   - Badge "+" opcional para opciones nuevas detectadas en industria
 *   - Helper text con conteo originales/nuevas
 *
 * No requiere Firestore · vocabulario hardcoded en producto.types.ts
 */

import React from 'react';
import { Check, Lock } from 'lucide-react';

export interface ChipCerradoOption {
  value: string;
  label: string;
  esNueva?: boolean;       // Badge "+" · vocabulario expandido recientemente
  destacado?: boolean;     // Estilo emerald especial (ej: "Todos los tipos")
}

interface ChipsCerradosBaseProps {
  label: string;
  required?: boolean;
  options: ChipCerradoOption[];
  /** 'single' = string · 'multi' = string[] */
  modo: 'single' | 'multi';
  /** Variante visual del chip */
  variante?: 'rect' | 'pill';
  /** Tema de color del chip activo */
  tema?: 'amber' | 'indigo' | 'emerald' | 'teal';
  helperText?: string;
  /** Mostrar contador originales/nuevas en helper */
  mostrarConteoNuevos?: boolean;
}

interface ChipsCerradosSingleProps extends ChipsCerradosBaseProps {
  modo: 'single';
  value?: string;
  onChange: (value: string) => void;
}

interface ChipsCerradosMultiProps extends ChipsCerradosBaseProps {
  modo: 'multi';
  value: string[];
  onChange: (value: string[]) => void;
}

type ChipsCerradosProps = ChipsCerradosSingleProps | ChipsCerradosMultiProps;

const TEMA = {
  amber: { borderActive: 'border-amber-400', bgActive: 'bg-amber-100', textActive: 'text-amber-900' },
  indigo: { borderActive: 'border-indigo-400', bgActive: 'bg-indigo-100', textActive: 'text-indigo-900' },
  emerald: { borderActive: 'border-emerald-400', bgActive: 'bg-emerald-100', textActive: 'text-emerald-900' },
  teal: { borderActive: 'border-teal-400', bgActive: 'bg-teal-100', textActive: 'text-teal-900' },
};

export function ChipsCerrados(props: ChipsCerradosProps) {
  const {
    label,
    required,
    options,
    modo,
    variante = 'pill',
    tema = 'amber',
    helperText,
    mostrarConteoNuevos = false,
  } = props;

  const cls = TEMA[tema];

  const isActive = (value: string): boolean => {
    if (modo === 'single') return props.value === value;
    return props.value.includes(value);
  };

  const handleClick = (value: string) => {
    if (modo === 'single') {
      // Toggle: si ya activo, deselecciona; si no, selecciona
      props.onChange(props.value === value ? '' : value);
    } else {
      const arr = props.value.includes(value)
        ? props.value.filter(v => v !== value)
        : [...props.value, value];
      props.onChange(arr);
    }
  };

  // Conteo nuevas vs originales
  const totalOriginales = options.filter(o => !o.esNueva).length;
  const totalNuevas = options.filter(o => o.esNueva).length;
  const totalGeneral = options.length;

  // Estilos compartidos
  const baseRect = 'px-2 py-1 text-[10px] rounded transition-colors';
  const basePill = 'px-2.5 py-1 text-[10px] rounded-full transition-colors flex items-center gap-1';
  const baseChip = variante === 'rect' ? baseRect : basePill;

  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 flex items-center justify-between">
        <span>
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[8px] font-bold">
          <Lock className="w-2 h-2" />
          CERRADO · {totalGeneral} opcion{totalGeneral === 1 ? '' : 'es'}
        </span>
      </label>

      <div className="border border-slate-200 rounded-lg p-2 bg-slate-50">
        <div className="flex flex-wrap gap-1.5">
          {options.map(opt => {
            const active = isActive(opt.value);
            const destacadoClass = opt.destacado && !active
              ? 'border border-emerald-300 bg-emerald-50 text-emerald-700 font-bold'
              : '';
            const activeClass = active
              ? `border-2 ${cls.borderActive} ${cls.bgActive} ${cls.textActive} font-bold`
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50';

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleClick(opt.value)}
                className={`${baseChip} ${destacadoClass || activeClass}`}
              >
                {active && variante === 'pill' && <Check className="w-2.5 h-2.5" />}
                {active && variante === 'rect' && <span className="mr-0.5">✓</span>}
                {opt.label}
                {opt.esNueva && (
                  <span className="ml-0.5 inline-flex items-center justify-center w-3 h-3 rounded-full bg-pink-100 text-pink-700 text-[8px] font-bold">
                    +
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {(helperText || (mostrarConteoNuevos && totalNuevas > 0)) && (
        <div className="text-[9px] text-slate-500 mt-1 italic">
          {mostrarConteoNuevos && totalNuevas > 0 && (
            <>
              {totalOriginales} originales + <strong className="text-pink-700">{totalNuevas} nuev{totalNuevas === 1 ? 'a' : 'as'} detectad{totalNuevas === 1 ? 'a' : 'as'}</strong>
              {helperText && ' · '}
            </>
          )}
          {helperText}
        </div>
      )}
    </div>
  );
}
