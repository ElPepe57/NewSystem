/**
 * Componente Estado de Resultados · canon v5.1 chk5.E-S4
 *
 * Pixel-perfect contra docs/mockups/contabilidad-tab-estado-resultados-v5.1.html
 * - Sin header interno · sin selector de mes (el shell ya los provee)
 * - §1 Header informativo · FileText + título + subtítulo + botón "Vista cascada Waterfall"
 * - §2 Tabla P&L cascade formal · 3 columnas (Concepto · Monto · % ventas)
 *   - Bloques: VENTAS NETAS (emerald) · COGS (rose) · GASTOS OPERATIVOS (amber)
 *   - Totales destacados: MARGEN BRUTO (emerald-100 border-y-2) · EBITDA (teal-100) · UTILIDAD NETA (indigo-100)
 * - §3 Banner amber · nota fiscal contextual (Vita Skin no tributa actualmente)
 * - §4 Grid 2 cols · vs Mes anterior + Métricas operativas
 * - Loading + Error states canon v5.1
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  BarChart3,
  DollarSign,
  MinusCircle,
  TrendingUp,
  Layers,
  Zap,
  Trophy,
  Repeat,
  Plus,
  Info,
  ArrowLeftRight,
  Activity,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { contabilidadService } from '../../../services/contabilidad.service';
import type { EstadoResultados as EstadoResultadosType } from '../../../types/contabilidad.types';
import { formatCurrencyPEN } from '../../../utils/format';

const formatCurrency = (v: number): string => formatCurrencyPEN(v);
const pct = (v: number, base: number): number => (base !== 0 ? (v / base) * 100 : 0);

// ============================================================================
// PROPS · ahora recibe mes/anio del shell (alineación con BalanceGeneral)
// ============================================================================
interface Props {
  mes?: number;
  anio?: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function EstadoResultados({ mes: mesProp, anio: anioProp }: Props = {}) {
  const navigate = useNavigate();
  const mes = mesProp ?? new Date().getMonth() + 1;
  const anio = anioProp ?? new Date().getFullYear();

  const [estado, setEstado] = useState<EstadoResultadosType | null>(null);
  const [estadoAnterior, setEstadoAnterior] = useState<EstadoResultadosType | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cargarDatos = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await contabilidadService.generarEstadoResultados(mes, anio);
      setEstado(data);
      // Mes anterior para comparativo
      const mesAnt = mes === 1 ? 12 : mes - 1;
      const anioAnt = mes === 1 ? anio - 1 : anio;
      try {
        const dataAnt = await contabilidadService.generarEstadoResultados(mesAnt, anioAnt);
        setEstadoAnterior(dataAnt);
      } catch {
        setEstadoAnterior(null);
      }
    } catch (err) {
      console.error('Error cargando estado de resultados:', err);
      setErrorMsg(
        err instanceof Error ? err.message : 'Error desconocido al cargar el Estado de Resultados',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [mes, anio]);

  // ===== LOADING STATE · canon v5.1 spinner purple + skeleton =====
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-50">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-slate-700">
            Calculando Estado de Resultados…
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Procesando ventas · COGS · gastos · margen · EBITDA
          </div>
        </div>
        <div className="max-w-3xl mx-auto pt-2 space-y-2">
          <div className="h-10 rounded-lg bg-slate-100 animate-pulse"></div>
          <div className="h-6 rounded-lg bg-slate-50 animate-pulse"></div>
          <div className="h-6 rounded-lg bg-slate-50 animate-pulse"></div>
          <div className="h-10 rounded-lg bg-emerald-50 animate-pulse"></div>
          <div className="h-10 rounded-lg bg-rose-50 animate-pulse"></div>
          <div className="h-12 rounded-lg bg-indigo-50 animate-pulse"></div>
        </div>
      </div>
    );
  }

  // ===== ERROR STATE · canon v5.1 borde rose =====
  if (errorMsg || !estado) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-rose-600" />
        </div>
        <div>
          <div className="text-[14px] font-bold text-rose-900 mb-1">
            No se pudo cargar el Estado de Resultados
          </div>
          <div className="text-[11px] text-slate-600 max-w-md mx-auto">
            {errorMsg || 'Verificá que tengas ventas registradas para este período'}
          </div>
        </div>
        <button
          onClick={cargarDatos}
          className="text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // ===== DATOS DERIVADOS =====
  const ventasNetas = estado.ventasNetas;
  const cogsTotal = estado.compras.total;
  const margenBruto = estado.utilidadBruta;
  const gastosOpTotal = estado.totalGastosOperativos;
  const ebitda = estado.utilidadOperativa;
  const difCambiariaNeta = estado.otrosIngresosGastos.diferenciaCambiariaNeta;
  const otrosIngresos = estado.otrosIngresosGastos.otrosIngresos;
  const utilidadNeta = estado.utilidadNeta;

  // Comparativo mes anterior
  const hasAnt = !!estadoAnterior;
  const deltaVentas = hasAnt
    ? pct(ventasNetas - estadoAnterior!.ventasNetas, estadoAnterior!.ventasNetas)
    : 0;
  const deltaMargen = hasAnt
    ? estado.utilidadBrutaPorcentaje - estadoAnterior!.utilidadBrutaPorcentaje
    : 0;
  const deltaGastos = hasAnt
    ? pct(
        gastosOpTotal - estadoAnterior!.totalGastosOperativos,
        estadoAnterior!.totalGastosOperativos,
      )
    : 0;
  const deltaUtilidad = hasAnt
    ? pct(utilidadNeta - estadoAnterior!.utilidadNeta, estadoAnterior!.utilidadNeta)
    : 0;

  return (
    <div className="space-y-4">
      {/* §1 · Header informativo */}
      <section className="bg-gradient-to-r from-slate-50 to-slate-100/40 ring-1 ring-slate-200/50 rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-slate-700" />
            <div>
              <div className="text-[13px] font-bold text-slate-900">
                Estado de Resultados · {estado.periodo.nombreMes} {estado.periodo.anio}
              </div>
              <div className="text-[11px] text-slate-500">
                P&amp;L formal · criterio contable: ventas confirmadas + compras recibidas +
                gastos del período
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/finanzas/analisis')}
            className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            title="Ver el mismo P&L como gráfica cascade waterfall en Finanzas/Análisis"
          >
            <BarChart3 className="w-3 h-3" /> Vista cascada Waterfall
          </button>
        </div>
      </section>

      {/* §2 · Tabla P&L cascade formal */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 border-b-2 border-slate-200">
            <tr>
              <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">
                Concepto
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700 w-32">
                Monto
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700 w-20">
                % ventas
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* ===== VENTAS NETAS (header bloque emerald) ===== */}
            <tr className="bg-emerald-50">
              <td className="px-4 py-2.5 font-bold text-emerald-900">
                <span className="flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5" />
                  VENTAS NETAS
                </span>
              </td>
              <td className="px-4 py-2.5 text-right font-bold tabular-nums text-emerald-900">
                {formatCurrency(ventasNetas)}
              </td>
              <td className="px-4 py-2.5 text-right text-[11px] text-emerald-700">
                100.0<span className="text-emerald-400">%</span>
              </td>
            </tr>
            <tr>
              <td className="px-4 py-1.5 pl-10 text-slate-600 text-[12px]">Ventas confirmadas</td>
              <td className="px-4 py-1.5 text-right tabular-nums text-slate-700">
                {formatCurrency(estado.ventasBrutas)}
              </td>
              <td className="px-4 py-1.5 text-right text-[11px] text-slate-500">
                {pct(estado.ventasBrutas, ventasNetas).toFixed(1)}%
              </td>
            </tr>
            {(estado.descuentos > 0 || estado.devoluciones > 0) && (
              <tr>
                <td className="px-4 py-1.5 pl-10 text-slate-600 text-[12px]">
                  (−) Descuentos y devoluciones
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums text-rose-600">
                  −{formatCurrency(estado.descuentos + estado.devoluciones)}
                </td>
                <td className="px-4 py-1.5 text-right text-[11px] text-rose-500">
                  −{pct(estado.descuentos + estado.devoluciones, ventasNetas).toFixed(1)}%
                </td>
              </tr>
            )}

            {/* ===== COGS (header bloque rose) ===== */}
            <tr className="bg-rose-50">
              <td className="px-4 py-2.5 font-bold text-rose-900">
                <span className="flex items-center gap-2">
                  <MinusCircle className="w-3.5 h-3.5" />
                  COSTO DE VENTA (COGS)
                </span>
              </td>
              <td className="px-4 py-2.5 text-right font-bold tabular-nums text-rose-900">
                −{formatCurrency(cogsTotal)}
              </td>
              <td className="px-4 py-2.5 text-right text-[11px] text-rose-700">
                {pct(cogsTotal, ventasNetas).toFixed(1)}
                <span className="text-rose-400">%</span>
              </td>
            </tr>
            {estado.compras.costoProductos > 0 && (
              <tr>
                <td className="px-4 py-1.5 pl-10 text-slate-600 text-[12px]">
                  Costo de productos (OCs recibidas)
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums text-slate-700">
                  {formatCurrency(estado.compras.costoProductos)}
                </td>
                <td className="px-4 py-1.5 text-right text-[11px] text-slate-500">
                  {pct(estado.compras.costoProductos, ventasNetas).toFixed(1)}%
                </td>
              </tr>
            )}
            {estado.compras.fleteInternacional > 0 && (
              <tr>
                <td className="px-4 py-1.5 pl-10 text-slate-600 text-[12px]">
                  Flete internacional + impuestos importación
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums text-slate-700">
                  {formatCurrency(
                    estado.compras.fleteInternacional +
                      estado.compras.impuestos +
                      estado.compras.otrosGastosImportacion,
                  )}
                </td>
                <td className="px-4 py-1.5 text-right text-[11px] text-slate-500">
                  {pct(
                    estado.compras.fleteInternacional +
                      estado.compras.impuestos +
                      estado.compras.otrosGastosImportacion,
                    ventasNetas,
                  ).toFixed(1)}
                  %
                </td>
              </tr>
            )}

            {/* ===== MARGEN BRUTO (destacado emerald-100 border-y-2) ===== */}
            <tr className="bg-emerald-100 border-y-2 border-emerald-300">
              <td className="px-4 py-3 font-bold text-emerald-900">
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  MARGEN BRUTO
                </span>
              </td>
              <td className="px-4 py-3 text-right font-bold text-[15px] tabular-nums text-emerald-900">
                {formatCurrency(margenBruto)}
              </td>
              <td className="px-4 py-3 text-right text-[12px] font-bold text-emerald-700">
                {estado.utilidadBrutaPorcentaje.toFixed(1)}
                <span className="text-emerald-400">%</span>
              </td>
            </tr>

            {/* ===== GASTOS OPERATIVOS (header bloque amber) ===== */}
            <tr className="bg-amber-50">
              <td className="px-4 py-2.5 font-bold text-amber-900">
                <span className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" />
                  GASTOS OPERATIVOS
                </span>
              </td>
              <td className="px-4 py-2.5 text-right font-bold tabular-nums text-amber-900">
                −{formatCurrency(gastosOpTotal)}
              </td>
              <td className="px-4 py-2.5 text-right text-[11px] text-amber-700">
                {pct(gastosOpTotal, ventasNetas).toFixed(1)}
                <span className="text-amber-400">%</span>
              </td>
            </tr>
            {estado.costosVariables.gv.total > 0 && (
              <tr>
                <td className="px-4 py-1.5 pl-10 text-slate-600 text-[12px]">
                  Gastos de venta (marketing · comisiones)
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums text-slate-700">
                  {formatCurrency(estado.costosVariables.gv.total)}
                </td>
                <td className="px-4 py-1.5 text-right text-[11px] text-slate-500">
                  {pct(estado.costosVariables.gv.total, ventasNetas).toFixed(1)}%
                </td>
              </tr>
            )}
            {estado.costosFijos.ga.total > 0 && (
              <tr>
                <td className="px-4 py-1.5 pl-10 text-slate-600 text-[12px]">
                  Gastos administrativos
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums text-slate-700">
                  {formatCurrency(estado.costosFijos.ga.total)}
                </td>
                <td className="px-4 py-1.5 text-right text-[11px] text-slate-500">
                  {pct(estado.costosFijos.ga.total, ventasNetas).toFixed(1)}%
                </td>
              </tr>
            )}
            {estado.costosVariables.gd.total > 0 && (
              <tr>
                <td className="px-4 py-1.5 pl-10 text-slate-600 text-[12px]">
                  Gastos de distribución
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums text-slate-700">
                  {formatCurrency(estado.costosVariables.gd.total)}
                </td>
                <td className="px-4 py-1.5 text-right text-[11px] text-slate-500">
                  {pct(estado.costosVariables.gd.total, ventasNetas).toFixed(1)}%
                </td>
              </tr>
            )}
            {estado.costosFijos.go.total > 0 && (
              <tr>
                <td className="px-4 py-1.5 pl-10 text-slate-600 text-[12px]">
                  Gastos fijos (alquiler · sueldos · SaaS)
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums text-slate-700">
                  {formatCurrency(estado.costosFijos.go.total)}
                </td>
                <td className="px-4 py-1.5 text-right text-[11px] text-slate-500">
                  {pct(estado.costosFijos.go.total, ventasNetas).toFixed(1)}%
                </td>
              </tr>
            )}

            {/* ===== EBITDA (destacado teal-100 border-y-2) ===== */}
            <tr className="bg-teal-100 border-y-2 border-teal-300">
              <td className="px-4 py-3 font-bold text-teal-900">
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  EBITDA
                </span>
              </td>
              <td className="px-4 py-3 text-right font-bold text-[15px] tabular-nums text-teal-900">
                {formatCurrency(ebitda)}
              </td>
              <td className="px-4 py-3 text-right text-[12px] font-bold text-teal-700">
                {estado.utilidadOperativaPorcentaje.toFixed(1)}
                <span className="text-teal-400">%</span>
              </td>
            </tr>

            {/* ===== OTROS · diferencia cambiaria + otros ingresos ===== */}
            {difCambiariaNeta !== 0 && (
              <tr>
                <td className="px-4 py-1.5 text-slate-600 text-[12px]">
                  <span className="flex items-center gap-2">
                    <Repeat className="w-3 h-3" />
                    Diferencial cambiario (neto)
                  </span>
                </td>
                <td
                  className={`px-4 py-1.5 text-right tabular-nums ${
                    difCambiariaNeta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {difCambiariaNeta >= 0 ? '+' : '−'}
                  {formatCurrency(Math.abs(difCambiariaNeta))}
                </td>
                <td className="px-4 py-1.5 text-right text-[11px] text-slate-500">
                  {pct(Math.abs(difCambiariaNeta), ventasNetas).toFixed(1)}%
                </td>
              </tr>
            )}
            {otrosIngresos > 0 && (
              <tr>
                <td className="px-4 py-1.5 text-slate-600 text-[12px]">
                  <span className="flex items-center gap-2">
                    <Plus className="w-3 h-3" />
                    Otros ingresos
                  </span>
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums text-emerald-600">
                  +{formatCurrency(otrosIngresos)}
                </td>
                <td className="px-4 py-1.5 text-right text-[11px] text-slate-500">
                  {pct(otrosIngresos, ventasNetas).toFixed(1)}%
                </td>
              </tr>
            )}

            {/* ===== UTILIDAD NETA (destacado indigo-100 border-y-2) ===== */}
            <tr className="bg-indigo-100 border-y-2 border-indigo-400">
              <td className="px-4 py-3.5 font-bold text-indigo-900 text-[14px]">
                <span className="flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  UTILIDAD NETA DEL PERÍODO
                </span>
              </td>
              <td className="px-4 py-3.5 text-right font-bold text-[18px] tabular-nums text-indigo-900">
                {formatCurrency(utilidadNeta)}
              </td>
              <td className="px-4 py-3.5 text-right text-[13px] font-bold text-indigo-700">
                {estado.utilidadNetaPorcentaje.toFixed(1)}
                <span className="text-indigo-400">%</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* §3 · Nota fiscal contextual */}
      <section className="bg-amber-50 ring-1 ring-amber-200 rounded-lg p-3 text-[11px] text-amber-900 flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
        <div>
          Vista <strong>antes de impuestos</strong> (Vita Skin no tributa actualmente). Cuando se
          active el módulo SUNAT, se agrega línea "Provisión IR estimada (29.5%)" después de EBITDA
          · margen neto bajaría a ~{(estado.utilidadNetaPorcentaje * 0.705).toFixed(1)}% del
          ingreso. Hoy la utilidad neta = EBITDA + diferencial cambiario.
        </div>
      </section>

      {/* §4 · Comparativo vs mes anterior + Métricas operativas */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card · vs Mes anterior */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="text-[13px] font-bold text-slate-900 mb-3 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-slate-600" />
            vs Mes anterior
            {hasAnt && (
              <span className="text-[11px] font-normal text-slate-500">
                · {estadoAnterior!.periodo.nombreMes} {estadoAnterior!.periodo.anio}
              </span>
            )}
          </h3>
          {hasAnt ? (
            <div className="space-y-1.5 text-[12px]">
              <DeltaRow
                label="Ventas netas"
                deltaPct={deltaVentas}
                refValue={estadoAnterior!.ventasNetas}
                isMoney
                isPositiveGood
              />
              <DeltaRow
                label="Margen bruto"
                deltaPct={deltaMargen}
                refValue={estadoAnterior!.utilidadBrutaPorcentaje}
                isPercentPoints
                isPositiveGood
              />
              <DeltaRow
                label="Gastos operativos"
                deltaPct={deltaGastos}
                refValue={estadoAnterior!.totalGastosOperativos}
                isMoney
                isPositiveGood={false}
              />
              <div className="flex justify-between items-center font-bold border-t border-slate-200 pt-1 mt-1">
                <span className="text-slate-900">Utilidad neta</span>
                <DeltaInline
                  deltaPct={deltaUtilidad}
                  refValue={estadoAnterior!.utilidadNeta}
                  isMoney
                  isPositiveGood
                />
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 italic">
              Sin datos del mes anterior para comparar
            </div>
          )}
        </div>

        {/* Card · Métricas operativas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="text-[13px] font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Métricas operativas
          </h3>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <MetricaTile
              label="Ticket promedio"
              value={formatCurrency(estado.metricas.ticketPromedio)}
            />
            <MetricaTile
              label="Ventas confirmadas"
              value={estado.metricas.transacciones.toLocaleString()}
            />
            <MetricaTile
              label="Devoluciones"
              value={(estado.devoluciones > 0
                ? Math.round(estado.devoluciones / (estado.metricas.ticketPromedio || 1))
                : 0
              ).toLocaleString()}
            />
            <MetricaTile
              label="% devolución"
              value={
                <>
                  {pct(estado.devoluciones, estado.ventasBrutas).toFixed(1)}
                  <span className="text-slate-400">%</span>
                </>
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTES UTILITARIOS
// ============================================================================

interface DeltaRowProps {
  label: string;
  deltaPct: number;
  refValue: number;
  isMoney?: boolean;
  isPercentPoints?: boolean;
  isPositiveGood: boolean;
}

function DeltaRow({
  label,
  deltaPct,
  refValue,
  isMoney,
  isPercentPoints,
  isPositiveGood,
}: DeltaRowProps) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-600">{label}</span>
      <DeltaInline
        deltaPct={deltaPct}
        refValue={refValue}
        isMoney={isMoney}
        isPercentPoints={isPercentPoints}
        isPositiveGood={isPositiveGood}
      />
    </div>
  );
}

interface DeltaInlineProps {
  deltaPct: number;
  refValue: number;
  isMoney?: boolean;
  isPercentPoints?: boolean;
  isPositiveGood: boolean;
}

function DeltaInline({
  deltaPct,
  refValue,
  isMoney,
  isPercentPoints,
  isPositiveGood,
}: DeltaInlineProps) {
  const isUp = deltaPct >= 0;
  const isGood = isUp === isPositiveGood;
  const colorCls = isGood ? 'text-emerald-600' : 'text-amber-600';
  const Arrow = isUp ? TrendingUp : TrendingUp; // mockup canon · ambos casos usan trending-up icon
  return (
    <span className={`text-[11px] flex items-center gap-1 ${colorCls}`}>
      <Arrow className="w-3 h-3" />
      {isUp ? '+' : ''}
      {isPercentPoints ? `${deltaPct.toFixed(1)}pp` : `${deltaPct.toFixed(1)}%`}
      <span className="text-slate-500 ml-1 tabular-nums">
        ({isMoney ? formatCurrency(refValue) : `${refValue.toFixed(1)}%`})
      </span>
    </span>
  );
}

interface MetricaTileProps {
  label: string;
  value: React.ReactNode;
}

function MetricaTile({ label, value }: MetricaTileProps) {
  return (
    <div className="bg-slate-50 rounded p-2">
      <div className="text-slate-500 text-[9px] uppercase tracking-wider">{label}</div>
      <div className="text-[14px] font-bold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}
