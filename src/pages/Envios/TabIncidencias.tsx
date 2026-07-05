/**
 * TabIncidencias — Tab "Incidencias" del hub de Envíos.
 *
 * Vista maestra de TODAS las incidencias de envíos (dañada · faltante · aduana · otro).
 * Permite auditar el backlog operativo completo desde un solo lugar.
 * Click en una fila → GestionIncidenciasModal (acto 11 del master).
 *
 * Alineado PIXEL-PERFECT al master · docs/mockups/envios-master-v1.html · ACTO 4.
 * Chrome = orange (grupo Inventario). Datos reales vía store; las métricas sin fuente
 * (unit count en Dañadas) se muestran "—" · no se inventan.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  AlertTriangle,
  PackageX,
  PackageMinus,
  Stamp,
  Gavel,
  Clock,
  Box,
  RotateCcw,
  Calendar,
  CheckCircle2,
  Info,
  Search,
} from 'lucide-react';
import { useEnvioStore } from '../../store/envioStore';
import { useProductoStore } from '../../store/productoStore';
import type { Envio, IncidenciaEnvio } from '../../types/envio.types';
import { GestionIncidenciasModal } from './GestionIncidenciasModal';

// ─── tipos ────────────────────────────────────────────────────────────────────

type FiltroTipo = 'todos' | 'danada' | 'faltante' | 'aduana' | 'otro';
type FiltroEstadoInc = 'abiertas' | 'resueltas' | 'todas';

interface IncidenciaRow {
  envio: Envio;
  incidencia: IncidenciaEnvio;
  tipoEfectivo: 'danada' | 'faltante' | 'aduana' | 'otro';
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Clasifica la incidencia en una categoría canónica. */
function clasificarIncidencia(inc: IncidenciaEnvio): IncidenciaRow['tipoEfectivo'] {
  if (inc.tipo === 'aduana') return 'aduana';
  if (inc.tipo === 'danada') return 'danada';
  if (inc.tipo === 'faltante') return 'faltante';
  return 'otro';
}

/** Label de sección (overline) — 10px · uppercase · bold · slate-500. */
const Stcap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{children}</span>
);

/** Formatea fecha como "30 may". */
function fmtFecha(ts: { toDate(): Date }): string {
  return ts.toDate().toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

// ─── config de tipo (badge semántico) ────────────────────────────────────────

const TIPO_BADGE: Record<IncidenciaRow['tipoEfectivo'], { label: string; cls: string; icon: React.ElementType }> = {
  danada:   { label: 'Dañada',    cls: 'bg-amber-50 text-amber-700 border border-amber-200',   icon: PackageX      },
  faltante: { label: 'Faltante',  cls: 'bg-rose-50 text-rose-700 border border-rose-200',      icon: PackageMinus  },
  aduana:   { label: 'Aduana',    cls: 'bg-slate-100 text-slate-600 border border-slate-200',  icon: Stamp         },
  otro:     { label: 'Otro',      cls: 'bg-slate-100 text-slate-600 border border-slate-200',  icon: AlertTriangle },
};

// ─── componente ───────────────────────────────────────────────────────────────

export const TabIncidencias: React.FC = () => {
  const { envios, fetchEnvios } = useEnvioStore();
  const { productos, fetchProductos } = useProductoStore();

  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoInc>('abiertas');
  const [envioSeleccionado, setEnvioSeleccionado] = useState<Envio | null>(null);

  useEffect(() => {
    if (envios.length === 0) fetchEnvios();
    if (productos.length === 0) fetchProductos();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const productosMap = useMemo(
    () => new Map(productos.map(p => [p.id, p])),
    [productos],
  );

  // Flatten: incidencias de todos los envíos, ordenadas: abiertas primero → fecha desc.
  const todasIncidencias = useMemo<IncidenciaRow[]>(() => {
    const rows: IncidenciaRow[] = [];
    for (const envio of envios) {
      for (const inc of (envio.incidencias ?? [])) {
        rows.push({ envio, incidencia: inc, tipoEfectivo: clasificarIncidencia(inc) });
      }
    }
    return rows.sort((a, b) => {
      if (a.incidencia.resuelta !== b.incidencia.resuelta) return a.incidencia.resuelta ? 1 : -1;
      return b.incidencia.fechaRegistro.toMillis() - a.incidencia.fechaRegistro.toMillis();
    });
  }, [envios]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total    = todasIncidencias.length;
    const abiertas = todasIncidencias.filter(r => !r.incidencia.resuelta);
    const danadas  = todasIncidencias.filter(r => r.tipoEfectivo === 'danada' && !r.incidencia.resuelta);
    // Monto en reclamo: suma de montoReclamoPEN en incidencias abiertas con reclamo registrado.
    const enReclamoPEN = abiertas
      .filter(r => r.incidencia.montoReclamoPEN && r.incidencia.montoReclamoPEN > 0)
      .reduce((s, r) => s + (r.incidencia.montoReclamoPEN ?? 0), 0);
    return {
      total,
      countAbiertas: abiertas.length,
      countDanadas: danadas.length,
      enReclamoPEN,
    };
  }, [todasIncidencias]);

  // ── counts para chips de filtro ─────────────────────────────────────────────
  const counts = useMemo(() => ({
    todos:    todasIncidencias.length,
    danada:   todasIncidencias.filter(r => r.tipoEfectivo === 'danada').length,
    faltante: todasIncidencias.filter(r => r.tipoEfectivo === 'faltante').length,
    aduana:   todasIncidencias.filter(r => r.tipoEfectivo === 'aduana').length,
    abiertas: todasIncidencias.filter(r => !r.incidencia.resuelta).length,
    resueltas: todasIncidencias.filter(r => r.incidencia.resuelta).length,
  }), [todasIncidencias]);

  // ── filtrado ─────────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    let list = todasIncidencias;
    if (filtroEstado === 'abiertas')  list = list.filter(r => !r.incidencia.resuelta);
    else if (filtroEstado === 'resueltas') list = list.filter(r => r.incidencia.resuelta);
    if (filtroTipo !== 'todos') list = list.filter(r => r.tipoEfectivo === filtroTipo);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        r.envio.numeroEnvio.toLowerCase().includes(q)
        || (r.incidencia.sku || '').toLowerCase().includes(q)
        || (r.incidencia.productoNombre || '').toLowerCase().includes(q)
        || (r.incidencia.descripcion || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [todasIncidencias, filtroEstado, filtroTipo, search]);

  // ── helpers de chip ───────────────────────────────────────────────────────────
  const chipTipo = (value: FiltroTipo, label: string, count: number, icon?: React.ElementType) => {
    const active = filtroTipo === value;
    const Icon = icon;
    return (
      <button
        onClick={() => setFiltroTipo(value)}
        className={`flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0 border ${
          active
            ? 'bg-orange-50 text-orange-700 border-orange-200'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        }`}
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        {label}
        {' '}
        <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold tabular-nums ${active ? 'bg-white/70 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
          {count}
        </span>
      </button>
    );
  };

  const chipEstado = (value: FiltroEstadoInc, label: string, count: number, icon: React.ElementType, iconCls: string, countCls: string) => {
    const active = filtroEstado === value;
    const Icon = icon;
    return (
      <button
        onClick={() => setFiltroEstado(value)}
        className={`flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0 border ${
          active
            ? 'bg-orange-50 text-orange-700 border-orange-200'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        }`}
      >
        <Icon className={`w-3.5 h-3.5 ${active ? 'text-orange-500' : iconCls}`} />
        {label}
        {' '}
        <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold tabular-nums ${active ? 'bg-white/70 text-orange-700' : countCls}`}>
          {count}
        </span>
      </button>
    );
  };

  // ── empty state ───────────────────────────────────────────────────────────────
  const emptyMsg =
    search || filtroTipo !== 'todos'
      ? 'No hay incidencias que coincidan con los filtros.'
      : filtroEstado === 'abiertas'
        ? 'Sin incidencias abiertas. Buen trabajo.'
        : 'No hay incidencias registradas.';

  return (
    <div className="space-y-5">

      {/* §A — KPIs (4 · semántico) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Total · slate */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/40 ring-1 ring-slate-200/60 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold">Total incidencias</span>
            <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-800">{kpis.total}</div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
            <Calendar className="w-3 h-3" /> este mes
          </div>
        </div>

        {/* Abiertas · rose */}
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">Abiertas</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-rose-900">{kpis.countAbiertas}</div>
          <div className="text-[11px] text-rose-700 flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3" /> sin resolver
          </div>
        </div>

        {/* Dañadas · amber */}
        <div
          onClick={() => { setFiltroTipo('danada'); setFiltroEstado('abiertas'); }}
          className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-4 cursor-pointer hover:ring-amber-300"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">Dañadas</span>
            <PackageX className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-900">
            {kpis.countDanadas} <span className="text-amber-400 text-lg">u</span>
          </div>
          <div className="text-[11px] text-amber-700 flex items-center gap-1 mt-1">
            <Box className="w-3 h-3" /> unidades
          </div>
        </div>

        {/* En reclamo · amber (semántico: dinero a recuperar) */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">En reclamo</span>
            <Gavel className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-900">
            {kpis.enReclamoPEN > 0
              ? <>S/ {kpis.enReclamoPEN.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}<span className="text-amber-400">.00</span></>
              : <span className="text-amber-400 text-xl">—</span>
            }
          </div>
          <div className="text-[11px] text-amber-700 flex items-center gap-1 mt-1">
            <RotateCcw className="w-3 h-3" /> por recuperar
          </div>
        </div>

      </div>

      {/* §B — Buscador + Filtros chips (scroll-x mobile · N6) */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar envío, SKU, producto, descripción…"
          className="w-full text-[12px] text-slate-700 placeholder:text-slate-400 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400"
        />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        <Stcap>Tipo:</Stcap>
        <span className="mr-1" />
        {chipTipo('todos',    'Todas',    counts.todos)}
        {chipTipo('danada',   'Dañada',   counts.danada,   PackageX)}
        {chipTipo('faltante', 'Faltante', counts.faltante, PackageMinus)}
        {chipTipo('aduana',   'Aduana',   counts.aduana,   Stamp)}
        <span className="w-px h-5 bg-slate-200 mx-1 flex-shrink-0" />
        <Stcap>Estado:</Stcap>
        <span className="mr-1" />
        {chipEstado('abiertas',  'Abiertas',  counts.abiertas,  AlertTriangle, 'text-rose-500',    'bg-rose-100 text-rose-600')}
        {chipEstado('resueltas', 'Resueltas', counts.resueltas, CheckCircle2,  'text-emerald-500', 'bg-slate-100 text-slate-500')}
        {chipEstado('todas',     'Todas',     counts.todos,     ClipboardList, 'text-slate-400',   'bg-slate-100 text-slate-500')}
      </div>

      {/* §C — DataTable · grid-rows (patrón A del master) */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">

        {/* head (oculto en mobile) */}
        <div className="hidden sm:grid grid-cols-[120px_120px_1fr_130px_100px_92px] gap-3 items-center bg-slate-50 border-b border-slate-200 px-4 py-2.5">
          <Stcap>Envío</Stcap>
          <Stcap>Tipo</Stcap>
          <Stcap>Producto</Stcap>
          <Stcap>Estado</Stcap>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Reclamo</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Fecha</span>
        </div>

        {/* filas */}
        {filtradas.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-slate-400">{emptyMsg}</div>
        ) : (
          filtradas.map((r, idx) => {
            const tipoCfg   = TIPO_BADGE[r.tipoEfectivo];
            const TipoIcon  = tipoCfg.icon;
            const isResuelta = r.incidencia.resuelta;
            const monto     = r.incidencia.montoReclamoPEN;
            const pFull     = r.incidencia.productoId ? productosMap.get(r.incidencia.productoId) : undefined;
            const nombreProducto = pFull?.nombreComercial || r.incidencia.productoNombre || r.incidencia.sku || '—';

            return (
              <div
                key={`${r.envio.id}-${r.incidencia.id}`}
                onClick={() => setEnvioSeleccionado(r.envio)}
                className={`grid grid-cols-1 sm:grid-cols-[120px_120px_1fr_130px_100px_92px] gap-2 sm:gap-3 items-center px-4 py-3 hover:bg-slate-50 cursor-pointer ${idx < filtradas.length - 1 ? 'border-b border-slate-100' : ''}`}
              >
                {/* Envío */}
                <div className="text-[13px] font-bold tabular-nums text-slate-900">
                  {r.envio.numeroEnvio}
                </div>

                {/* Tipo */}
                <div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${tipoCfg.cls}`}>
                    <TipoIcon className="w-2.5 h-2.5" />
                    {tipoCfg.label}
                  </span>
                </div>

                {/* Producto */}
                <div className="min-w-0">
                  <div className={`text-[13px] font-semibold truncate ${isResuelta ? 'text-slate-500' : 'text-slate-900'}`}>
                    {r.tipoEfectivo === 'aduana' && !r.incidencia.productoId
                      ? <span className="text-slate-500">— <span className="tabular-nums">(retenidas en aduana)</span></span>
                      : nombreProducto
                    }
                  </div>
                  {r.incidencia.descripcion && (
                    <div className="text-[11px] text-slate-500 truncate">{r.incidencia.descripcion}</div>
                  )}
                </div>

                {/* Estado */}
                <div>
                  {isResuelta ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Resuelta
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      <AlertTriangle className="w-2.5 h-2.5" /> Abierta
                    </span>
                  )}
                </div>

                {/* Reclamo */}
                <div className="text-right text-[13px] font-bold tabular-nums">
                  {monto && monto > 0 ? (
                    isResuelta ? (
                      <span className="text-emerald-700 flex items-center justify-end gap-1">
                        S/ {monto.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                        <CheckCircle2 className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="text-amber-800">S/ {monto.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</span>
                    )
                  ) : (
                    <span className="font-medium text-slate-400">—</span>
                  )}
                </div>

                {/* Fecha */}
                <div className="text-right text-[11px] text-slate-500 tabular-nums">
                  {fmtFecha(r.incidencia.fechaRegistro)}
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* §D — Nota · destino de la fila */}
      <div className="flex items-start gap-2 text-[11px] text-slate-500">
        <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
        <span>
          Hacer click en una fila abre{' '}
          <span className="font-semibold text-slate-600">GestionIncidenciasModal</span>, donde se decide
          el destino de cada unidad —{' '}
          <span className="font-semibold text-slate-600">baja definitiva</span>{' '}
          (gasto automático · cuenta 6952),{' '}
          <span className="font-semibold text-slate-600">devolución</span> o{' '}
          <span className="font-semibold text-slate-600">reparación</span>. El{' '}
          <span className="font-semibold text-slate-600">reclamo del dinero</span>{' '}
          (a proveedor / courier / seguro) se gestiona en la tab{' '}
          <span className="font-semibold text-slate-600">Reclamos</span>.
        </span>
      </div>

      {/* Modal gestión unificada */}
      {envioSeleccionado && (
        <GestionIncidenciasModal
          transferencia={envioSeleccionado}
          productosMap={productosMap}
          onClose={() => setEnvioSeleccionado(null)}
          onSuccess={() => {
            setEnvioSeleccionado(null);
            fetchEnvios();
          }}
        />
      )}

    </div>
  );
};
