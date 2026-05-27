/**
 * PendientesAccionables · F10.F.1.I-FIX · 2026-05-27
 *
 * PIXEL-PERFECT REWRITE · canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 2 (líneas 226-254).
 *
 * Patrón canon mockup:
 *   - h3 text-[13px] font-bold text-slate-900 mb-2 con icon list-checks amber-700
 *   - cada pendiente: bg-{tinte}-50 border border-{tinte}-200 rounded-lg p-3
 *   - flex items-center justify-between
 *   - flex items-center gap-2 (icon + texto)
 *   - texto: text-[12px] font-semibold + text-[10px] descripción
 *   - chip estado: text-[10px] bg-{tinte}-200 text-{tinte}-900 px-2 py-0.5 rounded-full font-bold uppercase
 *
 * Tintes por tipo (canon N4 cross-módulo):
 *   - amber  · adelantos pendientes · urgencia financiera
 *   - violet · bonos calculados pendiente aprobación
 *   - rose   · password expirado · datos críticos faltantes
 *   - sky    · boletas borrador (operacional)
 */
import React from 'react';
import {
  ListChecks,
  ArrowDownCircle,
  Trophy,
  AlertTriangle,
  FileText,
  Calendar,
  Coins,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PendienteItem {
  id: string;
  tipo:
    | 'password_expirado'
    | 'boleta_sin_firmar'
    | 'vacaciones_pendientes'
    | 'adelanto_aprobar'
    | 'bono_sin_aprobar'
    | 'datos_socio_incompleto'
    | 'adelanto_solicitado'
    | 'comision_calculada';
  titulo: string;
  descripcion: string;
  /** Texto del chip top-right · ej: "PENDIENTE" · "CALCULADO" · uppercase */
  chipLabel: string;
  /** Tinte semántico · controla bg/border/chip color */
  tinte: 'amber' | 'violet' | 'rose' | 'sky';
  /** Acción al click del card */
  onAction?: () => void;
}

interface Props {
  pendientes: PendienteItem[];
}

const ICON_POR_TIPO: Record<PendienteItem['tipo'], LucideIcon> = {
  password_expirado: AlertTriangle,
  boleta_sin_firmar: FileText,
  vacaciones_pendientes: Calendar,
  adelanto_aprobar: ArrowDownCircle,
  bono_sin_aprobar: Trophy,
  datos_socio_incompleto: Coins,
  adelanto_solicitado: ArrowDownCircle,
  comision_calculada: Trophy,
};

const TINTE_CLASSES: Record<
  PendienteItem['tinte'],
  { bg: string; border: string; icon: string; titulo: string; desc: string; chip: string }
> = {
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-700',
    titulo: 'text-amber-900',
    desc: 'text-amber-700',
    chip: 'bg-amber-200 text-amber-900',
  },
  violet: {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    icon: 'text-violet-700',
    titulo: 'text-violet-900',
    desc: 'text-violet-700',
    chip: 'bg-violet-200 text-violet-900',
  },
  rose: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    icon: 'text-rose-700',
    titulo: 'text-rose-900',
    desc: 'text-rose-700',
    chip: 'bg-rose-200 text-rose-900',
  },
  sky: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    icon: 'text-sky-700',
    titulo: 'text-sky-900',
    desc: 'text-sky-700',
    chip: 'bg-sky-200 text-sky-900',
  },
};

export const PendientesAccionables: React.FC<Props> = ({ pendientes }) => {
  if (pendientes.length === 0) return null;

  return (
    // Canon mockup ACTO 2 · líneas 226-254 · copy-paste literal
    <div>
      <h3 className="text-[13px] font-bold text-slate-900 mb-2 inline-flex items-center gap-1.5">
        <ListChecks className="w-4 h-4 text-amber-700" />
        Mis pendientes accionables
      </h3>
      <div className="space-y-2">
        {pendientes.map((p) => {
          const Icon = ICON_POR_TIPO[p.tipo];
          const c = TINTE_CLASSES[p.tinte];
          const isClickable = !!p.onAction;
          const Cmp: any = isClickable ? 'button' : 'div';
          return (
            <Cmp
              key={p.id}
              type={isClickable ? 'button' : undefined}
              onClick={p.onAction}
              className={`${c.bg} ${c.border} border rounded-lg p-3 flex items-center justify-between w-full text-left ${
                isClickable ? 'hover:opacity-90 transition-opacity cursor-pointer' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${c.icon} flex-shrink-0`} />
                <div className="min-w-0">
                  <div className={`text-[12px] font-semibold ${c.titulo}`}>{p.titulo}</div>
                  <div className={`text-[10px] ${c.desc}`}>{p.descripcion}</div>
                </div>
              </div>
              <span
                className={`text-[10px] ${c.chip} px-2 py-0.5 rounded-full font-bold uppercase flex-shrink-0`}
              >
                {p.chipLabel}
              </span>
            </Cmp>
          );
        })}
      </div>
    </div>
  );
};

export default PendientesAccionables;
