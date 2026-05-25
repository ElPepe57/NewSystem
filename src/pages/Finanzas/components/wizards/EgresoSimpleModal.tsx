/**
 * EgresoSimpleModal — chk5.D-S4.a · SF2
 *
 * Modal canon A.2 · "Registrar egreso simple" del dropdown "+ Nuevo movimiento".
 * 1 paso · FormModalV2 rose · F-Borradores opcional.
 *
 * Tipos soportados:
 *   - gasto_operativo · gastos del día a día (cross-link a /gastos para categorizar)
 *   - pago_proveedor_local · pago a proveedor Perú
 *   - pago_orden_compra · pago a proveedor USA
 *   - pago_viajero · pago a viajero (flete)
 *   - retiro_socio · retiro por socio
 *   - adelanto_empleado · adelanto a empleado
 *
 * Cross-link declarado para `gasto_operativo` · sugerencia visible al usuario
 * "Para egresos categorizables, mejor usá módulo Gastos directo".
 *
 * Diseño canon v8.0 + v9.0 M1 contra mockup MOCK 3 §1 wizard simple A.2.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpCircle, AlertCircle, ExternalLink, Landmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  RetiroCapitalFormData,
} from '../../../../types/tesoreria.types';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface EgresoSimpleModalProps {
  isOpen: boolean;
  onClose: () => void;
  cuentas: CuentaCaja[];
  onSuccess?: (movimientoId: string) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// CATÁLOGOS
// ═════════════════════════════════════════════════════════════════════════

type TipoEgresoOption = Extract<
  TipoMovimientoTesoreria,
  | 'gasto_operativo'
  | 'pago_proveedor_local'
  | 'pago_orden_compra'
  | 'pago_viajero'
  | 'retiro_socio'
  | 'adelanto_empleado'
>;

const TIPOS_EGRESO_OPCIONES: Array<{
  value: TipoEgresoOption;
  label: string;
  descripcion: string;
  /** Si true · sugiere cross-link a módulo Gastos */
  recomiendaGastos?: boolean;
}> = [
  {
    value: 'gasto_operativo',
    label: 'Gasto operativo',
    descripcion: 'Sueldos · servicios · alquiler · marketing',
    recomiendaGastos: true,
  },
  {
    value: 'pago_proveedor_local',
    label: 'Pago proveedor local',
    descripcion: 'Pago a proveedor en Perú · PEN',
  },
  {
    value: 'pago_orden_compra',
    label: 'Pago OC importación',
    descripcion: 'Pago a proveedor USA · USD',
  },
  {
    value: 'pago_viajero',
    label: 'Pago viajero',
    descripcion: 'Flete · adelanto · liquidación',
  },
  {
    value: 'retiro_socio',
    label: 'Retiro de socio',
    descripcion: 'Dinero retirado por socio',
  },
  {
    value: 'adelanto_empleado',
    label: 'Adelanto empleado',
    descripcion: 'Adelanto de sueldo · descontable',
  },
];

const METODOS_OPCIONES: Array<{ value: MetodoTesoreria; label: string }> = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia_bancaria', label: 'Transferencia bancaria' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'tarjeta', label: 'Tarjeta débito' },
  { value: 'tarjeta_credito', label: 'Tarjeta crédito' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'otro', label: 'Otro' },
];

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const EgresoSimpleModal: React.FC<EgresoSimpleModalProps> = ({
  isOpen,
  onClose,
  cuentas,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const { tc: tcSistema } = useTipoCambio();
  const userProfile = useAuthStore((s) => s.userProfile);

  // chk5.E-INV-SOC · catálogo de socios para retiro_socio
  const socios = useSocioStore((s) => s.socios);
  const fetchSocios = useSocioStore((s) => s.fetchSocios);

  const [tipo, setTipo] = useState<TipoEgresoOption>('gasto_operativo');
  const [cuentaOrigenId, setCuentaOrigenId] = useState('');
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
  // chk5.E-INV-SOC · socio que retira (solo para tipo='retiro_socio')
  const [socioId, setSocioId] = useState('');
  // tipoRetiro · qué naturaleza tiene el retiro
  const [tipoRetiro, setTipoRetiro] = useState<'utilidades' | 'capital' | 'prestamo'>('utilidades');

  useEffect(() => {
    if (isOpen) {
      setTipo('gasto_operativo');
      setCuentaOrigenId(cuentas.find((c) => c.activa && c.esCuentaPorDefecto)?.id ?? cuentas.find((c) => c.activa)?.id ?? '');
      setMonto('');
      setMoneda('PEN');
      setTipoCambioOverride('');
      setMetodo('transferencia_bancaria');
      setReferencia('');
      setConcepto('');
      setNotas('');
      setFecha(fechaHoyInputValue());
      setSocioId('');
      setTipoRetiro('utilidades');
      setError(null);
      // chk5.E-INV-SOC · cargar catálogo de socios la primera vez
      if (socios.length === 0) {
        void fetchSocios();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cuentas]);

  // Lista de socios activos para el combobox
  const sociosActivos = useMemo(
    () => socios.filter((s) => s.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [socios],
  );

  const cuentasFiltradas = useMemo(
    () => cuentas.filter((c) => c.activa && (c.esBiMoneda || c.moneda === moneda)),
    [cuentas, moneda],
  );

  useEffect(() => {
    if (cuentaOrigenId && !cuentasFiltradas.find((c) => c.id === cuentaOrigenId)) {
      setCuentaOrigenId(cuentasFiltradas[0]?.id ?? '');
    }
  }, [cuentasFiltradas, cuentaOrigenId]);

  const tcEfectivo = useMemo(() => {
    const override = parseFloat(tipoCambioOverride);
    if (!isNaN(override) && override > 0) return override;
    if (moneda === 'USD') return tcSistema?.venta ?? 0;
    return 1;
  }, [tipoCambioOverride, moneda, tcSistema]);

  const montoNum = parseFloat(monto) || 0;
  const equivalentePEN = moneda === 'USD' ? montoNum * tcEfectivo : montoNum;

  const tipoActual = TIPOS_EGRESO_OPCIONES.find((t) => t.value === tipo);

  const validar = (): string | null => {
    if (!cuentaOrigenId) return 'Seleccioná una cuenta de origen.';
    if (montoNum <= 0) return 'El monto debe ser mayor a 0.';
    if (!concepto.trim()) return 'El concepto es obligatorio.';
    if (moneda === 'USD' && tcEfectivo <= 0) return 'El tipo de cambio debe ser mayor a 0 para USD.';
    // chk5.E-INV-SOC · retiro_socio requiere socio del catálogo
    if (tipo === 'retiro_socio' && !socioId) return 'Seleccioná el socio que retira.';
    return null;
  };

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
      // chk5.E-INV-SOC · retiro_socio usa service especializado · queda en
      // retirosCapital con socioId · aparece en módulo Inversionistas como
      // distribución por socio.
      if (tipo === 'retiro_socio') {
        const socioElegido = sociosActivos.find((s) => s.id === socioId);
        if (!socioElegido) {
          throw new Error('Socio no encontrado en el catálogo · recargá la página.');
        }
        const retiroData: RetiroCapitalFormData = {
          monto: montoNum,
          moneda,
          tipoCambio: tcEfectivo,
          cuentaOrigenId,
          socioId: socioElegido.id,
          socioNombre: socioElegido.nombre,
          tipoRetiro,
          metodo,
          fecha: parseDateInput(fecha),
        };
        if (concepto.trim()) retiroData.concepto = concepto.trim();
        if (referencia.trim()) retiroData.referencia = referencia.trim();
        if (notas.trim()) retiroData.notas = notas.trim();

        const id = await tesoreriaService.registrarRetiroCapital(retiroData, userProfile.uid);
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
        cuentaOrigen: cuentaOrigenId,
      };
      if (referencia.trim()) data.referencia = referencia.trim();
      if (notas.trim()) data.notas = notas.trim();

      const id = await tesoreriaService.registrarMovimiento(data, userProfile.uid);
      onSuccess?.(id);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Error al registrar el egreso.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Registrar egreso"
      subtitle="Gasto · pago a proveedor · retiro · 1 paso simple"
      breadcrumb="Finanzas · Nuevo movimiento"
      icon={ArrowUpCircle}
      iconTone="red"
      submitLabel="Registrar egreso"
      submitVariant="primary"
      submitIcon={ArrowUpCircle}
      loading={submitting}
      size="md"
    >
      <div className="space-y-4">
        {/* Tipo de egreso · 6 opciones */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 block">
            Tipo de egreso *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_EGRESO_OPCIONES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={`text-left p-2 border rounded-lg transition-colors ${
                  tipo === t.value
                    ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-[12px] font-bold text-slate-900">{t.label}</div>
                <div className="text-[10px] text-slate-500">{t.descripcion}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Sugerencia cross-link a Gastos */}
        {tipoActual?.recomiendaGastos && (
          <div className="bg-amber-50 ring-1 ring-amber-200 rounded-lg p-3 text-[11px] text-amber-900 flex items-start gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-amber-700 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <strong>Sugerencia:</strong> Para gastos categorizables (sueldos · alquiler · marketing · SaaS) usá el módulo Gastos directo · obtenés mejor analítica y categorización fiscal.
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/gastos');
                }}
                className="block mt-1 text-amber-800 font-bold hover:underline"
              >
                Ir a Gastos →
              </button>
            </div>
          </div>
        )}

        {/* chk5.E-INV-SOC · Selector de socio + tipo de retiro · solo para retiro_socio */}
        {tipo === 'retiro_socio' && (
          <div className="bg-violet-50/40 border border-violet-200 rounded-lg p-3 space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-violet-700 font-bold mb-1.5 flex items-center gap-1.5">
              <Landmark className="w-3 h-3" /> Socio que retira *
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
              <>
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
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-violet-700 font-bold mb-1 block">
                    Tipo de retiro
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['utilidades', 'capital', 'prestamo'] as const).map((tipoOpt) => (
                      <button
                        key={tipoOpt}
                        type="button"
                        onClick={() => setTipoRetiro(tipoOpt)}
                        className={`text-[11px] py-1.5 rounded font-semibold border transition-colors ${
                          tipoRetiro === tipoOpt
                            ? 'bg-violet-100 border-violet-400 text-violet-900'
                            : 'bg-white border-violet-200 text-slate-600 hover:bg-violet-50'
                        }`}
                      >
                        {tipoOpt === 'utilidades' ? 'Utilidades' : tipoOpt === 'capital' ? 'Capital' : 'Préstamo'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="text-[10px] text-violet-700 mt-1.5">
              El retiro queda atribuido al socio · aparece en el módulo Inversionistas en
              "Distribución" según el tipo.
            </div>
          </div>
        )}

        {/* Cuenta origen */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 block">
            Cuenta de origen *
          </label>
          <select
            value={cuentaOrigenId}
            onChange={(e) => setCuentaOrigenId(e.target.value)}
            className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-rose-400"
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

        {/* Monto + moneda */}
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
                className="w-full pl-8 pr-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-rose-400 tabular-nums"
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
                      ? 'bg-rose-600 text-white font-bold'
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
              Tipo de cambio · referencia sistema: {tcSistema?.venta?.toFixed(3) ?? '—'}
            </label>
            <input
              type="number"
              value={tipoCambioOverride}
              onChange={(e) => setTipoCambioOverride(e.target.value)}
              placeholder={`Default: ${tcSistema?.venta?.toFixed(3) ?? '—'}`}
              min="0"
              step="0.001"
              className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-rose-400 tabular-nums"
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
              className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-rose-400"
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
              className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-rose-400"
            />
          </div>
        </div>

        {/* Concepto + referencia + notas */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 block">
            Concepto *
          </label>
          <input
            type="text"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Ej: Pago alquiler oficina · mayo 2026"
            className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-rose-400"
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
            placeholder="Ej: 00000123456789"
            className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-rose-400 font-mono"
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
            className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-rose-400 resize-none"
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
