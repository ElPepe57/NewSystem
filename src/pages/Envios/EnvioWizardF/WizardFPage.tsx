/**
 * WizardFPage — Contenedor del Wizard F (Despacho venta → cliente).
 *
 * Ensambla los 4 pasos dentro de WizardShell. Reutiliza EnvioT2WizardPreview
 * como panel lateral adaptado (destinoFlag='🏠' cliente).
 *
 * Ruta: /envios/nuevo-f (protegido por feature flag WIZARD_F).
 */
import React, { useReducer, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardShell, DraftBanner, formatFechaRelativa } from '../../../design-system';
import { useWizardAutosave } from '../../../hooks/useWizardAutosave';
import { useProductoStore } from '../../../store/productoStore';
import { useAuthStore } from '../../../store/authStore';
import { envioCrudService } from '../../../services/envio.crud.service';
import type { CrearEnvioFPayload, MetodoProrrateo } from '../../../types/envio.types';

import {
  envioWizardFReducer,
  initialEnvioWizardFState,
  selectUnidadesCount,
  selectProductosCount,
  selectTotalCostosPEN,
  selectValorVentaPEN,
} from './envioWizardFTypes';

import { EnvioT2WizardPreview } from '../legacy-shared';
import { EnvioFStepVenta } from './EnvioFStepVenta';
import { EnvioFStepPicking } from './EnvioFStepPicking';
import { EnvioFStepDetalles } from './EnvioFStepDetalles';
import { EnvioFStepConfirm } from './EnvioFStepConfirm';

const STEPS = [
  { id: 'venta', label: 'Venta' },
  { id: 'picking', label: 'Almacén + Picking' },
  { id: 'detalles', label: 'Detalles', optional: true },
  { id: 'confirmar', label: 'Confirmar' },
];

export interface WizardFPageProps {
  onCreated?: (envioId: string) => void;
  onCancel?: () => void;
  variant?: 'page' | 'modal';
}

export const WizardFPage: React.FC<WizardFPageProps> = ({
  onCreated,
  onCancel,
  variant = 'page',
}) => {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.uid);
  const [state, dispatch] = useReducer(envioWizardFReducer, initialEnvioWizardFState);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autosave = useWizardAutosave<typeof state>({
    tipo: 'envio',
    state,
    pasoActual: state.pasoActual,
    buildResumen: () => {
      if (state.ventaSnapshot) {
        return `Despacho F · ${state.ventaSnapshot.numeroVenta} → ${state.ventaSnapshot.nombreCliente}${
          selectUnidadesCount(state) > 0 ? ` · ${selectUnidadesCount(state)} uds` : ''
        }`;
      }
      return 'Nuevo despacho venta (Caso F)';
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

  const canProceed = useMemo((): boolean => {
    switch (state.pasoActual) {
      case 0:
        return !!state.ventaId;
      case 1:
        return !!state.almacenOrigenId && selectUnidadesCount(state) > 0;
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
        if (!state.ventaId) return 'Selecciona una venta para despachar';
        break;
      case 1:
        if (!state.almacenOrigenId) return 'Elige el almacén origen';
        if (selectUnidadesCount(state) === 0) return 'Selecciona al menos una unidad';
        break;
      case 2:
        if (selectTotalCostosPEN(state) === 0)
          return 'Puedes avanzar sin costos de delivery';
        break;
    }
    return undefined;
  }, [state]);

  const previewProps = useMemo(() => {
    return {
      origenFlag: '🇵🇪',
      origenNombre: state.almacenOrigenNombre || 'Almacén Perú',
      origenSubtexto: 'Origen',
      destinoFlag: '🏠',
      destinoNombre: state.ventaSnapshot?.nombreCliente || 'Cliente',
      destinoSubtexto: state.ventaSnapshot?.distrito || 'Despacho a domicilio',
      transporteIcono: '🚚',
      colaboradorNombre: state.colaboradorTransporteNombre || undefined,
      unidadesCount: selectUnidadesCount(state),
      productosCount: selectProductosCount(state),
      ocsCount: 0,
      prioritariasCount: 0,
      prioritariasTotales: 0,
      ctruBaseUSD: selectValorVentaPEN(state),
      landedUSD: 0,
      tipoCambio: 0,
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
    if (!state.ventaSnapshot) {
      setError('Venta no seleccionada');
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

      const costosPEN: CrearEnvioFPayload['costosPEN'] = state.costosPEN
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

      const payload: CrearEnvioFPayload = {
        almacenOrigenId: state.almacenOrigenId,
        ventaId: state.ventaSnapshot.id,
        ventaNumero: state.ventaSnapshot.numeroVenta,
        cliente: {
          id: state.ventaSnapshot.clienteId,
          nombre: state.ventaSnapshot.nombreCliente,
          direccion: state.ventaSnapshot.direccionEntrega,
          distrito: state.ventaSnapshot.distrito,
          telefono: state.ventaSnapshot.telefonoCliente,
        },
        colaboradorTransporteId: state.colaboradorTransporteId || undefined,
        numeroTracking: state.numeroTracking || undefined,
        notas: state.notas || undefined,
        unidades,
        costosPEN,
      };

      const resultado = await envioCrudService.crearEnvioF(payload, userId);
      autosave.clearDraft();

      if (onCreated) {
        onCreated(resultado.id);
      } else {
        navigate(`/envios?envioId=${resultado.id}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al crear el despacho';
      setError(msg);
      // eslint-disable-next-line no-console
      console.error('[WizardFPage] handleConfirm error:', err);
    } finally {
      setCreating(false);
    }
  };

  const renderStep = () => {
    switch (state.pasoActual) {
      case 0:
        return <EnvioFStepVenta state={state} dispatch={dispatch} />;
      case 1:
        return <EnvioFStepPicking state={state} dispatch={dispatch} />;
      case 2:
        return <EnvioFStepDetalles state={state} dispatch={dispatch} />;
      case 3:
        return <EnvioFStepConfirm state={state} dispatch={dispatch} />;
      default:
        return null;
    }
  };

  const borradorFechaRelativa = autosave.borradorExistente
    ? formatFechaRelativa(autosave.borradorExistente.fechaActualizacion)
    : undefined;

  return (
    <>
      {autosave.borradorExistente && !autosave.loadingBorrador && (
        <div className="mb-4">
          <DraftBanner
            show
            descripcion={
              (autosave.borradorExistente as { resumen?: string }).resumen ||
              'Despacho F sin terminar'
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
            <div className="text-sm font-semibold text-red-900">No se pudo crear el despacho</div>
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
        title="Nuevo despacho — Almacén Perú → Cliente"
        subtitle="Despacha una venta existente al cliente final (Caso F · absorbe Ventas logística)"
        steps={STEPS}
        currentStep={state.pasoActual}
        onStepChange={(i) => dispatch({ type: 'GO_TO_STEP', paso: i })}
        onNext={() => dispatch({ type: 'NEXT_STEP' })}
        onPrev={() => dispatch({ type: 'PREV_STEP' })}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        confirmLabel={creating ? 'Creando despacho…' : '✓ Crear despacho'}
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
