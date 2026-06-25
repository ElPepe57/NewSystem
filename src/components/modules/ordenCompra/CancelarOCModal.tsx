/**
 * CancelarOCModal · UI de F5 (spec docs/CANCELACION_OC_MODELO.md).
 *
 * Da al usuario el camino para cancelar una OC y dispara el motor ya construido
 * (`OrdenCompraService.cambiarEstado(id,'cancelada',uid,{motivoCancelacion,motivoDetalle})`),
 * que orquesta la reversa atómica de las 6 capas (cobertura · físico · deuda · envío).
 *
 * El cuerpo muestra las CONSECUENCIAS COMPUTADAS por `previewCancelacionOC` (lectura pura,
 * espeja los criterios del motor → lo que ves == lo que va a pasar):
 *   liberar N reservas · borrar M unidades pedidas · revertir la deuda de $X · cancelar K envíos.
 * Si la OC fue pagada → ⚠ el proveedor te deberá un reembolso. Si tiene unidades recibidas →
 * ⚠ eso NO se cancela, es devolución.
 *
 * Motivo ESTRUCTURADO obligatorio (mismo Combobox + grupos que CancelarCoberturaModal · F1) +
 * detalle libre. TYPED-CONFIRM "CANCELAR" cuando la OC es FIRME (impacto físico + financiero).
 * FormModalV2 (canon · iconTone red · submit danger).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Ban, TriangleAlert, PackageX, BookmarkX, Truck, Banknote, Coins } from 'lucide-react';
import { FormModalV2, Combobox, type ComboboxGroup } from '../../../design-system';
import { useAuthStore } from '../../../store/authStore';
import { useToastStore } from '../../../store/toastStore';
import { OrdenCompraService } from '../../../services/ordenCompra.service';
import type { PreviewCancelacionOC } from '../../../services/ordenCompra.crud.service';
import { esFirme } from '../../../services/requerimiento.cobertura';
import type { OrdenCompra } from '../../../types/ordenCompra.types';
import type { MotivoCancelacionOC } from '../../../types/requerimiento.types';
import {
  LABEL_MOTIVO_CANCELACION_OC,
  GRUPO_MOTIVO_PROVEEDOR,
  GRUPO_MOTIVO_INTERNO,
} from '../../../types/requerimiento.types';

interface Props {
  isOpen: boolean;
  orden: OrdenCompra | null;
  onClose: () => void;
  /** Se llama tras cancelar con éxito (refrescar lista/detalle). */
  onCancelada: () => void;
}

/** Motivos agrupados (proveedor / interno) para el Combobox del DS · idéntico a CancelarCoberturaModal. */
const MOTIVO_GROUPS: ComboboxGroup<MotivoCancelacionOC>[] = [
  { label: 'El proveedor no cumple', options: GRUPO_MOTIVO_PROVEEDOR.map(m => ({ value: m, label: LABEL_MOTIVO_CANCELACION_OC[m] })) },
  { label: 'Tu lado (interno)', options: GRUPO_MOTIVO_INTERNO.map(m => ({ value: m, label: LABEL_MOTIVO_CANCELACION_OC[m] })) },
];

const fmtUSD = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const CancelarOCModal: React.FC<Props> = ({ isOpen, orden, onClose, onCancelada }) => {
  const { user } = useAuthStore();
  const toast = useToastStore();

  const [motivo, setMotivo] = useState<MotivoCancelacionOC | undefined>(undefined);
  const [motivoDetalle, setMotivoDetalle] = useState('');
  const [typed, setTyped] = useState('');
  const [preview, setPreview] = useState<PreviewCancelacionOC | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // OC firme (impacto físico+financiero) → typed-confirm. Borrador → solo motivo.
  const ocFirme = orden ? esFirme(orden.estado) : false;

  // Reset + cargar la preview en cada apertura (la instancia se mantiene montada).
  useEffect(() => {
    if (!isOpen || !orden) return;
    setMotivo(undefined);
    setMotivoDetalle('');
    setTyped('');
    setPreview(null);
    setLoadingPreview(true);
    let cancelado = false;
    OrdenCompraService.previewCancelacionOC(orden)
      .then(p => { if (!cancelado) setPreview(p); })
      .catch(() => { if (!cancelado) setPreview(null); })
      .finally(() => { if (!cancelado) setLoadingPreview(false); });
    return () => { cancelado = true; };
  }, [isOpen, orden]);

  const typedOk = !ocFirme || typed.trim().toUpperCase() === 'CANCELAR';
  const submitInvalido = !motivo || !typedOk || submitting;

  // Consecuencias en líneas (solo las que aplican · espejan el motor).
  const consecuencias = useMemo(() => {
    if (!preview) return [];
    const lines: Array<{ icon: React.ComponentType<{ className?: string }>; text: React.ReactNode }> = [];
    if (preview.reservasAfectadas > 0) {
      lines.push({ icon: BookmarkX, text: <>Se liberarán <b className="tabular-nums">{preview.reservasAfectadas}</b> reserva{preview.reservasAfectadas === 1 ? '' : 's'}.</> });
    }
    if (preview.unidadesPedidas > 0) {
      lines.push({ icon: PackageX, text: <>Se borrarán <b className="tabular-nums">{preview.unidadesPedidas}</b> unidad{preview.unidadesPedidas === 1 ? '' : 'es'} pedida{preview.unidadesPedidas === 1 ? '' : 's'}.</> });
    }
    if (preview.deudaUSD > 0) {
      lines.push({ icon: Banknote, text: <>Se revertirá la deuda de <b className="tabular-nums">{fmtUSD(preview.deudaUSD)}</b> con el proveedor.</> });
    }
    if (preview.enviosCancelables > 0) {
      lines.push({ icon: Truck, text: <>Se cancelarán <b className="tabular-nums">{preview.enviosCancelables}</b> envío{preview.enviosCancelables === 1 ? '' : 's'}.</> });
    }
    return lines;
  }, [preview]);

  const handleSubmit = async () => {
    if (!orden || !user || submitInvalido || !motivo) return;
    setSubmitting(true);
    try {
      await OrdenCompraService.cambiarEstado(orden.id, 'cancelada', user.uid, {
        // libre (logs de las reversas físico/deuda/envío) + estructurado (refs · scorecard proveedor).
        motivo: LABEL_MOTIVO_CANCELACION_OC[motivo],
        motivoCancelacion: motivo,
        motivoDetalle: motivoDetalle.trim() || undefined,
      });
      toast.success(`OC ${orden.numeroOrden || ''} cancelada`.trim());
      onCancelada();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo cancelar la OC', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!orden) return null;

  const noHayConsecuencias = !loadingPreview && consecuencias.length === 0 && !preview?.tienePago && !preview?.esRecibida;

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Cancelar OC"
      subtitle={`${orden.numeroOrden || 'Orden de compra'} · ${orden.nombreProveedor || 'proveedor'}`}
      icon={Ban}
      iconTone="red"
      size="md"
      submitLabel="Cancelar OC"
      submitIcon={Ban}
      submitVariant="danger"
      loading={submitting}
      disabled={submitInvalido}
    >
      <div className="space-y-3.5">
        {/* Consecuencias computadas (preview) */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Esto va a pasar</div>
          {loadingPreview ? (
            <p className="text-[12px] text-slate-400">Calculando consecuencias…</p>
          ) : (
            <>
              {consecuencias.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px] text-slate-700">
                  <c.icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                  <span>{c.text}</span>
                </div>
              ))}
              {noHayConsecuencias && (
                <p className="text-[12px] text-slate-500">
                  Sin reservas, unidades, deuda ni envíos por revertir. Solo se marcará la OC como cancelada.
                </p>
              )}
            </>
          )}
        </div>

        {/* ⚠ OC pagada → reembolso pendiente del proveedor */}
        {preview?.tienePago && (
          <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Coins className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              La OC fue pagada{preview.refundUSD > 0 ? <> · el proveedor te deberá un reembolso de <b className="tabular-nums">{fmtUSD(preview.refundUSD)}</b></> : ''}.
              La reversa del pago (cash + crédito en CC) se gestiona aparte · revisá la cuenta del proveedor.
            </span>
          </div>
        )}

        {/* ⚠ OC con unidades recibidas → devolución, no cancelación */}
        {preview?.esRecibida && (
          <div className="flex items-start gap-2 text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            <TriangleAlert className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Esta OC tiene unidades <b>ya recibidas</b> que NO se cancelan (es inventario real). Para esa mercadería usá <b>devolución</b>, no cancelación.
            </span>
          </div>
        )}

        {/* Motivo estructurado (obligatorio) + detalle */}
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

        {/* Typed-confirm · solo OC firme (plata + inventario en juego) */}
        {ocFirme && (
          <div className="space-y-1.5">
            <div className="flex items-start gap-2 text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <TriangleAlert className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>Esta OC ya es <b>firme</b>. Para confirmar el alto impacto, escribí <b>CANCELAR</b>.</span>
            </div>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder="Escribí CANCELAR"
              autoComplete="off"
              className="w-full px-2.5 py-2 text-[13px] bg-white border border-slate-300 rounded-lg tracking-wide uppercase focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
            />
          </div>
        )}
      </div>
    </FormModalV2>
  );
};
