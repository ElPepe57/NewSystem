/**
 * MisIncentivos · F10.F.1.I-FIX · 2026-05-27
 *
 * PIXEL-PERFECT REWRITE · canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 6 (líneas 810-828).
 *
 * El mockup lo llama "Mis esquemas de incentivo aplicables".
 * Patrón canon:
 *   - bg-white border border-slate-200 rounded-xl p-5
 *   - h3 text-[14px] font-bold con icon trophy text-violet-700
 *   - cards internos: bg-violet-50/40 border border-violet-200 rounded-lg p-3 flex
 *   - icon container w-8 h-8 bg-emerald-100 rounded-lg
 *   - text-[12px] font-bold título · text-[11px] text-slate-600 descripción
 *   - text-[10px] text-emerald-700 "Acumulado mayo: <font-bold tabular>"
 *   - chip text-[9px] bg-emerald-100 ACTIVO uppercase
 */
import React from 'react';
import { Trophy, DollarSign, Target, Award, Gift } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CalculoIncentivoMes } from '../../../types/planilla.types';

interface Props {
  calculos: CalculoIncentivoMes[];
  loading?: boolean;
  /** Esquemas aplicables del empleado · si NO se pasa, derivado de los calculos */
  esquemasAplicables?: Array<{
    id: string;
    nombre: string;
    tipo: 'comision' | 'bono_meta' | 'bono_kpi' | 'bono_fijo';
    descripcion: string;
    activo: boolean;
  }>;
}

const TIPO_ICON: Record<string, LucideIcon> = {
  comision: DollarSign,
  bono_meta: Target,
  bono_kpi: Award,
  bono_fijo: Gift,
};

const TIPO_ICON_BG: Record<string, string> = {
  comision: 'bg-emerald-100',
  bono_meta: 'bg-sky-100',
  bono_kpi: 'bg-violet-100',
  bono_fijo: 'bg-amber-100',
};

const TIPO_ICON_COLOR: Record<string, string> = {
  comision: 'text-emerald-700',
  bono_meta: 'text-sky-700',
  bono_kpi: 'text-violet-700',
  bono_fijo: 'text-amber-700',
};

const MES_LABEL = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const fmtTabular = (n: number): string =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const MisIncentivos: React.FC<Props> = ({ calculos, loading = false, esquemasAplicables }) => {
  // Derivar esquemas únicos desde los calculos · si no se pasaron esquemasAplicables
  const esquemas = esquemasAplicables ?? (() => {
    const map = new Map<string, { id: string; nombre: string; tipo: any; descripcion: string; activo: boolean }>();
    for (const c of calculos) {
      if (!map.has(c.esquemaId)) {
        map.set(c.esquemaId, {
          id: c.esquemaId,
          nombre: c.esquemaNombre,
          tipo: c.esquemaTipo,
          descripcion: c.metricaCalculada.detalle?.descripcion || '',
          activo: true,
        });
      }
    }
    return Array.from(map.values());
  })();

  // Acumulado del mes actual por esquema
  const ahora = new Date();
  const mesActual = ahora.getMonth() + 1;
  const anioActual = ahora.getFullYear();
  const acumuladoPorEsquema = new Map<string, number>();
  for (const c of calculos) {
    if (c.mes === mesActual && c.anio === anioActual) {
      acumuladoPorEsquema.set(c.esquemaId, (acumuladoPorEsquema.get(c.esquemaId) || 0) + c.bonoCalculado);
    }
  }
  const mesActualLabel = MES_LABEL[mesActual];

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="text-center text-slate-400 text-[11px] py-3">Cargando incentivos...</div>
      </div>
    );
  }

  if (esquemas.length === 0) {
    // Empty state canon · NO ocultar la card
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-[14px] font-bold text-slate-900 mb-3 inline-flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-violet-700" />
          Mis esquemas de incentivo aplicables
        </h3>
        <div className="text-center py-3">
          <Trophy className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
          <div className="text-[12px] font-semibold text-slate-700">Sin esquemas activos</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Cuando RRHH te asigne un esquema · aparecerá aquí.
          </div>
        </div>
      </div>
    );
  }

  return (
    // Canon mockup ACTO 6 · líneas 810-828 · copy-paste literal
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="text-[14px] font-bold text-slate-900 mb-3 inline-flex items-center gap-1.5">
        <Trophy className="w-4 h-4 text-violet-700" />
        Mis esquemas de incentivo aplicables
      </h3>
      <div className="space-y-2">
        {esquemas.map((esq) => {
          const Icon = TIPO_ICON[esq.tipo] || DollarSign;
          const bgIcon = TIPO_ICON_BG[esq.tipo] || 'bg-emerald-100';
          const colorIcon = TIPO_ICON_COLOR[esq.tipo] || 'text-emerald-700';
          const acumulado = acumuladoPorEsquema.get(esq.id) || 0;
          return (
            <div
              key={esq.id}
              className="bg-violet-50/40 border border-violet-200 rounded-lg p-3 flex items-center gap-3"
            >
              <div className={`w-8 h-8 ${bgIcon} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${colorIcon}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-slate-900">{esq.nombre}</div>
                {esq.descripcion && (
                  <div className="text-[11px] text-slate-600 truncate">{esq.descripcion}</div>
                )}
                {acumulado > 0 && (
                  <div className="text-[10px] text-emerald-700 mt-0.5">
                    Acumulado {mesActualLabel}:{' '}
                    <span className="font-bold tabular-nums">S/ {fmtTabular(acumulado)}</span>
                  </div>
                )}
              </div>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0 ${
                  esq.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {esq.activo ? 'Activo' : 'Pausado'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MisIncentivos;
