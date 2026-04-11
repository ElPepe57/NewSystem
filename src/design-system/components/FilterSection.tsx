import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../utils';
import { text, transition } from '../tokens';

interface FilterSectionProps {
  title: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}

/**
 * FilterSection — Seccion colapsable dentro del FilterDrawer.
 */
export const FilterSection: React.FC<FilterSectionProps> = ({
  title, icon: Icon, defaultOpen = true, children, badge,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-100 py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-slate-400" />}
          <span className={text.subheading}>{title}</span>
          {badge}
        </div>
        <ChevronDown className={cn('w-4 h-4 text-slate-400', transition.fast, open && 'rotate-180')} />
      </button>
      <div className={cn(
        'grid transition-[grid-template-rows] duration-200',
        open ? 'grid-rows-[1fr] mt-3' : 'grid-rows-[0fr]'
      )}>
        <div className="overflow-hidden">
          <div className="space-y-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
