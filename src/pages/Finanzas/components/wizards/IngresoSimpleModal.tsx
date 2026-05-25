/**
 * IngresoSimpleModal — chk5.D-S4.a · SF1
 *
 * Modal canon A.1 · "Registrar ingreso simple" del dropdown "+ Nuevo movimiento".
 * 1 paso · FormModalV2 emerald · F-Borradores opcional.
 *
 * Tipos soportados:
 *   - ingreso_venta · cobro de venta cash
 *   - ingreso_anticipo · adelanto recibido
 *   - ingreso_otro · otros ingresos
 *   - aporte_capital · inyección de socio
 *
 * Diseño canon v8.0 + v9.0 M1 contra mockup MOCK 3 §1 wizard simple A.1.
 * Reemplaza el placeholder `navigate('/tesoreria')` del dropdown actual.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, AlertCircle, Landmark } from 'lucide-react';
import { FormModalV2 } from '../../../../design-system/components/FormModalV2';
import { tesoreriaService } from '../../../../services/tesoreria.service';
import { useTipoCambio } from '../../../../hooks/useTipoCambio';
import { useAuthStore } from '../../../../store/authStore';
import { useSocioStore } from '../../../../store/socioStore';
import type {
  CuentaCaja,
  MetodoTesoreria,
  MonedaTesoreria,
  TipoMovimientoTesoreria,
  MovimientoTesoreriaFormData,
  AporteCapitalFormData,
} from '../../../../types/tesoreria.types';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface IngresoSimpleModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Lista de cuentas activas para el select destino · pasada por el shell */
  cuentas: CuentaCaja[];
  /** Callback post-registro · recibe ID del movimiento creado */
  onSuccess?: (movimientoId: string) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// CATÁLOGOS
// ═════════════════════════════════════════════════════════════════════════

type TipoIngresoOption = Extract<
  TipoMovimientoTesoreria,
  'ingreso_venta' | 'ingreso_anticipo' | 'ingreso_otro' | 'aporte_capital'
>;

const TIPOS_INGRESO_OPCIONES: Array<{
  value: TipoIngresoOption;
  label: string;
  descripcion: string;
}> = [
  { value: 'ingreso_venta', label: 'Cobro de venta', descripcion: 'Producto entregado · cliente paga' },
  { value: 'ingreso_anticipo', label: 'Anticipo recibido', descripcion: 'Cliente paga antes de entregar' },
  { value: 'ingreso_otro', label: 'Otro ingreso', descripcion: 'Reembolso · devolución de proveedor · etc' },
  { value: 'aporte_capital', label: 'Aporte de capital', descripcion: 'Socio inyecta dinero al negocio' },
];

const METODOS_OPCIONES: Array<{ value: MetodoTesoreria; label: string }> = [
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

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const IngresoSimpleModal: React.FC<IngresoSimpleModalProps> = ({
  isOpen,
  onClose,
  cuentas,
  onSuccess,
}) => {
  const { tc: tcSistema } = useTipoCambio();
  const userProfile = useAuthStore((s) => s.userProfile);

  // chk5.E-INV-SOC · catálogo de socios para aporte_capital
  const socios = useSocioStore((s) => s.socios);
  const fetchSocios = useSocioStore((s) => s.fetchSocios);

  // Estado del formulario
  const [tipo, setTipo] = useState<TipoIngresoOption>('ingreso_venta');
  const [cuentaDestinoId, setCuentaDestinoId] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<MonedaTesoreria>('PEN');
  const [tipoCambioOverride, setTipoCambioOverride] = useState('');
  const [metodo, setMetodo] = useState<MetodoTesoreria>('transferencia_bancaria');
  const [referencia, setReferencia] = useState('');
  const [concepto, setConcepto] = useState('');
  const [notas, setNotas] = useState('');
  const [fecha, setFecha] = useState(() => fechaHoyInputValue());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // chk5.E-INV-SOC · campo socio · obligatorio cuando tipo='aporte_capital'
  const [socioId, setSocioId] = useState('');

  // Reset cuando se abre
  useEffect(() => {
    if (isOpen) {
      setTipo('ingreso_venta');
      setCuentaDestinoId(cuentas.find((c) => c.activa && c.esCuentaPorDefecto)?.id ?? cuentas.find((c) => c.activa)?.id ?? '');
      setMonto('');
      setMoneda('PEN');
      setTipoCambioOverride('');
      setMetodo('transferencia_bancaria');
      setReferencia('');
      setConcepto('');
      setNotas('');
      setFecha(fechaHoyInputValue());
      setSocioId('');
      setError(null);
      // chk5.E-INV-SOC · cargar catálogo de socios la primera vez por si elige aporte_capital
      if (socios.length === 0) {
        void fetchSocios();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cuentas]);

  // Cuentas filtradas · activas · matchean la moneda elegida
  const cuentasFiltradas = useMemo(
    () =>
      cuentas.filter(
        (c) =>
          c.activa &&
          (c.esBiMoneda || c.moneda === moneda),
      ),
    [cuentas, moneda],
  );

  // Si la cuenta seleccionada deja de matchear · reset
  useEffect(() => {
    if (cuentaDestinoId && !cuentasFiltradas.find((c) => c.id === cuentaDestinoId)) {
      setCuentaDestinoId(cuentasFiltradas[0]?.id ?? '');
    }
  }, [cuentasFiltradas, cuentaDestinoId]);

  // TC efectivo · override > TC sistema
  const tcEfectivo = useMemo(() => {
    const override = parseFloat(tipoCambioOverride);
    if (!isNaN(override) && override > 0) return override;
    if (moneda === 'USD') return tcSistema?.compra ?? 0;
    return 1; // PEN
  }, [tipoCambioOverride, moneda, tcSistema]);

  const montoNum = parseFloat(monto) || 0;
  const equivalentePEN = moneda === 'USD' ? montoNum * tcEfectivo : montoNum;

  // Validación
  const validar = (): string | null => {
    if (!cuentaDestinoId) return 'Seleccioná una cuenta destino.';
    if (montoNum <= 0) return 'El monto debe ser mayor a 0.';
    if (!concepto.trim()) return 'El concepto es obligatorio.';
    if (moneda === 'USD' && tcEfectivo <= 0) return 'El tipo de cambio debe ser mayor a 0 para USD.';
    // chk5.E-INV-SOC · aporte_capital requiere socio del catálogo
    if (tipo === 'aporte_capital' && !socioId) return 'Seleccioná el socio que realiza el aporte.';
    return null;
  };

  // Lista de socios activos para el combobox
  const sociosActivos = useMemo(
    () => socios.filter((s) => s.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [socios],
  );

  // Submit
  const handleSubmit = async () => {
    const err = validar();
    if (err) {
      setError(err);
      return;
    }
    if (!userProfile?.uid) {
      setError('Sesión inválida · recargá la página.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // chk5.E-INV-SOC · aporte_capital usa el service especializado que atribuye
      // el aporte al socio (queda en aportesCapital con socioId) · el resto usa
      // registrarMovimiento genérico.
      if (tipo === 'aporte_capital') {
        const socioElegido = sociosActivos.find((s) => s.id === socioId);
        if (!socioElegido) {
          throw new Error('Socio no encontrado en el catálogo · recargá la página.');
        }
        const aporteData: AporteCapitalFormData = {
          monto: montoNum,
          moneda,
          tipoCambio: tcEfectivo,
          cuentaDestinoId,
          socioId: socioElegido.id,
          socioNombre: socioElegido.nombre,
          metodo,
          fecha: parseDateInput(fecha),
        };
        if (concepto.trim()) aporteData.concepto = concepto.trim();
        if (referencia.trim()) aporteData.referencia = referencia.trim();
        if (notas.trim()) aporteData.notas = notas.trim();

        const id = await tesoreriaService.registrarAporteCapital(aporteData, userProfile.uid);
        onSuccess?.(id);
        onClose();
        return;
      }

      const data: MovimientoTesoreriaFormData = {
        tipo,
        moneda,
        monto: montoNum,
        tipoCambio: tcEfectivo,
        metodo,
        concepto: concepto.trim(),
        fecha: parseDateInput(fecha),
        cuentaDestino: cuentaDestinoId,
      };
      if (referencia.trim()) data.referencia = referencia.trim();
      if (notas.trim()) data.notas = notas.trim();

      const id = await tesoreriaService.registrarMovimiento(data, userProfile.uid);
      onSuccess?.(id);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Error al registrar el ingreso.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Registrar ingreso"
      subtitle="Cobro · anticipo · aporte · otros · 1 paso simple"
      breadcrumb="Finanzas · Nuevo movimiento"
      icon={ArrowDownCircle}
      iconTone="emerald"
      submitLabel="Registrar ingreso"
      submitVariant="primary"
      submitIcon={ArrowDownCircle}
      loading={submitting}
      size="md"
    >
      <div className="space-y-4">
        {/* Tipo de ingreso · 4 opciones radio cards */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 block">
            Tipo de ingreso *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_INGRESO_OPCIONES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={`text-left p-2 border rounded-lg transition-colors ${
                  tipo === t.value
                    ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-[12px] font-bold text-slate-900">{t.label}</div>
                <div className="text-[10px] text-slate-500">{t.descripcion}</div>
              </button>
            ))}
          </div>
        </div>

        {/* chk5.E-INV-SOC · Selector de socio · solo para aporte_capital */}
        {tipo === 'aporte_capital' && (
          <div className="bg-violet-50/40 border border-violet-200 rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-violet-700 font-bold mb-1.5 flex items-center gap-1.5">
              <Landmark className="w-3 h-3" /> Socio que aporta *
            </label>
            {sociosActivos.length === 0 ? (
              <div className="text-[11px] text-slate-600">
                Sin socios registrados. Creá uno primero en{' '}
                <a href="/maestros?tab=socios" className="text-violet-700 font-semibold underline">
                  Maestros · Socios
                </a>
                .
              </div>
            ) : (
              <select
                value={socioId}
                onChange={(e) => setSocioId(e.target.value)}
                className="w-full px-3 py-2 text-[12px] border border-violet-300 rounded-lg bg-white focus:outline-none focus:border-violet-500"
              >
                <option value="">Elegir socio...</option>
                {sociosActivos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                    {s.rol ? ` · ${s.rol}` : ''}
                    {s.porcentajeParticipacion > 0 ? ` · ${s.porcentajeParticipacion}%` : ''}
                  </option>
                ))}
              </select>
            )}
            <div className="text-[10px] text-violet-700 mt-1.5">
              El aporte queda atribuido al socio · aparece en el módulo Inversionistas como
              "Cash propio aportado".
            </div>
          </div>
        )}

        {/* Cuenta destino */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 block">
            Cuenta destino *
          </label>
          <select
            value={cuentaDestinoId}
            onChange={(e) => setCuentaDestinoId(e.target.value)}
            className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-400"
          >
            {cuentasFiltradas.length === 0 ? (
              <option value="">Sin cuentas {moneda} activas</option>
            ) : (
              cuentasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {c.moneda}
                  {c.esBiMoneda ? ' (bi)' : ''}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Monto + moneda + TC (si USD) */}
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-7">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 block">
              Monto *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-[12px] text-slate-500 font-bold">
                {moneda === 'USD' ? '$' : 'S/'}
              </span>
              <input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full pl-8 pr-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-400 tabular-nums"
              />
            </div>
          </div>
          <div className="col-span-5">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 block">
              Moneda
            </label>
            <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              {(['PEN', 'USD'] as MonedaTesoreria[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoneda(m)}
                  className={`flex-1 text-[11px] py-1 rounded transition-colors ${
                    moneda === m
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {moneda === 'USD' && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 block">
              Tipo de cambio · referencia sistema: {tcSistema?.compra?.toFixed(3) ?? '—'}
            </label>
            <input
              type="number"
              value={tipoCambioOverride}
              onChange={(e) => setTipoCambioOverride(e.target.value)}
              placeholder={`Default: ${tcSistema?.compra?.toFixed(3) ?? '—'}`}
              min="0"
              step="0.001"
              className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-400 tabular-nums"
            />
            {montoNum > 0 && (
              <div className="text-[10px] text-slate-500 mt-1 tabular-nums">
                Equivalente: S/ {equivalentePEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        )}

        {/* Método + fecha */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 block">
              Método *
            </label>
            <select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as MetodoTesoreria)}
              className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-400"
            >
              {METODOS_OPCIONES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 block">
              Fecha *
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        {/* Concepto + referencia */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 block">
            Concepto *
          </label>
          <input
            type="text"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Ej: Cobro F-015 · Cliente Premium SA"
            className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-400"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 block">
            Referencia / N° operación (opcional)
          </label>
          <input
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Ej: 00000123456789 · YAPE-12345"
            className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-400 font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 block">
            Notas (opcional)
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Notas internas · contexto adicional"
            className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-400 resize-none"
          />
        </div>

        {error && (
          <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 text-[11px] text-rose-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-700 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </FormModalV2>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function fechaHoyInputValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDateInput(s: string): Date {
  const [a, m, d] = s.split('-').map((x) => parseInt(x, 10));
  return new Date(a, m - 1, d);
}
