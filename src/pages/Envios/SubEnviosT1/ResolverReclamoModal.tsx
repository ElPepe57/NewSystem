/**
 * ResolverReclamoModal — Modal para resolver un reclamo con una de las 3
 * salidas posibles (D-16):
 *   1. 💰 Reembolso    → destinatario paga dinero (ingreso_otro)
 *   2. 📦 Reemplazo    → destinatario envía otra unidad (crea sub-tanda, CTRU preservado)
 *   3. 🗑️ Merma       → destinatario no asume (gasto_merma, afecta ranking)
 *
 * UI (basada en mockup pixel-perfect docs/mockups/envios-transversal-s43.html
 *     tab "Reclamos" sección "Modal Resolver reclamo"):
 *  - Contexto del reclamo (envío, unidad, monto)
 *  - 3 cards radio con campos contextuales por opción
 *  - Notas de resolución + botones Cancelar / Confirmar
 *
 * Al seleccionar "Reemplazo" se destaca visualmente con borde violet.
 * El consumidor es responsable de:
 *  - Disparar el flujo real (cobrar, crear sub-tanda, cerrar reclamo)
 *  - Cerrar el modal al terminar
 */
import React, { useState } from 'react';
import { Modal, Button } from '../../../components/common';
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
// Componente
// ════════════════════════════════════════════════════════════════════════════

const formatUSD = (n: number): string => `$${n.toFixed(2)}`;

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

  if (!isOpen) return null;

  return (
    <Modal
      isOpen
      onClose={loading ? () => {} : onClose}
      title={`Resolver reclamo · ${reclamo.numeroReclamo}`}
      size="lg"
    >
      {/* Contexto del reclamo */}
      <div className="bg-slate-50 rounded-lg p-4 mb-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-slate-500">Envío</div>
            <div className="font-bold text-slate-900">{reclamo.envioNumero}</div>
            <div className="text-[10px] text-slate-500">
              Destinatario: {reclamo.destinatarioNombre}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Unidad reclamada</div>
            <div className="font-medium text-slate-900">
              {reclamo.unidadesCount} uds{reclamo.unidadLabel ? ` · ${reclamo.unidadLabel}` : ''}
            </div>
            {reclamo.unidadCodigo && (
              <div className="text-[10px] font-mono text-slate-500">{reclamo.unidadCodigo}</div>
            )}
          </div>
          <div>
            <div className="text-xs text-slate-500">Monto reclamado</div>
            <div className="font-bold text-slate-900">{formatUSD(reclamo.montoReclamadoUSD)}</div>
            {reclamo.montoReclamadoPEN && (
              <div className="text-[10px] text-slate-500 tabular-nums">
                S/ {reclamo.montoReclamadoPEN.toFixed(2)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3 opciones de resolución */}
      <div className="space-y-3">
        {/* ─── REEMBOLSO ─── */}
        <label
          className={cn(
            'flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors',
            tipo === 'reembolso'
              ? 'border-2 border-emerald-400 bg-emerald-50'
              : 'border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30'
          )}
        >
          <input
            type="radio"
            name="resolucion"
            value="reembolso"
            checked={tipo === 'reembolso'}
            onChange={() => setTipo('reembolso')}
            disabled={loading}
            className="w-4 h-4 mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl" aria-hidden>💰</span>
              <span className="font-bold text-slate-900">
                Reembolso — el destinatario paga el valor
              </span>
            </div>
            <div className="text-xs text-slate-700 mb-2">
              El destinatario acepta devolver el dinero de la unidad. Se registra ingreso en tesorería.
            </div>
            <ul className="text-xs space-y-0.5 pl-4 text-slate-600 border-l-2 border-emerald-300 ml-1">
              <li>Reclamo transita a <code className="bg-white px-1 rounded">cobrado</code></li>
              <li>Tesorería: <code className="bg-white px-1 rounded">ingreso_otro</code></li>
              <li>Unidad → estado <code className="bg-white px-1 rounded">perdida_total</code></li>
            </ul>
            {tipo === 'reembolso' && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-600 block">Monto acordado USD</label>
                  <input
                    type="number"
                    step="0.01"
                    value={montoAcordado}
                    onChange={(e) => setMontoAcordado(e.target.value)}
                    disabled={loading}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-600 block">Cuenta tesorería</label>
                  <select
                    value={cuentaCobroId}
                    onChange={(e) => setCuentaCobroId(e.target.value)}
                    disabled={loading}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
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
                  <label className="text-[10px] text-slate-600 block">Fecha cobro estimada</label>
                  <input
                    type="date"
                    value={fechaCobroEstimada}
                    onChange={(e) => setFechaCobroEstimada(e.target.value)}
                    disabled={loading}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </label>

        {/* ─── REEMPLAZO (destacado por default) ─── */}
        <label
          className={cn(
            'flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors',
            tipo === 'reemplazo'
              ? 'border-2 border-violet-400 bg-violet-50'
              : 'border border-slate-200 hover:border-violet-300 hover:bg-violet-50/30'
          )}
        >
          <input
            type="radio"
            name="resolucion"
            value="reemplazo"
            checked={tipo === 'reemplazo'}
            onChange={() => setTipo('reemplazo')}
            disabled={loading}
            className="w-4 h-4 mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-2xl" aria-hidden>📦</span>
              <span className="font-bold text-slate-900">
                Reemplazo — el destinatario envía otra unidad
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-violet-200 text-violet-900 rounded font-bold">
                D-16 · NUEVO
              </span>
            </div>
            <div className="text-xs text-slate-700 mb-2">
              El destinatario acepta mandar físicamente la unidad faltante. Se crea una nueva tanda
              dentro del mismo envío T1.
            </div>
            <ul className="text-xs space-y-0.5 pl-4 text-slate-600 border-l-2 border-violet-400 ml-1 mb-2">
              <li>
                Reclamo queda <code className="bg-white px-1 rounded">aceptado</code> pendiente de
                llegada
              </li>
              <li>
                Se crea sub-tanda con <code className="bg-white px-1 rounded">tipo=reemplazo</code>
              </li>
              <li>
                CTRU de la unidad se <strong>preserva</strong> en {formatUSD(reclamo.montoReclamadoUSD)}
              </li>
              <li>Sin asiento contable (reemplazo gratuito)</li>
            </ul>
            {tipo === 'reemplazo' && (
              <div className="p-3 bg-white rounded border border-violet-200 space-y-2">
                <div className="text-xs font-medium text-violet-900">
                  Datos de la nueva tanda de reemplazo:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-600 block">
                      Tracking del reemplazo (opcional)
                    </label>
                    <input
                      type="text"
                      value={reemplazoTracking}
                      onChange={(e) => setReemplazoTracking(e.target.value)}
                      placeholder="Ej. TBA-REPL-789"
                      disabled={loading}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 block">
                      Fecha estimada de llegada
                    </label>
                    <input
                      type="date"
                      value={reemplazoFechaEstimada}
                      onChange={(e) => setReemplazoFechaEstimada(e.target.value)}
                      disabled={loading}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-violet-700 italic">
                  ℹ️ Si el reemplazo también falla, puedes reabrir el reclamo y convertirlo a <strong>Merma</strong>.
                </div>
              </div>
            )}
          </div>
        </label>

        {/* ─── MERMA ─── */}
        <label
          className={cn(
            'flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors',
            tipo === 'merma'
              ? 'border-2 border-red-400 bg-red-50'
              : 'border border-slate-200 hover:border-red-300 hover:bg-red-50/30'
          )}
        >
          <input
            type="radio"
            name="resolucion"
            value="merma"
            checked={tipo === 'merma'}
            onChange={() => setTipo('merma')}
            disabled={loading}
            className="w-4 h-4 mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl" aria-hidden>🗑️</span>
              <span className="font-bold text-slate-900">Merma — el destinatario no asume</span>
            </div>
            <div className="text-xs text-slate-700 mb-2">
              El destinatario rechaza el reclamo o no responde. Asumimos la pérdida contable.
            </div>
            <ul className="text-xs space-y-0.5 pl-4 text-slate-600 border-l-2 border-red-300 ml-1">
              <li>
                Reclamo transita a <code className="bg-white px-1 rounded">rechazado</code> o{' '}
                <code className="bg-white px-1 rounded">cerrado_sin_cobrar</code>
              </li>
              <li>
                Gasto: <code className="bg-white px-1 rounded">gasto_merma_transferencia</code>
              </li>
              <li>Unidad → <code className="bg-white px-1 rounded">perdida_total</code></li>
              <li>Afecta ranking de integridad del destinatario</li>
            </ul>
          </div>
        </label>
      </div>

      {/* Notas */}
      <div className="mt-4">
        <label className="text-xs font-medium text-slate-700 block mb-1">
          Notas de la resolución <span className="text-slate-400">(opcional)</span>
        </label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Ej. Proveedor confirmó reemplazo vía email del 20-abr"
          disabled={loading}
          className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={loading}>
          {loading
            ? 'Confirmando...'
            : tipo === 'reemplazo'
            ? '✓ Confirmar — crear tanda reemplazo'
            : tipo === 'reembolso'
            ? '✓ Confirmar reembolso'
            : '✓ Confirmar merma'}
        </Button>
      </div>

      {/* Nota al pie */}
      <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded text-xs text-sky-900">
        <strong>🔗 Trazabilidad:</strong> la unidad mantiene su <code className="bg-white px-1 rounded">unidadId</code> original. Su historial queda con la tanda original + la tanda de reemplazo (al recibirla). Auditoría completa.
      </div>
    </Modal>
  );
};
