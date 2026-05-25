/**
 * CierreMensual · canon v5.1 chk5.E-S5
 *
 * Pixel-perfect contra docs/mockups/contabilidad-tab-cierre-mensual-v5.1.html
 * - §1 Header período actual + estado (gradient purple)
 * - §2 Checklist pre-cierre · 6 validaciones con icons OK/warning/danger
 * - §3 Histórico de cierres · tabla canon con audit trail
 * - §4 Banner pedagógico explicando consecuencias del cierre
 * - Confirm dialogs preservados (cerrar + reabrir con motivo obligatorio)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ClipboardCheck,
  History,
  Eye,
  Info,
  Shield,
} from 'lucide-react';
import { ConfirmDialog } from '../../common';
import { cierreContableService } from '../../../services/cierreContable.service';
import { useAuthStore } from '../../../store/authStore';
import { hasRole } from '../../../types/auth.types';
import { formatCurrencyPEN } from '../../../utils/format';
import { logger } from '../../../lib/logger';
import type {
  CierreContable,
  ResultadoValidacion,
  ValidacionPreCierre,
} from '../../../types/cierreContable.types';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

interface CierreMensualProps {
  mes: number;
  anio: number;
}

export default function CierreMensual({ mes, anio }: CierreMensualProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const isAdmin = hasRole(userProfile, 'admin');

  // Estado
  const [validacionResult, setValidacionResult] = useState<ResultadoValidacion | null>(null);
  const [cierreActual, setCierreActual] = useState<CierreContable | null>(null);
  const [historial, setHistorial] = useState<CierreContable[]>([]);
  const [loading, setLoading] = useState(false);
  const [validando, setValidando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [showConfirmCierre, setShowConfirmCierre] = useState(false);
  const [showConfirmReapertura, setShowConfirmReapertura] = useState(false);
  const [motivoReapertura, setMotivoReapertura] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Cargar cierre actual e historial
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cierre, hist] = await Promise.all([
        cierreContableService.getCierre(mes, anio),
        cierreContableService.getHistorial(),
      ]);
      setCierreActual(cierre);
      setHistorial(hist);
      // Auto-validar al abrir si el periodo está abierto (mejor UX)
      if (!cierre || cierre.estado !== 'cerrado') {
        try {
          const result = await cierreContableService.validarPreCierre(mes, anio);
          setValidacionResult(result);
        } catch (vErr) {
          logger.error('Error en auto-validacion:', vErr);
        }
      }
    } catch (err) {
      logger.error('Error cargando datos de cierre:', err);
      setError('Error al cargar datos del cierre contable');
    } finally {
      setLoading(false);
    }
  }, [mes, anio]);

  useEffect(() => {
    cargarDatos();
    setValidacionResult(null);
  }, [cargarDatos]);

  // Ejecutar validación manual
  const ejecutarValidacion = async () => {
    setValidando(true);
    setError(null);
    try {
      const result = await cierreContableService.validarPreCierre(mes, anio);
      setValidacionResult(result);
    } catch (err) {
      logger.error('Error en validacion pre-cierre:', err);
      setError('Error al ejecutar las validaciones');
    } finally {
      setValidando(false);
    }
  };

  // Ejecutar cierre
  const ejecutarCierre = async () => {
    if (!userProfile?.uid) return;
    setCerrando(true);
    setError(null);
    try {
      const cierre = await cierreContableService.ejecutarCierre(mes, anio, userProfile.uid);
      setCierreActual(cierre);
      setValidacionResult(null);
      await cargarDatos();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al cerrar';
      setError(msg);
      logger.error('Error ejecutando cierre:', err);
    } finally {
      setCerrando(false);
      setShowConfirmCierre(false);
    }
  };

  // Reabrir cierre
  const ejecutarReapertura = async () => {
    if (!cierreActual?.id || !userProfile?.uid || !motivoReapertura.trim()) return;
    setError(null);
    try {
      await cierreContableService.reabrir(
        cierreActual.id,
        motivoReapertura.trim(),
        userProfile.uid,
      );
      setMotivoReapertura('');
      await cargarDatos();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al reabrir';
      setError(msg);
      logger.error('Error reabriendo cierre:', err);
    } finally {
      setShowConfirmReapertura(false);
    }
  };

  // ===== LOADING STATE · canon v5.1 spinner purple =====
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-50">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-slate-700">
            Cargando cierre contable…
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Validando · estado · histórico · audit trail
          </div>
        </div>
      </div>
    );
  }

  const periodoCerrado = cierreActual?.estado === 'cerrado';
  const validaciones = validacionResult?.validaciones ?? [];
  const totalValidaciones = validaciones.length;
  const validacionesOK = validaciones.filter((v) => v.resultado === 'aprobada').length;
  const validacionesCriticas = validacionesOK ? validaciones.filter((v) => v.resultado === 'rechazada').length : 0;
  const validacionesWarning = validaciones.filter(
    (v) => v.resultado !== 'aprobada' && v.resultado !== 'rechazada',
  ).length;
  const puedeCerrar = validacionResult?.puedesCerrar === true && validacionesCriticas === 0;

  return (
    <div className="space-y-4">
      {/* Error global (banner rose) */}
      {error && (
        <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 text-[11px] text-rose-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-700 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* §1 · Header período actual + estado */}
      <section className="bg-gradient-to-r from-purple-50 to-purple-100/30 ring-1 ring-purple-200/50 rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {periodoCerrado ? (
              <Lock className="w-5 h-5 text-purple-700" />
            ) : (
              <Unlock className="w-5 h-5 text-purple-700" />
            )}
            <div>
              <div className="text-[13px] font-bold text-purple-900">Cierre Contable Mensual</div>
              <div className="text-[11px] text-purple-700">
                Workflow controlado para certificar y bloquear cada período
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-purple-700 font-bold">
              Mes activo
            </div>
            <div className="text-[14px] font-bold text-purple-900">
              {MESES[mes - 1]} {anio}
            </div>
            {periodoCerrado ? (
              <div className="text-[10px] text-emerald-700 flex items-center gap-1 justify-end">
                <Lock className="w-3 h-3" /> Cerrado ·{' '}
                {cierreActual?.fechaCierre instanceof Date
                  ? cierreActual.fechaCierre.toLocaleDateString('es-PE')
                  : '—'}
              </div>
            ) : (
              <div className="text-[10px] text-amber-700 flex items-center gap-1 justify-end">
                <Unlock className="w-3 h-3" /> Abierto · sin cerrar
              </div>
            )}
          </div>
        </div>
      </section>

      {/* §2 · Checklist pre-cierre (solo si NO está cerrado) */}
      {!periodoCerrado && (
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-600" />
              Checklist pre-cierre · {totalValidaciones || '6'} validaciones requeridas
            </h3>
            <div className="flex items-center gap-2">
              {validacionResult && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    puedeCerrar
                      ? 'bg-emerald-50 text-emerald-700'
                      : validacionesCriticas > 0
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {validacionesOK} de {totalValidaciones} ✓
                </span>
              )}
              <button
                onClick={ejecutarValidacion}
                disabled={validando}
                className="text-[10px] font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded inline-flex items-center gap-1 disabled:opacity-50"
                title="Re-ejecutar validaciones del checklist"
              >
                {validando ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Shield className="w-3 h-3" />
                )}
                Re-validar
              </button>
            </div>
          </div>

          {!validacionResult ? (
            <div className="px-5 py-8 text-center text-[11px] text-slate-500">
              {validando ? 'Ejecutando validaciones…' : 'Sin resultado · click en "Re-validar"'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {validaciones.length === 0 && (
                <div className="px-5 py-8 text-center text-[11px] text-slate-500">
                  Sin validaciones configuradas
                </div>
              )}
              {validaciones.map((v) => (
                <ChecklistRow key={v.id} validacion={v} />
              ))}
            </div>
          )}

          {/* Footer · acción primary cerrar */}
          <div className="bg-slate-50 px-5 py-3 flex items-center justify-between border-t border-slate-200 flex-wrap gap-3">
            <div className="text-[11px] text-slate-600">
              {puedeCerrar ? (
                <span>
                  <strong className="text-emerald-700">Todo OK.</strong> Listo para cerrar el mes.
                </span>
              ) : validacionesCriticas > 0 ? (
                <span>
                  <strong className="text-rose-700">
                    {validacionesCriticas} validación{validacionesCriticas > 1 ? 'es' : ''} crítica
                    {validacionesCriticas > 1 ? 's' : ''}.
                  </strong>{' '}
                  Resolvé antes de cerrar.
                </span>
              ) : validacionesWarning > 0 ? (
                <span>
                  <strong className="text-amber-700">
                    {validacionesWarning} ítem{validacionesWarning > 1 ? 's' : ''} requiere
                    {validacionesWarning > 1 ? 'n' : ''} atención.
                  </strong>{' '}
                  Revisá antes de cerrar.
                </span>
              ) : (
                <span>Ejecutá las validaciones para verificar el período.</span>
              )}
            </div>
            <button
              onClick={() => setShowConfirmCierre(true)}
              disabled={!puedeCerrar || !isAdmin || cerrando}
              className={`text-[12px] font-bold px-4 py-2 rounded-lg flex items-center gap-2 ${
                puedeCerrar && isAdmin && !cerrando
                  ? 'text-white bg-purple-600 hover:bg-purple-700'
                  : 'text-white bg-slate-300 cursor-not-allowed opacity-70'
              }`}
              title={
                !isAdmin
                  ? 'Solo administradores pueden cerrar el período'
                  : !puedeCerrar
                  ? 'Resolvé las validaciones críticas antes de cerrar'
                  : 'Cerrar y bloquear el período'
              }
            >
              {cerrando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              Cerrar {MESES[mes - 1]} {anio}
            </button>
          </div>
        </section>
      )}

      {/* Sección reabrir (si está cerrado y es admin) */}
      {periodoCerrado && isAdmin && (
        <section className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-[11px] text-slate-600">
              Si necesitás corregir movimientos del período cerrado, podés re-abrirlo. La acción
              queda registrada en el audit trail.
            </div>
            <button
              onClick={() => setShowConfirmReapertura(true)}
              className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" /> Re-abrir {MESES[mes - 1]} {anio}
            </button>
          </div>
        </section>
      )}

      {/* §3 · Histórico de cierres */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-700" />
            Histórico de cierres
          </h3>
        </div>

        {historial.length === 0 ? (
          <div className="px-5 py-8 text-center text-[11px] text-slate-500 italic">
            Sin cierres registrados aún
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
                    Cerrado por
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-700">
                    Fecha cierre
                  </th>
                  <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700">
                    Utilidad neta
                  </th>
                  <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-slate-700">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historial.map((c) => (
                  <HistorialRow key={c.id ?? `${c.mes}-${c.anio}`} cierre={c} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* §4 · Banner pedagógico */}
      <section className="bg-slate-50 ring-1 ring-slate-200 rounded-2xl p-4 text-[11px] text-slate-700">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <div className="font-semibold text-slate-900">¿Qué pasa cuando cerrás un mes?</div>
            <ul className="list-disc ml-4 space-y-0.5 text-slate-600">
              <li>
                Se <strong>bloquean modificaciones</strong> a movimientos del período (ventas ·
                compras · gastos)
              </li>
              <li>
                Se genera <strong>snapshot inmutable</strong> de Balance General + Estado de
                Resultados + Indicadores
              </li>
              <li>
                Quedan registrados <strong>quién</strong> cerró y <strong>cuándo</strong> (audit
                trail completo)
              </li>
              <li>
                Para corregir algo: <strong>re-abrir</strong> el período (acción auditada con
                motivo obligatorio) · hacer cambios · volver a cerrar
              </li>
              <li>
                La utilidad del período se traslada automáticamente a{' '}
                <strong>"Utilidades acumuladas"</strong> en el siguiente Balance General
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Dialog confirmación cierre */}
      <ConfirmDialog
        isOpen={showConfirmCierre}
        onClose={() => setShowConfirmCierre(false)}
        onConfirm={ejecutarCierre}
        title="Confirmar Cierre Contable"
        message={
          <div className="space-y-2 text-sm">
            <p>
              Se cerrará el período{' '}
              <strong>
                {MESES[mes - 1]} {anio}
              </strong>
              .
            </p>
            <p className="text-slate-500 text-xs">
              Se generará un snapshot inmutable de los estados financieros. No se podrán registrar
              movimientos en este período hasta que se re-abra.
            </p>
            {validacionResult && validacionResult.advertencias > 0 && (
              <p className="text-amber-600 text-xs">
                Nota: hay {validacionResult.advertencias} advertencia(s) pendiente(s).
              </p>
            )}
          </div>
        }
        confirmText="Cerrar período"
        variant="warning"
        loading={cerrando}
        icon={<Lock className="h-6 w-6" />}
      />

      {/* Dialog confirmación reapertura */}
      <ConfirmDialog
        isOpen={showConfirmReapertura}
        onClose={() => {
          setShowConfirmReapertura(false);
          setMotivoReapertura('');
        }}
        onConfirm={ejecutarReapertura}
        title="Re-abrir período contable"
        message={
          <div className="space-y-3">
            <p className="text-sm">
              Se re-abrirá el período{' '}
              <strong>
                {MESES[mes - 1]} {anio}
              </strong>
              . La acción queda registrada en el audit trail.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Motivo de re-apertura (obligatorio)
              </label>
              <textarea
                value={motivoReapertura}
                onChange={(e) => setMotivoReapertura(e.target.value)}
                placeholder="Describí brevemente por qué reabrís este período…"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={3}
              />
            </div>
          </div>
        }
        confirmText={motivoReapertura.trim() ? 'Re-abrir período' : 'Ingresá un motivo'}
        variant="warning"
      />
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTES
// ============================================================================

function ChecklistRow({ validacion }: { validacion: ValidacionPreCierre }) {
  const isOK = validacion.resultado === 'aprobada';
  const isCritica = validacion.resultado === 'rechazada';
  // Cualquier otro estado (advertencia, pendiente, no-aplica) lo tratamos como warning visual

  const bg = isCritica ? 'bg-rose-50/40' : !isOK ? 'bg-amber-50/40' : '';
  const Icon = isOK ? CheckCircle2 : isCritica ? XCircle : AlertCircle;
  const iconColor = isOK
    ? 'text-emerald-600'
    : isCritica
    ? 'text-rose-600'
    : 'text-amber-600';
  const labelColor = isOK
    ? 'text-slate-900'
    : isCritica
    ? 'text-rose-900'
    : 'text-amber-900';
  const detalleColor = isOK
    ? 'text-slate-500'
    : isCritica
    ? 'text-rose-700'
    : 'text-amber-700';
  const statusLabel = isOK ? 'OK' : isCritica ? 'CRÍTICA' : 'REVISAR';
  const statusColor = isOK ? 'text-emerald-700' : isCritica ? 'text-rose-700' : 'text-amber-700';

  return (
    <div className={`px-5 py-3 flex items-center gap-3 ${bg}`}>
      <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className={`text-[12px] font-semibold ${labelColor}`}>{validacion.nombre}</div>
        {validacion.detalle && (
          <div className={`text-[10px] ${detalleColor}`}>{validacion.detalle}</div>
        )}
      </div>
      <span className={`text-[10px] font-bold ${statusColor}`}>{statusLabel}</span>
    </div>
  );
}

function HistorialRow({ cierre }: { cierre: CierreContable }) {
  const isOpen = cierre.estado !== 'cerrado';
  const utilidad = cierre.snapshot?.estadoResultados?.utilidadNeta ?? 0;
  const fechaStr =
    cierre.fechaCierre instanceof Date
      ? `${cierre.fechaCierre.toLocaleDateString('es-PE')} · ${cierre.fechaCierre.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`
      : '—';

  return (
    <tr className={isOpen ? 'bg-amber-50/30' : ''}>
      <td className="px-4 py-2 font-semibold text-slate-900">
        {MESES[cierre.mes - 1]} {cierre.anio}
      </td>
      <td className="px-4 py-2">
        {isOpen ? (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1">
            <Unlock className="w-3 h-3" /> Abierto
          </span>
        ) : (
          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1">
            <Lock className="w-3 h-3" /> Cerrado
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-slate-700">
        {isOpen ? <span className="text-slate-500 italic">—</span> : cierre.cerradoPor || '—'}
      </td>
      <td className="px-4 py-2 text-slate-700">
        {isOpen ? <span className="text-slate-500 italic">—</span> : fechaStr}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {cierre.snapshot ? (
          <span
            className={
              utilidad >= 0
                ? isOpen
                  ? 'text-slate-600'
                  : 'font-semibold text-emerald-700'
                : 'font-semibold text-rose-600'
            }
          >
            {formatCurrencyPEN(utilidad)}
            {isOpen && ' *'}
          </span>
        ) : (
          <span className="text-slate-400 italic">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-right">
        {isOpen ? (
          <span className="text-[10px] text-slate-400 italic">En proceso</span>
        ) : (
          <div className="flex justify-end gap-1">
            <button
              className="text-[10px] text-slate-600 hover:bg-slate-100 px-2 py-1 rounded inline-flex items-center gap-1"
              title="Ver snapshot del cierre"
            >
              <Eye className="w-3 h-3" /> Ver
            </button>
            {/* Botón Re-abrir solo aparece en el cierre activo (que ya tiene su propio bloque arriba) */}
          </div>
        )}
      </td>
    </tr>
  );
}
