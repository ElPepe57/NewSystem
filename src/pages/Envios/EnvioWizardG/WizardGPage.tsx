/**
 * WizardGPage — Contenedor del Wizard G (Retorno físico devolución).
 *
 * 3 pasos: Devolución → Destino+Detalles → Confirmar.
 * Ruta: /envios/nuevo-g (protegido por feature flag WIZARD_G).
 */
import React, { useReducer, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { WizardShell, DraftBanner, ConfirmarSalidaWizardModal, formatFechaRelativa } from '../../../design-system';
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

import { EnvioT2WizardPreview } from '../legacy-shared';
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
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const esModal = variant === 'modal';

  const autosave = useWizardAutosave<typeof state>({
    tipo: 'envio-g',
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
    // FIX "banner pegado": sin devolución seleccionada → wizard vacío → no autoguardar draft fantasma.
    isEmpty: (s) => !s.devolucionId,
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
      origenPais: undefined,
      origenNombre: state.devolucionSnapshot?.clienteNombre || 'Cliente',
      origenSubtexto: state.devolucionSnapshot?.numeroDevolucion || 'Devolución',
      destinoPais: 'Peru',
      destinoNombre: state.almacenDestinoNombre || 'Almacén Perú',
      destinoSubtexto: 'Recepción + revisión',
      transporteIcono: <RefreshCw className="w-3.5 h-3.5 text-slate-500" />,
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

  const cerrar = () => {
    if (onCancel) return onCancel();
    navigate('/envios');
  };

  // Confirm de salida (canon borrador+descartar · paridad con el wizard unificado)
  const hayCambios = !!state.devolucionId;
  const handleCancel = () => {
    if (hayCambios) { setShowExitConfirm(true); return; }
    cerrar();
  };
  const handleGuardarBorradorYSalir = async () => {
    await autosave.forceSave();
    setShowExitConfirm(false);
    cerrar();
  };
  const handleDescartarYSalir = async () => {
    await autosave.descartarBorrador();
    setShowExitConfirm(false);
    cerrar();
  };
  const resumenExit = state.devolucionSnapshot
    ? `${state.devolucionSnapshot.numeroDevolucion} · ${state.devolucionSnapshot.clienteNombre}${
        selectUnidadesCount(state) > 0 ? ` · ${selectUnidadesCount(state)} uds` : ''
      }`
    : undefined;

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
    ? formatFechaRelativa(autosave.borradorExistente.fechaActualizacion)
    : undefined;

  const bannerJsx = autosave.borradorExistente && !autosave.loadingBorrador ? (
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
  ) : null;

  const errorJsx = error ? (
    <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0">
        <AlertTriangle className="w-4 h-4" />
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
        <X className="w-4 h-4" />
      </button>
    </div>
  ) : null;

  const shellJsx = (
    <WizardShell
      title="Nuevo retorno físico — Cliente → Almacén Perú"
      subtitle="Registra el movimiento físico de una devolución existente (Caso G · D-7 unidades en revisión)"
      accent="orange"
      steps={STEPS}
      currentStep={state.pasoActual}
      onStepChange={(i) => dispatch({ type: 'GO_TO_STEP', paso: i })}
      onNext={() => dispatch({ type: 'NEXT_STEP' })}
      onPrev={() => dispatch({ type: 'PREV_STEP' })}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      confirmLabel={creating ? 'Creando retorno…' : 'Crear retorno físico'}
      nextDisabled={!canProceed || creating}
      nextHint={nextHint}
      loading={creating}
      variant="page"
      className={esModal ? 'h-full' : undefined}
      previewPanel={<EnvioT2WizardPreview {...previewProps} />}
    >
      {renderStep()}
    </WizardShell>
  );

  const exitModal = (
    <ConfirmarSalidaWizardModal
      isOpen={showExitConfirm}
      resumen={resumenExit}
      pasoActual={`Paso ${state.pasoActual + 1} de 3`}
      contextoSingular="este retorno"
      onGuardarBorrador={handleGuardarBorradorYSalir}
      onDescartar={handleDescartarYSalir}
      onSeguirEditando={() => setShowExitConfirm(false)}
    />
  );

  // Modal (canon · abierto desde el hub) o página (ruta legacy /envios/nuevo-g)
  if (esModal) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6 md:p-8 flex flex-col">
          {(bannerJsx || errorJsx) && (
            <div className="w-full max-w-7xl mx-auto flex-shrink-0">{bannerJsx}{errorJsx}</div>
          )}
          <div className="w-full max-w-7xl mx-auto flex-1 min-h-0">{shellJsx}</div>
        </div>
        {exitModal}
      </>
    );
  }

  return (
    <>
      {bannerJsx}
      {errorJsx}
      {shellJsx}
      {exitModal}
    </>
  );
};
