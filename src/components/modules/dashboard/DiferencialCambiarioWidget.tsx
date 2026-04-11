import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '../../common';
import { poolUSDViewService } from '../../../services/poolUSD.view.service';
import { tipoCambioService } from '../../../services/tipoCambio.service';

interface FXData {
  tcpa: number;
  tcDelDia: number;
  saldoUSD: number;
  gananciaPerdiaPotencialPEN: number;
  impactoMensualPEN: number;
}

/**
 * Widget de Diferencial Cambiario 360
 *
 * Muestra:
 * - TCPA vs TC del dia (ganancia/perdida potencial sobre saldo USD)
 * - Impacto FX acumulado del mes
 * - Indicador visual: verde = ganancia, rojo = perdida
 */
export const DiferencialCambiarioWidget: React.FC = () => {
  const [data, setData] = useState<FXData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rendimiento, tcResult] = await Promise.all([
          poolUSDViewService.getRendimientoCambiario(),
          tipoCambioService.getTCDelDia().catch(() => null),
        ]);

        const tcDelDia = tcResult?.venta || tcResult?.compra || 0;
        const tcpa = rendimiento.tcpa;
        const saldoUSD = rendimiento.saldoUSD;

        // Ganancia/perdida potencial = saldoUSD * (tcDelDia - tcpa)
        // Si tcDelDia > tcpa: el dolar vale mas hoy que lo que pagamos -> ganancia
        const gananciaPerdiaPotencialPEN = tcpa > 0 && tcDelDia > 0
          ? saldoUSD * (tcDelDia - tcpa)
          : 0;

        setData({
          tcpa,
          tcDelDia,
          saldoUSD,
          gananciaPerdiaPotencialPEN: Math.round(gananciaPerdiaPotencialPEN * 100) / 100,
          impactoMensualPEN: 0, // Se calculara con OCs del mes
        });
      } catch (error) {
        console.error('Error loading FX data:', error);
      } finally {
        setLoading(false);
      }
    };

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

  if (!data || data.tcpa === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Impacto FX</h3>
        </div>
        <p className="text-xs text-slate-500">Sin datos de tipo de cambio disponibles.</p>
      </Card>
    );
  }

  const esGanancia = data.gananciaPerdiaPotencialPEN >= 0;
  const fmt = (n: number) => `S/${Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Card className={`p-4 ${esGanancia ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200' : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className={`h-5 w-5 ${esGanancia ? 'text-emerald-600' : 'text-red-600'}`} />
          <h3 className={`font-semibold ${esGanancia ? 'text-emerald-900' : 'text-red-900'}`}>
            Impacto FX del Mes
          </h3>
        </div>
        {esGanancia
          ? <TrendingUp className="h-5 w-5 text-emerald-500" />
          : data.gananciaPerdiaPotencialPEN < 0
            ? <TrendingDown className="h-5 w-5 text-red-500" />
            : <Minus className="h-4 w-4 text-slate-400" />
        }
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Ganancia/Perdida potencial */}
        <div>
          <div className={`text-xs ${esGanancia ? 'text-emerald-700' : 'text-red-700'}`}>
            {esGanancia ? 'Ganancia potencial' : 'P\u00e9rdida potencial'}
          </div>
          <div className={`text-xl font-bold ${esGanancia ? 'text-emerald-900' : 'text-red-900'}`}>
            {esGanancia ? '+' : '-'}{fmt(data.gananciaPerdiaPotencialPEN)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            sobre ${data.saldoUSD.toFixed(2)} USD en pool
          </div>
        </div>

        {/* TC comparativo */}
        <div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-slate-500">TCPA</div>
              <div className="text-sm font-bold text-slate-900">
                {data.tcpa > 0 ? data.tcpa.toFixed(4) : '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">TC Hoy</div>
              <div className="text-sm font-bold text-slate-900">
                {data.tcDelDia > 0 ? data.tcDelDia.toFixed(4) : '-'}
              </div>
            </div>
          </div>
          {data.tcpa > 0 && data.tcDelDia > 0 && (
            <div className={`text-xs mt-1 ${esGanancia ? 'text-emerald-600' : 'text-red-600'}`}>
              Diferencia: {((data.tcDelDia - data.tcpa) / data.tcpa * 100).toFixed(2)}%
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
