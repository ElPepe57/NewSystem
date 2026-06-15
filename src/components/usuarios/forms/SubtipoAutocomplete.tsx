/**
 * SubtipoAutocomplete · 2026-06-14
 *
 * Campo de subtipo de relación con UX de autocomplete: input editable (escribís
 * encima), filtra sugerencias y crea inline ahí mismo. Es un wrapper fino sobre
 * el `Combobox` del DS en modo `editable` (UN solo componente de select/autocomplete).
 *
 * Garantiza UNIFORMIDAD: muestra labels lindos ("Fundador") pero ALMACENA el slug
 * canónico ("fundador") — elegir una sugerencia guarda su slug; crear uno nuevo lo
 * normaliza con `slugSubtipo`. Así "Fundador", "fundador" y "Co-Fundador" no fragmentan.
 *
 * Fuente única de opciones: `SUBTIPOS_RELACION` (relacionLaboral.types).
 */
import React from 'react';
import { Combobox } from '../../../design-system/components/forms/Combobox';
import {
  SUBTIPOS_RELACION,
  slugSubtipo,
  type TipoRelacion,
} from '../../../types/relacionLaboral.types';

interface SubtipoAutocompleteProps {
  /** Tipo de relación · determina las sugerencias. */
  tipo: TipoRelacion;
  /** Slug canónico almacenado (ej. "fundador"). */
  value: string;
  /** Recibe el slug canónico (sugerencia elegida) o el slug del texto creado. */
  onChange: (slug: string) => void;
  label?: string;
  error?: string;
  hint?: string;
}

export const SubtipoAutocomplete: React.FC<SubtipoAutocompleteProps> = ({
  tipo,
  value,
  onChange,
  label = 'Subtipo',
  error,
  hint,
}) => {
  const options = (SUBTIPOS_RELACION[tipo] ?? []).map((o) => ({ value: o.value, label: o.label }));
  // Incluir el valor actual si es custom (creado inline antes) para que se muestre.
  if (value && !options.some((o) => o.value === value)) {
    options.unshift({ value, label: value });
  }

  return (
    <Combobox<string>
      editable
      optional
      label={label}
      value={value || undefined}
      onChange={onChange}
      groups={[{ label: 'Sugeridos', options }]}
      onCreate={(term) => onChange(slugSubtipo(term))}
      createLabel="Crear subtipo"
      placeholder="Elegí o escribí un subtipo…"
      error={error}
      hint={hint}
    />
  );
};

export default SubtipoAutocomplete;
