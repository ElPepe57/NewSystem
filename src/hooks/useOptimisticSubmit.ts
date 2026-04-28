/**
 * useOptimisticSubmit — S58 Fase 3 · Submit optimista con toast undo
 *
 * Patrón Stripe/Linear/Mercury para submits de formulario:
 *
 *   1. Usuario click "Crear" → modal cierra al instante (optimista)
 *   2. Toast aparece: "Creado · [Deshacer]" con timer 5s
 *   3. Si el usuario hace click "Deshacer" antes de 5s → onUndo()
 *      ejecuta una compensación (ej: borrar el doc creado, reabrir el modal)
 *   4. Si pasan 5s sin undo → el toast desaparece, el cambio queda firme
 *   5. Si el submit FALLA → toast de error y NO cierra el modal
 *
 * Uso típico:
 *
 *   const { submit, isSubmitting } = useOptimisticSubmit({
 *     onSubmit: async () => { ... return { id: '...' } },
 *     onSuccess: ({ id }) => `Movimiento creado · MOV-${id}`,
 *     onUndo: async (result) => { await borrarMovimiento(result.id); },
 *     onError: (err) => `No se pudo guardar: ${err.message}`,
 *     onCloseModal: () => setIsOpen(false),
 *   });
 *
 *   <Button onClick={submit} loading={isSubmitting}>Crear</Button>
 */

import { useState, useCallback } from 'react';
import { useToastStore } from '../store/toastStore';

export interface UseOptimisticSubmitOptions<TResult> {
  /** Función async que ejecuta el guardado real. Retorna el resultado. */
  onSubmit: () => Promise<TResult>;

  /**
   * Mensaje del toast de éxito · puede usar el resultado para incluir info
   * (ej: número de documento creado).
   */
  onSuccess: (result: TResult) => string;

  /**
   * Compensación si el usuario hace click "Deshacer".
   * Recibe el resultado del onSubmit. Idealmente revierte el cambio
   * (ej: borrar el doc, anular el movimiento).
   */
  onUndo?: (result: TResult) => Promise<void> | void;

  /**
   * Mensaje del toast de error si onSubmit falla.
   * Si no se provee, usa err.message directamente.
   */
  onError?: (error: Error) => string;

  /**
   * Callback para cerrar el modal · se llama ANTES de await onSubmit
   * (de ahí "optimista"). Si onSubmit falla, NO se reabre automáticamente —
   * usar onSubmitError si necesitas reabrir.
   */
  onCloseModal?: () => void;

  /**
   * Si onSubmit falla y el modal ya cerró, este callback puede reabrirlo
   * con los valores intactos. Default: no hace nada (queda cerrado).
   */
  onSubmitError?: (error: Error) => void;

  /** Etiqueta del botón undo · default "Deshacer". */
  undoLabel?: string;

  /** Duration del toast undo en ms · default 5000. */
  undoDuration?: number;

  /** Título opcional del toast (ej: "✓ Creado"). */
  successTitle?: string;
}

export interface UseOptimisticSubmitReturn {
  submit: () => Promise<void>;
  isSubmitting: boolean;
}

export function useOptimisticSubmit<TResult>(
  options: UseOptimisticSubmitOptions<TResult>,
): UseOptimisticSubmitReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { successWithUndo, success, error: toastError } = useToastStore();

  const submit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Ejecutar el guardado
      const result = await options.onSubmit();

      // Cerrar modal (después del await, así si falla se queda abierto)
      options.onCloseModal?.();

      // Toast de éxito
      const message = options.onSuccess(result);
      if (options.onUndo) {
        successWithUndo(
          message,
          async () => {
            try {
              await options.onUndo!(result);
              success('Acción deshecha');
            } catch (err) {
              toastError(
                err instanceof Error ? err.message : 'No se pudo deshacer',
              );
            }
          },
          options.successTitle,
        );
      } else {
        success(message, options.successTitle);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const message = options.onError ? options.onError(error) : error.message;
      toastError(message);
      options.onSubmitError?.(error);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, options, successWithUndo, success, toastError]);

  return { submit, isSubmitting };
}
