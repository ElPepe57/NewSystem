/**
 * Tab 3 · Trayectoria del negocio 24 meses
 *
 * Chart SVG responsive con 3 líneas (Activos · Patrimonio · Equity Ratio).
 * Hitos clave auto-detectados (G del mockup): mejor mes ventas + último aporte
 * + mes con pérdida. Insight ejecutivo automático al pie.
 *
 * Mobile: chart altura mínima 200px · labels eje X reducidos a 3.
 */
import React from 'react';
import { LineChart, Lightbulb, Award, Calendar, AlertCircle } from 'lucide-react';
import { formatCurrencyPEN } from '../../../utils/format';
import { MESES_NOMBRES } from './shared';
import type {
  ResumenInversionista,
  TrayectoriaMensual,
} from '../../../types/inversionista.types';

interface Props {
  data: ResumenInversionista;
}

interface Hito {
  tipo: 'positivo' | 'neutro' | 'negativo';
  periodo: string;
  descripcion: string;
}

function detectarHitos(trayectoria: TrayectoriaMensual[]): Hito[] {
  if (trayectoria.length === 0) return [];
  const hitos: Hito[] = [];

  // 1. Mejor mes en ventas
  const mejorVentas = [...trayectoria].sort((a, b) => b.ventas - a.ventas)[0];
  if (mejorVentas && mejorVentas.ventas > 0) {
    hitos.push({
      tipo: 'positivo',
      periodo: `${MESES_NOMBRES[mejorVentas.mes - 1]} ${mejorVentas.anio}`,
      descripcion: `récord ventas ${formatCurrencyPEN(mejorVentas.ventas)}`,
    });
  }

  // 2. Mejor mes en utilidad
  const mejorUN = [...trayectoria].sort((a, b) => b.utilidadNeta - a.utilidadNeta)[0];
  if (mejorUN && mejorUN.utilidadNeta > 0 && mejorUN !== mejorVentas) {
    hitos.push({
      tipo: 'positivo',
      periodo: `${MESES_NOMBRES[mejorUN.mes - 1]} ${mejorUN.anio}`,
      descripcion: `mejor utilidad ${formatCurrencyPEN(mejorUN.utilidadNeta)}`,
    });
  }

  // 3. Mes con pérdida (si existe)
  const peorUN = [...trayectoria].sort((a, b) => a.utilidadNeta - b.utilidadNeta)[0];
  if (peorUN && peorUN.utilidadNeta < 0) {
    hitos.push({
      tipo: 'negativo',
      periodo: `${MESES_NOMBRES[peorUN.mes - 1]} ${peorUN.anio}`,
      descripcion: `mes con pérdida ${formatCurrencyPEN(peorUN.utilidadNeta)}`,
    });
  }

  return hitos.slice(0, 3);
}

function generarInsight(trayectoria: TrayectoriaMensual[], equityActual: number): string {
  if (trayectoria.length < 2) return 'Aún hay poca data histórica para análisis de tendencia.';
  const inicial = trayectoria.find((t) => t.equityRatio > 0);
  const equityInicial = inicial ? inicial.equityRatio * 100 : 0;
  const patrimonioInicial = inicial?.patrimonio || 0;
  const patrimonioFinal = trayectoria[trayectoria.length - 1].patrimonio;
  const multiplicador = patrimonioInicial > 0 ? patrimonioFinal / patrimonioInicial : 0;

  if (equityActual > equityInicial && multiplicador > 1) {
    return `Equity ratio creció de ${equityInicial.toFixed(0)}% a ${equityActual.toFixed(0)}% · estás cada vez menos apalancado · patrimonio se multiplicó ${multiplicador.toFixed(1)}x en el período.`;
  }
  if (multiplicador > 1) {
    return `Patrimonio creció ${multiplicador.toFixed(1)}x en el período · trayectoria positiva pero el apalancamiento subió. Monitorear.`;
  }
  return 'Trayectoria estable. Revisar drivers de crecimiento.';
}

function TrayectoriaChart({ trayectoria }: { trayectoria: TrayectoriaMensual[] }) {
  if (trayectoria.length === 0) {
    return (
      <div className="bg-slate-50 rounded-xl p-4 h-48 sm:h-64 flex items-center justify-center text-[11px] text-slate-500">
        Sin data histórica suficiente para mostrar trayectoria.
      </div>
    );
  }

  const maxActivos = Math.max(...trayectoria.map((t) => t.activos), 1);
  const maxPatrimonio = Math.max(...trayectoria.map((t) => t.patrimonio), 1);
  const maxValue = Math.max(maxActivos, maxPatrimonio);

  const w = 400;
  const h = 200;
  const padTop = 20;
  const padBottom = 30;
  const chartH = h - padTop - padBottom;

  const xStep = trayectoria.length > 1 ? w / (trayectoria.length - 1) : 0;
  const yScale = (v: number) => h - padBottom - (v / maxValue) * chartH;
  const yScalePct = (v: number) => h - padBottom - v * chartH;

  const activosPoints = trayectoria.map((t, i) => `${i * xStep},${yScale(t.activos)}`).join(' ');
  const patrimonioPoints = trayectoria.map((t, i) => `${i * xStep},${yScale(t.patrimonio)}`).join(' ');
  const equityPoints = trayectoria.map((t, i) => `${i * xStep},${yScalePct(t.equityRatio)}`).join(' ');

  const lastIdx = trayectoria.length - 1;
  const lastX = lastIdx * xStep;

  // Labels eje X · 3 puntos para mobile, hasta 5 desktop
  const labels: Array<{ idx: number; label: string }> = [];
  if (trayectoria.length >= 1) {
    labels.push({ idx: 0, label: `${MESES_NOMBRES[trayectoria[0].mes - 1]}/${String(trayectoria[0].anio).slice(2)}` });
  }
  if (trayectoria.length >= 4) {
    const m = Math.floor(trayectoria.length / 2);
    labels.push({ idx: m, label: `${MESES_NOMBRES[trayectoria[m].mes - 1]}/${String(trayectoria[m].anio).slice(2)}` });
  }
  if (trayectoria.length >= 2) {
    labels.push({ idx: lastIdx, label: 'Hoy' });
  }

  return (
    <div className="bg-slate-50 rounded-xl p-3 sm:p-4 h-48 sm:h-64 relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
        {/* Grid */}
        <line x1="0" y1={padTop} x2={w} y2={padTop} stroke="rgb(226 232 240)" strokeWidth="0.5" />
        <line x1="0" y1={(padTop + h - padBottom) / 2} x2={w} y2={(padTop + h - padBottom) / 2} stroke="rgb(226 232 240)" strokeWidth="0.5" />
        <line x1="0" y1={h - padBottom} x2={w} y2={h - padBottom} stroke="rgb(226 232 240)" strokeWidth="0.5" />

        {/* Activos · teal */}
        <polyline points={activosPoints} fill="none" stroke="rgb(20 184 166)" strokeWidth="2.5" />
        {/* Patrimonio · indigo */}
        <polyline points={patrimonioPoints} fill="none" stroke="rgb(79 70 229)" strokeWidth="2.5" />
        {/* Equity Ratio · emerald dashed */}
        <polyline points={equityPoints} fill="none" stroke="rgb(5 150 105)" strokeWidth="2.5" strokeDasharray="3 2" />

        {/* Puntos finales */}
        <circle cx={lastX} cy={yScale(trayectoria[lastIdx].activos)} r="3" fill="rgb(20 184 166)" />
        <circle cx={lastX} cy={yScale(trayectoria[lastIdx].patrimonio)} r="3" fill="rgb(79 70 229)" />
        <circle cx={lastX} cy={yScalePct(trayectoria[lastIdx].equityRatio)} r="3" fill="rgb(5 150 105)" />
      </svg>

      {/* Labels eje X · posición absoluta para flex pero NO romper SVG */}
      <div className="flex justify-between text-[9px] text-slate-500 mt-1 absolute bottom-2 left-3 right-3 sm:left-4 sm:right-4">
        {labels.map((l) => (
          <span key={l.idx}>{l.label}</span>
        ))}
      </div>
    </div>
  );
}

export default function InversionistasTrayectoria({ data }: Props) {
  const hitos = detectarHitos(data.trayectoria);
  const insight = generarInsight(data.trayectoria, data.equityRatio.porcentaje);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-[12px] font-bold text-slate-900 flex items-center gap-2">
          <LineChart className="w-4 h-4 text-violet-600" />
          Activos · Patrimonio · Equity Ratio
        </h3>
        <div className="flex items-center gap-2 text-[10px] flex-wrap">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-teal-500 rounded-full"></div> Activos
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div> Patrimonio
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Equity Ratio
          </span>
        </div>
      </div>

      <TrayectoriaChart trayectoria={data.trayectoria} />

      {/* Hitos clave · grid responsive */}
      {hitos.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2">Hitos clave detectados</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
            {hitos.map((h, i) => (
              <div key={i} className="flex items-start gap-2">
                {h.tipo === 'positivo' && <Award className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />}
                {h.tipo === 'neutro' && <Calendar className="w-3 h-3 text-indigo-500 mt-0.5 flex-shrink-0" />}
                {h.tipo === 'negativo' && <AlertCircle className="w-3 h-3 text-rose-500 mt-0.5 flex-shrink-0" />}
                <span>
                  <strong className={
                    h.tipo === 'positivo' ? 'text-emerald-700' :
                    h.tipo === 'negativo' ? 'text-rose-700' :
                    'text-indigo-700'
                  }>
                    {h.periodo}
                  </strong>
                  {' · '}
                  {h.descripcion}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insight ejecutivo */}
      <div className="mt-4 pt-3 border-t border-slate-100 bg-emerald-50/30 -mx-4 sm:-mx-5 px-4 sm:px-5 py-2.5 text-[11px] text-emerald-900 flex items-start gap-2">
        <Lightbulb className="w-3.5 h-3.5 text-emerald-700 mt-0.5 flex-shrink-0" />
        <div>
          <strong>Lectura ejecutiva:</strong> {insight}
        </div>
      </div>
    </div>
  );
}
