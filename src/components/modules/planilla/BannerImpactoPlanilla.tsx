/**
 * BannerImpactoPlanilla.tsx
 *
 * chk5.PERSONAS-v5.4 · F6 · 2026-05-26
 *
 * Componente compartido · banner cross-link 360° desde otros módulos hacia
 * /planilla. Una sola fuente de verdad visual con 4 variantes:
 *
 *  - 'gastos'    · amber  · "Costo planilla del mes registrado"
 *  - 'cashflow'  · rose   · "Próximo pago planilla programado"
 *  - 'pyl'       · sky    · "Gastos de personal del período"
 *  - 'salud'     · violet · "Costo laboral mes vs ingresos"
 *
 * Color cross-módulo canon N4 (CLAUDE.md v8.0).
 * Solo visible para admin · gerente · finanzas (hasAnyRole).
 *
 * Carga datos vía planillaAnalyticsService (lazy · al montar).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BriefcaseBusiness,
  Wallet,
  CalendarDays,
  TrendingDown,
  HeartPulse,
  ArrowRight,
  Info,
} from 'lucide-react';
import { planillaAnalyticsService, type CostoLaboralMensual, type ProximoCompromisoPlanilla } from '../../../services/planillaAnalytics.service';
import { formatCurrencyPEN } from '../../../utils/format';
import { useAuthStore } from '../../../store/authStore';
import { hasAnyRole } from '../../../types/auth.types';

export type VarianteBanner = 'gastos' | 'cashflow' | 'pyl' | 'salud';

interface Props {
  variante: VarianteBanner;
  /** Mes/anio opcional · default = mes actual */
  mes?: number;
  anio?: number;
  /** Si true · oculta el banner cuando no hay data (no muestra empty state).
   *  Default: false (muestra empty state pedagógico para discovery cross-módulo). */
  ocultarSiVacio?: boolean;
}

const CONFIG = {
  gastos: {
    tinte: 'amber',
    gradFrom: 'from-amber-50',
    gradTo: 'to-amber-100/30',
    ring: 'ring-amber-200',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-700',
    labelText: 'text-amber-900',
    bodyText: 'text-amber-700',
    ctaBg: 'bg-amber-600 hover:bg-amber-700',
    Icon: Wallet,
  },
  cashflow: {
    tinte: 'rose',
    gradFrom: 'from-rose-50',
    gradTo: 'to-rose-100/30',
    ring: 'ring-rose-200',
    iconBg: 'bg-rose-100',
    iconText: 'text-rose-700',
    labelText: 'text-rose-900',
    bodyText: 'text-rose-700',
    ctaBg: 'bg-rose-600 hover:bg-rose-700',
    Icon: CalendarDays,
  },
  pyl: {
    tinte: 'sky',
    gradFrom: 'from-sky-50',
    gradTo: 'to-sky-100/30',
    ring: 'ring-sky-200',
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-700',
    labelText: 'text-sky-900',
    bodyText: 'text-sky-700',
    ctaBg: 'bg-sky-600 hover:bg-sky-700',
    Icon: TrendingDown,
  },
  salud: {
    tinte: 'violet',
    gradFrom: 'from-violet-50',
    gradTo: 'to-violet-100/30',
    ring: 'ring-violet-200',
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-700',
    labelText: 'text-violet-900',
    bodyText: 'text-violet-700',
    ctaBg: 'bg-violet-600 hover:bg-violet-700',
    Icon: HeartPulse,
  },
} as const;

export const BannerImpactoPlanilla: React.FC<Props> = ({
  variante,
  mes,
  anio,
  ocultarSiVacio = false,
}) => {
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);
  const [costoMes, setCostoMes] = useState<CostoLaboralMensual | null>(null);
  const [proximo, setProximo] = useState<ProximoCompromisoPlanilla | null>(null);
  const [loading, setLoading] = useState(true);

  const ahora = new Date();
  const mesEfectivo = mes ?? ahora.getMonth() + 1;
  const anioEfectivo = anio ?? ahora.getFullYear();

  // Solo carga si user tiene permiso · evita queries inútiles
  const visible = hasAnyRole(userProfile, ['admin', 'gerente', 'finanzas']);

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        // Para gastos/pyl/salud · cargar serie 12m y tomar el del mes
        if (variante === 'gastos' || variante === 'pyl' || variante === 'salud') {
          const serie = await planillaAnalyticsService.costoLaboralPorMes(12);
          const m = serie.find((s) => s.mes === mesEfectivo && s.anio === anioEfectivo);
          setCostoMes(m ?? null);
        }
        // Para cashflow · cargar próximo compromiso de planilla
        if (variante === 'cashflow') {
          const compromisos = await planillaAnalyticsService.proximosCompromisos();
          const sigBoleta = compromisos.find((c) => c.tipo === 'boleta');
          setProximo(sigBoleta ?? null);
        }
      } catch (err) {
        console.error('[BannerImpactoPlanilla] error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [variante, mesEfectivo, anioEfectivo, visible]);

  // Si el user no tiene permiso · no renderizar nada (nunca rompe)
  if (!visible) return null;

  // Si ocultarSiVacio y aún no hay data · no renderizar (modo silencioso)
  const sinData =
    !loading &&
    ((variante === 'cashflow' && !proximo) ||
      (variante !== 'cashflow' && (!costoMes || costoMes.totalCostoLaboral === 0)));
  if (sinData && ocultarSiVacio) return null;

  const cfg = CONFIG[variante];
  const Icon = cfg.Icon;

  // ───── Contenido por variante ─────
  let titulo = '';
  let detalle = '';
  let monto: number | null = null;
  let cta = 'Ver planilla';

  if (loading) {
    titulo = 'Cargando impacto de planilla...';
  } else if (sinData) {
    // Empty state pedagógico (discovery cross-módulo · canon N8 v8.0)
    if (variante === 'gastos') {
      titulo = 'El costo de planilla aparecerá acá';
      detalle = 'Cuando generes boletas del mes, verás el impacto agregado en este módulo.';
      cta = 'Configurar planilla';
    } else if (variante === 'cashflow') {
      titulo = 'Los pagos de planilla se proyectarán acá';
      detalle = 'Cuando tengas boletas históricas, verás la estimación del próximo pago.';
      cta = 'Ir a planilla';
    } else if (variante === 'pyl') {
      titulo = 'Gastos de personal aparecerán en el P&L';
      detalle = 'Al cerrar el mes de planilla, los costos laborales se reflejan en el P&L.';
      cta = 'Ir a planilla';
    } else {
      titulo = 'Costo laboral aparecerá en la salud financiera';
      detalle = 'Al tener histórico de planilla, podrás medir su impacto sobre ingresos.';
      cta = 'Configurar planilla';
    }
  } else {
    // Datos reales
    if (variante === 'gastos' && costoMes) {
      titulo = `Costo de planilla del mes`;
      monto = costoMes.totalCostoLaboral;
      const ratio = costoMes.totalBonos > 0 ? ` · incluye ${formatCurrencyPEN(costoMes.totalBonos)} bonos` : '';
      detalle = `${costoMes.cantidadEmpleados} boletas${ratio}`;
      cta = 'Ver desglose en /planilla';
    } else if (variante === 'cashflow' && proximo) {
      titulo = `Próximo pago de planilla`;
      monto = proximo.montoEstimadoPEN;
      const dias = Math.ceil(
        (proximo.fechaProyectada.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24),
      );
      detalle = `${proximo.concepto} · ${dias > 0 ? `en ${dias} día${dias === 1 ? '' : 's'}` : 'pendiente'}`;
      cta = 'Programar pago';
    } else if (variante === 'pyl' && costoMes) {
      titulo = `Gastos de personal del período`;
      monto = costoMes.totalCostoLaboral;
      const desglose: string[] = [];
      if (costoMes.totalBoletas > 0) desglose.push(`${formatCurrencyPEN(costoMes.totalBoletas)} sueldos`);
      if (costoMes.totalBonos > 0) desglose.push(`${formatCurrencyPEN(costoMes.totalBonos)} bonos`);
      if (costoMes.totalGratificaciones > 0) desglose.push(`${formatCurrencyPEN(costoMes.totalGratificaciones)} gratif.`);
      detalle = desglose.length > 0 ? desglose.join(' + ') : `${costoMes.cantidadEmpleados} empleados`;
      cta = 'Ver detalle en /planilla';
    } else if (variante === 'salud' && costoMes) {
      titulo = `Costo laboral del mes`;
      monto = costoMes.totalCostoLaboral;
      detalle = `${costoMes.cantidadEmpleados} empleados · impacta margen operativo`;
      cta = 'Ver análisis 360°';
    }
  }

  return (
    <div
      className={`bg-gradient-to-r ${cfg.gradFrom} ${cfg.gradTo} ring-1 ${cfg.ring} rounded-xl p-3 flex items-center gap-3`}
    >
      <div className={`w-10 h-10 ${cfg.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${cfg.iconText}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`flex items-center gap-2 ${cfg.labelText}`}>
          <span className="text-[12px] font-bold">{titulo}</span>
          {monto !== null && (
            <span className="text-[14px] font-bold tabular-nums">
              · {formatCurrencyPEN(monto)}
            </span>
          )}
        </div>
        <div className={`text-[11px] ${cfg.bodyText} flex items-center gap-1 mt-0.5`}>
          {sinData && <Info className="w-3 h-3 flex-shrink-0" />}
          <span className="truncate">{detalle}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate(`/planilla?mes=${mesEfectivo}&anio=${anioEfectivo}`)}
        className={`${cfg.ctaBg} text-white text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1 flex-shrink-0`}
      >
        <span className="hidden sm:inline">{cta}</span>
        <span className="sm:hidden">Planilla</span>
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
};

export default BannerImpactoPlanilla;
