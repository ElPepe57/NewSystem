/**
 * WizardEPage — Contenedor del Wizard E (Traslado interno Perú ↔ Perú).
 *
 * Ensambla los 4 pasos dentro de WizardShell con panel lateral simplificado
 * (reutiliza EnvioT2WizardPreview), autoguardado y navegación.
 *
 * Ruta: /envios/nuevo-e (protegido por feature flag WIZARD_E).
 */
import React, { useReducer, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardShell, DraftBanner, formatFechaRelativa } from '../../../design-system';
import { useWizardAutosave } from '../../../hooks/useWizardAutosave';
import { useProductoStore } from '../../../store/productoStore';
import { useAuthStore } from '../../../store/authStore';
import { envioCrudService } from '../../../services/envio.crud.service';
import type { CrearEnvioEPayload, MetodoProrrateo } from '../../../types/envio.types';

import {
  envioWizardEReducer,
  initialEnvioWizardEState,
  selectUnidadesCount,
  selectProductosCount,
  selectPrioritariasIncluidas,
  selectPrioritariasDisponibles,
  selectCTRUBaseUSD,
  selectTotalCostosPEN,
} from './envioWizardETypes';

import { EnvioT2WizardPreview } from '../EnvioWizardT2';
import { EnvioEStepOrigen } from './EnvioEStepOrigen';
import { EnvioEStepDestino } from './EnvioEStepDestino';
import { EnvioEStepDetalles } from './EnvioEStepDetalles';
import { EnvioEStepConfirm } from './EnvioEStepConfirm';

const STEPS = [
  { id: 'origen', label: 'Origen' },
  { id: 'destino', label: 'Destino + motivo' },
  { id: 'detalles', label: 'Detalles', optional: true },
  { id: 'confirmar', label: 'Confirmar' },
];

export interface WizardEPageProps {
  onCreated?: (envioId: string) => void;
  onCancel?: () => void;
  variant?: 'page' | 'modal';
}

export const WizardEPage: React.FC<WizardEPageProps> = ({
  onCreated,
  onCancel,
  variant = 'page',
}) => {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.uid);
  const [state, dispatch] = useReducer(envioWizardEReducer, initialEnvioWizardEState);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autosave = useWizardAutosave<typeof state>({
    tipo: 'envio',
    state,
    pasoActual: state.pasoActual,
    buildResumen: () => {
      if (state.almacenOrigenNombre && state.almacenDestinoNombre) {
        return `Traslado E · ${state.almacenOrigenNombre} → ${state.almacenDestinoNombre}${
          selectUnidadesCount(state) > 0 ? ` · ${selectUnidadesCount(state)} uds` : ''
        }`;
      }
      return 'Nuevo traslado interno (Caso E)';
    },
    buildMonto: () => {
      const total = selectTotalCostosPEN(state);
      return total > 0 ? total : undefined;
    },
  });

  const productos = useProductoStore((s) => s.productos);
  const fetchProductos = useProductoStore((s) => s.fetchProductos);
  useEffect(() => {
    if (productos.length === 0) fetchProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pesosPorProducto = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of productos) {
      if (p.pesoLibras) map[p.id] = p.pesoLibras;
    }
    return map;
  }, [productos]);

  // ─── Validación ──────────────────────────────────────────────────────────
  const canProceed = useMemo((): boolean => {
    switch (state.pasoActual) {
      case 0:
        return !!state.almacenOrigenId && selectUnidadesCount(state) > 0;
      case 1:
        return (
          !!state.almacenDestinoId &&
          !!state.motivo &&
          (state.motivo !== 'otro' || state.motivoDetalle.trim().length > 0)
        );
      case 2:
        return true; // opcional
      case 3:
        return true;
      default:
        return false;
    }
  }, [state]);

  const nextHint = useMemo((): string | undefined => {
    switch (state.pasoActual) {
      case 0: {
        if (!state.almacenOrigenId) return 'Selecciona un almacén Perú origen';
        const pendientes =
          selectPrioritariasDisponibles(state).length - selectPrioritariasIncluidas(state);
        if (pendientes > 0) return `⚠️ ${pendientes} pre-vendidas sin incluir`;
        if (selectUnidadesCount(state) === 0) return 'Selecciona al menos una unidad';
        break;
      }
      case 1:
        if (!state.almacenDestinoId) return 'Elige el almacén destino';
        if (!state.motivo) return 'Debes seleccionar un motivo';
        if (state.motivo === 'otro' && state.motivoDetalle.trim().length === 0)
          return 'Describe el motivo "otro"';
        break;
      case 2:
        if (selectTotalCostosPEN(state) === 0)
          return 'Puedes avanzar sin costos — agrégalos después';
        break;
    }
    return undefined;
  }, [state]);

  // Preview panel (reutiliza T2 preview con datos adaptados)
  const previewProps = useMemo(() => {
    const totalLandedPEN = selectTotalCostosPEN(state);
    // Convertir a USD con TC=1 ficticio (el preview espera USD) — no hay conversión real
    // porque Caso E es todo PEN; mostramos el PEN directamente en el panel.
    return {
      origenFlag: '🇵🇪',
      origenNombre: state.almacenOrigenNombre || 'Origen',
      origenSubtexto: 'Almacén Perú',
      destinoFlag: '🇵🇪',
      destinoNombre: state.almacenDestinoNombre || 'Destino',
      destinoSubtexto: state.motivo
        ? state.motivo === 'otro'
          ? 'Traslado interno'
          : `Motivo: ${state.motivo}`
        : 'Almacén Perú',
      transporteIcono: '🚚',
      colaboradorNombre: state.colaboradorTransporteNombre || undefined,
      unidadesCount: selectUnidadesCount(state),
      productosCount: selectProductosCount(state),
      ocsCount: 0,
      prioritariasCount: selectPrioritariasIncluidas(state),
      prioritariasTotales: selectPrioritariasDisponibles(state).length,
      ctruBaseUSD: selectCTRUBaseUSD(state),
      landedUSD: 0, // Caso E no usa USD; el total PEN se muestra como badge
      tipoCambio: 0,
      autoguardadoLabel: autosave.lastSavedAt
        ? formatFechaRelativa(autosave.lastSavedAt)
        : undefined,
      destacarTotal: state.pasoActual === 3,
      // Badge extra PEN (se muestra como parte de landedUSD en el preview mientras
      // el componente no soporte PEN nativo — TODO: extender preview en S49+)
      totalExtraLabel:
        totalLandedPEN > 0
          ? `S/ ${totalLandedPEN.toFixed(2)} PEN en costos`
          : undefined,
    };
  }, [state, autosave.lastSavedAt]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleCancel = () => {
    if (onCancel) return onCancel();
    navigate('/envios');
  };

  const handleConfirm = async () => {
    if (!userId) {
      setError('Usuario no autenticado');
      return;
    }
    if (!state.motivo) {
      setError('Motivo del traslado requerido');
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const unidades = state.unidadesDisponibles
        .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
        .map((u) => ({
          unidadId: u.id,
          productoId: u.productoId,
          sku: u.productoSKU || u.productoId,
          codigoUnidad: u.id.slice(-6).toUpperCase(),
          pesoLibras: pesosPorProducto[u.productoId],
        }));

      // Costos PEN → payload
      const costosPEN: CrearEnvioEPayload['costosPEN'] = state.costosPEN
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

      const payload: CrearEnvioEPayload = {
        casillaOrigenId: state.almacenOrigenId,
        casillaDestinoId: state.almacenDestinoId,
        motivo: state.motivo,
        ...(state.motivo === 'otro' && state.motivoDetalle
          ? { motivoDetalle: state.motivoDetalle }
          : {}),
        colaboradorTransporteId: state.colaboradorTransporteId || undefined,
        numeroTracking: state.numeroTracking || undefined,
        notas: state.notas || undefined,
        unidades,
        costosPEN,
      };

      const resultado = await envioCrudService.crearEnvioE(payload, userId);
      autosave.clearDraft();

      if (onCreated) {
        onCreated(resultado.id);
      } else {
        navigate(`/envios?envioId=${resultado.id}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al crear el traslado';
      setError(msg);
      // eslint-disable-next-line no-console
      console.error('[WizardEPage] handleConfirm error:', err);
    } finally {
      setCreating(false);
    }
  };

  const renderStep = () => {
    switch (state.pasoActual) {
      case 0:
        return <EnvioEStepOrigen state={state} dispatch={dispatch} />;
      case 1:
        return <EnvioEStepDestino state={state} dispatch={dispatch} />;
      case 2:
        return <EnvioEStepDetalles state={state} dispatch={dispatch} />;
      case 3:
        return <EnvioEStepConfirm state={state} dispatch={dispatch} />;
      default:
        return null;
    }
  };

  const borradorFechaRelativa = autosave.borradorExistente
    ? formatFechaRelativa(
        (autosave.borradorExistente as { fechaActualizacion?: unknown }).fechaActualizacion as any
      )
    : undefined;

  // EnvioT2WizardPreview no soporta totalExtraLabel — extraemos esa prop
  const { totalExtraLabel: _unusedExtra, ...previewPropsForT2 } = previewProps;

  return (
    <>
      {autosave.borradorExistente && !autosave.loadingBorrador && (
        <div className="mb-4">
          <DraftBanner
            show
            descripcion={
              (autosave.borradorExistente as { resumen?: string }).resumen ||
              'Traslado E sin terminar'
            }
            fechaLegible={borradorFechaRelativa}
            pasoActual={`Paso ${
              ((autosave.borradorExistente as { pasoActual?: number }).pasoActual ?? 0) + 1
            } de 4`}
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
            <div className="text-sm font-semibold text-red-900">No se pudo crear el traslado</div>
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
        title="Nuevo traslado interno — Almacén Perú ↔ Almacén Perú"
        subtitle="Mueve unidades entre dos almacenes tuyos en Perú (Caso E · absorbe Transferencias internas)"
        steps={STEPS}
        currentStep={state.pasoActual}
        onStepChange={(i) => dispatch({ type: 'GO_TO_STEP', paso: i })}
        onNext={() => dispatch({ type: 'NEXT_STEP' })}
        onPrev={() => dispatch({ type: 'PREV_STEP' })}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        confirmLabel={creating ? 'Creando traslado…' : '✓ Crear traslado'}
        nextDisabled={!canProceed || creating}
        nextHint={nextHint}
        loading={creating}
        variant={variant}
        previewPanel={<EnvioT2WizardPreview {...previewPropsForT2} />}
      >
        {renderStep()}
      </WizardShell>
    </>
  );
};
