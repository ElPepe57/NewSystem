/**
 * BandejaTab · B1 · el COCKPIT DEL APROBADOR (F4 · capa de medición #4).
 *
 * La cola de aprobación (estado='pendiente') ordenada por PRIORIDAD REAL — demanda comprometida
 * primero, luego SLA crítico, luego prioridad declarada — con un SLA badge por fila que muestra el
 * envejecimiento (`calcularSLA`: la demanda comprometida escala más rápido). El aprobador ve todo
 * en una pantalla; al expandir UNA fila se renderiza inline el `PanelDecisionRequerimiento` (async
 * pesado → solo la expandida). Aprobar/Rechazar son del humano. El sistema RECOMIENDA, no manda.
 *
 * Pixel-perfect del mockup docs/mockups/requerimientos-evolucion-propuesta-v1.html · Acto 2 (Bandeja)
 * + Acto 9 (mobile). Canon DS · chrome BLUE · color semántico en el dato (SLA: slate/amber/rose) ·
 * tabular-nums · lucide. Núcleo SLA PURO en `sla.helper`. Monto vía `esteReqPEN` (panelDecision.helper).
 */
import React, { useMemo, useState } from 'react';
import {
  Inbox, CheckCircle2, TrendingDown, Sparkles, Pencil,
  Clock, X, Check, ChevronUp, BarChart2, Eye, CheckSquare, Square, Layers,
} from 'lucide-react';
import { calcularSLA, type NivelSLA } from './sla.helper';
import { esteReqPEN, resolverLente, type LenteDecision } from './panelDecision.helper';
import { OrigenBadge } from './components/OrigenBadge';
import { DriverChip } from './components/DriverChip';
import { PanelDecisionRequerimiento } from './PanelDecisionRequerimiento';
import type { Requerimiento, PrioridadRequerimiento } from '../../types/requerimiento.types';

interface Props {
  requerimientos: Requerimiento[];
  /** Aprobar (gateado por canApproveRequerimiento en el caller · handleAprobar). */
  onAprobar: (req: Requerimiento) => void;
  /** Abre el modal de rechazo con motivo (B2). */
  onRechazar: (req: Requerimiento) => void;
  /** Abre el DetailModal existente. */
  onVerDetalle: (req: Requerimiento) => void;
  /** Agrupa N reqs seleccionados → flujo consolidado "Generar compra" (OCBuilder). */
  onAgrupar: (reqsIds: string[]) => void;
  /** ¿El usuario puede aprobar/rechazar? (canon · gate del humano). */
  canAprobar: boolean;
}

const fmtPEN = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** Peso de la prioridad declarada (mayor = más urgente) · desempate del orden de mérito. */
const PESO_PRIORIDAD: Record<PrioridadRequerimiento, number> = {
  urgente: 4,
  alta: 3,
  media: 2,
  normal: 1,
  baja: 0,
};

/** Peso del nivel de SLA (mayor = más viejo/urgente). */
const PESO_SLA: Record<NivelSLA, number> = { critico: 2, envejeciendo: 1, fresco: 0 };

/** Ícono + tono del cuadro de la fila, por lente (semántico fijo · espejo del mockup acto 2). */
const ICONO_FILA: Record<LenteDecision, { Icon: React.ComponentType<{ className?: string }>; box: string; icon: string }> = {
  demanda_comprometida: { Icon: CheckCircle2, box: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-600' },
  restock: { Icon: TrendingDown, box: 'bg-amber-50 border-amber-200', icon: 'text-amber-600' },
  apuesta: { Icon: Sparkles, box: 'bg-indigo-50 border-indigo-200', icon: 'text-indigo-600' },
  manual: { Icon: Pencil, box: 'bg-slate-50 border-slate-200', icon: 'text-slate-400' },
};

/** Clases del SLA badge por nivel · fresco=slate · envejeciendo=amber · critico=rose. */
const SLA_BADGE: Record<NivelSLA, string> = {
  fresco: 'bg-slate-100 text-slate-600 border-slate-200',
  envejeciendo: 'bg-amber-100 text-amber-700 border-amber-200',
  critico: 'bg-rose-100 text-rose-700 border-rose-200',
};

/** Resumen del 1º producto + meta (nº req · uds totales). */
function resumenProductos(req: Requerimiento): { nombre: string; meta: string } {
  const prods = req.productos ?? [];
  if (prods.length === 0) return { nombre: 'Sin productos', meta: req.numeroRequerimiento };
  const primero = prods[0];
  const extra = prods.length > 1 ? ` +${prods.length - 1}` : '';
  const uds = prods.reduce((s, p) => s + (p.cantidadSolicitada ?? 0), 0);
  return { nombre: `${primero.nombreComercial}${extra}`, meta: `${uds} un` };
}

export const BandejaTab: React.FC<Props> = ({
  requerimientos, onAprobar, onRechazar, onVerDetalle, onAgrupar, canAprobar,
}) => {
  // Una sola fila expandida a la vez (el panel es async pesado · solo se monta la expandida).
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  // Selección masiva (lote) → "Generar compra con N".
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  // `ahoraMs` capturado UNA vez al montar (initializer · el SLA es estable a nivel de día · el helper
  // recibe Date.now() por contrato). No se recalcula por render → orden estable mientras estás en la tab.
  const [ahoraMs] = useState(() => Date.now());

  // Cola de aprobación: solo pendientes, ordenados por prioridad real.
  const cola = useMemo(() => {
    const pendientes = requerimientos.filter((r) => r.estado === 'pendiente');
    return pendientes
      .map((req) => ({ req, sla: calcularSLA(req, ahoraMs), esComprometida: req.origen === 'demanda_comprometida' }))
      .sort((a, b) => {
        // 1) Demanda comprometida primero (cliente esperando).
        if (a.esComprometida !== b.esComprometida) return a.esComprometida ? -1 : 1;
        // 2) SLA crítico antes (envejecimiento).
        const slaDelta = PESO_SLA[b.sla.nivel] - PESO_SLA[a.sla.nivel];
        if (slaDelta !== 0) return slaDelta;
        // 3) Prioridad declarada.
        const prioDelta = PESO_PRIORIDAD[b.req.prioridad] - PESO_PRIORIDAD[a.req.prioridad];
        if (prioDelta !== 0) return prioDelta;
        // 4) Más viejo primero (desempate estable).
        return b.sla.diasPendiente - a.sla.diasPendiente;
      });
  }, [requerimientos, ahoraMs]);

  const idsSeleccionados = useMemo(() => [...seleccionados], [seleccionados]);

  const toggleSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Empty state · nada pendiente (acto 6) ──────────────────────────────────
  if (cola.length === 0) {
    return (
      <div className="p-4 sm:p-5">
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <Inbox className="w-7 h-7 text-emerald-500" />
          </div>
          <div>
            <div className="text-[14px] font-bold text-emerald-800 mb-1">Nada pendiente de aprobar</div>
            <div className="text-[12px] text-slate-500 leading-snug max-w-[260px] mx-auto">
              Todos los requerimientos activos ya fueron procesados. Bandeja al día.
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Al día
          </div>
          <div className="text-[11px] text-slate-400">Los nuevos reqs de aprobación aparecerán aquí.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar de lote · "Generar compra con N seleccionados" (selección masiva) */}
      {idsSeleccionados.length > 0 && (
        <div className="px-4 py-2.5 border-b border-slate-100 bg-blue-50/60 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-[12px] text-blue-800">
            <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span><b className="tabular-nums">{idsSeleccionados.length}</b> {idsSeleccionados.length === 1 ? 'req seleccionado' : 'reqs seleccionados'}</span>
            <button
              type="button"
              onClick={() => setSeleccionados(new Set())}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
            >
              Limpiar
            </button>
          </div>
          <button
            type="button"
            onClick={() => onAgrupar(idsSeleccionados)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex-shrink-0"
          >
            <Layers className="w-3.5 h-3.5" /> Generar compra con {idsSeleccionados.length} seleccionados
          </button>
        </div>
      )}

      {/* Lista de filas · desktop + mobile comparten el mismo flujo (responsive interno) */}
      <div className="divide-y divide-slate-100">
        {cola.map(({ req, sla }) => {
          const id = req.id ?? req.numeroRequerimiento;
          const lente = resolverLente(req);
          const { Icon, box, icon } = ICONO_FILA[lente];
          const { nombre, meta } = resumenProductos(req);
          const expandido = expandidoId === id;
          const seleccionado = seleccionados.has(id);
          const montoPEN = esteReqPEN(req);
          const slaTexto = sla.esComprometida && sla.nivel === 'critico'
            ? `Pendiente hace ${sla.diasPendiente}d · cliente esperando`
            : `Pendiente hace ${sla.diasPendiente}d`;

          return (
            <div key={id} className="p-4 hover:bg-slate-50/40 transition-colors">
              {/* Cabecera de fila */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                  {/* Checkbox de lote */}
                  <button
                    type="button"
                    onClick={() => toggleSeleccion(id)}
                    className="flex items-center justify-center flex-shrink-0 mt-0.5 text-slate-400 hover:text-blue-600"
                    style={{ minWidth: 20, minHeight: 20 }}
                    aria-label={seleccionado ? 'Quitar de la selección' : 'Seleccionar'}
                  >
                    {seleccionado ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                  </button>

                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${box}`}>
                    <Icon className={`w-4 h-4 ${icon}`} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onVerDetalle(req)}
                        className="text-[13px] font-bold text-slate-900 hover:text-blue-700"
                      >
                        {req.numeroRequerimiento}
                      </button>
                      <OrigenBadge origen={req.origen} subtipo={req.subtipo} size="sm" />
                      {req.driverDemanda && <DriverChip driver={req.driverDemanda} size="sm" />}
                      {/* SLA badge · envejecimiento (color por nivel) */}
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${SLA_BADGE[sla.nivel]}`}>
                        <Clock className="w-2.5 h-2.5" /> {slaTexto}
                      </span>
                    </div>
                    <div className="text-[12px] text-slate-600 mt-0.5 truncate">
                      <span className="font-medium text-slate-800">{nombre}</span> · {meta}
                      {req.nombreClienteSolicitante ? <> · cliente: <span className="font-medium">{req.nombreClienteSolicitante}</span></> : null}
                    </div>
                  </div>
                </div>

                {/* Acciones · touch ≥44px en mobile */}
                <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setExpandidoId(expandido ? null : id)}
                    className="flex items-center justify-center gap-1.5 px-3 text-[12px] font-medium bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 flex-1 sm:flex-none"
                    style={{ minHeight: 36 }}
                  >
                    {expandido
                      ? <><ChevronUp className="w-3.5 h-3.5" /> Ocultar</>
                      : <><Eye className="w-3.5 h-3.5" /> Ver análisis</>}
                  </button>
                  {canAprobar && (
                    <>
                      <button
                        type="button"
                        onClick={() => onRechazar(req)}
                        className="flex items-center justify-center gap-1.5 px-3 text-[12px] font-medium bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 flex-1 sm:flex-none"
                        style={{ minHeight: 36 }}
                      >
                        <X className="w-3.5 h-3.5" /> Rechazar
                      </button>
                      <button
                        type="button"
                        onClick={() => onAprobar(req)}
                        className="flex items-center justify-center gap-1.5 px-3 text-[12px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex-1 sm:flex-none"
                        style={{ minHeight: 36 }}
                      >
                        <Check className="w-3.5 h-3.5" /> Aprobar
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Resumen compacto colapsado · monto + hint (mientras no se expande) */}
              {!expandido && (
                <div className="mt-2 pl-[2.75rem] sm:pl-[3.25rem] flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1">
                    <BarChart2 className="w-3 h-3 text-slate-400" />
                    Monto estimado <span className="tabular-nums font-semibold text-slate-700 ml-0.5">S/ {fmtPEN(montoPEN)}</span>
                  </span>
                  <span className="text-slate-400">— abrí "Ver análisis" para el panel de decisión</span>
                </div>
              )}

              {/* Panel de medición INLINE · solo la fila expandida (async pesado) */}
              {expandido && (
                <div className="mt-3 pl-0 sm:pl-[3.25rem]">
                  <PanelDecisionRequerimiento req={req} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BandejaTab;
