/**
 * EnvioWizardPage — Shell del Wizard de Envíos Unificado (S53 · S52 v7)
 *
 * Reemplaza directamente los 4 wizards separados (EnvioWizardT2/J/E/I).
 * Ver: docs/mockups/wizard-envio-unificado-s52.html (v7)
 *
 * 4 pasos:
 *   1. Origen + destino + unidades  (estilo OC colapsables, D-8)
 *   2. Destino detalles             (CONDICIONAL: solo E e I, D-7)
 *   3. Logística                    (4 modalidades de costo, D-11)
 *   4. Confirmar                    (resumen + crear)
 *
 * D-5: labels del stepper genéricos fijos (no cambian por tipo).
 *
 * S53.23 — Integra sistema de borradores:
 *   - Autosave 2 capas (localStorage + Firestore) con useWizardAutosave.
 *   - Banner ámbar al montar si hay borrador pendiente.
 *   - Modal de confirmación al cancelar con cambios (Guardar / Descartar /
 *     Seguir editando), en vez del `confirm()` nativo del navegador.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  WizardShell,
  ConfirmarSalidaWizardModal,
  type WizardStep,
} from '../../../design-system';
import { useAuthStore } from '../../../store/authStore';
import { useToastStore } from '../../../store/toastStore';

import { useEnvioWizardState } from './useEnvioWizardState';
import { RutaVerticalSidebar } from './shared/RutaVerticalSidebar';
import { BorradorEnvioBanner } from './shared/BorradorEnvioBanner';
import { Paso1OrigenDestinoUnidades } from './steps/Paso1OrigenDestinoUnidades';
import { Paso2DestinoDetalles } from './steps/Paso2DestinoDetalles';
import { Paso3Logistica } from './steps/Paso3Logistica';
import { Paso4Confirmar } from './steps/Paso4Confirmar';
import { envioUnificadoService } from './services/envio.unificado.service';
import { useWizardAutosave } from '../../../hooks/useWizardAutosave';
import type { EnvioWizardState } from './envioWizardTypes';
import type { BorradorWizard } from '../../../types/borradorWizard.types';

// D-5: labels genéricos fijos. Orden: 1 → 2 → 3 → 4.
const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'origen-destino-unidades',
    label: 'Origen + destino + unidades',
    description: 'De dónde, a dónde y qué mandás',
  },
  {
    id: 'destino-detalles',
    label: 'Destino detalles',
    description: 'Motivo o referencia (si aplica)',
    optional: true, // condicional: solo E/I
  },
  {
    id: 'logistica',
    label: 'Logística',
    description: 'Transportador y costos',
  },
  {
    id: 'confirmar',
    label: 'Confirmar',
    description: 'Resumen y creación',
  },
];

export const EnvioWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const toast = useToastStore();
  const wizard = useEnvioWizardState();
  const {
    state,
    dispatch,
    tipoInferido,
    tipoConfig,
    paso1Completo,
    paso2Completo,
    paso3Completo,
    puedeAvanzar,
    siguientePaso,
    pasoAnterior,
    irAPaso,
    totalUnidades,
    totalSKUs,
    totalPrevendidas,
    totalFleteUSD,
  } = wizard;

  // S53.23 — Autosave 2 capas (localStorage + Firestore). Guarda en cada
  // cambio del state mientras el wizard está montado y el submit no
  // completó. Deshabilitado durante el submit para no competir con la
  // eliminación del borrador al confirmar.
  const submitCompletedRef = React.useRef(false);
  const { descartarBorrador, clearDraft, forceSave } =
    useWizardAutosave<EnvioWizardState>({
      tipo: 'envio',
      state,
      pasoActual: state.pasoActual - 1, // 0-based para consistencia
      enabled: !submitCompletedRef.current && state.estadoSubmit !== 'saving',
      buildResumen: (s) => {
        const origen = s.ubicacionOrigenNombre || 'Origen';
        const destino = s.ubicacionDestinoNombre || 'Destino';
        const unidades = s.unidadesSeleccionadas.reduce(
          (sum, u) => sum + u.cantidadSeleccionada,
          0
        );
        if (!s.ubicacionOrigenId && !s.ubicacionDestinoId) return undefined;
        return `${origen} → ${destino}${unidades > 0 ? ` · ${unidades} uds` : ''}`;
      },
    });

  // Auto-saltar Paso 2 cuando el tipo no lo requiere (C y J)
  useEffect(() => {
    if (
      state.pasoActual === 2 &&
      tipoConfig &&
      !tipoConfig.requiereDestinoDetalles
    ) {
      irAPaso(3);
    }
  }, [state.pasoActual, tipoConfig, irAPaso]);

  // S53.23 — Modal de confirmación al cerrar con cambios
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Contador de aperturas (solo usa 1 valor ya que la página se monta una vez,
  // pero lo mantenemos por paralelismo con el patrón del OC wizard).
  const openCount = 1;

  // Detección de cambios significativos
  const hayCambiosSignificativos = useMemo(() => {
    return (
      !!state.ubicacionOrigenId ||
      !!state.ubicacionDestinoId ||
      state.unidadesSeleccionadas.length > 0 ||
      !!state.colaboradorTransporteId ||
      !!state.notas
    );
  }, [
    state.ubicacionOrigenId,
    state.ubicacionDestinoId,
    state.unidadesSeleccionadas.length,
    state.colaboradorTransporteId,
    state.notas,
  ]);

  const handleCancel = () => {
    // Solo preguntar si hay cambios — si el wizard está vacío, sale directo.
    if (hayCambiosSignificativos) {
      setShowExitConfirm(true);
      return;
    }
    navigate('/envios');
  };

  const handleGuardarBorradorYSalir = async () => {
    await forceSave();
    setShowExitConfirm(false);
    navigate('/envios');
  };

  const handleDescartarYSalir = async () => {
    await descartarBorrador();
    setShowExitConfirm(false);
    navigate('/envios');
  };

  const handleSeguirEditando = () => {
    setShowExitConfirm(false);
  };

  // S53.23 — Click en "Continuar" del BorradorEnvioBanner: cargar el state
  // del borrador completo (action LOAD_STATE) y ocultar el banner.
  const [draftAceptado, setDraftAceptado] = useState(false);
  const handleContinuarBorrador = (borrador: BorradorWizard) => {
    const draft = borrador.estado as EnvioWizardState | undefined;
    if (draft) {
      dispatch({ type: 'LOAD_STATE', state: draft });
    }
    setDraftAceptado(true);
  };

  const handleConfirm = async () => {
    if (!user) {
      toast.error('Debés estar autenticado para crear el envío', 'Error');
      return;
    }
    if (!tipoInferido) {
      toast.error('Completá el Paso 1 antes de crear el envío', 'Error');
      return;
    }
    dispatch({ type: 'SUBMIT_START' });
    try {
      const resultado = await envioUnificadoService.crear(
        tipoInferido,
        state,
        totalFleteUSD,
        user.uid
      );
      dispatch({ type: 'SUBMIT_SUCCESS' });
      submitCompletedRef.current = true;
      // Limpiar el borrador (ya se creó el envío real)
      void clearDraft();
      toast.success(
        `Envío ${resultado.numeroEnvio} creado (${tipoConfig?.nombre})`,
        '✓ Envío creado'
      );
      navigate(`/envios`);
    } catch (error: any) {
      const mensaje = error?.message || 'Error desconocido al crear el envío';
      dispatch({ type: 'SUBMIT_ERROR', error: mensaje });
      toast.error(mensaje, 'Error al crear envío');
    }
  };

  // Renderizar el contenido del paso actual
  const renderPaso = () => {
    switch (state.pasoActual) {
      case 1:
        return <Paso1OrigenDestinoUnidades wizard={wizard} />;
      case 2:
        return <Paso2DestinoDetalles wizard={wizard} />;
      case 3:
        return <Paso3Logistica wizard={wizard} />;
      case 4:
        return <Paso4Confirmar wizard={wizard} />;
      default:
        return null;
    }
  };

  // Permitir click directo en el stepper solo en pasos ya validados
  const handleStepChange = (index: number) => {
    const pasoDestino = index + 1;
    if (pasoDestino > state.pasoActual) {
      if (pasoDestino === 2 && !paso1Completo) return;
      if (pasoDestino === 3 && (!paso1Completo || !paso2Completo)) return;
      if (pasoDestino === 4 && (!paso1Completo || !paso2Completo || !paso3Completo)) return;
    }
    irAPaso(pasoDestino);
  };

  const esUltimoPaso = state.pasoActual === 4;

  // Resumen para el modal de confirmación de salida
  const resumenExit = (() => {
    const origen = state.ubicacionOrigenNombre;
    const destino = state.ubicacionDestinoNombre;
    const partes: string[] = [];
    if (origen && destino) partes.push(`${origen} → ${destino}`);
    else if (origen) partes.push(`Desde ${origen}`);
    else if (destino) partes.push(`A ${destino}`);
    if (totalUnidades > 0) partes.push(`${totalUnidades} uds`);
    if (tipoConfig) partes.push(tipoConfig.nombre);
    return partes.length > 0 ? partes.join(' · ') : undefined;
  })();

  const showBannerInterno = !draftAceptado;

  return (
    <>
      {/* S53.23 — Banner de borrador (ver BorradorEnvioBanner) */}
      {showBannerInterno && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <BorradorEnvioBanner
            key={`envio-banner-${openCount}`}
            refreshKey={openCount}
            onContinuar={handleContinuarBorrador}
          />
        </div>
      )}

      <WizardShell
        title="Nuevo envío"
        subtitle="Completá los 4 pasos para crear el envío. El tipo se infiere automáticamente del origen y destino."
        steps={WIZARD_STEPS}
        currentStep={state.pasoActual - 1}
        onStepChange={handleStepChange}
        previewPanel={
          <RutaVerticalSidebar
            state={state}
            tipoConfig={tipoConfig}
            totalUnidades={totalUnidades}
            totalSKUs={totalSKUs}
            totalPrevendidas={totalPrevendidas}
            totalFleteUSD={totalFleteUSD}
            onJumpToPaso={irAPaso}
          />
        }
        onCancel={handleCancel}
        onPrev={state.pasoActual > 1 ? pasoAnterior : undefined}
        onNext={!esUltimoPaso ? siguientePaso : undefined}
        onConfirm={esUltimoPaso ? handleConfirm : undefined}
        confirmLabel={tipoConfig?.botonCrearLabel || 'Crear envío'}
        nextDisabled={!puedeAvanzar}
        loading={state.estadoSubmit === 'saving'}
        variant="page"
      >
        {renderPaso()}
      </WizardShell>

      {/* S53.23 — Modal de confirmación al cancelar con cambios */}
      <ConfirmarSalidaWizardModal
        isOpen={showExitConfirm}
        resumen={resumenExit}
        pasoActual={`Paso ${state.pasoActual} de 4`}
        contextoSingular="este envío"
        onGuardarBorrador={handleGuardarBorradorYSalir}
        onDescartar={handleDescartarYSalir}
        onSeguirEditando={handleSeguirEditando}
      />
    </>
  );
};

export default EnvioWizardPage;
