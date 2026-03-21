import React from 'react';
import {
  Check,
  XCircle,
  Link2,
  Package,
  ShoppingCart,
  AlertTriangle,
  Users,
  Building2,
  Target,
  Lightbulb,
  CheckSquare,
  Square
} from 'lucide-react';
import { Button, LineaNegocioBadge } from '../../components/common';
import { formatCurrency } from '../../utils/format';
import type { Requerimiento, EstadoRequerimiento, TipoSolicitante } from '../../types/expectativa.types';

interface KanbanCardProps {
  req: Requerimiento;
  isSelected: boolean;
  isSelectable: boolean;
  onSelect: (reqId: string) => void;
  onOpenDetail: (req: Requerimiento) => void;
  onAprobar: (req: Requerimiento) => void;
  onCancelar: (req: Requerimiento) => void;
  onGenerarOC: (req: Requerimiento) => void;
}

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

export const KanbanCard: React.FC<KanbanCardProps> = ({
  req,
  isSelected,
  isSelectable,
  onSelect,
  onOpenDetail,
  onAprobar,
  onCancelar,
  onGenerarOC
}) => {
  return (
    <div
      key={req.id}
      className={`bg-white rounded-lg shadow-sm border p-4 mb-3 hover:shadow-md transition-shadow cursor-pointer ${
        isSelected ? 'border-primary-500 ring-2 ring-primary-200 bg-primary-50' : 'border-gray-200'
      }`}
      onClick={() => {
        if (isSelectable) {
          onSelect(req.id!);
        } else {
          onOpenDetail(req);
        }
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {isSelectable && (
            <span className="flex-shrink-0">
              {isSelected ? (
                <CheckSquare className="h-4 w-4 text-primary-600" />
              ) : (
                <Square className="h-4 w-4 text-gray-400" />
              )}
            </span>
          )}
          <span className="font-semibold text-primary-600 text-sm">{req.numeroRequerimiento}</span>
        </div>
        {getPrioridadBadge(req.prioridad)}
      </div>

      {/* Solicitante */}
      <div className="flex items-center text-sm text-gray-600 mb-2">
        {getSolicitanteIcon(req.tipoSolicitante)}
        <span className="ml-1.5 truncate">{getSolicitanteLabel(req)}</span>
      </div>

      {/* Productos + Linea */}
      <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
        <div className="flex items-center">
          <Package className="h-4 w-4 mr-1.5" />
          {req.productos.length} producto(s)
        </div>
        <LineaNegocioBadge lineaNegocioId={req.lineaNegocioId} />
      </div>

      {/* Costo estimado */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-500">Costo Est.</span>
        <span className="font-semibold text-gray-900">
          {formatCurrency(req.expectativa?.costoTotalEstimadoUSD || 0)}
        </span>
      </div>

      {/* Acciones rapidas — pendiente */}
      {req.estado === 'pendiente' && (
        <div className="mt-3 pt-2 border-t border-gray-100 flex gap-2">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onAprobar(req);
            }}
          >
            <Check className="h-4 w-4 mr-1" />
            Aprobar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onCancelar(req);
            }}
            title="Cancelar requerimiento"
          >
            <XCircle className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      )}

      {/* OC Actions — aprobado */}
      {req.estado === 'aprobado' && (
        <div className="mt-3 pt-2 border-t border-gray-100 flex gap-2">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onGenerarOC(req);
            }}
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            Generar OC
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onCancelar(req);
            }}
            title="Cancelar requerimiento"
          >
            <XCircle className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      )}

      {/* parcial */}
      {req.estado === 'parcial' && req.ocCoverage && (
        <div className="mt-3 pt-2 border-t border-gray-100 space-y-2">
          <div className="flex items-center gap-2 text-xs text-indigo-600">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-indigo-500 rounded-full h-1.5 transition-all"
                style={{ width: `${req.ocCoverage.porcentaje}%` }}
              />
            </div>
            <span className="font-medium">{req.ocCoverage.porcentaje}%</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>{req.ocCoverage.productosPendientes} pendiente(s)</span>
            {req.ordenCompraNumeros && req.ordenCompraNumeros.length > 0 && (
              <span className="ml-auto text-indigo-600 font-medium">
                {req.ordenCompraNumeros.join(', ')}
              </span>
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onGenerarOC(req);
            }}
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            Continuar OC
          </Button>
        </div>
      )}

      {/* en_proceso */}
      {req.estado === 'en_proceso' && req.ordenCompraNumeros && req.ordenCompraNumeros.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-purple-600">
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="font-medium">{req.ordenCompraNumeros.join(', ')}</span>
          </div>
        </div>
      )}
    </div>
  );
};
