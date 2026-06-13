/**
 * src/components/modules/usuarios/TabInvitaciones.tsx
 * 2026-06-13 · Tab del hub /usuarios · ciclo de vida + métricas de invitaciones.
 *
 * Reemplaza la sección "7.2 · Invitaciones activas" que vivía enterrada en
 * Configuración. Canon:
 *   - HUB: tab = función distinta (ciclo de vida propio enviada→aceptada/expirada).
 *   - DS: nace del kit (KPI strip semántico N1/N2 + DataCard) · color violet del grupo.
 *   - No-redundancia: aporta lo que ningún otro lado da (conversión + histórico).
 *   - Refetch silencioso: useAsyncData (no desmonta al re-enviar/cancelar).
 */
import { useMemo, useState } from 'react';
import {
  Mail, Clock, CheckCircle2, XCircle, TrendingUp, Send, Ban,
  MailPlus, Shield, Inbox, AlertCircle, Loader2,
} from 'lucide-react';
import { invitacionService } from '../../../services/invitacion.service';
import { useAsyncData } from '../../../hooks/useAsyncData';
import type { Invitacion, InvitacionEstado } from '../../../types/invitacion.types';
import { INVITACION_ESTADO_LABELS } from '../../../types/invitacion.types';
import { ROLE_LABELS } from '../../../types/auth.types';
import { DataCard } from '../../../design-system';
import type { StatusVariant } from '../../../design-system/tokens';

// estado → variant del DataCard/StatusBadge (paleta SEMÁNTICA fija · no el color del módulo)
const ESTADO_VARIANT: Record<InvitacionEstado, StatusVariant> = {
  enviada: 'warning',     // amber · esperando respuesta
  link_abierto: 'info',   // sky · vio el email, aún no aceptó
  aceptada: 'success',    // emerald · cuenta activa
  expirada: 'neutral',    // slate · venció sin aceptar
  cancelada: 'danger',    // rose · admin canceló
};

// clases literales por color (Tailwind JIT no detecta clases dinámicas)
const KPI_C = {
  slate:   { grad: 'from-slate-50 to-slate-100/40',   ring: 'ring-slate-200/50',   fg: 'text-slate-700',   val: 'text-slate-900' },
  amber:   { grad: 'from-amber-50 to-amber-100/40',   ring: 'ring-amber-200/50',   fg: 'text-amber-700',   val: 'text-amber-900' },
  emerald: { grad: 'from-emerald-50 to-emerald-100/40', ring: 'ring-emerald-200/50', fg: 'text-emerald-700', val: 'text-emerald-900' },
} as const;

type Filtro = 'todas' | InvitacionEstado;

interface Props {
  /** Abre el modal "Invitar por email" del shell (Usuarios → setInvitarOpen). */
  onInvitar: () => void;
}

function textoFecha(inv: Invitacion): string {
  if (inv.estado === 'aceptada' && inv.fechaAceptacion) {
    return `Aceptada el ${inv.fechaAceptacion.toDate().toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}`;
  }
  if (inv.estado === 'cancelada' && inv.fechaCancelacion) {
    return `Cancelada el ${inv.fechaCancelacion.toDate().toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}`;
  }
  if (inv.estado === 'enviada' || inv.estado === 'link_abierto') {
    const dias = invitacionService.diasHastaExpiracion(inv);
    return dias > 0 ? `Expira en ${dias}d` : 'Expira hoy';
  }
  return `Enviada el ${inv.fechaEnvio.toDate().toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}`;
}

export default function TabInvitaciones({ onInvitar }: Props) {
  const { data, loading, error, refetch } = useAsyncData(() => invitacionService.listAll());
  const invitaciones = data ?? [];
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [accionId, setAccionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Métricas sobre TODAS las invitaciones ──
  const m = useMemo(() => {
    const by = (e: InvitacionEstado) => invitaciones.filter((i) => i.estado === e).length;
    const enviadas = invitaciones.length;
    const enEspera = by('enviada') + by('link_abierto');
    const aceptadas = by('aceptada');
    const expiradas = by('expirada');
    const canceladas = by('cancelada');
    // Conversión = aceptadas / resueltas · resueltas = ya decididas (no en espera, no canceladas)
    const resueltas = aceptadas + expiradas;
    const conversion = resueltas > 0 ? Math.round((aceptadas / resueltas) * 100) : 0;
    return { enviadas, enEspera, aceptadas, expiradas, canceladas, enviada: by('enviada'), link_abierto: by('link_abierto'), conversion };
  }, [invitaciones]);

  const visibles = useMemo(
    () => (filtro === 'todas' ? invitaciones : invitaciones.filter((i) => i.estado === filtro)),
    [invitaciones, filtro],
  );

  const esActiva = (e: InvitacionEstado) => e === 'enviada' || e === 'link_abierto';

  const ejecutar = async (id: string, fn: () => Promise<void>, okMsg: string) => {
    setAccionId(id);
    setFeedback(null);
    try {
      await fn();
      setFeedback({ msg: okMsg, ok: true });
      await refetch(); // silencioso · no desmonta
    } catch (err) {
      setFeedback({ msg: err instanceof Error ? err.message : 'Error en la operación', ok: false });
    } finally {
      setAccionId(null);
    }
  };

  const KPIS = [
    { label: 'Enviadas',   value: m.enviadas,            color: 'slate',   icon: Mail,         sub: 'histórico total' },
    { label: 'En espera',  value: m.enEspera,            color: 'amber',   icon: Clock,        sub: 'sin responder' },
    { label: 'Aceptadas',  value: m.aceptadas,           color: 'emerald', icon: CheckCircle2, sub: 'cuentas activas' },
    { label: 'Expiradas',  value: m.expiradas,           color: 'slate',   icon: XCircle,      sub: 'vencidas 7d' },
    { label: 'Conversión', value: `${m.conversion}%`,    color: 'emerald', icon: TrendingUp,   sub: 'aceptadas / resueltas' },
  ] as const;

  const FILTROS: Array<{ id: Filtro; label: string; count: number }> = [
    { id: 'todas',        label: 'Todas',       count: m.enviadas },
    { id: 'enviada',      label: 'Enviadas',    count: m.enviada },
    { id: 'link_abierto', label: 'Link abierto', count: m.link_abierto },
    { id: 'aceptada',     label: 'Aceptadas',   count: m.aceptadas },
    { id: 'expirada',     label: 'Expiradas',   count: m.expiradas },
    { id: 'cancelada',    label: 'Canceladas',  count: m.canceladas },
  ];

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header de tab · el CTA "Invitar por email" vive en el HubHeader del
          módulo (siempre visible · canon: la acción no se duplica en la tab). */}
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-slate-900">Invitaciones</h2>
        <p className="text-[13px] text-slate-500 leading-snug">
          Ciclo de vida y conversión de las invitaciones por email
        </p>
      </div>

      {/* feedback inline */}
      {feedback && (
        <div
          className={`flex items-center gap-2 text-[12px] px-3 py-2 rounded-lg border ${
            feedback.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {feedback.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {feedback.msg}
        </div>
      )}

      {/* KPI strip semántico (canon N1/N2) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {KPIS.map((k) => {
          const c = KPI_C[k.color];
          const Icon = k.icon;
          return (
            <div key={k.label} className={`bg-gradient-to-br ${c.grad} ring-1 ${c.ring} rounded-2xl p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] uppercase tracking-wider ${c.fg} font-bold`}>{k.label}</span>
                <Icon className={`w-3.5 h-3.5 ${c.fg}`} />
              </div>
              <div className={`text-2xl font-bold tabular-nums ${c.val}`}>{k.value}</div>
              <div className={`text-[11px] ${c.fg} mt-1`}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Filtros por estado (chips · scroll-x mobile canon N6) */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        {FILTROS.map((f) => {
          const activo = filtro === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors ${
                activo
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
              <span className={`text-[10px] font-bold tabular-nums ${activo ? 'text-violet-100' : 'text-slate-400'}`}>
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 text-violet-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertCircle className="w-10 h-10 text-rose-300 mx-auto mb-2" />
          <p className="text-[13px] text-slate-600">No se pudieron cargar las invitaciones</p>
          <button onClick={() => refetch()} className="mt-3 text-[12px] font-bold text-violet-600 hover:text-violet-800">
            Reintentar
          </button>
        </div>
      ) : visibles.length === 0 ? (
        <div className="text-center py-14 bg-white border border-slate-200 rounded-2xl">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-slate-700">
            {filtro === 'todas' ? 'Todavía no enviaste invitaciones' : `Sin invitaciones ${INVITACION_ESTADO_LABELS[filtro as InvitacionEstado].toLowerCase()}`}
          </p>
          <p className="text-[12px] text-slate-500 mt-1 mb-4">
            Invitá por email a colaboradores, socios o externos para que activen su cuenta.
          </p>
          {filtro === 'todas' && (
            <button
              onClick={onInvitar}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-bold"
            >
              <MailPlus className="w-4 h-4" />
              Enviar la primera invitación
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visibles.map((inv) => (
            <DataCard
              key={inv.id}
              title={inv.email}
              subtitle={inv.nombreSugerido ? inv.nombreSugerido : `Invitó: ${inv.invitadoPorNombre}`}
              status={{ label: INVITACION_ESTADO_LABELS[inv.estado], variant: ESTADO_VARIANT[inv.estado] }}
              accentVariant={ESTADO_VARIANT[inv.estado]}
              meta={[
                {
                  icon: Shield,
                  text: inv.rolesPreAsignados.length > 0
                    ? inv.rolesPreAsignados.map((r) => ROLE_LABELS[r] ?? r).join(', ')
                    : 'sin rol pre-asignado',
                },
                { icon: Clock, text: textoFecha(inv) },
              ]}
              actions={
                esActiva(inv.estado) ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => ejecutar(inv.id, () => invitacionService.reEnviar(inv.id), 'Email re-enviado ✓')}
                      disabled={accionId === inv.id}
                      title="Re-enviar email"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-violet-600 hover:bg-violet-50 disabled:opacity-50"
                    >
                      {accionId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Re-enviar
                    </button>
                    <button
                      onClick={() => ejecutar(inv.id, () => invitacionService.cancelar(inv.id), 'Invitación cancelada')}
                      disabled={accionId === inv.id}
                      title="Cancelar invitación"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
