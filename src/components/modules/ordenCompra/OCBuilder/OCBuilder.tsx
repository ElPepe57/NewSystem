import React, { useReducer, useEffect, useCallback, useState, useMemo } from 'react';
import { Save } from 'lucide-react';
import { WizardShell } from '../../../../design-system';
import type { WizardStep } from '../../../../design-system';
import { ocBuilderReducer, initialState } from './ocBuilderReducer';
import { validateStep1, validateStep2 } from './ocBuilderUtils';
import { OCBuilderStep1 } from './OCBuilderStep1';
import { OCBuilderStep2 } from './OCBuilderStep2';
import { OCBuilderStep3 } from './OCBuilderStep3';
import type { OCBuilderProps, OCDraftGroup } from './ocBuilderTypes';
import { useWizardAutosave } from '../../../../hooks/useWizardAutosave';

const STEPS: WizardStep[] = [
  { id: 'agrupar', label: 'Agrupar Productos' },
  { id: 'configurar', label: 'Configurar OCs' },
  { id: 'revisar', label: 'Revisar y Crear' },
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

  // Habilita el botón "Siguiente" del shell solo cuando el paso valida (canon · + nextHint).
  const puedeAvanzar =
    state.currentStep === 0 ? validateStep1(state).valid :
    state.currentStep === 1 ? validateStep2(state).valid : true;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6 md:p-8 flex flex-col">
      <div className="w-full max-w-7xl mx-auto flex-1 min-h-0 flex flex-col">
        {/* Draft restore prompt (canon · single-draft 'oc_consolidada') */}
        {showDraftPrompt && borradorEstado && (
          <div className="flex-shrink-0 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3">
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

        <WizardShell
          accent="blue"
          title={title}
          subtitle={subtitle}
          steps={STEPS}
          currentStep={state.currentStep}
          onStepChange={handleStepClick}
          onCancel={handleClose}
          onPrev={handlePrev}
          onNext={handleNext}
          nextDisabled={!puedeAvanzar}
          hideFooter={state.currentStep === 2}
          nextHint={puedeAvanzar ? `Paso ${state.currentStep + 1} de ${STEPS.length}` : 'Completa los datos para continuar'}
          variant="page"
          className="flex-1 min-h-0"
        >
          {state.currentStep === 0 && <OCBuilderStep1 state={state} dispatch={dispatch} />}
          {state.currentStep === 1 && <OCBuilderStep2 state={state} dispatch={dispatch} />}
          {state.currentStep === 2 && (
            <OCBuilderStep3 state={state} dispatch={dispatch} onComplete={handleComplete} />
          )}
        </WizardShell>
      </div>
    </div>
  );
};
