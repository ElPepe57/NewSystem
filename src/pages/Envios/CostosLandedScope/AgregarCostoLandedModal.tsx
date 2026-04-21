/**
 * AgregarCostoLandedModal — Modal para agregar un costo landed al envío.
 *
 * Implementa D-17 + D-18:
 *   - Selector scope: envío completo (global) vs tanda específica
 *   - Si scope='tanda': dropdown con las sub-tandas disponibles
 *   - Estado inicial: estimado (default) o confirmado
 *   - Campos comunes: concepto, descripción, monto USD, TC, método prorrateo
 *   - Si estado=confirmado: campo facturaReferencia opcional
 *   - Si estado=estimado: campo motivoEstimado opcional (ej. "pendiente factura")
 */
import React, { useMemo, useState } from 'react';
import { DollarSign, Package } from 'lucide-react';
import { Modal, Button } from '../../../components/common';
import { cn } from '../../../design-system';
import type {
  CostoLanded,
  SubEnvioT1,
  MetodoProrrateo,
} from '../../../types/envio.types';

// ════════════════════════════════════════════════════════════════════════════
// Tipos
// ════════════════════════════════════════════════════════════════════════════

export interface AgregarCostoLandedModalResult {
  categoriaCostoNombre: string;
  descripcion?: string;
  monto: number;
  moneda: 'USD' | 'PEN';
  tipoCambio?: number;
  metodoProrrateo: MetodoProrrateo;
  scope: 'envio' | 'tanda';
  tandaId?: string;
  estado: 'estimado' | 'confirmado';
  facturaReferencia?: string;
  motivoEstimado?: string;
}

export interface AgregarCostoLandedModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Sub-tandas disponibles (vacío si el envío no tiene sub-tandas) */
  subEnvios?: SubEnvioT1[];
  /** Sub-tanda pre-seleccionada (ej. cuando se abre desde una tanda específica) */
  tandaIdPreseleccionada?: string;
  /** TC actual para auto-completar */
  tipoCambioActual?: number;
  /** Categorías de costo disponibles (maestro) — opcional, permite input libre si no se provee */
  categoriasDisponibles?: Array<{ id: string; nombre: string }>;
  onConfirm: (result: AgregarCostoLandedModalResult) => void | Promise<void>;
  loading?: boolean;
}

const METODOS_PRORRATEO: Array<{ value: MetodoProrrateo; label: string; desc: string }> = [
  { value: 'total_por_peso', label: 'Por peso', desc: 'Unidades con más peso absorben más' },
  { value: 'total_por_valor', label: 'Por valor', desc: 'Proporcional al CTRU base' },
  { value: 'fijo_por_unidad', label: 'Fijo por unidad', desc: 'Cada unidad paga igual' },
  { value: 'variado_por_producto', label: 'Variable por producto', desc: 'Tarifa manual por SKU' },
];

// ════════════════════════════════════════════════════════════════════════════
// Componente
// ════════════════════════════════════════════════════════════════════════════

export const AgregarCostoLandedModal: React.FC<AgregarCostoLandedModalProps> = ({
  isOpen,
  onClose,
  subEnvios = [],
  tandaIdPreseleccionada,
  tipoCambioActual,
  categoriasDisponibles,
  onConfirm,
  loading: loadingExt = false,
}) => {
  // Form state
  const [concepto, setConcepto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'USD' | 'PEN'>('USD');
  const [tc, setTc] = useState<string>(String(tipoCambioActual ?? ''));
  const [metodo, setMetodo] = useState<MetodoProrrateo>('total_por_peso');
  const [scope, setScope] = useState<'envio' | 'tanda'>(
    tandaIdPreseleccionada ? 'tanda' : 'envio'
  );
  const [tandaId, setTandaId] = useState<string>(tandaIdPreseleccionada || '');
  const [estadoInicial, setEstadoInicial] = useState<'estimado' | 'confirmado'>('estimado');
  const [facturaRef, setFacturaRef] = useState('');
  const [motivoEstimado, setMotivoEstimado] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const loading = loadingExt || submitting;

  const hayTandas = subEnvios.length > 0;
  const montoNum = parseFloat(monto) || 0;
  const tcNum = parseFloat(tc) || 0;
  const puedeConfirmar =
    concepto.trim().length > 0 &&
    montoNum > 0 &&
    (moneda === 'PEN' || tcNum > 0) &&
    (scope === 'envio' || (scope === 'tanda' && !!tandaId));

  const resetForm = () => {
    setConcepto('');
    setDescripcion('');
    setMonto('');
    setMoneda('USD');
    setTc(String(tipoCambioActual ?? ''));
    setMetodo('total_por_peso');
    setScope(tandaIdPreseleccionada ? 'tanda' : 'envio');
    setTandaId(tandaIdPreseleccionada || '');
    setEstadoInicial('estimado');
    setFacturaRef('');
    setMotivoEstimado('');
  };

  const handleConfirm = async () => {
    if (!puedeConfirmar) return;
    setSubmitting(true);
    try {
      await onConfirm({
        categoriaCostoNombre: concepto.trim(),
        descripcion: descripcion.trim() || undefined,
        monto: montoNum,
        moneda,
        tipoCambio: moneda === 'USD' ? tcNum : undefined,
        metodoProrrateo: metodo,
        scope,
        tandaId: scope === 'tanda' ? tandaId : undefined,
        estado: estadoInicial,
        facturaReferencia:
          estadoInicial === 'confirmado' && facturaRef.trim()
            ? facturaRef.trim()
            : undefined,
        motivoEstimado:
          estadoInicial === 'estimado' && motivoEstimado.trim()
            ? motivoEstimado.trim()
            : undefined,
      });
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const tandaSeleccionada = useMemo(
    () => subEnvios.find((se) => se.id === tandaId),
    [subEnvios, tandaId]
  );

  if (!isOpen) return null;

  return (
    <Modal
      isOpen
      onClose={loading ? () => {} : onClose}
      title="Agregar costo landed"
      size="lg"
    >
      <div className="space-y-4">
        {/* ─── Scope: ¿a qué aplica? ─── */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
            ¿A qué aplica este costo?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label
              className={cn(
                'flex items-start gap-2 p-3 rounded-lg cursor-pointer transition-colors',
                scope === 'envio'
                  ? 'border-2 border-teal-400 bg-teal-50'
                  : 'border border-slate-200 hover:border-slate-300'
              )}
            >
              <input
                type="radio"
                name="scope"
                checked={scope === 'envio'}
                onChange={() => setScope('envio')}
                disabled={loading}
                className="w-4 h-4 mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-500" aria-hidden />
                  Todo el envío (global)
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  Se prorratea entre todas las unidades del envío
                </div>
              </div>
            </label>
            <label
              className={cn(
                'flex items-start gap-2 p-3 rounded-lg transition-colors',
                !hayTandas && 'opacity-50 cursor-not-allowed',
                hayTandas &&
                  (scope === 'tanda'
                    ? 'border-2 border-violet-400 bg-violet-50 cursor-pointer'
                    : 'border border-slate-200 hover:border-slate-300 cursor-pointer')
              )}
            >
              <input
                type="radio"
                name="scope"
                checked={scope === 'tanda'}
                onChange={() => setScope('tanda')}
                disabled={loading || !hayTandas}
                className="w-4 h-4 mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                  <span className="text-base" aria-hidden>📦</span>
                  Tanda específica
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  {hayTandas
                    ? 'Solo afecta las unidades de esta sub-tanda'
                    : 'El envío no tiene sub-tandas'}
                </div>
                {scope === 'tanda' && hayTandas && (
                  <select
                    value={tandaId}
                    onChange={(e) => setTandaId(e.target.value)}
                    disabled={loading}
                    className="w-full mt-2 px-2 py-1 text-xs border border-violet-300 rounded"
                  >
                    <option value="">— Selecciona tanda —</option>
                    {subEnvios.map((se) => (
                      <option key={se.id} value={se.id}>
                        Tanda {se.secuencia}
                        {se.tipo === 'reemplazo' ? ' · 📦 Reemplazo' : ''}
                        {` · ${se.unidadesIds.length} uds · ${se.estado}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* ─── Concepto + descripción ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={categoriasDisponibles ? '' : 'sm:col-span-2'}>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Concepto <span className="text-red-500">*</span>
            </label>
            {categoriasDisponibles && categoriasDisponibles.length > 0 ? (
              <select
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="">— Selecciona —</option>
                {categoriasDisponibles.map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej. Flete del viajero, Fee recepción, Aduana, etc."
                disabled={loading}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            )}
          </div>
          {categoriasDisponibles && (
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Descripción <span className="text-slate-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Detalle o nota interna"
                disabled={loading}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          )}
        </div>
        {!categoriasDisponibles && (
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Descripción <span className="text-slate-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalle o nota interna"
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
        )}

        {/* ─── Monto + moneda + TC ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Monto <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                {moneda === 'USD' ? '$' : 'S/'}
              </span>
              <input
                type="number"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                disabled={loading}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Moneda</label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as 'USD' | 'PEN')}
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="USD">USD</option>
              <option value="PEN">PEN</option>
            </select>
          </div>
          {moneda === 'USD' && (
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Tipo de cambio <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.001"
                value={tc}
                onChange={(e) => setTc(e.target.value)}
                placeholder="3.78"
                disabled={loading}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          )}
        </div>

        {/* ─── Método de prorrateo ─── */}
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-2">
            Método de prorrateo
          </label>
          <div className="grid grid-cols-2 gap-2">
            {METODOS_PRORRATEO.map((m) => (
              <label
                key={m.value}
                className={cn(
                  'flex items-start gap-2 p-2 rounded cursor-pointer transition-colors text-xs',
                  metodo === m.value
                    ? 'border-2 border-teal-400 bg-teal-50'
                    : 'border border-slate-200 hover:border-slate-300'
                )}
              >
                <input
                  type="radio"
                  name="metodo"
                  checked={metodo === m.value}
                  onChange={() => setMetodo(m.value)}
                  disabled={loading}
                  className="w-3.5 h-3.5 mt-0.5"
                />
                <div>
                  <div className="font-medium text-slate-900">{m.label}</div>
                  <div className="text-[10px] text-slate-600">{m.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* ─── Estado inicial ─── */}
        <div className="p-3 bg-slate-50 rounded border border-slate-200">
          <label className="text-xs font-medium text-slate-700 block mb-2">
            Estado inicial del costo
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label
              className={cn(
                'flex items-start gap-2 p-2 rounded cursor-pointer transition-colors',
                estadoInicial === 'estimado'
                  ? 'border-2 border-amber-400 bg-amber-50'
                  : 'border border-slate-200 hover:border-slate-300'
              )}
            >
              <input
                type="radio"
                checked={estadoInicial === 'estimado'}
                onChange={() => setEstadoInicial('estimado')}
                disabled={loading}
                className="w-3.5 h-3.5 mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-slate-900">⏳ Estimado</div>
                <div className="text-[10px] text-slate-600">
                  Aún no tengo factura firme · bloquea cierre financiero
                </div>
              </div>
            </label>
            <label
              className={cn(
                'flex items-start gap-2 p-2 rounded cursor-pointer transition-colors',
                estadoInicial === 'confirmado'
                  ? 'border-2 border-emerald-400 bg-emerald-50'
                  : 'border border-slate-200 hover:border-slate-300'
              )}
            >
              <input
                type="radio"
                checked={estadoInicial === 'confirmado'}
                onChange={() => setEstadoInicial('confirmado')}
                disabled={loading}
                className="w-3.5 h-3.5 mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-slate-900">✓ Confirmado</div>
                <div className="text-[10px] text-slate-600">
                  Ya tengo factura · entra al CTRU final
                </div>
              </div>
            </label>
          </div>

          {/* Campos condicionales según estado */}
          {estadoInicial === 'estimado' && (
            <div className="mt-3">
              <label className="text-[10px] text-slate-600 block mb-1">
                Motivo del estimado <span className="text-slate-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={motivoEstimado}
                onChange={(e) => setMotivoEstimado(e.target.value)}
                placeholder="Ej. Pendiente factura del viajero"
                disabled={loading}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
              />
            </div>
          )}
          {estadoInicial === 'confirmado' && (
            <div className="mt-3">
              <label className="text-[10px] text-slate-600 block mb-1">
                Referencia de factura <span className="text-slate-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={facturaRef}
                onChange={(e) => setFacturaRef(e.target.value)}
                placeholder="Ej. F-2026-123"
                disabled={loading}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
              />
            </div>
          )}
        </div>

        {/* Contexto informativo */}
        {scope === 'tanda' && tandaSeleccionada && (
          <div className="text-xs text-slate-600 bg-violet-50 border border-violet-200 rounded p-2">
            ℹ️ Este costo se prorrateará solo entre las{' '}
            <strong>{tandaSeleccionada.unidadesIds.length} unidades</strong> de la
            Tanda {tandaSeleccionada.secuencia}.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={!puedeConfirmar || loading}>
          <DollarSign className="w-4 h-4 mr-1.5" aria-hidden />
          {loading ? 'Agregando...' : 'Agregar costo'}
        </Button>
      </div>
    </Modal>
  );
};
