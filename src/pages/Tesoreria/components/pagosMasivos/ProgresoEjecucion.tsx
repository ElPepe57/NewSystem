/**
 * ProgresoEjecucion.tsx
 *
 * Modal de progreso en tiempo real durante la ejecución del lote.
 */
import React from 'react';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import { Modal, Button } from '../../../../components/common';
import { DataTable } from '../../../../design-system';
import type { DataTableColumn } from '../../../../design-system';
import { formatCurrency } from '../../../../utils/format';
import { usePagoMasivoStore } from '../../../../store/pagoMasivoStore';
import type { EstadoItemLote, ResultadoItemLote } from '../../../../types/pagoMasivo.types';

const ESTADO_ICONO: Record<EstadoItemLote, React.ReactNode> = {
  pendiente:   <Clock size={14} className="text-slate-400" />,
  procesando:  <Loader2 size={14} className="text-teal-600 animate-spin" />,
  exitoso:     <CheckCircle size={14} className="text-emerald-600" />,
  error:       <XCircle size={14} className="text-red-600" />,
};

interface ProgresoEjecucionProps {
  open: boolean;
  onClose: () => void;
}

export const ProgresoEjecucion: React.FC<ProgresoEjecucionProps> = ({ open, onClose }) => {
  const { progreso, loteResultado, ejecutando } = usePagoMasivoStore();

  if (!progreso) return null;

  const porcentaje = progreso.total > 0
    ? Math.round((progreso.procesados / progreso.total) * 100)
    : 0;

  const terminado = !ejecutando && loteResultado;

  const itemColumns: DataTableColumn<ResultadoItemLote>[] = [
    {
      key: 'estado',
      header: '',
      width: '32px',
      render: (item) => ESTADO_ICONO[item.estado],
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
      key: 'estadoLabel',
      header: 'Estado',
      render: (item) =>
        item.estado === 'error' ? (
          <span className="text-xs text-red-600" title={item.error}>{item.error}</span>
        ) : (
          <span className={`text-xs capitalize ${
            item.estado === 'exitoso' ? 'text-emerald-600' :
            item.estado === 'procesando' ? 'text-teal-600' : 'text-slate-500'
          }`}>
            {item.estado}
          </span>
        ),
    },
  ];

  return (
    <Modal
      isOpen={open}
      onClose={terminado ? onClose : () => {}}
      title={terminado ? 'Lote completado' : 'Procesando pagos...'}
      size="lg"
    >
      <div className="space-y-4">
        {/* Barra de progreso */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-600">
              {ejecutando
                ? `Procesando ${progreso.procesados + 1} de ${progreso.total}...`
                : `${progreso.procesados} de ${progreso.total} procesados`}
            </span>
            <span className="font-medium">{porcentaje}%</span>
          </div>
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${porcentaje}%`,
                backgroundColor: progreso.errores > 0 ? '#f59e0b' : '#4f46e5',
              }}
            />
          </div>
        </div>

        {/* Resumen */}
        {terminado && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-emerald-700">{progreso.exitosos}</div>
              <div className="text-xs text-emerald-600">Exitosos</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-700">{progreso.errores}</div>
              <div className="text-xs text-red-600">Con error</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-700">{progreso.total}</div>
              <div className="text-xs text-slate-600">Total</div>
            </div>
          </div>
        )}

        {/* Montos del lote */}
        {terminado && loteResultado && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-teal-700">Monto total pagado:</span>
              <span className="font-semibold text-teal-800 font-mono">
                {loteResultado.montoTotalPEN > 0 && formatCurrency(loteResultado.montoTotalPEN, 'PEN')}
                {loteResultado.montoTotalPEN > 0 && loteResultado.montoTotalUSD > 0 && ' + '}
                {loteResultado.montoTotalUSD > 0 && formatCurrency(loteResultado.montoTotalUSD, 'USD')}
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-teal-700">Lote:</span>
              <span className="font-mono text-teal-800">{loteResultado.id}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-teal-700">Duracion:</span>
              <span className="text-teal-800">{(loteResultado.duracionMs / 1000).toFixed(1)}s</span>
            </div>
          </div>
        )}

        {/* Detalle por item */}
        <div className="max-h-[300px] overflow-y-auto">
          <DataTable<ResultadoItemLote>
            columns={itemColumns}
            data={progreso.resultados}
            keyExtractor={(item) => item.documentoId}
            stickyHeader
            compact
          />
        </div>

        {/* Acciones */}
        {terminado && (
          <div className="flex justify-end">
            <Button onClick={onClose} variant="primary">
              Cerrar
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
