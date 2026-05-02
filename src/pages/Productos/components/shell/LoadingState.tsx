/**
 * LoadingState · skeleton del listado completo en estado loading inicial
 *
 * Mockup canónico: docs/mockups/productos/04-page-listado-loading.html
 *
 * Reusa: SkeletonHeader, SkeletonKpiStrip y filas SkeletonRow del barrel shared.
 */

import React from 'react';
import { Skeleton, SkeletonRow, SkeletonKpiStrip, SkeletonHeader } from '../shared';

export const LoadingState: React.FC = () => {
  return (
    <>
      {/* Header skeleton */}
      <SkeletonHeader />

      {/* KPI strip skeleton */}
      <SkeletonKpiStrip />

      {/* Pills rápidos skeleton */}
      <div className="flex items-center gap-2 mb-3">
        <Skeleton width="w-24" height="h-7" rounded="rounded-full" />
        <Skeleton width="w-28" height="h-7" rounded="rounded-full" />
        <Skeleton width="w-32" height="h-7" rounded="rounded-full" />
        <Skeleton width="w-28" height="h-7" rounded="rounded-full" />
        <Skeleton width="w-20" height="h-7" rounded="rounded-full" />
      </div>

      {/* Filtros bar skeleton */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <Skeleton width="w-32" height="h-7" rounded="rounded-lg" />
          <div className="h-5 w-px bg-slate-200" />
          <Skeleton width="w-12" height="h-2.5" />
          <Skeleton width="w-24" height="h-6" rounded="rounded-full" />
          <Skeleton width="w-28" height="h-6" rounded="rounded-full" />
        </div>
        <div className="border-t border-slate-100" />
        <div className="flex items-center gap-2">
          <Skeleton width="flex-1" height="h-9" rounded="rounded-lg" />
          <Skeleton width="w-32" height="h-9" rounded="rounded-lg" />
        </div>
      </div>

      {/* Tabla skeleton · 5 filas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <div className="col-span-1">
            <Skeleton width="w-3.5" height="h-3.5" />
          </div>
          <div className="col-span-4">
            <Skeleton width="w-16" height="h-2.5" />
          </div>
          <div className="col-span-2 text-right">
            <Skeleton width="w-24" height="h-2.5" className="ml-auto" />
          </div>
          <div className="col-span-2 text-right">
            <Skeleton width="w-20" height="h-2.5" className="ml-auto" />
          </div>
          <div className="col-span-2 text-right">
            <Skeleton width="w-16" height="h-2.5" className="ml-auto" />
          </div>
          <div className="col-span-1 text-right">
            <Skeleton width="w-12" height="h-2.5" className="ml-auto" />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3, 4].map(i => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    </>
  );
};
