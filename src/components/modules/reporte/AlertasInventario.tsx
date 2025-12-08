import React from 'react';
import { AlertTriangle, AlertCircle, Clock, XCircle } from 'lucide-react';
import { Badge } from '../../common';
import type { AlertaInventario } from '../../../types/reporte.types';

interface AlertasInventarioProps {
  alertas: AlertaInventario[];
}

const iconos = {
  stock_bajo: AlertCircle,
  stock_critico: XCircle,
  proximo_vencer: Clock,
  vencido: AlertTriangle
};

const colores = {
  stock_bajo: 'text-warning-600',
  stock_critico: 'text-danger-600',
  proximo_vencer: 'text-warning-600',
  vencido: 'text-danger-600'
};

const backgrounds = {
  stock_bajo: 'bg-warning-50',
  stock_critico: 'bg-danger-50',
  proximo_vencer: 'bg-warning-50',
  vencido: 'bg-danger-50'
};

export const AlertasInventario: React.FC<AlertasInventarioProps> = ({ alertas }) => {
  if (alertas.length === 0) {
    return (
      <div className="text-center py-8 text-success-600">
        ✅ No hay alertas - Todo está en orden
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alertas.map((alerta, index) => {
        const Icon = iconos[alerta.tipo];
        const color = colores[alerta.tipo];
        const bg = backgrounds[alerta.tipo];
        
        return (
          <div key={index} className={`${bg} p-4 rounded-lg border border-gray-200`}>
            <div className="flex items-start">
              <Icon className={`h-5 w-5 ${color} mr-3 mt-0.5`} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {alerta.marca} {alerta.nombreComercial}
                  </h4>
                  <Badge 
                    variant={alerta.prioridad === 'alta' ? 'danger' : 'warning'}
                    size="sm"
                  >
                    {alerta.prioridad.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-gray-700">{alerta.mensaje}</p>
                <p className="text-xs text-gray-500 mt-1">SKU: {alerta.sku}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};