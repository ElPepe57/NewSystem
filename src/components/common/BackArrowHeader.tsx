/**
 * BackArrowHeader · F10.F.1.J-SIDEBAR · 2026-05-27
 *
 * Componente reusable para el header de sub-páginas de /perfil/*.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.5-variante-drill.html ACTO 8 (líneas 1230-1250).
 *
 * Estructura visual:
 *   1. Breadcrumb 3 niveles canon S9.D1 (Inicio › Mi perfil › {seccion})
 *   2. Header con back arrow (left) + icon gradient + título + subtítulo + acciones (right)
 *
 * Uso:
 *   <BackArrowHeader
 *     seccionLabel="Mi planilla"
 *     icon={BriefcaseBusiness}
 *     colorTone="sky"
 *     subtitulo="Boletas · adelantos · incentivos · vacaciones · gratificaciones"
 *     acciones={<button>...</button>}
 *   />
 *
 * onClick del back arrow · navega a /perfil por default.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type BackArrowHeaderColorTone = 'sky' | 'violet' | 'emerald' | 'amber' | 'rose' | 'purple' | 'teal';

interface Props {
  /** Label de la sub-sección · ej: "Mi planilla" · "Mi capital" */
  seccionLabel: string;
  /** Icon lucide del header (44x44 gradient) */
  icon: LucideIcon;
  /** Color semántico · controla gradient del icon · default 'sky' */
  colorTone?: BackArrowHeaderColorTone;
  /** Subtítulo · descripción corta */
  subtitulo?: string;
  /** Acciones del header (right side) · botones · selectors */
  acciones?: React.ReactNode;
  /** Callback custom del back arrow · default navega a /perfil */
  onBack?: () => void;
  /** Path al que navega el back arrow · default '/perfil' */
  backPath?: string;
  /** Label del 2do nivel del breadcrumb · default "Mi perfil" */
  breadcrumbParent?: string;
  /** Path del 2do nivel del breadcrumb · default '/perfil' */
  breadcrumbParentPath?: string;
}

/**
 * Gradient classes por colorTone · estáticas para que Tailwind JIT las detecte.
 * No usar interpolación de strings · siempre clases literales.
 */
const GRADIENT_BY_TONE: Record<BackArrowHeaderColorTone, string> = {
  sky: 'bg-gradient-to-br from-sky-500 to-sky-700',
  violet: 'bg-gradient-to-br from-violet-500 to-violet-700',
  emerald: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
  amber: 'bg-gradient-to-br from-amber-500 to-amber-700',
  rose: 'bg-gradient-to-br from-rose-500 to-rose-700',
  purple: 'bg-gradient-to-br from-purple-500 to-purple-700',
  teal: 'bg-gradient-to-br from-teal-500 to-teal-700',
};

export const BackArrowHeader: React.FC<Props> = ({
  seccionLabel,
  icon: Icon,
  colorTone = 'sky',
  subtitulo,
  acciones,
  onBack,
  backPath = '/perfil',
  breadcrumbParent = 'Mi perfil',
  breadcrumbParentPath = '/perfil',
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(backPath);
  };

  return (
    <>
      {/* §A · Breadcrumb 3 niveles canon S9.D1 */}
      <div className="px-6 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
        <div className="flex items-center text-[12px] flex-1 min-w-0">
          <a
            className="text-slate-500 hover:text-purple-700 cursor-pointer flex-shrink-0"
            onClick={() => navigate('/dashboard')}
          >
            Inicio
          </a>
          <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
          <a
            className="text-slate-500 hover:text-purple-700 cursor-pointer flex-shrink-0"
            onClick={() => navigate(breadcrumbParentPath)}
          >
            {breadcrumbParent}
          </a>
          <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
          <span className="text-slate-900 font-semibold truncate">{seccionLabel}</span>
        </div>
      </div>

      {/* §B · Header con back arrow + icon + título + acciones */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={handleBack}
          className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors group flex-shrink-0"
          title="Volver al perfil"
          aria-label="Volver al perfil"
        >
          <ArrowLeft className="w-4 h-4 text-slate-700 group-hover:-translate-x-0.5 transition-transform" />
        </button>

        <div className={`w-11 h-11 rounded-xl ${GRADIENT_BY_TONE[colorTone]} flex items-center justify-center text-white flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{seccionLabel}</h1>
          {subtitulo && (
            <p className="text-[12px] text-slate-500 leading-snug">{subtitulo}</p>
          )}
        </div>

        {acciones && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {acciones}
          </div>
        )}
      </div>
    </>
  );
};

export default BackArrowHeader;
