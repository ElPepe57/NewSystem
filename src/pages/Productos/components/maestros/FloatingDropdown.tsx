/**
 * FloatingDropdown · S3.5 (2026-05-07)
 *
 * Wrapper canónico para dropdowns que escapan del overflow ancestor.
 * Renderiza el contenido vía React.createPortal hacia document.body
 * con position: fixed + coords calculadas, listener de scroll/resize y
 * flip automático cuando no hay espacio abajo.
 *
 * Resuelve el problema de clipping del dropdown dentro de modales con
 * overflow-y-auto (editor V2, wizards). Patrón canónico moderno usado
 * por Radix UI, Headless UI, react-select.
 *
 * Uso:
 *   const anchorRef = useRef<HTMLDivElement>(null);
 *   const dropdownRef = useRef<HTMLDivElement>(null);
 *   <div ref={anchorRef}>{trigger}</div>
 *   <FloatingDropdown anchorRef={anchorRef} dropdownRef={dropdownRef} isOpen={open}>
 *     <div className="bg-white shadow-xl ...">{contenido}</div>
 *   </FloatingDropdown>
 *
 * El dropdownRef permite al consumidor detectar clicks dentro del dropdown
 * portaled (no se puede usar el containerRef del componente padre porque
 * el dropdown está fuera del árbol DOM del consumidor).
 */

import { useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

interface FloatingDropdownProps {
  /** Ref al elemento ancla bajo el cual se posiciona el dropdown */
  anchorRef: RefObject<HTMLElement | null>;
  /** Ref al wrapper del dropdown · útil para click-outside detection en el consumidor */
  dropdownRef?: RefObject<HTMLDivElement | null>;
  /** Si está abierto */
  isOpen: boolean;
  /** Contenido del dropdown */
  children: ReactNode;
  /** Espacio entre ancla y dropdown · default 4px */
  offset?: number;
  /** Altura estimada del dropdown · usada para decidir flip · default 288 (max-h-72) */
  estimatedHeight?: number;
  /** z-index del dropdown · default 60 */
  zIndex?: number;
}

export function FloatingDropdown({
  anchorRef,
  dropdownRef,
  isOpen,
  children,
  offset = 4,
  estimatedHeight = 288,
  zIndex = 60,
}: FloatingDropdownProps) {
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!isOpen) return;

    const calculate = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const flipped = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

      setStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        zIndex,
        ...(flipped
          ? { bottom: window.innerHeight - rect.top + offset }
          : { top: rect.bottom + offset }),
      });
    };

    calculate();
    const handler = () => calculate();
    window.addEventListener('resize', handler);
    // capture: true para captar scroll en cualquier ancestro (modal scrollable incluido)
    document.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      document.removeEventListener('scroll', handler, true);
    };
  }, [isOpen, anchorRef, offset, estimatedHeight, zIndex]);

  if (!isOpen) return null;

  return createPortal(
    <div ref={dropdownRef} style={style}>
      {children}
    </div>,
    document.body,
  );
}
