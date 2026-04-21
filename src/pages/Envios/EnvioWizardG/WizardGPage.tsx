/**
 * WizardGPage — Contenedor del Wizard G (Retorno físico devolución).
 *
 * 3 pasos: Devolución → Destino+Detalles → Confirmar.
 * Ruta: /envios/nuevo-g (protegido por feature flag WIZARD_G).
 */
import React, { useReducer, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardShell, DraftBanner, formatFechaRelativa } from '../../../design-system';
import { useWizardAutosave } from '../../../hooks/useWizardAutosave';
import { useAuthStore } from '../../../store/authStore';
import { envioCrudService } from '../../../services/envio.crud.service';
import type { CrearEnvioGPayload, MetodoProrrateo } from '../../../types/envio.types';

import {
  envioWizardGReducer,
  initialEnvioWizardGState,
  selectUnidadesCount,
  selectProductosCount,
  selectValorDevolucionPEN,
  selectTotalCostosPEN,
  selectUnidadesPayload,
} from './envioWizardGTypes';

import { EnvioT2WizardPreview } from '../EnvioWizardT2';
import { EnvioGStepDevolucion } from './EnvioGStepDevolucion';
import { EnvioGStepDestinoDetalles } from './EnvioGStepDestinoDetalles';
import { EnvioGStepConfirm } from './EnvioGStepConfirm';

const STEPS = [
  { id: 'devolucion', label: 'Devolución' },
  { id: 'destino', label: 'Destino + detalles', optional: true },
  { id: 'confirmar', label: 'Confirmar' },
];

export interface WizardGPageProps {
  onCreated?: (envioId: string) => void;
  onCancel?: () => void;
  variant?: 'page' | 'modal';
}

export const WizardGPage: React.FC<WizardGPageProps> = ({
  onCreated,
  onCancel,
  variant = 'page',
}) => {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.uid);
  const [state, dispatch] = useReducer(envioWizardGReducer, initialEnvioWizardGState);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autosave = useWizardAutosave<typeof state>({
    tipo: 'envio',
    state,
    pasoActual: state.pasoActual,
    buildResumen: () => {
      if (state.devolucionSnapshot) {
        return `Retorno G · ${state.devolucionSnapshot.numeroDevolucion} · ${state.devolucionSnapshot.clienteNombre}${
          selectUnidadesCount(state) > 0 ? ` · ${selectUnidadesCount(state)} uds` : ''
        }`;
      }
      return 'Nuevo retorno físico (Caso G)';
    },
    buildMonto: () => {
      const total = selectTotalCostosPEN(state);
      return total > 0 ? total : undefined;
    },
  });

  const canProceed = useMemo((): boolean => {
    switch (state.pasoActual) {
      case 0:
        return !!state.devolucionId && selectUnidadesCount(state) > 0;
      case 1:
        return !!state.almacenDestinoId;
      case 2:
        return true;
      default:
        return false;
    }
  }, [state]);

  const nextHint = useMemo((): string | undefined => {
    switch (state.pasoActual) {
      case 0:
        if (!state.devolucionId) return 'Selecciona una devolución aprobada o ejecutada';
        if (selectUnidadesCount(state) === 0) return 'Selecciona al menos una unidad a retornar';
        break;
      case 1:
        if (!state.almacenDestinoId) return 'Elige el almacén Perú receptor';
        break;
    }
    return undefined;
  }, [state]);

  const previewProps = useMemo(() => {
    return {
      origenFlag: '🏠',
      origenNombre: state.devolucionSnapshot?.clienteNombre || 'Cliente',
      origenSubtexto: state.devolucionSnapshot?.numeroDevolucion || 'Devolución',
      destinoFlag: '🇵🇪',
      destinoNombre: state.almacenDestinoNombre || 'Almacén Perú',
      destinoSubtexto: 'Recepción + revisión',
      transporteIcono: '🔄',
      colaboradorNombre: state.colaboradorTransporteNombre || undefined,
      unidadesCount: selectUnidadesCount(state),
      productosCount: selectProductosCount(state),
      ocsCount: 0,
      prioritariasCount: 0,
      prioritariasTotales: 0,
      ctruBaseUSD: selectValorDevolucionPEN(state), // Mostrar valor devolución en PEN como ref
      landedUSD: 0,
      tipoCambio: 0,
      autoguardadoLabel: autosave.lastSavedAt
        ? formatFechaRelativa(autosave.lastSavedAt)
        : undefined,
      destacarTotal: state.pasoActual === 2,
    };
  }, [state, autosave.lastSavedAt]);

  const handleCancel = () => {
    if (onCancel) return onCancel();
    navigate('/envios');
  };

  const handleConfirm = async () => {
    if (!userId) {
      setError('Usuario no autenticado');
      return;
    }
    if (!state.devolucionSnapshot) {
      setError('Devolución no seleccionada');
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const unidades = selectUnidadesPayload(state);

      const costosPEN: CrearEnvioGPayload['costosPEN'] = state.costosPEN
        .filter((c) => c.activo && c.montoPEN > 0)
        .map((c) => {
          const metodoProrrateo: MetodoProrrateo =
            c.metodo === 'por_unidad' ? 'fijo_por_unidad' : 'total_por_valor';
          const montoEfectivo =
            c.metodo === 'por_unidad' ? c.montoPEN * selectUnidadesCount(state) : c.montoPEN;
          return {
            categoriaCostoId: c.id,
            categoriaCostoNombre: c.concepto,
            montoPEN: montoEfectivo,
            metodoProrrateo,
          };
        });

      const payload: CrearEnvioGPayload = {
        devolucionId: state.devolucionSnapshot.id,
        devolucionNumero: state.devolucionSnapshot.numeroDevolucion,
        ventaId: state.devolucionSnapshot.ventaId,
        ventaNumero: state.devolucionSnapshot.ventaNumero,
        cliente: {
          id: state.devolucionSnapshot.clienteId,
          nombre: state.devolucionSnapshot.clienteNombre,
        },
        almacenDestinoId: state.almacenDestinoId,
        colaboradorTransporteId: state.colaboradorTransporteId || undefined,
        numeroTracking: state.numeroTracking || undefined,
        notas: state.notas || undefined,
        unidades,
        costosPEN,
      };

      const resultado = await envioCrudService.crearEnvioG(payload, userId);
      autosave.clearDraft();

      if (onCreated) {
        onCreated(resultado.id);
      } else {
        navigate(`/envios?envioId=${resultado.id}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al crear el retorno';
      setError(msg);
      // eslint-disable-next-line no-console
      console.error('[WizardGPage] handleConfirm error:', err);
    } finally {
      setCreating(false);
    }
  };

  const renderStep = () => {
    switch (state.pasoActual) {
      case 0:
        return <EnvioGStepDevolucion state={state} dispatch={dispatch} />;
      case 1:
        return <EnvioGStepDestinoDetalles state={state} dispatch={dispatch} />;
      case 2:
        return <EnvioGStepConfirm state={state} dispatch={dispatch} />;
      default:
        return null;
    }
  };

  const borradorFechaRelativa = autosave.borradorExistente
    ? formatFechaRelativa(
        (autosave.borradorExistente as { fechaActualizacion?: unknown }).fechaActualizacion as any
      )
    : undefined;

  return (
    <>
      {autosave.borradorExistente && !autosave.loadingBorrador && (
        <div className="mb-4">
          <DraftBanner
            show
            descripcion={
              (autosave.borradorExistente as { resumen?: string }).resumen ||
              'Retorno G sin terminar'
            }
            fechaLegible={borradorFechaRelativa}
            pasoActual={`Paso ${
              ((autosave.borradorExistente as { pasoActual?: number }).pasoActual ?? 0) + 1
            } de 3`}
            onContinuar={() => {
              const hidratado = autosave.continuarBorrador();
              if (hidratado) dispatch({ type: 'HYDRATE', state: hidratado });
            }}
            onDescartar={() => {
              autosave.descartarBorrador();
            }}
          />
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0 text-sm">
            ⚠️
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-red-900">No se pudo crear el retorno</div>
            <div className="text-xs text-red-800 mt-0.5">{error}</div>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 flex-shrink-0"
            aria-label="Cerrar error"
          >
            ✕
          </button>
        </div>
      )}

      <WizardShell
        title="Nuevo retorno físico — Cliente → Almacén Perú"
        subtitle="Registra el movimiento físico de una devolución existente (Caso G · D-7 unidades en revisión)"
        steps={STEPS}
        currentStep={state.pasoActual}
        onStepChange={(i) => dispatch({ type: 'GO_TO_STEP', paso: i })}
        onNext={() => dispatch({ type: 'NEXT_STEP' })}
        onPrev={() => dispatch({ type: 'PREV_STEP' })}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        confirmLabel={creating ? 'Creando retorno…' : '✓ Crear retorno físico'}
        nextDisabled={!canProceed || creating}
        nextHint={nextHint}
        loading={creating}
        variant={variant}
        previewPanel={<EnvioT2WizardPreview {...previewProps} />}
      >
        {renderStep()}
      </WizardShell>
    </>
  );
};
