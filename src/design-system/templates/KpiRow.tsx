/**
 * KpiRow — Fila de KPIs para el detalle de una entidad.
 *
 * Patrón canónico S52 — derivado del estándar OrdenCompraCard (S42ao).
 * Ver `docs/DESIGN_PATTERNS.md` → Patrón 3.
 *
 * USO:
 *   <KpiRow
 *     items={[
 *       { label: 'Total OC', value: '$1,250.00', subtitle: '≈ S/ 4,725' },
 *       { label: 'Productos', value: '12 SKUs · 48 und' },
 *       { label: 'Sub-órdenes', value: '3', subtitle: 'divisiones', tone: 'teal' },
 *       { label: 'Pagos', value: '$500 / $1,250', subtitle: 'parcial', tone: 'amber' },
 *     ]}
 *   />
 *
 * REEMPLAZA:
 *   - `KpiCell` privado en OrdenCompraCard.tsx (línea 904)
 *   - `KpiCell` privado en SubOrdenDetailModal.tsx (línea 600)
 *   - `KpiRapido` privado en EnvioDetailModal.tsx
 *   - Los 5 divs `rounded-xl bg-{color}-50` inline en Envios.tsx
 *
 * NO USAR PARA:
 *   - Vista de lista de módulo (usar `<KPIBar>` + `<StatCard>` de Capa 2)
 *   - Stats de dashboard ejecutivo (usar `<DataCard>` de Capa 2)
 *
 * Este componente es ESPECÍFICO para el detalle de una entidad (OC, Envío,
 * Venta, etc.) donde 3-5 métricas clave van consolidadas en una fila con
 * fondo slate-50.
 */
import React from 'react';
import { cn } from '../utils';

// ────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────

export type KpiTone = 'default' | 'teal' | 'amber' | 'emerald' | 'red' | 'muted';

export interface KpiRowItem {
  /** Etiqueta pequeña arriba del valor (ej. "Total OC", "Productos") */
  label: string;
  /** Valor principal grande (ej. "$1,250.00", "12 SKUs · 48 und", "3") */
  value: string;
  /** Sub-texto opcional debajo del valor (ej. "≈ S/ 4,725", "parcial") */
  subtitle?: string;
  /** Tono del color del value (default=slate, los demás semánticos) */
  tone?: KpiTone;
  /** Si se provee, la celda se renderiza como botón clickable (ej. link a entidad). */
  onClick?: () => void;
}

export interface KpiRowProps {
  /** Lista de KPIs a mostrar (3-5 recomendado, máx. 6) */
  items: KpiRowItem[];
  /** Número de columnas — por default se auto-ajusta según length */
  columns?: 2 | 3 | 4 | 5 | 6;
  /** Clase adicional para el contenedor */
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────────────────────

export const KpiRow: React.FC<KpiRowProps> = ({ items, columns, className }) => {
  // Auto-derivar columnas si no se especifica
  const cols = columns ?? (Math.min(Math.max(items.length, 2), 6) as 2 | 3 | 4 | 5 | 6);

  // Map de grid-cols- className (Tailwind no permite strings dinámicos sin safelist)
  const gridCols: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <div
      className={cn(
        'grid bg-slate-50 rounded-xl py-4 px-2',
        gridCols[cols],
        className
      )}
    >
      {items.map((item, idx) => (
        <KpiCell key={idx} {...item} />
      ))}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// KpiCell (privado — solo usado por KpiRow)
// ────────────────────────────────────────────────────────────────────────────

const KpiCell: React.FC<KpiRowItem> = ({ label, value, subtitle, tone = 'default', onClick }) => {
  const valueColor: Record<KpiTone, string> = {
    default: 'text-slate-900',
    teal: 'text-teal-700',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    red: 'text-red-700',
    muted: 'text-slate-400',
  };

  const content = (
    <>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={cn('text-xl font-bold tabular-nums', valueColor[tone])}>
        {value}
      </div>
      {subtitle && (
        <div className="text-[11px] text-slate-400 mt-0.5">{subtitle}</div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="px-2 py-1 text-center rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer group"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="px-2 py-1 text-center">
      {content}
    </div>
  );
};
