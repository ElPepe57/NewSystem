/**
 * PagarEstadoCuentaWizard — S58d F4 · TX-2 frontend
 *
 * Wizard de 3 pasos para pagar el estado de cuenta de una TC. Tone visual
 * cambia según el modo:
 *   - banco_emisor → amber (consistente con cargo)
 *   - reembolso_titular → sky (señala al titular como destino)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToastStore } from '../../../../../store/toastStore';
import { useAuthStore } from '../../../../../store/authStore';
import { pagoEstadoCuentaTarjetaService } from '../../../../../services/pagoEstadoCuentaTarjeta.service';
import type {
  PagoEstadoCuentaTarjetaInput,
  TarjetaCredito,
} from '../../../../../types/tarjetaCredito.types';
import { Paso1CargosSeleccion } from './Paso1CargosSeleccion';
import { Paso2CuentaPago } from './Paso2CuentaPago';
import { Paso3ConfirmarPago } from './Paso3ConfirmarPago';
import {
  INITIAL_STATE,
  validarPaso,
  getMontoTotal,
  type PagarEstadoCuentaState,
  type PasoPagoWizard,
} from './types';
import { WizardShellStepper } from '../shells/WizardShellStepper';

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

// Stepper horizontal interno legacy · removido chk5.D-S4.b.SF4 (2026-05-16).
// Reemplazado por WizardShellStepper canon MOCK 3 §4 con tonos dual amber/sky
// (banco_emisor / reembolso_titular).

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

  const submitLabel = useMemo(() => {
    if (paso !== 3) return 'Siguiente';
    return state.modo === 'reembolso_titular'
      ? 'Reembolsar a titular'
      : 'Pagar al banco';
  }, [paso, state.modo]);

  // ── Build pasos canon WizardShellStepper ──
  const pasosShell = ([1, 2, 3] as PasoPagoWizard[]).map((p) => ({
    numero: p,
    label: p === 1 ? 'Cargos · Selección' : p === 2 ? 'Cuenta de pago' : 'Confirmar',
    completado: p < paso,
    actual: p === paso,
  }));

  // ── Tono dinámico según modo ──
  const tonoCanon: 'amber' | 'sky' =
    state.modo === 'reembolso_titular' ? 'sky' : 'amber';

  return (
    <WizardShellStepper
      isOpen={isOpen}
      onClose={onClose}
      onAtras={paso > 1 ? handleBack : undefined}
      onSiguiente={handleNext}
      onSubmit={handleSubmit}
      tono={tonoCanon}
      titulo={title}
      subtitulo={subtitle}
      pasos={pasosShell}
      siguienteLabel={submitLabel}
      siguienteEsSubmit={paso === 3}
      siguienteDisabled={!validacion.valido}
      loading={loading}
      size="lg"
    >
      {renderPaso()}
    </WizardShellStepper>
  );
};
