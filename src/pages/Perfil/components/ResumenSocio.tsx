/**
 * ResumenSocio · F10.F.1.J · 2026-05-27
 *
 * Vista RESUMEN del Tab cuando el user tiene rol socio.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 4 (líneas 462-577).
 *
 * Estructura:
 *   1. Banner socio "Tu capital está rindiendo +N% YTD"
 *   2. KPI mini strip 4 cards: MI CAPITAL · MI % · ROI YTD · PRÓX. DIST.
 *   3. Mis distribuciones recientes (timeline cards)
 *   4. Cross-link CTA grande "Ir a Inversionistas"
 */
import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Wallet,
  PieChart,
  Banknote,
  Landmark,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { calcularResumenInversionista } from '../../../services/inversionista.service';
import { datosSocioService } from '../../../services/datosSocio.service';
import type { ResumenInversionista } from '../../../types/inversionista.types';
import type { DatosSocio } from '../../../types/datosSocio.types';

interface Props {
  /** UID del socio · típicamente profile.uid */
  uid: string;
  /** datosSocio pre-cargado (si existe) · evita refetch */
  datosSocio?: DatosSocio | null;
}

const MES_LABEL = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const fmtMoneyK = (n: number): string => {
  // S/ 70K · S/ 156K · S/ 1.2M
  if (n >= 1_000_000) return `S/ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `S/ ${Math.round(n / 1_000)}K`;
  return `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
};

const fmtMoney = (n: number): string =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fechaCorta = (d: Date): string => `${String(d.getDate()).padStart(2, '0')}-${MES_LABEL[d.getMonth() + 1]}`;

interface DistribucionItem {
  id: string;
  titulo: string;
  fechaLabel: string;
  montoPEN: number;
  estado: 'programada' | 'pagada';
}

export const ResumenSocio: React.FC<Props> = ({ uid, datosSocio: datosSocioProp }) => {
  const navigate = useNavigate();
  const [resumenGlobal, setResumenGlobal] = useState<ResumenInversionista | null>(null);
  const [datosSocio, setDatosSocio] = useState<DatosSocio | null>(datosSocioProp ?? null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const cargar = async () => {
      setLoading(true);
      try {
        const ahora = new Date();
        const mes = ahora.getMonth() + 1;
        const anio = ahora.getFullYear();
        const [resumen, ds] = await Promise.all([
          calcularResumenInversionista(mes, anio).catch(() => null),
          datosSocioProp !== undefined ? Promise.resolve(datosSocioProp) : datosSocioService.get(uid).catch(() => null),
        ]);
        if (cancelled) return;
        setResumenGlobal(resumen);
        setDatosSocio(ds);
      } catch (err) {
        console.error('[ResumenSocio] Error cargando data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    cargar();
    return () => {
      cancelled = true;
    };
  }, [uid, datosSocioProp]);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 text-center text-slate-400 text-[12px]">
        Cargando vista de socio...
      </div>
    );
  }

  // Datos derivados del socio actual
  const aporteSocio = resumenGlobal?.aportesPorSocio?.find((a) => a.socioId === uid);
  const retiroSocio = resumenGlobal?.retirosPorSocio?.find((r) => r.socioId === uid);

  const miCapitalPEN = aporteSocio?.totalAportadoPEN ?? 0;
  const totalCapitalPEN = resumenGlobal?.capitalComprometido?.totalPEN ?? 0;
  const miParticipacionPct = datosSocio?.porcentajeParticipacion ?? 0;

  // ROI YTD · sobreCapitalComprometido es fracción (0.12 = 12%)
  const roiYTDPct = (resumenGlobal?.roiDual?.sobreCapitalComprometido ?? 0) * 100;
  const utilidadAcumPEN = retiroSocio?.porTipo?.utilidades ?? 0;

  // Próxima distribución · si está en datosSocio o usar placeholder
  // En realidad no existe campo `proximaDistribucion` en el modelo · mostrar "—" si no hay info
  const proxDistribucionPEN = 0; // TODO connect cuando exista DistribucionesProgramadas

  // Distribuciones recientes · derivar de los retiros (últimos 3 utilidades)
  const distribucionesRecientes: DistribucionItem[] = [];
  // En un futuro se conecta una colección distribuciones · por ahora derivar de retiros del socio
  if (retiroSocio && retiroSocio.fechaUltimoRetiro) {
    distribucionesRecientes.push({
      id: 'ult',
      titulo: 'Última distribución',
      fechaLabel: fechaCorta(retiroSocio.fechaUltimoRetiro.toDate()),
      montoPEN: retiroSocio.porTipo.utilidades || retiroSocio.totalRetiradoPEN,
      estado: 'pagada',
    });
  }

  return (
    <div className="space-y-5">
      {/* Banner socio · canon mockup líneas 476-484 */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 ring-1 ring-violet-300 rounded-xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-4 h-4 text-violet-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold text-violet-900 mb-0.5">
            {roiYTDPct > 0
              ? `Tu capital está rindiendo +${roiYTDPct.toFixed(1)}% YTD`
              : roiYTDPct < 0
              ? `Tu capital está rindiendo ${roiYTDPct.toFixed(1)}% YTD`
              : 'Aún sin datos de rentabilidad'}
          </div>
          <div className="text-[11px] text-violet-800">
            {utilidadAcumPEN > 0
              ? `Utilidades acumuladas distribuidas: ${fmtMoney(utilidadAcumPEN)}`
              : 'Las distribuciones se programan al cierre del ejercicio'}
          </div>
        </div>
      </div>

      {/* KPI mini strip · canon mockup líneas 487-520 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 ring-1 ring-violet-200/50 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-violet-700 font-bold">MI CAPITAL</span>
            <Wallet className="w-3.5 h-3.5 text-violet-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-violet-900">
            {miCapitalPEN > 0 ? fmtMoneyK(miCapitalPEN) : '—'}
          </div>
          <div className="text-[10px] text-violet-700">
            {datosSocio?.tipoParticipacion === 'cash_puro'
              ? 'cash'
              : datosSocio?.tipoParticipacion === 'valor_puro'
              ? 'valor'
              : 'cash + valor'}
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">MI %</span>
            <PieChart className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">
            {miParticipacionPct > 0 ? `${miParticipacionPct.toFixed(0)}%` : '—'}
          </div>
          <div className="text-[10px] text-emerald-700">
            {totalCapitalPEN > 0 ? `de ${fmtMoneyK(totalCapitalPEN)} total` : 'cap table'}
          </div>
        </div>
        <div className="bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">ROI YTD</span>
            <TrendingUp className="w-3.5 h-3.5 text-sky-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-sky-900">
            {roiYTDPct !== 0 ? `${roiYTDPct > 0 ? '+' : ''}${roiYTDPct.toFixed(1)}%` : '—'}
          </div>
          <div className="text-[10px] text-sky-700">utilidad acum.</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">PRÓX. DIST.</span>
            <Banknote className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-900">
            {proxDistribucionPEN > 0 ? fmtMoneyK(proxDistribucionPEN) : '—'}
          </div>
          <div className="text-[10px] text-amber-700">
            {proxDistribucionPEN > 0 ? 'programada' : 'sin programar'}
          </div>
        </div>
      </div>

      {/* Mis distribuciones recientes · canon mockup líneas 522-560 */}
      {distribucionesRecientes.length > 0 ? (
        <div>
          <h3 className="text-[13px] font-bold text-slate-900 mb-2 inline-flex items-center gap-1.5">
            <Banknote className="w-4 h-4 text-amber-700" />
            Mis distribuciones recientes
          </h3>
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {distribucionesRecientes.map((d) => (
              <div key={d.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-semibold text-slate-900">{d.titulo}</div>
                  <div className="text-[10px] text-slate-500">
                    {d.estado === 'pagada' ? `pagada el ${d.fechaLabel}` : `programada · ${d.fechaLabel}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-bold tabular-nums text-violet-900">
                    {fmtMoney(d.montoPEN)}
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      d.estado === 'pagada'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {d.estado === 'pagada' ? 'pagada' : 'programada'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <h3 className="text-[13px] font-bold text-slate-900 mb-2 inline-flex items-center gap-1.5">
            <Banknote className="w-4 h-4 text-amber-700" />
            Mis distribuciones recientes
          </h3>
          <div className="bg-white border border-slate-200 rounded-lg p-4 text-center text-[12px] text-slate-500">
            Aún sin distribuciones registradas · las primeras se reflejarán cuando el negocio reparta
            utilidades.
          </div>
        </div>
      )}

      {/* Cross-link CTA grande · canon mockup líneas 562-574 */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 ring-1 ring-violet-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Landmark className="w-5 h-5 text-violet-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold text-slate-900 mb-0.5">
            Ver mi capital completo · trayectoria · ROI dual
          </div>
          <div className="text-[11px] text-slate-600">
            Cap table · soberanía financiera · multiplicador · análisis 24 meses
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/inversionistas')}
          className="bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 flex-shrink-0"
        >
          Ir a Inversionistas
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default ResumenSocio;
