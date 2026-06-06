/**
 * AporteCapitalModal · F14.2 (2026-06-06)
 *
 * Registra un aporte de capital de un socio · operación EXCLUSIVA de
 * Inversionistas (decisión AI 2026-06-05). socioId pre-cargado y obligatorio.
 *
 * El movimiento sigue 100% visible en el libro/flujo de caja de Finanzas
 * (mismo servicio `tesoreriaService.registrarAporteCapital`) · solo cambia el
 * ORIGEN de la acción (antes IngresoSimpleModal en Finanzas → ahora acá).
 *
 * Pixel-perfect: docs/mockups/inversionistas-capital-movimiento-v1.html (Acto 2).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Coins, Check, Landmark, ArrowLeftRight, Calendar, TrendingUp } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { tesoreriaService } from '../../../services/tesoreria.service';
import { useAuthStore } from '../../../store/authStore';
import { formatCurrencyPEN } from '../../../utils/format';
import type {
  CuentaCaja,
  MonedaTesoreria,
  MetodoTesoreria,
  AporteCapitalFormData,
} from '../../../types/tesoreria.types';

const METODOS: Array<{ value: MetodoTesoreria; label: string }> = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia_bancaria', label: 'Transferencia bancaria' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'tarjeta', label: 'Tarjeta débito' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'otro', label: 'Otro' },
];

interface Props {
  isOpen: boolean;
  socioId: string;
  socioNombre: string;
  /** TC vigente PEN/USD para aportes en USD (del ResumenInversionista). */
  tipoCambio: number;
  onClose: () => void;
  /** Aporte registrado OK · el padre refresca el resumen y cierra. */
  onSuccess: () => void;
}

export default function AporteCapitalModal({
  isOpen,
  socioId,
  socioNombre,
  tipoCambio,
  onClose,
  onSuccess,
}: Props) {
  const userId = useAuthStore((s) => s.userProfile?.uid ?? '');

  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<MonedaTesoreria>('PEN');
  const [cuentaDestinoId, setCuentaDestinoId] = useState('');
  const [metodo, setMetodo] = useState<MetodoTesoreria>('transferencia_bancaria');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [referencia, setReferencia] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset + cargar cuentas activas al abrir
  useEffect(() => {
    if (!isOpen) return;
    setMonto('');
    setMoneda('PEN');
    setMetodo('transferencia_bancaria');
    setFecha(new Date().toISOString().slice(0, 10));
    setReferencia('');
    setError(null);
    setSaving(false);
    tesoreriaService.getCuentasActivas().then((cs) => {
      setCuentas(cs);
      setCuentaDestinoId(cs.find((c) => c.esCuentaPorDefecto)?.id ?? cs[0]?.id ?? '');
    });
  }, [isOpen]);

  const cuentasFiltradas = useMemo(
    () => cuentas.filter((c) => c.esBiMoneda || c.moneda === moneda),
    [cuentas, moneda],
  );

  // Si la cuenta seleccionada ya no aplica a la moneda, reencauzar
  useEffect(() => {
    if (cuentaDestinoId && !cuentasFiltradas.find((c) => c.id === cuentaDestinoId)) {
      setCuentaDestinoId(cuentasFiltradas[0]?.id ?? '');
    }
  }, [cuentasFiltradas, cuentaDestinoId]);

  const saldoDe = (c: CuentaCaja): number =>
    c.esBiMoneda ? (moneda === 'USD' ? c.saldoUSD ?? 0 : c.saldoPEN ?? 0) : c.saldoActual;

  const montoNum = parseFloat(monto) || 0;

  const handleSubmit = async () => {
    if (montoNum <= 0) {
      setError('Ingresá un monto mayor a 0.');
      return;
    }
    if (!cuentaDestinoId) {
      setError('Seleccioná la cuenta destino.');
      return;
    }
    if (!userId) {
      setError('Sesión no válida.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data: AporteCapitalFormData = {
        monto: montoNum,
        moneda,
        tipoCambio: moneda === 'USD' ? tipoCambio : 1,
        cuentaDestinoId,
        socioNombre,
        socioId,
        metodo,
        fecha: new Date(fecha),
        ...(referencia.trim() ? { referencia: referencia.trim() } : {}),
      };
      await tesoreriaService.registrarAporteCapital(data, userId);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el aporte.');
      setSaving(false);
    }
  };

  const inputCls =
    'w-full border border-slate-300 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-violet-500/40';

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Registrar aporte de capital"
      subtitle={`Aporte de ${socioNombre} · sube patrimonio y caja`}
      breadcrumb="Capital · Aporte"
      icon={Coins}
      iconTone="violet"
      submitLabel="Registrar aporte"
      submitIcon={Check}
      loading={saving}
      disabled={montoNum <= 0 || !cuentaDestinoId}
      size="md"
    >
      <div className="space-y-4">
        {error && (
          <div className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Socio (contexto · read-only) */}
        <div className="flex items-center gap-2 border border-violet-200 rounded-lg px-3 py-2 bg-violet-50/40">
          <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[11px] font-bold">
            {socioNombre.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-slate-900">{socioNombre}</div>
            <div className="text-[10px] text-slate-500">Socio que aporta</div>
          </div>
        </div>

        {/* Monto + moneda */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              Monto <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center border border-slate-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-violet-500/40">
              <span className="text-slate-400 text-[13px] mr-1.5">{moneda === 'USD' ? '$' : 'S/'}</span>
              <input
                type="number"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className="flex-1 outline-none text-[14px] font-semibold tabular-nums text-slate-900 bg-transparent"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Moneda</label>
            <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-lg p-1 h-[38px]">
              <button
                type="button"
                onClick={() => setMoneda('PEN')}
                className={`rounded-md text-[12px] font-bold ${moneda === 'PEN' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500'}`}
              >
                PEN
              </button>
              <button
                type="button"
                onClick={() => setMoneda('USD')}
                className={`rounded-md text-[12px] font-semibold ${moneda === 'USD' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500'}`}
              >
                USD
              </button>
            </div>
          </div>
        </div>

        {/* Cuenta destino */}
        <div>
          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
            Cuenta destino <span className="text-rose-500">*</span>
          </label>
          <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-2.5 focus-within:ring-2 focus-within:ring-violet-500/40">
            <Landmark className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={cuentaDestinoId}
              onChange={(e) => setCuentaDestinoId(e.target.value)}
              className="flex-1 bg-transparent text-[13px] py-2 outline-none"
            >
              {cuentasFiltradas.length === 0 && <option value="">Sin cuentas para {moneda}</option>}
              {cuentasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · saldo {formatCurrencyPEN(saldoDe(c))}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Método + fecha */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Método</label>
            <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-2.5 focus-within:ring-2 focus-within:ring-violet-500/40">
              <ArrowLeftRight className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as MetodoTesoreria)}
                className="flex-1 bg-transparent text-[13px] py-2 outline-none"
              >
                {METODOS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Fecha</label>
            <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-2.5 focus-within:ring-2 focus-within:ring-violet-500/40">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="flex-1 bg-transparent text-[13px] tabular-nums py-2 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Referencia (opcional) */}
        <div>
          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
            Referencia <span className="text-slate-400 font-normal">· opcional</span>
          </label>
          <input
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Nro de operación bancaria…"
            className={`${inputCls} placeholder:text-slate-400`}
          />
        </div>

        {/* Conversión a PEN (si USD) */}
        {moneda === 'USD' && montoNum > 0 && (
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            Equivale a <span className="tabular-nums font-semibold text-slate-700">{formatCurrencyPEN(montoNum * tipoCambio)}</span>
            <span className="text-slate-400">· TC {tipoCambio.toFixed(3)}</span>
          </div>
        )}
      </div>
    </FormModalV2>
  );
}
