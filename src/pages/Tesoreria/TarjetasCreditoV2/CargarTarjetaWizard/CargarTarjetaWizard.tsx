/**
 * CargarTarjetaWizard — S58d F3 · TX-1 frontend
 *
 * Wizard de 3 pasos para cargar deudas (OCs / envíos / gastos) a una
 * tarjeta de crédito. Al confirmar, ejecuta `cargoTarjeta.ejecutar()`.
 *
 * Pasos:
 *   1. Tarjeta + Entidad origen (proveedor/colaborador con deudas)
 *   2. Distribución (selección de documentos + montos)
 *   3. Confirmar (descripción · TC auto · ejecutar)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { FormModalV2 } from '../../../../design-system/components/FormModalV2';
import { Button } from '../../../../components/common';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import { cargoTarjetaService } from '../../../../services/cargoTarjeta.service';
import type { CargoTarjetaInput, TarjetaCredito } from '../../../../types/tarjetaCredito.types';
import { Paso1OrigenCargo } from './Paso1OrigenCargo';
import { Paso2Distribucion } from './Paso2Distribucion';
import { Paso3Confirmar } from './Paso3Confirmar';
import {
  INITIAL_STATE,
  PASOS_LABEL,
  validarPaso,
  getTotalCargo,
  type CargarTarjetaState,
  type PasoCargoWizard,
} from './types';
import { cn } from '../../../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface CargarTarjetaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Tarjeta pre-seleccionada (cuando se abre desde una card). */
  tarjetaPreseleccionada?: TarjetaCredito;
  onSuccess?: (cargoId: string) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// STEPPER
// ═════════════════════════════════════════════════════════════════════════

const Stepper: React.FC<{ pasoActual: PasoCargoWizard }> = ({
  pasoActual,
}) => {
  const pasos: PasoCargoWizard[] = [1, 2, 3];
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
                    active && 'bg-amber-500 text-white',
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
                    p < pasoActual ? 'bg-amber-300' : 'bg-slate-300',
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

export const CargarTarjetaWizard: React.FC<CargarTarjetaWizardProps> = ({
  isOpen,
  onClose,
  tarjetaPreseleccionada,
  onSuccess,
}) => {
  const userId = useAuthStore((s) => s.user?.uid ?? '');
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  const [paso, setPaso] = useState<PasoCargoWizard>(1);
  const [state, setState] = useState<CargarTarjetaState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);

  // ── Reset al abrir + tarjeta preseleccionada ──
  useEffect(() => {
    if (isOpen) {
      setPaso(1);
      setState({
        ...INITIAL_STATE,
        fecha: new Date(),
        ...(tarjetaPreseleccionada
          ? {
              tarjeta: tarjetaPreseleccionada,
              monedaCargo: tarjetaPreseleccionada.moneda,
            }
          : {}),
      });
      setLoading(false);
    }
  }, [isOpen, tarjetaPreseleccionada]);

  // ── Validación del paso actual ──
  const validacion = useMemo(() => validarPaso(paso, state), [paso, state]);

  // ── Navegación ──
  const handleNext = useCallback(() => {
    if (!validacion.valido) {
      toastError(validacion.errores.join(' · '), 'Revisa los datos');
      return;
    }
    if (paso < 3) {
      setPaso((p) => (p + 1) as PasoCargoWizard);
    } else {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, validacion, toastError]);

  const handleBack = useCallback(() => {
    if (paso === 1) {
      onClose();
    } else {
      setPaso((p) => (p - 1) as PasoCargoWizard);
    }
  }, [paso, onClose]);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!state.tarjeta) return;
    setLoading(true);
    try {
      const total = getTotalCargo(state);
      const input: CargoTarjetaInput = {
        tarjetaCreditoId: state.tarjeta.id,
        fecha: state.fecha,
        descripcion: state.descripcion.trim(),
        moneda: state.monedaCargo,
        monto: total,
        tcDelDia: state.tcDelDia,
        fuenteTcDelDia: state.fuenteTcDelDia,
        documentosCancelados: state.distribucion.map((d) => ({
          tipo: d.tipo as 'oc' | 'envio' | 'gasto',
          documentoId: d.documentoId,
          documentoNumero: d.documentoNumero,
          montoAplicado: d.montoAplicado,
          monedaDocumento: state.monedaCargo,
        })),
      };
      if (state.fuenteTcDelDia === 'manual' && state.motivoOverrideTc.trim()) {
        input.motivoOverrideTc = state.motivoOverrideTc.trim();
      }

      const result = await cargoTarjetaService.ejecutar(input, userId);

      if (result.errores.length > 0) {
        toastError(
          `Cargo registrado · ${result.errores.length} errores parciales`,
          'Cargo con errores',
        );
      } else {
        toastSuccess(
          `Cargo ${result.numeroCargo} · ${state.monedaCargo} ${total.toFixed(2)} → ${state.distribucion.length} documento${state.distribucion.length !== 1 ? 's' : ''}`,
          'Cargo a tarjeta registrado',
        );
      }
      onSuccess?.(result.cargoId);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toastError(msg, 'No se pudo cargar a la tarjeta');
    } finally {
      setLoading(false);
    }
  }, [state, userId, toastSuccess, toastError, onClose, onSuccess]);

  // ── Title & subtitle ──
  const title = useMemo(() => {
    if (paso === 1 || !state.tarjeta) return 'Cargar a tarjeta de crédito';
    if (paso === 3) {
      const total = getTotalCargo(state);
      return `Cargar ${state.monedaCargo} ${total.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `Cargar a ${state.tarjeta.nombre}`;
  }, [paso, state]);

  const subtitle = useMemo(() => {
    if (state.tarjeta) {
      return `${state.tarjeta.banco} ····${state.tarjeta.ultimosDigitos} · Paso ${paso} de 3`;
    }
    return `Paso ${paso} de 3 · TX-1 atómica`;
  }, [paso, state.tarjeta]);

  // ── Render del paso actual ──
  const renderPaso = () => {
    switch (paso) {
      case 1:
        return <Paso1OrigenCargo state={state} setState={setState} />;
      case 2:
        return <Paso2Distribucion state={state} setState={setState} />;
      case 3:
        return <Paso3Confirmar state={state} setState={setState} />;
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

  const submitLabel = paso === 3 ? 'Registrar cargo' : 'Continuar';
  const submitIcon = paso === 3 ? Check : ArrowRight;

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleNext}
      title={title}
      subtitle={subtitle}
      icon={CreditCard}
      iconTone="amber"
      size={paso === 2 ? 'lg' : 'md'}
      submitLabel={submitLabel}
      submitIcon={submitIcon}
      submitVariant={paso === 3 ? 'primary' : 'primary-soft'}
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
