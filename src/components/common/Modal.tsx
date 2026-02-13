import React, { useEffect, useRef, useId, useCallback, useState } from 'react';
import { X } from 'lucide-react';

// Estado global simple para tracking de modales abiertos
let modalCount = 0;
const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

export const registerModalOpen = () => {
  modalCount++;
  notifyListeners();
};

export const unregisterModalOpen = () => {
  modalCount = Math.max(0, modalCount - 1);
  notifyListeners();
};

export const getModalCount = () => modalCount;

export const subscribeToModalChanges = (callback: () => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  footer?: React.ReactNode;
  subtitle?: string;
  fullHeight?: boolean;
  disableBackdropClick?: boolean;
  disableEscapeKey?: boolean;
  contentClassName?: string;
  contentPadding?: 'none' | 'sm' | 'md' | 'lg';
  showHeaderShadow?: boolean;
  showScrollIndicator?: boolean;
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
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const scrollPositionRef = useRef(0);
  const [hasScroll, setHasScroll] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const titleId = useId();
  const descriptionId = useId();

  // Manejar animación de entrada/salida
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 200);
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

  // Bloquear scroll del body
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      scrollPositionRef.current = window.scrollY;

      // Bloquear scroll del body
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.setAttribute('data-modal-open', 'true');
      registerModalOpen();

      setTimeout(() => {
        modalRef.current?.focus();
      }, 0);
    } else {
      // Restaurar scroll del body
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollPositionRef.current);

      unregisterModalOpen();
      if (getModalCount() === 0) {
        document.body.removeAttribute('data-modal-open');
      }
      previousFocusRef.current?.focus();
    }

    return () => {
      if (isOpen) {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollPositionRef.current);
        unregisterModalOpen();
        if (getModalCount() === 0) {
          document.body.removeAttribute('data-modal-open');
        }
      }
    };
  }, [isOpen]);

  // Focus trap
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

  // Detectar scroll en el contenido
  useEffect(() => {
    const content = contentRef.current;
    if (!content || !isOpen) return;

    const checkScroll = () => {
      const hasVerticalScroll = content.scrollHeight > content.clientHeight;
      setHasScroll(hasVerticalScroll);
      setIsAtTop(content.scrollTop <= 1);
      setIsAtBottom(
        Math.abs(content.scrollHeight - content.scrollTop - content.clientHeight) < 2
      );
    };

    setTimeout(checkScroll, 100);
    content.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);

    return () => {
      content.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [isOpen, children]);

  if (!shouldRender) return null;

  const sizeStyles = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-2xl',
    lg: 'sm:max-w-4xl',
    xl: 'sm:max-w-6xl',
    full: 'sm:max-w-[95vw]'
  };

  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
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
          absolute inset-0 bg-black transition-opacity duration-200
          ${isAnimating ? 'opacity-50' : 'opacity-0'}
        `}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Container para centrar en desktop */}
      <div className="absolute inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        {/* Modal */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={subtitle ? descriptionId : undefined}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className={`
            relative bg-white shadow-2xl
            transition-all duration-200 ease-out
            ${isAnimating
              ? 'opacity-100 scale-100 translate-y-0'
              : 'opacity-0 scale-95 translate-y-4'
            }

            /* Mobile: full screen */
            w-full h-full

            /* Desktop: centered modal */
            sm:h-auto sm:rounded-xl sm:w-full ${sizeStyles[size]}
            ${fullHeight ? 'sm:h-[calc(100vh-2rem)] sm:max-h-[90vh]' : 'sm:max-h-[calc(100vh-2rem)]'}
          `}
          style={{
            outline: 'none',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className={`
              flex items-center justify-between
              px-4 py-3 sm:px-6 sm:py-4
              border-b border-gray-200 bg-white
              sm:rounded-t-xl
              ${showHeaderShadow && hasScroll && !isAtTop ? 'shadow-md z-10' : ''}
            `}
            style={{
              flexShrink: 0,
              paddingTop: 'max(0.75rem, env(safe-area-inset-top))'
            }}
          >
            <div className="flex-1 min-w-0 pr-4">
              <h2 id={titleId} className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                {title}
              </h2>
              {subtitle && (
                <p id={descriptionId} className="text-sm text-gray-500 mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-full p-2 hover:bg-gray-100 active:bg-gray-200"
              aria-label="Cerrar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content - área scrolleable */}
          <div
            ref={contentRef}
            className={`
              ${paddingStyles[contentPadding]}
              max-sm:p-4
              ${contentClassName}
            `}
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
            }}
          >
            {children}
          </div>

          {/* Scroll indicator */}
          {showScrollIndicator && hasScroll && !isAtBottom && (
            <div
              className="absolute left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none"
              style={{ bottom: footer ? '60px' : 0 }}
            />
          )}

          {/* Footer */}
          {footer && (
            <div
              className={`
                px-4 py-3 sm:px-6 sm:py-4
                border-t border-gray-200 bg-gray-50
                sm:rounded-b-xl
                ${showHeaderShadow && hasScroll && !isAtBottom ? 'shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]' : ''}
              `}
              style={{
                flexShrink: 0,
                paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))'
              }}
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
 * Componente helper para el footer del modal
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
