import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { cn } from '../../../../design-system';

interface DeliveryOptionCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const DeliveryOptionCard: React.FC<DeliveryOptionCardProps> = ({
  icon: Icon, title, subtitle, selected, onClick, disabled,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'relative flex flex-col items-center text-center p-6 rounded-xl border-2 transition-all duration-200',
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
    <div className={cn(
      'w-14 h-14 rounded-2xl flex items-center justify-center mb-4',
      selected ? 'bg-teal-100' : 'bg-slate-100',
    )}>
      <Icon className={cn('w-7 h-7', selected ? 'text-teal-600' : 'text-slate-500')} />
    </div>
    <h3 className={cn('text-sm font-semibold', selected ? 'text-teal-900' : 'text-slate-900')}>
      {title}
    </h3>
    <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
  </button>
);
