/**
 * PagoUnificadoForm — Componente ÚNICO de registro de pagos para todo el sistema.
 *
 * Reemplaza: PagoForm (OC), PagoGastoForm, PagoViajeroModal (form), VentaForm paso pago
 *
 * Características:
 * - Selección de moneda (PEN/USD) con toggle visual
 * - Métodos de pago derivados de las cuentas configuradas en tesorería
 * - TC editable con carga automática
 * - Pagos parciales o completos
 * - Historial de pagos anteriores
 * - Cálculo automático de equivalencias PEN/USD
 * - Validación de saldo y monto
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, CreditCard, Wallet, Calendar, History,
  ChevronDown, ChevronUp, AlertCircle, Check, ArrowRightLeft
} from 'lucide-react';
import { Card, Button, Badge } from '../../common';
import { useTipoCambioStore } from '../../../store/tipoCambioStore';
import { useToastStore } from '../../../store/toastStore';
import { tesoreriaService } from '../../../services/tesoreria.service';
import { formatCurrency } from '../../../utils/format';
import type { CuentaCaja } from '../../../types/tesoreria.types';
import type { MetodoPagoUnificado, OrigenPago } from '../../../types/pago.types';
import { METODOS_PAGO_INFO } from '../../../types/pago.types';

// ============================================
// PROPS
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
  // Contexto
  origen: OrigenPago;
  titulo?: string;                   // "Pago OC-2026-010", "Cobro VT-2026-005"
  esIngreso?: boolean;               // true para cobros de venta, false para pagos (default)

  // Montos
  montoTotal: number;                // monto total de la obligación
  montoPendiente: number;            // monto pendiente de pago
  monedaOriginal: 'PEN' | 'USD';    // moneda del documento original
  tcDocumento?: number;              // TC del documento (si existe)

  // Pagos anteriores (para mostrar historial)
  pagosAnteriores?: PagoPrevio[];

  // Callbacks
  onSubmit: (datos: PagoUnificadoResult) => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// ============================================
// COMPONENTE
// ============================================

export const PagoUnificadoForm: React.FC<PagoUnificadoFormProps> = ({
  origen,
  titulo,
  esIngreso = false,
  montoTotal,
  montoPendiente,
  monedaOriginal,
  tcDocumento,
  pagosAnteriores = [],
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const { getTCDelDia } = useTipoCambioStore();
  const toast = useToastStore();

  // ─── Estado del formulario ───
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);
  const [monedaPago, setMonedaPago] = useState<'PEN' | 'USD'>(monedaOriginal);
  const [montoOriginal, setMontoOriginal] = useState(0);
  const [tipoCambio, setTipoCambio] = useState(tcDocumento || 0);
  const [metodoPago, setMetodoPago] = useState<string>('');
  const [cuentaOrigenId, setCuentaOrigenId] = useState('');
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');
  const [esPagoCompleto, setEsPagoCompleto] = useState(true);
  const [showHistorial, setShowHistorial] = useState(false);

  // ─── Cuentas de tesorería ───
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState(true);

  // ─── Cargar TC del día ───
  useEffect(() => {
    const loadTC = async () => {
      if (!tcDocumento) {
        const tc = await getTCDelDia();
        if (tc) setTipoCambio(tc.compra);
      }
    };
    loadTC();
  }, [getTCDelDia, tcDocumento]);

  // ─── Cargar cuentas ───
  useEffect(() => {
    const cargar = async () => {
      try {
        setLoadingCuentas(true);
        const todas = await tesoreriaService.getCuentas();
        setCuentas(todas.filter(c => c.activa));
      } catch {
        toast.error('Error al cargar cuentas');
      } finally {
        setLoadingCuentas(false);
      }
    };
    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Filtrar cuentas por moneda ───
  const cuentasFiltradas = useMemo(() =>
    cuentas.filter(c => c.esBiMoneda || c.moneda === monedaPago),
  [cuentas, monedaPago]);

  // ─── Métodos disponibles (derivados de las cuentas) ───
  const metodosDisponibles = useMemo(() => {
    const metodos = new Set<string>();
    cuentasFiltradas.forEach(c => {
      if (c.metodosDisponibles?.length) {
        c.metodosDisponibles.forEach(m => metodos.add(m));
      } else {
        // Fallback por tipo de cuenta
        if (c.tipo === 'efectivo') metodos.add('efectivo');
        else if (c.tipo === 'banco') { metodos.add('transferencia'); metodos.add('yape'); metodos.add('plin'); }
        else if (c.tipo === 'digital') metodos.add('mercado_pago');
        else if (c.tipo === 'credito') { metodos.add('tarjeta_debito'); metodos.add('tarjeta_credito'); }
      }
    });
    return [...metodos];
  }, [cuentasFiltradas]);

  // ─── Auto-seleccionar cuenta y método ───
  useEffect(() => {
    const defecto = cuentasFiltradas.find(c => c.esCuentaPorDefecto);
    if (defecto) setCuentaOrigenId(defecto.id);
    else if (cuentasFiltradas.length > 0) setCuentaOrigenId(cuentasFiltradas[0].id);
    else setCuentaOrigenId('');
  }, [cuentasFiltradas]);

  useEffect(() => {
    if (metodosDisponibles.length > 0 && !metodosDisponibles.includes(metodoPago)) {
      setMetodoPago(metodosDisponibles[0]);
    }
  }, [metodosDisponibles, metodoPago]);

  // ─── Monto por defecto ───
  useEffect(() => {
    if (esPagoCompleto) {
      if (monedaPago === monedaOriginal) {
        setMontoOriginal(montoPendiente);
      } else if (monedaPago === 'PEN' && monedaOriginal === 'USD') {
        setMontoOriginal(montoPendiente * tipoCambio);
      } else {
        setMontoOriginal(tipoCambio > 0 ? montoPendiente / tipoCambio : montoPendiente);
      }
    }
  }, [esPagoCompleto, montoPendiente, monedaPago, monedaOriginal, tipoCambio]);

  // ─── Cálculos ───
  const montoUSD = monedaPago === 'USD' ? montoOriginal : (tipoCambio > 0 ? montoOriginal / tipoCambio : 0);
  const montoPEN = monedaPago === 'PEN' ? montoOriginal : montoOriginal * tipoCambio;
  const cuentaSeleccionada = cuentas.find(c => c.id === cuentaOrigenId);
  const saldoCuenta = cuentaSeleccionada
    ? (monedaPago === 'USD'
      ? (cuentaSeleccionada.esBiMoneda ? cuentaSeleccionada.saldoUSD || 0 : cuentaSeleccionada.saldoActual)
      : (cuentaSeleccionada.esBiMoneda ? cuentaSeleccionada.saldoPEN || 0 : cuentaSeleccionada.saldoActual))
    : 0;
  const saldoInsuficiente = !esIngreso && montoOriginal > saldoCuenta && cuentaSeleccionada?.tipo !== 'credito';

  const metodoInfo = METODOS_PAGO_INFO[metodoPago as MetodoPagoUnificado];

  // ─── Submit ───
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (montoOriginal <= 0) { toast.warning('El monto debe ser mayor a 0'); return; }
    if (tipoCambio <= 0) { toast.warning('El tipo de cambio debe ser mayor a 0'); return; }
    if (!cuentaOrigenId) { toast.warning('Selecciona una cuenta'); return; }
    if (!metodoPago) { toast.warning('Selecciona un método de pago'); return; }

    onSubmit({
      fechaPago: new Date(fechaPago),
      monedaPago,
      montoOriginal,
      montoUSD,
      montoPEN,
      tipoCambio,
      metodoPago,
      cuentaOrigenId,
      cuentaOrigenNombre: cuentaSeleccionada?.nombre || '',
      referencia: referencia || undefined,
      notas: notas || undefined,
      esPagoCompleto,
    });
  };

  // ─── Línea de crédito (si la cuenta es tipo crédito) ───
  const lineaCredito = cuentaSeleccionada?.lineaCredito;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* HEADER: Resumen de la obligación */}
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
                  <div key={p.id} className="flex justify-between text-xs bg-white rounded p-1.5">
                    <span>{typeof p.fecha === 'string' ? p.fecha : p.fecha.toLocaleDateString('es-PE')}</span>
                    <span className="font-medium">{p.moneda === 'USD' ? '$' : 'S/'} {p.monto.toFixed(2)}</span>
                    <span className="text-gray-400">{p.metodo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* TIPO: Completo o Parcial */}
      {montoPendiente > 0 && (
        <div className="flex gap-2">
          <button type="button" onClick={() => setEsPagoCompleto(true)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
              esPagoCompleto ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}>
            <Check className="w-4 h-4 inline mr-1" /> Pago Completo
          </button>
          <button type="button" onClick={() => setEsPagoCompleto(false)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
              !esPagoCompleto ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}>
            <ArrowRightLeft className="w-4 h-4 inline mr-1" /> Pago Parcial
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

      {/* MONTO + TC */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Monto ({monedaPago === 'USD' ? '$' : 'S/'})
          </label>
          <input type="number" step="0.01" min="0.01"
            value={montoOriginal || ''} onChange={e => setMontoOriginal(+e.target.value)}
            disabled={esPagoCompleto}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-300 disabled:bg-gray-100" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Cambio</label>
          <input type="number" step="0.001" min="0.001"
            value={tipoCambio || ''} onChange={e => setTipoCambio(+e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-300" />
        </div>
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

      {/* MÉTODO DE PAGO */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Método de pago</label>
        <div className="grid grid-cols-3 gap-1.5">
          {metodosDisponibles.map(m => {
            const info = METODOS_PAGO_INFO[m as MetodoPagoUnificado];
            return (
              <button key={m} type="button" onClick={() => setMetodoPago(m)}
                className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                  metodoPago === m ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}>
                {info?.label || m}
              </button>
            );
          })}
        </div>
      </div>

      {/* CUENTA */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {esIngreso ? 'Cuenta destino' : 'Cuenta origen'}
        </label>
        {loadingCuentas ? (
          <div className="text-xs text-gray-400 py-2">Cargando cuentas...</div>
        ) : cuentasFiltradas.length === 0 ? (
          <div className="text-xs text-red-500 py-2">No hay cuentas activas en {monedaPago}</div>
        ) : (
          <select value={cuentaOrigenId} onChange={e => setCuentaOrigenId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-300">
            <option value="">Seleccionar...</option>
            {cuentasFiltradas.map(c => (
              <option key={c.id} value={c.id}>
                {c.nombre} — {monedaPago === 'USD' ? `$${(c.esBiMoneda ? c.saldoUSD || 0 : c.saldoActual).toFixed(2)}` : `S/${(c.esBiMoneda ? c.saldoPEN || 0 : c.saldoActual).toFixed(2)}`}
              </option>
            ))}
          </select>
        )}
        {/* Línea de crédito */}
        {lineaCredito && (
          <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs">
            <div className="flex justify-between text-amber-700">
              <span>Línea de crédito</span>
              <span className="font-bold">{formatCurrency(lineaCredito.disponible)} disponible</span>
            </div>
            <div className="h-1.5 bg-amber-200 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{
                width: `${lineaCredito.limiteTotal > 0 ? (lineaCredito.utilizado / lineaCredito.limiteTotal) * 100 : 0}%`
              }} />
            </div>
            <div className="flex justify-between text-amber-500 mt-0.5">
              <span>Usado: {formatCurrency(lineaCredito.utilizado)}</span>
              <span>Límite: {formatCurrency(lineaCredito.limiteTotal)}</span>
            </div>
          </div>
        )}
        {/* Saldo insuficiente */}
        {saldoInsuficiente && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5" />
            Saldo insuficiente. El saldo quedará negativo.
          </div>
        )}
      </div>

      {/* REFERENCIA + FECHA */}
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
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" variant="primary" className="flex-1" disabled={loading || montoOriginal <= 0 || !cuentaOrigenId}>
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
