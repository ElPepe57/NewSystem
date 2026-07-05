/**
 * FinalizarCostosModal — Modal de confirmación para finalizar los costos del
 * envío (D-17). Acción irreversible que transita el CTRU de cada unidad a
 * "definitivo".
 *
 * Bloquea si hay costos en estado 'estimado' (muestra lista).
 * Requiere confirmación explícita del usuario (click en botón final).
 *
 * Migrado a FormModalV2 · chrome orange (Inventario · grupoColor).
 * Datos del body en colores semánticos: amber=estimados/dinero, emerald=confirmados, slate=meta.
 */
import React, { useState } from 'react';
import { Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { FormModalV2 } from '../../../design-system';
import type { CostoLanded } from '../../../types/envio.types';

export interface FinalizarCostosModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Todos los costos landed del envío */
  costosLanded: CostoLanded[];
  /** Número del envío para contextualizar */
  envioNumero?: string;
  /** Cantidad de unidades afectadas (para mostrar en el mensaje) */
  unidadesAfectadas?: number;
  /** Callback al confirmar — padre llama finalizarCostosLanded */
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

const formatUSD = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const formatPEN = (n: number): string =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const FinalizarCostosModal: React.FC<FinalizarCostosModalProps> = ({
  isOpen,
  onClose,
  costosLanded,
  envioNumero,
  unidadesAfectadas,
  onConfirm,
  loading: loadingExt = false,
}) => {
  const [confirmando, setConfirmando] = useState(false);
  const loading = loadingExt || confirmando;

  const estimados = costosLanded.filter((c) => (c.estado ?? 'estimado') === 'estimado');
  const confirmados = costosLanded.filter((c) => c.estado === 'confirmado');
  const totalPEN = confirmados.reduce((sum, c) => sum + c.montoPEN, 0);
  const puedeFinalizaroa = estimados.length === 0 && confirmados.length > 0 && !loading;

  const handleConfirm = async () => {
    if (!puedeFinalizaroa) return;
    setConfirmando(true);
    try {
      await onConfirm();
    } finally {
      setConfirmando(false);
    }
  };

  const subtitle = envioNumero
    ? `${envioNumero} · CTRU definitivo · acción irreversible`
    : 'CTRU definitivo · acción irreversible';

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      onSubmit={handleConfirm}
      title="Finalizar costos"
      subtitle={subtitle}
      icon={Lock}
      iconTone="orange"
      color="orange"
      size="md"
      submitLabel="Finalizar costos — CTRU definitivo"
      submitIcon={Lock}
      loading={loading}
      disabled={!puedeFinalizaroa}
      disableBackdropClick={loading}
    >
      <div className="space-y-3">

        {/* Warning: hay costos estimados — amber (semántico: urgencia/pendiente) */}
        {estimados.length > 0 && (
          <div className="bg-amber-50 ring-1 ring-amber-200/60 rounded-lg p-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden />
            <div className="text-[11px] text-amber-800 leading-snug">
              <strong className="text-[12px] font-semibold text-amber-900 block mb-0.5">No se puede finalizar todavía</strong>
              Hay{' '}
              <strong className="tabular-nums">{estimados.length} costo{estimados.length !== 1 ? 's' : ''} estimado{estimados.length !== 1 ? 's' : ''}</strong>.
              No se puede finalizar hasta confirmarlos con la factura real.
            </div>
          </div>
        )}

        {/* Todos confirmados — encabezado de estado positivo */}
        {estimados.length === 0 && confirmados.length > 0 && (
          <div className="bg-emerald-50 ring-1 ring-emerald-200/60 rounded-lg p-3 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden />
            <div className="text-[11px] text-emerald-800 leading-snug">
              Todos los costos están confirmados. Al finalizar, el{' '}
              <strong>CTRU definitivo</strong> se aplicará a las{' '}
              {unidadesAfectadas != null ? (
                <strong className="tabular-nums">{unidadesAfectadas} unidades</strong>
              ) : (
                'unidades'
              )}
              {envioNumero ? (
                <> del envío <strong>{envioNumero}</strong></>
              ) : null}{' '}
              y se bloquearán futuras ediciones (solo reabrir con motivo de auditoría).
            </div>
          </div>
        )}

        {/* Lista de costos estimados pendientes */}
        {estimados.length > 0 && (
          <div className="border border-amber-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-amber-50 text-[11px] font-semibold text-amber-900 border-b border-amber-200">
              Costos pendientes de confirmar ({estimados.length})
            </div>
            <div className="divide-y divide-amber-100">
              {estimados.map((c) => (
                <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-slate-900 truncate">
                      {c.categoriaCostoNombre}
                    </div>
                    {c.motivoEstimado && (
                      <div className="text-[10px] text-amber-700 italic">
                        {c.motivoEstimado}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 text-[12px] font-semibold text-slate-700 tabular-nums italic">
                    {c.moneda === 'USD' ? formatUSD(c.monto) : formatPEN(c.monto)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resumen de costos confirmados + totales */}
        {estimados.length === 0 && confirmados.length > 0 && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-emerald-50 text-[11px] font-semibold text-emerald-900 border-b border-emerald-200 flex items-center justify-between">
              <span>Costos confirmados ({confirmados.length})</span>
              <span className="tabular-nums">{formatPEN(totalPEN)}</span>
            </div>
            <div className="divide-y divide-emerald-100 max-h-60 overflow-y-auto">
              {confirmados.map((c) => (
                <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-slate-900 truncate">
                      {c.categoriaCostoNombre}
                      {c.scope === 'tanda' && (
                        <span className="ml-1 text-[10px] text-violet-700 font-normal">
                          · tanda
                        </span>
                      )}
                    </div>
                    {c.facturaReferencia && (
                      <div className="text-[10px] text-slate-500">
                        Factura {c.facturaReferencia}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 text-[12px] font-semibold text-slate-900 tabular-nums">
                    {formatPEN(c.montoPEN)}
                  </div>
                </div>
              ))}
            </div>
            {/* Total landed + unidades afectadas (mockup canon · tabla resumen) */}
            <div className="border-t border-slate-200 divide-y divide-slate-100">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[12px] text-slate-600">Total landed</span>
                <span className="text-[13px] font-bold tabular-nums text-slate-900">
                  {formatPEN(totalPEN)}
                </span>
              </div>
              {unidadesAfectadas != null && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-[12px] text-slate-600">CTRU definitivo a</span>
                  <span className="text-[12px] font-semibold tabular-nums text-slate-700">
                    {unidadesAfectadas} uds
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Advertencia de irreversibilidad */}
        {estimados.length === 0 && confirmados.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden />
            <p className="text-[11px] text-slate-600">
              <strong>Acción irreversible:</strong> una vez finalizados, los costos quedan en solo
              lectura y el CTRU de cada unidad se convierte en definitivo. Si aparece una factura
              adicional después (ej. tasa aduanera atrasada), puedes reabrir con motivo de
              auditoría, pero eso genera un asiento contable de ajuste retroactivo.
            </p>
          </div>
        )}

        {/* Caso: no hay costos */}
        {costosLanded.length === 0 && (
          <div className="text-[12px] text-slate-500 italic text-center py-6">
            El envío no tiene costos landed. Agrega al menos un costo antes de finalizar.
          </div>
        )}

      </div>
    </FormModalV2>
  );
};
