import React, { useReducer, useState, useRef } from 'react';
import { WizardShell, DraftBanner, formatFechaRelativa } from '../../../design-system';
import type { WizardStep } from '../../../design-system';
import type { EnvioFormData } from '../../../types/envio.types';
import type { Almacen } from '../../../types/almacen.types';
import type { Producto } from '../../../types/producto.types';
import {
  envioWizardReducer,
  initialEnvioWizardState,
} from './envioWizardTypes';
import type { EnvioWizardAction, EnvioWizardState } from './envioWizardTypes';
import { EnvioStepRuta } from './EnvioStepRuta';
import { EnvioStepProductos } from './EnvioStepProductos';
import { EnvioStepConfirm } from './EnvioStepConfirm';
import { EnvioWizardPreview } from './EnvioWizardPreview';
import { useWizardAutosave } from '../../../hooks/useWizardAutosave';

// ════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════

interface EnvioWizardV2Props {
  isOpen: boolean;
  loading?: boolean;
  casillasOrigen: Almacen[];      // casillas en origen (USA/CN/etc)
  casillasDestinoPeru: Almacen[]; // casillas/almacenes en Perú
  colaboradores: Almacen[];       // viajeros/couriers disponibles
  productosMap: Map<string, Producto>;
  onClose: () => void;
  onSubmit: (data: EnvioFormData) => Promise<void>;
}

const STEPS: WizardStep[] = [
  { id: 'ruta', label: 'Ruta', description: 'Origen, destino y colaborador' },
  { id: 'productos', label: 'Productos', description: 'Unidades disponibles' },
  { id: 'confirmar', label: 'Confirmar', description: 'Tracking y despacho' },
];

// ════════════════════════════════════════════════════════════════════════════
// Validation
// ════════════════════════════════════════════════════════════════════════════

function isStepValid(
  stepIndex: number,
  state: ReturnType<typeof envioWizardReducer>
): boolean {
  switch (stepIndex) {
    case 0:
      // Ruta: tipo + origen + destino obligatorios; colaborador opcional (ESPEC §3.3)
      return !!state.tipoRuta && !!state.origenCasillaId && !!state.destinoCasillaId;
    case 1:
      // Productos: al menos 1 unidad seleccionada
      return state.unidadesIdsSeleccionadas.length > 0;
    case 2:
      // Confirmar: siempre válido (tracking/courier/notas son opcionales)
      return true;
    default:
      return true;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// EnvioWizardV2 — Main export
// ════════════════════════════════════════════════════════════════════════════

/**
 * EnvioWizardV2 — Wizard de creación manual de envíos (rework S41).
 *
 * OPCIÓN A del ESPEC §3.1 — restricciones:
 * - Solo permite crear envíos tipo `interna_origen`:
 *   · Entre casillas origen (Angie USA → Jose USA)
 *   · Casilla origen → Perú (CN → Lima)
 * - NO permite crear `internacional_peru` manualmente (siempre nace automático de OC)
 * - Colaborador opcional ("Sin asignar, decidir después")
 * - NO captura fechas de salida/llegada, peso, lote, vencimiento
 *   (esos datos van en recepción, no en despacho)
 *
 * Reemplaza el CreateEnvioModal actual con UX modernizada usando:
 * - WizardShell del DS con preview panel lateral
 * - EntityPicker para selección de casillas/colaborador (via casillas pasadas como prop)
 * - ProductoDisplay para listar productos/unidades disponibles
 */
export const EnvioWizardV2: React.FC<EnvioWizardV2Props> = ({
  isOpen,
  loading = false,
  casillasOrigen,
  casillasDestinoPeru,
  colaboradores,
  productosMap,
  onClose,
  onSubmit,
}) => {
  const [state, dispatch] = useReducer(envioWizardReducer, initialEnvioWizardState);
  const [currentStep, setCurrentStep] = useState(0);
  const submittedRef = useRef(false);
  const [draftAceptado, setDraftAceptado] = useState(false);

  // ─── Autoguardado 2 capas ────────────────────────────────────────────────
  const {
    borradorExistente,
    continuarBorrador,
    descartarBorrador,
    clearDraft,
  } = useWizardAutosave<EnvioWizardState>({
    tipo: 'envio',
    state,
    pasoActual: currentStep,
    enabled: isOpen && !submittedRef.current,
    buildResumen: (s) => {
      if (!s.tipoRuta) return undefined;
      const ruta =
        s.tipoRuta === 'casilla_peru'
          ? `${s.origenCasillaNombre || 'Origen'} → 🇵🇪`
          : `${s.origenCasillaNombre || 'Origen'} → ${s.destinoCasillaNombre || 'Destino'}`;
      return `Envío · ${ruta}`;
    },
    buildMonto: (s) =>
      s.unidadesDisponibles
        .filter((u) => s.unidadesIdsSeleccionadas.includes(u.id))
        .reduce((sum, u) => sum + (u.costoUnitarioUSD || 0), 0),
  });

  const handleContinuarDraft = () => {
    const draft = continuarBorrador();
    if (draft) {
      // Reproducir estado paso a paso vía dispatches atómicas
      if (draft.tipoRuta) dispatch({ type: 'SET_TIPO_RUTA', tipoRuta: draft.tipoRuta });
      if (draft.origenCasillaId) {
        dispatch({
          type: 'SET_ORIGEN',
          id: draft.origenCasillaId,
          nombre: draft.origenCasillaNombre,
        });
      }
      if (draft.destinoCasillaId) {
        dispatch({
          type: 'SET_DESTINO',
          id: draft.destinoCasillaId,
          nombre: draft.destinoCasillaNombre,
        });
      }
      if (draft.colaboradorId) {
        dispatch({
          type: 'SET_COLABORADOR',
          id: draft.colaboradorId,
          nombre: draft.colaboradorNombre,
        });
      }
      if (draft.motivo) dispatch({ type: 'SET_MOTIVO', motivo: draft.motivo });
      if (draft.unidadesDisponibles && draft.unidadesDisponibles.length > 0) {
        dispatch({ type: 'SET_UNIDADES_DISPONIBLES', unidades: draft.unidadesDisponibles });
      }
      if (draft.unidadesIdsSeleccionadas && draft.unidadesIdsSeleccionadas.length > 0) {
        dispatch({
          type: 'SET_UNIDADES_SELECCIONADAS',
          ids: draft.unidadesIdsSeleccionadas,
        });
      }
      if (draft.numeroTracking) {
        dispatch({ type: 'SET_TRACKING', tracking: draft.numeroTracking });
      }
      if (draft.courier) dispatch({ type: 'SET_COURIER', courier: draft.courier });
      if (draft.notas) dispatch({ type: 'SET_NOTAS', notas: draft.notas });
      setCurrentStep((borradorExistente?.pasoActual as number) ?? 0);
    }
    setDraftAceptado(true);
  };

  const handleDescartarDraft = async () => {
    await descartarBorrador();
    setDraftAceptado(true);
  };

  const canProceed = isStepValid(currentStep, state);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
  };
  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };
  const handleClose = () => {
    dispatch({ type: 'RESET' } as EnvioWizardAction);
    setCurrentStep(0);
    submittedRef.current = false;
    setDraftAceptado(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (submittedRef.current || loading) return;
    submittedRef.current = true;

    const data: EnvioFormData = {
      origenTipo: 'casilla',
      origenCasillaId: state.origenCasillaId,
      destinoCasillaId: state.destinoCasillaId,
      tipo: 'interna_origen',
      motivo: state.motivo,
      unidadesIds: state.unidadesIdsSeleccionadas,
      ...(state.colaboradorId && { colaboradorId: state.colaboradorId }),
      ...(state.numeroTracking.trim() && { numeroTracking: state.numeroTracking.trim() }),
      ...(state.courier.trim() && { courier: state.courier.trim() }),
      ...(state.notas.trim() && { notas: state.notas.trim() }),
    };

    try {
      await onSubmit(data);
      void clearDraft(); // Limpiar borrador al confirmar
      handleClose();
    } catch {
      submittedRef.current = false;
      // Error ya manejado por caller (toast)
    }
  };

  if (!isOpen) return null;

  // ─── Render paso actual ──────────────────────────────────────────────────
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <EnvioStepRuta
            state={state}
            dispatch={dispatch}
            casillasOrigen={casillasOrigen}
            casillasDestinoPeru={casillasDestinoPeru}
            colaboradores={colaboradores}
          />
        );
      case 1:
        return (
          <EnvioStepProductos
            state={state}
            dispatch={dispatch}
            productosMap={productosMap}
          />
        );
      case 2:
        return <EnvioStepConfirm state={state} dispatch={dispatch} />;
      default:
        return null;
    }
  };

  const showDraftBanner = !!borradorExistente && !draftAceptado;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6 md:p-8 flex flex-col">
      {showDraftBanner && (
        <div className="w-full max-w-6xl mx-auto mb-3 flex-shrink-0">
          <DraftBanner
            show={showDraftBanner}
            descripcion={borradorExistente.resumen ?? 'Envío sin terminar de sesión anterior'}
            fechaLegible={formatFechaRelativa(borradorExistente.fechaActualizacion)}
            pasoActual={`Paso ${(borradorExistente.pasoActual ?? 0) + 1} de ${STEPS.length}`}
            onContinuar={handleContinuarDraft}
            onDescartar={handleDescartarDraft}
          />
        </div>
      )}
      <div className="w-full max-w-6xl mx-auto flex-1 min-h-0">
        <WizardShell
          title="Nuevo Envío"
          subtitle="Crea un envío manual entre casillas o hacia Perú"
          steps={STEPS}
          currentStep={currentStep}
          onStepChange={(i) => {
            if (i < currentStep) setCurrentStep(i);
          }}
          onCancel={handleClose}
          onPrev={handlePrev}
          onNext={handleNext}
          onConfirm={handleSubmit}
          nextDisabled={!canProceed}
          loading={loading}
          confirmLabel={loading ? 'Creando...' : 'Crear Envío'}
          nextHint={
            !canProceed
              ? 'Completa los datos obligatorios'
              : `Paso ${currentStep + 1} de ${STEPS.length}`
          }
          variant="page"
          previewPanel={
            <EnvioWizardPreview state={state} productosMap={productosMap} />
          }
          className="h-full"
        >
          {renderStep()}
        </WizardShell>
      </div>
    </div>
  );
};
