import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '../../components/common';

interface SeccionColapsableProps {
  titulo: string;
  icono: React.ReactNode;
  cantidad: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: 'warning' | 'info' | 'success' | 'danger';
}

export const SeccionColapsable: React.FC<SeccionColapsableProps> = ({
  titulo,
  icono,
  cantidad,
  children,
  defaultOpen = false,
  variant = 'info'
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const variantStyles = {
    warning: 'border-amber-200 bg-amber-50',
    info: 'border-blue-200 bg-blue-50',
    success: 'border-green-200 bg-green-50',
    danger: 'border-red-200 bg-red-50'
  };

  const iconStyles = {
    warning: 'text-amber-600',
    info: 'text-blue-600',
    success: 'text-green-600',
    danger: 'text-red-600'
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${variantStyles[variant]}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={iconStyles[variant]}>{icono}</span>
          <span className="font-medium text-gray-800">{titulo}</span>
          <Badge variant={variant} size="sm">{cantidad}</Badge>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 bg-white border-t">
          {children}
        </div>
      )}
    </div>
  );
};
