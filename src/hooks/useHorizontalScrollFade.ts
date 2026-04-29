import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * S54 — Hook para fade dinámico en contenedores scrolleables horizontalmente.
 *
 * Detecta el estado de scroll del elemento referenciado y devuelve el nombre
 * de la clase CSS que aplica el degradado correcto:
 *   - 'fade-scroll-both'  → hay contenido oculto a izquierda y derecha
 *   - 'fade-scroll-left'  → solo hay scroll hacia la izquierda
 *   - 'fade-scroll-right' → solo hay scroll hacia la derecha
 *   - ''                  → no hay overflow, sin fade
 *
 * Usa un callback ref en vez de useRef para reaccionar cuando el elemento
 * aparece/desaparece del DOM (ej. después de loading=true → false).
 * Soporta scroll + resize + wheel vertical → horizontal.
 *
 * Uso:
 *   const { ref, fadeClass, canScrollLeft, canScrollRight, scrollPrev, scrollNext } =
 *     useHorizontalScrollFade<HTMLDivElement>();
 *   return <div ref={ref} className={`overflow-x-auto scrollbar-hide ${fadeClass}`}>...</div>;
 */
export function useHorizontalScrollFade<T extends HTMLElement = HTMLDivElement>() {
  const [fadeClass, setFadeClass] = useState<string>('');
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Referencia mutable que apunta al elemento montado (para scrollBy desde afuera).
  const elRef = useRef<T | null>(null);
  // Guardamos los cleanup listeners para re-asociarlos cuando el elemento cambie.
  const cleanupRef = useRef<(() => void) | null>(null);

  // Callback ref: se dispara cada vez que el elemento se monta o desmonta.
  // Esto es clave cuando el ancestor cambia de loading→contenido — un useRef
  // no reaccionaría, pero un callback ref sí.
  const ref = useCallback((node: T | null) => {
    // Limpieza si ya había un elemento previo asociado.
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    elRef.current = node;
    if (!node) return;

    const actualizar = () => {
      const { scrollLeft, scrollWidth, clientWidth } = node;
      const canLeft = scrollLeft > 1;
      const canRight = scrollLeft + clientWidth < scrollWidth - 1;

      setCanScrollLeft(canLeft);
      setCanScrollRight(canRight);
      if (canLeft && canRight) setFadeClass('fade-scroll-both');
      else if (canLeft) setFadeClass('fade-scroll-left');
      else if (canRight) setFadeClass('fade-scroll-right');
      else setFadeClass('');
    };

    // Evaluación inicial + también en el próximo tick (deja que el layout
    // se asiente después de la hidratación / carga de fuentes).
    actualizar();
    const raf = requestAnimationFrame(actualizar);

    node.addEventListener('scroll', actualizar, { passive: true });

    const onWheel = (e: WheelEvent) => {
      // Convertir rueda vertical a scroll horizontal (útil en mouse sin
      // trackpad horizontal).
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        node.scrollLeft += e.deltaY;
      }
    };
    node.addEventListener('wheel', onWheel, { passive: false });

    const ro = new ResizeObserver(actualizar);
    ro.observe(node);
    window.addEventListener('resize', actualizar);

    cleanupRef.current = () => {
      cancelAnimationFrame(raf);
      node.removeEventListener('scroll', actualizar);
      node.removeEventListener('wheel', onWheel);
      ro.disconnect();
      window.removeEventListener('resize', actualizar);
    };
  }, []);

  // Cleanup al desmontar el componente consumidor.
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const scrollBy = (delta: number) => {
    const el = elRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return {
    ref,
    fadeClass,
    canScrollLeft,
    canScrollRight,
    /** Desplaza ~75% del ancho visible hacia la dirección indicada. */
    scrollPrev: () => scrollBy(-Math.floor((elRef.current?.clientWidth ?? 200) * 0.75)),
    scrollNext: () => scrollBy(Math.floor((elRef.current?.clientWidth ?? 200) * 0.75)),
  };
}
