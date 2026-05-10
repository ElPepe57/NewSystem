/**
 * EmptyWorkspace · empty state genérico canon · Cost Intelligence
 *
 * Pattern Vercel/Linear · empty states ricos · siempre con CTA contextual.
 * Cada workspace que aún no tiene data lo usa con su propio mensaje específico.
 *
 * Filosofía: NO oculta lo que falta. Le dice al usuario EXACTAMENTE qué necesita
 * hacer para que el workspace se llene de información.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface CtaConfig {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
}

interface EmptyWorkspaceProps {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: 'amber' | 'purple' | 'rose' | 'sky';
  title: string;
  description: string;
  /** Qué necesita el sistema para llenarlo */
  prerequisites: string[];
  ctas?: CtaConfig[];
}

const ICON_BG: Record<EmptyWorkspaceProps['iconColor'], string> = {
  amber: 'bg-amber-100 text-amber-600',
  purple: 'bg-purple-100 text-purple-600',
  rose: 'bg-rose-100 text-rose-600',
  sky: 'bg-sky-100 text-sky-600',
};

export const EmptyWorkspace: React.FC<EmptyWorkspaceProps> = ({
  icon: Icon,
  iconColor,
  title,
  description,
  prerequisites,
  ctas,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-12">
      <div className="max-w-md mx-auto text-center">
        <div className={`w-16 h-16 rounded-full ${ICON_BG[iconColor]} flex items-center justify-center mx-auto mb-4`}>
          <Icon className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">{title}</h2>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">{description}</p>

        {/* Prerequisitos · qué falta para que se llene */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 text-left">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Para activar este workspace necesitas:
          </div>
          <ul className="space-y-1.5">
            {prerequisites.map((p, idx) => (
              <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                <span className="font-bold text-slate-400 tabular-nums mt-0.5">{idx + 1}.</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTAs */}
        {ctas && ctas.length > 0 && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {ctas.map((cta, idx) => (
              <Link
                key={idx}
                to={cta.href}
                className={`text-xs font-medium rounded-lg px-4 py-2 flex items-center gap-1.5 ${
                  cta.variant === 'primary' || idx === 0
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {cta.label}
                <ArrowRight className="w-3 h-3" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
