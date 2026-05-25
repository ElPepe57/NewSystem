/**
 * RevisionMensual · canon v5.2 chk5.E-RM
 *
 * Reemplaza CierreMensual.tsx (deprecated).
 *
 * Filosofía: health check informal · sin bloqueo · centrado en conciliación
 * bancaria. Cross-link a verificación de saldos chk5.D-S9.B.
 *
 * Pixel-perfect contra docs/mockups/contabilidad-revision-mensual-v5.2.html
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck,
  Wallet,
  Info,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  ArrowRight,
  ListChecks,
  Bookmark,
  History,
  Clock,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { revisionMensualService } from '../../../services/revisionMensual.service';
import { aplicarAjustePorVerificacion } from '../../../services/tesoreria.ajustes.service';
import { tipoCambioService } from '../../../services/tipoCambio.service';
import { formatCurrencyPEN } from '../../../utils/format';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import type {
  RevisionMensual as RevisionMensualType,
  ResumenConciliacion,
  ConciliacionCuenta,
  EstadoConciliacion,
  ChequeoInformativo,
} from '../../../types/revisionMensual.types';
import type {
  BalanceGeneral,
  EstadoResultados,
} from '../../../types/contabilidad.types';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface Props {
  mes: number;
  anio: number;
  /** Balance del período · para chequeos informativos */
  balance?: BalanceGeneral | null;
  /** Estado de resultados · para chequeos informativos */
  estado?: EstadoResultados | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RevisionMensual({ mes, anio, balance, estado }: Props) {
  const userProfile = useAuthStore((s) => s.userProfile);

  const [revisionActual, setRevisionActual] = useState<RevisionMensualType | null>(null);
  const [resumenConciliacion, setResumenConciliacion] = useState<ResumenConciliacion | null>(null);
  const [historial, setHistorial] = useState<RevisionMensualType[]>([]);
  const [tipoCambio, setTipoCambio] = useState(3.75);

  const [loading, setLoading] = useState(false);
  const [marcandoRevisado, setMarcandoRevisado] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal Aplicar Ajuste
  const [ajusteModalOpen, setAjusteModalOpen] = useState(false);
  const [cuentaAjuste, setCuentaAjuste] = useState<ConciliacionCuenta | null>(null);

  // Cargar datos
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // TC actual · resolverlo del service (consistente con resto del sistema)
      const tcInfo = await tipoCambioService.resolverTC();
      const tcResuelto = tcInfo.venta; // canon: usar TC de venta para conversiones
      setTipoCambio(tcResuelto);

      const [revision, conciliacion, hist] = await Promise.all([
        revisionMensualService.getRevisionMensual(mes, anio),
        revisionMensualService.getResumenConciliacion(tcResuelto),
        revisionMensualService.getHistorialRevisiones(12),
      ]);

      setRevisionActual(revision);
      setResumenConciliacion(conciliacion);
      setHistorial(hist);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error cargando revisión mensual');
    } finally {
      setLoading(false);
    }
  }, [mes, anio]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Chequeos informativos derivados del balance/estado
  const chequeos = derivarChequeosInformativos(balance, estado);

  // Marcar como revisado
  const handleMarcarRevisado = async () => {
    if (!userProfile?.uid) return;
    setMarcandoRevisado(true);
    setErrorMsg(null);
    try {
      const alertasDetectadas =
        chequeos.filter((c) => c.polaridad === 'warning').length +
        (resumenConciliacion?.conDesviacion ?? 0) +
        (resumenConciliacion?.desactualizadas ?? 0);

      await revisionMensualService.marcarComoRevisado({
        mes,
        anio,
        userId: userProfile.uid,
        userNombre: userProfile.displayName,
        alertasDetectadas,
        utilidadNetaSnapshot: estado?.utilidadNeta,
      });
      await cargarDatos();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error marcando como revisado');
    } finally {
      setMarcandoRevisado(false);
    }
  };

  // ===== LOADING STATE =====
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-50">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
        <div className="text-[13px] font-semibold text-slate-700">Cargando revisión mensual…</div>
        <div className="text-[11px] text-slate-500">Consultando cuentas + verificaciones + historial</div>
      </div>
    );
  }

  const yaRevisado = revisionActual?.estado === 'revisado';

  return (
    <div className="space-y-4">
      {/* Error global */}
      {errorMsg && (
        <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 text-[11px] text-rose-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-700 mt-0.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* §1 · Header informativo */}
      <section className="bg-gradient-to-r from-slate-50 to-slate-100/40 ring-1 ring-slate-200/50 rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 flex-shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-slate-900">
                Revisión Mensual · {MESES[mes - 1]} {anio}
              </div>
              <div className="text-[11px] text-slate-500">
                Health check informal · sin obligación de cerrar · revisás cuando tengas la chance
              </div>
            </div>
          </div>
          {revisionActual && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                {yaRevisado ? 'Revisado' : 'En revisión'}
              </div>
              <div className="text-[12px] font-bold text-slate-700">
                {revisionActual.fechaRevision
                  ? revisionActual.fechaRevision.toDate().toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : '—'}
              </div>
              {revisionActual.revisadoPorNombre && (
                <div className="text-[10px] text-slate-500">
                  por {revisionActual.revisadoPorNombre}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* §2 · CONCILIACIÓN BANCARIA · protagonista */}
      <ConciliacionBancariaPanel
        resumen={resumenConciliacion}
        onAplicarAjuste={(cuenta) => {
          setCuentaAjuste(cuenta);
          setAjusteModalOpen(true);
        }}
        onIrAFinanzas={() => {
          // Cross-link a Finanzas/Saldos
          window.location.href = '/finanzas/saldos';
        }}
      />

      {/* §3 · Otros chequeos informativos · NO bloquean */}
      <OtrosChequeosPanel chequeos={chequeos} />

      {/* §4 · Acción opcional "Marcar como revisado" */}
      {!yaRevisado && (
        <section className="bg-gradient-to-r from-purple-50 to-purple-100/30 ring-1 ring-purple-200/50 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-[280px]">
            <Bookmark className="w-5 h-5 text-purple-700 mt-0.5" />
            <div>
              <div className="text-[12px] font-bold text-purple-900">
                ¿Terminaste de revisar {MESES[mes - 1]}?
              </div>
              <div className="text-[11px] text-purple-700">
                Opcional · solo deja registro de "fue revisado el {new Date().getDate()}/{
                  MESES[new Date().getMonth()].slice(0, 3)
                }" en el historial · no bloquea nada.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleMarcarRevisado}
            disabled={marcandoRevisado}
            className="text-[11px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg inline-flex items-center gap-2 disabled:opacity-60"
          >
            {marcandoRevisado ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Marcar {MESES[mes - 1]} como revisado
          </button>
        </section>
      )}

      {yaRevisado && (
        <section className="bg-emerald-50 ring-1 ring-emerald-200 rounded-2xl p-3 flex items-center gap-3 text-[11px] text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <span>
            Ya marcaste {MESES[mes - 1]} {anio} como revisado · igual podés seguir editando movimientos del mes libremente.
          </span>
        </section>
      )}

      {/* §5 · Historial de revisiones */}
      <HistorialRevisionesPanel historial={historial} />

      {/* §6 · Banner pedagógico */}
      <BannerPedagogico />

      {/* Modal aplicar ajuste */}
      {cuentaAjuste && (
        <AplicarAjusteModal
          isOpen={ajusteModalOpen}
          onClose={() => {
            setAjusteModalOpen(false);
            setCuentaAjuste(null);
          }}
          cuenta={cuentaAjuste}
          tipoCambio={tipoCambio}
          onSuccess={() => {
            setAjusteModalOpen(false);
            setCuentaAjuste(null);
            cargarDatos(); // refresh para ver el ajuste aplicado
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTE · CONCILIACIÓN BANCARIA PANEL
// ============================================================================

interface ConciliacionPanelProps {
  resumen: ResumenConciliacion | null;
  onAplicarAjuste: (cuenta: ConciliacionCuenta) => void;
  onIrAFinanzas: () => void;
}

const ESTADO_STYLE: Record<
  EstadoConciliacion,
  {
    iconBg: string;
    iconBorder: string;
    iconColor: string;
    Icon: React.ComponentType<{ className?: string }>;
    labelBg: string;
    labelText: string;
    label: string;
    rowBg: string;
  }
> = {
  verificada: {
    iconBg: 'bg-emerald-50',
    iconBorder: 'border-emerald-200',
    iconColor: 'text-emerald-600',
    Icon: CheckCircle2,
    labelBg: 'bg-emerald-50',
    labelText: 'text-emerald-700',
    label: 'VERIFICADA',
    rowBg: 'hover:bg-slate-50/40',
  },
  sin_verificar: {
    iconBg: 'bg-amber-50',
    iconBorder: 'border-amber-300',
    iconColor: 'text-amber-700',
    Icon: AlertCircle,
    labelBg: 'bg-amber-100',
    labelText: 'text-amber-700',
    label: 'SIN VERIFICAR',
    rowBg: 'bg-amber-50/30 hover:bg-amber-50/50',
  },
  desactualizada: {
    iconBg: 'bg-amber-50',
    iconBorder: 'border-amber-300',
    iconColor: 'text-amber-700',
    Icon: AlertCircle,
    labelBg: 'bg-amber-100',
    labelText: 'text-amber-700',
    label: 'DESACTUALIZADA',
    rowBg: 'bg-amber-50/30 hover:bg-amber-50/50',
  },
  desviacion: {
    iconBg: 'bg-rose-50',
    iconBorder: 'border-rose-300',
    iconColor: 'text-rose-700',
    Icon: AlertTriangle,
    labelBg: 'bg-rose-100',
    labelText: 'text-rose-700',
    label: 'DESVIACIÓN',
    rowBg: 'bg-rose-50/30 hover:bg-rose-50/50',
  },
};

function ConciliacionBancariaPanel({
  resumen,
  onAplicarAjuste,
  onIrAFinanzas,
}: ConciliacionPanelProps) {
  if (!resumen || resumen.cuentas.length === 0) {
    return (
      <section className="bg-white border-2 border-teal-200 rounded-2xl overflow-hidden ring-1 ring-teal-100">
        <div className="bg-gradient-to-r from-teal-50 to-teal-100/40 px-5 py-3 border-b border-teal-200/50">
          <h3 className="text-[13px] font-bold text-teal-900 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-teal-700" />
            Conciliación bancaria · ¿saldos reales coinciden con el sistema?
          </h3>
        </div>
        <div className="px-5 py-8 text-center text-[11px] text-slate-500 italic">
          No hay cuentas activas configuradas · creá una cuenta en Finanzas/Saldos primero.
        </div>
      </section>
    );
  }

  const totalListas = resumen.verificadas;
  const total = resumen.totalCuentas;

  return (
    <section className="bg-white border-2 border-teal-200 rounded-2xl overflow-hidden ring-1 ring-teal-100">
      <div className="bg-gradient-to-r from-teal-50 to-teal-100/40 px-5 py-3 border-b border-teal-200/50 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-[13px] font-bold text-teal-900 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-teal-700" />
          Conciliación bancaria · ¿saldos reales coinciden con el sistema?
        </h3>
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
            totalListas === total
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {totalListas} de {total} verificadas
        </span>
      </div>

      {/* Banner pedagógico */}
      <div className="bg-teal-50/30 border-b border-teal-100 px-5 py-2.5 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-teal-700 mt-0.5 flex-shrink-0" />
        <div className="text-[11px] text-teal-900 leading-snug">
          Lo único que <strong>realmente importa</strong>: que si entrás al banco/app y ves S/10,000,
          el sistema acá también diga S/10,000. Cuando hay desviación · podés{' '}
          <strong>aplicar ajuste</strong> para cuadrar.
        </div>
      </div>

      {/* Lista de cuentas */}
      <div className="divide-y divide-slate-100">
        {resumen.cuentas.map((cuenta) => (
          <CuentaConciliacionRow
            key={cuenta.cuentaId}
            cuenta={cuenta}
            onAplicarAjuste={() => onAplicarAjuste(cuenta)}
            onVerificar={() => onIrAFinanzas()}
          />
        ))}
      </div>

      {/* Footer · ir a Finanzas */}
      <div className="bg-slate-50 px-5 py-2.5 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="text-[10px] text-slate-600">
          Las verificaciones se gestionan en <strong>Finanzas → Saldos</strong>. Acá ves el resumen consolidado.
        </div>
        <button
          type="button"
          onClick={onIrAFinanzas}
          className="text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
        >
          Ir a Finanzas/Saldos
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// SUB-COMPONENTE · CUENTA ROW
// ============================================================================

interface CuentaRowProps {
  cuenta: ConciliacionCuenta;
  onAplicarAjuste: () => void;
  onVerificar: () => void;
}

function CuentaConciliacionRow({ cuenta, onAplicarAjuste, onVerificar }: CuentaRowProps) {
  const style = ESTADO_STYLE[cuenta.estado];
  const Icon = style.Icon;

  const tieneDesviacion = cuenta.estado === 'desviacion';
  const necesitaVerificar = cuenta.estado === 'sin_verificar' || cuenta.estado === 'desactualizada';

  const tituloColor = tieneDesviacion
    ? 'text-rose-900'
    : necesitaVerificar
    ? 'text-amber-900'
    : 'text-slate-900';

  const detalleColor = tieneDesviacion
    ? 'text-rose-700'
    : necesitaVerificar
    ? 'text-amber-700'
    : 'text-slate-500';

  return (
    <div className={`px-5 py-3 flex items-center gap-3 ${style.rowBg}`}>
      <div
        className={`w-10 h-10 rounded-lg ${style.iconBg} border ${style.iconBorder} flex items-center justify-center flex-shrink-0`}
      >
        <Icon className={`w-5 h-5 ${style.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[12px] font-bold flex items-center gap-2 flex-wrap ${tituloColor}`}>
          {cuenta.nombre}
          <span
            className={`text-[9px] ${style.labelBg} ${style.labelText} px-1.5 py-0.5 rounded font-bold whitespace-nowrap`}
          >
            {cuenta.estado === 'sin_verificar' && cuenta.diasDesdeVerificacion
              ? `${cuenta.diasDesdeVerificacion} DÍAS SIN VERIFICAR`
              : cuenta.estado === 'desviacion' && cuenta.desviacionPEN !== undefined
              ? `⚠ DESVIACIÓN ${formatCurrencyPEN(Math.abs(cuenta.desviacionPEN))}`
              : style.label}
          </span>
        </div>
        <div className={`text-[10px] ${detalleColor} mt-0.5`}>
          {tieneDesviacion && cuenta.saldoVerificadoPEN !== undefined ? (
            <>
              · Sistema: <strong className="tabular-nums">{formatCurrencyPEN(cuenta.saldoSistemaPEN)}</strong>
              · Última verif: <strong className="tabular-nums">{formatCurrencyPEN(cuenta.saldoVerificadoPEN)}</strong>
              · Diferencia sin explicar · cuadrá con ajuste
            </>
          ) : cuenta.estado === 'verificada' && cuenta.saldoVerificadoPEN !== undefined ? (
            <>
              · Sistema: <strong className="tabular-nums">{formatCurrencyPEN(cuenta.saldoSistemaPEN)}</strong>
              · Verificaste: <strong className="tabular-nums">{formatCurrencyPEN(cuenta.saldoVerificadoPEN)}</strong>
              · hace {cuenta.diasDesdeVerificacion} {cuenta.diasDesdeVerificacion === 1 ? 'día' : 'días'}
            </>
          ) : cuenta.estado === 'desactualizada' ? (
            <>
              · Sistema: <strong className="tabular-nums">{formatCurrencyPEN(cuenta.saldoSistemaPEN)}</strong>
              · Última verif: hace {cuenta.diasDesdeVerificacion} días · puede haber cambios sin reflejar
            </>
          ) : (
            <>
              · Sistema: <strong className="tabular-nums">{formatCurrencyPEN(cuenta.saldoSistemaPEN)}</strong>
              · sin verificación previa
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 items-stretch">
        {tieneDesviacion && (
          <button
            type="button"
            onClick={onAplicarAjuste}
            className="text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg inline-flex items-center justify-center gap-1"
            title="Crear movimiento de ajuste para cuadrar el sistema"
          >
            <Search className="w-3 h-3" />
            Aplicar ajuste
          </button>
        )}
        {!tieneDesviacion && (necesitaVerificar || cuenta.estado === 'verificada') && (
          <button
            type="button"
            onClick={onVerificar}
            className={
              necesitaVerificar
                ? 'text-[10px] font-bold text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg inline-flex items-center justify-center gap-1'
                : 'text-[10px] font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg inline-flex items-center justify-center gap-1'
            }
          >
            <RefreshCw className="w-3 h-3" />
            {necesitaVerificar ? 'Verificar ahora' : 'Re-verificar'}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTE · OTROS CHEQUEOS
// ============================================================================

function OtrosChequeosPanel({ chequeos }: { chequeos: ChequeoInformativo[] }) {
  if (chequeos.length === 0) return null;
  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-slate-600" />
          Otros chequeos · informativos
        </h3>
        <span className="text-[10px] text-slate-500">no bloquean · solo te orientan</span>
      </div>
      <div className="divide-y divide-slate-100">
        {chequeos.map((c) => (
          <ChequeoRow key={c.id} chequeo={c} />
        ))}
      </div>
    </section>
  );
}

function ChequeoRow({ chequeo }: { chequeo: ChequeoInformativo }) {
  const isOk = chequeo.polaridad === 'ok';
  const isWarning = chequeo.polaridad === 'warning';
  const Icon = isOk ? CheckCircle2 : AlertCircle;
  const iconColor = isOk ? 'text-emerald-600' : isWarning ? 'text-amber-600' : 'text-slate-500';
  const bgColor = isWarning ? 'bg-amber-50/30' : '';
  const titleColor = isWarning ? 'text-amber-900' : 'text-slate-900';
  const detailColor = isWarning ? 'text-amber-700' : 'text-slate-500';

  return (
    <div className={`px-5 py-2.5 flex items-center gap-3 ${bgColor}`}>
      <Icon className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className={`text-[12px] font-semibold ${titleColor}`}>{chequeo.titulo}</div>
        {chequeo.detalle && (
          <div className={`text-[10px] ${detailColor}`}>{chequeo.detalle}</div>
        )}
      </div>
      {isOk ? (
        <span className="text-[10px] text-emerald-700 font-bold">OK</span>
      ) : chequeo.crossLink ? (
        <CrossLinkButton crossLink={chequeo.crossLink} />
      ) : null}
    </div>
  );
}

function CrossLinkButton({ crossLink }: { crossLink: { label: string; ruta: string } }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(crossLink.ruta)}
      className="text-[10px] text-amber-700 font-bold hover:underline cursor-pointer"
    >
      {crossLink.label} →
    </button>
  );
}

// ============================================================================
// SUB-COMPONENTE · HISTORIAL
// ============================================================================

function HistorialRevisionesPanel({ historial }: { historial: RevisionMensualType[] }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-700" />
          Historial de revisiones
        </h3>
      </div>
      {historial.length === 0 ? (
        <div className="px-5 py-6 text-center text-[11px] text-slate-500 italic">
          Sin revisiones registradas aún · al marcar el primer mes como revisado aparecerá acá.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  Período
                </th>
                <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  Estado
                </th>
                <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  Revisado por
                </th>
                <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  Fecha
                </th>
                <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  Utilidad neta
                </th>
                <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  Alertas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historial.map((r) => (
                <HistorialRow key={r.id ?? `${r.mes}-${r.anio}`} revision={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HistorialRow({ revision }: { revision: RevisionMensualType }) {
  const fechaStr = revision.fechaRevision
    ? revision.fechaRevision.toDate().toLocaleDateString('es-PE')
    : '—';
  const utilidad = revision.utilidadNetaSnapshot;
  const alertas = revision.alertasDetectadas ?? 0;

  return (
    <tr>
      <td className="px-4 py-2 font-semibold text-slate-900">
        {MESES[revision.mes - 1]} {revision.anio}
      </td>
      <td className="px-4 py-2">
        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Revisado
        </span>
      </td>
      <td className="px-4 py-2 text-slate-700">
        {revision.revisadoPorNombre || revision.revisadoPor || '—'}
      </td>
      <td className="px-4 py-2 text-slate-700">{fechaStr}</td>
      <td className="px-4 py-2 text-right tabular-nums">
        {typeof utilidad === 'number' ? (
          <span className={utilidad >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
            {formatCurrencyPEN(utilidad)}
          </span>
        ) : (
          <span className="text-slate-400 italic">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-right text-[10px]">
        {alertas > 0 ? (
          <span className="text-amber-700">
            {alertas} {alertas === 1 ? 'observación' : 'observaciones'}
          </span>
        ) : (
          <span className="text-slate-500">0 observaciones</span>
        )}
      </td>
    </tr>
  );
}

// ============================================================================
// BANNER PEDAGÓGICO
// ============================================================================

function BannerPedagogico() {
  return (
    <section className="bg-slate-50 ring-1 ring-slate-200 rounded-2xl p-4 text-[11px] text-slate-700">
      <div className="flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
        <div className="space-y-2">
          <div>
            <div className="font-bold text-slate-900 mb-1">¿Qué es la Revisión Mensual?</div>
            <ul className="list-disc ml-4 space-y-0.5 text-slate-600">
              <li>
                Un <strong>health check informal</strong> · cuando tengas la chance · sin obligación
              </li>
              <li>
                Foco: <strong>conciliación bancaria</strong> · que saldos del sistema coincidan con
                los del banco
              </li>
              <li>
                Si hay desviación, podés <strong>aplicar ajuste</strong> que crea un movimiento
                contable trazable
              </li>
              <li>
                Los chequeos son <strong>informativos</strong> · NO bloquean modificaciones · podés
                seguir editando
              </li>
            </ul>
          </div>
          <div>
            <div className="font-bold text-slate-900 mb-1">¿Qué NO es?</div>
            <ul className="list-disc ml-4 space-y-0.5 text-slate-600">
              <li>NO es cierre contable formal (eso es para empresas con auditoría)</li>
              <li>NO bloquea ediciones del mes · podés modificar cuando quieras</li>
              <li>NO genera snapshot inmutable · datos siempre vivos</li>
              <li>NO es obligatorio · si pasan meses sin revisar, no pasa nada</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// HELPERS · derivar chequeos informativos del balance/estado
// ============================================================================

function derivarChequeosInformativos(
  balance: BalanceGeneral | null | undefined,
  estado: EstadoResultados | null | undefined,
): ChequeoInformativo[] {
  const chequeos: ChequeoInformativo[] = [];

  if (!balance || !estado) return chequeos;

  // Balance cuadrado
  if (balance.balanceCuadra) {
    chequeos.push({
      id: 'balance-cuadrado',
      polaridad: 'ok',
      titulo: 'Balance cuadrado',
      detalle: `Activo = Pasivo + Patrimonio · diferencia ${formatCurrencyPEN(0)}`,
    });
  } else {
    chequeos.push({
      id: 'balance-no-cuadra',
      polaridad: 'warning',
      titulo: 'Balance NO cuadra',
      detalle: `Diferencia detectada: ${formatCurrencyPEN(Math.abs(balance.diferencia))}`,
    });
  }

  // CxC vencidas
  const cxcMayor30 = balance.activos.corriente.cuentasPorCobrar.antiguedad.mayor30dias;
  if (cxcMayor30 > 0) {
    chequeos.push({
      id: 'cxc-vencidas',
      polaridad: 'warning',
      titulo: 'CxC vencidas >30 días',
      detalle: `${formatCurrencyPEN(cxcMayor30)} pendientes de cobro · revisar cobranza`,
      crossLink: { label: 'Revisar', ruta: '/finanzas/cuentas-corrientes' },
    });
  } else {
    chequeos.push({
      id: 'cxc-ok',
      polaridad: 'ok',
      titulo: 'CxC al día',
      detalle: 'Sin facturas vencidas >30 días',
    });
  }

  // Diferencial cambiario
  const dif = estado.otrosIngresosGastos.diferenciaCambiariaNeta;
  if (dif !== 0) {
    chequeos.push({
      id: 'diferencial-cambiario',
      polaridad: 'ok',
      titulo: 'Diferencial cambiario calculado',
      detalle: `${dif >= 0 ? '+' : ''}${formatCurrencyPEN(dif)} · reconocido en P&L`,
    });
  }

  // Anticipos clientes
  const anticipos = balance.pasivos.corriente.anticiposClientes?.totalAnticiposPEN ?? 0;
  if (anticipos > 0) {
    const cant = balance.pasivos.corriente.anticiposClientes?.cantidadVentas ?? 0;
    chequeos.push({
      id: 'anticipos-pendientes',
      polaridad: 'warning',
      titulo: `${cant} ventas con anticipo sin entregar`,
      detalle: `${formatCurrencyPEN(anticipos)} pendientes · asegurate de tener stock`,
      crossLink: { label: 'Ver ventas', ruta: '/ventas' },
    });
  }

  return chequeos;
}

// ============================================================================
// MODAL · APLICAR AJUSTE
// ============================================================================

interface AplicarAjusteModalProps {
  isOpen: boolean;
  onClose: () => void;
  cuenta: ConciliacionCuenta;
  tipoCambio: number;
  onSuccess: () => void;
}

function AplicarAjusteModal({
  isOpen,
  onClose,
  cuenta,
  tipoCambio,
  onSuccess,
}: AplicarAjusteModalProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [razon, setRazon] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setRazon('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!cuenta.desviacionOriginal || !cuenta.saldoVerificadoOriginal) {
    return null;
  }

  // El ajuste es el INVERSO de la desviación
  // Si sistema dice S/9500 y verificado dice S/10000:
  //   desviacionOriginal = 9500 - 10000 = -500
  //   ajuste necesario para cuadrar = +500 (sumar al sistema)
  const montoAjuste = -cuenta.desviacionOriginal;
  const esPositivo = montoAjuste > 0;
  const monedaAjuste: 'USD' | 'PEN' =
    cuenta.moneda === 'USD' ? 'USD' : 'PEN'; // bi-moneda · default PEN

  const handleSubmit = async () => {
    if (!userProfile?.uid) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await aplicarAjustePorVerificacion({
        cuentaId: cuenta.cuentaId,
        montoAjuste,
        moneda: monedaAjuste,
        tipoCambio,
        razon: razon.trim() || undefined,
        userId: userProfile.uid,
        userNombre: userProfile.displayName,
      });
      onSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error aplicando ajuste');
    } finally {
      setSubmitting(false);
    }
  };

  const colorTone = esPositivo ? 'emerald' : 'rose';

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Aplicar ajuste de caja"
      subtitle={`Cuadrar ${cuenta.nombre} con la realidad bancaria`}
      icon={Search}
      iconTone={colorTone === 'emerald' ? 'teal' : 'red'}
      submitLabel={submitting ? 'Aplicando…' : `Aplicar ajuste ${esPositivo ? '+' : ''}${formatCurrencyPEN(montoAjuste)}`}
      submitVariant="primary"
      submitIcon={CheckCircle2}
      cancelLabel="Cancelar"
      loading={submitting}
      disabled={submitting}
      size="md"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-[11px] text-rose-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-700 mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Resumen de la desviación */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-[12px]">
          <div className="flex justify-between">
            <span className="text-slate-600">Sistema dice (hoy):</span>
            <span className="tabular-nums font-bold text-slate-900">
              {formatCurrencyPEN(cuenta.saldoSistemaPEN)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Tu última verificación:</span>
            <span className="tabular-nums font-bold text-slate-900">
              {formatCurrencyPEN(cuenta.saldoVerificadoPEN ?? 0)}
            </span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between">
            <span className="font-bold text-slate-900">Ajuste a aplicar:</span>
            <span
              className={`tabular-nums font-bold text-[14px] ${
                esPositivo ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {esPositivo ? '+' : ''}
              {formatCurrencyPEN(montoAjuste)}
            </span>
          </div>
        </div>

        {/* Banner pedagógico */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Qué va a pasar:</strong> se crea un <strong>movimiento de ajuste</strong>{' '}
            ({esPositivo ? 'ajuste_positivo' : 'ajuste_negativo'}) que sumará/restará al saldo del sistema
            para cuadrar con la realidad. Queda con audit trail completo · vinculado a la verificación.
          </div>
        </div>

        {/* Razón opcional */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
            Razón del ajuste (opcional pero recomendado)
          </label>
          <textarea
            value={razon}
            onChange={(e) => setRazon(e.target.value)}
            placeholder="Ej: intereses bancarios no registrados · comisión de mantenimiento · transferencia recibida sin registrar..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            rows={3}
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Útil para revisar después qué fue lo que causó la desviación. Queda en el audit trail.
          </p>
        </div>

        {/* Aviso de TC para USD */}
        {monedaAjuste === 'USD' && (
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-[11px] text-sky-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-sky-700 mt-0.5 flex-shrink-0" />
            <span>
              Ajuste en USD · TC aplicado: <strong>S/ {tipoCambio.toFixed(4)}</strong>
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <Clock className="w-3 h-3" />
          Fecha del ajuste: {new Date().toLocaleDateString('es-PE')}
        </div>
      </div>
    </FormModalV2>
  );
}
