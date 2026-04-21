/**
 * FinalizarCostosModal — Modal de confirmación para finalizar los costos del
 * envío (D-17). Acción irreversible que transita el CTRU de cada unidad a
 * "definitivo".
 *
 * Bloquea si hay costos en estado 'estimado' (muestra lista).
 * Requiere confirmación explícita del usuario (click en botón final).
 */
import React, { useState } from 'react';
import { AlertOctagon, Lock } from 'lucide-react';
import { Modal, Button } from '../../../components/common';
import { cn } from '../../../design-system';
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

  if (!isOpen) return null;

  return (
    <Modal
      isOpen
      onClose={loading ? () => {} : onClose}
      title="Finalizar costos del envío"
      size="md"
    >
      <div className="space-y-4">
        {/* Encabezado contextual */}
        <div
          className={cn(
            'p-4 rounded-lg border flex items-start gap-3',
            estimados.length > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-sky-50 border-sky-200'
          )}
        >
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
              estimados.length > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-sky-100 text-sky-700'
            )}
          >
            {estimados.length > 0 ? (
              <AlertOctagon className="w-5 h-5" aria-hidden />
            ) : (
              <Lock className="w-5 h-5" aria-hidden />
            )}
          </div>
          <div className="flex-1 min-w-0 text-sm">
            {estimados.length > 0 ? (
              <>
                <div className="font-semibold text-amber-900">
                  No se puede finalizar todavía
                </div>
                <div className="text-xs text-amber-800 mt-1">
                  Hay <strong>{estimados.length}</strong> costo{estimados.length !== 1 ? 's' : ''} en
                  estado <code className="bg-white px-1 rounded">estimado</code>. Confirma cada uno
                  con la factura real antes de cerrar.
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold text-sky-900">
                  Todos los costos están confirmados
                </div>
                <div className="text-xs text-sky-800 mt-1">
                  Al finalizar, el <strong>CTRU definitivo</strong> se aplicará a las{' '}
                  {unidadesAfectadas ?? ''} unidades
                  {envioNumero ? <> del envío <strong>{envioNumero}</strong></> : null} y se
                  bloquearán futuras ediciones de los costos (solo se puede reabrir con motivo
                  de auditoría).
                </div>
              </>
            )}
          </div>
        </div>

        {/* Lista de costos estimados pendientes */}
        {estimados.length > 0 && (
          <div className="border border-amber-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-amber-50 text-xs font-semibold text-amber-900 border-b border-amber-200">
              Costos pendientes de confirmar ({estimados.length})
            </div>
            <div className="divide-y divide-amber-100">
              {estimados.map((c) => (
                <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">
                      {c.categoriaCostoNombre}
                    </div>
                    {c.motivoEstimado && (
                      <div className="text-[10px] text-amber-700 italic">
                        {c.motivoEstimado}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-slate-700 tabular-nums italic">
                      {c.moneda === 'USD' ? formatUSD(c.monto) : formatPEN(c.monto)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resumen de costos confirmados (si hay y se puede finalizar) */}
        {estimados.length === 0 && confirmados.length > 0 && (
          <div className="border border-emerald-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-emerald-50 text-xs font-semibold text-emerald-900 border-b border-emerald-200 flex items-center justify-between">
              <span>Costos confirmados ({confirmados.length})</span>
              <span className="tabular-nums">{formatPEN(totalPEN)}</span>
            </div>
            <div className="divide-y divide-emerald-100 max-h-60 overflow-y-auto">
              {confirmados.map((c) => (
                <div
                  key={c.id}
                  className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">
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
                  <div className="text-right flex-shrink-0 font-semibold text-slate-900 tabular-nums">
                    {formatPEN(c.montoPEN)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nota de advertencia irreversibilidad */}
        {estimados.length === 0 && confirmados.length > 0 && (
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-3">
            <strong>⚠️ Acción irreversible:</strong> una vez finalizados, los costos quedan en solo
            lectura y el CTRU de cada unidad se convierte en definitivo. Si aparece una factura
            adicional después (ej. tasa aduanera atrasada), puedes reabrir con motivo de
            auditoría, pero eso genera un asiento contable de ajuste retroactivo.
          </div>
        )}

        {/* Caso: no hay costos */}
        {costosLanded.length === 0 && (
          <div className="text-sm text-slate-600 italic text-center py-6">
            El envío no tiene costos landed. Agrega al menos un costo antes de finalizar.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={!puedeFinalizaroa}
        >
          <Lock className="w-4 h-4 mr-1.5" aria-hidden />
          {loading ? 'Finalizando...' : 'Finalizar costos — CTRU definitivo'}
        </Button>
      </div>
    </Modal>
  );
};
