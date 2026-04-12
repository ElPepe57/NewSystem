import React from 'react';
import {
  Check,
  Package,
  Eye,
  RefreshCw,
  Clock,
  Link2,
  XCircle,
  Users,
  ShieldAlert,
  Building2,
  Target,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react';
import { Button, Card } from '../../components/common';
import { DataTable } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import { formatFecha as formatDate } from '../../utils/dateFormatters';
import { formatCurrency } from '../../utils/format';
import type { Requerimiento, EstadoRequerimiento, TipoSolicitante } from '../../types/requerimiento.types';

interface RequerimientosListViewProps {
  requerimientos: Requerimiento[];
  loading: boolean;
  onOpenDetail: (req: Requerimiento) => void;
  onAprobar: (req: Requerimiento) => void;
  onRefresh: () => void;
}

const getEstadoBadge = (estado: EstadoRequerimiento) => {
  const config: Record<EstadoRequerimiento, { label: string; className: string; icon: React.ReactNode }> = {
    pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock className="h-3 w-3" /> },
    aprobado: { label: 'Aprobado', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <Check className="h-3 w-3" /> },
    vinculado_oc: { label: 'Con OC', className: 'bg-sky-100 text-sky-700 border-sky-200', icon: <Link2 className="h-3 w-3" /> },
    completado: { label: 'Completado', className: 'bg-teal-100 text-teal-700 border-teal-200', icon: <Check className="h-3 w-3" /> },
    cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle className="h-3 w-3" /> },
  };
  const c = config[estado] || config.pendiente;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${c.className}`}>
      {c.icon} {c.label}
    </span>
  );
};

const getPrioridadBadge = (prioridad: string) => {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    urgente: { label: 'Urgente', className: 'bg-red-100 text-red-700', icon: <AlertTriangle className="h-3 w-3" /> },
    alta: { label: 'Alta', className: 'bg-amber-100 text-amber-700', icon: <Target className="h-3 w-3" /> },
    normal: { label: 'Normal', className: 'bg-sky-100 text-sky-700', icon: <Lightbulb className="h-3 w-3" /> },
    baja: { label: 'Baja', className: 'bg-slate-100 text-slate-600', icon: <Clock className="h-3 w-3" /> },
  };
  const c = config[prioridad] || config.normal;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${c.className}`}>
      {c.icon} {c.label}
    </span>
  );
};

const getSolicitanteIcon = (tipo: TipoSolicitante) => {
  switch (tipo) {
    case 'empresa': return <Building2 className="h-4 w-4 text-sky-500" />;
    case 'equipo': return <Users className="h-4 w-4 text-purple-500" />;
    case 'gerencia': return <ShieldAlert className="h-4 w-4 text-amber-500" />;
    default: return <Users className="h-4 w-4 text-slate-400" />;
  }
};

const getSolicitanteLabel = (req: Requerimiento) => req.solicitanteNombre || req.tipoSolicitante;

export const RequerimientosListView: React.FC<RequerimientosListViewProps> = ({
  requerimientos, loading, onOpenDetail, onAprobar, onRefresh,
}) => {
  const columns: DataTableColumn<Requerimiento>[] = [
    {
      key: 'numero', header: 'N Req',
      render: r => <span className="font-medium text-teal-600">{r.numeroRequerimiento}</span>,
    },
    {
      key: 'fecha', header: 'Fecha', hideOnMobile: true,
      render: r => <span className="text-slate-500">{formatDate(r.fechaCreacion)}</span>,
    },
    {
      key: 'solicitante', header: 'Solicitante', hideOnMobile: true,
      render: r => (
        <div className="flex items-center">
          {getSolicitanteIcon(r.tipoSolicitante)}
          <span className="ml-2">{getSolicitanteLabel(r)}</span>
        </div>
      ),
    },
    {
      key: 'productos', header: 'Productos',
      render: r => (
        <div className="flex items-center">
          <Package className="h-4 w-4 text-slate-400 mr-2" />
          {r.productos.length} producto(s)
        </div>
      ),
    },
    {
      key: 'costo', header: 'Costo Est. USD', align: 'right', hideOnMobile: true,
      render: r => <span className="font-medium">{formatCurrency(r.expectativa?.costoTotalEstimadoUSD || 0)}</span>,
    },
    {
      key: 'prioridad', header: 'Prioridad', align: 'center',
      render: r => getPrioridadBadge(r.prioridad),
    },
    {
      key: 'estado', header: 'Estado', align: 'center',
      render: r => getEstadoBadge(r.estado),
    },
    {
      key: 'acciones', header: 'Acciones', align: 'center',
      render: r => (
        <div className="flex items-center justify-center space-x-2" onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => onOpenDetail(r)}>
            <Eye className="h-4 w-4" />
          </Button>
          {r.estado === 'pendiente' && (
            <Button variant="ghost" size="sm" onClick={() => onAprobar(r)} className="text-emerald-600 hover:text-emerald-700">
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card padding="none">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          Requerimientos ({requerimientos.length})
        </h3>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <DataTable<Requerimiento>
        columns={columns}
        data={requerimientos}
        keyExtractor={r => r.id}
        loading={loading}
        onRowClick={onOpenDetail}
        emptyMessage="No hay requerimientos registrados"
      />
    </Card>
  );
};
