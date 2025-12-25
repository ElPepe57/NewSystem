import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, DollarSign, Percent } from 'lucide-react';
import type { HistorialPrecio } from '../../../types/producto.types';
import type { Timestamp } from 'firebase/firestore';

interface HistorialPreciosChartProps {
  historial: HistorialPrecio[];
  tipoCambioActual: number;
}

export const HistorialPreciosChart: React.FC<HistorialPreciosChartProps> = ({
  historial,
  tipoCambioActual
}) => {
  // Convertir y ordenar historial por fecha
  const datos = useMemo(() => {
    return historial
      .map(h => ({
        ...h,
        fechaDate: (h.fecha as Timestamp)?.toDate?.() || new Date()
      }))
      .sort((a, b) => a.fechaDate.getTime() - b.fechaDate.getTime());
  }, [historial]);

  // Calcular estadísticas
  const stats = useMemo(() => {
    if (datos.length === 0) return null;

    const margenes = datos.map(d => d.margenEstimado);
    const preciosUSA = datos.map(d => d.precioUSAPromedio);
    const preciosPeru = datos.map(d => d.precioPERUPromedio);

    const ultimoMargen = margenes[margenes.length - 1];
    const primerMargen = margenes[0];
    const cambioMargen = ultimoMargen - primerMargen;

    const promedioMargen = margenes.reduce((a, b) => a + b, 0) / margenes.length;
    const maxMargen = Math.max(...margenes);
    const minMargen = Math.min(...margenes);

    return {
      cambioMargen,
      promedioMargen,
      maxMargen,
      minMargen,
      ultimoMargen,
      tendencia: cambioMargen > 2 ? 'subiendo' : cambioMargen < -2 ? 'bajando' : 'estable',
      precioUSAActual: preciosUSA[preciosUSA.length - 1],
      precioPeruActual: preciosPeru[preciosPeru.length - 1]
    };
  }, [datos]);

  if (datos.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Sin historial de precios aún</p>
        <p className="text-xs mt-1">El historial se genera al actualizar la investigación</p>
      </div>
    );
  }

  // Calcular valores para el gráfico de barras simple
  const maxValor = Math.max(...datos.map(d => Math.max(d.precioUSAPromedio * tipoCambioActual, d.precioPERUPromedio)));

  const formatFecha = (fecha: Date) => {
    return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  };

  const getTendenciaIcon = () => {
    if (!stats) return null;
    if (stats.tendencia === 'subiendo') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (stats.tendencia === 'bajando') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getTendenciaColor = () => {
    if (!stats) return 'text-gray-600';
    if (stats.tendencia === 'subiendo') return 'text-green-600';
    if (stats.tendencia === 'bajando') return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-4">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex items-center gap-1 text-xs text-blue-600 mb-1">
            <DollarSign className="h-3 w-3" />
            USA Actual
          </div>
          <p className="text-lg font-bold text-blue-700">
            ${stats?.precioUSAActual?.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="bg-orange-50 rounded-lg p-3">
          <div className="flex items-center gap-1 text-xs text-orange-600 mb-1">
            <DollarSign className="h-3 w-3" />
            Perú Actual
          </div>
          <p className="text-lg font-bold text-orange-700">
            S/{stats?.precioPeruActual?.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="bg-green-50 rounded-lg p-3">
          <div className="flex items-center gap-1 text-xs text-green-600 mb-1">
            <Percent className="h-3 w-3" />
            Margen Actual
          </div>
          <p className="text-lg font-bold text-green-700">
            {stats?.ultimoMargen?.toFixed(1) || '0'}%
          </p>
        </div>

        <div className={`rounded-lg p-3 ${
          stats?.tendencia === 'subiendo' ? 'bg-green-50' :
          stats?.tendencia === 'bajando' ? 'bg-red-50' : 'bg-gray-50'
        }`}>
          <div className={`flex items-center gap-1 text-xs mb-1 ${getTendenciaColor()}`}>
            {getTendenciaIcon()}
            Tendencia
          </div>
          <p className={`text-lg font-bold ${getTendenciaColor()}`}>
            {stats?.cambioMargen !== undefined ? (
              <>
                {stats.cambioMargen > 0 ? '+' : ''}{stats.cambioMargen.toFixed(1)}%
              </>
            ) : '-'}
          </p>
        </div>
      </div>

      {/* Gráfico de barras comparativo */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h5 className="text-sm font-medium text-gray-700 mb-3">Evolución de Precios</h5>

        <div className="space-y-3">
          {datos.slice(-6).map((registro, index) => {
            const precioUSAPEN = registro.precioUSAPromedio * registro.tipoCambio;
            const widthUSA = maxValor > 0 ? (precioUSAPEN / maxValor) * 100 : 0;
            const widthPeru = maxValor > 0 ? (registro.precioPERUPromedio / maxValor) * 100 : 0;

            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatFecha(registro.fechaDate)}</span>
                  <span className="font-medium text-gray-700">
                    Margen: {registro.margenEstimado.toFixed(1)}%
                  </span>
                </div>

                {/* Barra USA */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-600 w-16">USA</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all"
                      style={{ width: `${widthUSA}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-20 text-right">
                    S/{precioUSAPEN.toFixed(2)}
                  </span>
                </div>

                {/* Barra Perú */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-orange-600 w-16">Perú</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-orange-500 h-full rounded-full transition-all"
                      style={{ width: `${widthPeru}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-20 text-right">
                    S/{registro.precioPERUPromedio.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {datos.length > 6 && (
          <p className="text-xs text-gray-400 mt-3 text-center">
            Mostrando últimas 6 actualizaciones de {datos.length} totales
          </p>
        )}
      </div>

      {/* Resumen de rango */}
      <div className="flex items-center justify-between text-sm bg-gray-100 rounded-lg p-3">
        <div>
          <span className="text-gray-500">Margen histórico:</span>
          <span className="ml-2 font-medium">
            {stats?.minMargen?.toFixed(1)}% - {stats?.maxMargen?.toFixed(1)}%
          </span>
        </div>
        <div>
          <span className="text-gray-500">Promedio:</span>
          <span className="ml-2 font-medium text-green-600">
            {stats?.promedioMargen?.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
};
