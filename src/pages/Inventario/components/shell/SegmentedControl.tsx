/**
 * SegmentedControl · radio-button group estilizado tipo iOS/Linear
 *
 * Componente de toggle entre 2-3 opciones · usado para el switch
 * Stock|Unidades en el tab Inventario (chk4.2 + chk4.4 + chk4.7b).
 *
 * Patrón visual canónico:
 *   - Container con bg-slate-100 · rounded-lg · p-1
 *   - Botón activo: bg-white · shadow-sm · text-slate-900
 *   - Botón inactivo: text-slate-600 · hover:text-slate-900
 *   - Count badge inline opcional (tabular-nums)
 *   - Transición suave entre estados
 *
 * Page-scoped en chk4.2 · candidato a promover a design-system si más
 * módulos adoptan el mismo patrón de toggle.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Count opcional · se renderiza como badge tabular-nums junto al label */
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: SegmentedControlProps<T>) {
  const sizeClasses = size === 'sm'
    ? 'text-xs px-2.5 py-1'
    : 'text-sm px-3.5 py-1.5';

  return (
    <div className={`inline-flex items-center bg-slate-100 rounded-lg p-1 ${className}`}>
      {options.map(opt => {
        const isActive = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`
              ${sizeClasses}
              font-medium rounded-md transition-all duration-150
              flex items-center gap-1.5
              ${isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
              }
            `.trim().replace(/\s+/g, ' ')}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={`text-[11px] tabular-nums font-semibold ${
                  isActive ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {opt.count.toLocaleString('es-PE')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
