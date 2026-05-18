/**
 * G2WorkingCapitalCycle — chk5.D-S3.quinto · SF3
 *
 * Working Capital Cycle canon MOCK 4 §5.
 * Pixel-perfect timeline horizontal con 3 barras (DSO · DIO · DPO) y CCC final.
 *
 * Resumen card amber arriba con CCC + benchmark.
 * Box indigo abajo con lectura interpretativa.
 */

import React from 'react';
import { Lightbulb } from 'lucide-react';
import type { WorkingCapitalCycle } from './analisisHelpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface G2WorkingCapitalCycleProps {
  data: WorkingCapitalCycle;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const G2WorkingCapitalCycle: React.FC<G2WorkingCapitalCycleProps> = ({ data }) => {
  // Escala: max para visualizar las barras · usar DIO típicamente como el más alto
  const maxDias = Math.max(data.dso, data.dio, data.dpo, 90);
  const pctDSO = (data.dso / maxDias) * 100;
  const pctDIO = (data.dio / maxDias) * 100;
  const pctDPO = (data.dpo / maxDias) * 100;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-purple-700">
          § G2 · Working Capital Cycle · DSO + DIO − DPO
        </span>
        <div className="flex-1 h-px bg-purple-200" />
      </div>
      <p className="text-[12px] text-slate-500 max-w-2xl">
        ¿En cuántos días convertís cada sol vendido en caja real? · Timeline horizontal con 3
        componentes.
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        {/* Resumen final */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-xl p-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-amber-700">
              Cash Conversion Cycle
            </div>
            <div className="text-3xl font-bold tabular-nums text-amber-900">{data.ccc} días</div>
            <div className="text-[10px] text-amber-700">
              {data.dso} (DSO) + {data.dio} (DIO) − {data.dpo} (DPO) = {data.ccc}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-amber-700">Benchmark sector</div>
            <div className="text-sm font-bold tabular-nums text-amber-900">
              {data.benchmarkMin}-{data.benchmarkMax} días
            </div>
            <div
              className={`text-[10px] font-bold ${
                data.dentroRango ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {data.dentroRango ? '✓ Dentro de rango' : '✗ Fuera de rango'}
            </div>
          </div>
        </div>

        {/* Timeline 3 componentes */}
        <div className="space-y-3">
          <ComponenteRow
            color="emerald"
            label="DSO · Days Sales Outstanding · cuánto tardás en cobrar"
            dias={data.dso}
            pct={pctDSO}
          />
          <ComponenteRow
            color="blue"
            label="DIO · Days Inventory Outstanding · cuánto tarda el stock en venderse"
            dias={data.dio}
            pct={pctDIO}
          />
          <ComponenteRow
            color="rose"
            label="DPO · Days Payable Outstanding · cuánto tardás en pagar proveedores"
            dias={-data.dpo}
            pct={pctDPO}
          />
        </div>

        {/* Lectura interpretativa */}
        <div className="bg-indigo-50 ring-1 ring-indigo-200 rounded-lg p-2.5 mt-3 text-[10px] text-indigo-900 flex items-start gap-2">
          <Lightbulb className="w-3 h-3 text-indigo-700 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Lectura:</strong>{' '}
            {generarLecturaWCC(data)}
          </span>
        </div>
      </div>
    </section>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═════════════════════════════════════════════════════════════════════════

interface ComponenteRowProps {
  color: 'emerald' | 'blue' | 'rose';
  label: string;
  dias: number; // negativo si es resta (DPO)
  pct: number;
}

const ROW_LABEL: Record<ComponenteRowProps['color'], string> = {
  emerald: 'text-emerald-700',
  blue: 'text-blue-700',
  rose: 'text-rose-700',
};
const ROW_VALUE: Record<ComponenteRowProps['color'], string> = {
  emerald: 'text-emerald-900',
  blue: 'text-blue-900',
  rose: 'text-rose-900',
};
const ROW_BAR: Record<ComponenteRowProps['color'], string> = {
  emerald: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
  blue: 'bg-gradient-to-r from-blue-400 to-blue-600',
  rose: 'bg-gradient-to-r from-rose-400 to-rose-600',
};

const ComponenteRow: React.FC<ComponenteRowProps> = ({ color, label, dias, pct }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <span className={`text-[10px] font-bold ${ROW_LABEL[color]}`}>{label}</span>
      <span className={`text-[11px] font-bold tabular-nums ${ROW_VALUE[color]}`}>
        {dias >= 0 ? '+' : '−'}
        {Math.abs(dias)} días
      </span>
    </div>
    <div className="h-7 bg-slate-100 rounded-lg overflow-hidden relative">
      <div
        className={`h-full rounded-l-lg ${ROW_BAR[color]}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function generarLecturaWCC(d: WorkingCapitalCycle): string {
  const partes: string[] = [];

  if (d.dso < 30) {
    partes.push(`Cobrás en ${d.dso}d (rápido · cliente cash)`);
  } else if (d.dso < 60) {
    partes.push(`Cobrás en ${d.dso}d (medio · normal B2C)`);
  } else {
    partes.push(`Cobrás en ${d.dso}d (lento · revisar cobranza)`);
  }

  if (d.dio > 60) {
    partes.push(`el stock tarda ${d.dio}d en rotar (alto · típico skincare)`);
  } else {
    partes.push(`el stock tarda ${d.dio}d en rotar (bueno)`);
  }

  if (d.dpo > 30) {
    partes.push(`DPO de ${d.dpo}d ayuda a fondear el ciclo`);
  } else {
    partes.push(`DPO de ${d.dpo}d corto · pagás muy rápido a proveedores`);
  }

  // Sugerencia de mejora · mayor lever
  let mayorLever = 'DSO';
  let mayorDias = d.dso;
  if (d.dio > mayorDias) {
    mayorLever = 'DIO';
    mayorDias = d.dio;
  }
  partes.push(`Mejorar ${mayorLever} sería el mayor lever para bajar CCC.`);

  return partes.join('. ') + '.';
}
