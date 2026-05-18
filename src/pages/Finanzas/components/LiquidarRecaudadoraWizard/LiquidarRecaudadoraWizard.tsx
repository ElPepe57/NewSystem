/**
 * LiquidarRecaudadoraWizard — chk5.D-S1f · F5
 *
 * Wizard de 3 pasos para liquidar el saldo pendiente de una Caja Recaudadora
 * (D5 + D12 · DEUDA-MODELO-RECAUDADOR refinada) al banco destino.
 *
 * F-Borradores integrado · TipoBorradorWizard='liquidar_recaudadora'.
 * El submit del paso 3 dispara `liquidarCajaRecaudadoraService.liquidarSaldo()`
 * que es transacción atómica (Firestore runTransaction).
 *
 * Patrón similar a CuentaWizard (S58c v2) · usa FormModalV2 + Stepper.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Truck, Check, ArrowRight, ArrowLeft, Save } from 'lucide-react';
import { FormModalV2 } from '../../../../design-system/components/FormModalV2';
import { Button } from '../../../../components/common';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import { liquidarCajaRecaudadoraService } from '../../../../services/liquidarCajaRecaudadora.service';
import { borradorWizardService } from '../../../../services/borradorWizard.service';
import { cn } from '../../../../design-system/utils';
import { Paso1Seleccion } from './Paso1Seleccion';
import { Paso2Revision } from './Paso2Revision';
import { Paso3Confirmar } from './Paso3Confirmar';
import {
  INITIAL_STATE,
  PASOS_LIQUIDACION_LABEL,
  validarPaso,
  generarResumenBorrador,
  type LiquidarRecaudadoraState,
  type PasoLiquidacion,
} from './types';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface LiquidarRecaudadoraWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-llenar recaudadora desde drawer/detalle (skip Paso 1 si lo provee con todo) */
  recaudadoraIdInicial?: string;
  recaudadoraNombreInicial?: string;
  /** Callback al liquidar exitosamente */
  onSuccess?: (liquidacionId: string, codigo: string) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// STEPPER
// ═════════════════════════════════════════════════════════════════════════

const Stepper: React.FC<{ pasoActual: PasoLiquidacion }> = ({ pasoActual }) => {
  const pasos: PasoLiquidacion[] = [1, 2, 3];
  return (
    <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
      <div className="flex items-center gap-2">
        {pasos.map((p, i) => {
          const completed = p < pasoActual;
          const active = p === pasoActual;
          return (
            <React.Fragment key={p}>
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    'w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors',
                    completed && 'bg-emerald-500 text-white',
                    active && 'bg-pink-600 text-white',
                    !completed && !active && 'bg-white border-2 border-slate-300 text-slate-500',
                  )}
                >
                  {completed ? <Check className="w-3 h-3" /> : p}
                </div>
                <span
                  className={cn(
                    'text-[12px] whitespace-nowrap',
                    active && 'font-semibold text-slate-900',
                    !active && 'text-slate-500',
                  )}
                >
                  {PASOS_LIQUIDACION_LABEL[p]}
                </span>
              </div>
              {i < pasos.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-px mx-1',
                    p < pasoActual ? 'bg-pink-300' : 'bg-slate-300',
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const LiquidarRecaudadoraWizard: React.FC<LiquidarRecaudadoraWizardProps> = ({
  isOpen,
  onClose,
  recaudadoraIdInicial,
  recaudadoraNombreInicial,
  onSuccess,
}) => {
  const userId = useAuthStore((s) => s.user?.uid ?? '');
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  const [paso, setPaso] = useState<PasoLiquidacion>(1);
  const [state, setState] = useState<LiquidarRecaudadoraState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);

  // ── Reset + hidratación de borrador al abrir ──
  useEffect(() => {
    if (!isOpen) return;
    setPaso(1);
    setSubmitting(false);

    // Inicializar con pre-llenos de props si vinieron
    const initial: LiquidarRecaudadoraState = {
      ...INITIAL_STATE,
      recaudadoraId: recaudadoraIdInicial ?? '',
      recaudadoraNombre: recaudadoraNombreInicial ?? '',
    };
    setState(initial);

    // Intentar cargar borrador existente
    if (userId) {
      void borradorWizardService
        .get(userId, 'liquidar_recaudadora')
        .then((borrador) => {
          if (borrador && borrador.estado) {
            setState((s) => ({ ...s, ...(borrador.estado as Partial<LiquidarRecaudadoraState>) }));
            setPaso(((borrador.pasoActual as PasoLiquidacion) || 1) as PasoLiquidacion);
          }
        })
        .catch(() => {
          /* sin borrador · OK */
        });
    }
  }, [isOpen, userId, recaudadoraIdInicial, recaudadoraNombreInicial]);

  // ── Autosave borrador en cada cambio significativo ──
  useEffect(() => {
    if (!isOpen || !userId || submitting) return;
    if (!state.recaudadoraId && !state.fechaInicio) return; // No guardar borrador vacío
    const { resumen, montoEstimado } = generarResumenBorrador(state);
    const timeout = setTimeout(() => {
      void borradorWizardService.save({
        tipo: 'liquidar_recaudadora',
        userId,
        pasoActual: paso,
        estado: state as unknown as Record<string, any>,
        resumen,
        montoEstimado,
      });
    }, 1000); // Debounce 1s
    return () => clearTimeout(timeout);
  }, [isOpen, userId, paso, state, submitting]);

  // ── Validación del paso actual ──
  const validacion = useMemo(() => validarPaso(paso, state), [paso, state]);

  // ── Navegación ──
  const handleNext = useCallback(() => {
    if (!validacion.valido) {
      toastError(validacion.errores.join(' · '), 'Revisa los datos');
      return;
    }
    if (paso < 3) {
      setPaso((p) => (p + 1) as PasoLiquidacion);
    } else {
      void handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, validacion, toastError]);

  const handleBack = useCallback(() => {
    if (paso === 1) {
      onClose();
    } else {
      setPaso((p) => (p - 1) as PasoLiquidacion);
    }
  }, [paso, onClose]);

  const handleDescartarBorrador = useCallback(async () => {
    if (!userId) return;
    try {
      await borradorWizardService.delete(userId, 'liquidar_recaudadora');
      toastSuccess('Borrador descartado', 'Wizard reseteado');
      setState(INITIAL_STATE);
      setPaso(1);
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : 'Error',
        'No se pudo descartar el borrador',
      );
    }
  }, [userId, toastSuccess, toastError]);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!userId) {
      toastError('Usuario no autenticado', 'Error');
      return;
    }
    setSubmitting(true);
    try {
      const result = await liquidarCajaRecaudadoraService.liquidarSaldo(
        {
          recaudadoraId: state.recaudadoraId,
          fechaInicio: new Date(state.fechaInicio),
          fechaFin: new Date(state.fechaFin),
          fechaLiquidacion: new Date(state.fechaLiquidacion),
          cuentaDestinoId: state.cuentaDestinoId,
          saldoLiquidado: state.saldoLiquidado,
          notas: state.notas || undefined,
        },
        userId,
      );

      // Limpiar borrador al confirmar
      await borradorWizardService.delete(userId, 'liquidar_recaudadora');

      toastSuccess(
        `Liquidación ${result.codigo} · ${result.eventosLiquidadosCount} eventos · saldo ${result.saldoLiquidado.toFixed(2)}`,
        'Liquidación ejecutada',
      );
      onSuccess?.(result.liquidacionId, result.codigo);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toastError(msg, 'No se pudo ejecutar la liquidación');
    } finally {
      setSubmitting(false);
    }
  }, [state, userId, toastSuccess, toastError, onClose, onSuccess]);

  // ── Title & subtitle ──
  const title = useMemo(() => {
    if (state.recaudadoraNombre) return `Liquidar · ${state.recaudadoraNombre}`;
    return 'Liquidar Caja Recaudadora';
  }, [state.recaudadoraNombre]);

  const subtitle = useMemo(
    () => `Paso ${paso} de 3 · ${PASOS_LIQUIDACION_LABEL[paso]}`,
    [paso],
  );

  // ── Render del paso actual ──
  const renderPaso = () => {
    switch (paso) {
      case 1:
        return <Paso1Seleccion state={state} setState={setState} />;
      case 2:
        return <Paso2Revision state={state} setState={setState} />;
      case 3:
        return <Paso3Confirmar state={state} setState={setState} />;
    }
  };

  const footerExtras = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        disabled={submitting}
        className="!gap-1.5"
      >
        <ArrowLeft className="w-3 h-3" />
        {paso === 1 ? 'Cancelar' : 'Atrás'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDescartarBorrador}
        disabled={submitting}
        className="!gap-1.5 text-rose-700 hover:bg-rose-50"
        title="Descartar borrador · F-Borradores"
      >
        <Save className="w-3 h-3" />
        Descartar borrador
      </Button>
    </div>
  );

  const submitLabel =
    paso === 3 ? `Confirmar liquidación · ${state.saldoLiquidado.toFixed(2)}` : 'Continuar';
  const submitIcon = paso === 3 ? Check : ArrowRight;

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleNext}
      title={title}
      subtitle={subtitle}
      icon={Truck}
      iconTone="purple"
      size="md"
      submitLabel={submitLabel}
      submitIcon={submitIcon}
      submitVariant="primary"
      cancelLabel=""
      loading={submitting}
      disabled={!validacion.valido || submitting}
      showShortcuts={true}
      footerExtras={footerExtras}
    >
      <div className="-mx-6 -my-5">
        <Stepper pasoActual={paso} />
        <div className="px-6 py-5">{renderPaso()}</div>
      </div>
    </FormModalV2>
  );
};

export type { LiquidarRecaudadoraState } from './types';
