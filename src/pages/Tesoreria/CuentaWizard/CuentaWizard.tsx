/**
 * CuentaWizard — S58c v2 · Wizard de creación de cuenta bancaria
 *
 * Reemplaza al CuentaBancoForm flat por un wizard banking-grade de 4 pasos
 * según el mockup `cuenta-bancaria-full-s58c.html`.
 *
 * Pasos:
 *   1. Tipo + producto financiero
 *   2. Identidad bancaria (+ titular si personal)
 *   3. Moneda + saldo del negocio
 *   4. Métodos + canales digitales
 *
 * Decisiones aplicadas:
 *   - D-S58-17: Billeteras 2 categorías (canalesDigitales vs productos digitales)
 *   - D-S58-18: Saldo "del negocio" (no del banco), default 0
 *   - D-S58-20: Titularidad extendida a 4 tipos
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { Button } from '../../../components/common';
import { useToastStore } from '../../../store/toastStore';
import { useAuthStore } from '../../../store/authStore';
import { tesoreriaService } from '../../../services/tesoreria.service';
import type { CuentaCajaFormData } from '../../../types/tesoreria.types';
import { cn } from '../../../design-system/utils';
import { Paso1TipoProducto } from './Paso1TipoProducto';
import { Paso2Identidad } from './Paso2Identidad';
import { Paso3Saldo } from './Paso3Saldo';
import { Paso4MetodosCanales } from './Paso4MetodosCanales';
import {
  INITIAL_STATE,
  PASOS_LABEL,
  validarPaso,
  mapStateToFormData,
  type CuentaWizardState,
  type PasoCuentaWizard,
} from './types';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface CuentaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Callback opcional para delegar la creación al padre. Útil para reusar
   * el handler centralizado del padre (toast + refresh). Si NO se provee,
   * el wizard llama al service directo y muestra su propio toast.
   */
  onGuardar?: (data: CuentaCajaFormData) => Promise<void> | void;
  /** Callback al crear exitosamente (cuando NO hay onGuardar). */
  onSuccess?: (cuentaId: string) => void;
  /** Indicador de submit del padre (cuando hay onGuardar). */
  isSubmitting?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// STEPPER
// ═════════════════════════════════════════════════════════════════════════

const Stepper: React.FC<{ pasoActual: PasoCuentaWizard }> = ({ pasoActual }) => {
  const pasos: PasoCuentaWizard[] = [1, 2, 3, 4];
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
                    active && 'bg-teal-600 text-white',
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
                  {PASOS_LABEL[p]}
                </span>
              </div>
              {i < pasos.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-px mx-1',
                    p < pasoActual ? 'bg-teal-300' : 'bg-slate-300',
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

export const CuentaWizard: React.FC<CuentaWizardProps> = ({
  isOpen,
  onClose,
  onGuardar,
  onSuccess,
  isSubmitting,
}) => {
  const userId = useAuthStore((s) => s.user?.uid ?? '');
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  const [paso, setPaso] = useState<PasoCuentaWizard>(1);
  const [state, setState] = useState<CuentaWizardState>(INITIAL_STATE);
  const [internalLoading, setInternalLoading] = useState(false);

  // Loading combinado: estado del wizard o del padre
  const loading = internalLoading || !!isSubmitting;

  // ── Reset al abrir ──
  useEffect(() => {
    if (isOpen) {
      setPaso(1);
      setState(INITIAL_STATE);
      setInternalLoading(false);
    }
  }, [isOpen]);

  // ── Validación del paso actual ──
  const validacion = useMemo(() => validarPaso(paso, state), [paso, state]);

  // ── Navegación ──
  const handleNext = useCallback(() => {
    if (!validacion.valido) {
      toastError(validacion.errores.join(' · '), 'Revisa los datos');
      return;
    }
    if (paso < 4) {
      setPaso((p) => (p + 1) as PasoCuentaWizard);
    } else {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, validacion, toastError]);

  const handleBack = useCallback(() => {
    if (paso === 1) {
      onClose();
    } else {
      setPaso((p) => (p - 1) as PasoCuentaWizard);
    }
  }, [paso, onClose]);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    const formData = mapStateToFormData(state);

    // Camino 1: si hay onGuardar, delegamos al padre (que maneja toast + refresh)
    if (onGuardar) {
      try {
        await onGuardar(formData);
        onClose();
      } catch {
        // El padre se encarga de su propio error toast
      }
      return;
    }

    // Camino 2: self-contained — wizard llama al service directo
    setInternalLoading(true);
    try {
      const cuentaId = await tesoreriaService.crearCuenta(formData, userId);
      toastSuccess(
        `Cuenta "${formData.nombre}" creada${
          formData.titularidad === 'personal' && formData.titularNombre
            ? ` · titular: ${formData.titularNombre}`
            : ''
        }`,
        'Cuenta creada',
      );
      onSuccess?.(cuentaId);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toastError(msg, 'No se pudo crear la cuenta');
    } finally {
      setInternalLoading(false);
    }
  }, [state, userId, toastSuccess, toastError, onClose, onGuardar, onSuccess]);

  // ── Title & subtitle dinámicos ──
  const title = useMemo(() => {
    if (paso === 1) return 'Nueva cuenta bancaria';
    if (state.nombre) return state.nombre;
    return 'Nueva cuenta bancaria';
  }, [paso, state.nombre]);

  const subtitle = useMemo(() => {
    const tipoLabel =
      state.tipo === 'banco'
        ? 'Banco'
        : state.tipo === 'digital'
          ? 'Digital'
          : state.tipo === 'efectivo'
            ? 'Caja efectivo'
            : 'Crédito';
    return `${tipoLabel} · Paso ${paso} de 4`;
  }, [paso, state.tipo]);

  // ── Render del paso actual ──
  const renderPaso = () => {
    switch (paso) {
      case 1:
        return <Paso1TipoProducto state={state} setState={setState} />;
      case 2:
        return <Paso2Identidad state={state} setState={setState} />;
      case 3:
        return <Paso3Saldo state={state} setState={setState} />;
      case 4:
        return <Paso4MetodosCanales state={state} setState={setState} />;
    }
  };

  const footerExtras = (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      disabled={loading}
      className="!gap-1.5"
    >
      <ArrowLeft className="w-3 h-3" />
      {paso === 1 ? 'Cancelar' : 'Atrás'}
    </Button>
  );

  const submitLabel = paso === 4 ? 'Crear cuenta' : 'Continuar';
  const submitIcon = paso === 4 ? Check : ArrowRight;

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleNext}
      title={title}
      subtitle={subtitle}
      icon={Building2}
      iconTone="teal"
      size="md"
      submitLabel={submitLabel}
      submitIcon={submitIcon}
      submitVariant={paso === 4 ? 'primary' : 'primary-soft'}
      cancelLabel=""
      loading={loading}
      disabled={!validacion.valido || loading}
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

export type { CuentaWizardState } from './types';
