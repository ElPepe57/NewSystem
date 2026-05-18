/**
 * CalendarioObligaciones — chk5.D-S3.quinto · SF5
 *
 * Heatmap mensual de compromisos canon MOCK 4 §7.
 * Grid 7 cols (días semana) × ~5 filas con dots semánticos por tipo.
 *
 * Dots:
 *   - rose · vencido
 *   - amber · TC
 *   - indigo · OC
 *   - purple · sueldo/recaudador
 *   - slate · gasto
 *
 * 3 cards footer: vencimientos críticos + TC ciclo cerrado + nómina.
 */

import React from 'react';
import type { CalendarioMes, CalendarioEvento } from './analisisHelpers';
import { fmtMonto } from './analisisHelpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface CalendarioObligacionesProps {
  data: CalendarioMes;
}

// ═════════════════════════════════════════════════════════════════════════
// MAPS canon
// ═════════════════════════════════════════════════════════════════════════

const DOT_COLOR: Record<CalendarioEvento['tipo'], string> = {
  vencido: 'bg-rose-500',
  tc: 'bg-amber-500',
  oc: 'bg-indigo-500',
  sueldo: 'bg-purple-500',
  recaudador: 'bg-purple-500',
  gasto: 'bg-slate-500',
};

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const CalendarioObligaciones: React.FC<CalendarioObligacionesProps> = ({ data }) => {
  const hoy = new Date();
  const esHoyEnEsteMes =
    hoy.getFullYear() === data.anio && hoy.getMonth() === data.mes;
  const diaHoy = esHoyEnEsteMes ? hoy.getDate() : -1;

  // Construir grid de días (incluyendo padding de meses adyacentes)
  const primerDia = new Date(data.anio, data.mes, 1);
  const ultimoDia = new Date(data.anio, data.mes + 1, 0);
  const diasMes = ultimoDia.getDate();
  // Día de semana del 1ro (0=domingo)
  const offsetInicio = primerDia.getDay();

  // Indexar eventos por día
  const porDia = new Map<number, CalendarioEvento[]>();
  for (const ev of data.eventos) {
    const d = ev.fecha.getDate();
    if (!porDia.has(d)) porDia.set(d, []);
    porDia.get(d)!.push(ev);
  }

  // Calcular cuántas filas necesitamos
  const totalCeldas = offsetInicio + diasMes;
  const filas = Math.ceil(totalCeldas / 7);
  const totalCeldasGrid = filas * 7;

  // Eventos especiales para footer cards
  const vencimientosCriticos = data.eventos.filter((e) => e.tipo === 'vencido');
  const tcsCiclo = data.eventos.filter((e) => e.tipo === 'tc');
  const nominas = data.eventos.filter((e) => e.tipo === 'sueldo' || e.tipo === 'recaudador');

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-teal-700">
          § Calendario obligaciones · heatmap mensual
        </span>
        <div className="flex-1 h-px bg-teal-200" />
      </div>
      <p className="text-[12px] text-slate-500 max-w-2xl">
        Vista glance de TODOS los compromisos del mes en un solo calendario · dots semánticos por
        tipo (TC · OC · sueldo · gasto · vencido).
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div>
            <div className="text-[13px] font-bold text-slate-900">
              {NOMBRES_MESES[data.mes]} {data.anio}
            </div>
            <div className="text-[10px] text-slate-500">
              {data.eventos.length} eventos · S/ {fmtMonto(data.totalComprometido)} comprometido
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] flex-wrap">
            <LeyendaDot color="rose" label="Vencido" />
            <LeyendaDot color="amber" label="TC" />
            <LeyendaDot color="indigo" label="OC" />
            <LeyendaDot color="purple" label="Sueldo" />
            <LeyendaDot color="slate" label="Gasto" />
          </div>
        </div>

        {/* Grid calendario */}
        <div className="grid grid-cols-7 gap-1 text-[10px]">
          {/* Headers días */}
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => (
            <div
              key={d}
              className="text-center text-[9px] font-bold text-slate-500 uppercase"
            >
              {d}
            </div>
          ))}

          {/* Celdas */}
          {Array.from({ length: totalCeldasGrid }).map((_, idx) => {
            const numeroDia = idx - offsetInicio + 1;
            const enRango = numeroDia >= 1 && numeroDia <= diasMes;

            if (!enRango) {
              return (
                <div
                  key={idx}
                  className="aspect-square bg-slate-50 rounded text-center pt-1 text-slate-400"
                >
                  {numeroDia < 1
                    ? new Date(data.anio, data.mes, numeroDia).getDate()
                    : numeroDia - diasMes}
                </div>
              );
            }

            const eventosDia = porDia.get(numeroDia) ?? [];
            const esHoy = numeroDia === diaHoy;
            const tieneVencido = eventosDia.some((e) => e.tipo === 'vencido');
            const tieneTC = eventosDia.some((e) => e.tipo === 'tc');

            const cellBg = esHoy
              ? 'bg-teal-100 border-2 border-teal-500'
              : tieneVencido
              ? 'bg-rose-50 border border-rose-300'
              : tieneTC
              ? 'bg-amber-50 border-2 border-amber-400'
              : 'bg-white border border-slate-200';

            const cellText = esHoy ? 'text-teal-900 font-bold' : '';

            return (
              <div
                key={idx}
                className={`aspect-square rounded text-center pt-1 relative ${cellBg} ${cellText}`}
              >
                {numeroDia}
                {esHoy && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[8px]">
                    HOY
                  </span>
                )}
                {eventosDia.length > 0 && !esHoy && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {eventosDia.slice(0, 3).map((ev, i) => (
                      <span
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[ev.tipo]}`}
                        title={ev.label}
                      />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer 3 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 text-[11px]">
          {vencimientosCriticos.length > 0 ? (
            <FooterCard
              color="rose"
              label="Vencimientos críticos"
              value={vencimientosCriticos
                .slice(0, 2)
                .map((e) => `${e.fecha.getDate()}-${NOMBRES_MESES[e.fecha.getMonth()].slice(0, 3)} · ${e.label.slice(0, 18)}`)
                .join(' · ')}
            />
          ) : (
            <FooterCard color="rose" label="Vencimientos críticos" value="Sin vencidos" />
          )}
          {tcsCiclo.length > 0 ? (
            <FooterCard
              color="amber"
              label="TC ciclo cerrado"
              value={tcsCiclo
                .slice(0, 2)
                .map((e) => `${e.fecha.getDate()}-${NOMBRES_MESES[e.fecha.getMonth()].slice(0, 3)} · ${e.label.slice(0, 16)}`)
                .join(' · ')}
            />
          ) : (
            <FooterCard color="amber" label="TC ciclo cerrado" value="Sin TCs activas" />
          )}
          {nominas.length > 0 ? (
            <FooterCard
              color="purple"
              label="Nómina + alquiler"
              value={nominas
                .slice(0, 2)
                .map((e) => `${e.fecha.getDate()}-${NOMBRES_MESES[e.fecha.getMonth()].slice(0, 3)}`)
                .join(' · ')}
            />
          ) : (
            <FooterCard color="purple" label="Nómina" value="Sin nómina cargada" />
          )}
        </div>
      </div>
    </section>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═════════════════════════════════════════════════════════════════════════

interface LeyendaDotProps {
  color: 'rose' | 'amber' | 'indigo' | 'purple' | 'slate';
  label: string;
}

const DOT_LEY: Record<LeyendaDotProps['color'], string> = {
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  indigo: 'bg-indigo-500',
  purple: 'bg-purple-500',
  slate: 'bg-slate-500',
};

const LeyendaDot: React.FC<LeyendaDotProps> = ({ color, label }) => (
  <span className="flex items-center gap-1">
    <span className={`w-2 h-2 rounded-full ${DOT_LEY[color]}`} />
    {label}
  </span>
);

interface FooterCardProps {
  color: 'rose' | 'amber' | 'purple';
  label: string;
  value: string;
}

const FOOTER_BG: Record<FooterCardProps['color'], string> = {
  rose: 'bg-rose-50 ring-rose-200/50',
  amber: 'bg-amber-50 ring-amber-200/50',
  purple: 'bg-purple-50 ring-purple-200/50',
};
const FOOTER_LABEL: Record<FooterCardProps['color'], string> = {
  rose: 'text-rose-700',
  amber: 'text-amber-700',
  purple: 'text-purple-700',
};
const FOOTER_TEXT: Record<FooterCardProps['color'], string> = {
  rose: 'text-rose-900',
  amber: 'text-amber-900',
  purple: 'text-purple-900',
};

const FooterCard: React.FC<FooterCardProps> = ({ color, label, value }) => (
  <div className={`ring-1 rounded p-2 ${FOOTER_BG[color]}`}>
    <div className={`text-[9px] uppercase font-bold ${FOOTER_LABEL[color]}`}>{label}</div>
    <div className={`text-[10px] font-bold ${FOOTER_TEXT[color]} truncate`}>{value}</div>
  </div>
);
