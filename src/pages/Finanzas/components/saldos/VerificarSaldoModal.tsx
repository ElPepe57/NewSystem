/**
 * VerificarSaldoModal — chk5.D-S9.B
 *
 * Modal de verificación manual de saldo contra el banco real.
 * Patrón pedagógico: el usuario abre el app del banco, lee el saldo, lo
 * ingresa acá, el sistema calcula la diferencia y lo deja registrado.
 *
 * NO es conciliación bancaria · no importa extractos · no hace matching.
 * Es simplemente un "checkpoint" que persiste como audit trail.
 *
 * Flujo:
 *   1. Muestra saldo ERP actual + última verificación (si existe)
 *   2. Usuario ingresa saldo banco real
 *   3. Sistema calcula y muestra la diferencia en vivo
 *   4. Click "Registrar verificación" → atomic transaction · cierra modal
 *   5. Toast con resultado + recarga producto en el drawer padre
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { FormModalV2 } from '../../../../design-system/components/FormModalV2';
import { tesoreriaService } from '../../../../services/tesoreria.service';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import type {
  CuentaCaja,
  MonedaTesoreria,
  VerificacionSaldoSnapshot,
} from '../../../../types/tesoreria.types';

// ─── Props ─────────────────────────────────────────────────────────

export interface VerificarSaldoModalProps {
  isOpen: boolean;
  onClose: () => void;
  cuenta: CuentaCaja | null;
  /** Callback al verificar exitoso · útil para refrescar el padre */
  onVerificado?: (snapshot: VerificacionSaldoSnapshot) => void;
}

// ─── Componente ────────────────────────────────────────────────────

export const VerificarSaldoModal: React.FC<VerificarSaldoModalProps> = ({
  isOpen,
  onClose,
  cuenta,
  onVerificado,
}) => {
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);
  const userId = useAuthStore((s) => s.user?.uid ?? '');
  const userNombre = useAuthStore((s) => s.user?.email ?? '');

  // Estado local del form
  const [monedaSeleccionada, setMonedaSeleccionada] = useState<MonedaTesoreria>('PEN');
  const [saldoBancoStr, setSaldoBancoStr] = useState('');
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset al abrir
  useEffect(() => {
    if (!isOpen) return;
    if (!cuenta) return;
    // Si la cuenta es mono-moneda, fijar moneda. Si es bi-moneda, default PEN.
    setMonedaSeleccionada(cuenta.esBiMoneda ? 'PEN' : cuenta.moneda);
    setSaldoBancoStr('');
    setNotas('');
    setSubmitting(false);
  }, [isOpen, cuenta]);

  // Computeds
  const saldoErpActual = useMemo<number>(() => {
    if (!cuenta) return 0;
    if (cuenta.esBiMoneda) {
      return monedaSeleccionada === 'USD'
        ? cuenta.saldoUSD ?? 0
        : cuenta.saldoPEN ?? 0;
    }
    return cuenta.moneda === monedaSeleccionada ? cuenta.saldoActual ?? 0 : 0;
  }, [cuenta, monedaSeleccionada]);

  const saldoBancoNum = useMemo(() => {
    const n = parseFloat(saldoBancoStr.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }, [saldoBancoStr]);

  const diferencia = useMemo(() => {
    if (saldoBancoNum === null) return null;
    return saldoBancoNum - saldoErpActual;
  }, [saldoBancoNum, saldoErpActual]);

  // Sólo la última verificación de la moneda seleccionada (cada moneda lleva su historial)
  const ultimaVerifMoneda = useMemo<VerificacionSaldoSnapshot | undefined>(() => {
    if (!cuenta) return undefined;
    if (cuenta.ultimaVerificacion?.moneda === monedaSeleccionada) return cuenta.ultimaVerificacion;
    return (cuenta.historialVerificaciones ?? []).find(v => v.moneda === monedaSeleccionada);
  }, [cuenta, monedaSeleccionada]);

  const diasDesdeUltima = useMemo(() => {
    if (!ultimaVerifMoneda) return null;
    const ms = ultimaVerifMoneda.fecha?.toMillis?.() ?? 0;
    if (!ms) return null;
    return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
  }, [ultimaVerifMoneda]);

  // Validación
  const valido = saldoBancoNum !== null;

  // Submit
  const handleSubmit = async () => {
    if (!cuenta || !valido || saldoBancoNum === null) return;
    setSubmitting(true);
    try {
      const result = await tesoreriaService.registrarVerificacionSaldo({
        cuentaId: cuenta.id,
        moneda: monedaSeleccionada,
        saldoBancoReportado: saldoBancoNum,
        notas: notas.trim() || undefined,
        userId,
        userNombre,
      });
      const labelMoneda = monedaSeleccionada === 'PEN' ? 'S/' : '$';
      const labelDif = Math.abs(result.snapshot.diferencia) < 0.01
        ? 'cuadre perfecto'
        : `diferencia de ${labelMoneda} ${Math.abs(result.snapshot.diferencia).toFixed(2)}`;
      toastSuccess(
        `Verificación registrada · ${labelDif}.`,
        cuenta.nombre,
      );
      onVerificado?.(result.snapshot);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toastError(msg, 'No se pudo registrar la verificación');
    } finally {
      setSubmitting(false);
    }
  };

  if (!cuenta) return null;

  // ─── Render ──
  const labelMoneda = monedaSeleccionada === 'PEN' ? 'S/' : '$';

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Verificar saldo"
      subtitle={`${cuenta.nombre} · checkpoint contra el banco real`}
      icon={ShieldCheck}
      iconTone="teal"
      submitLabel={submitting ? 'Registrando…' : 'Registrar verificación'}
      submitVariant="primary"
      submitIcon={CheckCircle2}
      cancelLabel="Cancelar"
      loading={submitting}
      disabled={!valido || submitting}
      size="md"
    >
      <div className="space-y-5">

        {/* Selector de moneda (solo si bi-moneda) */}
        {cuenta.esBiMoneda && (
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
              Moneda a verificar
            </label>
            <div className="flex gap-2">
              {(['PEN', 'USD'] as MonedaTesoreria[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonedaSeleccionada(m)}
                  className={
                    monedaSeleccionada === m
                      ? 'flex-1 px-3 py-2 rounded-lg border-2 border-teal-600 bg-teal-50 text-teal-900 font-bold text-[13px]'
                      : 'flex-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[13px]'
                  }
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Cada moneda tiene su propio historial · verificá una por vez.
            </p>
          </div>
        )}

        {/* Saldo ERP actual */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
            Saldo según ERP (ahora)
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900">
            {labelMoneda} {fmt(saldoErpActual)}
          </div>
        </div>

        {/* Última verificación */}
        {ultimaVerifMoneda ? (
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">
              <Clock className="w-3 h-3" />
              Última verificación
            </div>
            <div className="flex justify-between items-baseline">
              <div className="text-[12px] text-slate-700">
                {fmtFechaRelativa(ultimaVerifMoneda.fecha)}
                {diasDesdeUltima !== null && diasDesdeUltima > 30 && (
                  <span className="ml-1.5 text-[10px] text-amber-700 font-semibold">
                    (hace +30 días · conviene verificar)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500">
                {labelMoneda} {fmt(ultimaVerifMoneda.saldoBancoReportado)}
              </div>
            </div>
            <div className="text-[11px] text-slate-600">
              Diferencia detectada entonces:{' '}
              <span className={
                Math.abs(ultimaVerifMoneda.diferencia) < 0.01
                  ? 'text-emerald-700 font-semibold'
                  : 'text-amber-700 font-semibold'
              }>
                {labelMoneda} {fmt(Math.abs(ultimaVerifMoneda.diferencia))}
                {Math.abs(ultimaVerifMoneda.diferencia) < 0.01 ? ' · cuadre' : ''}
              </span>
            </div>
            {ultimaVerifMoneda.notas && (
              <div className="text-[11px] text-slate-500 italic border-l-2 border-slate-200 pl-2 mt-1">
                "{ultimaVerifMoneda.notas}"
              </div>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
            <div className="text-[12px] text-amber-900">
              <strong>Primera verificación</strong> de esta moneda en esta cuenta.
              A partir de hoy queda registrado el historial.
            </div>
          </div>
        )}

        {/* Form de verificación */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
              Saldo real en banco · ahora
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm tabular-nums">
                {labelMoneda}
              </span>
              <input
                type="number"
                step="0.01"
                value={saldoBancoStr}
                onChange={(e) => setSaldoBancoStr(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm tabular-nums focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Abrí el app del banco y copiá el saldo disponible · sin centavos
              está bien si así lo muestra el banco.
            </p>
          </div>

          {/* Preview de diferencia en vivo */}
          {diferencia !== null && (
            <div className={
              Math.abs(diferencia) < 0.01
                ? 'bg-emerald-50 border border-emerald-300 rounded-xl p-3'
                : Math.abs(diferencia) < 10
                ? 'bg-amber-50 border border-amber-300 rounded-xl p-3'
                : 'bg-rose-50 border border-rose-300 rounded-xl p-3'
            }>
              <div className="text-[10px] uppercase tracking-wider font-bold mb-1 text-slate-700">
                Diferencia detectada
              </div>
              <div className={
                Math.abs(diferencia) < 0.01
                  ? 'text-xl font-bold tabular-nums text-emerald-900'
                  : Math.abs(diferencia) < 10
                  ? 'text-xl font-bold tabular-nums text-amber-900'
                  : 'text-xl font-bold tabular-nums text-rose-900'
              }>
                {diferencia >= 0 ? '+' : '−'}{labelMoneda} {fmt(Math.abs(diferencia))}
              </div>
              <div className="text-[11px] text-slate-700 mt-1">
                {Math.abs(diferencia) < 0.01 && '✓ Cuadre perfecto · el ERP coincide con el banco.'}
                {Math.abs(diferencia) >= 0.01 && diferencia > 0 && (
                  <>El banco tiene <strong>más</strong> que el ERP · probablemente algún ingreso no registrado en el sistema.</>
                )}
                {Math.abs(diferencia) >= 0.01 && diferencia < 0 && (
                  <>El ERP tiene <strong>más</strong> que el banco · probablemente algún egreso no registrado en el sistema.</>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
              Notas (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Ej: diferencia por comisión bancaria pendiente de registrar"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 resize-none"
            />
          </div>
        </div>

      </div>
    </FormModalV2>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFechaRelativa(t: { toMillis: () => number } | null | undefined): string {
  if (!t) return '—';
  const ms = t.toMillis();
  if (!Number.isFinite(ms)) return '—';
  const dt = new Date(ms);
  const dias = Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
  const fechaCorta = dt.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (dias === 0) return `${fechaCorta} · hoy`;
  if (dias === 1) return `${fechaCorta} · ayer`;
  return `${fechaCorta} · hace ${dias} días`;
}
