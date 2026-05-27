/**
 * ResumenEmpleado · F10.F.1.J · 2026-05-27
 *
 * Vista RESUMEN del Tab cuando el user tiene datosLaborales (es empleado).
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 2 (líneas 178-303).
 *
 * Estructura:
 *   1. Banner pendientes propios "Tienes N pendientes que requieren tu atención"
 *   2. KPI mini strip 4 cards: MI SUELDO · PRÓX. BOLETA · MIS BONOS YTD · PRÓX. GRATIF.
 *   3. Quick actions personales 4 cards
 *   4. Cross-link CTA grande "Ir a planilla"
 *
 * Las pendientes accionables y las boletas/incentivos cards ya están en MiPerfil
 * (PendientesAccionables · MisBoletasRecientes · MisIncentivos) · este componente
 * agrega SOLO el banner + KPI strip + quick actions + cross-link grande.
 */
import React, { useMemo } from 'react';
import {
  AlertCircle,
  Wallet,
  FileText,
  Trophy,
  Gift,
  ArrowDownCircle,
  TrendingUp,
  Palmtree,
  BriefcaseBusiness,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DatosLaborales } from '../../../types/datosLaborales.types';
import type { Boleta, CalculoIncentivoMes } from '../../../types/planilla.types';

interface Props {
  datosLaborales: DatosLaborales | null;
  boletas: Boleta[];
  calculosIncentivo: CalculoIncentivoMes[];
  /** Cantidad de pendientes accionables del empleado (para el banner) */
  contadorPendientes: number;
}

const MES_LABEL = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_CORTO = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const fmtMoneyShort = (n: number): string => {
  if (n >= 1_000_000) return `S/ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `S/ ${Math.round(n / 1_000)}K`;
  return `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
};

const fmtMoney = (n: number): string =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const ResumenEmpleado: React.FC<Props> = ({
  datosLaborales,
  boletas,
  calculosIncentivo,
  contadorPendientes,
}) => {
  const navigate = useNavigate();

  // Datos derivados
  const sueldo = datosLaborales?.salarioBase ?? 0;
  const monedaSalario = datosLaborales?.monedaSalario ?? 'PEN';

  // Próxima boleta · cierre del mes en curso
  const ahora = new Date();
  const ultimoDiaMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
  const diasHastaBoleta = Math.max(0, Math.ceil((ultimoDiaMes.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)));

  // Estimar neto próxima boleta · sueldo - 0 descuentos + bonos del mes
  const mesActual = ahora.getMonth() + 1;
  const anioActual = ahora.getFullYear();
  const calculosDelMes = calculosIncentivo.filter((c) => c.mes === mesActual && c.anio === anioActual);
  const bonosDelMes = calculosDelMes.reduce((sum, c) => sum + c.bonoCalculado, 0);
  const proxNetoEstimado = sueldo + bonosDelMes;

  // Bonos YTD · suma de calculos del año actual
  const bonosYTD = useMemo(() => {
    return calculosIncentivo
      .filter((c) => c.anio === anioActual)
      .reduce((sum, c) => sum + c.bonoCalculado, 0);
  }, [calculosIncentivo, anioActual]);

  // Esquemas activos · cuenta de calculos únicos por esquemaId YTD
  const esquemasActivos = useMemo(() => {
    const set = new Set<string>();
    calculosIncentivo.filter((c) => c.anio === anioActual).forEach((c) => set.add(c.esquemaId));
    return set.size;
  }, [calculosIncentivo, anioActual]);

  // Próxima gratificación · Perú jul (15-jul) y dic (15-dic)
  const proximaGratif = useMemo(() => {
    const hoy = new Date();
    const jul = new Date(hoy.getFullYear(), 6, 15); // mes 6 = julio (0-indexed)
    const dic = new Date(hoy.getFullYear(), 11, 15); // mes 11 = diciembre
    const julProx = jul > hoy ? jul : new Date(hoy.getFullYear() + 1, 6, 15);
    const dicProx = dic > hoy ? dic : new Date(hoy.getFullYear() + 1, 11, 15);
    const proxima = julProx < dicProx ? julProx : dicProx;
    const dias = Math.ceil((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return {
      mesLabel: MES_CORTO[proxima.getMonth() + 1],
      dias,
      monto: sueldo, // 1 sueldo equivalente
    };
  }, [sueldo]);

  return (
    <div className="space-y-5">
      {/* Banner pendientes contextual · canon mockup líneas 180-188 */}
      {contadorPendientes > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 ring-1 ring-amber-300 rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-bold text-amber-900 mb-0.5">
              Tenés {contadorPendientes} pendiente{contadorPendientes > 1 ? 's' : ''} que requiere{contadorPendientes === 1 ? '' : 'n'} tu atención
            </div>
            <div className="text-[11px] text-amber-800">
              {`Próxima gratificación en ${proximaGratif.dias} días · revisar boletas y bonos del mes`}
            </div>
          </div>
        </div>
      )}

      {/* KPI mini strip · canon mockup líneas 191-223 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">MI SUELDO</span>
            <Wallet className="w-3.5 h-3.5 text-sky-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-sky-900">
            {sueldo > 0 ? fmtMoneyShort(sueldo) : '—'}
          </div>
          <div className="text-[10px] text-sky-700">{monedaSalario}/mes bruto</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">PRÓX. BOLETA</span>
            <FileText className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">{diasHastaBoleta}d</div>
          <div className="text-[10px] text-emerald-700">
            {proxNetoEstimado > 0 ? `~ ${fmtMoney(proxNetoEstimado)} neto` : 'estimado'}
          </div>
        </div>
        <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 ring-1 ring-violet-200/50 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-violet-700 font-bold">MIS BONOS YTD</span>
            <Trophy className="w-3.5 h-3.5 text-violet-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-violet-900">
            {bonosYTD > 0 ? fmtMoneyShort(bonosYTD) : '—'}
          </div>
          <div className="text-[10px] text-violet-700">
            {esquemasActivos > 0 ? `${esquemasActivos} esquema${esquemasActivos > 1 ? 's' : ''} activo${esquemasActivos > 1 ? 's' : ''}` : 'sin esquemas'}
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">PRÓX. GRATIF.</span>
            <Gift className="w-3.5 h-3.5 text-indigo-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-indigo-900">
            {proximaGratif.mesLabel} · {proximaGratif.dias}d
          </div>
          <div className="text-[10px] text-indigo-700">
            {proximaGratif.monto > 0 ? `~ ${fmtMoney(proximaGratif.monto)}` : 'a calcular'}
          </div>
        </div>
      </div>

      {/* Quick actions personales · canon mockup líneas 257-289 */}
      <div>
        <h3 className="text-[13px] font-bold text-slate-900 mb-2">Acciones rápidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => navigate('/planilla?tab=boletas')}
            className="bg-white border border-sky-200 hover:bg-sky-50/30 rounded-lg p-3 text-left transition-colors"
          >
            <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center mb-1.5">
              <FileText className="w-4 h-4 text-sky-700" />
            </div>
            <div className="text-[11px] font-bold text-slate-900">Ver mis boletas</div>
            <div className="text-[10px] text-slate-500">historial completo</div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/planilla?tab=adelantos&action=solicitar')}
            className="bg-white border border-amber-200 hover:bg-amber-50/30 rounded-lg p-3 text-left transition-colors"
          >
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center mb-1.5">
              <ArrowDownCircle className="w-4 h-4 text-amber-700" />
            </div>
            <div className="text-[11px] font-bold text-slate-900">Solicitar adelanto</div>
            <div className="text-[10px] text-slate-500">requiere aprobación</div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/planilla?tab=incentivos')}
            className="bg-white border border-emerald-200 hover:bg-emerald-50/30 rounded-lg p-3 text-left transition-colors"
          >
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center mb-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-[11px] font-bold text-slate-900">Mi histórico salarial</div>
            <div className="text-[10px] text-slate-500">timeline variaciones</div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/planilla?tab=vacaciones')}
            className="bg-white border border-sky-200 hover:bg-sky-50/30 rounded-lg p-3 text-left transition-colors"
          >
            <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center mb-1.5">
              <Palmtree className="w-4 h-4 text-sky-700" />
            </div>
            <div className="text-[11px] font-bold text-slate-900">Vacaciones</div>
            <div className="text-[10px] text-slate-500">
              {typeof datosLaborales?.vacacionesDisponibles === 'number'
                ? `${datosLaborales.vacacionesDisponibles} días`
                : 'programar / ver'}
            </div>
          </button>
        </div>
      </div>

      {/* Cross-link grande a Planilla · canon mockup líneas 292-303 */}
      <div className="bg-gradient-to-r from-sky-50 to-cyan-50 ring-1 ring-sky-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <BriefcaseBusiness className="w-5 h-5 text-sky-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold text-slate-900 mb-0.5">
            Ver toda mi información laboral
          </div>
          <div className="text-[11px] text-slate-600">
            Boletas · adelantos · incentivos · vacaciones · gratificaciones
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/planilla')}
          className="bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 flex-shrink-0"
        >
          Ir a planilla
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default ResumenEmpleado;
