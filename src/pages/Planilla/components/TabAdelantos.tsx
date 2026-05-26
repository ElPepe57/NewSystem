/**
 * TabAdelantos.tsx
 *
 * chk5.PERSONAS-v5.4 · F10.A · 2026-05-26
 *
 * Refactor canon banking-grade · cards apiladas + KPIs mini + chips estado +
 * 3 modales canon (Nuevo · Aprobar · Rechazar).
 *
 * Reemplaza versión legacy con DataTable + Badge + AdelantoForm.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, DollarSign, Clock, CheckCircle, XCircle, ArrowDownCircle,
  RefreshCw, Filter, Check, X as XIcon,
} from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';
import { usePlanillaStore } from '../../../store/planillaStore';
import { formatCurrencyPEN } from '../../../utils/format';
import {
  TIPO_ADELANTO_LABELS, ESTADO_ADELANTO_LABELS,
} from '../../../types/planilla.types';
import type { AdelantoNomina, EstadoAdelanto } from '../../../types/planilla.types';
import { NuevoAdelantoModal } from '../../../components/modules/planilla/NuevoAdelantoModal';
import { AprobarAdelantoModal } from '../../../components/modules/planilla/AprobarAdelantoModal';
import { RechazarAdelantoModal } from '../../../components/modules/planilla/RechazarAdelantoModal';

/** Chips estado canon */
const ESTADO_CHIP: Record<EstadoAdelanto, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  pagado: 'bg-sky-100 text-sky-700',
  descontado: 'bg-emerald-100 text-emerald-700',
  anulado: 'bg-rose-100 text-rose-700',
};

const ESTADO_ICON: Record<EstadoAdelanto, React.ReactNode> = {
  pendiente: <Clock className="w-2.5 h-2.5" />,
  pagado: <DollarSign className="w-2.5 h-2.5" />,
  descontado: <CheckCircle className="w-2.5 h-2.5" />,
  anulado: <XCircle className="w-2.5 h-2.5" />,
};

const FILTROS_ESTADO: Array<{ id: 'todos' | EstadoAdelanto; label: string; tinte: string }> = [
  { id: 'todos', label: 'Todos', tinte: 'bg-slate-100 text-slate-700' },
  { id: 'pendiente', label: 'Pendientes', tinte: 'bg-amber-100 text-amber-700' },
  { id: 'pagado', label: 'Pagados', tinte: 'bg-sky-100 text-sky-700' },
  { id: 'descontado', label: 'Descontados', tinte: 'bg-emerald-100 text-emerald-700' },
];

function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

export const TabAdelantos: React.FC = () => {
  const toast = useToastStore();
  const { adelantos, loadingAdelantos, fetchAdelantos } = usePlanillaStore();
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoAdelanto>('todos');
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [aprobarAdelanto, setAprobarAdelanto] = useState<AdelantoNomina | null>(null);
  const [rechazarAdelanto, setRechazarAdelanto] = useState<AdelantoNomina | null>(null);

  useEffect(() => {
    fetchAdelantos();
  }, [fetchAdelantos]);

  const stats = useMemo(() => {
    const total = adelantos.length;
    const pendientes = adelantos.filter((a) => a.estado === 'pendiente').length;
    const pagados = adelantos.filter((a) => a.estado === 'pagado').length;
    const descontados = adelantos.filter((a) => a.estado === 'descontado').length;
    const totalPagadoPendienteDescuento = adelantos
      .filter((a) => a.estado === 'pagado')
      .reduce((s, a) => s + a.montoPEN, 0);
    return { total, pendientes, pagados, descontados, totalPagadoPendienteDescuento };
  }, [adelantos]);

  const filtrados = useMemo(() => {
    if (filtroEstado === 'todos') return adelantos;
    return adelantos.filter((a) => a.estado === filtroEstado);
  }, [adelantos, filtroEstado]);

  if (loadingAdelantos && adelantos.length === 0) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-6 h-6 text-amber-500 animate-spin mx-auto mb-2" />
        <p className="text-[12px] text-slate-500">Cargando adelantos...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* §A · KPI mini strip · canon N2 amber */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-amber-50 ring-1 ring-amber-200 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-amber-700">PENDIENTES</div>
          <div className="text-lg font-bold tabular-nums text-amber-900">{stats.pendientes}</div>
          <div className="text-[10px] text-amber-700">requieren aprobación</div>
        </div>
        <div className="bg-sky-50 ring-1 ring-sky-200 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-sky-700">PAGADOS</div>
          <div className="text-lg font-bold tabular-nums text-sky-900">{stats.pagados}</div>
          <div className="text-[10px] text-sky-700">pendiente descuento</div>
        </div>
        <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-emerald-700">DESCONTADOS</div>
          <div className="text-lg font-bold tabular-nums text-emerald-900">{stats.descontados}</div>
          <div className="text-[10px] text-emerald-700">ciclo cerrado</div>
        </div>
        <div className="bg-slate-50 ring-1 ring-slate-200 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-slate-700">A DESCONTAR</div>
          <div className="text-lg font-bold tabular-nums text-slate-900">
            {formatCurrencyPEN(stats.totalPagadoPendienteDescuento)}
          </div>
          <div className="text-[10px] text-slate-500">monto en circulación</div>
        </div>
      </div>

      {/* §B · Header acciones */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-[14px] font-bold text-slate-900">
          {adelantos.length} adelanto{adelantos.length === 1 ? '' : 's'} totales
        </h3>
        <button
          type="button"
          onClick={() => setNuevoOpen(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo adelanto
        </button>
      </div>

      {/* §C · Banner contextual pendientes */}
      {stats.pendientes > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              <strong>{stats.pendientes}</strong> adelanto{stats.pendientes === 1 ? '' : 's'}{' '}
              esperando aprobación · revisalos abajo
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFiltroEstado('pendiente')}
            className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline"
          >
            Ver pendientes →
          </button>
        </div>
      )}

      {/* §D · Chips filtro · canon N6 */}
      {adelantos.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex-shrink-0 inline-flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Estado:
          </span>
          {FILTROS_ESTADO.map((f) => {
            const count = f.id === 'todos' ? adelantos.length : adelantos.filter((a) => a.estado === f.id).length;
            const activo = filtroEstado === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroEstado(f.id)}
                className={`text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
                  activo ? f.tinte : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
                <span className={`text-[9px] ${activo ? 'bg-white/70' : 'bg-slate-100'} px-1 rounded`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* §E · Empty state · canon N9 */}
      {adelantos.length === 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 ring-1 ring-amber-200 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-amber-100 rounded-xl flex items-center justify-center">
            <ArrowDownCircle className="w-6 h-6 text-amber-700" />
          </div>
          <div className="text-[14px] font-bold text-slate-900 mb-1">Sin adelantos registrados</div>
          <p className="text-[12px] text-slate-600 mb-4 max-w-md mx-auto">
            Cuando un empleado solicite un adelanto de sueldo o préstamo, registralo aquí. El
            monto se descuenta automáticamente en la próxima boleta.
          </p>
          <button
            type="button"
            onClick={() => setNuevoOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Registrar primer adelanto
          </button>
        </div>
      )}

      {/* Filtro sin resultados */}
      {adelantos.length > 0 && filtrados.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-center text-[12px] text-slate-500">
          Sin adelantos que coincidan con el filtro "{FILTROS_ESTADO.find((f) => f.id === filtroEstado)?.label}".
        </div>
      )}

      {/* §F · Listado cards apiladas */}
      {filtrados.length > 0 && (
        <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filtrados.map((a) => {
            const init = iniciales(a.empleadoNombre);
            const fecha = a.fecha?.toDate?.();
            return (
              <div key={a.id} className="px-4 py-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Avatar amber */}
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">
                    {init}
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[13px] sm:text-[14px] font-bold text-slate-900">
                        {a.empleadoNombre}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase inline-flex items-center gap-1 ${ESTADO_CHIP[a.estado]}`}
                      >
                        {ESTADO_ICON[a.estado]}
                        {ESTADO_ADELANTO_LABELS[a.estado]}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {a.id} · {TIPO_ADELANTO_LABELS[a.tipo]}
                      {fecha && (
                        <>
                          {' · '}
                          {fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
                        </>
                      )}
                    </div>
                    {a.descripcion && (
                      <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 italic">
                        "{a.descripcion}"
                      </div>
                    )}
                    {a.boletaDescontadaId && (
                      <div className="text-[10px] text-emerald-700 mt-1">
                        ✓ Descontado en {a.boletaDescontadaId}
                      </div>
                    )}
                  </div>

                  {/* Monto + acciones */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">MONTO</div>
                      <div className="text-[14px] sm:text-[15px] font-bold tabular-nums text-amber-900">
                        {formatCurrencyPEN(a.montoPEN)}
                      </div>
                    </div>

                    {/* Acciones contextuales · solo pendientes son accionables */}
                    {a.estado === 'pendiente' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setAprobarAdelanto(a)}
                          className="p-1.5 hover:bg-emerald-50 rounded text-emerald-600"
                          title="Aprobar adelanto"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRechazarAdelanto(a)}
                          className="p-1.5 hover:bg-rose-50 rounded text-rose-600"
                          title="Rechazar adelanto"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modales */}
      <NuevoAdelantoModal
        isOpen={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        onSuccess={(msg) => {
          toast.success(msg);
          fetchAdelantos();
        }}
        onError={(msg) => toast.error(msg)}
      />

      <AprobarAdelantoModal
        isOpen={!!aprobarAdelanto}
        onClose={() => setAprobarAdelanto(null)}
        adelanto={aprobarAdelanto}
        onSuccess={(msg) => {
          toast.success(msg);
          fetchAdelantos();
        }}
        onError={(msg) => toast.error(msg)}
      />

      <RechazarAdelantoModal
        isOpen={!!rechazarAdelanto}
        onClose={() => setRechazarAdelanto(null)}
        adelanto={rechazarAdelanto}
        onSuccess={(msg) => {
          toast.success(msg);
          fetchAdelantos();
        }}
        onError={(msg) => toast.error(msg)}
      />
    </div>
  );
};
