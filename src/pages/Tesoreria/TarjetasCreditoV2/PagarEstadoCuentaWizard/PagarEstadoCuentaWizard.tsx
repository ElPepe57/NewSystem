/**
 * PagarEstadoCuentaWizard — S58d F4 · TX-2 frontend
 *
 * Wizard de 3 pasos para pagar el estado de cuenta de una TC. Tone visual
 * cambia según el modo:
 *   - banco_emisor → amber (consistente con cargo)
 *   - reembolso_titular → sky (señala al titular como destino)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HandCoins,
  Check,
  ArrowRight,
  ArrowLeft,
  Building,
  IdCard,
} from 'lucide-react';
import { FormModalV2 } from '../../../../design-system/components/FormModalV2';
import { Button } from '../../../../components/common';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import { pagoEstadoCuentaTarjetaService } from '../../../../services/pagoEstadoCuentaTarjeta.service';
import type {
  PagoEstadoCuentaTarjetaInput,
  TarjetaCredito,
} from '../../../../types/tarjetaCredito.types';
import { Paso1CargosSeleccion } from './Paso1CargosSeleccion';
import { Paso2CuentaPago } from './Paso2CuentaPago';
import { Paso3ConfirmarPago } from './Paso3ConfirmarPago';
import {
  INITIAL_STATE,
  PASOS_LABEL,
  validarPaso,
  getMontoTotal,
  type PagarEstadoCuentaState,
  type PasoPagoWizard,
} from './types';
import { cn } from '../../../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface PagarEstadoCuentaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Tarjeta pre-seleccionada (cuando se abre desde una card). */
  tarjetaPreseleccionada?: TarjetaCredito;
  onSuccess?: (pagoId: string) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// STEPPER
// ═════════════════════════════════════════════════════════════════════════

const Stepper: React.FC<{
  pasoActual: PasoPagoWizard;
  modo: 'banco_emisor' | 'reembolso_titular';
}> = ({ pasoActual, modo }) => {
  const pasos: PasoPagoWizard[] = [1, 2, 3];
  const activeColor = modo === 'banco_emisor' ? 'amber' : 'sky';
  const completedColor = 'emerald';

  const colorClasses: Record<string, string> = {
    amber: 'bg-amber-500',
    sky: 'bg-sky-500',
    emerald: 'bg-emerald-500',
  };
  const lineColor: Record<string, string> = {
    amber: 'bg-amber-300',
    sky: 'bg-sky-300',
  };

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
                    completed && `${colorClasses[completedColor]} text-white`,
                    active && `${colorClasses[activeColor]} text-white`,
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
                    p < pasoActual ? lineColor[activeColor] : 'bg-slate-300',
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

export const PagarEstadoCuentaWizard: React.FC<
  PagarEstadoCuentaWizardProps
> = ({ isOpen, onClose, tarjetaPreseleccionada, onSuccess }) => {
  const userId = useAuthStore((s) => s.user?.uid ?? '');
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  const [paso, setPaso] = useState<PasoPagoWizard>(1);
  const [state, setState] = useState<PagarEstadoCuentaState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);

  // ── Reset al abrir + tarjeta preseleccionada ──
  useEffect(() => {
    if (isOpen) {
      setPaso(1);
      const inferModo = (t: TarjetaCredito) =>
        t.titularidad === 'personal' ? 'reembolso_titular' : 'banco_emisor';
      setState({
        ...INITIAL_STATE,
        fecha: new Date(),
        ...(tarjetaPreseleccionada
          ? {
              tarjeta: tarjetaPreseleccionada,
              modo: inferModo(tarjetaPreseleccionada),
              monedaPago: tarjetaPreseleccionada.moneda,
            }
          : {}),
      });
      setLoading(false);
    }
  }, [isOpen, tarjetaPreseleccionada]);

  const validacion = useMemo(() => validarPaso(paso, state), [paso, state]);

  // ── Navegación ──
  const handleNext = useCallback(() => {
    if (!validacion.valido) {
      toastError(validacion.errores.join(' · '), 'Revisa los datos');
      return;
    }
    if (paso < 3) {
      setPaso((p) => (p + 1) as PasoPagoWizard);
    } else {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, validacion, toastError]);

  const handleBack = useCallback(() => {
    if (paso === 1) onClose();
    else setPaso((p) => (p - 1) as PasoPagoWizard);
  }, [paso, onClose]);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!state.tarjeta) return;
    setLoading(true);
    try {
      const total = getMontoTotal(state);
      const input: PagoEstadoCuentaTarjetaInput = {
        tarjetaCreditoId: state.tarjeta.id,
        modo: state.modo,
        fecha: state.fecha,
        moneda: state.monedaPago,
        monto: total,
        tipoCambio: state.tipoCambio,
        fuenteTipoCambio: state.fuenteTipoCambio,
        cuentaOrigenId: state.cuentaOrigenId,
        metodo: state.metodo,
        aplicaciones: state.aplicaciones,
      };
      if (state.referencia.trim()) input.referencia = state.referencia.trim();
      if (state.notas.trim()) input.notas = state.notas.trim();

      const result = await pagoEstadoCuentaTarjetaService.ejecutar(
        input,
        userId,
      );

      if (result.errores.length > 0) {
        toastError(
          `Pago registrado · ${result.errores.length} errores parciales`,
          'Pago con errores',
        );
      } else {
        const sufijoModo =
          state.modo === 'banco_emisor'
            ? `Δ ${result.diferencialCambiarioPENTotal >= 0 ? '+' : ''}S/ ${result.diferencialCambiarioPENTotal.toFixed(2)}`
            : 'sin diferencial';
        toastSuccess(
          `Pago ${result.numeroPago} · ${state.monedaPago} ${total.toFixed(2)} → ${result.cargosActualizados} cargos · ${sufijoModo}`,
          state.modo === 'banco_emisor'
            ? 'Pago al banco registrado'
            : 'Reembolso al titular registrado',
        );
      }
      onSuccess?.(result.pagoId);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toastError(msg, 'No se pudo procesar el pago');
    } finally {
      setLoading(false);
    }
  }, [state, userId, toastSuccess, toastError, onClose, onSuccess]);

  // ── Title & subtitle dinámicos por modo ──
  const title = useMemo(() => {
    if (paso === 1 || !state.tarjeta) {
      return state.modo === 'reembolso_titular'
        ? 'Reembolsar al titular'
        : 'Pagar al banco emisor';
    }
    if (paso === 3) {
      const total = getMontoTotal(state);
      return state.modo === 'reembolso_titular'
        ? `Reembolsar ${state.monedaPago} ${total.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `Pagar ${state.monedaPago} ${total.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (state.modo === 'reembolso_titular' && state.tarjeta.titularNombre) {
      return `Reembolsar a ${state.tarjeta.titularNombre}`;
    }
    return `Pagar al banco · ${state.tarjeta.banco} ····${state.tarjeta.ultimosDigitos}`;
  }, [paso, state]);

  const subtitle = useMemo(() => {
    if (state.tarjeta) {
      const tipoLabel =
        state.modo === 'reembolso_titular'
          ? 'Personal · sin diferencial cambiario'
          : 'Empresarial · diferencial vs TC del cargo';
      return `${state.tarjeta.nombre} · ${tipoLabel} · Paso ${paso} de 3`;
    }
    return `Paso ${paso} de 3 · TX-2 atómica`;
  }, [paso, state]);

  // ── Render ──
  const renderPaso = () => {
    switch (paso) {
      case 1:
        return <Paso1CargosSeleccion state={state} setState={setState} />;
      case 2:
        return <Paso2CuentaPago state={state} setState={setState} />;
      case 3:
        return <Paso3ConfirmarPago state={state} setState={setState} />;
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

  const submitLabel = useMemo(() => {
    if (paso !== 3) return 'Continuar';
    return state.modo === 'reembolso_titular'
      ? 'Reembolsar a titular'
      : 'Pagar al banco';
  }, [paso, state.modo]);

  // ── Icon dinámico según modo ──
  const headerIcon =
    state.modo === 'reembolso_titular' ? IdCard : Building;
  const headerTone: 'sky' | 'amber' =
    state.modo === 'reembolso_titular' ? 'sky' : 'amber';
  const submitVariant = paso === 3 ? 'primary' : 'primary-soft';

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleNext}
      title={title}
      subtitle={subtitle}
      icon={headerIcon ?? HandCoins}
      iconTone={headerTone}
      size={paso === 1 ? 'lg' : 'md'}
      submitLabel={submitLabel}
      submitIcon={paso === 3 ? Check : ArrowRight}
      submitVariant={submitVariant}
      cancelLabel=""
      loading={loading}
      disabled={!validacion.valido || loading}
      showShortcuts={true}
      footerExtras={footerExtras}
    >
      <div className="-mx-6 -my-5">
        <Stepper pasoActual={paso} modo={state.modo} />
        <div className="px-6 py-5">{renderPaso()}</div>
      </div>
    </FormModalV2>
  );
};
