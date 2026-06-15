/**
 * SubtipoAutocomplete · 2026-06-14
 *
 * Campo de subtipo de relación con UX de AUTOCOMPLETE de verdad: el input es
 * editable (escribís encima del valor actual), filtra sugerencias al tipear y
 * ofrece "Crear nuevo: X" inline en el mismo lugar. Reusa `AutocompleteInput`.
 *
 * Garantiza UNIFORMIDAD del dato: muestra labels lindos ("Fundador") pero ALMACENA
 * el slug canónico ("fundador") — elegir una sugerencia guarda su slug; crear uno
 * nuevo lo normaliza con `slugSubtipo`. Así "Fundador", "fundador" y "Co-Fundador"
 * no fragmentan.
 *
 * Fuente única: `SUBTIPOS_RELACION` (relacionLaboral.types).
 */
import React from 'react';
import { AutocompleteInput } from '../../common/AutocompleteInput';
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
  helperText?: string;
}

export const SubtipoAutocomplete: React.FC<SubtipoAutocompleteProps> = ({
  tipo,
  value,
  onChange,
  label = 'Subtipo',
  error,
  helperText,
}) => {
  const opciones = SUBTIPOS_RELACION[tipo] ?? [];
  const labelDe = (slug: string) => opciones.find((o) => o.value === slug)?.label ?? slug;
  const slugDe = (texto: string) =>
    opciones.find((o) => o.label.toLowerCase() === texto.toLowerCase().trim())?.value;

  return (
    <AutocompleteInput
      label={label}
      value={value ? labelDe(value) : ''}
      suggestions={opciones.map((o) => o.label)}
      onChange={(texto) => {
        if (!texto.trim()) {
          onChange('');
          return;
        }
        // Sugerencia conocida → su slug · texto nuevo → slug normalizado.
        onChange(slugDe(texto) ?? slugSubtipo(texto));
      }}
      placeholder="Elegí o escribí un subtipo…"
      createLabel="Crear subtipo"
      error={error}
      helperText={helperText}
    />
  );
};

export default SubtipoAutocomplete;
