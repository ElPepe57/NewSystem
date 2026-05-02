/**
 * VariantesApiladas · átomo del Card row · módulo Productos V2
 *
 * Muestra avatares circulares apilados (negative spacing) con el contenido de
 * cada variante (ej. "30", "15", "+2"). Se usa en la columna "Variantes · Stock"
 * del Card row · mockup 10 + variantes.
 *
 * Para packs (mockup 10e) NO se usa este componente: pack tiene su propio
 * breakdown de componentes en mini-pills.
 */

import React from 'react';

interface VarianteAvatar {
  /** Texto que aparece en el círculo (ej. "30", "15") */
  label: string;
  /** Color de fondo (hex). Default rota entre teal/amber/purple/rose */
  color?: string;
}

interface VariantesApiladasProps {
  variantes: VarianteAvatar[];
  /** Máximo a mostrar antes de colapsar a "+N". Default 3. */
  maxVisible?: number;
  /** Texto debajo (ej. "4 variantes · 87 uds"). Si null, no muestra subline. */
  subline?: string | null;
}

const DEFAULT_PALETTE = ['#0d9488', '#f59e0b', '#8b5cf6', '#f43f5e', '#0ea5e9'];

export const VariantesApiladas: React.FC<VariantesApiladasProps> = ({ variantes, maxVisible = 3, subline }) => {
  if (variantes.length === 0) return null;

  const visibles = variantes.slice(0, maxVisible);
  const overflow = variantes.length - maxVisible;

  return (
    <div>
      <div className="flex items-center justify-end -space-x-1">
        {visibles.map((v, idx) => (
          <Avatar key={idx} label={v.label} color={v.color ?? DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]} />
        ))}
        {overflow > 0 && <Avatar label={`+${overflow}`} color="#8b5cf6" />}
      </div>
      {subline && <div className="text-[10px] text-slate-500 mt-1 tabular-nums text-right">{subline}</div>}
    </div>
  );
};

const Avatar: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <div
    className="inline-flex items-center justify-center text-white text-[9px] font-bold tabular-nums"
    style={{
      width: 24,
      height: 24,
      borderRadius: '50%',
      background: color,
      boxShadow: '0 0 0 2px white',
    }}
  >
    {label}
  </div>
);

/**
 * Helper: construye el array de VarianteAvatar a partir de una lista de productos
 * hermanos del mismo grupoVarianteId. El `varianteLabel` se usa como texto
 * (ej. "30 ml", "120 caps") · si no existe, usa los primeros 3 chars del SKU.
 */
export function buildVariantesFromGrupo(
  productos: Array<{ id: string; varianteLabel?: string; sku?: string; contenido?: string }>
): VarianteAvatar[] {
  return productos.map(p => {
    // Extrae solo el número/cifra principal del label · ej "120 caps" → "120"
    const raw = p.varianteLabel ?? p.contenido ?? p.sku?.slice(-3) ?? '?';
    const numberMatch = raw.match(/(\d+)/);
    const label = numberMatch ? numberMatch[1] : raw.slice(0, 3);
    return { label };
  });
}
