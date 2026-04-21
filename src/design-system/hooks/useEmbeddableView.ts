/**
 * useEmbeddableView — Hook para manejar la "vista interna" del detalle de una entidad.
 *
 * Patrón canónico S52 — ver `docs/DESIGN_PATTERNS.md` → Patrón 5.
 *
 * Generaliza el patrón `vistaInterna` + prop `embedded` del estándar OC
 * (OrdenCompraCard línea 67 + ConfirmarOCModal línea 64). Permite que un
 * detalle de entidad cambie su ZONA DINÁMICA entre múltiples modos sin
 * abrir modales adicionales ("modal sobre modal" — anti-patrón 1).
 *
 * USO TÍPICO:
 *
 *   type VistaEnvio = 'detalle' | 'recepcionando' | 'agregando-costo' | 'confirmando';
 *
 *   const vista = useEmbeddableView<VistaEnvio>('detalle');
 *
 *   // En el render del detalle:
 *   {vista.current === 'detalle' && <DetalleView />}
 *   {vista.current === 'recepcionando' && (
 *     <RecepcionPanel embedded onClose={() => vista.back()} />
 *   )}
 *   {vista.current === 'agregando-costo' && (
 *     <AgregarCostoPanel embedded onClose={() => vista.back()} />
 *   )}
 *
 *   // En el banner CTA o en un botón:
 *   <NextActionBanner
 *     label="Registrar recepción"
 *     buttonText="Recepcionar"
 *     onClick={() => vista.switchTo('recepcionando')}
 *   />
 *
 * VENTAJAS vs. abrir otro modal:
 *   - Header + Pipeline + KPIs quedan fijos arriba — el usuario no pierde contexto
 *   - Animación más suave (no hay overlay adicional apilándose)
 *   - URL no se llena de modales (se puede sincronizar con `?action=X` si se quiere)
 *   - El usuario siempre tiene claro "en qué entidad está trabajando"
 *
 * NOMENCLATURA:
 *   - `current`: el modo actual (estado)
 *   - `switchTo`: cambiar a otro modo (reemplaza pero preserva previo en historial)
 *   - `back`: volver al modo anterior (o al default si no hay historial)
 *   - `isEmbedded`: siempre true si el hook se usó (para pasar como prop `embedded`)
 */
import { useState, useCallback } from 'react';

// ────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────

export interface EmbeddableView<TVista extends string> {
  /** Modo actual (equivalente a `vistaInterna` de OC) */
  current: TVista;
  /** Cambiar al modo dado; preserva el previo en el historial */
  switchTo: (vista: TVista) => void;
  /** Volver al modo anterior (o al default si no hay historial) */
  back: () => void;
  /** Resetear al modo default */
  reset: () => void;
  /** Verdadero si el modo actual NO es el default (útil para títulos dinámicos) */
  isActionActive: boolean;
  /** Siempre true — para pasar como prop `embedded={vista.isEmbedded}` */
  readonly isEmbedded: true;
}

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

/**
 * Hook que maneja la vista interna de un detalle de entidad.
 *
 * @param defaultVista - modo default (generalmente `'detalle'`)
 * @returns objeto con `current`, `switchTo`, `back`, `reset`, `isActionActive`, `isEmbedded`
 */
export function useEmbeddableView<TVista extends string>(
  defaultVista: TVista
): EmbeddableView<TVista> {
  const [current, setCurrent] = useState<TVista>(defaultVista);
  const [historial, setHistorial] = useState<TVista[]>([]);

  const switchTo = useCallback(
    (vista: TVista) => {
      setCurrent((prev) => {
        setHistorial((h) => [...h, prev]);
        return vista;
      });
    },
    []
  );

  const back = useCallback(() => {
    setHistorial((h) => {
      if (h.length === 0) {
        setCurrent(defaultVista);
        return h;
      }
      const prev = h[h.length - 1];
      setCurrent(prev);
      return h.slice(0, -1);
    });
  }, [defaultVista]);

  const reset = useCallback(() => {
    setCurrent(defaultVista);
    setHistorial([]);
  }, [defaultVista]);

  return {
    current,
    switchTo,
    back,
    reset,
    isActionActive: current !== defaultVista,
    isEmbedded: true as const,
  };
}
