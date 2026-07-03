import React, { useMemo } from 'react';
import { BrainCircuit, TrendingUp, TrendingDown, Package, ArrowUpRight, BarChart3, Tag, Trophy, Minus, AlertTriangle } from 'lucide-react';
import type { OrdenCompra, Proveedor } from '../../../types/ordenCompra.types';
import type { IncidenciaOC, TipoIncidenciaOC } from '../../../types/incidenciaOC.types';

// chk5.COMERCIALES-F3c · Tab Inteligencia del hub de Compras · vista AGREGADA de compra.
// Eleva sin duplicar el Resumen (que da concentración por proveedor + FX). Aquí:
// ranking de SKUs por gasto, variación de precios por SKU, competitividad por proveedor.
// F3: la referencia de precio por SKU se muestra inline al crear una OC (wizard · StepProductos);
// el análisis de costo profundo vive en Cost Intelligence (/intel-productos).

interface Props {
  ordenes: OrdenCompra[];
  proveedores: Proveedor[];
  /** Incidencias cross-OC (listAll · fetch único en el padre) · null = cargando, [] = sin datos/error. */
  incidencias: IncidenciaOC[] | null;
  incidenciasError?: boolean;
  /** Drill del bloque de incidencias → tab Llegadas (torre de control · excepciones · cross-link a Envíos). */
  onIrLlegadas?: () => void;
  navigate: (path: string) => void;
}

// Etiquetas honestas del tipo de incidencia (modelo real · NO inventamos "faltante/daño/calidad").
const TIPO_LABEL: Record<TipoIncidenciaOC, string> = {
  recepcion: 'Recepción',
  facturacion: 'Facturación',
  proveedor: 'Proveedor',
  logistica: 'Logística',
  impuestos: 'Impuestos',
  compliance: 'Compliance',
};
const TIPO_BAR: Record<TipoIncidenciaOC, string> = {
  recepcion: 'bg-rose-400',
  facturacion: 'bg-amber-400',
  proveedor: 'bg-purple-400',
  logistica: 'bg-sky-400',
  impuestos: 'bg-slate-400',
  compliance: 'bg-teal-400',
};

const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'number') return new Date(v);
  return null;
};
const fmtUSD = (n: number): string => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`);

export const TabInteligenciaCompras: React.FC<Props> = ({ ordenes, proveedores, incidencias, incidenciasError, onIrLlegadas, navigate }) => {
  const activas = useMemo(() => ordenes.filter((o) => o.estado !== 'cancelada'), [ordenes]);

  // ── A6 · INCIDENCIAS AGREGADAS · # abiertas · $ en disputa · tasa · mix tipo/severidad ──
  // Todo de listAll (fetch único en el padre). "Abiertas" = estado ≠ resuelta. "$ en disputa" =
  // Σ impactoEstimadoUSD de las abiertas (la pérdida potencial aún sin cerrar). "Tasa" = % de OCs
  // (de las activas) que tienen ≥1 incidencia. "Resueltas" = estado resuelta.
  const incid = useMemo(() => {
    if (!incidencias) return null;
    const total = incidencias.length;
    const abiertas = incidencias.filter((i) => i.estado !== 'resuelta');
    const resueltas = total - abiertas.length;
    const disputaUSD = abiertas.reduce((s, i) => s + (i.impactoEstimadoUSD || 0), 0);

    // Tasa: % de OCs ACTIVAS con ≥1 incidencia. El numerador se acota a la MISMA población del
    // denominador (activas · respeta filtro de línea, excluye canceladas) → ratio en [0,100], nunca
    // inflado por incidencias de otras líneas o de OCs canceladas. (abiertas/disputa/resueltas SÍ son
    // totales de sección a propósito · "de N históricas" · son counts, no un ratio.)
    const idsActivas = new Set(activas.map((o) => o.id));
    const ocsConIncidencia = new Set(
      incidencias.map((i) => i.ocId).filter((id): id is string => !!id && idsActivas.has(id)),
    );
    const tasa = activas.length > 0 ? Math.round((ocsConIncidencia.size / activas.length) * 100) : 0;

    // Mix por tipo (modelo real · 6 tipos · solo los presentes).
    const porTipoMap = new Map<TipoIncidenciaOC, number>();
    for (const i of incidencias) porTipoMap.set(i.tipo, (porTipoMap.get(i.tipo) || 0) + 1);
    const maxTipo = Math.max(1, ...porTipoMap.values());
    const porTipo = [...porTipoMap.entries()].sort((a, b) => b[1] - a[1]).map(([tipo, n]) => ({ tipo, n }));

    // Mix por severidad (alta+critica → alta · media · baja · sin = los que no declaran severidad).
    let alta = 0, media = 0, baja = 0, sinSev = 0;
    for (const i of incidencias) {
      if (i.severidad === 'alta' || i.severidad === 'critica') alta++;
      else if (i.severidad === 'media') media++;
      else if (i.severidad === 'baja') baja++;
      else sinSev++;
    }
    return { total, abiertas: abiertas.length, resueltas, disputaUSD, tasa, porTipo, maxTipo, alta, media, baja, sinSev };
  }, [incidencias, activas.length]);

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

  // ── A6 · bloque de incidencias agregadas (compartido entre el render normal y el empty de SKUs) ──
  const incidenciasBlock = (
    <div className="bg-white border border-rose-200 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-rose-700 font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Incidencias agregadas</div>
          <div className="text-[11px] text-slate-400">recepción · facturación · proveedor · logística · agregadas de todas las OCs</div>
        </div>
      </div>
      {incid == null ? (
        <div className="text-[12px] text-slate-400 py-6 text-center">{incidenciasError ? 'No se pudieron cargar las incidencias.' : 'Cargando incidencias…'}</div>
      ) : incid.total === 0 ? (
        <div className="text-[12px] text-slate-400 py-6 text-center">Sin incidencias registradas · ningún problema reportado en las OCs.</div>
      ) : (
        <>
          {/* 4 stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-rose-50 border border-rose-100 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-rose-700 font-bold mb-1">Abiertas</div>
              <div className="text-2xl font-bold tabular-nums text-rose-900">{incid.abiertas}</div>
              <div className="text-[10px] text-rose-600 tabular-nums">de {incid.total} históricas</div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-amber-700 font-bold mb-1">En disputa</div>
              <div className="text-2xl font-bold tabular-nums text-amber-900">{incid.disputaUSD > 0 ? `$${incid.disputaUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</div>
              <div className="text-[10px] text-amber-600">impacto estimado abierto</div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-600 font-bold mb-1">Tasa</div>
              <div className="text-2xl font-bold tabular-nums text-slate-900">{incid.tasa}<span className="text-slate-400">%</span></div>
              <div className="text-[10px] text-slate-500">OCs con incidencia</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1">Resueltas</div>
              <div className="text-2xl font-bold tabular-nums text-emerald-900">{incid.resueltas}</div>
              <div className="text-[10px] text-emerald-600">cerradas</div>
            </div>
          </div>
          {/* mix por tipo + severidad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Por tipo</div>
              <div className="space-y-1.5 text-[11px]">
                {incid.porTipo.map(({ tipo, n }) => (
                  <div key={tipo}>
                    <div className="flex justify-between mb-0.5"><span className="text-slate-600">{TIPO_LABEL[tipo]}</span><span className="tabular-nums font-bold text-slate-800">{n}</span></div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${TIPO_BAR[tipo]}`} style={{ width: `${Math.max(4, (n / incid.maxTipo) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Por severidad</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-rose-100 text-rose-700 tabular-nums">Alta · {incid.alta}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 tabular-nums">Media · {incid.media}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 tabular-nums">Baja · {incid.baja}</span>
                {incid.sinSev > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-slate-50 text-slate-400 tabular-nums">Sin clasificar · {incid.sinSev}</span>
                )}
              </div>
              {incid.abiertas > 0 && (
                <div className="mt-3"><button type="button" onClick={() => (onIrLlegadas ? onIrLlegadas() : navigate('/envios'))} className="text-[11px] font-bold text-rose-700 hover:underline flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Ver incidencias abiertas</button></div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ── Empty (distingue "sin OCs" de "OCs sin detalle de productos") ──
  if (sinDatos) {
    return (
      <div className="bg-slate-50/30 p-4 sm:p-6 space-y-4">
        {/* A6 · si hay incidencias, se muestran aunque no haya detalle de SKUs para analizar */}
        {incid && incid.total > 0 && incidenciasBlock}
        {/* Empty estándar (el esqueleto fantasma fue retirado a pedido del titular · 2026-07-03) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <BrainCircuit className="w-7 h-7 text-blue-300" />
          </div>
          <div className="text-[15px] font-bold text-slate-900">
            {hayOCs ? 'Sin detalle de productos para analizar' : 'Aún no hay inteligencia de compra'}
          </div>
          <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
            {hayOCs
              ? 'Tus OCs aún no tienen líneas con precio para agregar al análisis.'
              : 'Los indicadores de compra — SKUs, gasto, histórico de precios y competitividad — cobran vida con tu primera OC.'}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => navigate('/intel-productos')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5"
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> Ir a Cost Intelligence
            </button>
          </div>
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
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"><BarChart3 className="w-3.5 h-3.5 text-blue-600" /><span className="font-semibold text-slate-900 tabular-nums">{conVariacion}</span> <span className="text-slate-500">con histórico</span></span>
        </div>
      </div>

      {/* A6 · incidencias agregadas (de la sección · todas las OCs) */}
      {incidenciasBlock}

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
            <div><div className="text-[12px] font-bold text-slate-900">Referencia de precio</div><div className="text-[11px] text-blue-700">al cargar el precio en una OC: última compra · promedio · investigado (inline en el wizard)</div></div>
            <BrainCircuit className="w-4 h-4 text-blue-600 flex-shrink-0" />
          </div>
        </div>
      </div>

    </div>
  );
};
