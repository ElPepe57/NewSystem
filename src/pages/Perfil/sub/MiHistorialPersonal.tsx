/**
 * MiHistorialPersonal · F10.F.1.J-SIDEBAR.4 · 2026-05-27
 *
 * Sub-página /perfil/mi-historial · timeline salarial del empleado.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.5-variante-drill.html ACTO 6 (líneas 1422-1531).
 *
 * Estructura:
 *   1. 4 KPIs · sueldo alta · vigente · acumulado % · próxima revisión
 *   2. Timeline dots canon · vigente=emerald · intermedios=sky · alta=slate
 *
 * Permission boundary: solo el user logueado ve SU historial.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, User, FileText, GitCommit } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import { BackArrowHeader } from '../../../components/common/BackArrowHeader';
import { historialSalarialService } from '../../../services/historialSalarial.service';
import { datosLaboralesService } from '../../../services/datosLaborales.service';
import type { HistorialSalarial, RazonVariacionSalarial } from '../../../types/planilla.types';
import type { DatosLaborales } from '../../../types/datosLaborales.types';
import { formatCurrencyPEN } from '../../../utils/format';

const MES_LARGO = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_CORTO = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const RAZON_LABEL: Record<RazonVariacionSalarial, { label: string; bg: string; text: string }> = {
  ajuste_anual: { label: 'AJUSTE ANUAL', bg: 'bg-sky-100', text: 'text-sky-700' },
  promocion: { label: 'PROMOCIÓN', bg: 'bg-sky-100', text: 'text-sky-700' },
  reasignacion_cargo: { label: 'CAMBIO CARGO', bg: 'bg-violet-100', text: 'text-violet-700' },
  merito: { label: 'MÉRITO', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  correccion: { label: 'CORRECCIÓN', bg: 'bg-amber-100', text: 'text-amber-700' },
  otro: { label: 'OTRO', bg: 'bg-slate-100', text: 'text-slate-700' },
};

export const MiHistorialPersonal: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = usePermissions();
  const [historial, setHistorial] = useState<HistorialSalarial[]>([]);
  const [datosLaborales, setDatosLaborales] = useState<DatosLaborales | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    let cancelled = false;
    const cargar = async () => {
      setLoading(true);
      try {
        const [h, dl] = await Promise.all([
          historialSalarialService.getHistorialUsuario(profile.uid).catch(() => []),
          datosLaboralesService.get(profile.uid).catch(() => null),
        ]);
        if (cancelled) return;
        setHistorial(h);
        setDatosLaborales(dl);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    cargar();
    return () => {
      cancelled = true;
    };
  }, [profile?.uid]);

  if (!profile) {
    return <div className="max-w-6xl mx-auto p-6 text-center text-slate-400 text-[12px]">Cargando perfil...</div>;
  }

  if (!loading && !datosLaborales) {
    return (
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <BackArrowHeader seccionLabel="Mi histórico salarial" icon={TrendingUp} colorTone="emerald" />
          <div className="p-8 text-center">
            <TrendingUp className="w-16 h-16 mx-auto mb-3 text-slate-300" />
            <h2 className="text-[15px] font-bold text-slate-900 mb-2">Sin datos laborales</h2>
            <p className="text-[12px] text-slate-600 mb-4 max-w-md mx-auto">
              Tu cuenta no tiene perfil laboral · contactá al admin de RRHH.
            </p>
            <button onClick={() => navigate('/perfil')} className="text-[12px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg">
              Volver al perfil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Cálculos
  const sueldoActual = datosLaborales?.salarioBase ?? 0;
  // Asumir el último item del historial (más antiguo) es el salario_alta
  const sueldoAlta = historial.length > 0
    ? historial[historial.length - 1].salarioAnterior
    : sueldoActual;
  const acumuladoPct = sueldoAlta > 0 ? ((sueldoActual - sueldoAlta) / sueldoAlta) * 100 : 0;
  const ultimaVariacion = historial[0];
  const proxRevisionLabel = ultimaVariacion
    ? (() => {
        const fechaUlt = ultimaVariacion.efectivoDesde.toDate();
        const proxima = new Date(fechaUlt.getFullYear() + 1, fechaUlt.getMonth(), 1);
        const meses = Math.max(0, Math.floor((proxima.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.5)));
        return { label: `${MES_CORTO[proxima.getMonth() + 1]} ${proxima.getFullYear()}`, meses };
      })()
    : { label: '—', meses: 0 };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
        <BackArrowHeader
          seccionLabel="Mi histórico salarial"
          icon={TrendingUp}
          colorTone="emerald"
          subtitulo={
            historial.length > 0
              ? `${historial.length} cambio${historial.length > 1 ? 's' : ''} documentado${historial.length > 1 ? 's' : ''} · ${acumuladoPct >= 0 ? '+' : ''}${acumuladoPct.toFixed(1)}% acumulado desde alta`
              : 'Sin cambios registrados aún'
          }
        />

        <div className="p-4 sm:p-5 md:p-6 space-y-4 bg-slate-50/30">
          {/* KPIs · canon mockup v5.5 ACTO 6 línea 1455-1488 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1">SUELDO ALTA</div>
              <div className="text-xl font-bold tabular-nums text-emerald-900">{formatCurrencyPEN(sueldoAlta)}</div>
              <div className="text-[10px] text-emerald-700">
                {datosLaborales?.fechaIngreso
                  ? `${MES_CORTO[datosLaborales.fechaIngreso.toDate().getMonth() + 1]} ${datosLaborales.fechaIngreso.toDate().getFullYear()}`
                  : 'inicial'}
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1">SUELDO ACTUAL</div>
              <div className="text-xl font-bold tabular-nums text-emerald-900">{formatCurrencyPEN(sueldoActual)}</div>
              <div className="text-[10px] text-emerald-700">vigente</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1">ACUMULADO</div>
              <div className={`text-xl font-bold tabular-nums ${acumuladoPct >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
                {acumuladoPct >= 0 ? '+' : ''}{acumuladoPct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-emerald-700">desde alta</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1">PRÓX. REVISIÓN</div>
              <div className="text-xl font-bold tabular-nums text-emerald-900">{proxRevisionLabel.label}</div>
              <div className="text-[10px] text-emerald-700">en {proxRevisionLabel.meses}m</div>
            </div>
          </div>

          {/* Timeline · canon mockup v5.5 línea 1492-1530 */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-[14px] font-bold text-slate-900 mb-4 inline-flex items-center gap-1.5">
              <GitCommit className="w-4 h-4 text-emerald-700" />
              Timeline de variaciones · {historial.length} evento{historial.length !== 1 ? 's' : ''}
            </h3>

            {loading ? (
              <div className="text-center text-slate-400 text-[12px] py-4">Cargando historial...</div>
            ) : historial.length === 0 ? (
              <div className="text-center py-6">
                <GitCommit className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <h4 className="text-[13px] font-bold text-slate-700">Sin variaciones registradas</h4>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  Tu primera variación salarial se registrará acá. Mientras tanto, mantenés el sueldo inicial.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {historial.map((h, idx) => {
                  const isVigente = idx === 0;
                  const isOldest = idx === historial.length - 1;
                  const dotColor = isVigente
                    ? 'bg-emerald-500 ring-emerald-100'
                    : isOldest
                    ? 'bg-slate-400 ring-slate-100'
                    : 'bg-sky-500 ring-sky-100';
                  const lineLast = idx === historial.length - 1;
                  const razon = RAZON_LABEL[h.razon] ?? RAZON_LABEL.otro;
                  const fecha = h.efectivoDesde.toDate();

                  return (
                    <div key={h.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-4 h-4 rounded-full ring-4 ${dotColor} flex-shrink-0`}></div>
                        {!lineLast && <div className="w-0.5 flex-1 bg-slate-200 mt-2"></div>}
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[15px] font-bold tabular-nums text-slate-900">
                            {formatCurrencyPEN(h.salarioNuevo)}
                          </span>
                          {isVigente && (
                            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                              VIGENTE
                            </span>
                          )}
                          <span className={`${razon.bg} ${razon.text} text-[10px] font-bold px-2 py-0.5 rounded uppercase`}>
                            {razon.label}
                          </span>
                        </div>
                        <div className="text-[12px] text-slate-600 mb-1">
                          {MES_LARGO[fecha.getMonth() + 1]} {fecha.getFullYear()}
                          {h.porcentajeVariacion !== 0 && (
                            <>
                              {' · '}
                              <span className={`font-bold ${h.porcentajeVariacion >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {h.porcentajeVariacion >= 0 ? '+' : ''}{h.porcentajeVariacion.toFixed(1)}% vs anterior
                              </span>
                            </>
                          )}
                        </div>
                        {h.notas && (
                          <div className="text-[11px] text-slate-500 italic mb-2">"{h.notas}"</div>
                        )}
                        <div className="text-[10px] text-slate-400 inline-flex items-center gap-1 flex-wrap">
                          <User className="w-3 h-3" />
                          aprobado por {h.registradoPor === 'system' ? 'sistema' : h.registradoPor}
                          {h.id && (
                            <>
                              <FileText className="w-3 h-3 ml-1" />
                              referencia {h.id}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MiHistorialPersonal;
