/**
 * TabVacacionesGratificaciones.tsx
 *
 * chk5.PERSONAS-v5.4 · F4 · 2026-05-26
 *
 * Tab "Vacaciones & Gratificaciones" · Planilla v5.4.
 * Canon sky · mockup planilla-v5.4-completo.html ACTO 3.
 *
 * Vita Skin NO paga CTS (decisión user 2026-05-26).
 * Gratificaciones solo Julio y Diciembre Perú.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Palmtree,
  Gift,
  Plus,
  CalendarDays,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { gratificacionService } from '../../../services/gratificacion.service';
import type {
  Gratificacion,
  MesGratificacion,
} from '../../../types/planilla.types';
import { ESTADO_GRATIFICACION_LABELS } from '../../../types/planilla.types';
import { formatCurrencyPEN } from '../../../utils/format';

interface TabVacacionesGratificacionesProps {
  mes: number;
  anio: number;
  onProcesarGratificacion?: (mesGrat: MesGratificacion, anio: number) => void;
  onProgramarVacaciones?: () => void;
}

// ───── Helpers ─────

function mesNombre(m: number): string {
  return [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ][m - 1] ?? '';
}

function diasAlProximaGratificacion(mes: number, anio: number): { dias: number; mesProx: MesGratificacion; anioProx: number } {
  const hoy = new Date();
  const ahoraTs = hoy.getTime();

  // Próximas gratificaciones: julio 15 y diciembre 15
  const candidatos: Array<{ mes: MesGratificacion; fecha: Date }> = [
    { mes: 7, fecha: new Date(anio, 6, 15) },
    { mes: 12, fecha: new Date(anio, 11, 15) },
    { mes: 7, fecha: new Date(anio + 1, 6, 15) }, // próximo año
  ];

  const proximo = candidatos.find((c) => c.fecha.getTime() > ahoraTs);
  if (!proximo) return { dias: 0, mesProx: 7, anioProx: anio + 1 };
  const dias = Math.ceil((proximo.fecha.getTime() - ahoraTs) / (1000 * 60 * 60 * 24));
  return { dias, mesProx: proximo.mes, anioProx: proximo.fecha.getFullYear() };
}

// ───── COMPONENT ─────

export const TabVacacionesGratificaciones: React.FC<TabVacacionesGratificacionesProps> = ({
  mes,
  anio,
  onProcesarGratificacion,
  onProgramarVacaciones,
}) => {
  const [gratificacionesAnio, setGratificacionesAnio] = useState<Gratificacion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Cargar gratificaciones de jul y dic del año actual
        const [jul, dic] = await Promise.all([
          gratificacionService.listMes(7, anio),
          gratificacionService.listMes(12, anio),
        ]);
        setGratificacionesAnio([...jul, ...dic]);
      } catch (err) {
        console.error('[TabVacacionesGratificaciones] error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [anio]);

  const proxima = useMemo(() => diasAlProximaGratificacion(mes, anio), [mes, anio]);

  const totalAnio = useMemo(
    () => gratificacionesAnio.reduce((s, g) => s + g.montoCalculado, 0),
    [gratificacionesAnio],
  );

  const julGratifs = gratificacionesAnio.filter((g) => g.mes === 7);
  const dicGratifs = gratificacionesAnio.filter((g) => g.mes === 12);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="text-[12px]">Cargando vacaciones y gratificaciones...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* KPI mini · próxima gratificación + total año */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">
              PRÓXIMA GRATIFICACIÓN
            </span>
            <CalendarDays className="w-3.5 h-3.5 text-indigo-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-indigo-900">
            {mesNombre(proxima.mesProx).slice(0, 3)}{' '}
            <span className="text-indigo-400">· {proxima.dias}d</span>
          </div>
          <div className="text-[10px] text-indigo-700 mt-1">
            {proxima.dias > 0 ? `faltan ${proxima.dias} días` : 'ya disponible para procesar'}
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
              GRATIFICACIONES {anio}
            </span>
            <Gift className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">
            {formatCurrencyPEN(totalAnio)}
          </div>
          <div className="text-[10px] text-emerald-700 mt-1">
            {gratificacionesAnio.length} gratificación{gratificacionesAnio.length === 1 ? '' : 'es'} registradas
          </div>
        </div>
        <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 ring-1 ring-violet-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-violet-700 font-bold">VACACIONES</span>
            <Palmtree className="w-3.5 h-3.5 text-violet-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-violet-900">—</div>
          <div className="text-[10px] text-violet-700 mt-1">control informal · programación manual</div>
        </div>
      </div>

      {/* Sección Gratificaciones */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
            <Gift className="w-4 h-4 text-indigo-700" />
            Gratificaciones · Julio y Diciembre · {anio}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onProcesarGratificacion?.(7, anio)}
              className="bg-white border border-indigo-300 text-indigo-700 text-[11px] font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 hover:bg-indigo-50"
            >
              <Plus className="w-3 h-3" />
              Procesar Julio
            </button>
            <button
              type="button"
              onClick={() => onProcesarGratificacion?.(12, anio)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3" />
              Procesar Diciembre
            </button>
          </div>
        </div>

        {/* Bloques Julio + Diciembre */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { titulo: 'Julio', mes: 7 as MesGratificacion, items: julGratifs },
            { titulo: 'Diciembre', mes: 12 as MesGratificacion, items: dicGratifs },
          ].map(({ titulo, mes: m, items }) => (
            <div key={m} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-[12px] font-bold text-slate-700 mb-2 inline-flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                {titulo} {anio}
              </div>
              {items.length === 0 ? (
                <div className="text-[11px] text-slate-500 italic">Aún no procesadas</div>
              ) : (
                <ul className="space-y-1.5">
                  {items.map((g) => (
                    <li
                      key={g.id}
                      className="flex items-center justify-between bg-white rounded p-2 border border-slate-100"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold text-slate-900 truncate">
                          {g.empleadoNombre}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {g.diasEfectivosEnSemestre}/180 días
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <div className="text-[12px] font-bold tabular-nums text-indigo-900">
                          {formatCurrencyPEN(g.montoCalculado)}
                        </div>
                        <div className="text-[9px] uppercase font-bold tracking-wider">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              g.estado === 'pagada'
                                ? 'bg-emerald-100 text-emerald-700'
                                : g.estado === 'aprobada'
                                  ? 'bg-violet-100 text-violet-700'
                                  : g.estado === 'pendiente'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {ESTADO_GRATIFICACION_LABELS[g.estado]}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sección Vacaciones · scaffold informal */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
            <Palmtree className="w-4 h-4 text-violet-700" />
            Vacaciones · control informal
          </h3>
          <button
            type="button"
            onClick={onProgramarVacaciones}
            className="bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3 h-3" />
            Programar vacaciones
          </button>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-[11px] text-violet-900">
          <strong>Nota:</strong> Vita Skin gestiona vacaciones de forma informal · sin acumulación
          legal · sin cálculo de derecho. Esta sección sirve para coordinar suplencias y registrar
          períodos planificados con cada empleado.
        </div>
        <div className="text-center py-6 text-slate-500">
          <Clock className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <div className="text-[12px] font-semibold text-slate-700">Sin períodos programados</div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Usa "Programar vacaciones" para coordinar el primer período
          </p>
        </div>
      </div>

      {/* Nota explícita: sin CTS */}
      <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-rose-900">
          <strong>Vita Skin NO paga CTS</strong> · gratificaciones se procesan solo en Julio y
          Diciembre con cálculo proporcional a días efectivos en el semestre.
        </div>
      </div>
    </div>
  );
};

export default TabVacacionesGratificaciones;
