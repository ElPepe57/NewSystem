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
  Loader2
} from 'lucide-react';
import { Button, Card } from '../../components/common';
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
  const config: Record<EstadoRequerimiento, { color: string; icon: React.ReactNode }> = {
    borrador: { color: 'bg-gray-100 text-gray-800', icon: <Clock className="h-3 w-3" /> },
    pendiente: { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-3 w-3" /> },
    pendiente_aprobacion: { color: 'bg-amber-100 text-amber-800 border border-amber-300', icon: <ShieldAlert className="h-3 w-3" /> },
    aprobado: { color: 'bg-blue-100 text-blue-800', icon: <Check className="h-3 w-3" /> },
    parcial: { color: 'bg-indigo-100 text-indigo-800', icon: <Link2 className="h-3 w-3" /> },
    en_proceso: { color: 'bg-purple-100 text-purple-800', icon: <Link2 className="h-3 w-3" /> },
    completado: { color: 'bg-green-100 text-green-800', icon: <Check className="h-3 w-3" /> },
    cancelado: { color: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3" /> }
  };

  const { color, icon } = config[estado];
  const labels: Partial<Record<EstadoRequerimiento, string>> = {
    pendiente_aprobacion: 'Firma Pendiente',
  };
  const label = labels[estado] || estado.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {icon}
      <span className="ml-1 capitalize">{label}</span>
    </span>
  );
};

const getPrioridadBadge = (prioridad: string) => {
  const config: Record<string, string> = {
    urgente: 'bg-red-200 text-red-900 border-red-300',
    alta: 'bg-red-100 text-red-800 border-red-200',
    media: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    normal: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    baja: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config[prioridad] || config.baja}`}>
      {(prioridad === 'alta' || prioridad === 'urgente') && <AlertTriangle className="h-3 w-3 mr-1" />}
      {prioridad}
    </span>
  );
};

const getSolicitanteIcon = (tipo: TipoSolicitante) => {
  switch (tipo) {
    case 'cliente': return <Users className="h-4 w-4 text-blue-500" />;
    case 'administracion': return <Building2 className="h-4 w-4 text-gray-500" />;
    case 'ventas': return <Target className="h-4 w-4 text-green-500" />;
    case 'investigacion': return <Lightbulb className="h-4 w-4 text-yellow-500" />;
    default: return null;
  }
};

const getSolicitanteLabel = (req: Requerimiento) => {
  if (req.tipoSolicitante === 'cliente' && req.nombreClienteSolicitante) {
    return req.nombreClienteSolicitante;
  }
  switch (req.tipoSolicitante) {
    case 'administracion': return 'Administracion';
    case 'ventas': return 'Ventas';
    case 'investigacion': return 'Investigacion';
    default: return req.origen?.replace('_', ' ') || '-';
  }
};

export const RequerimientosListView: React.FC<RequerimientosListViewProps> = ({
  requerimientos,
  loading,
  onOpenDetail,
  onAprobar,
  onRefresh
}) => {
  return (
    <Card padding="none">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Requerimientos ({requerimientos.length})
        </h3>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N Req</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solicitante</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Productos</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Est. USD</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Prioridad</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-600 mx-auto" />
                </td>
              </tr>
            ) : requerimientos.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">No hay requerimientos registrados</td>
              </tr>
            ) : (
              requerimientos.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-primary-600">{req.numeroRequerimiento}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(req.fechaCreacion)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center">
                      {getSolicitanteIcon(req.tipoSolicitante)}
                      <span className="ml-2">{getSolicitanteLabel(req)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center">
                      <Package className="h-4 w-4 text-gray-400 mr-2" />
                      {req.productos.length} producto(s)
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                    {formatCurrency(req.expectativa?.costoTotalEstimadoUSD || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {getPrioridadBadge(req.prioridad)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {getEstadoBadge(req.estado)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenDetail(req)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {req.estado === 'pendiente' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAprobar(req)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
