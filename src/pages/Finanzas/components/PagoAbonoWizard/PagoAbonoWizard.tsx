/**
 * PagoAbonoWizard — S58b Fase 2 · Wizard "1 desembolso → N deudas"
 *
 * Orquesta los 4 pasos del flujo de pago con abono distribuido.
 * Reutiliza FormModalV2 (S58 F1) como shell — header banking-grade,
 * footer con atajos, animaciones consistentes.
 *
 * Pasos:
 *   1. Entidad   · combobox de proveedores con saldo en contra
 *   2. Abono     · monto, cuenta, método, fecha, TC (auto)
 *   3. Distribución · estrategias auto + edición manual + balance
 *   4. Confirmar · hero + summary + ejecutar
 *
 * El service `pagoAbonoDistribuidoService.ejecutar()` hace el trabajo
 * atómico (1 mov tesorería + N MovCC + N denorm).
 *
 * Ver mockup: docs/mockups/pago-abono-distribuido-s58.html
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import { pagoAbonoDistribuidoService } from '../../../../services/pagoAbonoDistribuido.service';
import {
  autoDistribuir,
} from '../../../../types/pagoAbonoDistribuido.types';
import type { TipoEntidadCC } from '../../../../types/cuentaCorriente.types';
import { Paso1Entidad } from './Paso1Entidad';
import { Paso2Abono } from './Paso2Abono';
import { Paso3Distribucion } from './Paso3Distribucion';
import { Paso4Confirmar } from './Paso4Confirmar';
import {
  INITIAL_STATE,
  PASOS_LABEL,
  validarPaso,
  type PagoAbonoState,
  type PasoWizard,
} from './types';
import {
  WizardShellSidebar,
  type WizardPasoItem,
  type WizardContextoItem,
} from '../wizards/shells/WizardShellSidebar';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface PagoAbonoWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Entidad pre-seleccionada (entry point desde detalle CC, drawer, etc.). */
  entidadPreseleccionada?: {
    entidadId: string;
    entidadTipo: TipoEntidadCC;
    entidadNombre: string;
    saldoUSD: number;
    saldoPEN: number;
  };
  /** Callback al completar exitosamente. */
  onSuccess?: (movimientoTesoreriaId: string) => void;
}

// Stepper horizontal interno legacy · removido chk5.D-S4.b.SF2 (2026-05-16).
// Reemplazado por sidebar lateral del WizardShellSidebar canon MOCK 3 §3.

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const PagoAbonoWizard: React.FC<PagoAbonoWizardProps> = ({
  isOpen,
  onClose,
  entidadPreseleccionada,
  onSuccess,
}) => {
  const userId = useAuthStore((s) => s.user?.uid ?? '');
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  const [paso, setPaso] = useState<PasoWizard>(1);
  const [state, setState] = useState<PagoAbonoState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);

  // ── Reset al abrir/cerrar ──
  useEffect(() => {
    if (isOpen) {
      setPaso(entidadPreseleccionada ? 2 : 1);
      setState({
        ...INITIAL_STATE,
        fecha: new Date(),
        ...(entidadPreseleccionada
          ? {
              entidad: {
                entidadId: entidadPreseleccionada.entidadId,
                entidadTipo: entidadPreseleccionada.entidadTipo,
                entidadNombre: entidadPreseleccionada.entidadNombre,
                saldoUSD: entidadPreseleccionada.saldoUSD,
                saldoPEN: entidadPreseleccionada.saldoPEN,
              },
            }
          : {}),
      });
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entidadPreseleccionada?.entidadId]);

  // ── Validación del paso actual ──
  const validacion = useMemo(() => validarPaso(paso, state), [paso, state]);

  // ── Auto-distribución cuando cambia monto/estrategia/deudas ──
  useEffect(() => {
    if (paso !== 3) return;
    if (state.estrategia === 'manual') return;
    if (!state.montoAbono || state.deudas.length === 0) return;

    const nuevaDistribucion = autoDistribuir(
      state.deudas.filter((d) => d.moneda === state.monedaAbono),
      state.montoAbono,
      state.estrategia,
    );
    setState((s) => ({ ...s, distribucion: nuevaDistribucion }));
    // Solo se re-aplica al cambiar paso a 3, estrategia, monto o deudas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, state.estrategia, state.montoAbono, state.deudas, state.monedaAbono]);

  // ── Navegación ──
  const handleNext = useCallback(() => {
    if (!validacion.valido) {
      toastError(validacion.errores.join(' · '), 'Revisa los datos');
      return;
    }
    if (paso < 4) {
      setPaso((p) => (p + 1) as PasoWizard);
    } else {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, validacion, toastError]);

  const handleBack = useCallback(() => {
    if (paso === 1) {
      onClose();
    } else {
      setPaso((p) => (p - 1) as PasoWizard);
    }
  }, [paso, onClose]);

  // ── Submit final (Paso 4) ──
  const handleSubmit = useCallback(async () => {
    if (!state.entidad || !state.montoAbono || !state.cuentaId) return;
    setLoading(true);
    try {
      const result = await pagoAbonoDistribuidoService.ejecutar(
        {
          entidadId: state.entidad.entidadId,
          entidadTipo: state.entidad.entidadTipo,
          entidadNombre: state.entidad.entidadNombre,
          montoAbono: state.montoAbono,
          monedaAbono: state.monedaAbono,
          tipoCambio: state.tipoCambio,
          fecha: state.fecha,
          cuentaId: state.cuentaId,
          cuentaNombre: state.cuentaNombre,
          metodo: state.metodo,
          referencia: state.referencia || undefined,
          notas: state.notas || undefined,
          distribucion: state.distribucion,
        },
        userId,
      );

      if (result.errores.length > 0) {
        toastError(
          `Pago parcialmente procesado · ${result.documentosActualizados}/${state.distribucion.length} documentos · Revisar logs`,
          'Pago con errores',
        );
      } else {
        toastSuccess(
          `Pago ${state.monedaAbono} ${state.montoAbono.toFixed(2)} aplicado a ` +
            `${result.documentosActualizados} documento${result.documentosActualizados !== 1 ? 's' : ''}`,
          'Pago registrado',
        );
      }
      onSuccess?.(result.movimientoTesoreriaId);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toastError(msg, 'No se pudo registrar el pago');
    } finally {
      setLoading(false);
    }
  }, [state, userId, toastSuccess, toastError, onClose, onSuccess]);

  // ── Title & subtitle dinámicos ──
  const title = useMemo(() => {
    if (paso === 1) return 'Pago con abono distribuido';
    if (state.entidad) {
      if (paso === 3 && state.montoAbono) {
        return `Distribuir ${state.monedaAbono} ${state.montoAbono.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return `Pago a ${state.entidad.entidadNombre}`;
    }
    return 'Pago con abono distribuido';
  }, [paso, state]);

  const subtitle = useMemo(() => {
    if (paso === 1) return 'Cash flow · 1 desembolso → N deudas';
    if (state.entidad && state.deudas.length > 0) {
      const totalAdeudado = state.deudas.reduce(
        (s, d) => s + d.montoPendiente,
        0,
      );
      return `${state.deudas.length} ${state.deudas.length === 1 ? 'documento' : 'documentos'} · Total adeudado ${state.monedaAbono} ${totalAdeudado.toFixed(2)}`;
    }
    return 'Cash flow · 1 desembolso → N deudas';
  }, [paso, state]);

  // ── Render del paso actual ──
  const renderPaso = () => {
    switch (paso) {
      case 1:
        return <Paso1Entidad state={state} setState={setState} />;
      case 2:
        return <Paso2Abono state={state} setState={setState} />;
      case 3:
        return <Paso3Distribucion state={state} setState={setState} />;
      case 4:
        return <Paso4Confirmar state={state} setState={setState} />;
    }
  };

  // ── Build pasos para WizardShellSidebar ──
  const pasosShell = useMemo<WizardPasoItem[]>(
    () =>
      ([1, 2, 3, 4] as PasoWizard[]).map((p) => ({
        numero: p,
        label: PASOS_LABEL[p],
        completado: p < paso,
        actual: p === paso,
      })),
    [paso],
  );

  // ── Build contexto inferior sidebar ──
  const contextoShell = useMemo<WizardContextoItem[]>(() => {
    const items: WizardContextoItem[] = [];
    if (state.entidad) {
      items.push({ label: 'Entidad', valor: state.entidad.entidadNombre });
    }
    if (state.montoAbono && state.montoAbono > 0) {
      items.push({
        label: 'Monto',
        valor: `${state.monedaAbono === 'USD' ? '$' : 'S/'} ${state.montoAbono.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
      });
    }
    if (state.cuentaNombre) {
      items.push({ label: 'Cuenta', valor: state.cuentaNombre });
    }
    if (state.entidad && state.deudas.length > 0) {
      const total = state.deudas.reduce((s, d) => s + d.montoPendiente, 0);
      items.push({
        label: 'Deuda total',
        valor: `${state.monedaAbono === 'USD' ? '$' : 'S/'} ${total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
        valorColor: 'rose',
      });
    }
    return items;
  }, [state]);

  return (
    <WizardShellSidebar
      isOpen={isOpen}
      onClose={onClose}
      onAtras={paso > 1 ? handleBack : undefined}
      onSiguiente={handleNext}
      onSubmit={handleSubmit}
      tono="purple"
      titulo={title}
      pasos={pasosShell}
      contexto={contextoShell.length > 0 ? contextoShell : undefined}
      topBarLabel={`PASO ${paso} · ${PASOS_LABEL[paso]}`}
      topBarSubtitulo={subtitle}
      siguienteLabel={paso === 4 ? 'Confirmar y ejecutar' : 'Siguiente'}
      siguienteEsSubmit={paso === 4}
      siguienteDisabled={!validacion.valido}
      loading={loading}
    >
      {renderPaso()}
    </WizardShellSidebar>
  );
};

// Re-export types for entry points
export type { PagoAbonoState } from './types';
