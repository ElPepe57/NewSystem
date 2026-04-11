/**
 * ProgresoEjecucion.tsx
 *
 * Modal de progreso en tiempo real durante la ejecución del lote.
 */
import React from 'react';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import { Modal, Button } from '../../../components/common';
import { formatCurrency } from '../../../utils/format';
import { usePagoMasivoStore } from '../../../store/pagoMasivoStore';
import type { EstadoItemLote } from '../../../types/pagoMasivo.types';

const ESTADO_ICONO: Record<EstadoItemLote, React.ReactNode> = {
  pendiente:   <Clock size={14} className="text-slate-400" />,
  procesando:  <Loader2 size={14} className="text-teal-600 animate-spin" />,
  exitoso:     <CheckCircle size={14} className="text-green-600" />,
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
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{progreso.exitosos}</div>
              <div className="text-xs text-green-600">Exitosos</div>
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
        <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-8"></th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Documento</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Contraparte</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Monto</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {progreso.resultados.map((item, i) => (
                <tr key={i} className={item.estado === 'error' ? 'bg-red-50' : ''}>
                  <td className="px-3 py-2">{ESTADO_ICONO[item.estado]}</td>
                  <td className="px-3 py-2 font-mono text-xs">{item.numeroDocumento}</td>
                  <td className="px-3 py-2 truncate max-w-[150px]">{item.contraparteNombre}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(item.montoPagado, item.monedaDocumento)}
                  </td>
                  <td className="px-3 py-2">
                    {item.estado === 'error' ? (
                      <span className="text-xs text-red-600" title={item.error}>{item.error}</span>
                    ) : (
                      <span className={`text-xs capitalize ${
                        item.estado === 'exitoso' ? 'text-green-600' :
                        item.estado === 'procesando' ? 'text-teal-600' : 'text-slate-500'
                      }`}>
                        {item.estado}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
