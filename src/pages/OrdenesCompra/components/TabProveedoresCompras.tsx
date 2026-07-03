import React, { useMemo, useState } from 'react';
import { Building2, Search, Clock, AlertTriangle, Package, ArrowUpRight, Award, Star, MapPin, ShieldCheck, Gauge } from 'lucide-react';
import type { OrdenCompra, Proveedor, ClasificacionProveedor } from '../../../types/ordenCompra.types';
import type { Envio } from '../../../types/envio.types';
import type { IncidenciaOC } from '../../../types/incidenciaOC.types';
import { leadTimePiernaA, resumirLeadTime } from '../../../utils/leadTimePiernas.helper';

// chk5.COMERCIALES-F3b · Tab Proveedores del hub de Compras · evaluación SRM agregada.
// Directorio con métricas por proveedor (gasto/# OCs en vivo desde las OCs + lead time,
// incidencias, puntuación/clasificación de la evaluación SRM). CRUD → cross-link a Maestros.

interface Props {
  proveedores: Proveedor[];
  ordenes: OrdenCompra[];
  /** Todos los envíos (del store) · fuente del lead real por pierna del proveedor (pierna A). */
  envios: Envio[];
  /** Incidencias cross-OC (listAll · fetch único en el padre) · null = cargando, [] = sin datos/error. */
  incidencias: IncidenciaOC[] | null;
  /** El listAll falló (se muestra "—" en la columna incidencias en vez de 0 engañoso). */
  incidenciasError?: boolean;
  navigate: (path: string) => void;
}

const CLASIF: Record<ClasificacionProveedor | 'sin', { label: string; badge: string; dot: string }> = {
  preferido: { label: 'Preferido', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  aprobado: { label: 'Aprobado', badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  condicional: { label: 'Condicional', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  suspendido: { label: 'Suspendido', badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  sin: { label: 'Sin evaluar', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

const FILTROS: { id: ClasificacionProveedor | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'preferido', label: 'Preferidos' },
  { id: 'aprobado', label: 'Aprobados' },
  { id: 'condicional', label: 'Condicionales' },
  { id: 'suspendido', label: 'Suspendidos' },
];

export const TabProveedoresCompras: React.FC<Props> = ({ proveedores, ordenes, envios, incidencias, incidenciasError, navigate }) => {
  const [filtroClasif, setFiltroClasif] = useState<ClasificacionProveedor | 'todos'>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // gasto + # OCs en vivo desde las OCs (más confiable que metricas denormalizadas)
  // Semántica honesta (UAT 2026-07-03): una OC en BORRADOR no es una compra — el
  // débito en CC recién existe al confirmar → los borradores NO cuentan como
  // gasto/relación comercial (el titular vio "2 OCs · $706" con solo drafts de prueba).
  const porProveedor = useMemo(() => {
    const map = new Map<string, { gasto: number; ocs: number }>();
    for (const o of ordenes) {
      if (o.estado === 'cancelada' || o.estado === 'borrador' || !o.proveedorId) continue;
      const cur = map.get(o.proveedorId) || { gasto: 0, ocs: 0 };
      cur.gasto += o.totalUSD || 0;
      cur.ocs += 1;
      map.set(o.proveedorId, cur);
    }
    return map;
  }, [ordenes]);

  const enriquecidos = useMemo(() => {
    return proveedores
      .map((p) => {
        const calc = porProveedor.get(p.id) || { gasto: 0, ocs: 0 };
        const gasto = calc.gasto || p.metricas?.montoTotalUSD || 0;
        const ocs = calc.ocs || p.metricas?.ordenesCompra || 0;
        return {
          p,
          gasto,
          ocs,
          clasif: p.evaluacion?.clasificacion,
          puntuacion: p.evaluacion?.puntuacion,
          leadTime: p.metricas?.tiempoEntregaPromedioDias,
          tasaProblemas: p.metricas?.tasaProblemas,
        };
      })
      .sort((a, b) => b.gasto - a.gasto);
  }, [proveedores, porProveedor]);

  const filtrados = useMemo(() => {
    return enriquecidos.filter((e) => {
      if (filtroClasif !== 'todos' && e.clasif !== filtroClasif) return false;
      if (searchTerm.trim()) {
        const t = searchTerm.toLowerCase();
        if (!(e.p.nombre.toLowerCase().includes(t) || e.p.codigo.toLowerCase().includes(t) || (e.p.pais || '').toLowerCase().includes(t))) return false;
      }
      return true;
    });
  }, [enriquecidos, filtroClasif, searchTerm]);

  const stats = useMemo(() => {
    const total = proveedores.length;
    const preferidos = enriquecidos.filter((e) => e.clasif === 'preferido').length;
    const gastoTotal = enriquecidos.reduce((s, e) => s + e.gasto, 0);
    return { total, preferidos, gastoTotal };
  }, [proveedores, enriquecidos]);

  // ── A5 · SCORECARD SLA EN VIVO ──────────────────────────────────────────────
  // Lead REAL del proveedor = resumirLeadTime de leadTimePiernaA(envio.subEnvios) sobre los envíos
  // de ese proveedor (por origenProveedorId). Es el tramo despacho→entrega del PROVEEDOR (su pierna),
  // medido sobre tandas con ambas fechas → degrada HONESTO a null si no hay tandas medibles.
  // Consistencia = ±desviación de ESE mismo resumen (REEMPLAZA el "on-time %" del mockup: el on-time
  // exige una ETA/SLA objetivo que hoy es GREENFIELD · no se fabrica). Incidencias = # abiertas del
  // proveedor de listAll (estado ≠ resuelta).
  const leadPorProveedor = useMemo(() => {
    const vals = new Map<string, number[]>();
    for (const e of envios) {
      if (!e.origenProveedorId) continue;
      const a = leadTimePiernaA(e.subEnvios);
      if (a == null) continue;
      const arr = vals.get(e.origenProveedorId) ?? [];
      arr.push(a);
      vals.set(e.origenProveedorId, arr);
    }
    const out = new Map<string, { promedio: number; desviacion: number; n: number }>();
    for (const [id, v] of vals) {
      const stat = resumirLeadTime(v);
      if (stat) out.set(id, { promedio: stat.promedio, desviacion: stat.desviacion, n: stat.n });
    }
    return out;
  }, [envios]);

  const incidenciasAbiertasPorProveedor = useMemo(() => {
    const out = new Map<string, number>();
    if (!incidencias) return out;
    for (const i of incidencias) {
      if (i.estado === 'resuelta') continue;
      if (!i.proveedorId) continue;
      out.set(i.proveedorId, (out.get(i.proveedorId) || 0) + 1);
    }
    return out;
  }, [incidencias]);

  // Solo proveedores CON OCs (los que tienen relación comercial medible). Ordenados peor→mejor:
  // primero más incidencias abiertas, luego mayor lead real (los proveedores problema arriba).
  const scorecard = useMemo(() => {
    const rows = enriquecidos
      .filter((e) => e.ocs > 0)
      .map((e) => {
        const lead = leadPorProveedor.get(e.p.id) || null;
        const incid = incidencias ? (incidenciasAbiertasPorProveedor.get(e.p.id) || 0) : null;
        return { p: e.p, gasto: e.gasto, ocs: e.ocs, clasif: e.clasif, lead, incid };
      });
    rows.sort((a, b) => {
      const ia = a.incid ?? 0;
      const ib = b.incid ?? 0;
      if (ib !== ia) return ib - ia;
      return (b.lead?.promedio ?? -1) - (a.lead?.promedio ?? -1);
    });
    return rows;
  }, [enriquecidos, leadPorProveedor, incidencias, incidenciasAbiertasPorProveedor]);

  // ── Concentración × riesgo · DESGLOSE FORMAL (donut 4 clases) ────────────────
  // % del gasto por clasificación SRM (preferido/aprobado/condicional+suspendido/sin-evaluar).
  // El Resumen §C muestra el teaser comprimido (22% + barra 2-tramos) · acá el desglose · misma
  // fuente, distinto nivel (canon no-redundancia: teaser vs desglose).
  const concentracion = useMemo(() => {
    const clasifPorId = new Map<string, ClasificacionProveedor | undefined>();
    for (const p of proveedores) clasifPorId.set(p.id, p.evaluacion?.clasificacion);
    let preferido = 0, aprobado = 0, condicional = 0, sinEvaluar = 0, total = 0, conClasif = 0;
    for (const o of ordenes) {
      // Borradores fuera: no son gasto comprometido (misma semántica que porProveedor).
      if (o.estado === 'cancelada' || o.estado === 'borrador') continue;
      const monto = o.totalUSD || 0;
      if (monto <= 0) continue;
      total += monto;
      const c = o.proveedorId ? clasifPorId.get(o.proveedorId) : undefined;
      if (c === 'preferido') { preferido += monto; conClasif += monto; }
      else if (c === 'aprobado') { aprobado += monto; conClasif += monto; }
      else if (c === 'condicional' || c === 'suspendido') { condicional += monto; conClasif += monto; }
      else sinEvaluar += monto;
    }
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    const pctRiesgo = pct(condicional + sinEvaluar);
    return {
      total,
      hayClasificacion: conClasif > 0,
      pctRiesgo,
      segmentos: [
        { key: 'preferido', label: 'Preferido', pct: pct(preferido), color: '#10b981', dot: 'bg-emerald-500' },
        { key: 'aprobado', label: 'Aprobado', pct: pct(aprobado), color: '#0ea5e9', dot: 'bg-sky-500' },
        { key: 'condicional', label: 'Condicional', pct: pct(condicional), color: '#f59e0b', dot: 'bg-amber-500' },
        { key: 'sin', label: 'Sin evaluar', pct: pct(sinEvaluar), color: '#94a3b8', dot: 'bg-slate-400' },
      ],
    };
  }, [proveedores, ordenes]);

  // Segmentos del donut (offset acumulado arrancando en 25 · circunferencia ≈ 100 · mismo patrón que
  // el donut del Resumen · TabResumenCompras L121-127).
  const donutSegmentos = useMemo(() => {
    let acum = 25;
    return concentracion.segmentos
      .filter((s) => s.pct > 0)
      .map((s) => { const off = acum; acum -= s.pct; return { ...s, dasharray: `${s.pct} ${100 - s.pct}`, dashoffset: off }; });
  }, [concentracion.segmentos]);

  // ── Empty ──
  if (proveedores.length === 0) {
    return (
      <div className="bg-slate-50/30 p-4 sm:p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mb-4 mx-auto">
            <Building2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Sin proveedores registrados</h3>
          <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
            Registra proveedores desde el Gestor de Maestros para evaluarlos y asignarles órdenes de compra.
          </p>
          <button onClick={() => navigate('/maestros?tab=proveedores')} className="mt-5 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold px-4 py-2 rounded-lg transition-colors">
            <ArrowUpRight className="w-4 h-4" /> Gestionar proveedores
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/30 p-4 sm:p-6 space-y-4">

      {/* A5 · SCORECARD DE CONFIABILIDAD · SLA EN VIVO (lead real por pierna del proveedor + incidencias) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-blue-600" /> Scorecard de confiabilidad · SLA en vivo</div>
            <div className="text-[11px] text-slate-400">lead REAL del proveedor (despacho → entrega · pierna A) + consistencia + incidencias abiertas · solo proveedores con OCs</div>
          </div>
        </div>

        {scorecard.length === 0 ? (
          <div className="text-[12px] text-slate-400 py-6 text-center">Aún no hay proveedores con órdenes de compra para medir.</div>
        ) : (
          <div className="space-y-2">
            {/* header de columnas (desktop) */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">
              <div className="col-span-4">Proveedor</div>
              <div className="col-span-2 text-center">Lead real</div>
              <div className="col-span-2 text-center">Consistencia</div>
              <div className="col-span-2 text-center">Incidencias</div>
              <div className="col-span-2 text-center">Clasificación</div>
            </div>
            {scorecard.map((r, i) => {
              const c = CLASIF[r.clasif ?? 'sin'];
              const peor = (r.incid ?? 0) > 0; // con incidencias abiertas → fila en rose
              return (
                <div key={r.p.id} className={`rounded-lg p-3 grid grid-cols-2 md:grid-cols-12 gap-2 items-center border ${peor ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-slate-200'}`}>
                  <div className="md:col-span-4 flex items-center gap-2 min-w-0">
                    <span className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center tabular-nums flex-shrink-0 ${peor ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{i + 1}</span>
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-slate-900 truncate">{r.p.nombre}</div>
                      <div className="text-[10px] text-slate-500 tabular-nums">{r.ocs} OC{r.ocs === 1 ? '' : 's'} · ${r.gasto >= 1000 ? `${(r.gasto / 1000).toFixed(1)}k` : r.gasto.toFixed(0)}</div>
                    </div>
                  </div>
                  {/* Lead real */}
                  <div className="md:col-span-2 text-center">
                    <div className="md:hidden text-[9px] uppercase tracking-wider text-slate-400 font-bold">Lead real</div>
                    <div className={`text-[13px] font-semibold tabular-nums ${r.lead ? 'text-slate-700' : 'text-slate-300'}`}>{r.lead ? `${Math.round(r.lead.promedio)} días` : '—'}</div>
                  </div>
                  {/* Consistencia (±desviación · REEMPLAZA on-time del mockup · greenfield) */}
                  <div className="md:col-span-2 text-center">
                    <div className="md:hidden text-[9px] uppercase tracking-wider text-slate-400 font-bold">Consistencia</div>
                    <div className={`text-[12px] font-semibold tabular-nums ${r.lead ? 'text-slate-600' : 'text-slate-300'}`}>{r.lead ? `±${r.lead.desviacion.toFixed(1)} d` : '—'}</div>
                  </div>
                  {/* Incidencias abiertas */}
                  <div className="md:col-span-2 text-center">
                    <div className="md:hidden text-[9px] uppercase tracking-wider text-slate-400 font-bold">Incidencias</div>
                    {r.incid == null ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-400">{incidenciasError ? 'sin dato' : '…'}</span>
                    ) : r.incid > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-rose-100 text-rose-700 tabular-nums"><AlertTriangle className="w-2.5 h-2.5" />{r.incid} abierta{r.incid === 1 ? '' : 's'}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 tabular-nums">0 abiertas</span>
                    )}
                  </div>
                  {/* Clasificación SRM */}
                  <div className="md:col-span-2 text-center">
                    <div className="md:hidden text-[9px] uppercase tracking-wider text-slate-400 font-bold">Clasificación</div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${c.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{c.label}
                    </span>
                  </div>
                </div>
              );
            })}
            <div className="text-[10px] text-slate-400 flex items-start gap-1.5 pt-1 px-1">
              <ShieldCheck className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>"Lead real" = tramo despacho→entrega del proveedor (pierna A · sobre tandas con fechas). NO es un SLA pactado: la puntualidad vs ETA objetivo aún no se modela. "Consistencia" = ±desviación de ese mismo lead.</span>
            </div>
          </div>
        )}
      </div>

      {/* Concentración × riesgo SRM · DESGLOSE FORMAL (donut 4 clases) · el Resumen §C tiene el teaser 22% comprimido */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-3">Concentración × riesgo SRM</div>
        {!concentracion.hayClasificacion ? (
          <div className="flex items-center gap-3 text-[12px] text-slate-500">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <span>Sin proveedores evaluados · clasificá proveedores (en Maestros) para ver el riesgo del gasto.</span>
          </div>
        ) : (
          <div className="flex items-center gap-4 flex-wrap">
            <svg viewBox="0 0 36 36" className="w-24 h-24 flex-shrink-0">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.6" />
              {donutSegmentos.map((s) => (
                <circle key={s.key} cx="18" cy="18" r="15.9" fill="none" stroke={s.color} strokeWidth="3.6" strokeDasharray={s.dasharray} strokeDashoffset={s.dashoffset} />
              ))}
              <text x="18" y="20" textAnchor="middle" className="tabular-nums" style={{ fontSize: '4.5px', fontWeight: 700, fill: '#dc2626' }}>{concentracion.pctRiesgo}% riesgo</text>
            </svg>
            <div className="flex-1 min-w-[180px] space-y-1.5 text-[12px]">
              {concentracion.segmentos.map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${s.dot}`} /> {s.label}</span>
                  <span className="tabular-nums font-semibold text-slate-700">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* header + mini-stats */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-[13px] font-bold text-slate-900">Evaluación de proveedores · SRM</div>
          <div className="text-[11px] text-slate-500">desempeño, gasto y clasificación · el detalle y CRUD viven en Maestros</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"><Building2 className="w-3.5 h-3.5 text-blue-600" /><span className="font-semibold text-slate-900 tabular-nums">{stats.total}</span> <span className="text-slate-500">proveedores</span></span>
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"><Award className="w-3.5 h-3.5 text-blue-600" /><span className="font-semibold text-slate-900 tabular-nums">{stats.preferidos}</span> <span className="text-slate-500">preferidos</span></span>
          <span className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"><span className="font-semibold text-slate-900 tabular-nums">${stats.gastoTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span> <span className="text-slate-500">gasto acum.</span></span>
        </div>
      </div>

      {/* filtros clasificación (scroll-x mobile) + buscador */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltroClasif(f.id)}
              className={`whitespace-nowrap text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${filtroClasif === f.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar proveedor, código, país…"
            className="w-full pl-9 pr-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
      </div>

      {/* directorio de cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtrados.map(({ p, gasto, ocs, clasif, puntuacion, leadTime, tasaProblemas }) => {
          const c = CLASIF[clasif ?? 'sin'];
          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-slate-900 truncate">{p.nombre}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="font-mono">{p.codigo}</span>
                      {p.pais && (<><span>·</span><MapPin className="w-3 h-3" /><span>{p.pais}</span></>)}
                    </div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${c.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{c.label}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-[14px] font-bold text-slate-900 tabular-nums">${gasto >= 1000 ? `${(gasto / 1000).toFixed(1)}k` : gasto.toFixed(0)}</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Gasto</div>
                </div>
                <div>
                  <div className="text-[14px] font-bold text-slate-900 tabular-nums flex items-center justify-center gap-0.5"><Package className="w-3 h-3 text-slate-400" />{ocs}</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">OCs</div>
                </div>
                <div>
                  <div className={`text-[14px] font-bold tabular-nums ${leadTime != null ? 'text-slate-900' : 'text-slate-300'}`}>{leadTime != null ? `${Math.round(leadTime)}d` : '—'}</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center justify-center gap-0.5"><Clock className="w-2.5 h-2.5" />Lead</div>
                </div>
                <div>
                  <div className={`text-[14px] font-bold tabular-nums ${tasaProblemas != null ? (tasaProblemas > 10 ? 'text-rose-700' : 'text-slate-900') : 'text-slate-300'}`}>{tasaProblemas != null ? `${Math.round(tasaProblemas)}%` : '—'}</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center justify-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />Incid.</div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                {puntuacion != null ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-600"><Star className="w-3.5 h-3.5 text-amber-500" /><span className="font-bold tabular-nums text-slate-900">{Math.round(puntuacion)}</span>/100</span>
                ) : (
                  <span className="text-[11px] text-slate-400">Sin puntuación SRM</span>
                )}
                <button onClick={() => navigate('/maestros?tab=proveedores')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                  Ver / editar <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
        {filtrados.length === 0 && (
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-8 text-center">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-[12px] text-slate-500">Sin proveedores que coincidan con el filtro</p>
          </div>
        )}
      </div>

    </div>
  );
};
