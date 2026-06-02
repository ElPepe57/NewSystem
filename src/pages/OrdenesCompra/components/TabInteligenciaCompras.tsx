import React, { useMemo } from 'react';
import { BrainCircuit, TrendingUp, TrendingDown, Package, ArrowUpRight, BarChart3, Tag, Trophy, Minus } from 'lucide-react';
import type { OrdenCompra, Proveedor } from '../../../types/ordenCompra.types';

// chk5.COMERCIALES-F3c · Tab Inteligencia del hub de Compras · vista AGREGADA de compra.
// Eleva sin duplicar el Resumen (que da concentración por proveedor + FX). Aquí:
// ranking de SKUs por gasto, variación de precios por SKU, competitividad por proveedor.
// El análisis profundo por-SKU vive en PriceAdvisor (wizard) y en /intel-productos.

interface Props {
  ordenes: OrdenCompra[];
  proveedores: Proveedor[];
  navigate: (path: string) => void;
}

const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'number') return new Date(v);
  return null;
};
const fmtUSD = (n: number): string => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`);

export const TabInteligenciaCompras: React.FC<Props> = ({ ordenes, proveedores, navigate }) => {
  const activas = useMemo(() => ordenes.filter((o) => o.estado !== 'cancelada'), [ordenes]);

  // ── Agregación por SKU desde los productos de las OCs ──
  const porSKU = useMemo(() => {
    const map = new Map<string, { sku: string; nombre: string; marca: string; gasto: number; unidades: number; ocs: number; precios: { fecha: Date; precio: number }[] }>();
    for (const o of activas) {
      const fecha = toDate(o.fechaCreacion);
      for (const p of (o.productos || [])) {
        const key = p.productoId || p.sku;
        if (!key) continue;
        const cur = map.get(key) || { sku: p.sku, nombre: p.nombreComercial, marca: p.marca, gasto: 0, unidades: 0, ocs: 0, precios: [] };
        cur.gasto += p.subtotal || (p.costoUnitario || 0) * (p.cantidad || 0);
        cur.unidades += p.cantidad || 0;
        cur.ocs += 1;
        if ((p.costoUnitario || 0) > 0 && fecha) cur.precios.push({ fecha, precio: p.costoUnitario });
        map.set(key, cur);
      }
    }
    return [...map.values()].map((s) => {
      const precios = s.precios.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
      const precioProm = precios.length ? precios.reduce((x, y) => x + y.precio, 0) / precios.length : 0;
      const primero = precios[0]?.precio;
      const ultimo = precios[precios.length - 1]?.precio;
      const variacion = primero && ultimo && precios.length > 1 ? ((ultimo - primero) / primero) * 100 : null;
      return { ...s, precioProm, ultimo: ultimo ?? precioProm, variacion };
    });
  }, [activas]);

  const topPorGasto = useMemo(() => [...porSKU].sort((a, b) => b.gasto - a.gasto).slice(0, 8), [porSKU]);
  const maxGasto = topPorGasto[0]?.gasto || 1;
  const mayorVariacion = useMemo(
    () => porSKU.filter((s) => s.variacion !== null).sort((a, b) => Math.abs(b.variacion!) - Math.abs(a.variacion!)).slice(0, 5),
    [porSKU],
  );

  // ── Competitividad de precios por proveedor (factor SRM) ──
  const competitividad = useMemo(() => {
    return proveedores
      .filter((p) => p.evaluacion?.factores?.competitividadPrecios != null)
      .map((p) => ({ nombre: p.nombre, score: p.evaluacion!.factores.competitividadPrecios }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [proveedores]);

  const totalGasto = useMemo(() => porSKU.reduce((s, x) => s + x.gasto, 0), [porSKU]);
  const conVariacion = useMemo(() => porSKU.filter((s) => s.variacion !== null).length, [porSKU]);

  const sinDatos = porSKU.length === 0;
  const hayOCs = activas.length > 0;

  // ── Empty (distingue "sin OCs" de "OCs sin detalle de productos") ──
  if (sinDatos) {
    return (
      <div className="bg-slate-50/30 p-4 sm:p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mb-4 mx-auto">
            <BrainCircuit className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">{hayOCs ? 'Sin detalle de productos para analizar' : 'Sin datos de inteligencia aún'}</h3>
          <p className="text-[12px] text-slate-500 mt-1 max-w-md mx-auto">
            {hayOCs
              ? 'Tus órdenes de compra no tienen líneas de producto con precio para agregar. Las OCs creadas con el wizard incluyen ese detalle y aparecerán aquí automáticamente.'
              : 'Cuando registres órdenes de compra verás aquí el ranking de SKUs por gasto, la variación de precios y la competitividad de tus proveedores.'}
          </p>
          <button onClick={() => navigate('/intel-productos')} className="mt-5 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold px-4 py-2 rounded-lg transition-colors">
            <ArrowUpRight className="w-4 h-4" /> Ir a Cost Intelligence
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/30 p-4 sm:p-6 space-y-4">

      {/* header + mini-stats */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-[13px] font-bold text-slate-900">Inteligencia de compra</div>
          <div className="text-[11px] text-slate-500">qué compras, a qué precio y con qué proveedor · agregado del módulo</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"><Tag className="w-3.5 h-3.5 text-blue-600" /><span className="font-semibold text-slate-900 tabular-nums">{porSKU.length}</span> <span className="text-slate-500">SKUs</span></span>
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"><span className="font-semibold text-slate-900 tabular-nums">{fmtUSD(totalGasto)}</span> <span className="text-slate-500">comprado</span></span>
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"><BarChart3 className="w-3.5 h-3.5 text-amber-600" /><span className="font-semibold text-slate-900 tabular-nums">{conVariacion}</span> <span className="text-slate-500">con histórico</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* §A ranking de SKUs por gasto */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Top SKUs por gasto</div>
              <div className="text-[11px] text-slate-400">dónde se va tu inversión de compra</div>
            </div>
            <Trophy className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-2.5">
            {topPorGasto.map((s, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-[12px] mb-1 gap-2">
                  <span className="flex items-center gap-1.5 min-w-0"><span className="text-[10px] text-slate-400 font-mono">{s.sku}</span><span className="truncate text-slate-700">{s.marca} · {s.nombre}</span></span>
                  <span className="tabular-nums font-semibold text-slate-900 flex-shrink-0">{fmtUSD(s.gasto)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.max(3, (s.gasto / maxGasto) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400 tabular-nums flex-shrink-0">{s.unidades.toLocaleString('es-PE')} ud · {s.ocs} OC</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* §B variación de precios */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Movimientos de precio</div>
              <div className="text-[11px] text-slate-400">primer vs último costo unitario (USD)</div>
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          {mayorVariacion.length === 0 ? (
            <div className="text-[12px] text-slate-400 py-6 text-center">Aún no hay SKUs con 2+ compras para comparar precio.</div>
          ) : (
            <div className="space-y-2">
              {mayorVariacion.map((s, i) => {
                const v = s.variacion!;
                const sube = v > 1;
                const baja = v < -1;
                const Icon = sube ? TrendingUp : baja ? TrendingDown : Minus;
                const color = sube ? 'text-rose-700' : baja ? 'text-emerald-700' : 'text-slate-500';
                const bg = sube ? 'bg-rose-50' : baja ? 'bg-emerald-50' : 'bg-slate-50';
                return (
                  <div key={i} className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 ${bg}`}>
                    <span className="flex items-center gap-1.5 min-w-0"><span className="text-[10px] text-slate-400 font-mono">{s.sku}</span><span className="truncate text-[12px] text-slate-700">{s.marca} · {s.nombre}</span></span>
                    <span className={`inline-flex items-center gap-1 text-[12px] font-bold tabular-nums flex-shrink-0 ${color}`}>
                      <Icon className="w-3.5 h-3.5" />{v >= 0 ? '+' : ''}{Math.round(v)}% <span className="text-[10px] font-normal text-slate-400">${s.ultimo.toFixed(2)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* §C competitividad de proveedores */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Competitividad de precios · proveedores</div>
            <div className="text-[11px] text-slate-400">factor SRM de competitividad (0-25)</div>
          </div>
          <Package className="w-4 h-4 text-slate-400" />
        </div>
        {competitividad.length === 0 ? (
          <div className="text-[12px] text-slate-400 py-4 text-center">Aún no hay evaluaciones SRM de competitividad. Evalúa proveedores desde la tab Proveedores o Maestros.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {competitividad.map((c, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-[12px] mb-1"><span className="truncate text-slate-700">{c.nombre}</span><span className="tabular-nums font-semibold text-slate-900 flex-shrink-0">{c.score}/25</span></div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(c.score / 25) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* §D cross-links al análisis profundo */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 ml-1">Análisis profundo</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a onClick={() => navigate('/intel-productos')} className="bg-gradient-to-r from-indigo-50 to-indigo-100/20 border border-indigo-200 rounded-lg p-3 flex items-center justify-between hover:border-indigo-300 cursor-pointer">
            <div><div className="text-[12px] font-bold text-slate-900">Cost Intelligence</div><div className="text-[11px] text-indigo-700">rentabilidad, rotación y liquidez por producto</div></div>
            <ArrowUpRight className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          </a>
          <div className="bg-gradient-to-r from-blue-50 to-blue-100/20 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
            <div><div className="text-[12px] font-bold text-slate-900">Price Advisor</div><div className="text-[11px] text-blue-700">asesor de precio por SKU al crear una OC (en el wizard)</div></div>
            <BrainCircuit className="w-4 h-4 text-blue-600 flex-shrink-0" />
          </div>
        </div>
      </div>

    </div>
  );
};
