import React, { useReducer, useEffect, useCallback, useState, useMemo } from 'react';
import { Package, Settings, CheckCircle2, Save, ChevronRight } from 'lucide-react';
import { Modal } from '../../../common/Modal';
import { Stepper, StepContent, StepNavigation } from '../../../common/Stepper';
import type { Step } from '../../../common/Stepper';
import { ocBuilderReducer, initialState } from './ocBuilderReducer';
import { validateStep1, validateStep2 } from './ocBuilderUtils';
import { OCBuilderStep1 } from './OCBuilderStep1';
import { OCBuilderStep2 } from './OCBuilderStep2';
import { OCBuilderStep3 } from './OCBuilderStep3';
import type { OCBuilderProps, OCDraftGroup } from './ocBuilderTypes';
import { useWizardAutosave } from '../../../../hooks/useWizardAutosave';

const STEPS: Step[] = [
  { id: 'agrupar', label: 'Agrupar Productos', icon: <Package className="h-4 w-4" /> },
  { id: 'configurar', label: 'Configurar OCs', icon: <Settings className="h-4 w-4" /> },
  { id: 'revisar', label: 'Revisar y Crear', icon: <CheckCircle2 className="h-4 w-4" /> },
];

// ============ Draft (canon · borradorWizardService via useWizardAutosave) ============
// D2 (2026-06-30): migrado del localStorage crudo por-reqIds al canon single-draft
// ('oc_consolidada' · 2 capas localStorage+Firestore + evento de descarte vía el hook).
// El estado persistido incluye reqIds para ofrecer el restore SOLO cuando el borrador
// corresponde a la selección de requerimientos abierta (canon single-draft).

interface OCBuilderDraftEstado {
  groups: OCDraftGroup[];
  tcGlobal: number;
  tcMode: 'global' | 'per_group';
  currentStep: number;
  activeGroupId: string | null;
  reqIds: string[];
}

function mismosReqs(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((x, i) => x === sb[i]);
}

// ============ Component ============

export const OCBuilder: React.FC<OCBuilderProps> = ({
  isOpen,
  onClose,
  requerimientos,
  tcSugerido,
  onComplete,
}) => {
  const [state, dispatch] = useReducer(ocBuilderReducer, initialState);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const reqIds = requerimientos.map(r => r.id);

  // D2 · snapshot persistido al canon (sin el pool · se reconstruye de los reqs al INIT).
  const draftState = useMemo<OCBuilderDraftEstado>(() => ({
    groups: state.groups,
    tcGlobal: state.tcGlobal,
    tcMode: state.tcMode,
    currentStep: state.currentStep,
    activeGroupId: state.activeGroupId,
    reqIds,
  }), [state.groups, state.tcGlobal, state.tcMode, state.currentStep, state.activeGroupId, reqIds]);

  // Autoguardado canónico 2 capas (localStorage + Firestore) · single-draft 'oc_consolidada'.
  const {
    borradorExistente,
    continuarBorrador,
    descartarBorrador,
    clearDraft: clearBorrador,
    forceSave,
  } = useWizardAutosave<OCBuilderDraftEstado>({
    tipo: 'oc_consolidada',
    state: draftState,
    pasoActual: state.currentStep,
    enabled: isOpen && !state.isCreating,
    isEmpty: (s) => s.groups.length === 0,
    buildResumen: (s) => `${s.groups.length} grupo(s) · ${s.groups.reduce((n, g) => n + g.productos.length, 0)} productos`,
    buildMonto: (s) => s.groups.reduce((sum, g) => sum + g.productos.reduce((gs, p) => gs + p.cantidad * p.costoUnitarioUSD, 0), 0),
  });

  // El prompt "continuar" se muestra solo si el borrador corresponde a ESTA selección de
  // requerimientos (canon single-draft · abrir otra selección no lo ofrece · se sobrescribe).
  const borradorEstado = borradorExistente?.estado as OCBuilderDraftEstado | undefined;
  const showDraftPrompt =
    !draftDismissed &&
    state.groups.length === 0 &&
    !!borradorEstado &&
    (borradorEstado.groups?.length ?? 0) > 0 &&
    mismosReqs(borradorEstado.reqIds ?? [], reqIds);

  // Init (build pool) al abrir.
  useEffect(() => {
    if (isOpen && requerimientos.length > 0) {
      dispatch({ type: 'INIT', payload: { requerimientos, tcSugerido: tcSugerido || 3.5 } });
      setDraftDismissed(false);
    }
  }, [isOpen, requerimientos, tcSugerido]);

  const handleStepClick = useCallback((step: number) => {
    if (step < state.currentStep) {
      dispatch({ type: 'SET_STEP', payload: { step } });
    }
  }, [state.currentStep]);

  const handleNext = useCallback(() => {
    if (state.currentStep === 0) {
      const v = validateStep1(state);
      if (!v.valid) return;
    }
    if (state.currentStep === 1) {
      const v = validateStep2(state);
      if (!v.valid) return;
    }
    if (state.currentStep < STEPS.length - 1) {
      dispatch({ type: 'SET_STEP', payload: { step: state.currentStep + 1 } });
    }
  }, [state]);

  const handlePrev = useCallback(() => {
    if (state.currentStep > 0) {
      dispatch({ type: 'SET_STEP', payload: { step: state.currentStep - 1 } });
    }
  }, [state.currentStep]);

  const handleClose = useCallback(() => {
    if (state.isCreating) return;
    // Guardar borrador (force a Firestore) al cerrar si hay trabajo.
    if (state.groups.length > 0) {
      void forceSave();
    }
    onClose();
  }, [state.isCreating, state.groups.length, forceSave, onClose]);

  const handleComplete = useCallback((ordenesCreadas: Array<{ id: string; numeroOrden: string; groupName: string }>) => {
    // Limpiar el borrador canónico tras crear las OCs.
    void clearBorrador();
    onComplete(ordenesCreadas);
  }, [clearBorrador, onComplete]);

  // Draft prompt handlers (canon)
  const handleRestoreDraft = useCallback(() => {
    const estado = continuarBorrador();
    if (estado) {
      dispatch({
        type: 'RESTORE_DRAFT',
        payload: {
          groups: estado.groups,
          tcGlobal: estado.tcGlobal,
          tcMode: estado.tcMode,
          currentStep: estado.currentStep,
          activeGroupId: estado.activeGroupId,
        },
      });
    }
    setDraftDismissed(true);
  }, [continuarBorrador]);

  const handleDiscardDraft = useCallback(() => {
    void descartarBorrador();
    setDraftDismissed(true);
  }, [descartarBorrador]);

  // Build title + subtitle (el detalle de requerimientos va al subtitle · canon "Generar compra")
  const reqNumbers = requerimientos.map(r => r.numeroRequerimiento).join(', ');
  const title = 'Generar compra';
  const detalleReqs = requerimientos.length === 1
    ? reqNumbers
    : `${requerimientos.length} requerimientos`;

  const subtitle = `${detalleReqs} · ${state.pool.length} productos · ${state.groups.length} grupo(s) de OC`;

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle={subtitle}
      size="full"
      fullHeight
      contentPadding="none"
      showScrollIndicator={false}
      footer={
        state.currentStep < 2 ? (
          <StepNavigation
            onPrev={handlePrev}
            onNext={handleNext}
            isFirstStep={state.currentStep === 0}
            isLastStep={false}
            prevLabel="Anterior"
            nextLabel="Siguiente"
          />
        ) : undefined
      }
    >
      {/* Breadcrumb de contexto del hub · S9.D1 (Inicio › Requerimientos › Generar compra) */}
      <nav
        className="flex-shrink-0 flex items-center gap-1.5 px-4 sm:px-6 py-2 border-b border-slate-100 bg-slate-50/50 text-[11px] text-slate-500"
        aria-label="Breadcrumb"
      >
        <span className="flex-shrink-0">Inicio</span>
        <ChevronRight className="w-3 h-3 flex-shrink-0" />
        <span className="flex-shrink-0">Requerimientos</span>
        <ChevronRight className="w-3 h-3 flex-shrink-0" />
        <span className="text-slate-900 font-medium truncate">Generar compra</span>
      </nav>

      {/* Draft restore prompt (canon · single-draft 'oc_consolidada') */}
      {showDraftPrompt && borradorEstado && (
        <div className="flex-shrink-0 mx-4 sm:mx-6 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Save className="h-4 w-4 flex-shrink-0" />
            <span>
              Tienes una compra consolidada en borrador para esta selección
              {' '}({borradorEstado.groups.length} grupo{borradorEstado.groups.length > 1 ? 's' : ''}, {borradorEstado.groups.reduce((s, g) => s + g.productos.length, 0)} productos)
            </span>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleDiscardDraft}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Descartar
            </button>
            <button
              onClick={handleRestoreDraft}
              className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700"
            >
              Restaurar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col h-full min-h-0">
        {/* Stepper */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-b border-slate-100 bg-slate-50/50">
          <Stepper
            steps={STEPS}
            currentStep={state.currentStep}
            onStepClick={handleStepClick}
            size="sm"
            allowClickCompleted
            allowClickFuture={false}
          />
        </div>

        {/* Step Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          <StepContent currentStep={state.currentStep} animate>
            <OCBuilderStep1 state={state} dispatch={dispatch} />
            <OCBuilderStep2 state={state} dispatch={dispatch} />
            <OCBuilderStep3
              state={state}
              dispatch={dispatch}
              onComplete={handleComplete}
            />
          </StepContent>
        </div>
      </div>
    </Modal>
  );
};
