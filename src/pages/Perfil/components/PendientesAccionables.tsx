/**
 * PendientesAccionables · F10.F.1.C · 2026-05-27
 *
 * Card amber con pendientes accionables del usuario contextual al rol.
 * Aparece al tope del tab Resumen (cuando hay >=1 pendiente).
 *
 * Tipos de pendiente:
 *  - password_expirado     · todos los roles
 *  - boleta_sin_firmar     · solo empleados con datosLaborales
 *  - vacaciones_pendientes · solo empleados con datosLaborales
 *  - adelanto_aprobar      · solo admin con permisos GESTIONAR_PLANILLA
 *  - bono_sin_aprobar      · solo admin
 *  - datos_socio_incompleto · solo socios sin datosSocio configurado
 *
 * Canon v8.0 N1 · color semántico amber (urgencia · pendiente)
 * Canon v8.0 N9 · empty state quick-start (cuando NO hay pendientes)
 */
import React from 'react';
import { AlertTriangle, FileText, Calendar, DollarSign, Sparkles, Coins, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PendienteItem {
  id: string;
  tipo:
    | 'password_expirado'
    | 'boleta_sin_firmar'
    | 'vacaciones_pendientes'
    | 'adelanto_aprobar'
    | 'bono_sin_aprobar'
    | 'datos_socio_incompleto';
  titulo: string;
  descripcion: string;
  /** Texto del CTA · ej: "Cambiar password" · "Ver boleta" */
  ctaLabel: string;
  /** Acción al click del CTA · puede ser navegar o abrir modal */
  onAction: () => void;
  /** Severidad · controla el color del icon · default 'media' */
  severidad?: 'alta' | 'media' | 'baja';
}

interface Props {
  pendientes: PendienteItem[];
  /** Si true, muestra empty state celebrating (default false · solo se renderiza si hay pendientes) */
  mostrarEmptyState?: boolean;
}

const ICON_POR_TIPO: Record<PendienteItem['tipo'], LucideIcon> = {
  password_expirado: AlertTriangle,
  boleta_sin_firmar: FileText,
  vacaciones_pendientes: Calendar,
  adelanto_aprobar: DollarSign,
  bono_sin_aprobar: Sparkles,
  datos_socio_incompleto: Coins,
};

const SEVERIDAD_COLOR: Record<NonNullable<PendienteItem['severidad']>, string> = {
  alta: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200',
  media: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  baja: 'bg-sky-100 text-sky-700 ring-1 ring-sky-200',
};

export const PendientesAccionables: React.FC<Props> = ({ pendientes, mostrarEmptyState = false }) => {
  // Empty state celebratorio · solo si se pidió explicitamente
  if (pendientes.length === 0) {
    if (!mostrarEmptyState) return null;
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-emerald-700 font-bold">Pendientes</div>
            <div className="text-[14px] text-emerald-900 font-semibold leading-tight">
              Todo al día · sin pendientes accionables
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl overflow-hidden">
      {/* Header card */}
      <div className="px-4 py-3 border-b border-amber-200/60 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
        <span className="text-[11px] uppercase tracking-wider text-amber-700 font-bold">
          Pendientes accionables
        </span>
        <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold tabular-nums">
          {pendientes.length}
        </span>
      </div>

      {/* Lista de pendientes · stack 1-col mobile · 2-col desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-amber-200/60">
        {pendientes.map((p) => {
          const Icon = ICON_POR_TIPO[p.tipo];
          const severidad = p.severidad ?? 'media';
          return (
            <button
              key={p.id}
              type="button"
              onClick={p.onAction}
              className="bg-white hover:bg-amber-50/50 transition-colors text-left p-3 sm:p-4 flex items-start gap-3 group min-h-[64px]"
            >
              <div className={`w-9 h-9 rounded-lg ${SEVERIDAD_COLOR[severidad]} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-slate-900 leading-tight">{p.titulo}</div>
                <div className="text-[12px] text-slate-500 mt-0.5 leading-snug">{p.descripcion}</div>
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 group-hover:text-amber-800">
                  {p.ctaLabel}
                  <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PendientesAccionables;
