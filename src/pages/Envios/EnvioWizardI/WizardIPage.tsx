/**
 * WizardIPage — Contenedor del Wizard I (Almacén propio → Almacén tercero).
 *
 * 4 pasos: Origen+Picking → Tercero → Detalles → Confirmar.
 * Ruta: /envios/nuevo-i (protegido por feature flag WIZARD_I).
 */
import React, { useReducer, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardShell, DraftBanner, formatFechaRelativa } from '../../../design-system';
import { useWizardAutosave } from '../../../hooks/useWizardAutosave';
import { useProductoStore } from '../../../store/productoStore';
import { useAuthStore } from '../../../store/authStore';
import { envioCrudService } from '../../../services/envio.crud.service';
import type { CrearEnvioIPayload, MetodoProrrateo } from '../../../types/envio.types';
import { PAISES_CONFIG } from '../../../types/casilla.types';

import {
  envioWizardIReducer,
  initialEnvioWizardIState,
  selectUnidadesCount,
  selectProductosCount,
  selectCTRUBaseUSD,
  selectTotalCostosUSD,
  selectTotalCostosPEN,
} from './envioWizardITypes';

import { EnvioT2WizardPreview } from '../EnvioWizardT2';
import { EnvioIStepOrigen } from './EnvioIStepOrigen';
import { EnvioIStepTercero } from './EnvioIStepTercero';
import { EnvioIStepDetalles } from './EnvioIStepDetalles';
import { EnvioIStepConfirm } from './EnvioIStepConfirm';

const STEPS = [
  { id: 'origen', label: 'Origen + picking' },
  { id: 'tercero', label: 'Tercero + ref' },
  { id: 'detalles', label: 'Detalles', optional: true },
  { id: 'confirmar', label: 'Confirmar' },
];

export interface WizardIPageProps {
  onCreated?: (envioId: string) => void;
  onCancel?: () => void;
  variant?: 'page' | 'modal';
}

export const WizardIPage: React.FC<WizardIPageProps> = ({
  onCreated,
  onCancel,
  variant = 'page',
}) => {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.uid);
  const [state, dispatch] = useReducer(envioWizardIReducer, initialEnvioWizardIState);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autosave = useWizardAutosave<typeof state>({
    tipo: 'envio',
    state,
    pasoActual: state.pasoActual,
    buildResumen: () => {
      if (state.almacenOrigenNombre && state.almacenTerceroDestinoNombre) {
        return `Envío I · ${state.almacenOrigenNombre} → ${state.almacenTerceroDestinoNombre}${
          selectUnidadesCount(state) > 0 ? ` · ${selectUnidadesCount(state)} uds` : ''
        }`;
      }
      return 'Nuevo envío a tercero (Caso I)';
    },
    buildMonto: () => {
      const total = selectTotalCostosUSD(state);
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

  const canProceed = useMemo((): boolean => {
    switch (state.pasoActual) {
      case 0:
        return !!state.almacenOrigenId && selectUnidadesCount(state) > 0;
      case 1:
        return !!state.almacenTerceroDestinoId && state.referenciaTercero.trim().length > 0;
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  }, [state]);

  const nextHint = useMemo((): string | undefined => {
    switch (state.pasoActual) {
      case 0:
        if (!state.almacenOrigenId) return 'Selecciona un almacén propio origen';
        if (selectUnidadesCount(state) === 0) return 'Selecciona al menos una unidad';
        break;
      case 1:
        if (!state.almacenTerceroDestinoId) return 'Elige el almacén tercero destino';
        if (!state.referenciaTercero.trim()) return 'Captura la referencia del tercero';
        break;
      case 2:
        if (selectTotalCostosUSD(state) + selectTotalCostosPEN(state) === 0)
          return 'Puedes avanzar sin costos — agrégalos después';
        break;
    }
    return undefined;
  }, [state]);

  const previewProps = useMemo(() => {
    return {
      origenFlag: PAISES_CONFIG[state.almacenOrigenPais]?.emoji ?? '🏭',
      origenNombre: state.almacenOrigenNombre || 'Almacén propio',
      origenSubtexto: state.almacenOrigenPais || undefined,
      destinoFlag: PAISES_CONFIG[state.almacenTerceroDestinoPais]?.emoji ?? '🏢',
      destinoNombre: state.almacenTerceroDestinoNombre || 'Tercero',
      destinoSubtexto: state.referenciaTercero
        ? `Ref: ${state.referenciaTercero.slice(0, 20)}`
        : 'Tercero',
      transporteIcono: '🔒',
      colaboradorNombre: state.colaboradorTransporteNombre || undefined,
      unidadesCount: selectUnidadesCount(state),
      productosCount: selectProductosCount(state),
      ocsCount: 0,
      prioritariasCount: 0,
      prioritariasTotales: 0,
      ctruBaseUSD: selectCTRUBaseUSD(state),
      landedUSD: selectTotalCostosUSD(state),
      tipoCambio: state.tipoCambio,
      autoguardadoLabel: autosave.lastSavedAt
        ? formatFechaRelativa(autosave.lastSavedAt)
        : undefined,
      destacarTotal: state.pasoActual === 3,
    };
  }, [state, autosave.lastSavedAt]);

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

      const costos: CrearEnvioIPayload['costos'] = state.costos
        .filter((c) => c.activo && c.monto > 0)
        .map((c) => {
          const uds = selectUnidadesCount(state);
          const montoEfectivo = c.metodo === 'por_unidad' ? c.monto * uds : c.monto;
          const metodoProrrateo: MetodoProrrateo =
            c.metodo === 'por_unidad' ? 'fijo_por_unidad' : 'total_por_valor';
          return {
            categoriaCostoId: c.id,
            categoriaCostoNombre: c.concepto,
            monto: montoEfectivo,
            moneda: c.moneda,
            tipoCambio: state.tipoCambio || 1,
            metodoProrrateo,
          };
        });

      const payload: CrearEnvioIPayload = {
        almacenOrigenId: state.almacenOrigenId,
        almacenTerceroDestinoId: state.almacenTerceroDestinoId,
        referenciaTercero: state.referenciaTercero.trim(),
        tipoRelacion: state.tipoRelacion,
        colaboradorTransporteId: state.colaboradorTransporteId || undefined,
        numeroTracking: state.numeroTracking || undefined,
        notas: state.notas || undefined,
        unidades,
        costos,
      };

      const resultado = await envioCrudService.crearEnvioI(payload, userId);
      autosave.clearDraft();

      if (onCreated) {
        onCreated(resultado.id);
      } else {
        navigate(`/envios?envioId=${resultado.id}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al crear el envío I';
      setError(msg);
      // eslint-disable-next-line no-console
      console.error('[WizardIPage] handleConfirm error:', err);
    } finally {
      setCreating(false);
    }
  };

  const renderStep = () => {
    switch (state.pasoActual) {
      case 0:
        return <EnvioIStepOrigen state={state} dispatch={dispatch} />;
      case 1:
        return <EnvioIStepTercero state={state} dispatch={dispatch} />;
      case 2:
        return <EnvioIStepDetalles state={state} dispatch={dispatch} />;
      case 3:
        return <EnvioIStepConfirm state={state} dispatch={dispatch} />;
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
              'Envío I sin terminar'
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
            <div className="text-sm font-semibold text-red-900">No se pudo crear el envío I</div>
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
        title="Nuevo envío — Almacén propio → Almacén tercero"
        subtitle="Envía a Fulfillment, consignación o distribución (Caso I · stock bloqueado D-10)"
        steps={STEPS}
        currentStep={state.pasoActual}
        onStepChange={(i) => dispatch({ type: 'GO_TO_STEP', paso: i })}
        onNext={() => dispatch({ type: 'NEXT_STEP' })}
        onPrev={() => dispatch({ type: 'PREV_STEP' })}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        confirmLabel={creating ? 'Creando envío I…' : '✓ Crear envío I (bloquear stock)'}
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
