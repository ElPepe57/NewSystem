/**
 * ReportesGastosBI · TAREA-PROVEEDOR-GASTOS F4
 *
 * 3 reportes basicos de BI sobre gastos · derivados del modelo de 3 niveles
 * (TAREA-GASTOFORM-V2) y los proveedores vinculados (TAREA-PROVEEDOR-GASTOS):
 *
 *   1. Top 10 proveedores · gasto anual con sparkline
 *   2. Cruce Categoria padre × Proveedor (matriz heatmap)
 *   3. Gasto por bloque × tiempo (12 meses con barras)
 *
 * Style canonico aplicado:
 * - R1 Canvas protagonista (cada reporte ocupa una card grande)
 * - R5 Sparklines internas (no charts gigantes separados)
 * - R6 Tabular-nums obsesivo
 * - Paleta semantica por bloque
 */

import React, { useMemo } from 'react';
import type { Gasto } from '../../../types/gasto.types';
import type { BloqueCosto } from '../../../types/categoriaCosto.types';
import { toDateOrNow } from '../../../utils/dateFormatters';
import { resolverGastoCanonico } from '../../../utils/gasto.bloque';

interface ReportesGastosBIProps {
  gastos: Gasto[];
  arbolCategorias: Record<BloqueCosto, { padres: any[]; hijos: Record<string, any[]> }> | null;
}

const formatPEN = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(n);
const formatPENShort = (n: number) => {
  if (n >= 1000000) return `S/ ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `S/ ${(n / 1000).toFixed(1)}k`;
  return `S/ ${n.toFixed(0)}`;
};

const MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const ReportesGastosBI: React.FC<ReportesGastosBIProps> = ({ gastos, arbolCategorias }) => {

  // chk5.A12 · canon · delegado a resolverGastoCanonico que resuelve
  // bloque + nombre de categoría padre en un solo paso. Defaults locales:
  //   bloque null → 'periodo' · categoriaPadre null → 'Sin categorizar'.
  const resolverGasto = useMemo(() => (g: Gasto): { bloque: BloqueCosto; categoriaPadre: string } => {
    const r = resolverGastoCanonico(g, arbolCategorias);
    return {
      bloque: r.bloque ?? 'periodo',
      categoriaPadre: r.categoriaPadre ?? 'Sin categorizar',
    };
  }, [arbolCategorias]);

  // ── REPORTE 1 · Top 10 proveedores · gasto anual ──
  const top10Proveedores = useMemo(() => {
    const ahora = new Date();
    const inicio12m = new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1);

    const porProveedor: Record<string, {
      proveedorId: string;
      proveedorNombre: string;
      total: number;
      cantidad: number;
      gastosPorMes: number[]; // 12 meses · index 0 = mes -11, index 11 = mes actual
    }> = {};

    for (const g of gastos) {
      const fecha = toDateOrNow(g.fecha);
      if (fecha < inicio12m) continue;
      const provId = g.proveedorId || (g.proveedor || g.proveedorNombre || 'sin_proveedor');
      const provNombre = g.proveedorNombre || g.proveedor || 'Sin proveedor';
      if (!porProveedor[provId]) {
        porProveedor[provId] = {
          proveedorId: provId,
          proveedorNombre: provNombre,
          total: 0,
          cantidad: 0,
          gastosPorMes: Array(12).fill(0),
        };
      }
      porProveedor[provId].total += g.montoPEN || 0;
      porProveedor[provId].cantidad += 1;
      // Calcular bucket de mes (0 a 11)
      const mesesDeDiff = (ahora.getFullYear() - fecha.getFullYear()) * 12 + (ahora.getMonth() - fecha.getMonth());
      const bucket = 11 - mesesDeDiff;
      if (bucket >= 0 && bucket < 12) {
        porProveedor[provId].gastosPorMes[bucket] += g.montoPEN || 0;
      }
    }

    return Object.values(porProveedor)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [gastos]);

  const totalAnual = top10Proveedores.reduce((acc, p) => acc + p.total, 0);

  // ── REPORTE 2 · Heatmap matriz Categoria × Proveedor (top 5 cat × top 5 prov) ──
  const matrizCatProv = useMemo(() => {
    const ahora = new Date();
    const inicio12m = new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1);

    // Agrupar
    const matriz: Record<string, Record<string, number>> = {};
    const totalPorCat: Record<string, number> = {};
    const totalPorProv: Record<string, number> = {};

    for (const g of gastos) {
      const fecha = toDateOrNow(g.fecha);
      if (fecha < inicio12m) continue;
      const { categoriaPadre } = resolverGasto(g);
      const provNombre = g.proveedorNombre || g.proveedor || 'Sin proveedor';
      if (!matriz[categoriaPadre]) matriz[categoriaPadre] = {};
      if (!matriz[categoriaPadre][provNombre]) matriz[categoriaPadre][provNombre] = 0;
      matriz[categoriaPadre][provNombre] += g.montoPEN || 0;
      totalPorCat[categoriaPadre] = (totalPorCat[categoriaPadre] || 0) + (g.montoPEN || 0);
      totalPorProv[provNombre] = (totalPorProv[provNombre] || 0) + (g.montoPEN || 0);
    }

    // Top 5 categorias y top 5 proveedores
    const topCat = Object.entries(totalPorCat)
      .sort(([, a], [, b]) => b - a).slice(0, 5).map(([k]) => k);
    const topProv = Object.entries(totalPorProv)
      .sort(([, a], [, b]) => b - a).slice(0, 5).map(([k]) => k);

    // Calcular max para escala de color
    let maxValor = 0;
    for (const cat of topCat) {
      for (const prov of topProv) {
        const v = matriz[cat]?.[prov] || 0;
        if (v > maxValor) maxValor = v;
      }
    }

    return { matriz, topCat, topProv, totalPorCat, totalPorProv, maxValor };
  }, [gastos, resolverGasto]);

  // ── REPORTE 3 · Gasto por bloque × 12 meses (barras apiladas) ──
  const gastoPorBloqueMes = useMemo(() => {
    const ahora = new Date();
    const inicio12m = new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1);

    // 12 meses · cada uno con 3 bloques
    const meses: Array<{
      label: string;
      year: number;
      month: number;
      producto: number;
      venta: number;
      periodo: number;
      total: number;
    }> = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - 11 + i, 1);
      meses.push({
        label: MESES_ABREV[d.getMonth()],
        year: d.getFullYear(),
        month: d.getMonth(),
        producto: 0,
        venta: 0,
        periodo: 0,
        total: 0,
      });
    }

    for (const g of gastos) {
      const fecha = toDateOrNow(g.fecha);
      if (fecha < inicio12m) continue;
      const mesIdx = meses.findIndex(m => m.year === fecha.getFullYear() && m.month === fecha.getMonth());
      if (mesIdx < 0) continue;
      const { bloque } = resolverGasto(g);
      meses[mesIdx][bloque] += g.montoPEN || 0;
      meses[mesIdx].total += g.montoPEN || 0;
    }

    const maxTotalMes = Math.max(...meses.map(m => m.total), 1);
    return { meses, maxTotalMes };
  }, [gastos, resolverGasto]);

  // Helpers de color para heatmap (purple intensity)
  const getHeatColor = (valor: number, max: number): string => {
    if (valor === 0) return 'bg-slate-50 text-slate-300';
    const intensity = valor / max;
    if (intensity > 0.75) return 'bg-purple-700 text-white';
    if (intensity > 0.5) return 'bg-purple-500 text-white';
    if (intensity > 0.25) return 'bg-purple-300 text-purple-900';
    if (intensity > 0.1) return 'bg-purple-100 text-purple-900';
    return 'bg-purple-50 text-purple-700';
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Reportes BI · Gastos</h2>
          <p className="text-sm text-slate-600 mt-1">
            Análisis sobre los últimos 12 meses · {gastos.length} gastos · {formatPEN(totalAnual)} total
          </p>
        </div>
        <span className="pill bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
          🎯 TAREA-PROVEEDOR-GASTOS F4
        </span>
      </div>

      {/* REPORTE 1 · Top 10 proveedores */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🏭</span>
            <h3 className="text-sm font-bold text-emerald-900">Top 10 proveedores · gasto anual con tendencia</h3>
          </div>
        </div>
        {top10Proveedores.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 italic">
            No hay gastos registrados con proveedores en los últimos 12 meses.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {top10Proveedores.map((prov, idx) => {
              const maxMes = Math.max(...prov.gastosPorMes, 1);
              const pct = totalAnual > 0 ? (prov.total / totalAnual) * 100 : 0;
              return (
                <div key={prov.proveedorId} className="px-5 py-3 hover:bg-slate-50 transition flex items-center gap-4">
                  <div className="w-8 text-center">
                    <div className="text-base font-bold text-slate-400 tabular-nums">#{idx + 1}</div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {prov.proveedorNombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{prov.proveedorNombre}</div>
                    <div className="text-[11px] text-slate-500">{prov.cantidad} gastos · {pct.toFixed(1)}% del total</div>
                  </div>
                  {/* Sparkline · 12 meses */}
                  <div className="hidden md:flex items-end gap-0.5 h-10" style={{ width: '180px' }}>
                    {prov.gastosPorMes.map((monto, i) => {
                      const altPct = (monto / maxMes) * 100;
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-emerald-200 hover:bg-emerald-400 transition-colors rounded-sm"
                          style={{ height: `${Math.max(altPct, 2)}%` }}
                          title={`${MESES_ABREV[(new Date().getMonth() - 11 + i + 12) % 12]}: ${formatPEN(monto)}`}
                        ></div>
                      );
                    })}
                  </div>
                  <div className="text-right min-w-[100px]">
                    <div className="text-sm font-bold tabular-nums text-emerald-700">{formatPEN(prov.total)}</div>
                    <div className="text-[10px] text-slate-500">12 meses</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REPORTE 2 · Matriz Categoria × Proveedor */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-purple-50 to-fuchsia-50 border-b border-purple-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🔥</span>
            <h3 className="text-sm font-bold text-purple-900">
              Matriz heatmap · Categoría × Proveedor (top 5 × top 5)
            </h3>
          </div>
        </div>
        <div className="p-5 overflow-x-auto">
          {matrizCatProv.topCat.length === 0 || matrizCatProv.topProv.length === 0 ? (
            <div className="text-center text-sm text-slate-500 italic py-6">
              No hay datos suficientes para construir la matriz.
            </div>
          ) : (
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-white" style={{ minWidth: '160px' }}>Categoría / Proveedor</th>
                  {matrizCatProv.topProv.map(prov => (
                    <th key={prov} className="text-center p-2 bg-purple-50 font-bold text-purple-700 min-w-[110px]">
                      <div className="truncate" title={prov}>{prov}</div>
                    </th>
                  ))}
                  <th className="text-center p-2 bg-slate-100 font-bold text-slate-900 min-w-[100px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {matrizCatProv.topCat.map(cat => (
                  <tr key={cat} className="border-t border-slate-100">
                    <td className="p-2 sticky left-0 bg-white font-semibold text-slate-900 truncate" title={cat}>{cat}</td>
                    {matrizCatProv.topProv.map(prov => {
                      const v = matrizCatProv.matriz[cat]?.[prov] || 0;
                      return (
                        <td key={prov} className="p-1 text-center">
                          <div className={`px-2 py-1.5 rounded font-semibold ${getHeatColor(v, matrizCatProv.maxValor)}`}>
                            {v > 0 ? formatPENShort(v) : '·'}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-2 text-center bg-slate-100 font-bold text-slate-900">
                      {formatPENShort(matrizCatProv.totalPorCat[cat] || 0)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                  <td className="p-2 sticky left-0 bg-slate-100 text-slate-900">TOTAL</td>
                  {matrizCatProv.topProv.map(prov => (
                    <td key={prov} className="p-2 text-center text-purple-900">
                      {formatPENShort(matrizCatProv.totalPorProv[prov] || 0)}
                    </td>
                  ))}
                  <td className="p-2 text-center bg-purple-700 text-white">
                    {formatPENShort(
                      Object.values(matrizCatProv.totalPorCat).reduce((a, b) => a + b, 0)
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          <div className="text-[10px] text-slate-500 italic mt-3">
            ⓵ Color = intensidad (0% slate · 25% purple-100 · 50% purple-300 · 75% purple-500 · 100% purple-700).
            Hover en celda para ver monto exacto.
          </div>
        </div>
      </div>

      {/* REPORTE 3 · Gasto por bloque × 12 meses */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <h3 className="text-sm font-bold text-amber-900">
              Gasto por bloque × 12 meses · barras apiladas
            </h3>
            <div className="ml-auto flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span>📦 Importación</div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500"></span>🛒 Venta</div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>📅 Período</div>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-1.5 h-48">
            {gastoPorBloqueMes.meses.map((mes, idx) => {
              const totalMesPct = (mes.total / gastoPorBloqueMes.maxTotalMes) * 100;
              const impPct = mes.total > 0 ? (mes.producto / mes.total) * 100 : 0;
              const ventaPct = mes.total > 0 ? (mes.venta / mes.total) * 100 : 0;
              const periodoPct = mes.total > 0 ? (mes.periodo / mes.total) * 100 : 0;
              const esActual = idx === 11;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <div className="flex-1 w-full flex flex-col justify-end">
                    <div
                      className="w-full rounded-md overflow-hidden flex flex-col-reverse hover:scale-105 transition-transform cursor-pointer relative"
                      style={{ height: `${Math.max(totalMesPct, 3)}%`, minHeight: '4px' }}
                      title={`${mes.label}: ${formatPEN(mes.total)}`}
                    >
                      <div className="bg-amber-500" style={{ height: `${periodoPct}%` }}></div>
                      <div className="bg-purple-500" style={{ height: `${ventaPct}%` }}></div>
                      <div className="bg-blue-500" style={{ height: `${impPct}%` }}></div>
                      {esActual && (
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-amber-700 whitespace-nowrap">
                          ahora
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`text-[10px] font-semibold ${esActual ? 'text-amber-700' : 'text-slate-600'}`}>
                    {mes.label}
                  </div>
                  <div className="text-[9px] text-slate-500 tabular-nums">
                    {mes.total > 0 ? formatPENShort(mes.total) : '·'}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-3 gap-3 text-xs">
            <div className="bg-blue-50 rounded p-3">
              <div className="text-[10px] uppercase text-blue-700 font-bold">📦 Importación · 12m</div>
              <div className="text-base font-bold tabular-nums text-blue-900">
                {formatPEN(gastoPorBloqueMes.meses.reduce((a, m) => a + m.producto, 0))}
              </div>
            </div>
            <div className="bg-purple-50 rounded p-3">
              <div className="text-[10px] uppercase text-purple-700 font-bold">🛒 Venta · 12m</div>
              <div className="text-base font-bold tabular-nums text-purple-900">
                {formatPEN(gastoPorBloqueMes.meses.reduce((a, m) => a + m.venta, 0))}
              </div>
            </div>
            <div className="bg-amber-50 rounded p-3">
              <div className="text-[10px] uppercase text-amber-700 font-bold">📅 Período · 12m</div>
              <div className="text-base font-bold tabular-nums text-amber-900">
                {formatPEN(gastoPorBloqueMes.meses.reduce((a, m) => a + m.periodo, 0))}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
