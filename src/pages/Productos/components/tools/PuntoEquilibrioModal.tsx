/**
 * PuntoEquilibrioModal · Modal centrado · Tool #31 · F6(A)
 *
 * Mockup canónico: docs/mockups/productos/31-tool-punto-equilibrio.html
 *
 * Calculadora interactiva con sliders en tiempo real (Fase H+ refactor):
 *   - CTRU = costo unitario de investigación (prov × (1+tax%) + flete) × TC
 *   - Precio venta = precio efectivo (manual O sugerido MIN comp × 0.95)
 *   - Unidades a comprar = slider editable (cuántas piensas importar)
 *   - Inversión inicial = uds × CTRU (derivado · no editable directo)
 *
 * Hero: cuántas uds vender para recuperar la inversión total del lote.
 * Sin "costos fijos del lote" especulativos · solo data observable.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Calculator,
  Package,
  DollarSign,
  Layers,
  Target,
  LineChart as LineChartIcon,
  RotateCcw,
  Download,
  AlertTriangle,
} from 'lucide-react';
import type { PuntoEquilibrioInput } from './types';

interface PuntoEquilibrioModalProps {
  open: boolean;
  input: PuntoEquilibrioInput | null;
  onClose: () => void;
  onGuardarEscenario?: (datos: {
    ctru: number;
    precioVenta: number;
    unidadesCompradas: number;
    breakEven: number;
  }) => void;
}

/**
 * Dos definiciones de "punto de equilibrio" · ambas válidas:
 *
 * 1. RECUPERO DE CAJA (más intuitivo)
 *    breakEvenCaja = ceil(inversion / precioVenta)
 *    "Cuántas uds vender para que mis ingresos cubran lo que invertí"
 *    Ejemplo: inv S/560, precio S/130 → 560/130 = 4.3 → 5 uds
 *
 * 2. EQUILIBRIO DE UTILIDAD (más estricto contablemente)
 *    breakEvenUtilidad = ceil(inversion / margenContribución)
 *    "Cuántas uds vender para que mi GANANCIA acumulada iguale la inversión"
 *    Considera capital atrapado en stock no vendido.
 *    Ejemplo: inv S/560, margen S/74 → 560/74 = 7.6 → 8 uds
 */
function calcularBreakEvenCaja(precioVenta: number, unidadesCompradas: number, ctru: number): number {
  if (precioVenta <= 0) return Infinity;
  const inversion = unidadesCompradas * ctru;
  return Math.ceil(inversion / precioVenta);
}

function calcularBreakEvenUtilidad(ctru: number, precioVenta: number, unidadesCompradas: number): number {
  const margenContribucion = precioVenta - ctru;
  if (margenContribucion <= 0) return Infinity;
  const inversion = unidadesCompradas * ctru;
  return Math.ceil(inversion / margenContribucion);
}

export function PuntoEquilibrioModal({
  open,
  input,
  onClose,
  onGuardarEscenario,
}: PuntoEquilibrioModalProps) {
  const [ctru, setCtru] = useState(0);
  const [precioVenta, setPrecioVenta] = useState(0);
  const [unidadesCompradas, setUnidadesCompradas] = useState(30);

  // Reset al abrir/cambiar producto
  useEffect(() => {
    if (input) {
      setCtru(input.ctruInicial);
      setPrecioVenta(input.precioVentaInicial);
      setUnidadesCompradas(input.unidadesCompradasInicial);
    }
  }, [input?.productoId, input?.ctruInicial, input?.precioVentaInicial, input?.unidadesCompradasInicial]);

  // ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Cálculos · ambas definiciones de break-even
  const calc = useMemo(() => {
    const margenContrib = precioVenta - ctru;
    const inversionTotal = unidadesCompradas * ctru;
    const breakEvenCaja = calcularBreakEvenCaja(precioVenta, unidadesCompradas, ctru);
    const breakEvenUtilidad = calcularBreakEvenUtilidad(ctru, precioVenta, unidadesCompradas);
    const ingresosEnPE = breakEvenCaja * precioVenta;
    const margenPct = precioVenta > 0 ? (margenContrib / precioVenta) * 100 : 0;
    // Si break-even utilidad <= unidades compradas, vendiendo TODO el lote queda utilidad neta
    const utilidadVendiendoTodo = unidadesCompradas * margenContrib;
    return {
      margenContrib,
      breakEvenCaja,        // recupero de caja · KPI principal
      breakEvenUtilidad,    // equilibrio contable · sub-KPI
      ingresosEnPE,
      margenPct,
      inversionTotal,
      utilidadVendiendoTodo,
    };
  }, [ctru, precioVenta, unidadesCompradas]);

  // Escenarios usan break-even de CAJA (consistente con el KPI principal)
  const pesimista = useMemo(() => {
    const ctruP = ctru * 1.08;
    const precioP = precioVenta * 0.9;
    return calcularBreakEvenCaja(precioP, unidadesCompradas, ctruP);
  }, [ctru, precioVenta, unidadesCompradas]);

  const optimista = useMemo(() => {
    const ctruO = ctru * 0.97;
    const precioO = precioVenta * 1.05;
    return calcularBreakEvenCaja(precioO, unidadesCompradas, ctruO);
  }, [ctru, precioVenta, unidadesCompradas]);

  // Chart ingresos/costos (0 hasta unidadesCompradas + buffer)
  const chart = useMemo(() => {
    const maxUds = Math.max(50, Math.ceil(unidadesCompradas * 1.5));
    const ingresoMax = precioVenta * maxUds;
    const costoMax = ctru * maxUds;
    const yMaxRaw = Math.max(ingresoMax, costoMax, 1);
    const yMax = Math.ceil(yMaxRaw / 1000) * 1000;

    const xStart = 40;
    const xEnd = 580;
    const yTop = 30;
    const yBottom = 180;

    const xFor = (uds: number) => xStart + ((xEnd - xStart) * uds) / maxUds;
    const yFor = (val: number) => yBottom - ((yBottom - yTop) * val) / yMax;

    // Costos VARIABLES: y0 = 0 · y_max = ctru*maxUds (sin fijos · sale del origen)
    const costoX0 = xStart;
    const costoY0 = yFor(0);
    const costoX50 = xEnd;
    const costoY50 = yFor(ctru * maxUds);

    // Ingresos: y0 = 0 · y50 = precio*50
    const ingresoX0 = xStart;
    const ingresoY0 = yFor(0);
    const ingresoX50 = xEnd;
    const ingresoY50 = yFor(precioVenta * maxUds);

    // PE point
    const peUds = isFinite(calc.breakEvenCaja) ? calc.breakEvenCaja : maxUds;
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
      maxUds,
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
  }, [ctru, precioVenta, unidadesCompradas, calc.breakEvenCaja]);

  if (!open || !input) return null;

  // Empty state · sin datos de investigación · no podemos calcular nada
  const sinDatos = ctru <= 0 || precioVenta <= 0;

  const reset = () => {
    setCtru(input.ctruInicial);
    setPrecioVenta(input.precioVentaInicial);
    setUnidadesCompradas(input.unidadesCompradasInicial);
  };

  const breakEvenLabel = isFinite(calc.breakEvenCaja) ? `${calc.breakEvenCaja}` : '∞';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center flex-shrink-0">
                <Calculator className="w-5 h-5 text-teal-700" />
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sinDatos && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-[11px] text-amber-900">
                <strong>Sin datos de investigación.</strong> Para calcular el punto de equilibrio
                necesitás al menos un proveedor (para el costo) y un competidor (para el precio
                sugerido) en la pestaña Investigación. Los sliders se desbloquearán automáticamente.
              </div>
            </div>
          )}

          {/* INPUTS · 3 sliders alineados con datos de investigación */}
          <div className="space-y-4">
            <SliderRow
              icon={<Package className="w-3.5 h-3.5 text-slate-500" />}
              label="Costo unitario (CTRU)"
              value={ctru}
              min={ctru > 0 ? Math.max(1, Math.round(ctru * 0.5)) : 0}
              max={ctru > 0 ? Math.round(ctru * 2) : 100}
              onChange={setCtru}
              prefix="S/"
              valueColor="text-slate-900"
              fillColor="#14b8a6"
              helpText="(prov × (1+tax%) + flete) × TC · viene de la investigación"
            />
            <SliderRow
              icon={<DollarSign className="w-3.5 h-3.5 text-emerald-500" />}
              label="Precio de venta"
              value={precioVenta}
              min={precioVenta > 0 ? Math.max(1, Math.round(precioVenta * 0.5)) : 0}
              max={precioVenta > 0 ? Math.round(precioVenta * 1.5) : 100}
              onChange={setPrecioVenta}
              prefix="S/"
              valueColor="text-emerald-700"
              fillColor="#10b981"
              helpText="Manual confirmado o sugerido (MIN competidores × 0.95)"
            />
            <SliderRow
              icon={<Layers className="w-3.5 h-3.5 text-indigo-500" />}
              label="Unidades a comprar"
              value={unidadesCompradas}
              min={1}
              max={100}
              step={1}
              onChange={setUnidadesCompradas}
              prefix=""
              suffix="uds"
              valueColor="text-indigo-700"
              fillColor="#6366f1"
              allowEditOver={true}
              helpText={`Inversión total: S/ ${(unidadesCompradas * ctru).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`}
            />
          </div>

          {/* RESULTADO HERO */}
          <div className="rounded-xl border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-white p-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-teal-200">
                <Target className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-teal-700 font-bold">
                  Recupero de caja
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl lg:text-4xl font-bold text-slate-900 tabular-nums">
                    {breakEvenLabel}
                  </span>
                  <span className="text-base font-medium text-slate-700">unidades</span>
                </div>
                <p className="text-xs text-slate-700 mt-1">
                  {isFinite(calc.breakEvenCaja) ? (
                    calc.breakEvenCaja <= unidadesCompradas ? (
                      <>
                        Vendiendo{' '}
                        <strong className="text-teal-700">{calc.breakEvenCaja} uds</strong> a S/{' '}
                        {precioVenta.toFixed(0)} ya recuperás los{' '}
                        <strong>S/ {calc.inversionTotal.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</strong>{' '}
                        invertidos. Vendiendo TODO el lote ({unidadesCompradas} uds) ganás{' '}
                        <strong className="text-emerald-700">
                          S/ {calc.utilidadVendiendoTodo.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                        </strong> de utilidad neta.
                      </>
                    ) : (
                      <>
                        <strong className="text-amber-700">No alcanza con el lote actual.</strong>{' '}
                        Necesitarías vender {calc.breakEvenCaja} uds para que los ingresos cubran la
                        inversión, pero solo comprás {unidadesCompradas}. Aumentá las uds, sube precio o bajá CTRU.
                      </>
                    )
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

            {/* Sub-KPIs · 4 columnas con Equilibrio de Utilidad como concepto contable adicional */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-teal-200">
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider text-amber-700 font-bold cursor-help"
                  title="Cuántas uds vender para que la GANANCIA acumulada iguale la inversión. Concepto contable estricto: considera las unidades sin vender como capital atrapado."
                >
                  Equilibrio utilidad
                </div>
                <div className="text-base font-bold text-amber-700 tabular-nums">
                  {isFinite(calc.breakEvenUtilidad) ? `${calc.breakEvenUtilidad} uds` : '∞'}
                </div>
                <div className="text-[9px] text-slate-500">contable</div>
              </div>
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
                <div className="text-[9px] text-slate-500">precio − CTRU</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Ingresos en PE caja
                </div>
                <div className="text-base font-bold text-slate-900 tabular-nums">
                  {isFinite(calc.ingresosEnPE)
                    ? `S/ ${calc.ingresosEnPE.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`
                    : '—'}
                </div>
                <div className="text-[9px] text-slate-500">{isFinite(calc.breakEvenCaja) ? `${calc.breakEvenCaja} uds × S/${precioVenta.toFixed(0)}` : ''}</div>
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
                <div className="text-[9px] text-slate-500">por unidad</div>
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
            <svg viewBox="0 0 600 220" className="w-full h-32 lg:h-36">
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
                isFinite(pesimista) && isFinite(calc.breakEvenCaja)
                  ? `+${pesimista - calc.breakEvenCaja} uds vs base`
                  : '—'
              }
              deltaColor="text-rose-600"
            />
            <EscenarioCard
              variant="active"
              colorDot="bg-teal-500"
              titulo="Base · actual"
              tituloColor="text-teal-700"
              uds={isFinite(calc.breakEvenCaja) ? calc.breakEvenCaja : null}
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
                isFinite(optimista) && isFinite(calc.breakEvenCaja)
                  ? `${optimista - calc.breakEvenCaja} uds vs base`
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
                  unidadesCompradas,
                  breakEven: isFinite(calc.breakEvenCaja) ? calc.breakEvenCaja : 0,
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
  step = 1,
  onChange,
  prefix,
  suffix,
  valueColor,
  fillColor,
  helpText,
  allowEditOver = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  prefix: string;
  suffix?: string;
  valueColor: string;
  fillColor: string;
  helpText?: string;
  /** Si true, permite escribir valores POR ENCIMA del max del slider (input libre) */
  allowEditOver?: boolean;
}) {
  const disabled = max <= min;
  // Slider visual va de min a max · si value supera max, slider queda al tope
  const sliderValue = Math.min(max, Math.max(min, value));
  const pct = max > min ? ((sliderValue - min) / (max - min)) * 100 : 0;
  const bg = disabled
    ? '#e2e8f0'
    : `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`;
  const [editText, setEditText] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  const handleInputBlur = () => {
    setIsEditing(false);
    const parsed = parseFloat(editText.replace(/[^\d.-]/g, ''));
    if (!isNaN(parsed) && parsed >= 0) {
      const limit = allowEditOver ? Math.max(parsed, max * 10) : max;
      onChange(Math.min(parsed, limit));
    }
  };

  const fmt = (n: number) => `${prefix}${prefix ? ' ' : ''}${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}${suffix ? ' ' + suffix : ''}`.trim();

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          {icon}
          {label}
        </label>
        {/* Input editable · click para escribir · blur para confirmar */}
        {isEditing ? (
          <div className="flex items-center gap-1">
            {prefix && <span className="text-[11px] font-mono text-slate-500">{prefix}</span>}
            <input
              type="number"
              min={0}
              step={step}
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleInputBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInputBlur();
                if (e.key === 'Escape') { setIsEditing(false); }
              }}
              className={`w-20 text-right text-base font-bold tabular-nums bg-white border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-teal-400 ${valueColor}`}
            />
            {suffix && <span className="text-[11px] text-slate-500">{suffix}</span>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (disabled) return;
              setEditText(String(value));
              setIsEditing(true);
            }}
            className={`text-base font-bold tabular-nums hover:bg-slate-50 rounded px-1.5 py-0.5 -mr-1.5 -my-0.5 ${valueColor} ${!disabled ? 'cursor-text border border-transparent hover:border-slate-200' : ''}`}
            title={disabled ? '' : 'Click para editar'}
          >
            {fmt(value)}
          </button>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={sliderValue}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-teal-500 [&::-webkit-slider-thumb]:border-2
                   [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md
                   [&::-webkit-slider-thumb]:cursor-pointer"
        style={{ background: bg }}
      />
      <div className="flex justify-between text-[10px] text-slate-400 mt-1 tabular-nums">
        <span>{fmt(min)}</span>
        {value > max && allowEditOver && (
          <span className="text-amber-600 font-medium">↑ {fmt(value)} (sobre el slider)</span>
        )}
        <span>{fmt(max)}{allowEditOver ? '+' : ''}</span>
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
