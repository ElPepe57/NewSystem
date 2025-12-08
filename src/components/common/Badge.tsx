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
    info: 'bg-primary-100 text-primary-800 ring-primary-600/20',
    default: 'bg-gray-100 text-gray-800 ring-gray-600/20'
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
