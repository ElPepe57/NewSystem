/**
 * WizardJPage — Contenedor del Wizard J completo (Casilla → Casilla).
 *
 * Ensambla los 5 pasos dentro de `WizardShell` con su panel lateral
 * (reutiliza `EnvioT2WizardPreview`), autoguardado y navegación.
 *
 * Ruta: /envios/nuevo-j (protegido por feature flag WIZARD_J).
 */
import React, { useReducer, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardShell, DraftBanner, formatFechaRelativa } from '../../../design-system';
import { useWizardAutosave } from '../../../hooks/useWizardAutosave';
import { useProductoStore } from '../../../store/productoStore';
import { useAuthStore } from '../../../store/authStore';
import { envioCrudService } from '../../../services/envio.crud.service';
import type { CrearEnvioJPayload, MetodoProrrateo } from '../../../types/envio.types';
import { PAISES_CONFIG } from '../../../types/casilla.types';

import {
  envioWizardJReducer,
  initialEnvioWizardJState,
  selectUnidadesCount,
  selectProductosCount,
  selectPrioritariasIncluidas,
  selectPrioritariasDisponibles,
  selectCTRUBaseUSD,
  selectMontoTotalFlete,
  selectTotalCostosAdicionales,
} from './envioWizardJTypes';

import { EnvioT2WizardPreview } from '../EnvioWizardT2';
import { EnvioJStepOrigen } from './EnvioJStepOrigen';
import { EnvioJStepDestino } from './EnvioJStepDestino';
import { EnvioJStepTransporte } from './EnvioJStepTransporte';
import { EnvioJStepCostos } from './EnvioJStepCostos';
import { EnvioJStepConfirm } from './EnvioJStepConfirm';

const STEPS = [
  { id: 'origen', label: 'Origen' },
  { id: 'destino', label: 'Destino' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'costos', label: 'Costos', optional: true },
  { id: 'confirmar', label: 'Confirmar' },
];

export interface WizardJPageProps {
  onCreated?: (envioId: string) => void;
  onCancel?: () => void;
  variant?: 'page' | 'modal';
}

export const WizardJPage: React.FC<WizardJPageProps> = ({
  onCreated,
  onCancel,
  variant = 'page',
}) => {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.uid);
  const [state, dispatch] = useReducer(envioWizardJReducer, initialEnvioWizardJState);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autoguardado — tipo 'envio' (comparte bucket con T2); al hidratar se
  // detecta por shape (presencia de casillaDestinoId vs almacenDestinoId).
  const autosave = useWizardAutosave<typeof state>({
    tipo: 'envio',
    state,
    pasoActual: state.pasoActual,
    buildResumen: () => {
      if (state.casillaOrigenNombre && state.casillaDestinoNombre) {
        return `Envío J · ${state.casillaOrigenNombre} → ${state.casillaDestinoNombre}${
          selectUnidadesCount(state) > 0 ? ` · ${selectUnidadesCount(state)} uds` : ''
        }`;
      }
      return 'Nuevo envío J (Casilla ↔ Casilla)';
    },
    buildMonto: () => {
      const total =
        selectCTRUBaseUSD(state) +
        selectMontoTotalFlete(state) +
        selectTotalCostosAdicionales(state);
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

  // ─── Validación por paso ─────────────────────────────────────────────────
  const canProceed = useMemo((): boolean => {
    switch (state.pasoActual) {
      case 0: // Origen + Picking combinado
        return !!state.casillaOrigenId && selectUnidadesCount(state) > 0;
      case 1: // Destino
        return !!state.casillaDestinoId;
      case 2: // Transporte
        return !!state.tipoTransporte && !!state.colaboradorTransporteId;
      case 3: // Costos (opcional)
        return true;
      case 4: // Confirmar
        return true;
      default:
        return false;
    }
  }, [state]);

  const nextHint = useMemo((): string | undefined => {
    switch (state.pasoActual) {
      case 0: {
        if (!state.casillaOrigenId) return 'Selecciona una casilla origen';
        const pendientes =
          selectPrioritariasDisponibles(state).length - selectPrioritariasIncluidas(state);
        if (pendientes > 0) return `⚠️ ${pendientes} pre-vendidas sin incluir`;
        if (selectUnidadesCount(state) === 0) return 'Selecciona al menos una unidad';
        break;
      }
      case 1:
        if (!state.casillaDestinoId) return 'Elige la casilla destino';
        if (state.advertenciaCambioPais)
          return `⚠ Envío entre países distintos (${state.casillaOrigenPais} → ${state.casillaDestinoPais})`;
        break;
      case 2:
        if (!state.tipoTransporte) return 'Elige el tipo de transporte';
        if (!state.colaboradorTransporteId) return 'Selecciona un colaborador';
        break;
      case 3:
        if (selectMontoTotalFlete(state) === 0)
          return 'Puedes avanzar sin costos — agrégalos después';
        break;
    }
    return undefined;
  }, [state]);

  // ─── Preview panel (reutiliza EnvioT2WizardPreview) ───────────────────────
  const previewProps = useMemo(() => {
    const origenFlag = PAISES_CONFIG[state.casillaOrigenPais]?.emoji ?? '🌎';
    const destinoFlag = PAISES_CONFIG[state.casillaDestinoPais]?.emoji ?? '🌎';
    const ctruBase = selectCTRUBaseUSD(state);
    const landed = selectMontoTotalFlete(state) + selectTotalCostosAdicionales(state);

    return {
      origenFlag,
      origenNombre: state.casillaOrigenNombre || 'Origen',
      origenSubtexto: state.colaboradorOrigenNombre || state.casillaOrigenPais || undefined,
      destinoFlag,
      destinoNombre: state.casillaDestinoNombre || 'Destino',
      destinoSubtexto:
        state.colaboradorDestinoNombre ||
        state.casillaDestinoPais ||
        undefined,
      transporteIcono:
        state.tipoTransporte === 'viajero'
          ? '✈️'
          : state.tipoTransporte === 'courier'
            ? '📦'
            : undefined,
      colaboradorNombre: state.colaboradorTransporteNombre || undefined,
      unidadesCount: selectUnidadesCount(state),
      productosCount: selectProductosCount(state),
      // En Caso J no hay OCs consolidadas — usamos 0 (el preview lo oculta)
      ocsCount: 0,
      prioritariasCount: selectPrioritariasIncluidas(state),
      prioritariasTotales: selectPrioritariasDisponibles(state).length,
      ctruBaseUSD: ctruBase,
      landedUSD: landed,
      tipoCambio: state.tipoCambio,
      autoguardadoLabel: autosave.lastSavedAt
        ? formatFechaRelativa(autosave.lastSavedAt)
        : undefined,
      destacarTotal: state.pasoActual === 4,
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

      const costos: CrearEnvioJPayload['costos'] = [];
      const tc = state.tipoCambio || 0;
      const fleteTotalUSD = selectMontoTotalFlete(state);
      if (fleteTotalUSD > 0) {
        const metodoProrrateo: MetodoProrrateo =
          state.presetTarifa === 'monto_total'
            ? 'total_por_peso'
            : state.presetTarifa === 'por_unidad'
              ? 'fijo_por_unidad'
              : 'variado_por_producto';
        costos.push({
          categoriaCostoId: 'flete-j',
          categoriaCostoNombre:
            state.tipoTransporte === 'viajero'
              ? `Flete del viajero (${state.colaboradorTransporteNombre})`
              : `Flete del courier (${state.colaboradorTransporteNombre})`,
          descripcion: state.numeroTracking ? `Tracking: ${state.numeroTracking}` : undefined,
          montoUSD: fleteTotalUSD,
          tipoCambio: tc,
          metodoProrrateo,
          ...(state.presetTarifa === 'variable'
            ? { detalleVariado: state.tarifaVariablePorProducto }
            : {}),
        });
      }
      for (const costoAd of state.costosAdicionales.filter((c) => c.activo)) {
        const metodoMap: Record<string, MetodoProrrateo> = {
          monto_total: 'total_por_valor',
          por_unidad: 'fijo_por_unidad',
          por_valor: 'total_por_valor',
        };
        costos.push({
          categoriaCostoId: costoAd.id,
          categoriaCostoNombre: costoAd.concepto,
          montoUSD: costoAd.monto,
          tipoCambio: tc,
          metodoProrrateo: metodoMap[costoAd.metodo] || 'total_por_valor',
        });
      }

      const payload: CrearEnvioJPayload = {
        casillaOrigenId: state.casillaOrigenId,
        casillaDestinoId: state.casillaDestinoId,
        variante: state.variante,
        colaboradorTransporteId: state.colaboradorTransporteId,
        numeroTracking: state.numeroTracking || undefined,
        notas: state.notas || undefined,
        advertenciaCambioPais: state.advertenciaCambioPais || undefined,
        unidades,
        costos,
      };

      const resultado = await envioCrudService.crearEnvioJ(payload, userId);
      autosave.clearDraft();

      if (onCreated) {
        onCreated(resultado.id);
      } else {
        navigate(`/envios?envioId=${resultado.id}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al crear el envío J';
      setError(msg);
      // eslint-disable-next-line no-console
      console.error('[WizardJPage] handleConfirm error:', err);
    } finally {
      setCreating(false);
    }
  };

  // ─── Render del paso actual ──────────────────────────────────────────────
  const renderStep = () => {
    switch (state.pasoActual) {
      case 0:
        return <EnvioJStepOrigen state={state} dispatch={dispatch} />;
      case 1:
        return <EnvioJStepDestino state={state} dispatch={dispatch} />;
      case 2:
        return <EnvioJStepTransporte state={state} dispatch={dispatch} />;
      case 3:
        return <EnvioJStepCostos state={state} dispatch={dispatch} />;
      case 4:
        return <EnvioJStepConfirm state={state} dispatch={dispatch} />;
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
              'Envío J sin terminar'
            }
            fechaLegible={borradorFechaRelativa}
            pasoActual={`Paso ${
              ((autosave.borradorExistente as { pasoActual?: number }).pasoActual ?? 0) + 1
            } de 5`}
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
            <div className="text-sm font-semibold text-red-900">No se pudo crear el envío</div>
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
        title="Nuevo envío — Entre casillas internacionales"
        subtitle="Mueve unidades desde una casilla hacia otra (Caso J · mismo colaborador o entre colaboradores)"
        steps={STEPS}
        currentStep={state.pasoActual}
        onStepChange={(i) => dispatch({ type: 'GO_TO_STEP', paso: i })}
        onNext={() => dispatch({ type: 'NEXT_STEP' })}
        onPrev={() => dispatch({ type: 'PREV_STEP' })}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        confirmLabel={creating ? 'Creando envío…' : '✓ Crear envío J'}
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
