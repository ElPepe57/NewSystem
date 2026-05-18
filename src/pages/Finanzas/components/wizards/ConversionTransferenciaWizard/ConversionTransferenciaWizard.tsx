/**
 * ConversionTransferenciaWizard — Imp-L7 · Refactor visual S58e (mockup M7)
 *
 * Wizard banking-grade unificado para 2 flujos internos de tesorería:
 *   - Conversión cambiaria USD↔PEN (par de movimientos vinculados)
 *   - Transferencia interna entre productos propios
 *
 * Reemplaza TabConversiones + TabTransferencias en una sola UI con toggle
 * al inicio. Reusa los services del modelo nuevo F2:
 *   - registrarConversionCambiaria (par con idempotencyKey)
 *   - registrarTransferenciaInterna (un movimiento que afecta 2 productos)
 *
 * 3 pasos · sidebar derecho persistente con resumen.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  ArrowLeftRight,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useToastStore } from '../../../../../store/toastStore';
import { useAuthStore } from '../../../../../store/authStore';
import { useTesoreriaStore } from '../../../../../store/tesoreriaStore';
import {
  registrarConversionCambiaria,
  registrarTransferenciaInterna,
} from '../../../../../services/movimientoFinanciero.service';
import type { MonedaTesoreria, CuentaCaja } from '../../../../../types/tesoreria.types';
import { cn } from '../../../../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

type Variante = 'conversion' | 'transferencia';
type Paso = 'origen-destino' | 'monto-tc' | 'confirmar';

interface FormState {
  productoOrigenId: string;
  productoDestinoId: string;
  monedaOrigen: MonedaTesoreria;
  monedaDestino: MonedaTesoreria;
  monto: number;
  tipoCambio: number;
  fecha: string;
  concepto: string;
  notas: string;
  diferencialCambiario: number; // solo conversión
}

const INITIAL: FormState = {
  productoOrigenId: '',
  productoDestinoId: '',
  monedaOrigen: 'USD',
  monedaDestino: 'PEN',
  monto: 0,
  tipoCambio: 3.85,
  fecha: new Date().toISOString().slice(0, 10),
  concepto: '',
  notas: '',
  diferencialCambiario: 0,
};

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function fmtMonto(n: number, moneda: MonedaTesoreria): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  return `${sym} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcularMontoDestino(
  variante: Variante,
  monto: number,
  monedaOrigen: MonedaTesoreria,
  monedaDestino: MonedaTesoreria,
  tipoCambio: number,
): number {
  if (variante === 'transferencia' || monedaOrigen === monedaDestino) {
    return monto;
  }
  // Conversión
  return monedaOrigen === 'USD' ? monto * tipoCambio : monto / tipoCambio;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

/**
 * Props · chk5.D-S7.SF5 (2026-05-16) · solo modal invocable.
 *
 * El modo page standalone fue eliminado al borrar `/pages/Tesoreria/Tesoreria.tsx`
 * (sprint S7.SF2). Ahora el wizard es invocado ÚNICAMENTE como modal desde
 * el shell Finanzas (`FinanzasLayout`).
 *
 * `varianteInicial` permite pre-seleccionar conversion vs transferencia
 * según la acción del dropdown que lo invoca.
 */
export interface ConversionTransferenciaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  varianteInicial?: 'conversion' | 'transferencia';
}

export const ConversionTransferenciaWizard: React.FC<ConversionTransferenciaWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
  varianteInicial,
}) => {
  const cuentas = useTesoreriaStore((s) => s.cuentas);
  const fetchAll = useTesoreriaStore((s) => s.fetchAll);
  const toast = useToastStore();
  const { user } = useAuthStore();

  const [variante, setVariante] = useState<Variante>(varianteInicial ?? 'conversion');
  const [paso, setPaso] = useState<Paso>('origen-destino');
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const cuentasActivas = useMemo(
    () => cuentas.filter((c) => c.activa),
    [cuentas],
  );

  // Cuentas filtradas por moneda según variante
  const cuentasOrigen = useMemo(() => {
    return cuentasActivas.filter(
      (c) => c.esBiMoneda || c.moneda === form.monedaOrigen,
    );
  }, [cuentasActivas, form.monedaOrigen]);

  const cuentasDestino = useMemo(() => {
    if (variante === 'transferencia') {
      // Transferencia: misma moneda, distinto producto
      return cuentasActivas.filter(
        (c) =>
          (c.esBiMoneda || c.moneda === form.monedaOrigen) &&
          c.id !== form.productoOrigenId,
      );
    }
    // Conversión: moneda destino distinta a origen
    return cuentasActivas.filter(
      (c) =>
        (c.esBiMoneda || c.moneda === form.monedaDestino) &&
        c.id !== form.productoOrigenId,
    );
  }, [cuentasActivas, form.monedaDestino, form.monedaOrigen, form.productoOrigenId, variante]);

  const productoOrigen = cuentas.find((c) => c.id === form.productoOrigenId) ?? null;
  const productoDestino = cuentas.find((c) => c.id === form.productoDestinoId) ?? null;

  // Monto destino calculado
  const montoDestino = useMemo(
    () => calcularMontoDestino(variante, form.monto, form.monedaOrigen, form.monedaDestino, form.tipoCambio),
    [variante, form.monto, form.monedaOrigen, form.monedaDestino, form.tipoCambio],
  );

  // Validaciones por paso
  const puedeAvanzar = useMemo(() => {
    if (paso === 'origen-destino') {
      return !!(form.productoOrigenId && form.productoDestinoId);
    }
    if (paso === 'monto-tc') {
      if (form.monto <= 0) return false;
      if (variante === 'conversion' && form.tipoCambio <= 0) return false;
      return true;
    }
    return true;
  }, [paso, form, variante]);

  // ─── Cambio de variante ──
  const handleSelectVariante = (v: Variante) => {
    setVariante(v);
    setPaso('origen-destino');
    if (v === 'transferencia') {
      // Transferencia: misma moneda
      setForm((prev) => ({
        ...prev,
        monedaDestino: prev.monedaOrigen,
        productoOrigenId: '',
        productoDestinoId: '',
      }));
    } else {
      // Conversión: monedas distintas
      setForm((prev) => ({
        ...prev,
        monedaDestino: prev.monedaOrigen === 'USD' ? 'PEN' : 'USD',
        productoOrigenId: '',
        productoDestinoId: '',
      }));
    }
  };

  const handleAvanzar = () => {
    if (!puedeAvanzar) return;
    if (paso === 'origen-destino') setPaso('monto-tc');
    else if (paso === 'monto-tc') setPaso('confirmar');
    else if (paso === 'confirmar') void handleEjecutar();
  };

  const handleRetroceder = () => {
    if (paso === 'monto-tc') setPaso('origen-destino');
    else if (paso === 'confirmar') setPaso('monto-tc');
  };

  // ─── Ejecución ──
  const handleEjecutar = async () => {
    if (!user?.uid) {
      toast.error('No se pudo identificar al usuario');
      return;
    }
    setSubmitting(true);
    try {
      const fechaDate = new Date(form.fecha + 'T12:00:00');
      if (variante === 'conversion') {
        await registrarConversionCambiaria(
          {
            productoOrigenId: form.productoOrigenId,
            productoDestinoId: form.productoDestinoId,
            montoOrigen: form.monto,
            monedaOrigen: form.monedaOrigen,
            monedaDestino: form.monedaDestino,
            tipoCambio: form.tipoCambio,
            fecha: fechaDate,
            concepto: form.concepto || `Conversión ${form.monedaOrigen}→${form.monedaDestino}`,
            notas: form.notas || undefined,
          },
          user.uid,
        );
        toast.success(
          `Conversión registrada · ${fmtMonto(form.monto, form.monedaOrigen)} → ${fmtMonto(montoDestino, form.monedaDestino)}`,
        );
      } else {
        await registrarTransferenciaInterna(
          {
            productoOrigenId: form.productoOrigenId,
            productoDestinoId: form.productoDestinoId,
            monto: form.monto,
            moneda: form.monedaOrigen,
            tipoCambio: form.tipoCambio,
            fecha: fechaDate,
            concepto: form.concepto || `Transferencia interna`,
            notas: form.notas || undefined,
          },
          user.uid,
        );
        toast.success(
          `Transferencia registrada · ${fmtMonto(form.monto, form.monedaOrigen)}`,
        );
      }
      // Reset + invocar callback de éxito
      setForm(INITIAL);
      setPaso('origen-destino');
      void fetchAll();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar el movimiento');
    } finally {
      setSubmitting(false);
    }
  };

  // Color del wizard según variante
  const accentClass = variante === 'conversion' ? 'teal' : 'slate';

  // ─── chk5.D-S7.SF5 · Sólo modal · si isOpen=false retorna null ────
  if (!isOpen) return null;

  // ─── Render contenido ────────────────────────────────────────────────
  const contenido = (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Toggle variante */}
      <div className="border-b border-slate-200 p-4 bg-slate-50">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Tipo de operación
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleSelectVariante('conversion')}
            className={cn(
              'border-2 rounded-xl p-4 text-left transition-all duration-200',
              'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]',
              variante === 'conversion'
                ? 'border-teal-300 bg-teal-50'
                : 'border-slate-200 bg-white hover:border-slate-300',
            )}
          >
            <div className="flex items-center gap-3 mb-1">
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center',
                  variante === 'conversion' ? 'bg-teal-100' : 'bg-slate-100',
                )}
              >
                <RefreshCw
                  className={cn(
                    'w-4 h-4',
                    variante === 'conversion' ? 'text-teal-700' : 'text-slate-500',
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-sm font-semibold',
                  variante === 'conversion' ? 'text-teal-800' : 'text-slate-700',
                )}
              >
                Conversión USD ↔ PEN
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Cambio de moneda con TC del día. Crea par de movimientos vinculados.
            </p>
          </button>
          <button
            type="button"
            onClick={() => handleSelectVariante('transferencia')}
            className={cn(
              'border-2 rounded-xl p-4 text-left transition-all duration-200',
              'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]',
              variante === 'transferencia'
                ? 'border-slate-400 bg-slate-100'
                : 'border-slate-200 bg-white hover:border-slate-300',
            )}
          >
            <div className="flex items-center gap-3 mb-1">
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center',
                  variante === 'transferencia' ? 'bg-slate-300' : 'bg-slate-100',
                )}
              >
                <ArrowLeftRight
                  className={cn(
                    'w-4 h-4',
                    variante === 'transferencia' ? 'text-slate-700' : 'text-slate-500',
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-sm font-semibold',
                  variante === 'transferencia' ? 'text-slate-800' : 'text-slate-700',
                )}
              >
                Transferencia interna
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Mover dinero entre productos propios. Sin cambio de moneda. No
              afecta patrimonio neto.
            </p>
          </button>
        </div>
      </div>

      {/* Wizard + sidebar */}
      <div className="flex flex-col lg:flex-row min-h-[420px]">
        {/* Contenido principal */}
        <div className="flex-1 min-w-0 p-5">
          {/* Stepper compacto */}
          <div className="flex items-center gap-2 mb-5 text-xs">
            {(['origen-destino', 'monto-tc', 'confirmar'] as Paso[]).map((p, idx) => {
              const isActive = paso === p;
              const isDone =
                (paso === 'monto-tc' && p === 'origen-destino') ||
                (paso === 'confirmar' && p !== 'confirmar');
              return (
                <React.Fragment key={p}>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold',
                        isDone && 'bg-emerald-600 text-white',
                        isActive && 'bg-teal-600 text-white ring-2 ring-teal-100',
                        !isActive && !isDone && 'bg-slate-200 text-slate-400',
                      )}
                    >
                      {isDone ? <Check className="w-3 h-3" /> : idx + 1}
                    </div>
                    <span
                      className={cn(
                        'whitespace-nowrap',
                        isActive && 'text-teal-800 font-semibold',
                        isDone && 'text-emerald-700',
                        !isActive && !isDone && 'text-slate-400',
                      )}
                    >
                      {p === 'origen-destino' ? 'Origen y destino' : p === 'monto-tc' ? 'Monto y TC' : 'Confirmar'}
                    </span>
                  </div>
                  {idx < 2 && <div className="h-px flex-1 bg-slate-200 max-w-8" />}
                </React.Fragment>
              );
            })}
          </div>

          {/* PASO 1 · Origen + Destino */}
          {paso === 'origen-destino' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Productos involucrados
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {variante === 'conversion'
                    ? 'Selecciona el producto USD y el producto PEN para la conversión.'
                    : 'Selecciona el producto origen y el producto destino. Misma moneda.'}
                </p>
              </div>

              {/* Selector de moneda (solo conversión) */}
              {variante === 'conversion' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({ ...p, monedaOrigen: 'USD', monedaDestino: 'PEN', productoOrigenId: '', productoDestinoId: '' }))
                    }
                    className={cn(
                      'border-2 rounded-lg p-2.5 text-center transition-all',
                      form.monedaOrigen === 'USD'
                        ? 'border-teal-300 bg-teal-50 text-teal-700'
                        : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <div className="text-sm font-semibold">USD → PEN</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Vender dólares
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({ ...p, monedaOrigen: 'PEN', monedaDestino: 'USD', productoOrigenId: '', productoDestinoId: '' }))
                    }
                    className={cn(
                      'border-2 rounded-lg p-2.5 text-center transition-all',
                      form.monedaOrigen === 'PEN'
                        ? 'border-teal-300 bg-teal-50 text-teal-700'
                        : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <div className="text-sm font-semibold">PEN → USD</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Comprar dólares
                    </div>
                  </button>
                </div>
              )}

              {/* Selector de moneda (transferencia) */}
              {variante === 'transferencia' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Moneda
                  </label>
                  <select
                    value={form.monedaOrigen}
                    onChange={(e) => {
                      const m = e.target.value as MonedaTesoreria;
                      setForm((p) => ({
                        ...p,
                        monedaOrigen: m,
                        monedaDestino: m,
                        productoOrigenId: '',
                        productoDestinoId: '',
                      }));
                    }}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:border-teal-500"
                  >
                    <option value="PEN">PEN</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              )}

              {/* Producto origen */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Producto origen <span className="text-red-500">*</span>{' '}
                  <span className="text-slate-400">(de donde sale el dinero)</span>
                </label>
                <select
                  value={form.productoOrigenId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, productoOrigenId: e.target.value }))
                  }
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:border-teal-500"
                >
                  <option value="">— Seleccionar —</option>
                  {cuentasOrigen.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.moneda}{c.esBiMoneda ? ' bi-moneda' : ''})
                    </option>
                  ))}
                </select>
              </div>

              {/* Producto destino */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Producto destino <span className="text-red-500">*</span>{' '}
                  <span className="text-slate-400">(donde entra el dinero)</span>
                </label>
                <select
                  value={form.productoDestinoId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, productoDestinoId: e.target.value }))
                  }
                  disabled={!form.productoOrigenId}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:border-teal-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">— Seleccionar —</option>
                  {cuentasDestino.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.moneda}{c.esBiMoneda ? ' bi-moneda' : ''})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* PASO 2 · Monto + TC */}
          {paso === 'monto-tc' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {variante === 'conversion' ? 'Monto y tipo de cambio' : 'Monto a transferir'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {variante === 'conversion'
                    ? 'Indica el monto en moneda origen y el TC aplicado. El monto destino se calcula automáticamente.'
                    : 'Indica el monto a mover entre los productos.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Monto en {form.monedaOrigen} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.monto || ''}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, monto: parseFloat(e.target.value) || 0 }))
                    }
                    placeholder="0.00"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:border-teal-500 tabular-nums"
                  />
                </div>
                {variante === 'conversion' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Tipo de cambio <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={form.tipoCambio || ''}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, tipoCambio: parseFloat(e.target.value) || 0 }))
                      }
                      placeholder="3.85"
                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:border-teal-500 tabular-nums"
                    />
                  </div>
                )}
              </div>

              {/* Preview monto destino · solo conversión */}
              {variante === 'conversion' && form.monto > 0 && form.tipoCambio > 0 && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-xs text-teal-700">
                    Recibirás en {form.monedaDestino}:
                  </span>
                  <span className="text-lg font-bold text-teal-900 tabular-nums">
                    {fmtMonto(montoDestino, form.monedaDestino)}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Concepto (opcional)
                  </label>
                  <input
                    type="text"
                    value={form.concepto}
                    onChange={(e) => setForm((p) => ({ ...p, concepto: e.target.value }))}
                    placeholder="Detalle de la operación"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                  rows={2}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:border-teal-500"
                />
              </div>
            </div>
          )}

          {/* PASO 3 · Confirmar */}
          {paso === 'confirmar' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Confirmar {variante === 'conversion' ? 'conversión' : 'transferencia'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Revisa los datos antes de ejecutar.
                </p>
              </div>

              {/* Cards origen → destino */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-1">
                    Saldrá de
                  </div>
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {productoOrigen?.nombre ?? '—'}
                  </div>
                  <div className="text-xl font-bold text-red-700 tabular-nums mt-2">
                    −{fmtMonto(form.monto, form.monedaOrigen)}
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1">
                    Entrará a
                  </div>
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {productoDestino?.nombre ?? '—'}
                  </div>
                  <div className="text-xl font-bold text-emerald-700 tabular-nums mt-2">
                    +{fmtMonto(montoDestino, form.monedaDestino)}
                  </div>
                </div>
              </div>

              {/* Datos extras */}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                {variante === 'conversion' && (
                  <div>
                    <span className="text-slate-500">TC aplicado:</span>{' '}
                    <span className="font-semibold text-slate-900 tabular-nums">
                      S/ {form.tipoCambio.toFixed(3)}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Fecha:</span>{' '}
                  <span className="font-semibold text-slate-900">{form.fecha}</span>
                </div>
                {form.concepto && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Concepto:</span>{' '}
                    <span className="text-slate-800">{form.concepto}</span>
                  </div>
                )}
                {form.notas && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Notas:</span>{' '}
                    <span className="text-slate-700 italic">{form.notas}</span>
                  </div>
                )}
              </div>

              {variante === 'conversion' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    Se crearán 2 movimientos vinculados (par conversión salida +
                    entrada) con la misma clave de idempotencia. El diferencial
                    cambiario se reflejará en el P&L del periodo.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer · Navegación */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleRetroceder}
              disabled={paso === 'origen-destino' || submitting}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-30"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Atrás
            </button>
            <button
              type="button"
              onClick={handleAvanzar}
              disabled={!puedeAvanzar || submitting}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm',
                paso === 'confirmar'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-teal-600 hover:bg-teal-700 text-white',
                (!puedeAvanzar || submitting) && 'opacity-50 cursor-not-allowed',
              )}
            >
              {submitting ? (
                'Procesando...'
              ) : paso === 'confirmar' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Ejecutar
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sidebar derecho · Resumen en vivo */}
        <aside className="w-full lg:w-72 flex-shrink-0 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Resumen
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">
                Operación
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {variante === 'conversion'
                  ? `Conversión ${form.monedaOrigen} → ${form.monedaDestino}`
                  : 'Transferencia interna'}
              </div>
            </div>
            {productoOrigen && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  Origen
                </div>
                <div className="text-xs font-semibold text-slate-800 truncate">
                  {productoOrigen.nombre}
                </div>
              </div>
            )}
            {productoDestino && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  Destino
                </div>
                <div className="text-xs font-semibold text-slate-800 truncate">
                  {productoDestino.nombre}
                </div>
              </div>
            )}
            {form.monto > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  Monto
                </div>
                <div className="text-base font-bold text-slate-900 tabular-nums">
                  {fmtMonto(form.monto, form.monedaOrigen)}
                </div>
                {variante === 'conversion' && form.tipoCambio > 0 && (
                  <div className="text-[10px] text-teal-700 tabular-nums mt-0.5">
                    ≈ {fmtMonto(montoDestino, form.monedaDestino)}
                  </div>
                )}
              </div>
            )}
            {variante === 'conversion' && form.tipoCambio > 0 && (
              <div className="pt-3 border-t border-slate-200">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  TC del día
                </div>
                <div className="text-sm font-semibold text-slate-700 tabular-nums">
                  S/ {form.tipoCambio.toFixed(3)}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );

  // ─── chk5.D-S7.SF5 · Render modal · único modo soportado ─────────
  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-5xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header de cierre */}
        <div className="flex items-center justify-between bg-white border border-slate-200 border-b-0 rounded-t-2xl px-5 py-3">
          <div className="text-[13px] font-bold text-slate-900">
            {variante === 'conversion' ? 'Conversión USD ↔ PEN' : 'Transferencia interna'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {contenido}
      </div>
    </div>
  );
};
