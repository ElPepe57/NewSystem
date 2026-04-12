/**
 * TabAdelantos.tsx — Lista y registro de adelantos de nómina.
 */
import React, { useEffect, useState } from 'react';
import { Plus, DollarSign, Clock, CheckCircle, XCircle, ArrowDownCircle } from 'lucide-react';
import { Badge, Button } from '../../../components/common';
import { DataTable } from '../../../design-system';
import type { DataTableColumn } from '../../../design-system';
import { useToastStore } from '../../../store/toastStore';
import { usePlanillaStore } from '../../../store/planillaStore';
import { formatCurrency } from '../../../utils/format';
import { TIPO_ADELANTO_LABELS, ESTADO_ADELANTO_LABELS } from '../../../types/planilla.types';
import { AdelantoForm } from './AdelantoForm';
import type { AdelantoNomina } from '../../../types/planilla.types';

const ESTADO_BADGE: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  pendiente: 'default',
  pagado: 'warning',
  descontado: 'success',
  anulado: 'danger',
};

const ESTADO_ICON: Record<string, React.ReactNode> = {
  pendiente: <Clock size={14} className="text-slate-400" />,
  pagado: <DollarSign size={14} className="text-amber-600" />,
  descontado: <CheckCircle size={14} className="text-emerald-600" />,
  anulado: <XCircle size={14} className="text-red-500" />,
};

const adelantoColumns: DataTableColumn<AdelantoNomina>[] = [
  {
    key: 'id', header: 'ID',
    render: a => <span className="font-mono text-xs">{a.id}</span>,
  },
  {
    key: 'empleado', header: 'Empleado',
    render: a => <span>{a.empleadoNombre}</span>,
  },
  {
    key: 'tipo', header: 'Tipo', hideOnMobile: true,
    render: a => <span className="text-xs">{TIPO_ADELANTO_LABELS[a.tipo]}</span>,
  },
  {
    key: 'descripcion', header: 'Descripcion', hideOnMobile: true,
    render: a => <span className="text-xs text-slate-600 truncate max-w-[200px] block">{a.descripcion}</span>,
  },
  {
    key: 'monto', header: 'Monto', align: 'right',
    render: a => <span className="font-mono">{formatCurrency(a.montoPEN, 'PEN')}</span>,
  },
  {
    key: 'estado', header: 'Estado', align: 'center',
    render: a => (
      <Badge variant={ESTADO_BADGE[a.estado] || 'default'}>
        <span className="flex items-center gap-1">
          {ESTADO_ICON[a.estado]}
          {ESTADO_ADELANTO_LABELS[a.estado]}
        </span>
      </Badge>
    ),
  },
  {
    key: 'boleta', header: 'Boleta', hideOnMobile: true,
    render: a => <span className="font-mono text-xs text-slate-500">{a.boletaDescontadaId || '—'}</span>,
  },
];

export const TabAdelantos: React.FC = () => {
  const toast = useToastStore();
  const { adelantos, loadingAdelantos, fetchAdelantos } = usePlanillaStore();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { fetchAdelantos(); }, []);

  const totalPendiente = adelantos
    .filter(a => a.estado === 'pagado')
    .reduce((s, a) => s + a.montoPEN, 0);

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
      <div className="border rounded-lg overflow-hidden">
        <DataTable<AdelantoNomina>
          columns={adelantoColumns}
          data={adelantos}
          keyExtractor={a => a.id}
          loading={loadingAdelantos}
          emptyState={
            <div className="text-center py-12 text-slate-500">
              <ArrowDownCircle size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No hay adelantos registrados</p>
            </div>
          }
        />
      </div>

      {/* Modal nuevo adelanto */}
      <AdelantoForm open={showForm} onClose={() => { setShowForm(false); fetchAdelantos(); }} />
    </div>
  );
};
