/**
 * PuntoEquilibrioModal · Modal centrado · Tool #31 · F6(A)
 *
 * Mockup canónico: docs/mockups/productos/31-tool-punto-equilibrio.html
 *
 * Calculadora interactiva con sliders en tiempo real:
 *   - 3 inputs sliders: CTRU + Precio venta + Costos fijos
 *   - Hero con punto de equilibrio (uds) + sub-KPIs (margen contribución, ingresos, %)
 *   - Chart SVG ingresos vs costos totales (0-50 uds) con cruce visual
 *   - 3 escenarios: Pesimista · Base actual · Optimista
 *
 * Trigger: detalle producto botón "Calcular punto equilibrio" o módulo de pricing
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Calculator,
  Package,
  DollarSign,
  Building,
  Target,
  LineChart as LineChartIcon,
  RotateCcw,
  Download,
} from 'lucide-react';
import type { PuntoEquilibrioInput } from './types';

interface PuntoEquilibrioModalProps {
  open: boolean;
  input: PuntoEquilibrioInput | null;
  onClose: () => void;
  onGuardarEscenario?: (datos: {
    ctru: number;
    precioVenta: number;
    costosFijos: number;
    breakEven: number;
  }) => void;
}

function calcularBreakEven(ctru: number, precioVenta: number, costosFijos: number): number {
  const margenContribucion = precioVenta - ctru;
  if (margenContribucion <= 0) return Infinity;
  return Math.ceil(costosFijos / margenContribucion);
}

export function PuntoEquilibrioModal({
  open,
  input,
  onClose,
  onGuardarEscenario,
}: PuntoEquilibrioModalProps) {
  const [ctru, setCtru] = useState(0);
  const [precioVenta, setPrecioVenta] = useState(0);
  const [costosFijos, setCostosFijos] = useState(0);

  // Reset al abrir/cambiar producto
  useEffect(() => {
    if (input) {
      setCtru(input.ctruInicial);
      setPrecioVenta(input.precioVentaInicial);
      setCostosFijos(input.costosFijosInicial);
    }
  }, [input?.productoId, input?.ctruInicial, input?.precioVentaInicial, input?.costosFijosInicial]);

  // ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Cálculos
  const calc = useMemo(() => {
    const margenContrib = precioVenta - ctru;
    const breakEven = calcularBreakEven(ctru, precioVenta, costosFijos);
    const ingresosEnPE = breakEven * precioVenta;
    const margenPct = precioVenta > 0 ? (margenContrib / precioVenta) * 100 : 0;
    return { margenContrib, breakEven, ingresosEnPE, margenPct };
  }, [ctru, precioVenta, costosFijos]);

  // Escenarios
  const pesimista = useMemo(() => {
    const ctruP = ctru * 1.08;
    const precioP = precioVenta * 0.9;
    return calcularBreakEven(ctruP, precioP, costosFijos);
  }, [ctru, precioVenta, costosFijos]);

  const optimista = useMemo(() => {
    const ctruO = ctru * 0.97;
    const precioO = precioVenta * 1.05;
    return calcularBreakEven(ctruO, precioO, costosFijos);
  }, [ctru, precioVenta, costosFijos]);

  // Chart ingresos/costos (0-50 uds)
  const chart = useMemo(() => {
    const maxUds = 50;
    const ingresoMax = precioVenta * maxUds;
    const costoMax = costosFijos + ctru * maxUds;
    const yMaxRaw = Math.max(ingresoMax, costoMax, 1);
    // Redondeo amigable a 5K
    const yMax = Math.ceil(yMaxRaw / 5000) * 5000;

    // Coords (eje 40-580 X · 30-180 Y · invertido)
    const xStart = 40;
    const xEnd = 580;
    const yTop = 30;
    const yBottom = 180;

    const xFor = (uds: number) => xStart + ((xEnd - xStart) * uds) / maxUds;
    const yFor = (val: number) => yBottom - ((yBottom - yTop) * val) / yMax;

    // Costos: y0 = costosFijos · y50 = costosFijos + ctru*50
    const costoX0 = xStart;
    const costoY0 = yFor(costosFijos);
    const costoX50 = xEnd;
    const costoY50 = yFor(costosFijos + ctru * maxUds);

    // Ingresos: y0 = 0 · y50 = precio*50
    const ingresoX0 = xStart;
    const ingresoY0 = yFor(0);
    const ingresoX50 = xEnd;
    const ingresoY50 = yFor(precioVenta * maxUds);

    // PE point
    const peUds = isFinite(calc.breakEven) ? calc.breakEven : maxUds;
    const peVisible = peUds > 0 && peUds <= maxUds;
    const peX = xFor(Math.min(peUds, maxUds));
    const peY = yFor(peUds * precioVenta);

    // Y labels (4 niveles · top a bottom)
    const yLabels = [
      { y: 34, val: yMax },
      { y: 84, val: (yMax * 2) / 3 },
      { y: 134, val: yMax / 3 },
      { y: 184, val: 0 },
    ];

    return {
      yMax,
      yLabels,
      costoX0,
      costoY0,
      costoX50,
      costoY50,
      ingresoX0,
      ingresoY0,
      ingresoX50,
      ingresoY50,
      peX,
      peY,
      peVisible,
      peUds,
    };
  }, [ctru, precioVenta, costosFijos, calc.breakEven]);

  if (!open || !input) return null;

  const reset = () => {
    setCtru(input.ctruInicial);
    setPrecioVenta(input.precioVentaInicial);
    setCostosFijos(input.costosFijosInicial);
  };

  const breakEvenLabel = isFinite(calc.breakEven) ? `${calc.breakEven}` : '∞';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-4 lg:px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center flex-shrink-0">
                <Calculator className="w-6 h-6 text-teal-700" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500 flex items-center gap-2 mb-0.5">
                  <span className="font-mono">{input.productoSku}</span>
                  {input.productoMarca && (
                    <>
                      <span>·</span>
                      <span className="truncate">{input.productoMarca}</span>
                    </>
                  )}
                </div>
                <h2 className="text-base lg:text-lg font-bold text-slate-900 truncate">
                  Punto de equilibrio · {input.productoNombre}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                  Calcula cuántas unidades necesitas vender para recuperar la inversión
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* INPUTS */}
          <div className="space-y-4">
            <SliderRow
              icon={<Package className="w-3.5 h-3.5 text-slate-500" />}
              label="Costo unitario (CTRU)"
              value={ctru}
              min={Math.round(input.ctruInicial * 0.6)}
              max={Math.round(input.ctruInicial * 1.5)}
              onChange={setCtru}
              prefix="S/"
              valueColor="text-slate-900"
              fillColor="#14b8a6"
            />
            <SliderRow
              icon={<DollarSign className="w-3.5 h-3.5 text-emerald-500" />}
              label="Precio de venta"
              value={precioVenta}
              min={Math.round(input.precioVentaInicial * 0.6)}
              max={Math.round(input.precioVentaInicial * 1.4)}
              onChange={setPrecioVenta}
              prefix="S/"
              valueColor="text-emerald-700"
              fillColor="#10b981"
            />
            <SliderRow
              icon={<Building className="w-3.5 h-3.5 text-amber-500" />}
              label="Costos fijos del lote"
              value={costosFijos}
              min={Math.round(input.costosFijosInicial * 0.3)}
              max={Math.round(input.costosFijosInicial * 3)}
              onChange={setCostosFijos}
              prefix="S/"
              valueColor="text-amber-700"
              fillColor="#f59e0b"
              helpText="Incluye: marketing + comisiones + flete intl + gastos administrativos"
            />
          </div>

          {/* RESULTADO HERO */}
          <div className="rounded-xl border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-white p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-teal-200">
                <Target className="w-7 h-7 lg:w-8 lg:h-8" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-teal-700 font-bold">
                  Punto de equilibrio
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl lg:text-4xl font-bold text-slate-900 tabular-nums">
                    {breakEvenLabel}
                  </span>
                  <span className="text-base font-medium text-slate-700">unidades</span>
                </div>
                <p className="text-xs text-slate-700 mt-1">
                  {isFinite(calc.breakEven) ? (
                    <>
                      Necesitas vender{' '}
                      <strong className="text-teal-700">{calc.breakEven} uds</strong> a S/{' '}
                      {precioVenta.toFixed(0)} para cubrir CTRU + costos fijos. A partir de la{' '}
                      <strong>{calc.breakEven + 1}ª unidad</strong> empezás a generar utilidad real.
                    </>
                  ) : (
                    <>
                      <strong className="text-rose-700">Margen negativo</strong>: el precio de venta
                      no cubre el costo unitario. Subí el precio o bajá el CTRU para alcanzar
                      equilibrio.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Sub-KPIs */}
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-teal-200">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Margen contribución
                </div>
                <div
                  className={`text-base font-bold tabular-nums ${
                    calc.margenContrib >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  S/ {calc.margenContrib.toFixed(0)}/u
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Ingresos en PE
                </div>
                <div className="text-base font-bold text-slate-900 tabular-nums">
                  {isFinite(calc.ingresosEnPE)
                    ? `S/ ${calc.ingresosEnPE.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  % margen
                </div>
                <div
                  className={`text-base font-bold tabular-nums ${
                    calc.margenPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {calc.margenPct.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* CHART · proyección */}
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <LineChartIcon className="w-3.5 h-3.5" />
                Proyección utilidad / pérdida (0-50 uds)
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                  <span className="text-slate-600">Ingresos</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-rose-400" />
                  <span className="text-slate-600">Costos totales</span>
                </div>
              </div>
            </div>
            <svg viewBox="0 0 600 220" className="w-full h-44 lg:h-48">
              {/* Grid */}
              <g stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2,4">
                <line x1="40" y1="30" x2="580" y2="30" />
                <line x1="40" y1="80" x2="580" y2="80" />
                <line x1="40" y1="130" x2="580" y2="130" />
                <line x1="40" y1="180" x2="580" y2="180" />
              </g>
              {/* Eje Y labels */}
              <g fontFamily="ui-monospace, monospace" fontSize="9" fill="#94a3b8" textAnchor="end">
                {chart.yLabels.map((l) => (
                  <text key={l.y} x="35" y={l.y}>
                    {l.val >= 1000 ? `${(l.val / 1000).toFixed(0)}K` : l.val.toFixed(0)}
                  </text>
                ))}
              </g>
              {/* Eje X labels */}
              <g fontFamily="ui-monospace, monospace" fontSize="9" fill="#94a3b8" textAnchor="middle">
                {[0, 10, 20, 30, 40, 50].map((u, i) => (
                  <text key={u} x={40 + (540 / 5) * i} y="200">
                    {u}
                  </text>
                ))}
              </g>
              {/* Línea costos totales */}
              <line
                x1={chart.costoX0}
                y1={chart.costoY0}
                x2={chart.costoX50}
                y2={chart.costoY50}
                stroke="#f43f5e"
                strokeWidth="2.5"
              />
              {/* Línea ingresos */}
              <line
                x1={chart.ingresoX0}
                y1={chart.ingresoY0}
                x2={chart.ingresoX50}
                y2={chart.ingresoY50}
                stroke="#10b981"
                strokeWidth="2.5"
              />
              {/* Punto de equilibrio */}
              {chart.peVisible && (
                <>
                  <line
                    x1={chart.peX}
                    y1={30}
                    x2={chart.peX}
                    y2={180}
                    stroke="#14b8a6"
                    strokeWidth="1.5"
                    strokeDasharray="4,3"
                  />
                  <circle cx={chart.peX} cy={chart.peY} r="7" fill="#14b8a6" stroke="#fff" strokeWidth="3" />
                  <g>
                    <rect x={chart.peX + 8} y={chart.peY - 25} width="105" height="32" rx="6" fill="#0f172a" />
                    <text
                      x={chart.peX + 60}
                      y={chart.peY - 10}
                      fontFamily="ui-monospace, monospace"
                      fontSize="10"
                      fill="#fff"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      PE: {chart.peUds} uds
                    </text>
                    <text
                      x={chart.peX + 60}
                      y={chart.peY + 1}
                      fontFamily="ui-monospace, monospace"
                      fontSize="9"
                      fill="#86efac"
                      textAnchor="middle"
                    >
                      S/ {(chart.peUds * precioVenta).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                    </text>
                  </g>
                </>
              )}
            </svg>
          </div>

          {/* ESCENARIOS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <EscenarioCard
              variant="default"
              colorDot="bg-rose-500"
              titulo="Pesimista"
              tituloColor="text-slate-500"
              uds={pesimista}
              detalle="precio -10% · CTRU +8%"
              delta={
                isFinite(pesimista) && isFinite(calc.breakEven)
                  ? `+${pesimista - calc.breakEven} uds vs base`
                  : '—'
              }
              deltaColor="text-rose-600"
            />
            <EscenarioCard
              variant="active"
              colorDot="bg-teal-500"
              titulo="Base · actual"
              tituloColor="text-teal-700"
              uds={isFinite(calc.breakEven) ? calc.breakEven : null}
              detalle={`precio S/${precioVenta.toFixed(0)} · CTRU S/${ctru.toFixed(0)}`}
              detalleColor="text-teal-700"
              delta="Punto de partida"
              deltaColor="text-teal-700"
            />
            <EscenarioCard
              variant="default"
              colorDot="bg-emerald-500"
              titulo="Optimista"
              tituloColor="text-slate-500"
              uds={optimista}
              detalle="precio +5% · CTRU -3%"
              delta={
                isFinite(optimista) && isFinite(calc.breakEven)
                  ? `${optimista - calc.breakEven} uds vs base`
                  : '—'
              }
              deltaColor="text-emerald-600"
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <button
            onClick={reset}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 justify-center"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer valores
          </button>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cerrar
            </button>
            <button
              onClick={() =>
                onGuardarEscenario?.({
                  ctru,
                  precioVenta,
                  costosFijos,
                  breakEven: isFinite(calc.breakEven) ? calc.breakEven : 0,
                })
              }
              className="px-3 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Guardar como escenario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componente: SliderRow ──────────────────────────────────────────────
function SliderRow({
  icon,
  label,
  value,
  min,
  max,
  onChange,
  prefix,
  valueColor,
  fillColor,
  helpText,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  prefix: string;
  valueColor: string;
  fillColor: string;
  helpText?: string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const bg = `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          {icon}
          {label}
        </label>
        <div className={`text-base font-bold tabular-nums ${valueColor}`}>
          {prefix} {value.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-teal-500 [&::-webkit-slider-thumb]:border-2
                   [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md
                   [&::-webkit-slider-thumb]:cursor-pointer"
        style={{ background: bg }}
      />
      <div className="flex justify-between text-[10px] text-slate-400 mt-1 tabular-nums">
        <span>
          {prefix} {min.toLocaleString('es-PE')}
        </span>
        <span>
          {prefix} {value.toLocaleString('es-PE')}
        </span>
        <span>
          {prefix} {max.toLocaleString('es-PE')}
        </span>
      </div>
      {helpText && <div className="text-[10px] text-slate-500 mt-1">{helpText}</div>}
    </div>
  );
}

// ─── Sub-componente: EscenarioCard ──────────────────────────────────────────
function EscenarioCard({
  variant,
  colorDot,
  titulo,
  tituloColor,
  uds,
  detalle,
  detalleColor,
  delta,
  deltaColor,
}: {
  variant: 'default' | 'active';
  colorDot: string;
  titulo: string;
  tituloColor: string;
  uds: number | null;
  detalle: string;
  detalleColor?: string;
  delta: string;
  deltaColor: string;
}) {
  const cls =
    variant === 'active'
      ? 'rounded-lg border-2 border-teal-300 bg-teal-50 p-3'
      : 'rounded-lg border border-slate-200 bg-white p-3';
  return (
    <div className={cls}>
      <div className={`text-[10px] uppercase tracking-wider font-bold flex items-center gap-1 ${tituloColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${colorDot}`} />
        {titulo}
      </div>
      <div className={`text-base font-bold tabular-nums mt-1 ${variant === 'active' ? 'text-teal-900' : 'text-slate-900'}`}>
        {uds !== null && isFinite(uds) ? `${uds} uds` : '—'}
      </div>
      <div className={`text-[10px] ${detalleColor ?? 'text-slate-500'}`}>{detalle}</div>
      <div className={`text-[10px] font-bold mt-0.5 ${deltaColor}`}>{delta}</div>
    </div>
  );
}
