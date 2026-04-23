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
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardShell, type WizardStep } from '../../../design-system';
import { useAuthStore } from '../../../store/authStore';
import { useToastStore } from '../../../store/toastStore';

import { useEnvioWizardState } from './useEnvioWizardState';
import { RutaVerticalSidebar } from './shared/RutaVerticalSidebar';
import { Paso1OrigenDestinoUnidades } from './steps/Paso1OrigenDestinoUnidades';
import { Paso2DestinoDetalles } from './steps/Paso2DestinoDetalles';
import { Paso3Logistica } from './steps/Paso3Logistica';
import { Paso4Confirmar } from './steps/Paso4Confirmar';
import { envioUnificadoService } from './services/envio.unificado.service';

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

  const handleCancel = () => {
    if (confirm('¿Cancelar el envío? Los cambios se perderán.')) {
      navigate('/envios');
    }
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
    // No permitir saltar adelante sin completar pasos previos
    if (pasoDestino > state.pasoActual) {
      if (pasoDestino === 2 && !paso1Completo) return;
      if (pasoDestino === 3 && (!paso1Completo || !paso2Completo)) return;
      if (pasoDestino === 4 && (!paso1Completo || !paso2Completo || !paso3Completo)) return;
    }
    irAPaso(pasoDestino);
  };

  const esUltimoPaso = state.pasoActual === 4;

  return (
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
  );
};

export default EnvioWizardPage;
