import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FormSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormSection({
  title,
  icon,
  defaultOpen = false,
  badge,
  disabled = false,
  className = '',
  children,
}: FormSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors ${
        isOpen ? 'border-primary-300 bg-white' : 'border-gray-200 bg-gray-50/50'
      } ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          // Don't toggle if clicking a button/link inside the badge
          if ((e.target as HTMLElement).closest('button, a')) return;
          setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(!isOpen); } }}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50/80 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          <span className={`${isOpen ? 'text-primary-600' : 'text-gray-400'} transition-colors`}>
            {icon}
          </span>
          <span className={`text-sm font-semibold ${isOpen ? 'text-gray-900' : 'text-gray-600'}`}>
            {title}
          </span>
          {badge && <span>{badge}</span>}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      <div
        className={`grid transition-all duration-200 ease-in-out ${
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
