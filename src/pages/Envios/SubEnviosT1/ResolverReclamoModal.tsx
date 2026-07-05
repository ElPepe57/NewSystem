/**
 * ResolverReclamoModal — Modal para resolver un reclamo con una de las 3
 * salidas posibles (D-16):
 *   1. Reembolso    → destinatario paga dinero (ingreso_otro)
 *   2. Reemplazo    → destinatario envía otra unidad (crea sub-tanda, CTRU preservado)
 *   3. Merma        → destinatario no asume (gasto_merma, afecta ranking)
 *
 * Migrado a FormModalV2 (canon). Icono: Gavel · iconTone="purple" (semántico reclamo
 * según mockup ACTO 11 · bg-purple-50 · nota "reclamos violet"). submit color="orange"
 * (chrome Inventario). Funcionalidad preservada íntegra.
 *
 * Al seleccionar "Reemplazo" se destaca visualmente con borde violet.
 * El consumidor es responsable de:
 *  - Disparar el flujo real (cobrar, crear sub-tanda, cerrar reclamo)
 *  - Cerrar el modal al terminar
 */
import React, { useState } from 'react';
import { DollarSign, Package, Trash2, Info, Link, Gavel, PackagePlus, Check } from 'lucide-react';
import { FormModalV2 } from '../../../design-system';
import { cn } from '../../../design-system';
import type { TipoResolucionReclamo } from '../../../types/reclamo.types';

// ════════════════════════════════════════════════════════════════════════════
// Tipos
// ════════════════════════════════════════════════════════════════════════════

export interface ResolverReclamoModalReclamoInfo {
  numeroReclamo: string;
  envioNumero: string;
  unidadesCount: number;
  unidadLabel?: string;         // Ej: "WellnessLabs NAD+ 1500mg"
  unidadCodigo?: string;        // Ej: "#UN-9001"
  montoReclamadoUSD: number;
  montoReclamadoPEN?: number;
  destinatarioNombre: string;
}

export interface ResolverReclamoModalResult {
  tipoResolucion: TipoResolucionReclamo;

  // ─── Solo si tipo='reembolso' ───
  montoAcordadoUSD?: number;
  cuentaCobroId?: string;
  fechaCobroEstimada?: Date;

  // ─── Solo si tipo='reemplazo' ───
  reemplazoTracking?: string;
  reemplazoFechaEstimada?: Date;

  // Comun
  notas?: string;
}

export interface ResolverReclamoModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Contexto del reclamo a resolver */
  reclamo: ResolverReclamoModalReclamoInfo;
  /** Cuentas de tesorería disponibles para recibir el pago (reembolso) */
  cuentasCobro?: Array<{ id: string; nombre: string }>;
  onConfirm: (result: ResolverReclamoModalResult) => void | Promise<void>;
  loading?: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

const formatUSD = (n: number): string => `$${n.toFixed(2)}`;

// ════════════════════════════════════════════════════════════════════════════
// Componente
// ════════════════════════════════════════════════════════════════════════════

export const ResolverReclamoModal: React.FC<ResolverReclamoModalProps> = ({
  isOpen,
  onClose,
  reclamo,
  cuentasCobro = [],
  onConfirm,
  loading: loadingExt = false,
}) => {
  const [tipo, setTipo] = useState<TipoResolucionReclamo>('reemplazo');

  // Reembolso
  const [montoAcordado, setMontoAcordado] = useState<string>(String(reclamo.montoReclamadoUSD));
  const [cuentaCobroId, setCuentaCobroId] = useState<string>(cuentasCobro[0]?.id || '');
  const [fechaCobroEstimada, setFechaCobroEstimada] = useState<string>('');

  // Reemplazo
  const [reemplazoTracking, setReemplazoTracking] = useState<string>('');
  const [reemplazoFechaEstimada, setReemplazoFechaEstimada] = useState<string>('');

  // Común
  const [notas, setNotas] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const loading = loadingExt || submitting;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const result: ResolverReclamoModalResult = {
        tipoResolucion: tipo,
        notas: notas.trim() || undefined,
        ...(tipo === 'reembolso'
          ? {
              montoAcordadoUSD: parseFloat(montoAcordado) || 0,
              cuentaCobroId: cuentaCobroId || undefined,
              fechaCobroEstimada: fechaCobroEstimada ? new Date(fechaCobroEstimada) : undefined,
            }
          : {}),
        ...(tipo === 'reemplazo'
          ? {
              reemplazoTracking: reemplazoTracking.trim() || undefined,
              reemplazoFechaEstimada: reemplazoFechaEstimada
                ? new Date(reemplazoFechaEstimada)
                : undefined,
            }
          : {}),
      };
      await onConfirm(result);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit label dinámico por vía
  const submitLabel =
    tipo === 'reemplazo'
      ? 'Crear tanda reemplazo'
      : tipo === 'reembolso'
      ? 'Confirmar reembolso'
      : 'Confirmar merma';

  const submitIcon = tipo === 'reemplazo' ? PackagePlus : Check;

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      onSubmit={handleConfirm}
      title="Resolver reclamo"
      subtitle={`${reclamo.numeroReclamo} · ${reclamo.unidadesCount} uds · ${reclamo.montoReclamadoPEN ? `S/ ${reclamo.montoReclamadoPEN.toFixed(0)}` : formatUSD(reclamo.montoReclamadoUSD)}`}
      icon={Gavel}
      iconTone="orange"
      color="orange"
      size="lg"
      submitLabel={submitLabel}
      submitIcon={submitIcon}
      loading={loading}
      disabled={loading}
      disableBackdropClick={loading}
      disableEscapeKey={loading}
    >
      <div className="space-y-4">

        {/* ── Contexto del reclamo ── */}
        <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Envío</div>
            <div className="font-bold text-slate-900">{reclamo.envioNumero}</div>
            <div className="text-[11px] text-slate-500">Destinatario: {reclamo.destinatarioNombre}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Unidad reclamada</div>
            <div className="font-medium text-slate-900">
              {reclamo.unidadesCount} uds{reclamo.unidadLabel ? ` · ${reclamo.unidadLabel}` : ''}
            </div>
            {reclamo.unidadCodigo && (
              <div className="text-[11px] font-mono text-slate-500">{reclamo.unidadCodigo}</div>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Monto reclamado</div>
            <div className="font-bold tabular-nums text-amber-900">{formatUSD(reclamo.montoReclamadoUSD)}</div>
            {reclamo.montoReclamadoPEN && (
              <div className="text-[11px] tabular-nums text-slate-500">
                S/ {reclamo.montoReclamadoPEN.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* ── Vía de resolución · selector compacto (mockup: 3-card grid) ── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Vía de resolución</div>
          <div className="grid grid-cols-3 gap-2">

            {/* Reembolso */}
            <button
              type="button"
              onClick={() => !loading && setTipo('reembolso')}
              disabled={loading}
              className={cn(
                'text-left rounded-lg border-2 p-2.5 transition-colors',
                tipo === 'reembolso'
                  ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20'
                  : 'border-slate-200 bg-white hover:border-orange-300'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <DollarSign className="w-4 h-4 text-emerald-600" aria-hidden />
                {tipo === 'reembolso'
                  ? <span className="w-3.5 h-3.5 rounded-full bg-orange-600 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></span>
                  : <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
                }
              </div>
              <div className={cn('text-[11px] leading-tight', tipo === 'reembolso' ? 'font-bold text-slate-900' : 'font-medium text-slate-600')}>
                Reembolso
              </div>
            </button>

            {/* Reemplazo (default seleccionado) */}
            <button
              type="button"
              onClick={() => !loading && setTipo('reemplazo')}
              disabled={loading}
              className={cn(
                'text-left rounded-lg border-2 p-2.5 transition-colors',
                tipo === 'reemplazo'
                  ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20'
                  : 'border-slate-200 bg-white hover:border-orange-300'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <Package className="w-4 h-4 text-violet-600" aria-hidden />
                {tipo === 'reemplazo'
                  ? <span className="w-3.5 h-3.5 rounded-full bg-orange-600 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></span>
                  : <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
                }
              </div>
              <div className={cn('text-[11px] leading-tight', tipo === 'reemplazo' ? 'font-bold text-slate-900' : 'font-medium text-slate-600')}>
                Reemplazo
              </div>
            </button>

            {/* Merma */}
            <button
              type="button"
              onClick={() => !loading && setTipo('merma')}
              disabled={loading}
              className={cn(
                'text-left rounded-lg border-2 p-2.5 transition-colors',
                tipo === 'merma'
                  ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20'
                  : 'border-slate-200 bg-white hover:border-orange-300'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <Trash2 className="w-4 h-4 text-red-600" aria-hidden />
                {tipo === 'merma'
                  ? <span className="w-3.5 h-3.5 rounded-full bg-orange-600 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></span>
                  : <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
                }
              </div>
              <div className={cn('text-[11px] leading-tight', tipo === 'merma' ? 'font-bold text-slate-900' : 'font-medium text-slate-600')}>
                Merma
              </div>
            </button>

          </div>
        </div>

        {/* ── Detalle contextual por vía ── */}

        {/* Reembolso · detalle */}
        {tipo === 'reembolso' && (
          <div className="space-y-3">
            <div className="bg-emerald-50 ring-1 ring-emerald-200/60 rounded-lg px-3 py-2.5 text-[11px] text-emerald-800 leading-snug">
              El destinatario acepta devolver el dinero de la unidad. Se registra ingreso en tesorería.
              Reclamo transita a <code className="bg-white/70 px-1 rounded">cobrado</code> · unidad a{' '}
              <code className="bg-white/70 px-1 rounded">perdida_total</code>.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                  Monto acordado USD
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={montoAcordado}
                  onChange={(e) => setMontoAcordado(e.target.value)}
                  disabled={loading}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-[12px] tabular-nums focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                  Cuenta tesorería
                </label>
                <select
                  value={cuentaCobroId}
                  onChange={(e) => setCuentaCobroId(e.target.value)}
                  disabled={loading}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">— Selecciona —</option>
                  {cuentasCobro.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                  Fecha cobro estimada
                </label>
                <input
                  type="date"
                  value={fechaCobroEstimada}
                  onChange={(e) => setFechaCobroEstimada(e.target.value)}
                  disabled={loading}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Reemplazo · detalle */}
        {tipo === 'reemplazo' && (
          <div className="space-y-3">
            <div className="bg-violet-50 ring-1 ring-violet-200/60 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <PackagePlus className="w-3.5 h-3.5 text-violet-600 flex-shrink-0 mt-0.5" aria-hidden />
              <div className="text-[11px] text-violet-800 leading-snug">
                Se creará una <span className="font-semibold">tanda de reemplazo</span> con las{' '}
                {reclamo.unidadesCount} unidades por reponer. CTRU preservado en{' '}
                <span className="tabular-nums font-semibold">{formatUSD(reclamo.montoReclamadoUSD)}</span>.{' '}
                Reclamo queda <code className="bg-white/70 px-1 rounded">aceptado</code> pendiente de llegada.
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                  Tracking del reemplazo <span className="text-slate-400 normal-case font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={reemplazoTracking}
                  onChange={(e) => setReemplazoTracking(e.target.value)}
                  placeholder="Ej. TBA-REPL-789"
                  disabled={loading}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                  Fecha estimada de llegada
                </label>
                <input
                  type="date"
                  value={reemplazoFechaEstimada}
                  onChange={(e) => setReemplazoFechaEstimada(e.target.value)}
                  disabled={loading}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
            <div className="text-[11px] text-violet-700 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden />
              <span>Si el reemplazo también falla, podés reabrir el reclamo y convertirlo a <strong>Merma</strong>.</span>
            </div>
          </div>
        )}

        {/* Merma · detalle */}
        {tipo === 'merma' && (
          <div className="bg-red-50 ring-1 ring-red-200/60 rounded-lg px-3 py-2.5 text-[11px] text-red-800 leading-snug space-y-1">
            <div>El destinatario rechaza el reclamo o no responde. Asumimos la pérdida contable.</div>
            <ul className="list-disc list-inside text-[11px] text-red-700 space-y-0.5 mt-1">
              <li>Reclamo transita a <code className="bg-white/70 px-1 rounded">rechazado</code> o{' '}
                <code className="bg-white/70 px-1 rounded">cerrado_sin_cobrar</code></li>
              <li>Gasto: <code className="bg-white/70 px-1 rounded">gasto_merma_transferencia</code></li>
              <li>Unidad → <code className="bg-white/70 px-1 rounded">perdida_total</code></li>
              <li>Afecta ranking de integridad del destinatario</li>
            </ul>
          </div>
        )}

        {/* ── Notas de la resolución ── */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
            Notas de la resolución <span className="text-slate-400 normal-case font-normal">(opcional)</span>
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Ej. Proveedor confirmó reemplazo vía email del 20-abr"
            disabled={loading}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 resize-none"
          />
        </div>

        {/* ── Nota de trazabilidad (informativa · siempre visible) ── */}
        <div className="flex items-start gap-2 bg-sky-50 ring-1 ring-sky-200/60 rounded-lg px-3 py-2.5">
          <Link className="w-3.5 h-3.5 text-sky-600 flex-shrink-0 mt-0.5" aria-hidden />
          <span className="text-[11px] text-sky-800 leading-snug">
            <strong>Trazabilidad:</strong> la unidad mantiene su <code className="bg-white/70 px-1 rounded">unidadId</code>{' '}
            original. Su historial queda con la tanda original + la tanda de reemplazo (al recibirla). Auditoría completa.
          </span>
        </div>

      </div>
    </FormModalV2>
  );
};
