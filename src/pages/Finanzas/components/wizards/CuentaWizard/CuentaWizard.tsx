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
import { FormModalV2 } from '../../../../../design-system/components/FormModalV2';
import { Button } from '../../../../../components/common';
import { useToastStore } from '../../../../../store/toastStore';
import { useAuthStore } from '../../../../../store/authStore';
import { tesoreriaService } from '../../../../../services/tesoreria.service';
import {
  crearProductoFinanciero,
  actualizarProductoFinanciero,
  getProductoFinanciero,
} from '../../../../../services/productoFinanciero.service';
import { findOrCreateRelacionBancaria } from '../../../../../services/relacionBancaria.service';
import type {
  CuentaCajaFormData,
  CuentaCaja,
} from '../../../../../types/tesoreria.types';
import { requiereRelacionBancaria } from '../../../../../types/productoFinanciero.types';
import { cn } from '../../../../../design-system/utils';
import { Paso1TipoProducto } from './Paso1TipoProducto';
import { Paso2Identidad } from './Paso2Identidad';
import { Paso3Saldo } from './Paso3Saldo';
import { Paso4MetodosCanales } from './Paso4MetodosCanales';
// chk5.D-S1f · F4 · pasos dedicados Caja Recaudadora (D5 + D12)
import { CajaRecaudadoraPaso2DatosTercero } from './CajaRecaudadoraPaso2DatosTercero';
import { CajaRecaudadoraPaso3LiquidacionConfig } from './CajaRecaudadoraPaso3LiquidacionConfig';
import { CajaRecaudadoraPaso4CanalesAceptados } from './CajaRecaudadoraPaso4CanalesAceptados';
import {
  INITIAL_STATE,
  PASOS_LABEL,
  validarPaso,
  mapStateToFormData,
  mapStateToProductoFinancieroFormData,
  hidratarStateDesdeCuenta,
  hidratarStateDesdeProductoFinanciero,
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
   * Si está presente, modo EDICIÓN: el wizard se hidrata con los datos de
   * esta cuenta y al guardar dispara `onGuardar(data, cuentaEditar)`.
   * Si NO está presente, modo CREACIÓN: dispara `onGuardar(data)`.
   */
  cuentaEditar?: CuentaCaja | null;
  /**
   * Callback para delegar la persistencia al padre.
   * Recibe `cuentaEditar` también cuando el wizard está en modo edición —
   * esto permite al padre saber qué cuenta actualizar y reutilizar handlers
   * centralizados (toast + refresh) sin que el wizard tenga que llamar al
   * service directamente.
   */
  onGuardar?: (
    data: CuentaCajaFormData,
    cuentaEditar?: CuentaCaja | null,
  ) => Promise<void> | void;
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
  cuentaEditar,
  onGuardar,
  onSuccess,
  isSubmitting,
}) => {
  const userId = useAuthStore((s) => s.user?.uid ?? '');
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  const modoEdicion = !!cuentaEditar;

  const [paso, setPaso] = useState<PasoCuentaWizard>(1);
  const [state, setState] = useState<CuentaWizardState>(INITIAL_STATE);
  const [internalLoading, setInternalLoading] = useState(false);

  // Loading combinado: estado del wizard o del padre
  const loading = internalLoading || !!isSubmitting;

  // ── Reset al abrir / hidratar si es edición ──
  // F3c.6 · si la cuenta a editar es nativa (existe en productosFinancieros)
  // hidratamos con campos del modelo nuevo (incluyendo TC). Si es legacy,
  // hidratamos desde el shape CuentaCaja.
  useEffect(() => {
    if (!isOpen) return;
    setPaso(1);
    setInternalLoading(false);

    if (!cuentaEditar) {
      setState(INITIAL_STATE);
      return;
    }

    // Hidratación legacy primero (síncrona, mejor UX)
    setState(hidratarStateDesdeCuenta(cuentaEditar));

    // Después intentar mejorar con datos nativos del modelo nuevo
    void getProductoFinanciero(cuentaEditar.id).then((pf) => {
      if (pf) {
        setState(hidratarStateDesdeProductoFinanciero(pf));
      }
    });
  }, [isOpen, cuentaEditar]);

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
        await onGuardar(formData, cuentaEditar);
        onClose();
      } catch {
        // El padre se encarga de su propio error toast
      }
      return;
    }

    // Camino 2: self-contained — wizard llama al service directo
    setInternalLoading(true);
    try {
      if (modoEdicion && cuentaEditar) {
        // F3c.6 · EDICIÓN INTELIGENTE
        // Detecta si el producto vive en productosFinancieros (nativo) o
        // en cuentasCaja (legacy) y actualiza en la colección correcta.
        const pfExistente = await getProductoFinanciero(cuentaEditar.id);
        if (pfExistente) {
          // Nativo · modelo nuevo → actualizarProductoFinanciero
          const pfData = mapStateToProductoFinancieroFormData(state);
          await actualizarProductoFinanciero(cuentaEditar.id, pfData, userId);
        } else {
          // Legacy · cuentasCaja → flujo viejo
          await tesoreriaService.actualizarCuenta(
            cuentaEditar.id,
            formData,
            userId,
          );
        }
        toastSuccess(
          `Cuenta "${formData.nombre}" actualizada`,
          'Cambios guardados',
        );
        onSuccess?.(cuentaEditar.id);
      } else {
        // CREACIÓN: persiste al modelo NUEVO (F3b · ADR-PF-001).
        // Si requiere RelacionBancaria (cuenta_corriente / ahorros / TC / TD),
        // primero findOrCreate la relación, luego crea el producto.
        const pfData = mapStateToProductoFinancieroFormData(state);

        if (requiereRelacionBancaria(pfData.tipoProducto) && pfData.banco) {
          const { id: relacionId } = await findOrCreateRelacionBancaria(
            {
              banco: pfData.banco,
              bancoNombreCompleto: pfData.bancoNombreCompleto ?? pfData.banco,
              titularidad: pfData.titularidad,
              titularEntidadId: pfData.titularEntidadId,
              titularEntidadTipo: pfData.titularEntidadTipo,
              titularNombre: pfData.titularNombre,
            },
            userId,
          );
          pfData.relacionBancariaId = relacionId;
        }

        const productoId = await crearProductoFinanciero(pfData, userId);
        toastSuccess(
          `Producto "${pfData.nombre}" creado${
            pfData.titularidad === 'personal' && pfData.titularNombre
              ? ` · titular: ${pfData.titularNombre}`
              : ''
          }`,
          'Producto creado',
        );
        onSuccess?.(productoId);
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toastError(
        msg,
        modoEdicion ? 'No se pudo actualizar la cuenta' : 'No se pudo crear el producto',
      );
    } finally {
      setInternalLoading(false);
    }
  }, [
    state,
    userId,
    toastSuccess,
    toastError,
    onClose,
    onGuardar,
    onSuccess,
    cuentaEditar,
    modoEdicion,
  ]);

  // ── Title & subtitle dinámicos ──
  const title = useMemo(() => {
    if (modoEdicion) {
      return state.nombre || cuentaEditar?.nombre || 'Editar cuenta';
    }
    if (paso === 1) return 'Nueva cuenta bancaria';
    if (state.nombre) return state.nombre;
    return 'Nueva cuenta bancaria';
  }, [paso, state.nombre, modoEdicion, cuentaEditar]);

  const subtitle = useMemo(() => {
    const tipoLabel =
      state.tipo === 'banco'
        ? 'Banco'
        : state.tipo === 'digital'
          ? 'Digital'
          : state.tipo === 'efectivo'
            ? 'Caja efectivo'
            : state.tipo === 'credito'
              ? 'Crédito'
              : 'Caja recaudadora'; // chk5.D-S1f · F4
    const accion = modoEdicion ? 'Editando' : 'Paso';
    return `${tipoLabel} · ${accion} ${paso} de 4`;
  }, [paso, state.tipo, modoEdicion]);

  // ── Render del paso actual ──
  // chk5.D-S1f · F4 · ramificar según tipo='recaudadora' a pasos dedicados
  const esRecaudadora = state.tipo === 'recaudadora';
  const renderPaso = () => {
    switch (paso) {
      case 1:
        return <Paso1TipoProducto state={state} setState={setState} />;
      case 2:
        return esRecaudadora ? (
          <CajaRecaudadoraPaso2DatosTercero state={state} setState={setState} />
        ) : (
          <Paso2Identidad state={state} setState={setState} />
        );
      case 3:
        return esRecaudadora ? (
          <CajaRecaudadoraPaso3LiquidacionConfig state={state} setState={setState} />
        ) : (
          <Paso3Saldo state={state} setState={setState} />
        );
      case 4:
        return esRecaudadora ? (
          <CajaRecaudadoraPaso4CanalesAceptados state={state} setState={setState} />
        ) : (
          <Paso4MetodosCanales state={state} setState={setState} />
        );
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

  const submitLabel =
    paso === 4 ? (modoEdicion ? 'Guardar cambios' : 'Crear cuenta') : 'Continuar';
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
