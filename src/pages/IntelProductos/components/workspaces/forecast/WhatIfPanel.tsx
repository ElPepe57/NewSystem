/**
 * WhatIfPanel · simulación interactiva · Workspace Forecast
 *
 * chk5.B10c (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-forecast.html · Sec 1 · Panel 3`.
 *
 * 3 sliders MVP:
 *   - TC variación (-15 a +15)
 *   - Precio proveedor USD (-20 a +20)
 *   - Volumen ventas (-30 a +30)
 *
 * Output · 4 mini stats con impacto agregado:
 *   - Δ margen pp
 *   - Δ capital atrapado PEN
 *   - Δ ingreso esperado PEN
 *   - Δ utilidad neta proyectada
 *
 * Bloqueado con candado cuando confidence general es baja.
 */

import React, { useMemo, useState } from 'react';
import { Sliders, DollarSign, Package, ShoppingBag, Lock } from 'lucide-react';
import type { WhatIfInputs } from '../../../utils/costIntelligence';
import { calcularWhatIf } from '../../../utils/costIntelligence';

interface WhatIfPanelProps {
  habilitado: boolean;
  baseline: {
    capitalInvertidoPEN: number;
    capitalAtrapadoPEN: number;
    margenBaselinePct?: number;
  };
}

const fmtPEN0 = (n: number) => {
  const sign = n >= 0 ? '+' : '-';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}S/ ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}S/ ${Math.round(abs / 1_000)}k`;
  return `${sign}S/ ${Math.round(abs).toLocaleString('es-PE')}`;
};
const fmtPct = (n: number, decimals = 1) =>
  `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;

const sliderColorClass = (value: number, neutralColor: string, positiveColor: string, negativeColor: string): string => {
  if (value > 0) return positiveColor;
  if (value < 0) return negativeColor;
  return neutralColor;
};

export const WhatIfPanel: React.FC<WhatIfPanelProps> = ({ habilitado, baseline }) => {
  const [inputs, setInputs] = useState<WhatIfInputs>({
    deltaTcPct: 0,
    deltaProveedorPct: 0,
    deltaVolumenPct: 0,
  });

  const output = useMemo(() => calcularWhatIf(inputs, baseline), [inputs, baseline]);

  if (!habilitado) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 opacity-60">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-slate-400" />
          <div className="text-sm font-bold text-slate-500">What-if scenarios · bloqueado</div>
        </div>
        <div className="text-[11px] text-slate-500">
          Las simulaciones requieren confidence general ≥ media. Volvé cuando tengas más
          histórico (≥3 meses · ≥3 lotes por SKU principal).
        </div>
      </div>
    );
  }

  const updateInput = (key: keyof WhatIfInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-slate-900">What-if scenarios · simulación</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Ajustá variables · impacto agregado en tiempo real
          </div>
        </div>
        <Sliders className="w-4 h-4 text-slate-400" />
      </div>

      {/* Sliders */}
      <div className="space-y-3">
        <SliderRow
          icon={DollarSign}
          iconColor="text-sky-700"
          label="TC variación"
          min={-15}
          max={15}
          value={inputs.deltaTcPct}
          onChange={(v) => updateInput('deltaTcPct', v)}
          valueClassName={sliderColorClass(inputs.deltaTcPct, 'text-slate-500', 'text-rose-600', 'text-emerald-600')}
        />
        <SliderRow
          icon={Package}
          iconColor="text-indigo-700"
          label="Precio proveedor (USD)"
          min={-20}
          max={20}
          value={inputs.deltaProveedorPct}
          onChange={(v) => updateInput('deltaProveedorPct', v)}
          valueClassName={sliderColorClass(inputs.deltaProveedorPct, 'text-slate-500', 'text-amber-600', 'text-emerald-600')}
        />
        <SliderRow
          icon={ShoppingBag}
          iconColor="text-emerald-700"
          label="Volumen ventas"
          min={-30}
          max={30}
          value={inputs.deltaVolumenPct}
          onChange={(v) => updateInput('deltaVolumenPct', v)}
          valueClassName={sliderColorClass(inputs.deltaVolumenPct, 'text-slate-500', 'text-emerald-600', 'text-rose-600')}
        />
      </div>

      {/* Output · 4 mini stats */}
      <div className="border-t border-slate-100 mt-4 pt-3 space-y-2">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Impacto estimado</div>
        <div className="grid grid-cols-2 gap-2">
          {/* Margen */}
          <StatCard
            label="Margen agregado"
            value={`${output.deltaMargenPp >= 0 ? '+' : ''}${output.deltaMargenPp.toFixed(1)}pp`}
            sub={`${output.margenBaselinePct.toFixed(0)}% → ${output.margenProyectadoPct.toFixed(1)}%`}
            colorClass={output.deltaMargenPp < 0 ? 'rose' : 'emerald'}
          />
          {/* Capital atrapado */}
          <StatCard
            label="Capital atrapado"
            value={fmtPEN0(output.deltaCapitalAtrapadoPEN)}
            sub={fmtPct(output.deltaCapitalAtrapadoPct)}
            colorClass={output.deltaCapitalAtrapadoPEN > 0 ? 'rose' : 'emerald'}
          />
          {/* Ingreso esperado */}
          <StatCard
            label="Ingreso esperado"
            value={fmtPEN0(output.deltaIngresoPEN)}
            sub={fmtPct(inputs.deltaVolumenPct)}
            colorClass={output.deltaIngresoPEN > 0 ? 'emerald' : output.deltaIngresoPEN < 0 ? 'rose' : 'slate'}
          />
          {/* Utilidad neta */}
          <StatCard
            label="Utilidad neta proy."
            value={fmtPEN0(output.deltaUtilidadNetaPEN)}
            sub={fmtPct(output.deltaUtilidadNetaPct)}
            colorClass={output.deltaUtilidadNetaPEN > 0 ? 'emerald' : output.deltaUtilidadNetaPEN < 0 ? 'rose' : 'amber'}
          />
        </div>
      </div>

      <div className="text-[10px] text-slate-400 mt-3 italic">
        Cálculo lineal sobre baseline actual · no considera elasticidad ni efectos no-lineales
      </div>
    </div>
  );
};

// ─── Slider Row ───────────────────────────────────────────────────────────────
interface SliderRowProps {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  valueClassName: string;
}

const SliderRow: React.FC<SliderRowProps> = ({ icon: Icon, iconColor, label, min, max, value, onChange, valueClassName }) => (
  <div>
    <div className="flex items-center justify-between text-[11px] mb-1">
      <span className="font-semibold text-slate-700 flex items-center gap-1">
        <Icon className={`w-3 h-3 ${iconColor}`} />
        {label}
      </span>
      <span className={`font-bold tabular-nums ${valueClassName}`}>
        {value >= 0 ? '+' : ''}{value.toFixed(1)}%
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step="0.5"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-teal-600"
    />
    <div className="flex justify-between text-[9px] text-slate-400 tabular-nums mt-0.5">
      <span>{min}%</span>
      <span>0</span>
      <span>+{max}%</span>
    </div>
  </div>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  colorClass: 'rose' | 'emerald' | 'amber' | 'slate';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, colorClass }) => {
  const variants: Record<typeof colorClass, { bg: string; border: string; text: string; subText: string }> = {
    rose:    { bg: 'bg-rose-50/50',    border: 'border-rose-200',    text: 'text-rose-700',    subText: 'text-rose-600' },
    emerald: { bg: 'bg-emerald-50/50', border: 'border-emerald-200', text: 'text-emerald-700', subText: 'text-emerald-600' },
    amber:   { bg: 'bg-amber-50/50',   border: 'border-amber-200',   text: 'text-amber-700',   subText: 'text-amber-600' },
    slate:   { bg: 'bg-slate-50',      border: 'border-slate-200',   text: 'text-slate-600',   subText: 'text-slate-500' },
  };
  const v = variants[colorClass];
  return (
    <div className={`${v.bg} border ${v.border} rounded p-2`}>
      <div className={`text-[9px] font-bold uppercase ${v.text}`}>{label}</div>
      <div className={`text-base font-bold tabular-nums mt-0.5 ${v.text}`}>{value}</div>
      <div className={`text-[9px] ${v.subText}`}>{sub}</div>
    </div>
  );
};
