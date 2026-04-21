/**
 * CostosLandedPanel — Compuesto que muestra todos los costos landed de un
 * envío organizados por scope (envío / tanda N) con header de cierre
 * financiero + acciones globales.
 *
 * Estructura:
 *   Header
 *     - Badge estado operativo + Badge estado financiero (D-17)
 *     - Total landed acumulado en PEN
 *     - Botón "+ Agregar costo" (si envío NO finalizado)
 *     - Botón "Finalizar costos" / "Reabrir" (según estado)
 *
 *   Body
 *     - Sección "Costos del envío (globales)" con tabla de CostoLandedRow
 *     - Sección "Costos por tanda" con mini-tablas (una por sub-tanda)
 *     - Empty state si no hay costos
 *
 * Ubicación típica: reemplaza al TabCostos actual en EnvioDetailModal.
 * Funciona TANTO para envíos con sub-tandas (T1 casos A/B/D) como sin ellas
 * (envíos planos T2 caso C), porque el scope='tanda' es opcional.
 */
import React, { useMemo, useState } from 'react';
import {
  DollarSign,
  Plus,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../../../design-system';
import type {
  Envio,
  CostoLanded,
  SubEnvioT1,
} from '../../../types/envio.types';
import { CostoLandedRow } from './CostoLandedRow';
import {
  AgregarCostoLandedModal,
  type AgregarCostoLandedModalResult,
} from './AgregarCostoLandedModal';
import { FinalizarCostosModal } from './FinalizarCostosModal';

// ════════════════════════════════════════════════════════════════════════════
// Tipos
// ════════════════════════════════════════════════════════════════════════════

export interface CostosLandedPanelProps {
  /** Envío con costosLanded[] + subEnvios[] opcionales */
  envio: Envio;
  /** TC actual para auto-completar en el form */
  tipoCambioActual?: number;
  /** Categorías de costo disponibles (opcional) */
  categoriasDisponibles?: Array<{ id: string; nombre: string }>;

  // Callbacks (padre llama a los servicios reales)
  onAgregarCosto?: (result: AgregarCostoLandedModalResult) => void | Promise<void>;
  onConfirmarCosto?: (costoId: string) => void | Promise<void>;
  onEliminarCosto?: (costoId: string) => void | Promise<void>;
  onEditarCosto?: (costo: CostoLanded) => void;
  onFinalizarCostos?: () => void | Promise<void>;
  onReabrirCostos?: () => void | Promise<void>;

  /** Loading externo (durante cualquier operación) */
  loading?: boolean;
  className?: string;
}

const formatPEN = (n: number): string =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ════════════════════════════════════════════════════════════════════════════
// Componente
// ════════════════════════════════════════════════════════════════════════════

export const CostosLandedPanel: React.FC<CostosLandedPanelProps> = ({
  envio,
  tipoCambioActual,
  categoriasDisponibles,
  onAgregarCosto,
  onConfirmarCosto,
  onEliminarCosto,
  onEditarCosto,
  onFinalizarCostos,
  onReabrirCostos,
  loading: loadingExt = false,
  className,
}) => {
  const [modalAgregarOpen, setModalAgregarOpen] = useState(false);
  const [tandaIdPre, setTandaIdPre] = useState<string | undefined>();
  const [modalFinalizarOpen, setModalFinalizarOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const loading = loadingExt || submitting;

  const costos = envio.costosLanded ?? [];
  const subEnvios = envio.subEnvios ?? [];
  const envioFinalizado = envio.costosFinalizados === true;
  const esRecibidaCompleta = envio.estado === 'recibida_completa';

  // ─── Derivar costos agrupados por scope ─────────────────────────────────
  const costosPorScope = useMemo(() => {
    const globales: CostoLanded[] = [];
    const porTanda = new Map<string, CostoLanded[]>();
    for (const c of costos) {
      const scope = c.scope ?? 'envio';
      if (scope === 'envio') {
        globales.push(c);
      } else if (scope === 'tanda' && c.tandaId) {
        const arr = porTanda.get(c.tandaId) ?? [];
        arr.push(c);
        porTanda.set(c.tandaId, arr);
      }
    }
    return { globales, porTanda };
  }, [costos]);

  // Resumen
  const totalPEN = costos.reduce((sum, c) => sum + c.montoPEN, 0);
  const cantidadEstimados = costos.filter(
    (c) => (c.estado ?? 'estimado') === 'estimado'
  ).length;
  const cantidadConfirmados = costos.filter((c) => c.estado === 'confirmado').length;

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleAgregar = async (result: AgregarCostoLandedModalResult) => {
    if (!onAgregarCosto) return;
    setSubmitting(true);
    try {
      await onAgregarCosto(result);
      setModalAgregarOpen(false);
      setTandaIdPre(undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalizar = async () => {
    if (!onFinalizarCostos) return;
    setSubmitting(true);
    try {
      await onFinalizarCostos();
      setModalFinalizarOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const abrirAgregarEnTanda = (tandaId: string) => {
    setTandaIdPre(tandaId);
    setModalAgregarOpen(true);
  };

  const puedeAgregar = !envioFinalizado && !!onAgregarCosto;
  const puedeFinalizar =
    !envioFinalizado &&
    !!onFinalizarCostos &&
    costos.length > 0 &&
    cantidadEstimados === 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* ═══ Header con estados + acciones ═══ */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-teal-600" aria-hidden />
              <h4 className="text-sm font-semibold text-slate-900">
                Costos landed ({costos.length})
              </h4>
            </div>

            {/* Badge estado operativo */}
            {esRecibidaCompleta ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full">
                <CheckCircle2 className="w-3 h-3" aria-hidden />
                Recibido completo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
                En operación
              </span>
            )}

            {/* Badge estado financiero */}
            {envioFinalizado ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
                <Lock className="w-3 h-3" aria-hidden />
                Cierre financiero ✓
              </span>
            ) : cantidadEstimados > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                <AlertTriangle className="w-3 h-3" aria-hidden />
                Cierre pendiente ({cantidadEstimados} estimado{cantidadEstimados !== 1 ? 's' : ''})
              </span>
            ) : costos.length > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-100 text-sky-800 text-xs font-medium rounded-full">
                Listo para finalizar
              </span>
            ) : null}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            {puedeAgregar && (
              <button
                type="button"
                onClick={() => {
                  setTandaIdPre(undefined);
                  setModalAgregarOpen(true);
                }}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden /> Agregar costo
              </button>
            )}
            {envioFinalizado && onReabrirCostos && (
              <button
                type="button"
                onClick={onReabrirCostos}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Reabrir costos para aceptar facturas adicionales"
              >
                <Unlock className="w-3.5 h-3.5" aria-hidden /> Reabrir
              </button>
            )}
            {!envioFinalizado && onFinalizarCostos && (
              <button
                type="button"
                onClick={() => setModalFinalizarOpen(true)}
                disabled={!puedeFinalizar || loading}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5',
                  puedeFinalizar
                    ? 'bg-slate-800 text-white hover:bg-slate-900'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                )}
                title={
                  cantidadEstimados > 0
                    ? `${cantidadEstimados} costo(s) aún en estimado`
                    : costos.length === 0
                    ? 'Agrega al menos un costo'
                    : 'Finalizar costos (CTRU definitivo)'
                }
              >
                <Lock className="w-3.5 h-3.5" aria-hidden /> Finalizar costos
              </button>
            )}
          </div>
        </div>

        {/* Total landed */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-sm">
          <span className="text-slate-600">Total landed acumulado</span>
          <span className="font-bold text-slate-900 tabular-nums">
            {formatPEN(totalPEN)}
            {cantidadEstimados > 0 && (
              <span className="ml-2 text-xs font-normal text-amber-700">
                · CTRU preliminar
              </span>
            )}
            {envioFinalizado && (
              <span className="ml-2 text-xs font-normal text-emerald-700">
                · CTRU definitivo
              </span>
            )}
          </span>
        </div>
      </div>

      {/* ═══ Empty state ═══ */}
      {costos.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center">
          <DollarSign className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden />
          <div className="text-sm font-medium text-slate-700">
            Sin costos landed registrados
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Agrega flete, fee de recepción, aduana u otros costos para calcular el CTRU
            landed de cada unidad.
          </div>
          {puedeAgregar && (
            <button
              type="button"
              onClick={() => setModalAgregarOpen(true)}
              disabled={loading}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden /> Agregar primer costo
            </button>
          )}
        </div>
      )}

      {/* ═══ Sección: Costos globales del envío ═══ */}
      {costosPorScope.globales.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Costos del envío (globales)
              </span>
              <span className="text-[10px] text-slate-400">
                · afectan todas las unidades
              </span>
            </div>
            <span className="text-xs font-medium text-slate-700 tabular-nums">
              {costosPorScope.globales.length} costo
              {costosPorScope.globales.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {costosPorScope.globales.map((c) => (
              <CostoLandedRow
                key={c.id}
                costo={c}
                onConfirmar={onConfirmarCosto ? () => onConfirmarCosto(c.id) : undefined}
                onEditar={onEditarCosto}
                onEliminar={onEliminarCosto ? () => onEliminarCosto(c.id) : undefined}
                envioFinalizado={envioFinalizado}
              />
            ))}
          </div>
        </div>
      )}

      {/* ═══ Sección: Costos por tanda ═══ */}
      {subEnvios.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Costos por tanda
            </span>
            <span className="text-[10px] text-slate-400">
              · afectan solo las unidades de cada sub-tanda
            </span>
          </div>

          {subEnvios.map((se) => {
            const costosDeTanda = costosPorScope.porTanda.get(se.id) ?? [];
            return (
              <TandaCostosSection
                key={se.id}
                tanda={se}
                costos={costosDeTanda}
                onConfirmar={onConfirmarCosto}
                onEditar={onEditarCosto}
                onEliminar={onEliminarCosto}
                onAgregarEnEstaTanda={
                  puedeAgregar ? () => abrirAgregarEnTanda(se.id) : undefined
                }
                envioFinalizado={envioFinalizado}
              />
            );
          })}
        </div>
      )}

      {/* ═══ Modales ═══ */}
      {onAgregarCosto && (
        <AgregarCostoLandedModal
          isOpen={modalAgregarOpen}
          onClose={() => {
            setModalAgregarOpen(false);
            setTandaIdPre(undefined);
          }}
          subEnvios={subEnvios}
          tandaIdPreseleccionada={tandaIdPre}
          tipoCambioActual={tipoCambioActual}
          categoriasDisponibles={categoriasDisponibles}
          onConfirm={handleAgregar}
          loading={submitting}
        />
      )}

      {onFinalizarCostos && (
        <FinalizarCostosModal
          isOpen={modalFinalizarOpen}
          onClose={() => setModalFinalizarOpen(false)}
          costosLanded={costos}
          envioNumero={envio.numeroEnvio}
          unidadesAfectadas={envio.totalUnidades}
          onConfirm={handleFinalizar}
          loading={submitting}
        />
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Sub-componente: sección de costos de una tanda específica
// ════════════════════════════════════════════════════════════════════════════

interface TandaCostosSectionProps {
  tanda: SubEnvioT1;
  costos: CostoLanded[];
  onConfirmar?: (costoId: string) => void | Promise<void>;
  onEditar?: (costo: CostoLanded) => void;
  onEliminar?: (costoId: string) => void | Promise<void>;
  onAgregarEnEstaTanda?: () => void;
  envioFinalizado: boolean;
}

const TandaCostosSection: React.FC<TandaCostosSectionProps> = ({
  tanda,
  costos,
  onConfirmar,
  onEditar,
  onEliminar,
  onAgregarEnEstaTanda,
  envioFinalizado,
}) => {
  const esReemplazo = tanda.tipo === 'reemplazo';
  const totalTandaPEN = costos.reduce((sum, c) => sum + c.montoPEN, 0);
  const estimadosEnTanda = costos.filter(
    (c) => (c.estado ?? 'estimado') === 'estimado'
  ).length;

  return (
    <div
      className={cn(
        'bg-white border rounded-xl overflow-hidden',
        esReemplazo ? 'border-violet-200' : 'border-slate-200'
      )}
    >
      <div
        className={cn(
          'px-4 py-2.5 border-b flex items-center justify-between gap-2',
          esReemplazo
            ? 'bg-violet-50 border-violet-200'
            : 'bg-slate-50 border-slate-200'
        )}
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-xs font-semibold text-slate-900">
            Tanda {tanda.secuencia}
          </span>
          {esReemplazo && (
            <span className="text-[10px] px-1.5 py-0.5 bg-violet-200 text-violet-900 rounded font-bold">
              📦 REEMPLAZO
            </span>
          )}
          <span className="text-[10px] text-slate-500">
            · {tanda.unidadesIds.length} uds · {tanda.estado}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {costos.length > 0 && (
            <span className="text-xs font-medium tabular-nums text-slate-700">
              {formatPEN(totalTandaPEN)}
              {estimadosEnTanda > 0 && (
                <span className="ml-1 text-[10px] text-amber-700">
                  · {estimadosEnTanda} est.
                </span>
              )}
            </span>
          )}
          {onAgregarEnEstaTanda && !envioFinalizado && (
            <button
              type="button"
              onClick={onAgregarEnEstaTanda}
              className="text-[10px] px-2 py-0.5 text-violet-700 border border-violet-300 rounded hover:bg-violet-50 inline-flex items-center gap-1"
              title="Agregar costo a esta tanda"
            >
              <Plus className="w-3 h-3" aria-hidden /> Costo
            </button>
          )}
        </div>
      </div>

      {costos.length === 0 ? (
        <div className="px-4 py-4 text-xs text-slate-400 italic text-center">
          Sin costos específicos de esta tanda
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {costos.map((c) => (
            <CostoLandedRow
              key={c.id}
              costo={c}
              tandaLabel={`Tanda ${tanda.secuencia}`}
              onConfirmar={onConfirmar ? () => onConfirmar(c.id) : undefined}
              onEditar={onEditar}
              onEliminar={onEliminar ? () => onEliminar(c.id) : undefined}
              envioFinalizado={envioFinalizado}
            />
          ))}
        </div>
      )}
    </div>
  );
};
