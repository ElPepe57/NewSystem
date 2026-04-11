import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, RefreshCw } from 'lucide-react';
import { poolUSDViewService } from '../../../services/poolUSD.view.service';
import { Card } from '../../common';

interface PoolUSDData {
  tcpa: number;
  saldoUSD: number;
  valorEnPEN: number;
  cuentas: Array<{ id: string; nombre: string; saldo: number }>;
}

/**
 * Widget compacto de Pool USD para mostrar en Tesoreria.
 * Reemplaza el tab separado de Pool USD.
 * Calcula TCPA desde movimientos de cuentas USD en Tesoreria.
 */
export const PoolUSDWidget: React.FC = () => {
  const [data, setData] = useState<PoolUSDData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rendimiento, saldoData] = await Promise.all([
        poolUSDViewService.getRendimientoCambiario(),
        poolUSDViewService.getSaldoUSD(),
      ]);

      setData({
        tcpa: rendimiento.tcpa,
        saldoUSD: rendimiento.saldoUSD,
        valorEnPEN: rendimiento.valorEnPEN,
        cuentas: saldoData.cuentas,
      });
    } catch (error) {
      console.error('Error loading Pool USD data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
        <div className="h-8 bg-slate-200 rounded w-1/2" />
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-green-900">Pool USD</h3>
        </div>
        <button
          onClick={fetchData}
          className="p-1 rounded hover:bg-green-100 transition-colors"
          title="Actualizar"
        >
          <RefreshCw className="h-3.5 w-3.5 text-green-600" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-green-700">Saldo USD</div>
          <div className="text-lg font-bold text-green-900">
            ${data.saldoUSD.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-green-700">TCPA</div>
          <div className="text-lg font-bold text-green-900">
            {data.tcpa > 0 ? `S/${data.tcpa.toFixed(4)}` : '-'}
          </div>
        </div>
        <div>
          <div className="text-xs text-green-700">Valor en PEN</div>
          <div className="text-lg font-bold text-green-900">
            {data.valorEnPEN > 0 ? `S/${data.valorEnPEN.toFixed(2)}` : '-'}
          </div>
        </div>
      </div>

      {data.cuentas.length > 0 && (
        <div className="mt-3 pt-3 border-t border-green-200">
          <div className="text-xs text-green-700 mb-1">Cuentas USD</div>
          {data.cuentas.map(cuenta => (
            <div key={cuenta.id} className="flex justify-between text-sm">
              <span className="text-green-800">{cuenta.nombre}</span>
              <span className="font-medium text-green-900">${cuenta.saldo.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
