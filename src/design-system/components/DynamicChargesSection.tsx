import React, { useMemo, useId } from 'react';
import { Plus, Trash2, Percent, DollarSign } from 'lucide-react';
import { cn } from '../utils';

// ════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════

export type ChargeKind = 'cargo' | 'descuento' | 'impuesto';

/**
 * Estructura mínima de un item dinámico.
 * Compatible con CargoOC, DescuentoOC, ImpuestoOC del modelo actual.
 */
export interface DynamicChargeItem {
  id: string;
  concepto: string;
  montoUSD: number;
  /** Solo aplica para impuestos — modo de cálculo */
  modo?: 'porcentaje' | 'fijo';
  /** Solo aplica para impuestos modo='porcentaje' */
  porcentaje?: number;
  /** Método de prorrateo (opcional, depende del tipo) */
  metodoProrrateo?: 'por_valor' | 'por_cantidad' | 'por_peso' | 'proporcional';
}

interface DynamicChargesSectionProps {
  /** Tipo de items — afecta color, icono, etiquetas */
  kind: ChargeKind;
  /** Items actuales */
  items: DynamicChargeItem[];
  /** Callback al modificar items */
  onChange: (items: DynamicChargeItem[]) => void;
  /** Lista de conceptos sugeridos para autocomplete */
  conceptosSugeridos?: string[];
  /** Base sobre la cual calcular porcentajes (solo impuestos). Default: 0 */
  baseCalculoPorcentaje?: number;
  /** Deshabilitar toda la sección (modo readonly) */
  disabled?: boolean;
  /** Título custom (default auto-generado por kind) */
  title?: string;
  /** Subtítulo descriptivo */
  subtitle?: string;
  /** Mostrar total al pie */
  showTotal?: boolean;
  /** Etiqueta del botón agregar */
  addLabel?: string;
  /** ClassName adicional */
  className?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Configuración visual por kind
// ════════════════════════════════════════════════════════════════════════════

const KIND_CONFIG = {
  cargo: {
    title: 'Cargos',
    subtitle: 'Costos adicionales que cobra el proveedor (shipping, handling, etc.)',
    addLabel: 'Agregar cargo',
    pillBg: 'bg-sky-100 text-sky-700',
    pillLabel: 'Cargo',
    sign: '+',
    signColor: 'text-slate-700',
    emptyMessage: 'Sin cargos agregados',
  },
  descuento: {
    title: 'Descuentos',
    subtitle: 'Descuentos aplicados por el proveedor (Subscribe & Save, cupones, etc.)',
    addLabel: 'Agregar descuento',
    pillBg: 'bg-emerald-100 text-emerald-700',
    pillLabel: 'Desc.',
    sign: '−',
    signColor: 'text-emerald-700',
    emptyMessage: 'Sin descuentos agregados',
  },
  impuesto: {
    title: 'Impuestos',
    subtitle: 'Impuestos aplicables (% sobre base o monto fijo)',
    addLabel: 'Agregar impuesto',
    pillBg: 'bg-purple-100 text-purple-700',
    pillLabel: 'Imp.',
    sign: '+',
    signColor: 'text-slate-700',
    emptyMessage: 'Sin impuestos agregados',
  },
} as const;

// ════════════════════════════════════════════════════════════════════════════
// DynamicChargesSection — Main export
// ════════════════════════════════════════════════════════════════════════════

/**
 * DynamicChargesSection — Lista agregable de cargos / descuentos / impuestos.
 *
 * Uso típico en wizard OC:
 *   <DynamicChargesSection
 *     kind="cargo"
 *     items={form.cargosOC}
 *     onChange={items => setForm({ ...form, cargosOC: items })}
 *     conceptosSugeridos={['Shipping fee', 'Handling fee', 'Insurance']}
 *   />
 *
 * Diferencias por kind:
 *   - cargo: suma al total, pill azul
 *   - descuento: resta del total, pill verde, signo negativo
 *   - impuesto: toggle %/$, si es % calcula montoUSD sobre baseCalculoPorcentaje
 */
export const DynamicChargesSection: React.FC<DynamicChargesSectionProps> = ({
  kind,
  items,
  onChange,
  conceptosSugeridos = [],
  baseCalculoPorcentaje = 0,
  disabled = false,
  title,
  subtitle,
  showTotal = true,
  addLabel,
  className,
}) => {
  const config = KIND_CONFIG[kind];
  const listId = useId();
  const datalistId = `concepts-${listId}`;

  // ─── Totales ─────────────────────────────────────────────────────────────
  const total = useMemo(
    () => items.reduce((sum, item) => sum + (item.montoUSD || 0), 0),
    [items]
  );

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleAdd = () => {
    const nuevo: DynamicChargeItem = {
      id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      concepto: '',
      montoUSD: 0,
      ...(kind === 'impuesto' && { modo: 'porcentaje', porcentaje: 0 }),
      ...((kind === 'cargo' || kind === 'descuento') && {
        metodoProrrateo: 'por_valor',
      }),
    };
    onChange([...items, nuevo]);
  };

  const handleUpdate = (id: string, patch: Partial<DynamicChargeItem>) => {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...patch };

        // Recalcular monto si es impuesto en modo porcentaje
        if (kind === 'impuesto' && updated.modo === 'porcentaje') {
          const pct = updated.porcentaje ?? 0;
          updated.montoUSD = Number(((baseCalculoPorcentaje * pct) / 100).toFixed(2));
        }

        return updated;
      })
    );
  };

  const handleRemove = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900">
            {title ?? config.title}
          </div>
          {(subtitle ?? config.subtitle) && (
            <div className="text-xs text-slate-500 mt-0.5">
              {subtitle ?? config.subtitle}
            </div>
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={handleAdd}
            className="px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 rounded-lg border border-teal-200 flex items-center gap-1.5 transition-colors flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            {addLabel ?? config.addLabel}
          </button>
        )}
      </div>

      {/* Datalist con sugerencias */}
      {conceptosSugeridos.length > 0 && (
        <datalist id={datalistId}>
          {conceptosSugeridos.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      )}

      {/* Lista de items */}
      {items.length === 0 ? (
        <div className="text-center text-xs text-slate-400 py-4 border border-dashed border-slate-200 rounded-lg">
          {config.emptyMessage}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              kind={kind}
              config={config}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
              disabled={disabled}
              datalistId={conceptosSugeridos.length > 0 ? datalistId : undefined}
              baseCalculoPorcentaje={baseCalculoPorcentaje}
            />
          ))}
        </div>
      )}

      {/* Total */}
      {showTotal && items.length > 0 && (
        <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Total {config.title.toLowerCase()}
          </span>
          <span className={cn('text-sm font-bold tabular-nums', config.signColor)}>
            {config.sign}${total.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Internal: ItemRow
// ════════════════════════════════════════════════════════════════════════════

interface ItemRowProps {
  item: DynamicChargeItem;
  kind: ChargeKind;
  config: typeof KIND_CONFIG[ChargeKind];
  onUpdate: (id: string, patch: Partial<DynamicChargeItem>) => void;
  onRemove: (id: string) => void;
  disabled: boolean;
  datalistId?: string;
  baseCalculoPorcentaje: number;
}

const ItemRow: React.FC<ItemRowProps> = ({
  item,
  kind,
  config,
  onUpdate,
  onRemove,
  disabled,
  datalistId,
  baseCalculoPorcentaje,
}) => {
  const isImpuesto = kind === 'impuesto';
  const modo = item.modo ?? 'fijo';

  return (
    <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
      {/* Pill tipo */}
      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0', config.pillBg)}>
        {config.pillLabel}
      </span>

      {/* Concepto input */}
      <input
        type="text"
        value={item.concepto}
        onChange={(e) => onUpdate(item.id, { concepto: e.target.value })}
        placeholder="Concepto..."
        list={datalistId}
        disabled={disabled}
        className="flex-1 min-w-0 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100 disabled:bg-slate-50"
      />

      {/* Toggle %/$ solo para impuestos */}
      {isImpuesto && !disabled && (
        <div className="flex bg-slate-100 rounded p-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onUpdate(item.id, { modo: 'porcentaje' })}
            className={cn(
              'px-2 py-0.5 rounded text-xs font-medium transition-colors',
              modo === 'porcentaje' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'
            )}
          >
            <Percent className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onUpdate(item.id, { modo: 'fijo' })}
            className={cn(
              'px-2 py-0.5 rounded text-xs font-medium transition-colors',
              modo === 'fijo' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'
            )}
          >
            <DollarSign className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Input porcentaje (impuestos modo %) */}
      {isImpuesto && modo === 'porcentaje' && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <input
            type="number"
            value={item.porcentaje ?? ''}
            onChange={(e) =>
              onUpdate(item.id, { porcentaje: Number(e.target.value) || 0 })
            }
            step="0.01"
            min="0"
            disabled={disabled}
            className="w-16 px-1.5 py-1 text-sm text-right border border-slate-200 rounded focus:outline-none focus:border-teal-500 disabled:bg-slate-50 tabular-nums"
          />
          <span className="text-xs text-slate-500">%</span>
        </div>
      )}

      {/* Input monto — siempre visible pero readonly si es % */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-xs text-slate-400">$</span>
        <input
          type="number"
          value={item.montoUSD || 0}
          onChange={(e) =>
            onUpdate(item.id, { montoUSD: Number(e.target.value) || 0 })
          }
          step="0.01"
          min="0"
          readOnly={isImpuesto && modo === 'porcentaje'}
          disabled={disabled}
          className={cn(
            'w-20 px-1.5 py-1 text-sm text-right border border-slate-200 rounded focus:outline-none focus:border-teal-500 tabular-nums',
            (isImpuesto && modo === 'porcentaje') || disabled
              ? 'bg-slate-50 text-slate-600'
              : ''
          )}
        />
      </div>

      {/* Base calc hint (impuestos porcentaje) */}
      {isImpuesto && modo === 'porcentaje' && baseCalculoPorcentaje > 0 && (
        <span className="text-[10px] text-slate-400 hidden md:inline flex-shrink-0 whitespace-nowrap">
          s/ ${baseCalculoPorcentaje.toFixed(2)}
        </span>
      )}

      {/* Borrar */}
      {!disabled && (
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded p-1 transition-colors flex-shrink-0"
          aria-label="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
