import React from 'react';
import { Clock, Check, Link2, AlertTriangle, DollarSign, Package } from 'lucide-react';
import { Card } from '../../components/common';
import { formatCurrency } from '../../utils/format';
import type { RequerimientosStats } from './requerimientos.types';

interface RequerimientosKPIGridProps {
  stats: RequerimientosStats;
}

export const RequerimientosKPIGrid: React.FC<RequerimientosKPIGridProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <Card padding="md" className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-yellow-600 font-medium">Pendientes</div>
            <div className="text-2xl font-bold text-yellow-700">{stats.pendientes}</div>
          </div>
          <Clock className="h-8 w-8 text-yellow-400" />
        </div>
      </Card>

      <Card padding="md" className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-blue-600 font-medium">Aprobados</div>
            <div className="text-2xl font-bold text-blue-700">{stats.aprobados}</div>
          </div>
          <Check className="h-8 w-8 text-blue-400" />
        </div>
      </Card>

      <Card padding="md" className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-purple-600 font-medium">En Proceso</div>
            <div className="text-2xl font-bold text-purple-700">{stats.enProceso}</div>
          </div>
          <Link2 className="h-8 w-8 text-purple-400" />
        </div>
      </Card>

      <Card padding="md" className={`${stats.urgentes > 0 ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-red-600 font-medium">Urgentes</div>
            <div className="text-2xl font-bold text-red-700">{stats.urgentes}</div>
          </div>
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
      </Card>

      <Card padding="md">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-600 font-medium">Costo Pendiente</div>
            <div className="text-lg font-bold text-gray-900">
              {formatCurrency(stats.costoEstimadoPendiente)}
            </div>
          </div>
          <DollarSign className="h-8 w-8 text-gray-400" />
        </div>
      </Card>

      <Card padding="md" className={`${stats.alertasStock > 0 ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-orange-600 font-medium">Alertas Stock</div>
            <div className="text-2xl font-bold text-orange-700">{stats.alertasStock}</div>
          </div>
          <Package className="h-8 w-8 text-orange-400" />
        </div>
      </Card>
    </div>
  );
};
