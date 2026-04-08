/**
 * HistorialLotes.tsx
 *
 * Tabla de lotes de pago ejecutados.
 */
import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Eye, Clock } from 'lucide-react';
import { Badge, Button } from '../../../components/common';
import { formatCurrency } from '../../../utils/format';
import { usePagoMasivoStore } from '../../../store/pagoMasivoStore';

export const HistorialLotes: React.FC = () => {
  const { historial, loadingHistorial, fetchHistorial, setLoteDetalle } = usePagoMasivoStore();

  useEffect(() => {
    fetchHistorial();
  }, []);

  if (loadingHistorial) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-3" />
        Cargando historial...
      </div>
    );
  }

  if (historial.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Clock size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="font-medium">No hay lotes ejecutados</p>
        <p className="text-sm">Los lotes procesados apareceran aqui.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lote</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Items</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {historial.map((lote) => {
            const fecha = lote.fechaEjecucion?.toDate?.()
              ? lote.fechaEjecucion.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—';
            const tieneErrores = lote.itemsConError > 0;

            return (
              <tr key={lote.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-medium">{lote.id}</td>
                <td className="px-4 py-3">
                  <Badge variant={lote.tipo === 'egreso' ? 'warning' : 'success'}>
                    {lote.tipo === 'egreso' ? 'Egreso' : 'Ingreso'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-600">{fecha}</td>
                <td className="px-4 py-3 text-center">
                  <span className="flex items-center justify-center gap-1">
                    <CheckCircle size={14} className="text-green-500" />
                    <span>{lote.itemsExitosos}</span>
                    {tieneErrores && (
                      <>
                        <XCircle size={14} className="text-red-500 ml-1" />
                        <span>{lote.itemsConError}</span>
                      </>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {lote.montoTotalPEN > 0 && (
                    <div>{formatCurrency(lote.montoTotalPEN, 'PEN')}</div>
                  )}
                  {lote.montoTotalUSD > 0 && (
                    <div>{formatCurrency(lote.montoTotalUSD, 'USD')}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {tieneErrores ? (
                    <Badge variant="warning">Parcial</Badge>
                  ) : (
                    <Badge variant="success">Completo</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLoteDetalle(lote)}
                  >
                    <Eye size={14} />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
