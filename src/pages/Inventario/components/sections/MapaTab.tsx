/**
 * MapaTab · placeholder del tab Mapa de Inventario
 *
 * En chk4.5 se reemplazará por el HeatmapLayer real (mockup
 * mapa-calor-inventario-s58f) que muestra la distribución de stock
 * por almacén / país / casilla con calor visual.
 *
 * Por ahora renderiza un empty state canónico con mensaje informativo.
 */

import React from 'react';
import { MapPin, Sparkles } from 'lucide-react';

export const MapaTab: React.FC = () => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-12">
      <div className="text-center max-w-md mx-auto">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-50 to-sky-50 mb-4">
          <MapPin className="w-8 h-8 text-teal-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          Mapa de almacén
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Visualización geográfica del inventario por almacén, casilla y país
          con mapa de calor de stock disponible.
        </p>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
          <Sparkles className="w-3 h-3" />
          Próximamente · S3.6 M1 chk4.5
        </div>
      </div>
    </div>
  );
};
