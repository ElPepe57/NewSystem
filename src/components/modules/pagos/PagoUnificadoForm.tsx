/**
 * PagoUnificadoForm v2 — Componente ÚNICO de registro de pagos para todo el sistema.
 *
 * Reemplaza: PagoForm (OC), PagoGastoForm, PagoViajeroModal, VentaForm paso pago
 *
 * v2: Selector de cuenta agrupado por banco, canales Yape/Plin con identificador,
 *     derivación unificada de métodos, línea de crédito con impacto, mobile optimized.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CreditCard, Wallet, Calendar, History, Phone, Copy,
  ChevronDown, ChevronUp, AlertCircle, Check, ArrowRightLeft,
  Building2, Banknote, Smartphone,
} from 'lucide-react';
import { Button, Badge } from '../../common';
import { useTipoCambioStore } from '../../../store/tipoCambioStore';
import { useToastStore } from '../../../store/toastStore';
import { tesoreriaService } from '../../../services/tesoreria.service';
import { formatCurrency } from '../../../utils/format';
import type { CuentaCaja } from '../../../types/tesoreria.types';
import type { MetodoPagoUnificado, OrigenPago } from '../../../types/pago.types';
import { METODOS_PAGO_INFO } from '../../../types/pago.types';

// ============================================
// TYPES
// ============================================

export interface PagoUnificadoResult {
  fechaPago: Date;
  monedaPago: 'PEN' | 'USD';
  montoOriginal: number;
  montoUSD: number;
  montoPEN: number;
  tipoCambio: number;
  metodoPago: string;
  cuentaOrigenId: string;
  cuentaOrigenNombre: string;
  referencia?: string;
  notas?: string;
  esPagoCompleto: boolean;
}

export interface PagoPrevio {
  id: string;
  fecha: Date | string;
  monto: number;
  moneda: string;
  metodo: string;
  referencia?: string;
}

export interface PagoUnificadoFormProps {
  origen: OrigenPago;
  titulo?: string;
  esIngreso?: boolean;
  montoTotal: number;
  montoPendiente: number;
  monedaOriginal: 'PEN' | 'USD';
  tcDocumento?: number;
  pagosAnteriores?: PagoPrevio[];
  onSubmit: (datos: PagoUnificadoResult) => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// ============================================
// HELPERS
// ============================================

function getSaldo(cuenta: CuentaCaja, moneda: 'PEN' | 'USD'): number {
  if (cuenta.esBiMoneda) {
    return moneda === 'USD' ? (cuenta.saldoUSD || 0) : (cuenta.saldoPEN || 0);
  }
  return cuenta.saldoActual || 0;
}

function getTipoIcon(cuenta: CuentaCaja) {
  const pf = cuenta.productoFinanciero;
  if (pf === 'caja' || cuenta.tipo === 'efectivo') return <Banknote className="w-3.5 h-3.5 text-green-500" />;
  if (pf === 'billetera_digital' || cuenta.tipo === 'digital') return <Smartphone className="w-3.5 h-3.5 text-purple-500" />;
  if (cuenta.tipo === 'credito') return <CreditCard className="w-3.5 h-3.5 text-amber-500" />;
  return <Building2 className="w-3.5 h-3.5 text-blue-500" />;
}

function agruparCuentas(cuentas: CuentaCaja[]) {
  const bancos = new Map<string, CuentaCaja[]>();
  const digitales: CuentaCaja[] = [];
  const efectivo: CuentaCaja[] = [];

  cuentas.forEach(c => {
    if (c.productoFinanciero === 'caja' || c.tipo === 'efectivo') efectivo.push(c);
    else if (c.productoFinanciero === 'billetera_digital' || c.tipo === 'digital') digitales.push(c);
    else if (c.banco) {
      const arr = bancos.get(c.banco) || [];
      arr.push(c);
      bancos.set(c.banco, arr);
    } else efectivo.push(c);
  });

  return { bancos, digitales, efectivo };
}

// ============================================
// COMPONENTE
// ============================================

export const PagoUnificadoForm: React.FC<PagoUnificadoFormProps> = ({
  origen, titulo, esIngreso = false,
  montoTotal, montoPendiente, monedaOriginal, tcDocumento,
  pagosAnteriores = [], onSubmit, onCancel, loading = false,
}) => {
  const { getTCDelDia } = useTipoCambioStore();
  const toast = useToastStore();

  // Estado del formulario
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);
  const [monedaPago, setMonedaPago] = useState<'PEN' | 'USD'>(monedaOriginal);
  const [montoOriginal, setMontoOriginal] = useState(0);
  const [tipoCambio, setTipoCambio] = useState(tcDocumento || 0);
  const [showTC, setShowTC] = useState(false);
  const [metodoPago, setMetodoPago] = useState('');
  const [cuentaOrigenId, setCuentaOrigenId] = useState('');
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');
  const [esPagoCompleto, setEsPagoCompleto] = useState(true);
  const [showHistorial, setShowHistorial] = useState(false);

  // Cuentas
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState(true);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Cargar TC
  useEffect(() => {
    if (!tcDocumento) {
      getTCDelDia().then(tc => { if (tc) setTipoCambio(tc.venta); });
    }
  }, [getTCDelDia, tcDocumento]);

  // Cargar cuentas
  useEffect(() => {
    (async () => {
      try {
        setLoadingCuentas(true);
        const todas = await tesoreriaService.getCuentas();
        setCuentas(todas.filter(c => c.activa));
      } catch { toast.error('Error al cargar cuentas'); }
      finally { setLoadingCuentas(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cerrar selector al hacer click fuera
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorAbierto(false);
      }
    };
    if (selectorAbierto) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [selectorAbierto]);

  // Filtrar por moneda
  const cuentasFiltradas = useMemo(() =>
    cuentas.filter(c => c.esBiMoneda || c.moneda === monedaPago),
  [cuentas, monedaPago]);

  const cuentaSeleccionada = cuentas.find(c => c.id === cuentaOrigenId);

  // Métodos: combina metodosDisponibles + canales de metodosDetalle
  const metodosDisponibles = useMemo(() => {
    if (!cuentaSeleccionada) return [];
    const deFirestore = cuentaSeleccionada.metodosDisponibles ?? [];
    const deCanales = Object.keys(cuentaSeleccionada.metodosDetalle ?? {});
    const todos = Array.from(new Set([...deFirestore, ...deCanales]));
    if (todos.length > 0) return todos;
    // Fallback legacy
    if (cuentaSeleccionada.tipo === 'efectivo') return ['efectivo'];
    if (cuentaSeleccionada.tipo === 'digital') return ['otro'];
    if (cuentaSeleccionada.tipo === 'credito') return ['tarjeta_credito'];
    return ['transferencia'];
  }, [cuentaSeleccionada]);

  // Auto-seleccionar cuenta
  useEffect(() => {
    const defecto = cuentasFiltradas.find(c => c.esCuentaPorDefecto);
    if (defecto) setCuentaOrigenId(defecto.id);
    else if (cuentasFiltradas.length > 0) setCuentaOrigenId(cuentasFiltradas[0].id);
    else setCuentaOrigenId('');
  }, [cuentasFiltradas]);

  // Auto-seleccionar método
  useEffect(() => {
    if (metodosDisponibles.length > 0 && !metodosDisponibles.includes(metodoPago)) {
      setMetodoPago(metodosDisponibles[0]);
    } else if (metodosDisponibles.length === 0) setMetodoPago('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metodosDisponibles]);

  // Monto por defecto
  useEffect(() => {
    if (esPagoCompleto) {
      if (monedaPago === monedaOriginal) setMontoOriginal(montoPendiente);
      else if (monedaPago === 'PEN' && monedaOriginal === 'USD') setMontoOriginal(montoPendiente * tipoCambio);
      else setMontoOriginal(tipoCambio > 0 ? montoPendiente / tipoCambio : montoPendiente);
    }
  }, [esPagoCompleto, montoPendiente, monedaPago, monedaOriginal, tipoCambio]);

  // Cálculos
  const montoUSD = monedaPago === 'USD' ? montoOriginal : (tipoCambio > 0 ? montoOriginal / tipoCambio : 0);
  const montoPEN = monedaPago === 'PEN' ? montoOriginal : montoOriginal * tipoCambio;
  const saldoCuenta = cuentaSeleccionada ? getSaldo(cuentaSeleccionada, monedaPago) : 0;
  const saldoInsuficiente = !esIngreso && montoOriginal > saldoCuenta && cuentaSeleccionada?.tipo !== 'credito';
  const lineaCredito = cuentaSeleccionada?.lineaCredito;
  const canalDetalle = cuentaSeleccionada?.metodosDetalle?.[metodoPago];
  const metodoInfo = METODOS_PAGO_INFO[metodoPago as MetodoPagoUnificado];
  const sim = monedaPago === 'USD' ? '$' : 'S/';

  // Agrupación de cuentas para selector
  const gruposCuentas = useMemo(() => agruparCuentas(cuentasFiltradas), [cuentasFiltradas]);

  // Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (montoOriginal <= 0) { toast.warning('El monto debe ser mayor a 0'); return; }
    if (tipoCambio <= 0) { toast.warning('El tipo de cambio debe ser mayor a 0'); return; }
    if (!cuentaOrigenId) { toast.warning('Selecciona una cuenta'); return; }
    if (!metodoPago) { toast.warning('Selecciona un método de pago'); return; }

    onSubmit({
      fechaPago: new Date(fechaPago),
      monedaPago, montoOriginal, montoUSD, montoPEN, tipoCambio, metodoPago,
      cuentaOrigenId,
      cuentaOrigenNombre: cuentaSeleccionada?.nombre || '',
      referencia: referencia || undefined,
      notas: notas || undefined,
      esPagoCompleto,
    });
  };

  // ─── Render tarjeta de cuenta (compacta) ───
  const renderCuentaTarjeta = (c: CuentaCaja, compacta = false) => {
    const saldo = getSaldo(c, monedaPago);
    const canales = Object.entries(c.metodosDetalle ?? {}).filter(([, v]) => v.identificador);
    return (
      <div className="flex items-start gap-2 w-full">
        <div className="pt-0.5">{getTipoIcon(c)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {c.banco && <span className="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">{c.banco}</span>}
            <span className={`font-medium text-gray-800 truncate ${compacta ? 'text-xs' : 'text-sm'}`}>{c.nombre}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
            {c.titular && <span>{c.titular}</span>}
            {c.numeroCuenta && <span>· #{c.numeroCuenta}</span>}
            {c.titularidad && <span>· {c.titularidad === 'empresa' ? 'Emp.' : 'Pers.'}</span>}
          </div>
          {!compacta && canales.length > 0 && (
            <div className="flex gap-1 mt-0.5">
              {canales.map(([tipo, v]) => (
                <span key={tipo} className="text-[9px] px-1 py-0.5 rounded bg-purple-50 text-purple-600">
                  {tipo} · {v.identificador}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className={`text-right flex-shrink-0 ${compacta ? 'text-xs' : 'text-sm'} font-bold ${saldo < 0 ? 'text-red-600' : 'text-gray-800'}`}>
          {sim} {saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
        </div>
      </div>
    );
  };

  // ─── Render grupo de cuentas en selector ───
  const renderGrupo = (label: string, icon: React.ReactNode, items: CuentaCaja[]) => {
    if (items.length === 0) return null;
    return (
      <div key={label}>
        <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 flex items-center gap-1.5">
          {icon} {label}
        </div>
        {items.map(c => (
          <button key={c.id} type="button"
            onClick={() => { setCuentaOrigenId(c.id); setSelectorAbierto(false); }}
            className={`w-full text-left px-3 py-2.5 hover:bg-primary-50 transition-colors ${
              c.id === cuentaOrigenId ? 'bg-primary-50/70' : ''
            }`}>
            {renderCuentaTarjeta(c, true)}
          </button>
        ))}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* HEADER */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-blue-600 font-medium">{titulo || `${esIngreso ? 'Cobro' : 'Pago'} ${origen}`}</div>
            <div className="text-lg font-bold text-blue-900">
              {monedaOriginal === 'USD' ? '$' : 'S/'} {montoTotal.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-blue-500">Pendiente</div>
            <div className={`text-lg font-bold ${montoPendiente <= 0 ? 'text-green-600' : 'text-blue-900'}`}>
              {monedaOriginal === 'USD' ? '$' : 'S/'} {montoPendiente.toFixed(2)}
            </div>
          </div>
        </div>
        {pagosAnteriores.length > 0 && (
          <div className="mt-2 pt-2 border-t border-blue-200">
            <button type="button" onClick={() => setShowHistorial(!showHistorial)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
              <History className="w-3 h-3" />
              {pagosAnteriores.length} pago(s) anterior(es)
              {showHistorial ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showHistorial && (
              <div className="mt-2 space-y-1">
                {pagosAnteriores.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-white rounded-lg p-2 border border-blue-100">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">
                        {typeof p.fecha === 'string' ? p.fecha : p.fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">
                        {METODOS_PAGO_INFO[p.metodo as MetodoPagoUnificado]?.label ?? p.metodo}
                      </span>
                    </div>
                    <span className="font-semibold text-blue-800">
                      {p.moneda === 'USD' ? '$' : 'S/'} {p.monto.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* TIPO: Completo/Parcial */}
      {montoPendiente > 0 && (
        <div className="flex gap-2">
          <button type="button" onClick={() => setEsPagoCompleto(true)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
              esPagoCompleto ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}>
            <Check className="w-4 h-4 inline mr-1" /> Completo
          </button>
          <button type="button" onClick={() => setEsPagoCompleto(false)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
              !esPagoCompleto ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}>
            <ArrowRightLeft className="w-4 h-4 inline mr-1" /> Parcial
          </button>
        </div>
      )}

      {/* MONEDA */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Moneda de pago</label>
        <div className="flex gap-2">
          {(['PEN', 'USD'] as const).map(m => (
            <button key={m} type="button" onClick={() => setMonedaPago(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                monedaPago === m ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}>
              {m === 'PEN' ? 'S/ Soles' : '$ Dólares'}
            </button>
          ))}
        </div>
      </div>

      {/* CUENTA — Selector custom agrupado */}
      <div ref={selectorRef} className="relative">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {esIngreso ? 'Cuenta destino' : 'Cuenta origen'}
        </label>
        {loadingCuentas ? (
          <div className="text-xs text-gray-400 py-2">Cargando cuentas...</div>
        ) : cuentasFiltradas.length === 0 ? (
          <div className="text-xs text-red-500 py-2">No hay cuentas activas en {monedaPago}</div>
        ) : (
          <>
            <button type="button" onClick={() => setSelectorAbierto(!selectorAbierto)}
              className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                selectorAbierto ? 'border-primary-400 ring-2 ring-primary-100' : 'border-gray-200 hover:border-gray-300'
              }`}>
              {cuentaSeleccionada
                ? renderCuentaTarjeta(cuentaSeleccionada)
                : <span className="text-sm text-gray-400">Seleccionar cuenta...</span>
              }
              <ChevronDown className={`absolute right-3 top-9 w-4 h-4 text-gray-400 transition-transform ${selectorAbierto ? 'rotate-180' : ''}`} />
            </button>

            {selectorAbierto && (
              <div className="absolute z-30 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-64 overflow-y-auto">
                {[...gruposCuentas.bancos.entries()].map(([banco, items]) =>
                  renderGrupo(banco, <Building2 className="w-3 h-3" />, items)
                )}
                {renderGrupo('Digital', <Smartphone className="w-3 h-3" />, gruposCuentas.digitales)}
                {renderGrupo('Efectivo', <Banknote className="w-3 h-3" />, gruposCuentas.efectivo)}
              </div>
            )}
          </>
        )}

        {/* Línea de crédito con impacto */}
        {lineaCredito && (
          <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs space-y-1.5">
            <div className="flex justify-between text-amber-700">
              <span>Línea de crédito</span>
              <span className="font-bold">{formatCurrency(lineaCredito.disponible)} disponible</span>
            </div>
            <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{
                width: `${lineaCredito.limiteTotal > 0 ? Math.min((lineaCredito.utilizado / lineaCredito.limiteTotal) * 100, 100) : 0}%`
              }} />
            </div>
            <div className="flex justify-between text-amber-500">
              <span>Usado: {formatCurrency(lineaCredito.utilizado)}</span>
              <span>Límite: {formatCurrency(lineaCredito.limiteTotal)}</span>
            </div>
            {montoOriginal > 0 && (
              <div className={`pt-1.5 border-t border-amber-200 flex justify-between ${
                montoOriginal > lineaCredito.disponible ? 'text-red-600 font-medium' : 'text-amber-700'
              }`}>
                <span>Este pago: {formatCurrency(montoOriginal)}</span>
                <span>Quedará: {formatCurrency(Math.max(lineaCredito.disponible - montoOriginal, 0))}
                  {montoOriginal > lineaCredito.disponible && ' — EXCEDE'}
                </span>
              </div>
            )}
            {(lineaCredito.fechaCorte || lineaCredito.fechaPago) && (
              <div className="text-[10px] text-amber-400">
                {lineaCredito.fechaCorte && `Corte: día ${lineaCredito.fechaCorte}`}
                {lineaCredito.fechaCorte && lineaCredito.fechaPago && ' | '}
                {lineaCredito.fechaPago && `Pago: día ${lineaCredito.fechaPago}`}
              </div>
            )}
          </div>
        )}

        {/* Saldo insuficiente */}
        {saldoInsuficiente && (
          <div role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5" />
            Saldo insuficiente. Disponible: {sim} {saldoCuenta.toFixed(2)}
          </div>
        )}
      </div>

      {/* MÉTODO DE PAGO */}
      {metodosDisponibles.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Método de pago</label>
          {metodosDisponibles.length === 1 ? (
            <div className="py-2 px-3 rounded-lg text-xs font-medium bg-primary-50 border border-primary-300 text-primary-700">
              {METODOS_PAGO_INFO[metodosDisponibles[0] as MetodoPagoUnificado]?.label || metodosDisponibles[0]}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {metodosDisponibles.map(m => {
                const info = METODOS_PAGO_INFO[m as MetodoPagoUnificado];
                return (
                  <button key={m} type="button" onClick={() => setMetodoPago(m)}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all flex-shrink-0 ${
                      metodoPago === m ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}>
                    {info?.label || m}
                  </button>
                );
              })}
            </div>
          )}

          {/* Canal vinculado (Yape/Plin — muestra teléfono) */}
          {canalDetalle?.identificador && (
            <div className="mt-2 flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
              <Phone className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
              <span className="text-xs text-purple-700 font-medium">
                {metodoInfo?.label || metodoPago}:
              </span>
              <span className="text-xs text-purple-900 font-mono">{canalDetalle.identificador}</span>
              <button type="button"
                onClick={() => {
                  navigator.clipboard.writeText(canalDetalle.identificador!);
                  toast.success('Copiado');
                }}
                className="ml-auto p-1 text-purple-400 hover:text-purple-600 rounded">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* MONTO + TC */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-600">Monto ({sim})</label>
          <button type="button" onClick={() => setShowTC(!showTC)}
            className="text-[10px] text-gray-400 hover:text-gray-600">
            TC: {tipoCambio.toFixed(3)} {showTC ? '▲' : '▼'}
          </button>
        </div>
        <input type="text" inputMode="decimal"
          value={montoOriginal || ''} onChange={e => setMontoOriginal(parseFloat(e.target.value) || 0)}
          disabled={esPagoCompleto}
          className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-300 disabled:bg-gray-100" />
        {showTC && (
          <div className="mt-1.5">
            <input type="text" inputMode="decimal"
              value={tipoCambio || ''} onChange={e => setTipoCambio(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-300" />
          </div>
        )}
      </div>

      {/* Equivalencia */}
      {tipoCambio > 0 && montoOriginal > 0 && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 flex justify-between">
          <span>Equivalente:</span>
          <span className="font-medium">
            {monedaPago === 'USD' ? `S/ ${montoPEN.toFixed(2)}` : `$ ${montoUSD.toFixed(2)}`}
          </span>
        </div>
      )}

      {/* FECHA + REFERENCIA */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            <Calendar className="w-3 h-3 inline mr-1" /> Fecha
          </label>
          <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-300" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Referencia {metodoInfo?.requiereReferencia && <span className="text-red-400">*</span>}
          </label>
          <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)}
            placeholder="Nro. operación"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-300" />
        </div>
      </div>

      {/* NOTAS */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
          placeholder="Observaciones..."
          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-300 resize-none" />
      </div>

      {/* BOTONES */}
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1 min-h-[48px]">
          Cancelar
        </Button>
        <Button type="submit" variant="primary" className="flex-1 min-h-[48px] text-base"
          disabled={loading || montoOriginal <= 0 || !cuentaOrigenId}>
          {loading ? 'Procesando...' : (
            <>
              <CreditCard className="w-4 h-4 mr-1" />
              {esIngreso ? 'Registrar Cobro' : 'Registrar Pago'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
