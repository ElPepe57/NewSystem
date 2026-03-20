import React, { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { Package, Settings, CheckCircle2, Save } from 'lucide-react';
import { Modal } from '../../../common/Modal';
import { Stepper, StepContent, StepNavigation } from '../../../common/Stepper';
import type { Step } from '../../../common/Stepper';
import { ocBuilderReducer, initialState } from './ocBuilderReducer';
import { validateStep1, validateStep2 } from './ocBuilderUtils';
import { OCBuilderStep1 } from './OCBuilderStep1';
import { OCBuilderStep2 } from './OCBuilderStep2';
import { OCBuilderStep3 } from './OCBuilderStep3';
import type { OCBuilderProps, OCDraftGroup } from './ocBuilderTypes';

const STEPS: Step[] = [
  { id: 'agrupar', label: 'Agrupar Productos', icon: <Package className="h-4 w-4" /> },
  { id: 'configurar', label: 'Configurar OCs', icon: <Settings className="h-4 w-4" /> },
  { id: 'revisar', label: 'Revisar y Crear', icon: <CheckCircle2 className="h-4 w-4" /> },
];

// ============ Draft persistence helpers ============

interface OCBuilderDraft {
  groups: OCDraftGroup[];
  tcGlobal: number;
  tcMode: 'global' | 'per_group';
  currentStep: number;
  activeGroupId: string | null;
  savedAt: string;
}

function getDraftKey(reqIds: string[]): string {
  return `oc-builder-draft-${[...reqIds].sort().join('_')}`;
}

function saveDraft(reqIds: string[], draft: OCBuilderDraft): void {
  try {
    localStorage.setItem(getDraftKey(reqIds), JSON.stringify(draft));
  } catch { /* storage full or unavailable */ }
}

function loadDraft(reqIds: string[]): OCBuilderDraft | null {
  try {
    const raw = localStorage.getItem(getDraftKey(reqIds));
    if (!raw) return null;
    return JSON.parse(raw) as OCBuilderDraft;
  } catch { return null; }
}

function clearDraft(reqIds: string[]): void {
  try { localStorage.removeItem(getDraftKey(reqIds)); } catch { /* */ }
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
  const [draftRestored, setDraftRestored] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [savedDraft, setSavedDraft] = useState<OCBuilderDraft | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIds = requerimientos.map(r => r.id);

  // Init when opening
  useEffect(() => {
    if (isOpen && requerimientos.length > 0) {
      dispatch({ type: 'INIT', payload: { requerimientos, tcSugerido: tcSugerido || 3.5 } });
      setDraftRestored(false);

      // Check for existing draft
      const draft = loadDraft(reqIds);
      if (draft && draft.groups.length > 0) {
        setSavedDraft(draft);
        setShowDraftPrompt(true);
      } else {
        setSavedDraft(null);
        setShowDraftPrompt(false);
      }
    }
  }, [isOpen, requerimientos, tcSugerido]);

  // Restore draft after INIT has set pool
  useEffect(() => {
    if (draftRestored && savedDraft && state.pool.length > 0) {
      dispatch({
        type: 'RESTORE_DRAFT',
        payload: {
          groups: savedDraft.groups,
          tcGlobal: savedDraft.tcGlobal,
          tcMode: savedDraft.tcMode,
          currentStep: savedDraft.currentStep,
          activeGroupId: savedDraft.activeGroupId,
        },
      });
      setSavedDraft(null);
    }
  }, [draftRestored, savedDraft, state.pool.length]);

  // Auto-save on meaningful changes (debounced 1s)
  useEffect(() => {
    if (!isOpen || state.groups.length === 0 || state.isCreating || showDraftPrompt) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveDraft(reqIds, {
        groups: state.groups,
        tcGlobal: state.tcGlobal,
        tcMode: state.tcMode,
        currentStep: state.currentStep,
        activeGroupId: state.activeGroupId,
        savedAt: new Date().toISOString(),
      });
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [isOpen, state.groups, state.tcGlobal, state.tcMode, state.currentStep, state.activeGroupId, showDraftPrompt]);

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
    // Auto-save on close if there's work
    if (state.groups.length > 0) {
      saveDraft(reqIds, {
        groups: state.groups,
        tcGlobal: state.tcGlobal,
        tcMode: state.tcMode,
        currentStep: state.currentStep,
        activeGroupId: state.activeGroupId,
        savedAt: new Date().toISOString(),
      });
    }
    onClose();
  }, [state, onClose, reqIds]);

  const handleComplete = useCallback((ordenesCreadas: Array<{ id: string; numeroOrden: string; groupName: string }>) => {
    // Clear draft on successful creation
    clearDraft(reqIds);
    onComplete(ordenesCreadas);
  }, [onComplete, reqIds]);

  // Draft prompt handlers
  const handleRestoreDraft = useCallback(() => {
    setShowDraftPrompt(false);
    setDraftRestored(true);
  }, []);

  const handleDiscardDraft = useCallback(() => {
    clearDraft(reqIds);
    setSavedDraft(null);
    setShowDraftPrompt(false);
  }, [reqIds]);

  // Build title
  const reqNumbers = requerimientos.map(r => r.numeroRequerimiento).join(', ');
  const title = requerimientos.length === 1
    ? `OC Builder — ${reqNumbers}`
    : `OC Builder — ${requerimientos.length} Requerimientos`;

  const subtitle = `${state.pool.length} productos · ${state.groups.length} grupo(s) de OC`;

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
      {/* Draft restore prompt */}
      {showDraftPrompt && savedDraft && (
        <div className="flex-shrink-0 mx-4 sm:mx-6 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Save className="h-4 w-4 flex-shrink-0" />
            <span>
              Tienes una selección guardada del{' '}
              <strong>{new Date(savedDraft.savedAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong>
              {' '}({savedDraft.groups.length} grupo{savedDraft.groups.length > 1 ? 's' : ''}, {savedDraft.groups.reduce((s, g) => s + g.productos.length, 0)} productos)
            </span>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleDiscardDraft}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
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
        <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-b border-gray-100 bg-gray-50/50">
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
