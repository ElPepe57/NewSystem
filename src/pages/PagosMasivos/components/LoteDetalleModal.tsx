/**
 * LoteDetalleModal.tsx
 *
 * Modal con el detalle de un lote ejecutado.
 */
import React from 'react';
import { CheckCircle, XCircle, Wallet, Calendar, Clock } from 'lucide-react';
import { Modal, Badge } from '../../../components/common';
import { formatCurrency } from '../../../utils/format';
import { METODOS_PAGO_INFO } from '../../../types/pago.types';
import { usePagoMasivoStore } from '../../../store/pagoMasivoStore';

export const LoteDetalleModal: React.FC = () => {
  const { loteDetalle, setLoteDetalle } = usePagoMasivoStore();

  if (!loteDetalle) return null;

  const lote = loteDetalle;
  const fecha = lote.fechaEjecucion?.toDate?.()
    ? lote.fechaEjecucion.toDate().toLocaleString('es-PE')
    : '—';

  return (
    <Modal
      isOpen={!!loteDetalle}
      onClose={() => setLoteDetalle(null)}
      title={`Detalle del lote ${lote.id}`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Info general */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500 flex items-center gap-1"><Calendar size={12} /> Fecha</div>
            <div className="font-medium text-sm mt-1">{fecha}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500 flex items-center gap-1"><Wallet size={12} /> Cuenta</div>
            <div className="font-medium text-sm mt-1">{lote.cuentaNombre}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500">Metodo</div>
            <div className="font-medium text-sm mt-1">{METODOS_PAGO_INFO[lote.metodoPago]?.label || lote.metodoPago}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500 flex items-center gap-1"><Clock size={12} /> Duracion</div>
            <div className="font-medium text-sm mt-1">{(lote.duracionMs / 1000).toFixed(1)}s</div>
          </div>
        </div>

        {/* Totales */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-green-700">{lote.itemsExitosos}</div>
            <div className="text-xs text-green-600">Exitosos</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-red-700">{lote.itemsConError}</div>
            <div className="text-xs text-red-600">Errores</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center">
            <div className="text-sm font-bold text-indigo-700 font-mono">
              {lote.montoTotalPEN > 0 && formatCurrency(lote.montoTotalPEN, 'PEN')}
              {lote.montoTotalPEN > 0 && lote.montoTotalUSD > 0 && <br />}
              {lote.montoTotalUSD > 0 && formatCurrency(lote.montoTotalUSD, 'USD')}
            </div>
            <div className="text-xs text-indigo-600">Total pagado</div>
          </div>
        </div>

        {lote.referencia && (
          <div className="text-sm text-slate-600">
            <span className="font-medium">Referencia:</span> {lote.referencia}
          </div>
        )}
        {lote.notas && (
          <div className="text-sm text-slate-600">
            <span className="font-medium">Notas:</span> {lote.notas}
          </div>
        )}

        {/* Items */}
        <div className="border rounded-lg overflow-hidden max-h-[350px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-8"></th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Documento</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Contraparte</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Monto</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lote.items.map((item, i) => (
                <tr key={i} className={item.estado === 'error' ? 'bg-red-50' : ''}>
                  <td className="px-3 py-2">
                    {item.estado === 'exitoso' ? (
                      <CheckCircle size={14} className="text-green-600" />
                    ) : (
                      <XCircle size={14} className="text-red-600" />
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{item.numeroDocumento}</td>
                  <td className="px-3 py-2 truncate max-w-[150px]">{item.contraparteNombre}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(item.montoPagado, item.monedaDocumento)}
                  </td>
                  <td className="px-3 py-2">
                    {item.estado === 'error' ? (
                      <span className="text-xs text-red-600">{item.error}</span>
                    ) : (
                      <Badge variant="success">OK</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};
