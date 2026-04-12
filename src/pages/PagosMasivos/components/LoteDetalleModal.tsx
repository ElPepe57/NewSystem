/**
 * LoteDetalleModal.tsx
 *
 * Modal con el detalle de un lote ejecutado.
 */
import React from 'react';
import { CheckCircle, XCircle, Wallet, Calendar, Clock } from 'lucide-react';
import { Modal, Badge } from '../../../components/common';
import { DataTable } from '../../../design-system';
import type { DataTableColumn } from '../../../design-system';
import { formatCurrency } from '../../../utils/format';
import { METODOS_PAGO_INFO } from '../../../types/pago.types';
import { usePagoMasivoStore } from '../../../store/pagoMasivoStore';
import type { ResultadoItemLote } from '../../../types/pagoMasivo.types';

export const LoteDetalleModal: React.FC = () => {
  const { loteDetalle, setLoteDetalle } = usePagoMasivoStore();

  if (!loteDetalle) return null;

  const lote = loteDetalle;
  const fecha = lote.fechaEjecucion?.toDate?.()
    ? lote.fechaEjecucion.toDate().toLocaleString('es-PE')
    : '—';

  const itemColumns: DataTableColumn<ResultadoItemLote>[] = [
    {
      key: 'estado',
      header: '',
      width: '32px',
      render: (item) =>
        item.estado === 'exitoso' ? (
          <CheckCircle size={14} className="text-emerald-600" />
        ) : (
          <XCircle size={14} className="text-red-600" />
        ),
    },
    {
      key: 'numeroDocumento',
      header: 'Documento',
      render: (item) => <span className="font-mono text-xs">{item.numeroDocumento}</span>,
    },
    {
      key: 'contraparteNombre',
      header: 'Contraparte',
      render: (item) => <span className="truncate max-w-[150px] block">{item.contraparteNombre}</span>,
    },
    {
      key: 'montoPagado',
      header: 'Monto',
      align: 'right',
      render: (item) => (
        <span className="font-mono">{formatCurrency(item.montoPagado, item.monedaDocumento)}</span>
      ),
    },
    {
      key: 'resultado',
      header: 'Resultado',
      render: (item) =>
        item.estado === 'error' ? (
          <span className="text-xs text-red-600">{item.error}</span>
        ) : (
          <Badge variant="success">OK</Badge>
        ),
    },
  ];

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
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-emerald-700">{lote.itemsExitosos}</div>
            <div className="text-xs text-emerald-600">Exitosos</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-red-700">{lote.itemsConError}</div>
            <div className="text-xs text-red-600">Errores</div>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-center">
            <div className="text-sm font-bold text-teal-700 font-mono">
              {lote.montoTotalPEN > 0 && formatCurrency(lote.montoTotalPEN, 'PEN')}
              {lote.montoTotalPEN > 0 && lote.montoTotalUSD > 0 && <br />}
              {lote.montoTotalUSD > 0 && formatCurrency(lote.montoTotalUSD, 'USD')}
            </div>
            <div className="text-xs text-teal-600">Total pagado</div>
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
        <div className="max-h-[350px] overflow-y-auto">
          <DataTable<ResultadoItemLote>
            columns={itemColumns}
            data={lote.items}
            keyExtractor={(item) => item.documentoId}
            stickyHeader
            compact
          />
        </div>
      </div>
    </Modal>
  );
};
