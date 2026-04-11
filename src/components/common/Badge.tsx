import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'outline' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Badge — Alineado al design system (mismos colores que StatusBadge).
 * Usa emerald/amber/red/sky/slate en vez de success/warning/danger custom.
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = ''
}) => {
  const variantStyles: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200',
    danger: 'bg-red-50 text-red-700 ring-red-200',
    info: 'bg-sky-50 text-sky-700 ring-sky-200',
    default: 'bg-slate-100 text-slate-700 ring-slate-200',
    outline: 'bg-white text-slate-600 ring-slate-300',
    secondary: 'bg-slate-50 text-slate-600 ring-slate-200',
  };

  const sizeStyles: Record<string, string> = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ring-inset ${variantStyles[variant] || variantStyles.default} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
