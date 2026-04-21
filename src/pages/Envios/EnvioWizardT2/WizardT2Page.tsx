/**
 * WizardT2Page — Contenedor del Wizard T2 completo (Casilla → Perú).
 *
 * Ensambla los 5 pasos dentro de `WizardShell` con su panel lateral
 * (`EnvioT2WizardPreview`), autoguardado y navegación.
 *
 * Arquitectura:
 *   useReducer(envioWizardT2Reducer) → state + dispatch
 *   useWizardAutosave                 → 2 capas (localStorage + Firestore)
 *   WizardShell                       → UI contenedora estándar
 *   Pasos 1-5                         → reciben state + dispatch
 *
 * Ruta: /envios/nuevo-t2 (protegido por feature flag — ver routing).
 */
import React, { useReducer, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardShell, DraftBanner, formatFechaRelativa } from '../../../design-system';
import { useWizardAutosave } from '../../../hooks/useWizardAutosave';
import { useProductoStore } from '../../../store/productoStore';

import {
  envioWizardT2Reducer,
  initialEnvioWizardT2State,
  selectUnidadesCount,
  selectProductosCount,
  selectOCsCount,
  selectPrioritariasIncluidas,
  selectPrioritariasDisponibles,
  selectCTRUBaseUSD,
  selectMontoTotalFlete,
  selectTotalCostosAdicionales,
} from './envioWizardT2Types';

import { EnvioT2WizardPreview } from './EnvioT2WizardPreview';
import { EnvioT2StepOrigen } from './EnvioT2StepOrigen';
import { EnvioT2StepPicking } from './EnvioT2StepPicking';
import { EnvioT2StepTransporte } from './EnvioT2StepTransporte';
import { EnvioT2StepCostos } from './EnvioT2StepCostos';
import { EnvioT2StepConfirm } from './EnvioT2StepConfirm';

const STEPS = [
  { id: 'origen', label: 'Origen' },
  { id: 'picking', label: 'Picking' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'costos', label: 'Costos', optional: true },
  { id: 'confirmar', label: 'Confirmar' },
];

const FLAG_MAP: Record<string, string> = {
  USA: '🇺🇸',
  Peru: '🇵🇪',
  Peru_local: '🇵🇪',
  China: '🇨🇳',
  Corea: '🇰🇷',
};

export interface WizardT2PageProps {
  /** Callback al crear envío exitosamente — recibe el id del envío creado */
  onCreated?: (envioId: string) => void;
  /** Callback al cancelar */
  onCancel?: () => void;
  /** Si se renderiza como modal (sin shadow/border) o como página (con shadow) */
  variant?: 'page' | 'modal';
}

export const WizardT2Page: React.FC<WizardT2PageProps> = ({ onCreated, onCancel, variant = 'page' }) => {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(envioWizardT2Reducer, initialEnvioWizardT2State);

  // Autoguardado 2 capas (localStorage instant + Firestore cada 30s)
  const autosave = useWizardAutosave<typeof state>({
    tipo: 'envio',
    state,
    pasoActual: state.pasoActual,
    buildResumen: () => {
      if (state.casillaOrigenNombre) {
        return `Envío T2 desde ${state.casillaOrigenNombre}${
          selectUnidadesCount(state) > 0 ? ` · ${selectUnidadesCount(state)} uds` : ''
        }`;
      }
      return 'Nuevo envío T2 (Casilla → Perú)';
    },
    buildMonto: () => {
      const total = selectCTRUBaseUSD(state) + selectMontoTotalFlete(state) + selectTotalCostosAdicionales(state);
      return total > 0 ? total : undefined;
    },
  });

  // Asegurar que la metadata de productos/casillas esté cargada (para el preview)
  const productos = useProductoStore((s) => s.productos);
  const fetchProductos = useProductoStore((s) => s.fetchProductos);
  useEffect(() => {
    if (productos.length === 0) fetchProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Validación por paso (controla si el botón "Siguiente" está habilitado) ─
  const canProceed = useMemo((): boolean => {
    switch (state.pasoActual) {
      case 0: // Origen
        return !!state.casillaOrigenId;
      case 1: // Picking
        return selectUnidadesCount(state) > 0;
      case 2: // Transporte
        return (
          !!state.tipoTransporte &&
          !!state.colaboradorId &&
          !!state.almacenDestinoId
        );
      case 3: // Costos (opcional)
        return true;
      case 4: // Confirmar (último paso)
        return true;
      default:
        return false;
    }
  }, [state]);

  // ─── Hints dinámicos por paso ────────────────────────────────────────────
  const nextHint = useMemo((): string | undefined => {
    switch (state.pasoActual) {
      case 0:
        if (!state.casillaOrigenId) return 'Selecciona una casilla para continuar';
        break;
      case 1: {
        const prioritariasPendientes =
          selectPrioritariasDisponibles(state).length - selectPrioritariasIncluidas(state);
        if (prioritariasPendientes > 0) {
          return `⚠️ ${prioritariasPendientes} pre-vendidas sin incluir`;
        }
        if (selectUnidadesCount(state) === 0) {
          return 'Selecciona al menos una unidad';
        }
        break;
      }
      case 2:
        if (!state.tipoTransporte) return 'Elige el tipo de transporte';
        if (!state.colaboradorId) return 'Selecciona un colaborador';
        if (!state.almacenDestinoId) return 'Elige el almacén destino';
        break;
      case 3:
        if (selectMontoTotalFlete(state) === 0) {
          return 'Puedes avanzar sin costos — agrégalos después';
        }
        break;
    }
    return undefined;
  }, [state]);

  // ─── Datos del preview panel ────────────────────────────────────────────
  const previewProps = useMemo(() => {
    const origenFlag = FLAG_MAP[state.casillaOrigenPais] || '🌎';
    const destinoFlag = '🇵🇪';
    const ctruBase = selectCTRUBaseUSD(state);
    const landed = selectMontoTotalFlete(state) + selectTotalCostosAdicionales(state);

    return {
      origenFlag,
      origenNombre: state.casillaOrigenNombre || 'Origen',
      origenSubtexto: state.casillaOrigenPais || undefined,
      destinoFlag,
      destinoNombre: state.almacenDestinoNombre || 'Destino',
      destinoSubtexto: state.almacenDestinoId ? 'Perú' : undefined,
      transporteIcono:
        state.tipoTransporte === 'viajero' ? '✈️' : state.tipoTransporte === 'courier' ? '📦' : undefined,
      colaboradorNombre: state.colaboradorNombre || undefined,
      unidadesCount: selectUnidadesCount(state),
      productosCount: selectProductosCount(state),
      ocsCount: selectOCsCount(state),
      prioritariasCount: selectPrioritariasIncluidas(state),
      prioritariasTotales: selectPrioritariasDisponibles(state).length,
      ctruBaseUSD: ctruBase,
      landedUSD: landed,
      tipoCambio: state.tipoCambio,
      autoguardadoLabel: autosave.lastSavedAt
        ? formatFechaRelativa(autosave.lastSavedAt)
        : undefined,
      destacarTotal: state.pasoActual === 4, // paso confirmar
    };
  }, [state, autosave.lastSavedAt]);

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleCancel = () => {
    if (onCancel) return onCancel();
    navigate('/envios');
  };

  const handleConfirm = async () => {
    // TODO (Fase 4): llamar a envioCrudService.crearEnvioT2(buildPayload(state))
    //                → onCreated(envioId) → clearDraft() → navigate(`/envios`)
    //                Por ahora placeholder:
    // eslint-disable-next-line no-console
    console.log('[WizardT2Page] TODO: integrar servicio crearEnvioT2', state);
    if (onCreated) onCreated('ENV-TODO');
  };

  // ─── Render del contenido por paso ──────────────────────────────────────
  const renderStep = () => {
    switch (state.pasoActual) {
      case 0:
        return <EnvioT2StepOrigen state={state} dispatch={dispatch} />;
      case 1:
        return <EnvioT2StepPicking state={state} dispatch={dispatch} />;
      case 2:
        return <EnvioT2StepTransporte state={state} dispatch={dispatch} />;
      case 3:
        return <EnvioT2StepCostos state={state} dispatch={dispatch} />;
      case 4:
        return <EnvioT2StepConfirm state={state} dispatch={dispatch} />;
      default:
        return null;
    }
  };

  // Para el banner de borrador (usa buildResumen en state hidratado)
  const borradorFechaRelativa = autosave.borradorExistente
    ? formatFechaRelativa((autosave.borradorExistente as any).fechaActualizacion)
    : undefined;

  return (
    <>
      {/* Banner de borrador (si hay uno sin terminar) */}
      {autosave.borradorExistente && !autosave.loadingBorrador && (
        <div className="mb-4">
          <DraftBanner
            show
            descripcion={(autosave.borradorExistente as any).resumen || 'Envío T2 sin terminar'}
            fechaLegible={borradorFechaRelativa}
            pasoActual={`Paso ${(((autosave.borradorExistente as any).pasoActual ?? 0) + 1)} de 5`}
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

      <WizardShell
        title="Nuevo envío — Casilla a Perú"
        subtitle="Consolida unidades de una casilla internacional y envíalas al almacén destino"
        steps={STEPS}
        currentStep={state.pasoActual}
        onStepChange={(i) => dispatch({ type: 'GO_TO_STEP', paso: i })}
        onNext={() => dispatch({ type: 'NEXT_STEP' })}
        onPrev={() => dispatch({ type: 'PREV_STEP' })}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        confirmLabel="✓ Crear y despachar"
        nextDisabled={!canProceed}
        nextHint={nextHint}
        variant={variant}
        previewPanel={<EnvioT2WizardPreview {...previewProps} />}
      >
        {renderStep()}
      </WizardShell>
    </>
  );
};
