/**
 * RechazarReqModal · B2 · rechazo con motivo (F4 · capa de medición #4).
 *
 * El aprobador rechaza un req PENDIENTE con un motivo estructurado (sin_caja / margen_insuficiente /
 * tesis_debil / cantidad_excesiva / duplicado / otro) + detalle opcional. El motivo alimenta el
 * scorecard de mérito por solicitante. RECHAZAR ≠ CANCELAR: rechazar es la decisión consciente del
 * aprobador (queda registrado el motivo · estado='rechazado'); cancelar es el solicitante anulando
 * antes de la decisión. El caller llama `requerimientoService.rechazar`.
 *
 * Pixel-perfect del mockup docs/mockups/requerimientos-evolucion-propuesta-v1.html · Acto 3 (modal
 * Rechazar). FormModalV2 (canon · iconTone red · submit danger) · chrome BLUE en la selección activa.
 */
import React, { useEffect, useState } from 'react';
import { XCircle, Info } from 'lucide-react';
import { FormModalV2 } from '../../design-system';
import { LABEL_MOTIVO_RECHAZO_REQ } from '../../types/requerimiento.types';
import type { Requerimiento, MotivoRechazoRequerimiento } from '../../types/requerimiento.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  req: Requerimiento | null;
  loading?: boolean;
  /** El caller llama requerimientoService.rechazar(req.id, motivo, detalle, userId). */
  onConfirmar: (motivo: MotivoRechazoRequerimiento, detalle: string | undefined) => void;
}

/** Sub-texto explicativo por motivo (acto 3 · ayuda contextual bajo cada opción). */
const DESC_MOTIVO: Record<MotivoRechazoRequerimiento, string> = {
  sin_caja: 'La caja libre no cubre esta compra este ciclo',
  margen_insuficiente: 'El producto no alcanza el margen mínimo esperado',
  tesis_debil: 'Para apuestas: la hipótesis de demanda no es convincente',
  cantidad_excesiva: 'Aprobar con cantidad menor (solicitar corrección)',
  duplicado: 'Ya existe un req activo para este producto/cliente',
  otro: 'Otro motivo · detallalo abajo',
};

const MOTIVOS = Object.keys(LABEL_MOTIVO_RECHAZO_REQ) as MotivoRechazoRequerimiento[];

export const RechazarReqModal: React.FC<Props> = ({ isOpen, onClose, req, loading, onConfirmar }) => {
  const [motivo, setMotivo] = useState<MotivoRechazoRequerimiento | null>(null);
  const [detalle, setDetalle] = useState('');

  // Reset en cada apertura (la instancia se mantiene montada · evita arrastrar selección previa).
  useEffect(() => {
    if (isOpen) {
      setMotivo(null);
      setDetalle('');
    }
  }, [isOpen]);

  const primerProducto = req?.productos?.[0]?.nombreComercial;
  const subtitle = req
    ? `${req.numeroRequerimiento}${primerProducto ? ` · ${primerProducto}` : ''}`
    : '';

  const handleSubmit = () => {
    if (!motivo) return;
    onConfirmar(motivo, detalle.trim() || undefined);
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Rechazar requerimiento"
      subtitle={subtitle}
      icon={XCircle}
      iconTone="red"
      size="md"
      submitLabel="Confirmar rechazo"
      submitIcon={XCircle}
      submitVariant="danger"
      loading={loading}
      disabled={!motivo}
    >
      <div className="space-y-4">
        {/* Nota aclaratoria · rechazar ≠ cancelar */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] text-slate-600 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
          <span>
            <b>Rechazar</b> archiva el req como decisión consciente del aprobador y deja registrado el
            motivo. Es distinto de <b>cancelar</b> (el solicitante anula antes de la decisión de aprobación).
          </span>
        </div>

        {/* Selector de motivo (radios · iteración de LABEL_MOTIVO_RECHAZO_REQ) */}
        <div>
          <div className="text-[11px] font-bold text-slate-700 mb-2">
            Motivo del rechazo <span className="text-rose-500">*</span>
          </div>
          <div className="space-y-1.5">
            {MOTIVOS.map((m) => {
              const activo = motivo === m;
              return (
                <label
                  key={m}
                  className={`flex items-center gap-3 p-2.5 border rounded-xl cursor-pointer transition-colors ${
                    activo ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      activo ? 'border-blue-600' : 'border-slate-300'
                    }`}
                  >
                    {activo && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                  </span>
                  <input
                    type="radio"
                    name="motivo-rechazo"
                    checked={activo}
                    onChange={() => setMotivo(m)}
                    className="sr-only"
                  />
                  <span>
                    <span className={`block text-[12px] ${activo ? 'font-semibold text-slate-800' : 'font-medium text-slate-700'}`}>
                      {LABEL_MOTIVO_RECHAZO_REQ[m]}
                    </span>
                    <span className="block text-[10px] text-slate-500">{DESC_MOTIVO[m]}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Detalle opcional */}
        <div>
          <div className="text-[11px] font-bold text-slate-700 mb-1.5">Detalle adicional (opcional)</div>
          <textarea
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            rows={2}
            placeholder="Ej: Renegociar precio con proveedor antes del siguiente ciclo…"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[12px] text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white placeholder-slate-400"
          />
        </div>
      </div>
    </FormModalV2>
  );
};

export default RechazarReqModal;
