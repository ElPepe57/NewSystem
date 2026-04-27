import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /**
   * Estilos del botón:
   *  - primary / success / danger / warning : SATURADOS (fondo lleno).
   *    Para acciones críticas y CTA principales únicos en su pantalla.
   *  - primary-soft / success-soft / danger-soft : TONALES (pastel + texto color).
   *    Estilo Linear / Mercury / Stripe Atlas — preserva identidad de color
   *    sin agresividad. Recomendado para grupos de botones donde varios
   *    necesitan color (ej: "Acciones rápidas").
   *  - secondary : slate oscuro lleno.
   *  - outline   : border + fondo blanco.
   *  - ghost     : sin fondo, solo hover sutil.
   */
  variant?:
    | 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success' | 'warning'
    | 'primary-soft' | 'success-soft' | 'danger-soft';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children?: React.ReactNode;
  label?: string; // alias legacy - se ignora si children tiene contenido
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  label,
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    // Saturados (fondo lleno)
    primary: 'bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500',
    secondary: 'bg-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
    warning: 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-500',
    // Neutros / sutiles
    ghost: 'text-slate-700 hover:bg-slate-100 focus:ring-slate-500',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-500',
    // Tonales (estilo Linear/Mercury) — fondo pastel + texto color, no agresivos
    'primary-soft': 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 focus:ring-teal-500',
    'success-soft': 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 focus:ring-emerald-500',
    'danger-soft': 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 focus:ring-red-500',
  };
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
  
  return (
    <button
      type="button"
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {children ?? label}
    </button>
  );
};
