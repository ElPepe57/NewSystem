import React from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  ThumbsDown,
  AlertTriangle,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { formatCurrencyPEN } from '../../utils/format';
import { Card } from '../../components/common';

export interface CotizacionesMetricasData {
  pendientes: number;
  nuevas: number;
  pendienteAdelanto: number;
  listasParaConfirmar: number;
  sinAdelanto: number;
  conAdelanto: number;
  confirmadas: number;
  rechazadas: number;
  valorTotal: number;
  valorReservado: number;
  valorEsperandoPago: number;
  valorConfirmado: number;
  proximasAVencer: number;
  virtuales: number;
  tasaConversion: number;
}

interface CotizacionesMetricasProps {
  metricas: CotizacionesMetricasData;
}

export const CotizacionesMetricas: React.FC<CotizacionesMetricasProps> = ({ metricas }) => {
  const formatCurrency = (amount: number): string => formatCurrencyPEN(amount);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-4">
      <Card padding="md" className="border-l-4 border-l-gray-400">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 uppercase">Nuevas</div>
            <div className="text-2xl font-bold text-gray-600">{metricas.nuevas}</div>
          </div>
          <FileText className="h-8 w-8 text-gray-300" />
        </div>
      </Card>

      <Card padding="md" className="border-l-4 border-l-amber-400">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 uppercase">Esperando Pago</div>
            <div className="text-2xl font-bold text-amber-600">{metricas.pendienteAdelanto}</div>
          </div>
          <Clock className="h-8 w-8 text-amber-300" />
        </div>
      </Card>

      <Card padding="md" className="border-l-4 border-l-green-400">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 uppercase">Listas</div>
            <div className="text-2xl font-bold text-green-600">{metricas.listasParaConfirmar}</div>
          </div>
          <CheckCircle className="h-8 w-8 text-green-300" />
        </div>
      </Card>

      <Card padding="md" className="border-l-4 border-l-red-400">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 uppercase">Rechazadas</div>
            <div className="text-2xl font-bold text-red-600">{metricas.rechazadas}</div>
          </div>
          <ThumbsDown className="h-8 w-8 text-red-300" />
        </div>
      </Card>

      <Card padding="md" className="border-l-4 border-l-amber-400">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 uppercase">Por Vencer</div>
            <div className="text-2xl font-bold text-amber-600">{metricas.proximasAVencer}</div>
          </div>
          <AlertTriangle className="h-8 w-8 text-amber-300" />
        </div>
      </Card>

      <Card padding="md" className="border-l-4 border-l-purple-400">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 uppercase">Pipeline</div>
            <div className="text-lg font-bold text-purple-600">{formatCurrency(metricas.valorTotal)}</div>
          </div>
          <DollarSign className="h-8 w-8 text-purple-300" />
        </div>
      </Card>

      <Card padding="md" className="border-l-4 border-l-teal-400">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 uppercase">Conversión</div>
            <div className="text-2xl font-bold text-teal-600">{metricas.tasaConversion.toFixed(1)}%</div>
          </div>
          <TrendingUp className="h-8 w-8 text-teal-300" />
        </div>
      </Card>
    </div>
  );
};
