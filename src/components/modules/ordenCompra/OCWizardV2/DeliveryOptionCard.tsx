import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { cn } from '../../../../design-system';

interface ConsequenceItem {
  icon: LucideIcon;
  text: string;
  type?: 'auto' | 'required' | 'info';
}

interface DeliveryOptionCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** Ejemplo real del negocio */
  example?: string;
  /** Consecuencias operativas al elegir esta opción */
  consequences?: ConsequenceItem[];
}

export const DeliveryOptionCard: React.FC<DeliveryOptionCardProps> = ({
  icon: Icon, title, subtitle, selected, onClick, disabled, example, consequences,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'relative flex flex-col items-start text-left p-5 rounded-xl border-2 transition-all duration-200',
      'hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2',
      selected
        ? 'border-teal-500 bg-teal-50 shadow-sm'
        : 'border-slate-200 bg-white hover:border-slate-300',
      disabled && 'opacity-50 cursor-not-allowed',
    )}
  >
    {selected && (
      <div className="absolute top-3 right-3 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
        <Check className="w-4 h-4 text-white" />
      </div>
    )}

    {/* Header: icon + title */}
    <div className="flex items-center gap-3 mb-2">
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
        selected ? 'bg-teal-100' : 'bg-slate-100',
      )}>
        <Icon className={cn('w-5 h-5', selected ? 'text-teal-600' : 'text-slate-500')} />
      </div>
      <div>
        <h3 className={cn('text-sm font-semibold leading-tight', selected ? 'text-teal-900' : 'text-slate-900')}>
          {title}
        </h3>
        <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{subtitle}</p>
      </div>
    </div>

    {/* Consequences */}
    {consequences && consequences.length > 0 && (
      <div className={cn(
        'w-full mt-3 pt-3 border-t space-y-1.5',
        selected ? 'border-teal-200' : 'border-slate-100',
      )}>
        {consequences.map((c, i) => (
          <div key={i} className="flex items-start gap-2">
            <c.icon className={cn(
              'w-3.5 h-3.5 mt-0.5 flex-shrink-0',
              c.type === 'auto' ? 'text-teal-500' :
              c.type === 'required' ? 'text-amber-500' :
              'text-slate-400',
            )} />
            <span className={cn(
              'text-[11px] leading-tight',
              c.type === 'auto' ? 'text-teal-700' :
              c.type === 'required' ? 'text-amber-700' :
              'text-slate-500',
            )}>
              {text(c)}
            </span>
          </div>
        ))}
      </div>
    )}

    {/* Example */}
    {example && (
      <div className={cn(
        'w-full mt-2 text-[10px] italic',
        selected ? 'text-teal-600' : 'text-slate-400',
      )}>
        Ej: {example}
      </div>
    )}
  </button>
);

function text(c: ConsequenceItem): string {
  return c.text;
}
