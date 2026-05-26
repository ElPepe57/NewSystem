/**
 * TabIncentivos.tsx
 *
 * chk5.PERSONAS-v5.4 · F4 · 2026-05-26
 *
 * Tab "Incentivos & Comisiones" del módulo Planilla.
 * Canon banking-grade sky · mockup docs/mockups/planilla-v5.4-completo.html ACTO 2.
 *
 * Vistas internas:
 *  - KPI mini strip (4 cards · bonos YTD · esquemas activos · cobertura · cálculo mes)
 *  - Lista de esquemas activos (cards)
 *  - Cálculos pendientes de aprobación (tabla)
 *
 * Modales (vienen en F5):
 *  - NuevoEsquemaIncentivoModal (wizard 3 pasos)
 *  - EditarEsquemaIncentivoModal
 *  - CalcularBonosMesModal
 *  - AprobarBonoModal / RechazarBonoModal
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Trophy,
  Zap,
  Plus,
  DollarSign,
  Target,
  TrendingUp,
  Calendar,
  Edit2,
  Pause,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Inbox,
} from 'lucide-react';
import { esquemaIncentivoService } from '../../../services/esquemaIncentivo.service';
import { calculoIncentivoService } from '../../../services/calculoIncentivo.service';
import { planillaService } from '../../../services/planilla.service';
import type {
  EsquemaIncentivo,
  CalculoIncentivoMes,
  TipoIncentivo,
} from '../../../types/planilla.types';
import { TIPO_INCENTIVO_LABELS } from '../../../types/planilla.types';
import { formatCurrencyPEN } from '../../../utils/format';

interface TabIncentivosProps {
  mes: number;
  anio: number;
  onNuevoEsquema?: () => void;
  onEditarEsquema?: (esquema: EsquemaIncentivo) => void;
  onCalcularMes?: (mes: number, anio: number) => void;
  onAprobarCalculo?: (calculo: CalculoIncentivoMes) => void;
  onRechazarCalculo?: (calculo: CalculoIncentivoMes) => void;
}

/** Mapa tipo → tinte canon (matchea badge colors del mockup) */
const TIPO_BADGE: Record<TipoIncentivo, { bg: string; text: string; border: string; label: string }> = {
  comision: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'TIPO A · COMISIÓN' },
  bono_meta: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', label: 'TIPO B · BONO META' },
  bono_kpi: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', label: 'TIPO C · KPI' },
  bono_fijo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', label: 'TIPO D · FIJO' },
};

/** Mapa tipo → icono canon */
const TIPO_ICON: Record<TipoIncentivo, { Icon: React.ComponentType<{ className?: string }>; iconBg: string; iconText: string }> = {
  comision: { Icon: DollarSign, iconBg: 'bg-emerald-100', iconText: 'text-emerald-700' },
  bono_meta: { Icon: Target, iconBg: 'bg-sky-100', iconText: 'text-sky-700' },
  bono_kpi: { Icon: TrendingUp, iconBg: 'bg-teal-100', iconText: 'text-teal-700' },
  bono_fijo: { Icon: Calendar, iconBg: 'bg-indigo-100', iconText: 'text-indigo-700' },
};

export const TabIncentivos: React.FC<TabIncentivosProps> = ({
  mes,
  anio,
  onNuevoEsquema,
  onEditarEsquema,
  onCalcularMes,
  onAprobarCalculo,
  onRechazarCalculo,
}) => {
  const [esquemas, setEsquemas] = useState<EsquemaIncentivo[]>([]);
  const [calculosMes, setCalculosMes] = useState<CalculoIncentivoMes[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEmpleados, setTotalEmpleados] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [esq, cal, emp] = await Promise.all([
          esquemaIncentivoService.listAll(),
          calculoIncentivoService.listMes(mes, anio),
          planillaService.getEmpleadosActivos(),
        ]);
        setEsquemas(esq);
        setCalculosMes(cal);
        setTotalEmpleados(emp.length);
      } catch (err) {
        console.error('[TabIncentivos] error cargando data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [mes, anio]);

  // ───── Stats canon mockup ─────
  const stats = useMemo(() => {
    const activos = esquemas.filter((e) => e.activo);
    const pausados = esquemas.filter((e) => !e.activo);

    // Cobertura: empleados con al menos un esquema activo que los aplique
    // Heurística simple: contar userIds únicos en cálculos del mes
    const empleadosCubiertos = new Set(calculosMes.map((c) => c.userId)).size;

    // Total bonos del mes (estado incluido_en_boleta o aprobado)
    const bonosPagados = calculosMes
      .filter((c) => c.estado === 'incluido_en_boleta' || c.estado === 'aprobado')
      .reduce((s, c) => s + c.bonoCalculado, 0);

    const pendientes = calculosMes.filter((c) => c.estado === 'calculado');

    return {
      activos: activos.length,
      pausados: pausados.length,
      totalEsquemas: esquemas.length,
      bonosMes: bonosPagados,
      cobertura: empleadosCubiertos,
      cobertura_pct: totalEmpleados > 0 ? Math.round((empleadosCubiertos / totalEmpleados) * 100) : 0,
      totalEmpleados,
      pendientesAprobacion: pendientes,
    };
  }, [esquemas, calculosMes, totalEmpleados]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="text-[12px]">Cargando incentivos...</div>
      </div>
    );
  }

  // ───── Empty state canon · cuando no hay esquemas ─────
  if (esquemas.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-gradient-to-br from-sky-50 to-violet-50/40 ring-1 ring-sky-200 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-sky-100 rounded-xl flex items-center justify-center">
            <Trophy className="w-6 h-6 text-sky-700" />
          </div>
          <div className="text-[14px] font-bold text-slate-900 mb-1">No hay esquemas de incentivo</div>
          <p className="text-[12px] text-slate-600 mb-5 max-w-md mx-auto">
            Crea tu primer esquema para empezar a pagar comisiones a vendedores · bonos por meta a logística · bonos KPI a finanzas · o bonos fijos a gerencia.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {(Object.entries(TIPO_INCENTIVO_LABELS) as [TipoIncentivo, string][]).map(([tipo, label]) => {
              const cfg = TIPO_ICON[tipo];
              const badge = TIPO_BADGE[tipo];
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={onNuevoEsquema}
                  className={`bg-white border ${badge.border} rounded-xl p-3 text-left hover:shadow-sm transition-shadow`}
                >
                  <div className={`w-8 h-8 ${cfg.iconBg} rounded-lg flex items-center justify-center mb-2`}>
                    <cfg.Icon className={`w-4 h-4 ${cfg.iconText}`} />
                  </div>
                  <div className="text-[11px] font-bold text-slate-900">{label}</div>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onNuevoEsquema}
            className="mt-5 bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Crear primer esquema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* KPI mini strip · canon mockup ACTO 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-violet-50 ring-1 ring-violet-200 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-violet-700">BONOS DEL MES</div>
          <div className="text-lg font-bold tabular-nums text-violet-900">{formatCurrencyPEN(stats.bonosMes)}</div>
          <div className="text-[10px] text-violet-700">{calculosMes.length} cálculos</div>
        </div>
        <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-emerald-700">ESQUEMAS ACTIVOS</div>
          <div className="text-lg font-bold tabular-nums text-emerald-900">{stats.activos}</div>
          <div className="text-[10px] text-emerald-700">de {stats.totalEsquemas} totales</div>
        </div>
        <div className="bg-sky-50 ring-1 ring-sky-200 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-sky-700">COBERTURA</div>
          <div className="text-lg font-bold tabular-nums text-sky-900">
            {stats.cobertura}/{stats.totalEmpleados}
          </div>
          <div className="text-[10px] text-sky-700">{stats.cobertura_pct}% del equipo</div>
        </div>
        <div className="bg-amber-50 ring-1 ring-amber-200 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-amber-700">
            {stats.pendientesAprobacion.length > 0 ? 'PENDIENTE' : 'AL DÍA'}
          </div>
          <div className="text-lg font-bold tabular-nums text-amber-900">
            {stats.pendientesAprobacion.length > 0 ? stats.pendientesAprobacion.length : '✓'}
          </div>
          <div className="text-[10px] text-amber-700">
            {stats.pendientesAprobacion.length > 0
              ? `${stats.pendientesAprobacion.length} bonos por aprobar`
              : 'sin pendientes'}
          </div>
        </div>
      </div>

      {/* Acciones · esquemas */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-[14px] font-bold text-slate-900">
          Esquemas de incentivo ({stats.activos} activos · {stats.pausados} pausados)
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCalcularMes?.(mes, anio)}
            className="bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            Calcular bonos del mes
          </button>
          <button
            type="button"
            onClick={onNuevoEsquema}
            className="bg-white border border-violet-300 text-violet-700 text-[12px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-violet-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo esquema
          </button>
        </div>
      </div>

      {/* Lista cards de esquemas */}
      <div className="space-y-2">
        {esquemas.map((esq) => {
          const cfg = TIPO_ICON[esq.tipo];
          const badge = TIPO_BADGE[esq.tipo];
          return (
            <div
              key={esq.id}
              className="bg-white border border-violet-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 ${cfg.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <cfg.Icon className={`w-5 h-5 ${cfg.iconText}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[13px] font-bold text-slate-900">{esq.nombre}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        esq.activo
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {esq.activo ? 'ACTIVO' : 'PAUSADO'}
                    </span>
                    <span
                      className={`${badge.bg} ${badge.text} border ${badge.border} text-[9px] font-bold px-1.5 py-0.5 rounded uppercase`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  {esq.descripcion && (
                    <div className="text-[11px] text-slate-600 line-clamp-2">{esq.descripcion}</div>
                  )}
                  <div className="text-[11px] text-slate-600">
                    Aplica a:{' '}
                    <strong>
                      {esq.aplicableA.modo === 'rol'
                        ? `rol ${esq.aplicableA.rol}`
                        : esq.aplicableA.modo === 'usuarios'
                          ? `${esq.aplicableA.userIds.length} usuario(s) específico(s)`
                          : 'todos los empleados activos'}
                    </strong>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onEditarEsquema?.(esq)}
                    className="text-[11px] text-violet-600 font-bold px-2 py-1 hover:bg-violet-50 rounded inline-flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-slate-600 font-medium px-2 py-1 hover:bg-slate-100 rounded inline-flex items-center gap-1"
                  >
                    <Pause className="w-3 h-3" />
                    {esq.activo ? 'Pausar' : 'Reactivar'}
                  </button>
                  <button
                    type="button"
                    className="p-1 hover:bg-slate-100 rounded"
                    title="Más acciones"
                  >
                    <MoreHorizontal className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Banner cálculos pendientes de aprobación */}
      {stats.pendientesAprobacion.length > 0 && (
        <div className="bg-amber-50 ring-1 ring-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 className="text-[13px] font-bold text-amber-900">
              {stats.pendientesAprobacion.length} bono{stats.pendientesAprobacion.length !== 1 ? 's' : ''}{' '}
              pendiente{stats.pendientesAprobacion.length !== 1 ? 's' : ''} de aprobación
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-amber-200 text-left text-[10px] uppercase text-amber-700 font-bold">
                  <th className="py-2 pr-2">Empleado</th>
                  <th className="pr-2">Esquema</th>
                  <th className="text-right pr-2">Métrica</th>
                  <th className="text-right pr-2">Bono</th>
                  <th className="text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {stats.pendientesAprobacion.map((c) => (
                  <tr key={c.id} className="border-b border-amber-100">
                    <td className="py-2 pr-2 font-semibold text-slate-900">{c.empleadoNombre}</td>
                    <td className="pr-2 text-[11px] text-sky-700">{c.esquemaNombre}</td>
                    <td className="text-right pr-2 tabular-nums">
                      {c.metricaCalculada.valorMedido.toLocaleString('es-PE')} {c.metricaCalculada.unidad}
                    </td>
                    <td className="text-right pr-2 tabular-nums font-bold text-violet-700">
                      {formatCurrencyPEN(c.bonoCalculado)}
                    </td>
                    <td className="text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onAprobarCalculo?.(c)}
                        className="text-[11px] text-emerald-700 font-bold mr-2 inline-flex items-center gap-0.5"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => onRechazarCalculo?.(c)}
                        className="text-[11px] text-rose-600 font-medium inline-flex items-center gap-0.5"
                      >
                        <XCircle className="w-3 h-3" />
                        Rechazar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state cálculos · cuando hay esquemas pero ningún cálculo del mes */}
      {calculosMes.length === 0 && esquemas.filter((e) => e.activo).length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center">
          <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <div className="text-[12px] font-semibold text-slate-700 mb-0.5">
            Sin cálculos para este mes
          </div>
          <p className="text-[11px] text-slate-500 mb-3">
            Ejecuta el cálculo automático para procesar bonos del mes actual.
          </p>
          <button
            type="button"
            onClick={() => onCalcularMes?.(mes, anio)}
            className="bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
          >
            <Zap className="w-3 h-3" />
            Calcular bonos ahora
          </button>
        </div>
      )}
    </div>
  );
};

export default TabIncentivos;
