/**
 * MiPlanillaPersonal · F10.F.1.J-SIDEBAR.2 · 2026-05-27
 *
 * Sub-página /perfil/mi-planilla · vista PERSONAL del empleado de su planilla.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.5-variante-drill.html ACTO 4 (líneas 1011-1180).
 *
 * Sub-tabs internas (canon F4 cards apiladas):
 *   1. Boletas       · default · tabla con histórico
 *   2. Adelantos     · lista de adelantos del empleado
 *   3. Incentivos    · esquemas + cálculos del empleado
 *   4. Vacaciones    · días disponibles + historial
 *   5. Gratificaciones · jul/dic Perú
 *
 * Permission boundary: SIEMPRE filtra por userId === currentUser.uid.
 * Si el user no tiene datosLaborales · empty state pedagógico.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BriefcaseBusiness,
  Download,
  Plus,
  FileText,
  ArrowDownCircle,
  Trophy,
  Palmtree,
  Gift,
} from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import { BackArrowHeader } from '../../../components/common/BackArrowHeader';
import { datosLaboralesService } from '../../../services/datosLaborales.service';
import { planillaService } from '../../../services/planilla.service';
import { calculoIncentivoService } from '../../../services/calculoIncentivo.service';
import type { DatosLaborales } from '../../../types/datosLaborales.types';
import type { Boleta, CalculoIncentivoMes } from '../../../types/planilla.types';
import {
  MisBoletasRecientes,
  MisIncentivos,
} from '../components';

type SubTab = 'boletas' | 'adelantos' | 'incentivos' | 'vacaciones' | 'gratificaciones';

const SUB_TABS: Array<{ id: SubTab; label: string; icon: React.ElementType; getCount?: (data: any) => number }> = [
  { id: 'boletas', label: 'Boletas', icon: FileText, getCount: (d) => d.boletas?.length || 0 },
  { id: 'adelantos', label: 'Adelantos', icon: ArrowDownCircle },
  { id: 'incentivos', label: 'Incentivos', icon: Trophy },
  { id: 'vacaciones', label: 'Vacaciones', icon: Palmtree },
  { id: 'gratificaciones', label: 'Gratificaciones', icon: Gift },
];

const fmtMoney = (n: number): string =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const MiPlanillaPersonal: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = usePermissions();
  const [subTab, setSubTab] = useState<SubTab>('boletas');
  const [datosLaborales, setDatosLaborales] = useState<DatosLaborales | null>(null);
  const [boletas, setBoletas] = useState<Boleta[]>([]);
  const [calculos, setCalculos] = useState<CalculoIncentivoMes[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    let cancelled = false;
    const cargar = async () => {
      setLoading(true);
      try {
        const [dl, bo, ci] = await Promise.all([
          datosLaboralesService.get(profile.uid).catch(() => null),
          planillaService.getBoletasPorEmpleado(profile.uid, 12).catch(() => []),
          calculoIncentivoService.listUsuario(profile.uid, 24).catch(() => []),
        ]);
        if (cancelled) return;
        setDatosLaborales(dl);
        setBoletas(bo);
        setCalculos(ci);
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
    return (
      <div className="max-w-6xl mx-auto p-6 text-center text-slate-400 text-[12px]">
        Cargando perfil...
      </div>
    );
  }

  if (!loading && !datosLaborales) {
    // Empty state pedagógico · no tiene datosLaborales
    return (
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <BackArrowHeader
            seccionLabel="Mi planilla"
            icon={BriefcaseBusiness}
            colorTone="sky"
            subtitulo="Vista personal de tu planilla · boletas · adelantos · incentivos"
          />
          <div className="p-8 text-center">
            <BriefcaseBusiness className="w-16 h-16 mx-auto mb-3 text-slate-300" />
            <h2 className="text-[15px] font-bold text-slate-900 mb-2">Sin datos laborales registrados</h2>
            <p className="text-[12px] text-slate-600 mb-4 max-w-md mx-auto">
              Tu cuenta aún no tiene un perfil laboral configurado. Si trabajás en el negocio,
              contactá al admin de RRHH para que asiente tus datos (cargo, área, sueldo, contrato).
            </p>
            <button
              type="button"
              onClick={() => navigate('/perfil')}
              className="text-[12px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
            >
              Volver al perfil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // KPIs derivados
  const anioActual = new Date().getFullYear();
  const boletasAnio = boletas.filter((b) => b.anio === anioActual);
  const boletasPagadas = boletasAnio.filter((b) => b.estado === 'pagada');
  const totalNetoYTD = boletasPagadas.reduce((sum, b) => sum + b.totalNeto, 0);
  const promedioMensual = boletasPagadas.length > 0 ? totalNetoYTD / boletasPagadas.length : 0;

  // Próxima boleta · días hasta fin de mes
  const hoy = new Date();
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const diasHastaProxBoleta = Math.max(0, Math.ceil((ultimoDia.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
        <BackArrowHeader
          seccionLabel="Mi planilla"
          icon={BriefcaseBusiness}
          colorTone="sky"
          subtitulo="Vista personal · boletas · adelantos · incentivos · vacaciones · gratificaciones"
          acciones={
            <>
              <button
                type="button"
                className="text-[11px] font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar PDF
              </button>
              <button
                type="button"
                onClick={() => navigate('/planilla?tab=adelantos&action=solicitar')}
                className="text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-700 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Solicitar adelanto
              </button>
            </>
          }
        />

        {/* Sub-tabs internos · canon mockup v5.5 línea 1085-1102 */}
        <div className="px-6 border-b border-slate-200 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-1 whitespace-nowrap">
            {SUB_TABS.map((t) => {
              const Icon = t.icon;
              const active = subTab === t.id;
              const count = t.id === 'boletas' ? boletas.length : undefined;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSubTab(t.id)}
                  className={`px-4 py-2.5 text-[12px] flex items-center gap-1.5 border-b-2 transition-colors min-h-[44px] ${
                    active
                      ? 'font-bold border-sky-600 text-sky-700'
                      : 'font-medium border-transparent text-slate-600 hover:text-sky-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                  {count !== undefined && count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-sky-100' : 'bg-slate-100'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body por sub-tab */}
        <div className="p-4 sm:p-5 md:p-6 space-y-4 bg-slate-50/30">
          {/* ─── Sub-tab BOLETAS ─── */}
          {subTab === 'boletas' && (
            <>
              {/* KPIs específicos boletas · canon mockup v5.5 línea 1107-1131 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">BOLETAS YTD</div>
                  <div className="text-xl font-bold tabular-nums text-slate-900">{boletasAnio.length}</div>
                  <div className="text-[10px] text-slate-500">de 12 esperadas</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">TOTAL NETO YTD</div>
                  <div className="text-xl font-bold tabular-nums text-emerald-700">
                    S/ {fmtMoney(totalNetoYTD)}
                  </div>
                  <div className="text-[10px] text-slate-500">{boletasPagadas.length} pagadas</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">PROMEDIO MENSUAL</div>
                  <div className="text-xl font-bold tabular-nums text-slate-900">
                    S/ {fmtMoney(promedioMensual)}
                  </div>
                  <div className="text-[10px] text-emerald-700">vs último año</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">PRÓX. BOLETA</div>
                  <div className="text-xl font-bold tabular-nums text-slate-900">{diasHastaProxBoleta}d</div>
                  <div className="text-[10px] text-slate-500">cierre fin de mes</div>
                </div>
              </div>

              {/* Tabla de boletas · usar componente reutilizable */}
              <MisBoletasRecientes boletas={boletas} loading={loading} />
            </>
          )}

          {/* ─── Sub-tab ADELANTOS ─── */}
          {subTab === 'adelantos' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 text-center">
              <ArrowDownCircle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <h3 className="text-[13px] font-bold text-slate-700">Tab Adelantos</h3>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                Vista detallada de tus adelantos solicitados · estado · descuentos programados.
              </p>
              <button
                type="button"
                onClick={() => navigate('/planilla?tab=adelantos')}
                className="mt-4 text-[11px] font-bold text-sky-700 hover:bg-sky-50 border border-sky-200 px-3 py-1.5 rounded inline-flex items-center gap-1"
              >
                Ver en módulo Planilla →
              </button>
            </div>
          )}

          {/* ─── Sub-tab INCENTIVOS ─── */}
          {subTab === 'incentivos' && (
            <MisIncentivos calculos={calculos} loading={loading} />
          )}

          {/* ─── Sub-tab VACACIONES ─── */}
          {subTab === 'vacaciones' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-[14px] font-bold text-slate-900 mb-3 inline-flex items-center gap-1.5">
                <Palmtree className="w-4 h-4 text-sky-700" />
                Mis vacaciones
              </h3>
              {datosLaborales?.vacacionesDisponibles !== undefined ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-emerald-50/40 border border-emerald-200 rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">DISPONIBLES</div>
                    <div className="text-2xl font-bold tabular-nums text-emerald-900 mt-1">
                      {datosLaborales.vacacionesDisponibles}
                    </div>
                    <div className="text-[10px] text-emerald-700">días para tomar</div>
                  </div>
                  <div className="bg-sky-50/40 border border-sky-200 rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">PROGRAMADAS</div>
                    <div className="text-2xl font-bold tabular-nums text-sky-900 mt-1">0</div>
                    <div className="text-[10px] text-sky-700">próximamente</div>
                  </div>
                  <div className="bg-slate-50/40 border border-slate-200 rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">YTD GOZADAS</div>
                    <div className="text-2xl font-bold tabular-nums text-slate-700 mt-1">0</div>
                    <div className="text-[10px] text-slate-500">este año</div>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-slate-500 text-center py-4">
                  Tu cuota de vacaciones aún no fue configurada · contactá al admin.
                </p>
              )}
            </div>
          )}

          {/* ─── Sub-tab GRATIFICACIONES ─── */}
          {subTab === 'gratificaciones' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 text-center">
              <Gift className="w-10 h-10 mx-auto mb-2 text-indigo-300" />
              <h3 className="text-[13px] font-bold text-slate-700">Tab Gratificaciones</h3>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                Histórico de gratificaciones jul/dic · canon Perú · cálculo proporcional según meses trabajados.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded">
                <Gift className="w-3 h-3" />
                Próxima: julio 2026
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MiPlanillaPersonal;
