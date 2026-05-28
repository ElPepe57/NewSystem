/**
 * BannerContextual · F10.F.1.O · 2026-05-27
 *
 * Componente reusable para banners contextuales del perfil.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 15 (líneas 1462-1508).
 *
 * 5 variantes canon (tinte semántico N4):
 *   - amber  · pendientes accionables · alerta operativa
 *   - indigo · gratificación próxima · info positiva con countdown
 *   - rose   · password expira · acción urgente de seguridad
 *   - sky    · info sesión actual · contexto neutral informativo
 *   - emerald · success / celebration (no en mockup · agregado canon)
 *
 * Estructura literal del mockup:
 *   bg-gradient-to-r from-{tinte}-50 to-{tinte2}-50 ring-1 ring-{tinte}-300
 *   rounded-xl p-4 flex items-start gap-3
 *
 *   icon container w-9 h-9 bg-{tinte}-100 rounded-xl
 *   título text-[12px] font-bold text-{tinte}-900
 *   descripción text-[11px] text-{tinte}-800
 *   acción opcional: button bg-{tinte}-600 hover:bg-{tinte}-700 text-white text-[11px] font-bold
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';

export type BannerContextualTone = 'amber' | 'indigo' | 'rose' | 'sky' | 'emerald';

interface Props {
  /** Tinte semántico · controla colores */
  tone: BannerContextualTone;
  /** Icon lucide */
  icon: LucideIcon;
  /** Título corto · text-[12px] font-bold */
  titulo: string;
  /** Descripción · text-[11px] · puede ser ReactNode para inline bold/tabular */
  descripcion: React.ReactNode;
  /** Acción opcional (botón) · si NO se pasa · banner es solo informativo */
  accionLabel?: string;
  /** onClick del botón · obligatorio si accionLabel */
  onAction?: () => void;
  /** Permite cerrar el banner · si true, muestra X arriba derecha */
  dismissible?: boolean;
  onDismiss?: () => void;
}

const TONE_CLASSES: Record<BannerContextualTone, {
  bg: string;
  ring: string;
  iconBg: string;
  iconText: string;
  tituloText: string;
  descText: string;
  btnBg: string;
  btnHover: string;
}> = {
  amber: {
    bg: 'bg-gradient-to-r from-amber-50 to-orange-50',
    ring: 'ring-1 ring-amber-300',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-700',
    tituloText: 'text-amber-900',
    descText: 'text-amber-800',
    btnBg: 'bg-amber-600',
    btnHover: 'hover:bg-amber-700',
  },
  indigo: {
    bg: 'bg-gradient-to-r from-indigo-50 to-purple-50',
    ring: 'ring-1 ring-indigo-300',
    iconBg: 'bg-indigo-100',
    iconText: 'text-indigo-700',
    tituloText: 'text-indigo-900',
    descText: 'text-indigo-800',
    btnBg: 'bg-indigo-600',
    btnHover: 'hover:bg-indigo-700',
  },
  rose: {
    bg: 'bg-gradient-to-r from-rose-50 to-rose-100/40',
    ring: 'ring-1 ring-rose-300',
    iconBg: 'bg-rose-100',
    iconText: 'text-rose-700',
    tituloText: 'text-rose-900',
    descText: 'text-rose-800',
    btnBg: 'bg-rose-600',
    btnHover: 'hover:bg-rose-700',
  },
  sky: {
    bg: 'bg-gradient-to-r from-sky-50 to-cyan-50',
    ring: 'ring-1 ring-sky-200',
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-700',
    tituloText: 'text-sky-900',
    descText: 'text-sky-800',
    btnBg: 'bg-sky-600',
    btnHover: 'hover:bg-sky-700',
  },
  emerald: {
    bg: 'bg-gradient-to-r from-emerald-50 to-teal-50',
    ring: 'ring-1 ring-emerald-300',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-700',
    tituloText: 'text-emerald-900',
    descText: 'text-emerald-800',
    btnBg: 'bg-emerald-600',
    btnHover: 'hover:bg-emerald-700',
  },
};

export const BannerContextual: React.FC<Props> = ({
  tone,
  icon: Icon,
  titulo,
  descripcion,
  accionLabel,
  onAction,
  dismissible = false,
  onDismiss,
}) => {
  const c = TONE_CLASSES[tone];

  return (
    // Canon mockup ACTO 15 · línea 1464 · copy-paste literal
    <div className={`${c.bg} ${c.ring} rounded-xl p-4 flex items-start gap-3 relative`}>
      <div className={`w-9 h-9 ${c.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${c.iconText}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[12px] font-bold ${c.tituloText} mb-0.5`}>{titulo}</div>
        <div className={`text-[11px] ${c.descText}`}>{descripcion}</div>
      </div>
      {accionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={`${c.btnBg} ${c.btnHover} text-white text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap inline-flex items-center gap-1 flex-shrink-0`}
        >
          {accionLabel}
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
      {dismissible && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={`absolute top-2 right-2 ${c.iconText} hover:opacity-70 p-1`}
          aria-label="Cerrar banner"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default BannerContextual;
