/**
 * ForecastWorkspace · workspace 5 · Cost Intelligence
 *
 * chk5.B10c (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-forecast.html`.
 *
 * Responde la pregunta: "¿Hacia dónde va mi negocio en los próximos 30/60/90 días?"
 *
 * Orquesta:
 *   - Banner metodología · transparencia WMA + confidence
 *   - ForecastCostosTable · top 10 SKUs por riesgo
 *   - ForecastGastosChart · stacked bars 6m hist + 3m futuro
 *   - WhatIfPanel · 3 sliders + 4 stats (bloqueado si confidence baja)
 *
 * 3 estados:
 *   - Empty · sin histórico suficiente (≥3 meses · ≥3 lotes principales)
 *   - Data parcial · low confidence · sólo 30d + what-if bloqueado
 *   - Data completa · 3 horizontes + what-if activo
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Info, Plus, ArrowRight } from 'lucide-react';
import type {
  EvolucionPorBloque,
  ForecastHorizon,
  ForecastResult,
  SkuConCostos,
} from '../../utils/costIntelligence';
import { calcularForecast } from '../../utils/costIntelligence';
import { ForecastCostosTable } from './forecast/ForecastCostosTable';
import { ForecastGastosChart } from './forecast/ForecastGastosChart';
import { WhatIfPanel } from './forecast/WhatIfPanel';

interface ForecastWorkspaceProps {
  skus: SkuConCostos[];
  evolucionGastos: EvolucionPorBloque;
  poolSnapshotsCount: number;
  capitalInvertidoPEN: number;
  capitalAtrapadoPEN: number;
  hasOperationalData: boolean;
}

export const ForecastWorkspace: React.FC<ForecastWorkspaceProps> = ({
  skus,
  evolucionGastos,
  poolSnapshotsCount,
  capitalInvertidoPEN,
  capitalAtrapadoPEN,
  hasOperationalData,
}) => {
  const [horizonte, setHorizonte] = useState<ForecastHorizon>('30d');

  const forecast: ForecastResult = React.useMemo(
    () => calcularForecast(skus, evolucionGastos, poolSnapshotsCount, 10),
    [skus, evolucionGastos, poolSnapshotsCount]
  );

  // Empty · sin data operacional global O sin lotes/gastos suficientes
  if (!hasOperationalData || !forecast.hasData) {
    return <EmptyForecast prerequisitos={forecast.prerequisitos} />;
  }

  const permitirLargos = forecast.whatIfHabilitado; // baja confidence = sólo 30d
  // Si el usuario tenía 60d/90d seleccionado y baja confidence forzó sólo 30d,
  // reajustamos visualmente.
  const horizonteEfectivo: ForecastHorizon = permitirLargos ? horizonte : '30d';

  return (
    <div className="space-y-4">
      {/* Banner metodología · siempre visible */}
      <div className="bg-sky-50/50 border border-sky-200 rounded-lg p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-sky-700 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-[11px] text-sky-800">
          <span className="font-bold">Metodología:</span> Forecast usa Weighted Moving Average (WMA)
          sobre serie de lotes/meses. Confidence score por SKU se basa en cantidad de puntos
          históricos · ≥6 lotes = alta · 3-5 = media · &lt;3 = baja. Las proyecciones NO consideran
          shocks externos, estacionalidad fina ni cambios estructurales.
        </div>
      </div>

      {/* Warning si confidence general es baja */}
      {!permitirLargos && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-[11px] text-amber-800">
            <span className="font-bold">Confidence general: BAJA.</span> Las proyecciones a 60d y 90d
            tienen alta varianza esperada. Para forecast más confiable se recomienda &gt;3 meses
            de operación con ≥3 lotes por SKU principal. Esta vista se muestra parcial · panel
            What-if deshabilitado.
          </div>
        </div>
      )}

      {/* Panel 1 · Forecast costos catálogo */}
      {forecast.skusForecast.length > 0 ? (
        <ForecastCostosTable
          skus={forecast.skusForecast}
          horizonte={horizonteEfectivo}
          onCambiarHorizonte={setHorizonte}
          permitirHorizontesLargos={permitirLargos}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-xs text-slate-500">
            Sin SKUs con lotes para proyectar · necesita ≥1 SKU con histórico
          </p>
        </div>
      )}

      {/* Panel 2 + 3 · gastos chart + what-if · responsive 2 cols desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ForecastGastosChart data={forecast.gastos} />
        <WhatIfPanel
          habilitado={forecast.whatIfHabilitado}
          baseline={{
            capitalInvertidoPEN,
            capitalAtrapadoPEN,
          }}
        />
      </div>
    </div>
  );
};

// ─── Empty Forecast · sin histórico suficiente ───────────────────────────────
interface EmptyForecastProps {
  prerequisitos: ForecastResult['prerequisitos'];
}

const EmptyForecast: React.FC<EmptyForecastProps> = ({ prerequisitos }) => {
  const items = [
    {
      cumplido: prerequisitos.mesesOperacion >= 3,
      titulo: '≥3 meses de operación',
      detalle: `baseline mínimo para WMA · ideal 6m · actual: ${prerequisitos.mesesOperacion}`,
    },
    {
      cumplido: prerequisitos.skusConTresLotes >= 1,
      titulo: '≥1 SKU con ≥3 lotes',
      detalle: `activa proyección catálogo · ideal ≥6 · actual: ${prerequisitos.skusConTresLotes}`,
    },
    {
      cumplido: prerequisitos.mesesGastosClasificados >= 6,
      titulo: 'Gastos clasificados ≥6m',
      detalle: `activa proyección gastos · actual: ${prerequisitos.mesesGastosClasificados}`,
    },
    {
      cumplido: prerequisitos.snapshotsPool >= 3,
      titulo: 'Snapshots Pool USD ≥3',
      detalle: `activa proyección TCPA + what-if · actual: ${prerequisitos.snapshotsPool}`,
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-12">
      <div className="max-w-lg mx-auto text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 ring-1 ring-teal-200/50 flex items-center justify-center mx-auto mb-4">
          <LineChart className="w-10 h-10 text-teal-700" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">
          Sin histórico suficiente para forecast
        </h2>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-md mx-auto">
          Forecast proyecta costos, gastos y simula escenarios. Requiere histórico operacional
          real · no inventamos data ni hacemos proyecciones sobre baseline insuficiente.
        </p>

        <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Info className="w-3 h-3" />
            Para activar Forecast necesitas:
          </div>
          <ul className="space-y-2">
            {items.map((item, idx) => (
              <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                <span
                  className={`font-bold mt-0.5 ${
                    item.cumplido ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {item.cumplido ? '✓' : idx + 1 + '.'}
                </span>
                <span className={item.cumplido ? 'line-through text-slate-400' : ''}>
                  <span className="font-semibold">{item.titulo}</span>{' '}
                  ({item.detalle})
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Link
            to="/compras"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Crear primera OC
          </Link>
          <Link
            to="/intel-productos"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Ver Catálogo
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="mt-6 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-500 text-left">
          <span className="font-bold">Filosofía:</span> Forecast NO inventa data ni proyecta sobre
          1 punto. Preferimos no mostrar nada antes que dar una proyección engañosamente segura.
        </div>
      </div>
    </div>
  );
};
