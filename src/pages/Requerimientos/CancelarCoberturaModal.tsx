/**
 * CancelarCoberturaModal · UI de B5 (F4 · HUB-5).
 *
 * Cancela la cobertura de UNA OC sobre el requerimiento. 3 alcances (`cancelarReferenciaOC`):
 *  - req_en_oc  : retrae solo las refs de ESTE req (la OC consolidada sigue viva para los demás).
 *  - porcion    : reduce N de M unidades de un producto · el pendiente sube por N.
 *  - oc_completa: cancela la cobertura sobre TODOS los reqs de la OC.
 * La irreversibilidad la fija el estado de la OC (borrador retrae al pool · firme deja rastro y la
 * compra procede). FormModalV2 (canon · grupo Comercial). Spec: mockup Acto 7.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { XCircle, AlertTriangle } from 'lucide-react';
import { FormModalV2, Combobox, type ComboboxGroup } from '../../design-system';
import type { Requerimiento, MotivoCancelacionOC } from '../../types/requerimiento.types';
import { LABEL_MOTIVO_CANCELACION_OC, GRUPO_MOTIVO_PROVEEDOR, GRUPO_MOTIVO_INTERNO } from '../../types/requerimiento.types';

export type AlcanceCancelacion = 'req_en_oc' | 'porcion' | 'oc_completa';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  req: Requerimiento | null;
  ocId: string;
  ocNumero: string;
  loading?: boolean;
  onConfirm: (params: {
    scope: AlcanceCancelacion;
    productoId?: string;
    cantidadCancelar?: number;
    motivo: MotivoCancelacionOC;
    motivoDetalle?: string;
  }) => void;
}

/** Motivos agrupados (proveedor / interno) para el Combobox del DS. */
const MOTIVO_GROUPS: ComboboxGroup<MotivoCancelacionOC>[] = [
  { label: 'El proveedor no cumple', options: GRUPO_MOTIVO_PROVEEDOR.map(m => ({ value: m, label: LABEL_MOTIVO_CANCELACION_OC[m] })) },
  { label: 'Tu lado (interno)', options: GRUPO_MOTIVO_INTERNO.map(m => ({ value: m, label: LABEL_MOTIVO_CANCELACION_OC[m] })) },
];

const OPCIONES: Array<{ value: AlcanceCancelacion; label: string; desc: string }> = [
  { value: 'req_en_oc', label: 'Solo este requerimiento', desc: 'Retrae las refs de este req · la OC consolidada sigue viva para los demás.' },
  { value: 'porcion', label: 'Porción (N de M unidades)', desc: 'Reduce la cantidad pedida de un producto · el pendiente sube por N.' },
  { value: 'oc_completa', label: 'OC completa', desc: 'Cancela la cobertura sobre todos los reqs de la OC.' },
];

export const CancelarCoberturaModal: React.FC<Props> = ({ isOpen, onClose, req, ocId, ocNumero, loading, onConfirm }) => {
  const [scope, setScope] = useState<AlcanceCancelacion>('req_en_oc');
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [motivo, setMotivo] = useState<MotivoCancelacionOC | undefined>(undefined);
  const [motivoDetalle, setMotivoDetalle] = useState('');

  // Reset del form en cada apertura (la instancia se mantiene montada · evita arrastrar selección previa).
  useEffect(() => {
    if (isOpen) {
      setScope('req_en_oc');
      setProductoId('');
      setCantidad(1);
      setMotivo(undefined);
      setMotivoDetalle('');
    }
  }, [isOpen]);

  // Productos del req que tienen una ref a ESTA OC (para el alcance 'porcion')
  const productosEnOC = useMemo(
    () => (req?.productos || []).filter(p => p.ordenCompraRefs?.some(r => r.ordenCompraId === ocId)),
    [req, ocId]
  );

  const productoSel = productosEnOC.find(p => p.productoId === productoId);
  const maxCantidad = productoSel
    ? (productoSel.ordenCompraRefs?.find(r => r.ordenCompraId === ocId)?.cantidad ?? productoSel.cantidadSolicitada)
    : 0;

  const porcionInvalida = scope === 'porcion' && (!productoId || cantidad < 1 || cantidad > maxCantidad);
  const motivoFaltante = !motivo;
  const submitInvalido = porcionInvalida || motivoFaltante;

  const handleSubmit = () => {
    if (submitInvalido || !motivo) return;
    const detalle = motivoDetalle.trim() || undefined;
    onConfirm(
      scope === 'porcion'
        ? { scope, productoId, cantidadCancelar: cantidad, motivo, motivoDetalle: detalle }
        : { scope, motivo, motivoDetalle: detalle }
    );
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Cancelar cobertura de OC"
      subtitle={`Sobre ${ocNumero || 'la OC'} vinculada a este requerimiento`}
      icon={XCircle}
      iconTone="red"
      size="md"
      submitLabel="Cancelar cobertura"
      submitIcon={XCircle}
      loading={loading}
      disabled={submitInvalido}
    >
      <div className="space-y-3">
        <p className="text-[12px] text-slate-500">Elegí el alcance. La <b>irreversibilidad</b> la fija el estado de la OC.</p>

        <div className="space-y-2">
          {OPCIONES.map(o => {
            const active = scope === o.value;
            return (
              <label
                key={o.value}
                className={`flex items-start gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors ${active ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <input type="radio" name="scope-oc" checked={active} onChange={() => setScope(o.value)} className="mt-0.5 accent-blue-600" />
                <div>
                  <div className="text-[12px] font-medium text-slate-800">{o.label}</div>
                  <div className="text-[10px] text-slate-400">{o.desc}</div>
                </div>
              </label>
            );
          })}
        </div>

        {scope === 'porcion' && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Producto</label>
              <select
                value={productoId}
                onChange={e => { setProductoId(e.target.value); setCantidad(1); }}
                className="mt-1 w-full px-2 py-1.5 text-[12px] bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value="">Seleccionar producto…</option>
                {productosEnOC.map(p => (
                  <option key={p.productoId} value={p.productoId}>{p.nombreComercial} ({p.marca})</option>
                ))}
              </select>
            </div>
            {productoId && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cantidad a cancelar (máx {maxCantidad})</label>
                <input
                  type="number"
                  min={1}
                  max={maxCantidad}
                  value={cantidad}
                  onChange={e => setCantidad(Math.max(1, Math.min(maxCantidad, Number(e.target.value) || 1)))}
                  className="mt-1 w-full px-2 py-1.5 text-[12px] bg-white border border-slate-200 rounded-lg tabular-nums focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            )}
            {productosEnOC.length === 0 && <p className="text-[11px] text-amber-600">Este req no tiene productos con refs a esta OC.</p>}
          </div>
        )}

        {/* F1 · Motivo estructurado (obligatorio) + detalle opcional. Alimenta el scorecard de proveedor. */}
        <div className="space-y-2.5">
          <Combobox<MotivoCancelacionOC>
            label="Motivo de la cancelación"
            required
            value={motivo}
            onChange={setMotivo}
            groups={MOTIVO_GROUPS}
            placeholder="Elegí el motivo…"
            emptyMessage="Sin motivos"
          />
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Detalle (opcional)</label>
            <textarea
              value={motivoDetalle}
              onChange={e => setMotivoDetalle(e.target.value)}
              rows={2}
              placeholder="Contexto adicional del motivo…"
              className="mt-1 w-full px-2 py-1.5 text-[12px] bg-white border border-slate-200 rounded-lg resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span><b>OC en borrador</b> → se retrae (vuelve al pool). <b>OC firme</b> (enviada+) → la compra <b>procede</b>; solo se marca cancelada la referencia.</span>
        </div>
      </div>
    </FormModalV2>
  );
};
