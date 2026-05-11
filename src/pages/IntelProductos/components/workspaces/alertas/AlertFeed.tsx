/**
 * AlertFeed · feed scrolleable de alertas · Workspace Alertas
 *
 * chk5.B10b (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-alertas.html · Sec 1`.
 *
 * Renderiza la lista de alertas filtradas usando AlertCard. Footer con
 * contador + política canon. Empty state interno cuando filtros producen
 * 0 resultados (distinto del empty workspace que se maneja en padre).
 */

import React from 'react';
import { SearchX } from 'lucide-react';
import { AlertCard } from './AlertCard';
import type { Alerta } from '../../../utils/costIntelligence';

interface AlertFeedProps {
  alertas: Alerta[];
  totalSinFiltros: number;
  vistasIds: Set<string>;
  onMarcarVista: (alertaId: string) => void;
  onAccionPrimaria?: (alerta: Alerta) => void;
  /** Texto mostrado en footer · default políticas canon */
  footerHint?: string;
}

export const AlertFeed: React.FC<AlertFeedProps> = ({
  alertas,
  totalSinFiltros,
  vistasIds,
  onMarcarVista,
  onAccionPrimaria,
  footerHint = 'Política canon: variance >10% = crítica · >5% = alta · >2% = media · ≤2% no se alerta',
}) => {
  if (alertas.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8">
        <div className="flex flex-col items-center text-center">
          <SearchX className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500 font-semibold mb-1">
            No hay alertas que coincidan con los filtros
          </p>
          <p className="text-[11px] text-slate-400">
            Probá quitar filtros o cambiar a "Vistas".
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2.5">
        {alertas.map((alerta) => (
          <AlertCard
            key={alerta.id}
            alerta={alerta}
            vista={vistasIds.has(alerta.id)}
            onMarcarVista={() => onMarcarVista(alerta.id)}
            onAccionPrimaria={
              alerta.accionPrimaria && onAccionPrimaria
                ? () => onAccionPrimaria(alerta)
                : undefined
            }
          />
        ))}
      </div>

      {/* Footer · counter + política */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 gap-2 flex-wrap">
        <div className="text-[10px] text-slate-500 tabular-nums">
          Mostrando {alertas.length} de {totalSinFiltros} alertas
          {alertas.length === totalSinFiltros ? ' · ordenadas por severidad ↓' : ' · filtros activos'}
        </div>
        <div className="text-[10px] text-slate-400">{footerHint}</div>
      </div>
    </>
  );
};
