import React, { useState, useRef, useEffect, useCallback } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** Contenido del tooltip */
  content: React.ReactNode;
  /** Elemento que activa el tooltip */
  children: React.ReactElement;
  /** Posicion del tooltip */
  position?: TooltipPosition;
  /** Delay antes de mostrar (ms) */
  delay?: number;
  /** Desactivar tooltip */
  disabled?: boolean;
  /** Clases adicionales para el tooltip */
  className?: string;
  /** Ancho maximo del tooltip */
  maxWidth?: number;
}

const positionStyles: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2'
};

const arrowStyles: Record<TooltipPosition, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 border-x-transparent border-b-transparent',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 border-x-transparent border-t-transparent',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 border-y-transparent border-r-transparent',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 border-y-transparent border-l-transparent'
};

/**
 * Componente de Tooltip
 *
 * @example
 * <Tooltip content="Este es un tooltip" position="top">
 *   <button>Hover me</button>
 * </Tooltip>
 *
 * @example
 * <Tooltip
 *   content={
 *     <div>
 *       <strong>Titulo</strong>
 *       <p>Descripcion detallada</p>
 *     </div>
 *   }
 *   position="right"
 *   maxWidth={300}
 * >
 *   <InfoIcon />
 * </Tooltip>
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200,
  disabled = false,
  className = '',
  maxWidth = 250
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback(() => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay, disabled]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (disabled) {
    return children;
  }

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}

      {isVisible && (
        <div
          className={`
            absolute z-50 ${positionStyles[position]}
            px-3 py-2 rounded-lg
            bg-gray-900 text-white text-sm
            shadow-lg
            animate-in fade-in-0 zoom-in-95 duration-150
            ${className}
          `}
          style={{ maxWidth }}
          role="tooltip"
        >
          {content}
          {/* Arrow */}
          <div
            className={`
              absolute w-0 h-0
              border-4 ${arrowStyles[position]}
            `}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Tooltip simple solo texto (optimizado)
 */
export const TooltipSimple: React.FC<{
  text: string;
  children: React.ReactElement;
  position?: TooltipPosition;
}> = ({ text, children, position = 'top' }) => {
  return (
    <Tooltip content={text} position={position}>
      {children}
    </Tooltip>
  );
};

/**
 * Tooltip con informacion estructurada
 */
export const TooltipInfo: React.FC<{
  title: string;
  description?: string;
  children: React.ReactElement;
  position?: TooltipPosition;
}> = ({ title, description, children, position = 'top' }) => {
  return (
    <Tooltip
      content={
        <div>
          <div className="font-medium">{title}</div>
          {description && <div className="text-gray-300 text-xs mt-1">{description}</div>}
        </div>
      }
      position={position}
      maxWidth={300}
    >
      {children}
    </Tooltip>
  );
};

/**
 * Icono de ayuda con tooltip
 */
export const HelpTooltip: React.FC<{
  text: string;
  position?: TooltipPosition;
  iconClassName?: string;
}> = ({ text, position = 'top', iconClassName = 'h-4 w-4' }) => {
  return (
    <Tooltip content={text} position={position}>
      <button
        type="button"
        className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Ayuda"
      >
        <svg
          className={iconClassName}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
    </Tooltip>
  );
};
