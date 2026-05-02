/**
 * SkeletonRow + Skeleton átomos · módulo Productos V2
 *
 * Skeleton es el bloque base con animación shimmer.
 * SkeletonRow es la fila completa de la tabla en estado loading.
 *
 * Mockup canónico: docs/mockups/productos/04-page-listado-loading.html
 */

import React from 'react';

interface SkeletonProps {
  /** Ancho con clase Tailwind: 'w-12' · 'w-32' · 'w-full' · etc. */
  width?: string;
  /** Alto con clase Tailwind: 'h-2' · 'h-3' · 'h-4' · 'h-7' · etc. */
  height?: string;
  /** Border radius. Default 'rounded'. */
  rounded?: string;
  className?: string;
}

/**
 * Bloque skeleton primitivo · agnostic shape.
 * Aplica gradient shimmer con clases Tailwind via @keyframes inline.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ width = 'w-full', height = 'h-3', rounded = 'rounded', className = '' }) => {
  return (
    <div
      className={`${width} ${height} ${rounded} ${className} bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]`}
      style={{ animationName: 'shimmer' }}
    />
  );
};

/**
 * Inyectar keyframes globalmente la primera vez que se monta un Skeleton.
 * Idempotente: solo inserta el style tag si aún no existe.
 */
function ensureShimmerKeyframes() {
  if (typeof document === 'undefined') return;
  const STYLE_ID = 'productos-v2-skeleton-keyframes';
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;
  document.head.appendChild(style);
}

/**
 * Fila skeleton completa para la tabla de productos en estado loading.
 * Layout 12 cols matchea ProductoTable y ProductoRowCard de Fase 3.
 */
export const SkeletonRow: React.FC = () => {
  ensureShimmerKeyframes();
  return (
    <div className="grid grid-cols-12 gap-3 items-center px-4 py-3">
      <div className="col-span-1">
        <Skeleton width="w-3.5" height="h-3.5" />
      </div>
      <div className="col-span-4 flex items-center gap-3">
        <Skeleton width="w-11" height="h-11" rounded="rounded-xl" />
        <div className="space-y-1.5 flex-1">
          <Skeleton width="w-48" height="h-3.5" />
          <Skeleton width="w-32" height="h-2" />
        </div>
      </div>
      <div className="col-span-2 text-right">
        <Skeleton width="w-20" height="h-3" className="ml-auto" />
      </div>
      <div className="col-span-2 text-right">
        <Skeleton width="w-16" height="h-3" className="ml-auto" />
      </div>
      <div className="col-span-2 text-right">
        <Skeleton width="w-24" height="h-3" className="ml-auto" />
      </div>
      <div className="col-span-1 text-right">
        <Skeleton width="w-12" height="h-3" className="ml-auto" />
      </div>
    </div>
  );
};

/**
 * Strip skeleton para los KPIs (4 columnas) en loading.
 */
export const SkeletonKpiStrip: React.FC = () => {
  ensureShimmerKeyframes();
  return (
    <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 mb-5">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="p-4 space-y-2">
          <Skeleton width="w-20" height="h-2.5" />
          <Skeleton width="w-16" height="h-7" />
          <Skeleton width="w-32" height="h-2" />
        </div>
      ))}
    </div>
  );
};

/**
 * Header skeleton (breadcrumb + título + acciones).
 */
export const SkeletonHeader: React.FC = () => {
  ensureShimmerKeyframes();
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
      <div className="space-y-2">
        <Skeleton width="w-48" height="h-3" />
        <Skeleton width="w-32" height="h-7" />
        <Skeleton width="w-96" height="h-3" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton width="w-24" height="h-8" rounded="rounded-lg" />
        <Skeleton width="w-20" height="h-8" rounded="rounded-lg" />
        <Skeleton width="w-32" height="h-8" rounded="rounded-lg" />
      </div>
    </div>
  );
};
