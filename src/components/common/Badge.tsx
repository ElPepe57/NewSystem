import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = ''
}) => {
  const variantStyles = {
    success: 'bg-success-100 text-success-800 ring-success-600/20',
    warning: 'bg-warning-100 text-warning-800 ring-warning-600/20',
    danger: 'bg-danger-100 text-danger-800 ring-danger-600/20',
    info: 'bg-teal-100 text-teal-800 ring-teal-600/20',
    default: 'bg-slate-100 text-slate-800 ring-slate-600/20'
  };
  
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };
  
  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium ring-1 ring-inset
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {children}
    </span>
  );
};
