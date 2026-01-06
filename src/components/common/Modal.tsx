import React, { useEffect, useRef, useId, useCallback, useState } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Contenido del footer sticky (botones de accion) */
  footer?: React.ReactNode;
  /** Subtitulo o descripcion bajo el titulo */
  subtitle?: string;
  /** Si es true, el modal ocupa casi toda la pantalla con scroll interno */
  fullHeight?: boolean;
  /** Deshabilitar el cierre al hacer clic en el backdrop */
  disableBackdropClick?: boolean;
  /** Deshabilitar el cierre con la tecla Escape */
  disableEscapeKey?: boolean;
  /** Clase CSS adicional para el contenedor del contenido */
  contentClassName?: string;
  /** Padding del contenido (default: 'md') */
  contentPadding?: 'none' | 'sm' | 'md' | 'lg';
  /** Mostrar sombra en el header cuando hay scroll */
  showHeaderShadow?: boolean;
  /** Mostrar indicador de scroll (gradiente) en la parte inferior del contenido */
  showScrollIndicator?: boolean;
  /** Modo responsivo en móviles (default: 'fullscreen') */
  mobileMode?: 'fullscreen' | 'bottom-sheet' | 'default';
  /** Habilitar swipe para cerrar en móvil (solo con mobileMode='bottom-sheet') */
  swipeToClose?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  subtitle,
  fullHeight = false,
  disableBackdropClick = false,
  disableEscapeKey = false,
  contentClassName = '',
  contentPadding = 'md',
  showHeaderShadow = true,
  showScrollIndicator = true,
  mobileMode = 'fullscreen',
  swipeToClose = true
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [hasScroll, setHasScroll] = React.useState(false);
  const [isAtTop, setIsAtTop] = React.useState(true);
  const [isAtBottom, setIsAtBottom] = React.useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const touchStartY = useRef(0);

  const titleId = useId();
  const descriptionId = useId();

  // Manejar animación de entrada/salida
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Pequeño delay para que el DOM se actualice antes de la animación
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // Esperar a que termine la animación antes de desmontar
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 200); // Duración de la animación
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Manejar tecla Escape
  useEffect(() => {
    if (!isOpen || disableEscapeKey) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, disableEscapeKey, onClose]);

  // Guardar y restaurar foco, bloquear scroll
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';

      // Enfocar el modal cuando se abre
      setTimeout(() => {
        modalRef.current?.focus();
      }, 0);
    } else {
      document.body.style.overflow = '';
      // Restaurar foco al elemento anterior
      previousFocusRef.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus trap - mantener el foco dentro del modal
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, []);

  // Handlers para swipe to close (móvil)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (mobileMode !== 'bottom-sheet' || !swipeToClose) return;
    touchStartY.current = e.touches[0].clientY;
    setIsSwiping(true);
  }, [mobileMode, swipeToClose]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping || mobileMode !== 'bottom-sheet') return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    // Solo permitir swipe hacia abajo
    if (diff > 0) {
      setSwipeOffset(diff);
    }
  }, [isSwiping, mobileMode]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping) return;
    setIsSwiping(false);
    // Si se ha deslizado más de 100px, cerrar el modal
    if (swipeOffset > 100) {
      onClose();
    }
    setSwipeOffset(0);
  }, [isSwiping, swipeOffset, onClose]);

  // Detectar scroll en el contenido
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const checkScroll = () => {
      const hasVerticalScroll = content.scrollHeight > content.clientHeight;
      setHasScroll(hasVerticalScroll);
      setIsAtTop(content.scrollTop === 0);
      setIsAtBottom(
        Math.abs(content.scrollHeight - content.scrollTop - content.clientHeight) < 1
      );
    };

    checkScroll();
    content.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);

    return () => {
      content.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [isOpen, children]);

  if (!shouldRender) return null;

  // Estilos de tamaño para desktop
  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[95vw]'
  };

  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const heightStyles = fullHeight ? 'max-h-[90vh]' : 'max-h-[85vh]';

  // Estilos responsivos para móvil
  const getMobileStyles = () => {
    switch (mobileMode) {
      case 'fullscreen':
        return 'sm:rounded-lg sm:max-h-[85vh] max-sm:rounded-none max-sm:max-h-full max-sm:h-full max-sm:max-w-full';
      case 'bottom-sheet':
        return 'sm:rounded-lg max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:max-h-[90vh] max-sm:mt-auto max-sm:max-w-full';
      default:
        return '';
    }
  };

  const handleBackdropClick = () => {
    if (!disableBackdropClick) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black transition-opacity duration-200 ease-out
          ${isAnimating ? 'bg-opacity-50' : 'bg-opacity-0'}
        `}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className={`flex min-h-full items-center justify-center p-4 max-sm:p-0 ${mobileMode === 'bottom-sheet' ? 'max-sm:items-end' : ''}`}>
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={subtitle ? descriptionId : undefined}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={swipeOffset > 0 ? { transform: `translateY(${swipeOffset}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' } : undefined}
          className={`
            relative bg-white shadow-xl w-full flex flex-col overflow-hidden focus:outline-none
            ${sizeStyles[size]} ${heightStyles} ${getMobileStyles()}
            ${mobileMode !== 'default' ? 'rounded-lg' : 'rounded-lg'}
            transition-all duration-200 ease-out
            ${isAnimating
              ? 'opacity-100 scale-100 translate-y-0'
              : mobileMode === 'bottom-sheet'
                ? 'opacity-0 translate-y-8 max-sm:translate-y-full'
                : 'opacity-0 scale-95 translate-y-4'
            }
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Swipe indicator para bottom-sheet en móvil */}
          {mobileMode === 'bottom-sheet' && swipeToClose && (
            <div className="sm:hidden flex justify-center py-2 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
          )}

          {/* Header - Sticky */}
          <div
            className={`
              flex-shrink-0 flex items-center justify-between p-6 max-sm:p-4 border-b border-gray-200 bg-white
              transition-shadow duration-200
              ${showHeaderShadow && hasScroll && !isAtTop ? 'shadow-md' : ''}
            `}
          >
            <div className="flex-1 min-w-0 pr-4">
              <h2 id={titleId} className="text-xl max-sm:text-lg font-semibold text-gray-900 truncate">{title}</h2>
              {subtitle && (
                <p id={descriptionId} className="text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-full p-2 max-sm:p-1.5 hover:bg-gray-100 active:bg-gray-200"
              aria-label="Cerrar modal"
            >
              <X className="h-6 w-6 max-sm:h-5 max-sm:w-5" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div
            ref={contentRef}
            className={`
              flex-1 overflow-y-auto overscroll-contain
              ${paddingStyles[contentPadding]}
              max-sm:${contentPadding === 'lg' ? 'p-4' : contentPadding === 'md' ? 'p-4' : paddingStyles[contentPadding]}
              ${contentClassName}
            `}
          >
            {children}
          </div>

          {/* Scroll indicator gradient */}
          {showScrollIndicator && hasScroll && !isAtBottom && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" style={{ bottom: footer ? '72px' : 0 }} />
          )}

          {/* Footer - Sticky (si se provee) */}
          {footer && (
            <div
              className={`
                flex-shrink-0 px-6 py-4 max-sm:px-4 max-sm:py-3 border-t border-gray-200 bg-gray-50
                transition-shadow duration-200
                max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))]
                ${showHeaderShadow && hasScroll && !isAtBottom ? 'shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]' : ''}
              `}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Componente helper para el footer del modal con botones alineados
 */
interface ModalFooterProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right' | 'between';
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
  children,
  align = 'right'
}) => {
  const alignStyles = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between'
  };

  return (
    <div className={`flex items-center gap-3 ${alignStyles[align]}`}>
      {children}
    </div>
  );
};
