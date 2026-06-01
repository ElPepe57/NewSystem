/**
 * MapaTab · canon pixel-perfect mockup X (chk4.5)
 *
 * Estructura del mockup stock-canon-s3.6-X.html (líneas 677-805):
 *   Grid 3 cols:
 *     - Mapa principal (col-span-2): heat-zones + pins por ubicación
 *     - Sidebar (col-span-1): Top 5 ubicaciones + Insights
 *
 * Implementación:
 *   - Sidebar Top 5 + Insights: computables con datos actuales · IMPLEMENTADO
 *   - Mapa con heat-zones reales: requiere coordenadas geográficas por almacén
 *     (NO existen en BD aún) · placeholder visual con mensaje informativo
 *
 * TODO chk siguiente: agregar campos `latitud` / `longitud` al modelo Almacen,
 * geocodificar por ciudad/dirección, integrar Leaflet (ya está en deps por
 * MapaCalor), reemplazar placeholder por mapa real con HeatmapLayer.
 */

import React, { useMemo } from 'react';
import { Map as MapIcon, MapPin, TrendingUp, AlertTriangle, Info, Sparkles } from 'lucide-react';
import type { Unidad } from '../../../../types/unidad.types';
import type { Almacen } from '../../../../types/almacen.types';

interface MapaTabProps {
  unidades: Unidad[];
  almacenes: Almacen[];
}

interface UbicacionStats {
  almacenId: string;
  nombre: string;
  pais: string;
  unidades: number;
  pct: number;
  color: string;
}

const COLOR_BY_RANK = ['bg-rose-500', 'bg-sky-500', 'bg-amber-500', 'bg-purple-500', 'bg-emerald-500'];

export const MapaTab: React.FC<MapaTabProps> = ({ unidades, almacenes }) => {
  // Calcular distribución por almacén
  const { topUbicaciones, totalUnidades, totalUbicaciones, otrosCount, insights } = useMemo(() => {
    // Filtrar unidades activas (no vendidas)
    const activas = unidades.filter(u => u.estado !== 'vendida');
    const total = activas.length;

    // Agrupar por almacén
    const porAlmacen = new Map<string, number>();
    activas.forEach(u => {
      const aid = u.casillaActualId || u.almacenId;
      if (!aid) return;
      porAlmacen.set(aid, (porAlmacen.get(aid) ?? 0) + 1);
    });

    // Top 5 ubicaciones ordenadas
    const ordenadas = Array.from(porAlmacen.entries())
      .map(([aid, count]) => {
        const a = almacenes.find(al => al.id === aid);
        return {
          almacenId: aid,
          nombre: a?.nombre ?? 'Desconocida',
          pais: a?.pais ?? '',
          unidades: count,
          pct: total > 0 ? (count / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.unidades - a.unidades);

    const top5 = ordenadas.slice(0, 5).map((u, idx) => ({
      ...u,
      color: COLOR_BY_RANK[idx] ?? 'bg-slate-400',
    } as UbicacionStats));

    const otrosCount = ordenadas.slice(5).reduce((s, u) => s + u.unidades, 0);

    // Insights computados
    const ubicacionesPorPais = new Map<string, number>();
    activas.forEach(u => {
      const p = u.pais || 'Sin país';
      ubicacionesPorPais.set(p, (ubicacionesPorPais.get(p) ?? 0) + 1);
    });
    const peruCount = ubicacionesPorPais.get('Peru') ?? 0;
    const usaCount = ubicacionesPorPais.get('USA') ?? 0;
    const pctPeru = total > 0 ? Math.round((peruCount / total) * 100) : 0;
    const pctUSA = total > 0 ? Math.round((usaCount / total) * 100) : 0;

    // Concentración top 1
    const topConcentracion = top5[0];
    const pctTopConcentracion = topConcentracion ? Math.round(topConcentracion.pct) : 0;

    return {
      topUbicaciones: top5,
      totalUnidades: total,
      totalUbicaciones: porAlmacen.size,
      otrosCount,
      insights: {
        topConcentracion,
        pctTopConcentracion,
        pctPeru,
        pctUSA,
        peruCount,
        usaCount,
      },
    };
  }, [unidades, almacenes]);

  const hayDatos = totalUnidades > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Mapa principal · col-span-2 */}
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-orange-600" />
              Distribución geográfica del stock
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              <span className="tabular-nums">{totalUnidades.toLocaleString('es-PE')}</span> unidades en{' '}
              <span className="tabular-nums">{totalUbicaciones}</span> ubicaciones
            </div>
          </div>
        </div>

        {/* Placeholder del mapa · TODO: integrar Leaflet con coordenadas por almacén */}
        <div
          className="h-96 relative flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #f0f9ff 0%, #fefce8 100%)',
          }}
        >
          <div className="text-center max-w-sm px-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 mb-4 border border-orange-100">
              <MapPin className="w-8 h-8 text-orange-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Mapa interactivo en desarrollo
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              El mapa de calor geográfico requiere coordenadas (latitud/longitud) por
              almacén · pendiente de configurar en el ABM de almacenes.
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
              <Sparkles className="w-3 h-3" />
              Próximamente · usar Leaflet + HeatmapLayer del design-system
            </div>
          </div>

          {/* Pins simulados decorativos en las esquinas (mockup X feel) */}
          {hayDatos && (
            <>
              <div className="absolute top-6 right-8 bg-white border border-slate-200 rounded-lg shadow-sm px-2.5 py-1.5 text-[10px] flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="font-bold tabular-nums">
                  {topUbicaciones[0]?.unidades ?? 0} en {topUbicaciones[0]?.nombre.slice(0, 18) ?? '-'}
                </span>
              </div>
              {topUbicaciones[1] && (
                <div className="absolute bottom-6 left-8 bg-white border border-slate-200 rounded-lg shadow-sm px-2.5 py-1.5 text-[10px] flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-sky-500" />
                  <span className="font-bold tabular-nums">
                    {topUbicaciones[1].unidades} en {topUbicaciones[1].nombre.slice(0, 18)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sidebar · Top 5 + Insights */}
      <div className="lg:col-span-1 space-y-3">
        {/* Top 5 ubicaciones */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Top 5 ubicaciones
          </div>
          {topUbicaciones.length === 0 ? (
            <div className="text-xs text-slate-400 italic py-4 text-center">
              Sin unidades activas
            </div>
          ) : (
            <div className="space-y-2.5">
              {topUbicaciones.map(u => (
                <div key={u.almacenId} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${u.color} flex-shrink-0`} />
                    <span className="text-xs text-slate-700 truncate">{u.nombre}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs font-bold text-slate-900 tabular-nums">
                      {u.unidades.toLocaleString('es-PE')}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums w-8 text-right">
                      {u.pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
              {otrosCount > 0 && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                    <span className="text-xs text-slate-600 truncate">
                      Otros ({totalUbicaciones - 5} ubicaciones)
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-700 tabular-nums flex-shrink-0">
                    {otrosCount.toLocaleString('es-PE')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Insights */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Insights
          </div>
          {!hayDatos ? (
            <div className="text-xs text-slate-400 italic py-4 text-center">
              Sin datos para análisis
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {insights.topConcentracion && insights.pctTopConcentracion >= 30 && (
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">
                    <strong className="tabular-nums">{insights.pctTopConcentracion}%</strong>{' '}
                    del stock en {insights.topConcentracion.nombre} · concentración alta
                  </span>
                </div>
              )}
              {insights.pctUSA >= 10 && (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">
                    <strong className="tabular-nums">{insights.pctUSA}%</strong> en USA ·
                    pendiente despacho a Perú
                  </span>
                </div>
              )}
              {insights.pctPeru >= 50 && (
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-sky-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">
                    <strong className="tabular-nums">{insights.pctPeru}%</strong> ya en Perú ·
                    disponible para venta directa
                  </span>
                </div>
              )}
              {totalUbicaciones > 5 && (
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">
                    Stock distribuido en{' '}
                    <strong className="tabular-nums">{totalUbicaciones}</strong> ubicaciones ·
                    evaluar consolidación
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
