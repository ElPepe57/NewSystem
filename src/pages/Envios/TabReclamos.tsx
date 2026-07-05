/**
 * TabReclamos — Tab "Reclamos" del hub de Envíos.
 *
 * Alineado PIXEL-PERFECT al master · docs/mockups/envios-master-v1.html · ACTO 5.
 * Chrome = orange (grupo Inventario). Datos reales vía reclamoStore.
 * Métricas sin fuente directa en ResumenReclamos (montoEnDisputa · countAceptados)
 * se derivan del array `reclamos` vía useMemo — empty-state honesto "—" donde
 * realmente no hay fuente.
 *
 * Funcionalidad preservada:
 *   - fetchReclamos + fetchResumen al montar
 *   - Filtro estado (chips scroll-x) + filtro destinatario (chips scroll-x)
 *   - Búsqueda libre (número · envío · destinatario · notas)
 *   - Drill → ReclamoPanel (click en fila)
 *   - Reload tras acción exitosa en ReclamoPanel
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Download,
  Gavel,
  Clock,
  Scale,
  Handshake,
  BadgeCheck,
  Send,
  PackageX,
  AlertCircle,
  Stamp,
  Shield,
  Building2,
  Bike,
  TrendingUp,
  CheckCircle2,
  Check,
  Info,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { useReclamoStore } from '../../store/reclamoStore';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/format';
import type {
  Reclamo,
  EstadoReclamo,
  TipoReclamo,
  DestinatarioReclamo,
} from '../../types/reclamo.types';
import { ReclamoPanel } from '../../components/modules/envio/ReclamoPanel';

// ─── helpers ──────────────────────────────────────────────────────────────────

const Stcap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{children}</span>
);

// Semántico de estado → badge colors (nunca chrome orange)
const ESTADO_BADGE: Record<EstadoReclamo, { bg: string; text: string; border: string; Icon: React.ElementType }> = {
  borrador:           { bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-200',  Icon: Wrench },
  enviado:            { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',  Icon: Send },
  en_disputa:         { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',  Icon: Scale },
  aceptado:           { bg: 'bg-sky-50',      text: 'text-sky-700',     border: 'border-sky-200',    Icon: Handshake },
  cobrado:            { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', Icon: BadgeCheck },
  rechazado:          { bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-200',   Icon: AlertCircle },
  cerrado_sin_cobrar: { bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-200',  Icon: CheckCircle2 },
};

const ESTADO_LABEL: Record<EstadoReclamo, string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  en_disputa: 'En disputa',
  aceptado: 'Aceptado',
  cobrado: 'Cobrado',
  rechazado: 'Rechazado',
  cerrado_sin_cobrar: 'Cerrado',
};

const TIPO_BADGE: Record<TipoReclamo, { bg: string; text: string; border: string; label: string; Icon: React.ElementType }> = {
  danada:         { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  label: 'Dañada',  Icon: PackageX },
  perdida:        { bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-200',   label: 'Perdida', Icon: AlertCircle },
  aduana_timeout: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', label: 'Aduana',  Icon: Stamp },
  otro:           { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200',  label: 'Otro',    Icon: Info },
};

const DESTINATARIO_ICON: Record<DestinatarioReclamo, React.ElementType> = {
  proveedor: Building2,
  courier:   Bike,
  seguro:    Shield,
  otro:      Info,
};

const DESTINATARIO_LABEL: Record<DestinatarioReclamo, string> = {
  proveedor: 'Proveedor',
  courier:   'Courier',
  seguro:    'Seguro',
  otro:      'Otro',
};

// ─── tipos de filtro ──────────────────────────────────────────────────────────

type FiltroEstado = 'todos' | 'enviado' | 'en_disputa' | 'aceptado' | 'cobrado' | 'cerrado';
type FiltroDestinatario = 'todos' | DestinatarioReclamo;

// ─── componente ───────────────────────────────────────────────────────────────

export const TabReclamos: React.FC = () => {
  const { user } = useAuthStore();
  const { reclamos, resumen, loading, fetchReclamos, fetchResumen } = useReclamoStore();

  const [search, setSearch]                   = useState('');
  const [filtroEstado, setFiltroEstado]       = useState<FiltroEstado>('todos');
  const [filtroDestinatario, setFiltroDestinatario] = useState<FiltroDestinatario>('todos');
  const [reclamoSeleccionado, setReclamoSeleccionado] = useState<Reclamo | null>(null);

  useEffect(() => {
    fetchReclamos();
    fetchResumen();
  }, [fetchReclamos, fetchResumen]);

  // ── KPIs derivados del array (lo que ResumenReclamos no provee individualmente) ──
  const kpiDerivados = useMemo(() => {
    const enDisputa      = reclamos.filter(r => r.estado === 'en_disputa');
    const aceptados      = reclamos.filter(r => r.estado === 'aceptado');
    return {
      montoEnDisputaPEN: enDisputa.reduce((s, r) => s + r.montoReclamadoPEN, 0),
      countAceptados:    aceptados.length,
    };
  }, [reclamos]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const reclamosFiltrados = useMemo(() => {
    let list = reclamos;

    if (filtroEstado === 'enviado') {
      list = list.filter(r => r.estado === 'enviado');
    } else if (filtroEstado === 'en_disputa') {
      list = list.filter(r => r.estado === 'en_disputa');
    } else if (filtroEstado === 'aceptado') {
      list = list.filter(r => r.estado === 'aceptado');
    } else if (filtroEstado === 'cobrado') {
      list = list.filter(r => r.estado === 'cobrado');
    } else if (filtroEstado === 'cerrado') {
      list = list.filter(r => r.estado === 'rechazado' || r.estado === 'cerrado_sin_cobrar');
    }
    // 'todos' → no filter

    if (filtroDestinatario !== 'todos') {
      list = list.filter(r => r.destinatario === filtroDestinatario);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        r.numeroReclamo.toLowerCase().includes(q)
        || r.envioNumero?.toLowerCase().includes(q)
        || r.ordenCompraNumero?.toLowerCase().includes(q)
        || r.destinatarioNombre?.toLowerCase().includes(q)
        || r.notas?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [reclamos, filtroEstado, filtroDestinatario, search]);

  // conteo para chip activo "Todos"
  const totalVisible = reclamosFiltrados.length;

  return (
    <div className="space-y-5">

      {/* §A — Callout amber · estado honesto (parcial) */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-100/30 ring-1 ring-amber-200/60 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Wrench className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-amber-900 flex items-center gap-2">
            Estado de la tab{' '}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Parcial
            </span>
          </div>
          <div className="text-[12px] text-amber-800/90 leading-snug mt-0.5">
            La <span className="font-semibold">DATA existe</span> — los reclamos derivan de{' '}
            <code className="text-[11px] bg-amber-100/60 px-1 py-0.5 rounded">envio.incidencias[]</code>{' '}
            con <code className="text-[11px] bg-amber-100/60 px-1 py-0.5 rounded">montoReclamoPEN</code> y destinatario.
            El gap es de <span className="font-semibold">chrome</span>: la vista usa primitivas{' '}
            <code className="text-[11px] bg-amber-100/60 px-1 py-0.5 rounded">common/</code> (Badge · Button · SearchInput)
            y la resolución abre un <code className="text-[11px] bg-amber-100/60 px-1 py-0.5 rounded">Modal</code> legacy → migrar a kit DS + FormModalV2.
          </div>
        </div>
      </div>

      {/* §B — KPI strip · 5 cards · semántico */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

        {/* Total · slate */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/40 ring-1 ring-slate-200/60 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total reclamos</span>
            <Gavel className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900">
            {loading ? '—' : (resumen?.totalReclamos ?? reclamos.length).toLocaleString('es-PE')}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3" /> histórico
          </div>
        </div>

        {/* Pendientes · amber */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">Pendientes</span>
            <Clock className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-900">
            {loading ? '—' : (resumen?.reclamosPendientes ?? 0).toLocaleString('es-PE')}
          </div>
          <div className="text-[11px] text-amber-700 flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3" /> sin respuesta
          </div>
        </div>

        {/* En disputa · amber (semántico: dinero/reclamo por recuperar) */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">En disputa</span>
            <Scale className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-900">
            {loading
              ? '—'
              : kpiDerivados.montoEnDisputaPEN > 0
                ? formatCurrency(kpiDerivados.montoEnDisputaPEN, 'PEN')
                : '—'
            }
          </div>
          <div className="text-[11px] text-amber-700 flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3" /> por recuperar
          </div>
        </div>

        {/* Aceptados · sky */}
        <div className="bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">Aceptados</span>
            <Handshake className="w-3.5 h-3.5 text-sky-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-sky-900">
            {loading ? '—' : kpiDerivados.countAceptados.toLocaleString('es-PE')}
          </div>
          <div className="text-[11px] text-sky-700 flex items-center gap-1 mt-1">
            <Check className="w-3 h-3" /> por cobrar
          </div>
        </div>

        {/* Cobrados · emerald */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Cobrados</span>
            <BadgeCheck className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">
            {loading
              ? '—'
              : resumen
                ? formatCurrency(resumen.totalCobradoPEN, 'PEN')
                : '—'
            }
          </div>
          <div className="text-[11px] text-emerald-700 flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" /> recuperados
          </div>
        </div>

      </div>

      {/* §C — Toolbar: búsqueda + exportar neutral */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar reclamo, envío, destinatario…"
            className="w-full text-[12px] text-slate-700 placeholder:text-slate-400 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400"
          />
        </div>
        <button className="flex items-center gap-1.5 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 text-[12px] font-semibold px-3.5 py-2 rounded-lg shadow-sm flex-shrink-0">
          <Download className="w-4 h-4" /> Exportar
        </button>
      </div>

      {/* §D — Chips filtro scroll-x (chrome orange para activo) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {/* Estado */}
        <Stcap>Estado:</Stcap>
        <span className="flex-shrink-0 mr-1" />

        {/* chip Todos */}
        <button
          onClick={() => setFiltroEstado('todos')}
          className={`flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0 border transition-colors ${
            filtroEstado === 'todos'
              ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Todos{' '}
          {filtroEstado === 'todos' && (
            <span className="text-[10px] bg-white/70 text-orange-700 rounded-full px-1.5 py-0.5 font-bold tabular-nums">
              {totalVisible}
            </span>
          )}
        </button>

        {/* chip Enviado */}
        <button
          onClick={() => setFiltroEstado(filtroEstado === 'enviado' ? 'todos' : 'enviado')}
          className={`flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0 border transition-colors ${
            filtroEstado === 'enviado'
              ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Send className="w-3.5 h-3.5 text-slate-400" /> Enviado
        </button>

        {/* chip En disputa */}
        <button
          onClick={() => setFiltroEstado(filtroEstado === 'en_disputa' ? 'todos' : 'en_disputa')}
          className={`flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0 border transition-colors ${
            filtroEstado === 'en_disputa'
              ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Scale className="w-3.5 h-3.5 text-slate-400" /> En disputa
        </button>

        {/* separator */}
        <span className="w-px h-5 bg-slate-200 flex-shrink-0 mx-1" />

        {/* Para: label */}
        <Stcap>Para:</Stcap>
        <span className="flex-shrink-0 mr-1" />

        {/* chip Proveedor */}
        <button
          onClick={() => setFiltroDestinatario(filtroDestinatario === 'proveedor' ? 'todos' : 'proveedor')}
          className={`flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0 border transition-colors ${
            filtroDestinatario === 'proveedor'
              ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-slate-400" /> Proveedor
        </button>

        {/* chip Courier */}
        <button
          onClick={() => setFiltroDestinatario(filtroDestinatario === 'courier' ? 'todos' : 'courier')}
          className={`flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0 border transition-colors ${
            filtroDestinatario === 'courier'
              ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Bike className="w-3.5 h-3.5 text-slate-400" /> Courier
        </button>

        {/* chip Seguro */}
        <button
          onClick={() => setFiltroDestinatario(filtroDestinatario === 'seguro' ? 'todos' : 'seguro')}
          className={`flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0 border transition-colors ${
            filtroDestinatario === 'seguro'
              ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-slate-400" /> Seguro
        </button>
      </div>

      {/* §E — DataTable grid (patrón master ACTO 5) */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">

        {/* head · oculto en mobile */}
        <div className="hidden sm:grid grid-cols-[110px_100px_1fr_120px_100px_130px] gap-3 items-center bg-slate-50 border-b border-slate-200 px-4 py-2.5">
          <Stcap>Reclamo</Stcap>
          <Stcap>Envío</Stcap>
          <Stcap>Destinatario</Stcap>
          <Stcap>Tipo</Stcap>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Monto</span>
          <Stcap>Estado</Stcap>
        </div>

        {/* loading skeleton */}
        {loading && (
          <div className="px-4 py-8 text-center text-[12px] text-slate-400">Cargando reclamos…</div>
        )}

        {/* empty state */}
        {!loading && reclamosFiltrados.length === 0 && (
          <div className="px-4 py-8 text-center text-[12px] text-slate-400">
            {search || filtroEstado !== 'todos' || filtroDestinatario !== 'todos'
              ? 'No hay reclamos que coincidan con los filtros.'
              : 'No hay reclamos registrados. Se crean desde un envío con incidencias.'}
          </div>
        )}

        {/* filas */}
        {!loading && reclamosFiltrados.map((r, idx) => {
          const estadoBadge = ESTADO_BADGE[r.estado];
          const EstadoIcon  = estadoBadge.Icon;
          const tipoBadge   = TIPO_BADGE[r.tipo];
          const TipoIcon    = tipoBadge.Icon;
          const DestIcon    = DESTINATARIO_ICON[r.destinatario];
          const isLast      = idx === reclamosFiltrados.length - 1;

          return (
            <div
              key={r.id}
              onClick={() => setReclamoSeleccionado(r)}
              className={`grid grid-cols-1 sm:grid-cols-[110px_100px_1fr_120px_100px_130px] gap-2 sm:gap-3 sm:items-center px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                isLast ? '' : 'border-b border-slate-100'
              }`}
            >
              {/* Número de reclamo */}
              <div>
                <div className="flex items-center gap-1.5">
                  <Gavel className="w-3.5 h-3.5 text-slate-400 sm:hidden" />
                  <span className="text-[13px] font-bold tabular-nums text-slate-900">{r.numeroReclamo}</span>
                </div>
                <div className="text-[10px] text-slate-400 tabular-nums">
                  {r.fechaCreacion.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                </div>
              </div>

              {/* Envío */}
              <div className="text-[12px] font-semibold tabular-nums text-slate-600">
                {r.envioNumero ?? '—'}
                {r.ordenCompraNumero && <div className="text-[10px] text-slate-400">{r.ordenCompraNumero}</div>}
              </div>

              {/* Destinatario */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[12px] text-slate-700 truncate">
                  <DestIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="font-medium truncate">{r.destinatarioNombre}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {DESTINATARIO_LABEL[r.destinatario]} · {r.cantidadUnidades} ud{r.cantidadUnidades !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Tipo */}
              <div>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${tipoBadge.bg} ${tipoBadge.text} ${tipoBadge.border}`}>
                  <TipoIcon className="w-2.5 h-2.5" /> {tipoBadge.label}
                </span>
              </div>

              {/* Monto */}
              <div className="text-left sm:text-right">
                {r.estado === 'cobrado' && r.montoCobradoPEN !== undefined ? (
                  <span className="text-[13px] font-bold tabular-nums text-emerald-800">
                    {formatCurrency(r.montoCobradoPEN, 'PEN')}
                  </span>
                ) : (
                  <span className="text-[13px] font-bold tabular-nums text-slate-900">
                    {formatCurrency(r.montoReclamadoPEN, 'PEN')}
                  </span>
                )}
                {r.montoAcordadoPEN !== undefined && r.montoCobradoPEN === undefined && (
                  <div>
                    <span className="text-[11px] text-amber-700 tabular-nums">Acordado: {formatCurrency(r.montoAcordadoPEN, 'PEN')}</span>
                  </div>
                )}
              </div>

              {/* Estado */}
              <div>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${estadoBadge.bg} ${estadoBadge.text} ${estadoBadge.border}`}>
                  <EstadoIcon className="w-2.5 h-2.5" /> {ESTADO_LABEL[r.estado]}
                </span>
              </div>
            </div>
          );
        })}

      </div>

      {/* §F — Nota drill */}
      <div className="flex items-start gap-2 text-[11px] text-slate-500">
        <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
        <span>
          Click en una fila abre <span className="font-semibold text-slate-600">ResolverReclamoModal</span>: decide la vía de recuperación —{' '}
          <span className="font-semibold text-slate-600">reembolso</span>,{' '}
          <span className="font-semibold text-slate-600">reemplazo</span> (crea tanda) o{' '}
          <span className="font-semibold text-slate-600">merma</span>. El reclamo nace desde una incidencia (tab Incidencias) · su monto en disputa es plata a recuperar del proveedor, courier o seguro.
        </span>
      </div>

      {/* Nota canon no-redundancia */}
      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
        Canon no-redundancia: los KPIs de esta tab miden el{' '}
        <span className="mx-0.5">EMBUDO de recuperación</span> (enviado → disputa → cobrado), no el conteo de incidencias del strip del shell — aportan el estado de la cobranza a terceros que el shell no da.
      </p>

      {/* Drill modal */}
      {reclamoSeleccionado && user && (
        <ReclamoPanel
          reclamo={reclamoSeleccionado}
          userId={user.uid}
          onClose={() => setReclamoSeleccionado(null)}
          onSuccess={() => {
            fetchReclamos();
            fetchResumen();
          }}
        />
      )}

    </div>
  );
};
