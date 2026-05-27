/**
 * MiCapitalPersonal · F10.F.1.J-SIDEBAR.3 · 2026-05-27
 *
 * Sub-página /perfil/mi-capital · vista PERSONAL del socio de su capital.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.5-variante-drill.html ACTO 5 (líneas 1191-1290).
 *
 * Estructura:
 *   1. Hero violet · 3 KPIs (Mi participación · Mi capital · ROI YTD)
 *   2. Grid 2-col · Mis aportes + Mis distribuciones
 *   3. Cross-link CTA grande a /inversionistas
 *
 * Permission boundary: filtra siempre por uid del user logueado.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Coins,
  ExternalLink,
  ArrowUpCircle,
  Banknote,
  Landmark,
  ArrowRight,
} from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import { BackArrowHeader } from '../../../components/common/BackArrowHeader';
import { datosSocioService } from '../../../services/datosSocio.service';
import { calcularResumenInversionista } from '../../../services/inversionista.service';
import { formatCurrencyPEN } from '../../../utils/format';
import type { DatosSocio } from '../../../types/datosSocio.types';
import type { ResumenInversionista } from '../../../types/inversionista.types';

const MES_CORTO = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const fmtMoneyK = (n: number): string => {
  if (n >= 1_000_000) return `S/ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `S/ ${Math.round(n / 1_000)}K`;
  return `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
};

export const MiCapitalPersonal: React.FC = () => {
  const navigate = useNavigate();
  const { profile, isSocio } = usePermissions();
  const [datosSocio, setDatosSocio] = useState<DatosSocio | null>(null);
  const [resumen, setResumen] = useState<ResumenInversionista | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    let cancelled = false;
    const cargar = async () => {
      setLoading(true);
      try {
        const ahora = new Date();
        const [ds, r] = await Promise.all([
          datosSocioService.get(profile.uid).catch(() => null),
          calcularResumenInversionista(ahora.getMonth() + 1, ahora.getFullYear()).catch(() => null),
        ]);
        if (cancelled) return;
        setDatosSocio(ds);
        setResumen(r);
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

  // Permission guard · solo socios
  if (!isSocio) {
    return (
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <BackArrowHeader
            seccionLabel="Mi capital"
            icon={Coins}
            colorTone="violet"
          />
          <div className="p-8 text-center">
            <Coins className="w-16 h-16 mx-auto mb-3 text-slate-300" />
            <h2 className="text-[15px] font-bold text-slate-900 mb-2">Vista no disponible</h2>
            <p className="text-[12px] text-slate-600 mb-4 max-w-md mx-auto">
              Esta vista es para socios del negocio. Tu cuenta no tiene rol "socio" asignado.
            </p>
            <button onClick={() => navigate('/perfil')} className="text-[12px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg">
              Volver al perfil
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && !datosSocio) {
    return (
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <BackArrowHeader seccionLabel="Mi capital" icon={Coins} colorTone="violet" />
          <div className="p-8 text-center">
            <Coins className="w-16 h-16 mx-auto mb-3 text-violet-300" />
            <h2 className="text-[15px] font-bold text-slate-900 mb-2">Datos de socio pendientes</h2>
            <p className="text-[12px] text-slate-600 mb-4 max-w-md mx-auto">
              Tu participación aún no está configurada en el sistema. Contactá al admin para asentar
              tu % participación, aportes y tipo de socio.
            </p>
            <button onClick={() => navigate('/perfil')} className="text-[12px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg">
              Volver al perfil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Datos derivados del socio actual
  const aporteSocio = resumen?.aportesPorSocio?.find((a) => a.socioId === profile.uid);
  const retiroSocio = resumen?.retirosPorSocio?.find((r) => r.socioId === profile.uid);

  const miCapitalCash = aporteSocio?.totalAportadoPEN ?? 0;
  const miValor = datosSocio?.aporteDeValor?.valuacionEstimadaPEN ?? 0;
  const miCapitalTotal = miCapitalCash + miValor;
  const miParticipacionPct = datosSocio?.porcentajeParticipacion ?? 0;
  const roiYTDPct = (resumen?.roiDual?.sobreCapitalComprometido ?? 0) * 100;
  const utilidadAcum = retiroSocio?.porTipo?.utilidades ?? 0;

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
        <BackArrowHeader
          seccionLabel="Mi capital"
          icon={Coins}
          colorTone="violet"
          subtitulo="Mi participación · aportes · ROI · distribuciones"
          acciones={
            <button
              onClick={() => navigate('/inversionistas')}
              className="text-[11px] font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver cap table en /inversionistas
            </button>
          }
        />

        <div className="p-4 sm:p-5 md:p-6 space-y-4 bg-slate-50/30">
          {/* Hero · canon mockup v5.5 ACTO 5 línea 1234-1260 */}
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200 rounded-2xl p-5 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-violet-700 font-bold mb-1">MI PARTICIPACIÓN</div>
                <div className="text-3xl sm:text-4xl font-bold tabular-nums text-violet-900">
                  {miParticipacionPct.toFixed(0)}<span className="text-violet-400">%</span>
                </div>
                <div className="text-[11px] text-violet-700 mt-1">{datosSocio?.rolEnNegocio || 'Socio del negocio'}</div>
              </div>
              <div className="border-l-0 md:border-l border-violet-200 md:pl-4">
                <div className="text-[11px] uppercase tracking-wider text-violet-700 font-bold mb-1">MI CAPITAL TOTAL</div>
                <div className="text-2xl sm:text-3xl font-bold tabular-nums text-violet-900">
                  {miCapitalTotal > 0 ? fmtMoneyK(miCapitalTotal) : '—'}
                </div>
                <div className="text-[11px] text-violet-700 mt-1">
                  {miCapitalCash > 0 && miValor > 0
                    ? `${fmtMoneyK(miCapitalCash)} cash · ${fmtMoneyK(miValor)} valor`
                    : miCapitalCash > 0
                    ? 'cash'
                    : miValor > 0
                    ? 'valor'
                    : 'sin aportes'}
                </div>
              </div>
              <div className="border-l-0 md:border-l border-violet-200 md:pl-4">
                <div className="text-[11px] uppercase tracking-wider text-violet-700 font-bold mb-1">ROI YTD</div>
                <div className={`text-2xl sm:text-3xl font-bold tabular-nums ${roiYTDPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {roiYTDPct !== 0 ? `${roiYTDPct > 0 ? '+' : ''}${roiYTDPct.toFixed(1)}%` : '—'}
                </div>
                <div className="text-[11px] text-emerald-700 mt-1">
                  {utilidadAcum > 0 ? `${formatCurrencyPEN(utilidadAcum)} utilidades acum.` : 'sin distribuciones aún'}
                </div>
              </div>
            </div>
          </div>

          {/* 2 columnas · canon mockup v5.5 línea 1264-1340 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Mis aportes */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
                  <ArrowUpCircle className="w-4 h-4 text-violet-700" />
                  Mis aportes
                </h3>
                <span className="text-[10px] text-slate-500">
                  {aporteSocio?.cantidadAportes ?? 0} operaciones · lifetime
                </span>
              </div>
              {!aporteSocio || aporteSocio.cantidadAportes === 0 ? (
                <p className="text-[12px] text-slate-500 text-center py-4">
                  Sin aportes registrados aún · el primer aporte se reflejará acá.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div>
                      <div className="text-[12px] font-semibold text-slate-900">Total aportes cash · lifetime</div>
                      {aporteSocio.fechaPrimerAporte && (
                        <div className="text-[10px] text-slate-500">
                          desde {MES_CORTO[aporteSocio.fechaPrimerAporte.toDate().getMonth() + 1]} {aporteSocio.fechaPrimerAporte.toDate().getFullYear()}
                        </div>
                      )}
                    </div>
                    <div className="text-right tabular-nums text-violet-900 font-bold">
                      {formatCurrencyPEN(aporteSocio.totalAportadoPEN)}
                    </div>
                  </div>
                  {miValor > 0 && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-900">Aporte de valor · valuación</div>
                        <div className="text-[10px] text-slate-500">
                          {datosSocio?.aporteDeValor?.tiposDeValor?.slice(0, 2).join(' · ').replace(/_/g, ' ') || 'know-how + gestión'}
                        </div>
                      </div>
                      <div className="text-right tabular-nums text-violet-900 font-bold">
                        {formatCurrencyPEN(miValor)}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t-2 border-slate-200">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Total</div>
                    <div className="text-right tabular-nums text-violet-900 font-bold text-[14px]">
                      {formatCurrencyPEN(miCapitalTotal)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mis distribuciones */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-emerald-700" />
                  Mis distribuciones
                </h3>
                <span className="text-[10px] text-slate-500">{retiroSocio?.cantidadRetiros ?? 0} operaciones</span>
              </div>
              {!retiroSocio || retiroSocio.cantidadRetiros === 0 ? (
                <p className="text-[12px] text-slate-500 text-center py-4">
                  Aún sin distribuciones · las primeras se reflejarán al cierre del ejercicio.
                </p>
              ) : (
                <div className="space-y-2">
                  {retiroSocio.fechaUltimoRetiro && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-900">Última distribución</div>
                        <div className="text-[10px] text-slate-500">
                          pagada {MES_CORTO[retiroSocio.fechaUltimoRetiro.toDate().getMonth() + 1]}{' '}
                          {retiroSocio.fechaUltimoRetiro.toDate().getFullYear()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tabular-nums text-violet-900 font-bold">
                          {formatCurrencyPEN(retiroSocio.porTipo.utilidades || retiroSocio.totalRetiradoPEN)}
                        </div>
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">
                          PAGADA
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="pt-3 border-t-2 border-slate-200 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-bold uppercase">Total acumulado</span>
                    <span className="tabular-nums text-emerald-700 font-bold">
                      {formatCurrencyPEN(retiroSocio.totalRetiradoPEN)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cross-link grande a Inversionistas · canon mockup v5.5 línea 1342-1357 */}
          <div className="bg-gradient-to-r from-violet-50 to-purple-50 ring-1 ring-violet-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Landmark className="w-5 h-5 text-violet-700" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="text-[12px] font-bold text-slate-900 mb-0.5">
                Cap table completo · ROI dual · trayectoria 24m
              </div>
              <div className="text-[11px] text-slate-600">
                Vista ejecutiva del módulo · todos los socios y análisis profundo
              </div>
            </div>
            <button
              onClick={() => navigate('/inversionistas')}
              className="bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 flex-shrink-0"
            >
              Ir a Inversionistas
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MiCapitalPersonal;
