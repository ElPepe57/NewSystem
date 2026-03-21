import React from 'react';
import {
  LinkIcon,
  Clock,
  ShoppingCart,
  MessageCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import type { MLTabType, MLProductMap, MLOrderSync } from '../../types/mercadoLibre.types';
import { OrderRow } from './OrderRow';

// ---- KPI CARD ----
const KPICard: React.FC<{
  label: string;
  value: string | number;
  icon: React.FC<{ className?: string }>;
  color: string;
  onClick?: () => void;
}> = ({ label, value, icon: Icon, color, onClick }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200 p-4 ${onClick ? 'cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.gray}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
};

// ---- RESUMEN TAB ----
export interface TabResumenProps {
  config: any;
  productMaps: MLProductMap[];
  orderSyncs: MLOrderSync[];
  vinculados: number;
  sinVincular: number;
  ordenesPendientes: number;
  ordenesProcesadas: number;
  preguntasSinResponder: number;
  onNavigate: (tab: MLTabType) => void;
}

export const TabResumen: React.FC<TabResumenProps> = ({
  vinculados,
  sinVincular,
  ordenesPendientes,
  ordenesProcesadas,
  preguntasSinResponder,
  orderSyncs,
  onNavigate,
}) => {
  const totalVentasML = orderSyncs
    .filter((o) => o.estado === 'procesada')
    .reduce((sum, o) => sum + o.totalML, 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Productos Vinculados"
          value={`${vinculados}/${vinculados + sinVincular}`}
          icon={LinkIcon}
          color="blue"
          onClick={() => onNavigate('productos')}
        />
        <KPICard
          label="Órdenes Pendientes"
          value={ordenesPendientes}
          icon={Clock}
          color={ordenesPendientes > 0 ? 'amber' : 'green'}
          onClick={() => onNavigate('ordenes')}
        />
        <KPICard
          label="Ventas ML (mes)"
          value={`S/ ${totalVentasML.toFixed(0)}`}
          icon={ShoppingCart}
          color="green"
        />
        <KPICard
          label="Preguntas"
          value={preguntasSinResponder}
          icon={MessageCircle}
          color={preguntasSinResponder > 0 ? 'red' : 'gray'}
          onClick={() => onNavigate('preguntas')}
        />
      </div>

      {/* Actividad reciente */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Órdenes Recientes</h3>
        {orderSyncs.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No hay órdenes sincronizadas aún</p>
        ) : (
          <div className="space-y-2">
            {orderSyncs.slice(0, 5).map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
            {orderSyncs.length > 5 && (
              <button
                onClick={() => onNavigate('ordenes')}
                className="w-full text-center text-sm text-amber-600 hover:text-amber-700 py-2 font-medium"
              >
                Ver todas las órdenes ({orderSyncs.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Alertas */}
      {sinVincular > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <div>
              <p className="font-medium text-orange-800">
                {sinVincular} producto{sinVincular > 1 ? 's' : ''} sin vincular
              </p>
              <p className="text-sm text-orange-600">
                Vincula tus productos de ML con los del ERP para procesar órdenes automáticamente.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('productos')}
            className="flex items-center gap-1 text-sm font-medium text-orange-700 hover:text-orange-800"
          >
            Vincular <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
