import React, { useMemo, useState } from 'react';
import { Building2, Search, Clock, AlertTriangle, Package, ArrowUpRight, Award, Star, MapPin } from 'lucide-react';
import type { OrdenCompra, Proveedor, ClasificacionProveedor } from '../../../types/ordenCompra.types';

// chk5.COMERCIALES-F3b · Tab Proveedores del hub de Compras · evaluación SRM agregada.
// Directorio con métricas por proveedor (gasto/# OCs en vivo desde las OCs + lead time,
// incidencias, puntuación/clasificación de la evaluación SRM). CRUD → cross-link a Maestros.

interface Props {
  proveedores: Proveedor[];
  ordenes: OrdenCompra[];
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

export const TabProveedoresCompras: React.FC<Props> = ({ proveedores, ordenes, navigate }) => {
  const [filtroClasif, setFiltroClasif] = useState<ClasificacionProveedor | 'todos'>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // gasto + # OCs en vivo desde las OCs (más confiable que metricas denormalizadas)
  const porProveedor = useMemo(() => {
    const map = new Map<string, { gasto: number; ocs: number }>();
    for (const o of ordenes) {
      if (o.estado === 'cancelada' || !o.proveedorId) continue;
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
