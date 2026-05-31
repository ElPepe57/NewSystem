/**
 * IndicadoresPreguntasView · canon v5.2 chk5.E-C · Sprint C
 *
 * Vista alternativa de Indicadores reorganizada como 4 preguntas user-friendly:
 * - ¿Cuánto estás ganando? (Rentabilidad emerald)
 * - ¿Tenés plata para pagar? (Liquidez sky)
 * - ¿Qué tan eficiente sos? (Eficiencia amber)
 * - ¿Estás muy endeudado? (Endeudamiento rose)
 *
 * Reutiliza los mismos cálculos del IndicadoresFinancieros · solo cambia presentación.
 *
 * Pixel-perfect contra docs/mockups/contabilidad-indicadores-preguntas-v5.2.html
 */

import React from 'react';
import {
  TrendingUp,
  Droplet,
  Zap,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { IndicadoresFinancieros } from '../../../types/contabilidad.types';
import { formatCurrencyPEN, formatPercent } from '../../../utils/format';

interface Props {
  indicadores: IndicadoresFinancieros;
}

// Tipo respuesta · una sub-respuesta dentro de una pregunta
interface Respuesta {
  /** Pregunta concreta user-friendly */
  pregunta: string;
  /** Nombre técnico (italic small) */
  tecnico: string;
  /** Valor display formateado · ej. "S/ 17.40" o "3.21x" */
  valor: string;
  /** Es el KEY ratio destacado (★) · uno por pregunta */
  esKey?: boolean;
  /** Estado de salud · controla color del valor */
  estado: 'excelente' | 'bueno' | 'regular' | 'atencion' | 'critico';
  /** Texto meta · ej. "✓ meta ≥40%" */
  meta: string;
}

const ESTADO_COLOR: Record<Respuesta['estado'], string> = {
  excelente: 'text-emerald-700',
  bueno: 'text-emerald-700',
  regular: 'text-amber-700',
  atencion: 'text-amber-700',
  critico: 'text-rose-700',
};

const ESTADO_LABEL: Record<Respuesta['estado'], string> = {
  excelente: '✓ Excelente',
  bueno: '✓ OK',
  regular: '✓ Normal',
  atencion: '⚠ Atención',
  critico: '✗ Crítico',
};

interface CardPreguntaProps {
  titulo: string;
  subtitulo: string;
  color: 'emerald' | 'sky' | 'amber' | 'rose';
  icon: React.ComponentType<{ className?: string }>;
  respuestas: Respuesta[];
}

const COLOR_MAP: Record<
  CardPreguntaProps['color'],
  {
    border: string;
    headerBg: string;
    headerBorder: string;
    iconBg: string;
    titleColor: string;
    subtitleColor: string;
  }
> = {
  emerald: {
    border: 'border-emerald-200',
    headerBg: 'bg-gradient-to-r from-emerald-50 to-emerald-100/40',
    headerBorder: 'border-emerald-200/50',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
    titleColor: 'text-emerald-900',
    subtitleColor: 'text-emerald-700',
  },
  sky: {
    border: 'border-sky-200',
    headerBg: 'bg-gradient-to-r from-sky-50 to-sky-100/40',
    headerBorder: 'border-sky-200/50',
    iconBg: 'bg-gradient-to-br from-sky-500 to-sky-700',
    titleColor: 'text-sky-900',
    subtitleColor: 'text-sky-700',
  },
  amber: {
    border: 'border-amber-200',
    headerBg: 'bg-gradient-to-r from-amber-50 to-amber-100/40',
    headerBorder: 'border-amber-200/50',
    iconBg: 'bg-gradient-to-br from-amber-500 to-amber-700',
    titleColor: 'text-amber-900',
    subtitleColor: 'text-amber-700',
  },
  rose: {
    border: 'border-rose-200',
    headerBg: 'bg-gradient-to-r from-rose-50 to-rose-100/40',
    headerBorder: 'border-rose-200/50',
    iconBg: 'bg-gradient-to-br from-rose-500 to-rose-700',
    titleColor: 'text-rose-900',
    subtitleColor: 'text-rose-700',
  },
};

const CardPregunta: React.FC<CardPreguntaProps> = ({
  titulo,
  subtitulo,
  color,
  icon: Icon,
  respuestas,
}) => {
  const c = COLOR_MAP[color];
  const okCount = respuestas.filter((r) => r.estado === 'excelente' || r.estado === 'bueno').length;
  const alertCount = respuestas.filter((r) => r.estado === 'atencion' || r.estado === 'critico').length;

  return (
    <div className={`bg-white border ${c.border} rounded-2xl overflow-hidden`}>
      <div className={`${c.headerBg} px-5 py-4 border-b ${c.headerBorder}`}>
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center text-white flex-shrink-0`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className={`text-[15px] font-bold ${c.titleColor}`}>{titulo}</h3>
            <p className={`text-[11px] ${c.subtitleColor}`}>{subtitulo}</p>
          </div>
          {alertCount > 0 ? (
            <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded font-bold whitespace-nowrap">
              {okCount} OK · {alertCount} ⚠
            </span>
          ) : (
            <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold whitespace-nowrap">
              {okCount} OK
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {respuestas.map((r, i) => {
          const valorColor = ESTADO_COLOR[r.estado];
          return (
            <div key={i} className={`px-5 py-3 ${r.esKey ? `${c.headerBg}` : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-slate-900 flex items-center gap-1 flex-wrap">
                    {r.pregunta}
                    {r.esKey && (
                      <span className="text-[8px] bg-teal-100 text-teal-700 px-1 rounded font-bold whitespace-nowrap">
                        ★ KEY
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 italic">técnicamente: {r.tecnico}</div>
                </div>
                <div className={`text-[20px] font-bold tabular-nums whitespace-nowrap ${valorColor}`}>
                  {r.valor}
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span
                  className={`flex items-center gap-1 ${
                    r.estado === 'critico' || r.estado === 'atencion'
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {r.estado === 'critico' || r.estado === 'atencion' ? (
                    <AlertTriangle className="w-3 h-3" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  {ESTADO_LABEL[r.estado]} · {r.meta}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const IndicadoresPreguntasView: React.FC<Props> = ({ indicadores }) => {
  const { rentabilidad, liquidez, actividad, solvencia } = indicadores;

  // === ¿Cuánto estás ganando? · 4 ratios ===
  const margenNetoEnSoles = rentabilidad.margenNeto; // % · convertimos a "por cada S/100"
  const margenNetoPorCien = (rentabilidad.margenNeto / 100) * 100; // en %
  const ganando: Respuesta[] = [
    {
      pregunta: 'De cada S/100 vendidos · te quedan limpios:',
      tecnico: 'Margen Neto',
      valor: `S/ ${margenNetoEnSoles.toFixed(2)}`,
      estado:
        rentabilidad.margenNeto >= 15
          ? 'excelente'
          : rentabilidad.margenNeto >= 10
            ? 'bueno'
            : rentabilidad.margenNeto >= 5
              ? 'regular'
              : rentabilidad.margenNeto > 0
                ? 'atencion'
                : 'critico',
      meta: rentabilidad.margenNeto >= 10 ? 'meta ≥ S/10' : 'meta ≥ S/10 · subir margen',
    },
    {
      pregunta: 'Después de pagar el producto · te queda:',
      tecnico: 'Margen Bruto',
      valor: `${formatPercent(rentabilidad.margenBruto)}`,
      estado:
        rentabilidad.margenBruto >= 55
          ? 'excelente'
          : rentabilidad.margenBruto >= 40
            ? 'bueno'
            : rentabilidad.margenBruto >= 30
              ? 'regular'
              : 'atencion',
      meta: rentabilidad.margenBruto >= 40 ? 'meta ≥ 40%' : 'meta ≥ 40%',
    },
    {
      pregunta: 'Ganancia operativa pura del negocio:',
      tecnico: 'EBITDA / Ventas',
      // EBITDA% no está directamente · usamos margen operativo · indicador clave
      valor: `${formatPercent(rentabilidad.margenOperativo ?? 0)}`,
      esKey: true,
      estado:
        (rentabilidad.margenOperativo ?? 0) >= 15
          ? 'excelente'
          : (rentabilidad.margenOperativo ?? 0) >= 10
            ? 'bueno'
            : (rentabilidad.margenOperativo ?? 0) > 0
              ? 'regular'
              : 'critico',
      meta: 'meta ≥ 15%',
    },
    {
      pregunta: 'Por cada S/100 socios invirtieron · generás:',
      tecnico: 'ROE anualizado',
      valor: `S/ ${rentabilidad.roe.toFixed(2)}`,
      estado:
        rentabilidad.roe >= 15
          ? 'excelente'
          : rentabilidad.roe >= 10
            ? 'bueno'
            : rentabilidad.roe > 0
              ? 'regular'
              : 'critico',
      meta: rentabilidad.roe >= 15 ? 'mejor que plazo fijo' : 'meta ≥ S/15',
    },
  ];

  // === ¿Tenés plata para pagar? · 3 ratios ===
  const pagar: Respuesta[] = [
    {
      pregunta: 'Por S/1 de deuda corto plazo · tenés:',
      tecnico: 'Liquidez Corriente',
      valor: `S/ ${liquidez.razonCorriente.toFixed(2)}`,
      esKey: true,
      estado:
        liquidez.razonCorriente >= 2.0
          ? 'excelente'
          : liquidez.razonCorriente >= 1.5
            ? 'bueno'
            : liquidez.razonCorriente >= 1.0
              ? 'regular'
              : 'critico',
      meta: 'meta ≥ S/1.50',
    },
    {
      pregunta: 'Sin contar inventario · te queda en efectivo:',
      tecnico: 'Liquidez Ácida',
      valor: `S/ ${liquidez.pruebaAcida.toFixed(2)}`,
      estado:
        liquidez.pruebaAcida >= 1.0
          ? 'excelente'
          : liquidez.pruebaAcida >= 0.7
            ? 'bueno'
            : liquidez.pruebaAcida >= 0.5
              ? 'regular'
              : 'atencion',
      meta: 'meta ≥ S/1.00',
    },
    {
      pregunta: 'Plata extra para operar (capital trabajo):',
      tecnico: 'Capital de Trabajo',
      valor: formatCurrencyPEN(liquidez.capitalTrabajo),
      estado: liquidez.capitalTrabajo >= 0 ? 'excelente' : 'critico',
      meta: 'positivo = saludable',
    },
  ];

  // === ¿Qué tan eficiente sos? · 4 ratios ===
  const eficiente: Respuesta[] = [
    {
      pregunta: 'Tardás en cobrar a clientes:',
      tecnico: 'DSO · Days Sales Outstanding',
      valor: `${actividad.diasCobro.toFixed(0)} días`,
      estado:
        actividad.diasCobro <= 30
          ? 'excelente'
          : actividad.diasCobro <= 50
            ? 'bueno'
            : actividad.diasCobro <= 75
              ? 'regular'
              : 'atencion',
      meta: 'meta ≤ 30 días',
    },
    {
      pregunta: 'Días que dura el inventario:',
      tecnico: 'Días Inventario · DIO',
      valor: `${actividad.diasInventario.toFixed(0)} días`,
      estado:
        actividad.diasInventario <= 60
          ? 'excelente'
          : actividad.diasInventario <= 90
            ? 'bueno'
            : actividad.diasInventario <= 120
              ? 'regular'
              : 'atencion',
      meta: 'meta ≤ 90 días',
    },
    {
      pregunta: 'Tardás en pagar proveedores:',
      tecnico: 'DPO · Days Payable Outstanding',
      valor: `${actividad.diasPago.toFixed(0)} días`,
      estado:
        actividad.diasPago >= 45
          ? 'excelente'
          : actividad.diasPago >= 30
            ? 'bueno'
            : 'regular',
      meta: 'equilibrio con proveedores',
    },
    {
      pregunta: 'Veces que rotás inventario al año:',
      tecnico: 'Rotación Inventario',
      valor: `${actividad.rotacionInventarios.toFixed(1)}x`,
      esKey: true,
      estado:
        actividad.rotacionInventarios >= 6
          ? 'excelente'
          : actividad.rotacionInventarios >= 4
            ? 'bueno'
            : actividad.rotacionInventarios >= 2
              ? 'regular'
              : 'atencion',
      meta: 'meta ≥ 6x al año',
    },
  ];

  // === ¿Estás muy endeudado? · 2 ratios ===
  const endeudado: Respuesta[] = [
    {
      pregunta: 'De cada S/100 que tenés · debés:',
      tecnico: 'Ratio Endeudamiento',
      valor: `S/ ${solvencia.endeudamientoTotal.toFixed(0)}`,
      esKey: true,
      estado:
        solvencia.endeudamientoTotal <= 40
          ? 'excelente'
          : solvencia.endeudamientoTotal <= 60
            ? 'bueno'
            : solvencia.endeudamientoTotal <= 80
              ? 'regular'
              : 'atencion',
      meta: 'meta ≤ S/50 · bajando',
    },
    {
      pregunta: 'Por S/1 que socios invirtieron · debés:',
      tecnico: 'Deuda / Patrimonio',
      valor: `S/ ${(solvencia.endeudamientoPatrimonio / 100).toFixed(2)}`,
      estado:
        solvencia.endeudamientoPatrimonio <= 80
          ? 'excelente'
          : solvencia.endeudamientoPatrimonio <= 120
            ? 'bueno'
            : 'atencion',
      meta: 'meta ≤ S/1.00 · cómodo',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CardPregunta
        titulo="¿Cuánto estás ganando?"
        subtitulo="Mide rentabilidad"
        color="emerald"
        icon={TrendingUp}
        respuestas={ganando}
      />
      <CardPregunta
        titulo="¿Tenés plata para pagar?"
        subtitulo="Mide liquidez"
        color="sky"
        icon={Droplet}
        respuestas={pagar}
      />
      <CardPregunta
        titulo="¿Qué tan eficiente sos?"
        subtitulo="Mide rotación capital"
        color="amber"
        icon={Zap}
        respuestas={eficiente}
      />
      <CardPregunta
        titulo="¿Estás muy endeudado?"
        subtitulo="Mide dependencia financiera"
        color="rose"
        icon={CreditCard}
        respuestas={endeudado}
      />
    </div>
  );
};

export default IndicadoresPreguntasView;
