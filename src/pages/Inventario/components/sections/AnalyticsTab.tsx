/**
 * AnalyticsTab · canon pixel-perfect mockup stock-hub-completo-v1.html ACTO 5 (líneas 352-429)
 *
 * REFOCUSADO (operativo-estratégico): Stock conserva lo ÚNICO del inventario
 * (BCG · ABC · antigüedad · concentración · costo oportunidad · KPIs operativos).
 * La rentabilidad financiera (margen bruto/neto · ROI · revenue · utilidad) NO se
 * duplica aquí: vive en el módulo CTRU (grupo Análisis) y se referencia con un
 * banner cross-link (sección 3). La Matriz BCG SÍ usa el margen como EJE de
 * clasificación estratégica (margen × rotación) · eso se conserva del god-component.
 *
 * 6 secciones (orden del mockup):
 *   1. Filtros (País · Almacén · Exportar análisis ABC)
 *   2. 6 KPIs operativos (Valor · Días prom · Rotación · Sin mov >90d · Por vencer · Crítico)
 *   3. Banner cross-link CTRU (rentabilidad vive en CTRU → navigate('/ctru'))
 *   4. Concentración marca/país + Costo de oportunidad
 *   5. Matriz BCG (4 cuadrantes) + Distribución de antigüedad (5 buckets)
 *   6. Tabla ABC (Producto · Uds · Valor USD · Clase · Rot · Días · Estado)
 *
 * Lógica de cálculos recuperada/adaptada del InventarioAnalytics legacy
 * (1846 ln · god-component · ya eliminado del proyecto). NO se porta el dashboard
 * de rentabilidad ni el ranking ROI ni valor-de-mercado (eso es CTRU).
 *
 * Color: chrome (filtros focus · Exportar · CTA banner) = orange (módulo Stock).
 * Semántico (KPIs por naturaleza · BCG · antigüedad · ABC badges) = paleta fija
 * del mockup (emerald/sky/amber/rose/slate). Banner CTRU = indigo.
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  Calculator,
  ArrowRight,
  AlertOctagon,
  BarChart3,
} from 'lucide-react';
import { formatCurrencyCompact } from '../../../../utils/format';
import { calcularDiasParaVencer } from '../../../../utils/dateFormatters';
import type { ProductoConUnidades } from './ProductoInventarioTable';
import type { Almacen } from '../../../../types/almacen.types';
import type { CTRUProductoDetalle } from '../../../../store/ctruStore';
import { exportService } from '../../../../services/export.service';

interface AnalyticsTabProps {
  productosConUnidades: ProductoConUnidades[];
  /** Stats agregados del inventario (mismo contrato que KpiStripV2) */
  stats: {
    enOrigen: number;
    enTransito: number;
    disponiblePeru: number;
    reservada: number;
    problemas: number;
    total: number;
  };
  /** Datos de rentabilidad/CTRU · provee margen + base para rotación de la matriz BCG */
  ctruData?: CTRUProductoDetalle[];
  /** Almacenes · para el filtro de almacén y resolver país por unidad */
  almacenes?: Almacen[];
}

// Producto analítico derivado (1 fila por producto · base de BCG/ABC/tabla)
interface ProductoAnalitico {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  cantidadTotal: number;
  valorTotal: number;
  diasEnInventario: number;
  rotacion: number;
  clasificacionABC: 'A' | 'B' | 'C';
  diasParaVencer: number | null;
  stockCritico: boolean;
}

// Helper: días desde una fecha Timestamp (Firestore)
const calcularDiasDesde = (fecha: { toDate?: () => Date } | null | undefined): number => {
  if (!fecha || typeof fecha.toDate !== 'function') return 0;
  const hoy = new Date();
  const fechaDate = fecha.toDate();
  const diffTime = Math.abs(hoy.getTime() - fechaDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// ─── AnalyticsTab principal ───────────────────────────────────────────────────

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  productosConUnidades,
  ctruData = [],
  almacenes = [],
}) => {
  const navigate = useNavigate();
  const [filtroPais, setFiltroPais] = useState<string>('');
  const [filtroAlmacen, setFiltroAlmacen] = useState<string>('');

  // Almacenes filtrados por país (para el dropdown dependiente)
  const almacenesFiltrados = useMemo(() => {
    if (!filtroPais) return almacenes;
    return almacenes.filter((a) => a.pais === filtroPais);
  }, [almacenes, filtroPais]);

  // ─── Análisis por producto (adaptado del god-component · sin rentabilidad) ──
  // El god-ref partía de unidades crudas; aquí partimos de productosConUnidades
  // (ya agrupados) y reusamos sus unidades para días/antigüedad/país.
  const productosAnalytics = useMemo((): ProductoAnalitico[] => {
    // Map de margen × rotación-CTRU por producto (solo para la matriz BCG)
    const ctruMap = new Map(ctruData.map((c) => [c.productoId, c]));

    // 1) Construir base por producto, aplicando filtros país/almacén sobre sus unidades
    const base = productosConUnidades
      .map((p) => {
        let unidades = p.unidades.filter((u) => u.estado !== 'vendida');
        if (filtroPais) unidades = unidades.filter((u) => u.pais === filtroPais);
        if (filtroAlmacen) unidades = unidades.filter((u) => u.almacenId === filtroAlmacen);

        const cantidadTotal = unidades.length;
        const valorTotal = unidades.reduce((s, u) => s + u.costoUnitarioUSD, 0);

        // Días promedio en inventario (a partir de fechaCreacion de cada unidad)
        const fechas = unidades
          .map((u) => calcularDiasDesde(u.fechaCreacion))
          .filter((d) => d > 0);
        const diasEnInventario = fechas.length > 0
          ? Math.round(fechas.reduce((s, d) => s + d, 0) / fechas.length)
          : 0;

        // Rotación: 365 / días promedio (mismo criterio que el god-component)
        const rotacion = diasEnInventario > 0 ? 365 / diasEnInventario : 0;

        // Días para vencer (mínimo entre las unidades)
        const vencimientos = unidades
          .map((u) => calcularDiasParaVencer(u.fechaVencimiento))
          .filter((d): d is number => d !== null);
        const diasParaVencer = vencimientos.length > 0 ? Math.min(...vencimientos) : null;

        return {
          productoId: p.productoId,
          sku: p.sku,
          nombre: p.nombre,
          marca: p.marca || 'Sin Marca',
          cantidadTotal,
          valorTotal,
          diasEnInventario,
          rotacion,
          diasParaVencer,
          stockCritico: p.stockCritico,
        };
      })
      .filter((p) => p.cantidadTotal > 0);

    // 2) Clasificación ABC Pareto por valor (acumulado: ≤80% A · ≤95% B · resto C)
    const valorTotalInventario = base.reduce((s, p) => s + p.valorTotal, 0);
    const ordenadosPorValor = [...base].sort((a, b) => b.valorTotal - a.valorTotal);
    let acumulado = 0;
    const clasePorProducto = new Map<string, 'A' | 'B' | 'C'>();
    ordenadosPorValor.forEach((p) => {
      const pct = valorTotalInventario > 0 ? (p.valorTotal / valorTotalInventario) * 100 : 0;
      acumulado += pct;
      clasePorProducto.set(p.productoId, acumulado <= 80 ? 'A' : acumulado <= 95 ? 'B' : 'C');
    });

    return base.map((p) => ({
      ...p,
      clasificacionABC: clasePorProducto.get(p.productoId) ?? 'C',
    }));
  }, [productosConUnidades, ctruData, filtroPais, filtroAlmacen]);

  // ─── 6 KPIs operativos ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const valorTotalUSD = productosAnalytics.reduce((s, p) => s + p.valorTotal, 0);

    const diasPromedio = productosAnalytics.length > 0
      ? Math.round(
          productosAnalytics.reduce((s, p) => s + p.diasEnInventario, 0) / productosAnalytics.length,
        )
      : 0;

    const rotacionPromedio = productosAnalytics.length > 0
      ? productosAnalytics.reduce((s, p) => s + p.rotacion, 0) / productosAnalytics.length
      : 0;

    const sinMovimiento = productosAnalytics.filter((p) => p.diasEnInventario > 90).length;

    const porVencer = productosAnalytics.filter(
      (p) => p.diasParaVencer !== null && p.diasParaVencer >= 0 && p.diasParaVencer <= 30,
    ).length;

    const critico = productosAnalytics.filter((p) => p.stockCritico).length;

    return { valorTotalUSD, diasPromedio, rotacionPromedio, sinMovimiento, porVencer, critico };
  }, [productosAnalytics]);

  // ─── Matriz estratégica BCG (margen × rotación) ────────────────────────────
  // margen ← CTRU (margenBrutoProm, solo con ventas) · rotación ← inventario.
  const matrizBCG = useMemo(() => {
    const ctruMap = new Map(ctruData.map((c) => [c.productoId, c]));
    // Solo productos con ventas (margen disponible) entran a la clasificación
    const conMargen = productosAnalytics
      .map((p) => {
        const ctru = ctruMap.get(p.productoId);
        return ctru && ctru.ventasCount > 0
          ? { ...p, margen: ctru.margenBrutoProm }
          : null;
      })
      .filter((p): p is ProductoAnalitico & { margen: number } => p !== null);

    // Medianas como umbral alto/bajo
    const medianMargen = (() => {
      const m = conMargen.map((p) => p.margen).sort((a, b) => a - b);
      return m.length > 0 ? m[Math.floor(m.length / 2)] : 15;
    })();
    const medianRotacion = (() => {
      const r = conMargen.map((p) => p.rotacion).sort((a, b) => a - b);
      return r.length > 0 ? r[Math.floor(r.length / 2)] : 10;
    })();

    return {
      estrellas: conMargen.filter((p) => p.margen >= medianMargen && p.rotacion >= medianRotacion).length,
      vacasLecheras: conMargen.filter((p) => p.margen >= medianMargen && p.rotacion < medianRotacion).length,
      volumen: conMargen.filter((p) => p.margen < medianMargen && p.rotacion >= medianRotacion).length,
      revisar: conMargen.filter((p) => p.margen < medianMargen && p.rotacion < medianRotacion).length,
    };
  }, [productosAnalytics, ctruData]);

  // ─── Distribución de antigüedad (5 buckets · sobre unidades filtradas) ──────
  const distribucionAntiguedad = useMemo(() => {
    const buckets = [
      { label: '0–15d', min: 0, max: 15, count: 0, color: 'bg-emerald-500' },
      { label: '16–30d', min: 16, max: 30, count: 0, color: 'bg-emerald-400' },
      { label: '31–60d', min: 31, max: 60, count: 0, color: 'bg-amber-400' },
      { label: '61–90d', min: 61, max: 90, count: 0, color: 'bg-amber-500' },
      { label: '>90d', min: 91, max: Infinity, count: 0, color: 'bg-rose-500' },
    ];

    productosConUnidades.forEach((p) => {
      p.unidades
        .filter((u) => u.estado !== 'vendida')
        .filter((u) => !filtroPais || u.pais === filtroPais)
        .filter((u) => !filtroAlmacen || u.almacenId === filtroAlmacen)
        .forEach((u) => {
          const dias = calcularDiasDesde(u.fechaCreacion);
          const bucket = buckets.find((b) => dias >= b.min && dias <= b.max);
          if (bucket) bucket.count++;
        });
    });

    const maxCount = Math.max(...buckets.map((b) => b.count), 1);
    return buckets.map((b) => ({ ...b, widthPercent: (b.count / maxCount) * 100 }));
  }, [productosConUnidades, filtroPais, filtroAlmacen]);

  // ─── Concentración por marca + por país ────────────────────────────────────
  const concentracion = useMemo(() => {
    const valorTotal = productosAnalytics.reduce((s, p) => s + p.valorTotal, 0);

    // Por marca (top 2)
    const marcas: Record<string, number> = {};
    productosAnalytics.forEach((p) => {
      marcas[p.marca] = (marcas[p.marca] || 0) + p.valorTotal;
    });
    const porMarca = Object.entries(marcas)
      .map(([marca, valor]) => ({
        label: marca,
        pct: valorTotal > 0 ? (valor / valorTotal) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 2);

    // Por país (sobre las unidades · respeta filtros)
    const paises: Record<string, number> = {};
    let totalPaisUSD = 0;
    productosConUnidades.forEach((p) => {
      p.unidades
        .filter((u) => u.estado !== 'vendida')
        .filter((u) => !filtroPais || u.pais === filtroPais)
        .filter((u) => !filtroAlmacen || u.almacenId === filtroAlmacen)
        .forEach((u) => {
          const pais = u.pais === 'Peru' ? '🇵🇪 Perú' : '🇺🇸 USA';
          paises[pais] = (paises[pais] || 0) + u.costoUnitarioUSD;
          totalPaisUSD += u.costoUnitarioUSD;
        });
    });
    const porPais = Object.entries(paises)
      .map(([label, valor]) => ({
        label,
        pct: totalPaisUSD > 0 ? (valor / totalPaisUSD) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct);

    return { porMarca, porPais };
  }, [productosAnalytics, productosConUnidades, filtroPais, filtroAlmacen]);

  // ─── Costo de oportunidad (productos sin movimiento >90d) ───────────────────
  const costoOportunidad = useMemo(() => {
    const sinMov = productosAnalytics.filter((p) => p.diasEnInventario > 90);
    const capitalInmovilizado = sinMov.reduce((s, p) => s + p.valorTotal, 0);
    return { totalProductos: sinMov.length, capitalInmovilizado };
  }, [productosAnalytics]);

  // ─── Tabla ABC (orden por valor descendente) ───────────────────────────────
  const tablaABC = useMemo(() => {
    const ctruMap = new Map(ctruData.map((c) => [c.productoId, c]));
    return [...productosAnalytics]
      .sort((a, b) => b.valorTotal - a.valorTotal)
      .map((p) => {
        // Estado: misma lógica que god-ref (crítico > estancado > vence > ok)
        let estado: 'OK' | 'Crítico' | 'Estancado' | 'Vence';
        if (p.stockCritico) estado = 'Crítico';
        else if (p.diasEnInventario > 90) estado = 'Estancado';
        else if (p.diasParaVencer !== null && p.diasParaVencer <= 30) estado = 'Vence';
        else estado = 'OK';
        return { ...p, ctru: ctruMap.get(p.productoId), estado };
      });
  }, [productosAnalytics, ctruData]);

  // ─── Exportar análisis ABC a Excel ─────────────────────────────────────────
  const handleExportar = () => {
    const data = tablaABC.map((p) => ({
      SKU: p.sku,
      Producto: p.nombre,
      Marca: p.marca,
      Clase: p.clasificacionABC,
      Unidades: p.cantidadTotal,
      'Valor USD': p.valorTotal.toFixed(2),
      Rotación: p.rotacion.toFixed(1),
      'Días en inventario': p.diasEnInventario,
      'Días para vencer': p.diasParaVencer ?? 'N/A',
      Estado: p.estado,
    }));
    exportService.downloadExcel(data, `Analytics_ABC_${filtroPais || 'Todos'}`);
  };

  // Color del badge de clase ABC
  const claseBadge = (clase: 'A' | 'B' | 'C'): string =>
    clase === 'A'
      ? 'bg-emerald-100 text-emerald-700'
      : clase === 'B'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-200 text-slate-700';

  // Color del badge de estado
  const estadoBadge = (estado: string): string =>
    estado === 'OK'
      ? 'bg-emerald-100 text-emerald-700'
      : estado === 'Crítico' || estado === 'Vence'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-amber-100 text-amber-700';

  // Empty state si no hay productos
  if (productosConUnidades.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-12 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-7 h-7 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Sin inventario para analizar</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Los análisis ABC · BCG · antigüedad aparecen al registrar unidades.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── 1 · Filtros analytics ─── */}
      <div className="flex items-center gap-2 flex-wrap bg-white border border-slate-200 rounded-xl p-2 text-[11px]">
        <select
          value={filtroPais}
          onChange={(e) => {
            setFiltroPais(e.target.value);
            setFiltroAlmacen('');
          }}
          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        >
          <option value="">País: Todos</option>
          <option value="USA">🇺🇸 USA</option>
          <option value="Peru">🇵🇪 Perú</option>
        </select>
        <select
          value={filtroAlmacen}
          onChange={(e) => setFiltroAlmacen(e.target.value)}
          disabled={almacenesFiltrados.length === 0}
          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 disabled:opacity-50"
        >
          <option value="">Almacén: Todos</option>
          {almacenesFiltrados.map((a) => (
            <option key={a.id} value={a.id}>
              {a.pais === 'USA' ? '🇺🇸' : '🇵🇪'} {a.nombre}
            </option>
          ))}
        </select>
        <button
          onClick={handleExportar}
          className="ml-auto text-[11px] font-semibold text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700"
        >
          <Download className="w-3.5 h-3.5" /> Exportar análisis (ABC)
        </button>
      </div>

      {/* ─── 2 · 6 KPIs operativos ─── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <div className="bg-emerald-50 ring-1 ring-emerald-200/50 rounded-xl p-2.5">
          <div className="text-[9px] uppercase font-bold text-emerald-700">Valor total</div>
          <div className="text-base font-bold tabular-nums text-emerald-900">
            {formatCurrencyCompact(kpis.valorTotalUSD, 'USD')}
          </div>
        </div>
        <div className="bg-sky-50 ring-1 ring-sky-200/50 rounded-xl p-2.5">
          <div className="text-[9px] uppercase font-bold text-sky-700">Días prom.</div>
          <div className="text-base font-bold tabular-nums text-sky-900">{kpis.diasPromedio}d</div>
        </div>
        <div className="bg-emerald-50 ring-1 ring-emerald-200/50 rounded-xl p-2.5">
          <div className="text-[9px] uppercase font-bold text-emerald-700">Rotación</div>
          <div className="text-base font-bold tabular-nums text-emerald-900">
            {kpis.rotacionPromedio.toFixed(1)}x
          </div>
        </div>
        <div className="bg-rose-50 ring-1 ring-rose-200/50 rounded-xl p-2.5">
          <div className="text-[9px] uppercase font-bold text-rose-700">Sin mov. &gt;90d</div>
          <div className="text-base font-bold tabular-nums text-rose-900">{kpis.sinMovimiento}</div>
        </div>
        <div className="bg-amber-50 ring-1 ring-amber-200/50 rounded-xl p-2.5">
          <div className="text-[9px] uppercase font-bold text-amber-700">Por vencer</div>
          <div className="text-base font-bold tabular-nums text-amber-900">{kpis.porVencer}</div>
        </div>
        <div className="bg-rose-50 ring-1 ring-rose-200/50 rounded-xl p-2.5">
          <div className="text-[9px] uppercase font-bold text-rose-700">Crítico</div>
          <div className="text-base font-bold tabular-nums text-rose-900">{kpis.critico}</div>
        </div>
      </div>

      {/* ─── 3 · Banner cross-link CTRU (rentabilidad vive en CTRU) ─── */}
      <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/30 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Calculator className="w-5 h-5 text-indigo-700" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-slate-900">
              Rentabilidad (margen · ROI · revenue) vive en Costos CTRU
            </div>
            <div className="text-[11px] text-slate-500 max-w-xl">
              Para no duplicar: el análisis financiero de productos (margen bruto/neto · ROI ·
              utilidad · revenue) está en el módulo <b>CTRU</b> del grupo Análisis. Stock se enfoca
              en lo operativo-estratégico del inventario.
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/ctru')}
          className="text-[12px] font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 flex-shrink-0"
        >
          Ver rentabilidad en CTRU <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ─── 4 · Concentración marca/país + Costo de oportunidad ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-[12px] font-bold text-slate-900 mb-2">Concentración por marca / país</div>
          <div className="space-y-1.5 text-[11px]">
            {concentracion.porMarca.map((m, idx) => (
              <div key={`marca-${idx}`} className="flex items-center gap-2">
                <span className="w-28 text-slate-600 truncate">{m.label}</span>
                <div className="flex-1 bg-slate-100 rounded h-2">
                  <div
                    className={`${idx === 0 ? 'bg-orange-500' : 'bg-orange-400'} h-2 rounded`}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
                <span className="tabular-nums w-9 text-right">{m.pct.toFixed(0)}%</span>
              </div>
            ))}
            {concentracion.porPais.map((p, idx) => (
              <div key={`pais-${idx}`} className="flex items-center gap-2">
                <span className="w-28 text-slate-600 truncate">{p.label}</span>
                <div className="flex-1 bg-slate-100 rounded h-2">
                  <div className="bg-emerald-500 h-2 rounded" style={{ width: `${p.pct}%` }} />
                </div>
                <span className="tabular-nums w-9 text-right">{p.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
          <div className="text-[12px] font-bold text-rose-900 mb-1 flex items-center gap-1.5">
            <AlertOctagon className="w-4 h-4" /> Costo de oportunidad
          </div>
          <div className="text-[11px] text-rose-800">
            {costoOportunidad.totalProductos} productos sin movimiento &gt;90d ·{' '}
            <b>{formatCurrencyCompact(costoOportunidad.capitalInmovilizado, 'USD')}</b> de capital
            inmovilizado · recuperable vía promoción/liquidación + reinversión.
          </div>
        </div>
      </div>

      {/* ─── 5 · Matriz BCG + Distribución de antigüedad ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-[12px] font-bold text-slate-900 mb-2">Matriz estratégica (BCG)</div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
              <div className="font-bold text-emerald-800">⭐ Estrellas</div>
              <div className="text-slate-500">margen alto + rotación alta · {matrizBCG.estrellas}</div>
            </div>
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-2">
              <div className="font-bold text-sky-800">🐄 Vacas lecheras</div>
              <div className="text-slate-500">margen alto + rotación baja · {matrizBCG.vacasLecheras}</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
              <div className="font-bold text-amber-800">📦 Volumen</div>
              <div className="text-slate-500">margen bajo + rotación alta · {matrizBCG.volumen}</div>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2">
              <div className="font-bold text-rose-800">⚠ Revisar</div>
              <div className="text-slate-500">margen bajo + rotación baja · {matrizBCG.revisar}</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-[12px] font-bold text-slate-900 mb-2">Distribución de antigüedad</div>
          <div className="space-y-1.5 text-[11px]">
            {distribucionAntiguedad.map((b, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-16 text-slate-500">{b.label}</span>
                <div className="flex-1 bg-slate-100 rounded h-2">
                  <div className={`${b.color} h-2 rounded`} style={{ width: `${b.widthPercent}%` }} />
                </div>
                <span className="tabular-nums w-8 text-right">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 6 · Tabla ABC ─── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 text-[10px] uppercase tracking-wider font-semibold text-slate-500 grid grid-cols-12 gap-2">
          <div className="col-span-4">Producto</div>
          <div className="col-span-1 text-right">Uds</div>
          <div className="col-span-2 text-right">Valor USD</div>
          <div className="col-span-1 text-center">Clase</div>
          <div className="col-span-1 text-right">Rot.</div>
          <div className="col-span-1 text-right">Días</div>
          <div className="col-span-2 text-center">Estado</div>
        </div>
        {tablaABC.map((p) => (
          <div
            key={p.productoId}
            className="px-3 py-2 grid grid-cols-12 gap-2 text-[11px] border-t border-slate-100 items-center"
          >
            <div className="col-span-4 font-semibold text-slate-800 truncate">{p.nombre}</div>
            <div className="col-span-1 text-right tabular-nums">{p.cantidadTotal}</div>
            <div className="col-span-2 text-right tabular-nums">
              {formatCurrencyCompact(p.valorTotal, 'USD')}
            </div>
            <div className="col-span-1 text-center">
              <span className={`px-1.5 rounded font-bold ${claseBadge(p.clasificacionABC)}`}>
                {p.clasificacionABC}
              </span>
            </div>
            <div className="col-span-1 text-right tabular-nums">{p.rotacion.toFixed(1)}x</div>
            <div className="col-span-1 text-right tabular-nums text-slate-600">
              {p.diasEnInventario}d
            </div>
            <div className="col-span-2 text-center">
              <span className={`px-1.5 rounded ${estadoBadge(p.estado)}`}>{p.estado}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
