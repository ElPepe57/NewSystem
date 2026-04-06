import { MapPin, TrendingUp, DollarSign, Globe, BarChart3, Percent } from 'lucide-react';
import type { MapaCalorKPIData } from '../../types/mapaCalor.types';
import { formatCurrencyPEN } from '../../utils/format';

interface Props {
  kpis: MapaCalorKPIData;
}

export function MapaCalorKPIs({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <MapPin className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-[10px] sm:text-xs text-gray-500">Zonas Activas</span>
        </div>
        <p className="text-lg sm:text-xl font-bold text-gray-900">{kpis.zonasActivas}</p>
        <p className="text-[10px] text-gray-400">distritos</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Globe className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-[10px] sm:text-xs text-gray-500">Provincias</span>
        </div>
        <p className="text-lg sm:text-xl font-bold text-gray-900">{kpis.provinciasActivas}</p>
        <p className="text-[10px] text-gray-400">cobertura nacional</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <DollarSign className="h-3.5 w-3.5 text-green-500" />
          <span className="text-[10px] sm:text-xs text-gray-500">Volumen</span>
        </div>
        <p className="text-lg sm:text-xl font-bold text-green-600">
          S/ {kpis.volumenTotalPEN.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
        </p>
        <p className="text-[10px] text-gray-400">del periodo</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-[10px] sm:text-xs text-gray-500">Ticket Prom.</span>
        </div>
        <p className="text-lg sm:text-xl font-bold text-gray-900">
          S/ {kpis.ticketPromedio.toFixed(0)}
        </p>
        <p className="text-[10px] text-gray-400">por venta</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <BarChart3 className="h-3.5 w-3.5 text-purple-500" />
          <span className="text-[10px] sm:text-xs text-gray-500">Zona Top</span>
        </div>
        <p className="text-sm sm:text-base font-bold text-gray-900 truncate">
          {kpis.zonaTopVolumen?.distrito || '—'}
        </p>
        <p className="text-[10px] text-gray-400 truncate">
          {kpis.zonaTopVolumen ? `S/ ${kpis.zonaTopVolumen.volumen.toFixed(0)}` : 'sin datos'}
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Percent className="h-3.5 w-3.5 text-teal-500" />
          <span className="text-[10px] sm:text-xs text-gray-500">Cobertura</span>
        </div>
        <p className="text-lg sm:text-xl font-bold text-gray-900">{kpis.porcentajeCobertura}%</p>
        <p className="text-[10px] text-gray-400">{kpis.ventasGeolocalizadas}/{kpis.ventasTotales} ventas</p>
      </div>
    </div>
  );
}
