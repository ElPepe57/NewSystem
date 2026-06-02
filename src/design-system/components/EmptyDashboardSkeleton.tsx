import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { COLOR_CLASSES, type ColorIdentidad } from '../grupoColor';
import { cn } from '../utils';

/**
 * EmptyDashboardSkeleton — estado vacío de un DASHBOARD que, en vez de un mensaje plano,
 * muestra un ESQUELETO ESTRUCTURAL de lo que el usuario verá cuando tenga datos.
 *
 * Patrón reutilizable del ERP (canon · declarado 2026-06-02): los dashboards analíticos
 * (Resumen, Inteligencia, etc.) nacen con su "vista previa estructural" — la forma y los
 * LABELS reales de cada sección en gris, SIN números falsos (honestidad del dato). El color
 * de acento sale del grupo del módulo (grupoColor). Reemplaza el empty-state plano.
 *
 * Uso:
 *   <EmptyDashboardSkeleton
 *     color="blue" icon={ShoppingCart}
 *     titulo="Aún no hay órdenes de compra"
 *     subtitulo="Así se verá tu Resumen cuando registres la primera OC:"
 *     cta={{ label: 'Nueva OC', icon: Plus, onClick }}
 *     bloques={[
 *       { tipo: 'banner', label: 'Salud de compras' },
 *       { tipo: 'charts', items: [{ label: 'Gasto por proveedor', forma: 'donut' }, ...] },
 *       { tipo: 'stats', label: 'Insights', items: ['Lead time', 'Concentración', ...] },
 *       { tipo: 'links', label: 'Conecta con · 360', items: ['Envíos', ...] },
 *       { tipo: 'list', label: 'Alertas', filas: 2 },
 *     ]}
 *   />
 */

export type PreviewBloque =
  | { tipo: 'banner'; label: string }
  | { tipo: 'charts'; items: { label: string; forma: 'donut' | 'bars' }[] }
  | { tipo: 'stats'; label?: string; items: string[] }
  | { tipo: 'links'; label?: string; items: string[] }
  | { tipo: 'list'; label?: string; filas?: number };

interface PreviewCTA {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
}

interface EmptyDashboardSkeletonProps {
  /** Color de identidad del grupo del módulo (grupoColor). */
  color: ColorIdentidad;
  icon: LucideIcon;
  titulo: string;
  subtitulo?: string;
  cta?: PreviewCTA;
  ctaSecundario?: PreviewCTA;
  /** Secciones del dashboard, en orden, con sus labels reales. */
  bloques: PreviewBloque[];
}

const Overline: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2 ml-1">{children}</div>
);

const Bloque: React.FC<{ bloque: PreviewBloque }> = ({ bloque }) => {
  switch (bloque.tipo) {
    case 'banner':
      return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{bloque.label}</div>
            <div className="h-2.5 w-2/3 bg-slate-100 rounded-full" />
          </div>
        </div>
      );
    case 'charts':
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bloque.items.map((it, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3">{it.label}</div>
              {it.forma === 'donut' ? (
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full border-[10px] border-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    {[0, 1, 2, 3].map((k) => (
                      <div key={k} className="h-2 bg-slate-100 rounded-full" style={{ width: `${85 - k * 16}%` }} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-end justify-between gap-2 h-24 pt-2">
                  {[45, 68, 52, 80, 62, 90].map((h, k) => (
                    <div key={k} className="flex-1 bg-slate-100 rounded-t" style={{ height: `${h}%` }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    case 'stats':
      return (
        <div>
          {bloque.label && <Overline>{bloque.label}</Overline>}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {bloque.items.map((it, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2 truncate">{it}</div>
                <div className="h-4 w-12 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      );
    case 'links':
      return (
        <div>
          {bloque.label && <Overline>{bloque.label}</Overline>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {bloque.items.map((it, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="text-[12px] font-medium text-slate-400 truncate">{it}</div>
                <div className="w-4 h-4 rounded bg-slate-100 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      );
    case 'list':
      return (
        <div>
          {bloque.label && <Overline>{bloque.label}</Overline>}
          <div className="space-y-2">
            {Array.from({ length: bloque.filas ?? 2 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg px-3 py-3 flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-slate-100 flex-shrink-0" />
                <div className="h-2.5 bg-slate-100 rounded-full flex-1 max-w-xs" />
              </div>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
};

export const EmptyDashboardSkeleton: React.FC<EmptyDashboardSkeletonProps> = ({
  color, icon: Icon, titulo, subtitulo, cta, ctaSecundario, bloques,
}) => {
  const c = COLOR_CLASSES[color];
  return (
    <div className="relative">
      {/* Invitación */}
      <div className="text-center mb-5">
        <div className={cn('inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 mx-auto', c.iconTonalBg, c.iconTonalText)}>
          <Icon className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">{titulo}</h3>
        {subtitulo && <p className="text-[12px] text-slate-500 mt-1 max-w-md mx-auto">{subtitulo}</p>}
        {(cta || ctaSecundario) && (
          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            {cta && (
              <button onClick={cta.onClick} className={cn('inline-flex items-center gap-1.5 text-[12px] font-semibold px-4 py-2 rounded-lg transition-colors', c.primaryBtn)}>
                {cta.icon && <cta.icon className="w-4 h-4" />}{cta.label}
              </button>
            )}
            {ctaSecundario && (
              <button onClick={ctaSecundario.onClick} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[12px] font-semibold px-4 py-2 rounded-lg transition-colors">
                {ctaSecundario.icon && <ctaSecundario.icon className="w-4 h-4" />}{ctaSecundario.label}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Separador "vista previa" */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Vista previa · estructura</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Esqueleto estructural (atenuado · no interactivo · solo referencia) */}
      <div className="space-y-4 opacity-60 select-none pointer-events-none" aria-hidden="true">
        {bloques.map((b, i) => <Bloque key={i} bloque={b} />)}
      </div>
    </div>
  );
};
