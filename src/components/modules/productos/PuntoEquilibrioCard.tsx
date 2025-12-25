import React, { useState, useMemo, useEffect } from 'react';
import {
  Target,
  TrendingUp,
  Clock,
  DollarSign,
  Package,
  Calculator,
  AlertTriangle,
  CheckCircle,
  Info,
  ShoppingCart,
  RotateCcw
} from 'lucide-react';
import { ProductoService } from '../../../services/producto.service';
import type { PuntoEquilibrio } from '../../../types/producto.types';

interface PuntoEquilibrioCardProps {
  ctruEstimado: number;
  precioVentaSugerido: number;
  precioPERUMin: number;
  demandaEstimada: 'baja' | 'media' | 'alta';
  volumenMercadoEstimado?: number;
  costoTotalUSD?: number; // Costo total por unidad en USD (para mostrar inversion en USD)
  /** Precio de entrada competitivo (si existe en la investigacion) */
  precioEntrada?: number;
}

export const PuntoEquilibrioCard: React.FC<PuntoEquilibrioCardProps> = ({
  ctruEstimado,
  precioVentaSugerido,
  precioPERUMin,
  demandaEstimada,
  volumenMercadoEstimado,
  costoTotalUSD = 0,
  precioEntrada
}) => {
  // Calcular ventas mensuales estimadas basado en demanda
  const calcularVentasEstimadas = () => {
    if (volumenMercadoEstimado && volumenMercadoEstimado > 0) {
      // Asumir 5-15% de participacion segun demanda
      const participacion = demandaEstimada === 'alta' ? 0.15 :
        demandaEstimada === 'media' ? 0.10 : 0.05;
      return Math.round(volumenMercadoEstimado * participacion);
    }
    // Valores por defecto segun demanda
    return demandaEstimada === 'alta' ? 30 :
      demandaEstimada === 'media' ? 20 : 10;
  };

  // Calcular precio de venta inicial inteligente
  const calcularPrecioVentaInicial = () => {
    // Prioridad: precioEntrada > precioPERUMin * 0.95 > precioVentaSugerido
    if (precioEntrada && precioEntrada > 0) {
      return precioEntrada;
    }
    if (precioPERUMin > 0) {
      return Math.min(precioPERUMin * 0.95, precioVentaSugerido);
    }
    return precioVentaSugerido;
  };

  // Calcular unidades iniciales basadas en demanda (para primera compra conservadora)
  const calcularUnidadesIniciales = () => {
    const ventasEstimadas = calcularVentasEstimadas();
    // Primera compra: 2 meses de inventario estimado
    return Math.max(10, Math.ceil(ventasEstimadas * 2));
  };

  // Estados para inputs editables
  const [unidadesAComprar, setUnidadesAComprar] = useState(calcularUnidadesIniciales);
  const [ventasMensuales, setVentasMensuales] = useState(calcularVentasEstimadas);
  const [precioVenta, setPrecioVenta] = useState(calcularPrecioVentaInicial);
  const [hasUserModified, setHasUserModified] = useState(false);

  // Sincronizar valores cuando cambian los props (solo si el usuario no ha modificado)
  useEffect(() => {
    if (!hasUserModified) {
      setUnidadesAComprar(calcularUnidadesIniciales());
      setVentasMensuales(calcularVentasEstimadas());
      setPrecioVenta(calcularPrecioVentaInicial());
    }
  }, [ctruEstimado, precioVentaSugerido, precioPERUMin, demandaEstimada, volumenMercadoEstimado, precioEntrada]);

  // Resetear a valores calculados
  const handleReset = () => {
    setUnidadesAComprar(calcularUnidadesIniciales());
    setVentasMensuales(calcularVentasEstimadas());
    setPrecioVenta(calcularPrecioVentaInicial());
    setHasUserModified(false);
  };

  // Marcar como modificado por usuario
  const handleUserChange = (setter: (value: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasUserModified(true);
    setter(parseFloat(e.target.value) || 0);
  };

  // Calcular inversión basada en unidades a comprar × CTRU
  const inversionCalculada = useMemo(() => {
    return unidadesAComprar * ctruEstimado;
  }, [unidadesAComprar, ctruEstimado]);

  // Inversión en USD (si se proporciona el costo USD)
  const inversionUSD = useMemo(() => {
    return unidadesAComprar * costoTotalUSD;
  }, [unidadesAComprar, costoTotalUSD]);

  // Calcular punto de equilibrio
  const puntoEquilibrio = useMemo((): PuntoEquilibrio => {
    return ProductoService.calcularPuntoEquilibrio(
      ctruEstimado,
      precioVenta,
      inversionCalculada,
      ventasMensuales,
      unidadesAComprar // Pasar unidades compradas para cálculo correcto
    );
  }, [ctruEstimado, precioVenta, inversionCalculada, ventasMensuales, unidadesAComprar]);

  // Determinar estado de viabilidad (basado en tiempo de recuperación de capital)
  const getViabilidadStatus = () => {
    if (puntoEquilibrio.gananciaUnitaria <= 0) {
      return {
        status: 'danger',
        label: 'No viable',
        icon: AlertTriangle,
        color: 'text-red-600',
        bg: 'bg-red-50'
      };
    }
    if (puntoEquilibrio.tiempoRecuperacionCapital <= 2) {
      return {
        status: 'excellent',
        label: 'Excelente',
        icon: CheckCircle,
        color: 'text-green-600',
        bg: 'bg-green-50'
      };
    }
    if (puntoEquilibrio.tiempoRecuperacionCapital <= 4) {
      return {
        status: 'good',
        label: 'Bueno',
        icon: TrendingUp,
        color: 'text-blue-600',
        bg: 'bg-blue-50'
      };
    }
    if (puntoEquilibrio.tiempoRecuperacionCapital <= 6) {
      return {
        status: 'regular',
        label: 'Regular',
        icon: Info,
        color: 'text-yellow-600',
        bg: 'bg-yellow-50'
      };
    }
    return {
      status: 'poor',
      label: 'Riesgoso',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bg: 'bg-orange-50'
    };
  };

  const viabilidad = getViabilidadStatus();
  const ViabilidadIcon = viabilidad.icon;

  // Formatear números
  const formatMoney = (value: number, currency: 'USD' | 'PEN' = 'PEN') => {
    if (!isFinite(value)) return '∞';
    const prefix = currency === 'USD' ? '$' : 'S/';
    return `${prefix}${value.toFixed(2)}`;
  };

  const formatNumber = (value: number) => {
    if (!isFinite(value)) return '∞';
    return value.toLocaleString('es-PE');
  };

  return (
    <div className="space-y-4">
      {/* Header con estado de viabilidad */}
      <div className={`rounded-lg p-4 ${viabilidad.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${viabilidad.bg}`}>
              <ViabilidadIcon className={`h-6 w-6 ${viabilidad.color}`} />
            </div>
            <div>
              <h4 className={`font-semibold ${viabilidad.color}`}>{viabilidad.label}</h4>
              <p className="text-sm text-gray-600">
                {puntoEquilibrio.tiempoRecuperacionCapital === Infinity
                  ? 'Sin recuperación posible'
                  : `Recuperas capital en ${puntoEquilibrio.tiempoRecuperacionCapital} mes${puntoEquilibrio.tiempoRecuperacionCapital !== 1 ? 'es' : ''}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(puntoEquilibrio.unidadesParaRecuperarCapital)} / {unidadesAComprar}
            </p>
            <p className="text-xs text-gray-500">
              ventas para recuperar inversión
            </p>
          </div>
        </div>
      </div>

      {/* ROI y Ganancia Potencial */}
      {puntoEquilibrio.gananciaUnitaria > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
            <div className="flex items-center gap-2 text-xs text-emerald-600 mb-1">
              <TrendingUp className="h-3 w-3" />
              Ganancia Total Potencial
            </div>
            <p className="text-lg font-bold text-emerald-700">
              {formatMoney(puntoEquilibrio.gananciaTotalPotencial)}
            </p>
            <p className="text-xs text-emerald-600">
              si vendes las {unidadesAComprar} unidades
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
            <div className="flex items-center gap-2 text-xs text-purple-600 mb-1">
              <Target className="h-3 w-3" />
              ROI Total Potencial
            </div>
            <p className="text-lg font-bold text-purple-700">
              {puntoEquilibrio.roiTotalPotencial.toFixed(1)}%
            </p>
            <p className="text-xs text-purple-600">
              retorno sobre inversión
            </p>
          </div>
        </div>
      )}

      {/* Inputs editables */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {hasUserModified ? 'Valores personalizados' : 'Valores sugeridos por investigacion'}
          </span>
          {hasUserModified && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Restaurar sugeridos
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <ShoppingCart className="h-3 w-3 inline mr-1" />
              Unidades a Comprar
            </label>
            <input
              type="number"
              min="1"
              value={unidadesAComprar}
              onChange={handleUserChange((v) => setUnidadesAComprar(Math.max(1, Math.round(v))))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 mt-0.5">
              Sugerido: {calcularUnidadesIniciales()} (2 meses)
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <Package className="h-3 w-3 inline mr-1" />
              Ventas / Mes
            </label>
            <input
              type="number"
              value={ventasMensuales}
              onChange={handleUserChange((v) => setVentasMensuales(Math.max(0, Math.round(v))))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 mt-0.5">
              Demanda {demandaEstimada}: ~{calcularVentasEstimadas()}/mes
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <Target className="h-3 w-3 inline mr-1" />
              Precio Venta (PEN)
            </label>
            <input
              type="number"
              step="0.01"
              value={precioVenta}
              onChange={handleUserChange(setPrecioVenta)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 mt-0.5">
              {precioEntrada ? `Entrada: S/${precioEntrada.toFixed(2)}` :
               precioPERUMin > 0 ? `Min mercado: S/${precioPERUMin.toFixed(2)}` : 'Sin referencia'}
            </p>
          </div>
        </div>
      </div>

      {/* Inversión calculada */}
      <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-900">Inversión Total:</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-indigo-700">
              {formatMoney(inversionCalculada)}
            </p>
            {costoTotalUSD > 0 && (
              <p className="text-xs text-indigo-500">
                (${inversionUSD.toFixed(2)} USD)
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-indigo-600 mt-1">
          {unidadesAComprar} unidades × {formatMoney(ctruEstimado)} CTRU
        </p>
      </div>

      {/* Métricas detalladas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Calculator className="h-3 w-3" />
            CTRU (Costo/Unidad)
          </div>
          <p className="text-lg font-semibold text-gray-900">
            {formatMoney(ctruEstimado)}
          </p>
        </div>

        <div className={`rounded-lg p-3 ${
          puntoEquilibrio.gananciaUnitaria > 0 ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <TrendingUp className="h-3 w-3" />
            Ganancia por Unidad
          </div>
          <p className={`text-lg font-semibold ${
            puntoEquilibrio.gananciaUnitaria > 0 ? 'text-green-700' : 'text-red-700'
          }`}>
            {formatMoney(puntoEquilibrio.gananciaUnitaria)}
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Clock className="h-3 w-3" />
            Tiempo Recuperación Capital
          </div>
          <p className="text-lg font-semibold text-blue-700">
            {puntoEquilibrio.tiempoRecuperacionCapital === Infinity
              ? '∞'
              : `${puntoEquilibrio.tiempoRecuperacionCapital} meses`}
          </p>
          <p className="text-xs text-blue-500">
            ({formatNumber(puntoEquilibrio.unidadesParaRecuperarCapital)} ventas)
          </p>
        </div>

        <div className={`rounded-lg p-3 ${
          (puntoEquilibrio.rentabilidadMensual || 0) > 20 ? 'bg-green-50' :
          (puntoEquilibrio.rentabilidadMensual || 0) > 10 ? 'bg-blue-50' : 'bg-yellow-50'
        }`}>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <TrendingUp className="h-3 w-3" />
            Rentabilidad Mensual
          </div>
          <p className={`text-lg font-semibold ${
            (puntoEquilibrio.rentabilidadMensual || 0) > 20 ? 'text-green-700' :
            (puntoEquilibrio.rentabilidadMensual || 0) > 10 ? 'text-blue-700' : 'text-yellow-700'
          }`}>
            {puntoEquilibrio.rentabilidadMensual?.toFixed(1) || 0}%
          </p>
        </div>
      </div>

      {/* Proyección visual */}
      {puntoEquilibrio.gananciaUnitaria > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="text-sm font-medium text-gray-700 mb-3">Proyección de Recuperación</h5>

          <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
            {/* Marcadores de meses */}
            {[1, 2, 3, 4, 5, 6].map((mes) => (
              <div
                key={mes}
                className="absolute top-0 bottom-0 border-r border-gray-300"
                style={{ left: `${(mes / 6) * 100}%` }}
              >
                <span className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs text-gray-400">
                  M{mes}
                </span>
              </div>
            ))}

            {/* Barra de progreso hasta recuperación de capital */}
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
              style={{
                width: `${Math.min(100, (puntoEquilibrio.tiempoRecuperacionCapital / 6) * 100)}%`
              }}
            />

            {/* Marcador de recuperación de capital */}
            {puntoEquilibrio.tiempoRecuperacionCapital <= 6 && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-green-600"
                style={{ left: `${(puntoEquilibrio.tiempoRecuperacionCapital / 6) * 100}%` }}
              >
                <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                  <span className="text-xs font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                    Capital
                  </span>
                </div>
              </div>
            )}

            {/* Marcador de fin de inventario (cuando vendes todo) */}
            {(() => {
              const mesesParaVenderTodo = ventasMensuales > 0 ? unidadesAComprar / ventasMensuales : Infinity;
              if (mesesParaVenderTodo <= 6) {
                return (
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-purple-600"
                    style={{ left: `${(mesesParaVenderTodo / 6) * 100}%` }}
                  >
                    <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                      <span className="text-xs font-medium text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                        Todo vendido
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <div className="mt-8 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-gray-500">Unidad #{puntoEquilibrio.unidadesParaRecuperarCapital}</p>
              <p className="text-sm font-medium text-green-600">Recuperas capital</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Unidades #{puntoEquilibrio.unidadesParaRecuperarCapital + 1}-{unidadesAComprar}</p>
              <p className="text-sm font-medium text-emerald-600">¡Ganancia pura!</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Al vender todo</p>
              <p className="text-sm font-medium text-purple-600">+{formatMoney(puntoEquilibrio.gananciaTotalPotencial)}</p>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500 text-center">
            Proyección a 6 meses con {ventasMensuales} ventas/mes
          </div>
        </div>
      )}

      {/* Advertencia si no es viable */}
      {puntoEquilibrio.gananciaUnitaria <= 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <h5 className="font-medium text-red-800">Producto no viable</h5>
              <p className="text-sm text-red-700 mt-1">
                El precio de venta ({formatMoney(precioVenta)}) es menor o igual al costo
                ({formatMoney(ctruEstimado)}). Necesitas reducir costos o aumentar el precio.
              </p>
              <div className="mt-2 text-sm text-red-600">
                Precio mínimo rentable: <strong>{formatMoney(ctruEstimado * 1.15)}</strong>
                <span className="text-xs ml-1">(15% margen)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
