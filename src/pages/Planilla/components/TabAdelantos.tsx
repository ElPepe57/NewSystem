/**
 * TabAdelantos.tsx — Lista y registro de adelantos de nómina.
 */
import React, { useEffect, useState } from 'react';
import { Plus, DollarSign, Clock, CheckCircle, XCircle, ArrowDownCircle } from 'lucide-react';
import { Badge, Button } from '../../../components/common';
import { useToastStore } from '../../../store/toastStore';
import { usePlanillaStore } from '../../../store/planillaStore';
import { formatCurrency } from '../../../utils/format';
import { TIPO_ADELANTO_LABELS, ESTADO_ADELANTO_LABELS } from '../../../types/planilla.types';
import { AdelantoForm } from './AdelantoForm';

const ESTADO_BADGE: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  pendiente: 'default',
  pagado: 'warning',
  descontado: 'success',
  anulado: 'danger',
};

const ESTADO_ICON: Record<string, React.ReactNode> = {
  pendiente: <Clock size={14} className="text-slate-400" />,
  pagado: <DollarSign size={14} className="text-amber-600" />,
  descontado: <CheckCircle size={14} className="text-green-600" />,
  anulado: <XCircle size={14} className="text-red-500" />,
};

export const TabAdelantos: React.FC = () => {
  const toast = useToastStore();
  const { adelantos, loadingAdelantos, fetchAdelantos } = usePlanillaStore();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { fetchAdelantos(); }, []);

  const totalPendiente = adelantos
    .filter(a => a.estado === 'pagado')
    .reduce((s, a) => s + a.montoPEN, 0);

  if (loadingAdelantos) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mr-3" />
        Cargando adelantos...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          {totalPendiente > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm">
              <span className="text-amber-700">Pendiente de descuento: </span>
              <span className="font-semibold font-mono text-amber-800">{formatCurrency(totalPendiente, 'PEN')}</span>
            </div>
          )}
        </div>
        <Button variant="primary" onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-1" /> Nuevo adelanto
        </Button>
      </div>

      {/* Tabla */}
      {adelantos.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <ArrowDownCircle size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No hay adelantos registrados</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Empleado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Descripcion</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Monto</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Boleta</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {adelantos.map(a => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{a.id}</td>
                  <td className="px-4 py-3">{a.empleadoNombre}</td>
                  <td className="px-4 py-3 text-xs">{TIPO_ADELANTO_LABELS[a.tipo]}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 truncate max-w-[200px]">{a.descripcion}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(a.montoPEN, 'PEN')}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={ESTADO_BADGE[a.estado] || 'default'}>
                      <span className="flex items-center gap-1">
                        {ESTADO_ICON[a.estado]}
                        {ESTADO_ADELANTO_LABELS[a.estado]}
                      </span>
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {a.boletaDescontadaId || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nuevo adelanto */}
      <AdelantoForm open={showForm} onClose={() => { setShowForm(false); fetchAdelantos(); }} />
    </div>
  );
};
