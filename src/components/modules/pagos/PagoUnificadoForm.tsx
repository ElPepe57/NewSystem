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
import type { CuentaCaja, DatoBancarioPasivo } from '../../../types/tesoreria.types';
import type { MetodoPagoUnificado, OrigenPago } from '../../../types/pago.types';
import { METODOS_PAGO_INFO } from '../../../types/pago.types';
import { useDatosBancariosTercero } from '../../../hooks/useDatosBancariosTercero';

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

  // ============================================
  // FASE 2 · DEUDA-PAGOFORM-001 — Destino tercero (opt-in)
  // ============================================
  /**
   * Si se seleccionó un destino tercero (lookup de `datosBancarios[]` del
   * proveedor / cliente / colaborador), aquí va el `id` interno (no Firestore).
   *
   * NO mueve saldo — es solo evidencia de "a qué cuenta de él envié el dinero".
   * Solo se llena cuando `permiteDestinoTercero=true` y el operador eligió un
   * destino concreto. Si quedó "Entregado en mano" o "Sin destino digital",
   * este campo va `undefined`.
   */
  destinoTerceroDatoBancarioId?: string;
  /** Etiqueta humana del destino seleccionado (p. ej. "Yape Personal · 999 999 999"). */
  destinoTerceroEtiqueta?: string;
  /** Tipo del destino (banco/yape/plin/...). */
  destinoTerceroTipo?: DatoBancarioPasivo['tipo'];
  /** Marca "entregado en mano" — el operador eligió no asociar a ningún dato bancario del tercero. */
  destinoEntregadoEnMano?: boolean;
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
  /**
   * S41 Bloque 5 — Destinatario visible del pago (override del default).
   * Si se provee, se muestra un banner arriba del formulario indicando
   * "Pagando a: {destinatarioNombre}" con tipo (proveedor/colaborador).
   *
   * Útil para OCs con deudor alternativo (colaborador adelantó pago al proveedor).
   * Cuando no se provee, se asume proveedor (comportamiento histórico).
   */
  destinatario?: {
    id: string;
    nombre: string;
    tipo: 'proveedor' | 'colaborador';
    /** Solo para deudor alternativo — nombre del proveedor original (para contexto) */
    proveedorOriginalNombre?: string;
  };

  // ============================================
  // FASE 2 · DEUDA-PAGOFORM-001 — Destino tercero + Caja recaudadora (todas opt-in)
  // ============================================
  /**
   * Activa el selector de destino para registrar a qué dato bancario del
   * tercero se le envió el pago. Solo aplica para `esIngreso=false` (pagos
   * salientes) — en cobros, el destino implícito es la cuenta seleccionada
   * en origen (mi cuenta).
   *
   * Defaults a `false` para no romper los 25+ usos legacy.
   */
  permiteDestinoTercero?: boolean;
  /**
   * ID del proveedor pre-cargado. El form hace lookup automático de su
   * `datosBancarios[]` y lo presenta en el selector destino.
   */
  proveedorId?: string;
  /** ID del cliente pre-cargado (mismo comportamiento que proveedorId). */
  clienteId?: string;
  /** ID del colaborador pre-cargado (mismo comportamiento que proveedorId). */
  colaboradorId?: string;
  /**
   * Callback cuando el operador detecta que un dato bancario debería
   * promoverse a Caja Recaudadora (caso agente recaudador). El consumidor
   * decide si abrir el wizard de promoción o solo registrar la intención.
   *
   * Si no se provee, el banner de promoción NO se muestra.
   */
  onPromoverACajaRecaudadora?: (datoBancarioId: string) => void;
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
  if (pf === 'caja' || cuenta.tipo === 'efectivo') return <Banknote className="w-3.5 h-3.5 text-emerald-500" />;
  if (pf === 'billetera_digital' || cuenta.tipo === 'digital') return <Smartphone className="w-3.5 h-3.5 text-purple-500" />;
  if (cuenta.tipo === 'credito') return <CreditCard className="w-3.5 h-3.5 text-amber-500" />;
  return <Building2 className="w-3.5 h-3.5 text-sky-500" />;
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
  destinatario,
  // FASE 2 · destino tercero + caja recaudadora (todas opt-in)
  permiteDestinoTercero = false,
  proveedorId,
  clienteId,
  colaboradorId,
  onPromoverACajaRecaudadora,
}) => {
  const { getTCDelDia } = useTipoCambioStore();
  const toast = useToastStore();

  // Estado del formulario
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);
  const [monedaPago, setMonedaPago] = useState<'PEN' | 'USD'>(monedaOriginal);
  // Estado string para el input (permite escribir punto/coma sin que React lo descarte).
  // El number se deriva abajo con parseFloat — setMontoOriginal sigue funcionando
  // porque es un wrapper que formatea con toFixed(2).
  const [montoOriginalStr, setMontoOriginalStr] = useState('');
  const montoOriginal = parseFloat(montoOriginalStr.replace(',', '.')) || 0;
  const setMontoOriginal = (n: number) => setMontoOriginalStr(n ? n.toFixed(2) : '');
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

  // ───── FASE 2 · Destino tercero (opt-in) ─────
  // Se activa cuando: !esIngreso (es pago saliente) + permiteDestinoTercero=true
  // + hay tercero pre-cargado (al menos un id de proveedor/cliente/colaborador).
  const destinoTerceroActivo =
    !esIngreso &&
    permiteDestinoTercero === true &&
    Boolean(proveedorId || clienteId || colaboradorId);

  const tercero = useDatosBancariosTercero({
    proveedorId: destinoTerceroActivo ? proveedorId : undefined,
    clienteId: destinoTerceroActivo ? clienteId : undefined,
    colaboradorId: destinoTerceroActivo ? colaboradorId : undefined,
  });

  // 'mano' = entregado en mano (sin destino digital), 'banco' = id de DatoBancarioPasivo del tercero.
  const [destinoSeleccionado, setDestinoSeleccionado] = useState<string | 'mano' | ''>('');
  const [destinoSelectorAbierto, setDestinoSelectorAbierto] = useState(false);
  const destinoSelectorRef = useRef<HTMLDivElement>(null);

  // Auto-seleccionar primer destino cuando se activa el lookup (UX: pre-elige el principal).
  useEffect(() => {
    if (!destinoTerceroActivo) {
      setDestinoSeleccionado('');
      return;
    }
    if (tercero.loading) return;
    if (destinoSeleccionado) return;
    const principal =
      tercero.datosBancarios.find((d) => d.esPrincipal) ||
      tercero.datosBancarios[0];
    if (principal) setDestinoSeleccionado(principal.id);
    else setDestinoSeleccionado('mano'); // fallback si el tercero no tiene datos bancarios
  }, [destinoTerceroActivo, tercero.loading, tercero.datosBancarios, destinoSeleccionado]);

  // Cerrar selector destino al hacer click fuera.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (destinoSelectorRef.current && !destinoSelectorRef.current.contains(e.target as Node)) {
        setDestinoSelectorAbierto(false);
      }
    };
    if (destinoSelectorAbierto) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [destinoSelectorAbierto]);

  const datoBancarioSeleccionado = useMemo<DatoBancarioPasivo | null>(() => {
    if (!destinoSeleccionado || destinoSeleccionado === 'mano') return null;
    return tercero.datosBancarios.find((d) => d.id === destinoSeleccionado) || null;
  }, [destinoSeleccionado, tercero.datosBancarios]);

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
      // FASE 2 · destino tercero (solo si está activo y se seleccionó algo)
      destinoTerceroDatoBancarioId:
        destinoTerceroActivo && datoBancarioSeleccionado
          ? datoBancarioSeleccionado.id
          : undefined,
      destinoTerceroEtiqueta:
        destinoTerceroActivo && datoBancarioSeleccionado
          ? datoBancarioSeleccionado.etiqueta
          : undefined,
      destinoTerceroTipo:
        destinoTerceroActivo && datoBancarioSeleccionado
          ? datoBancarioSeleccionado.tipo
          : undefined,
      destinoEntregadoEnMano:
        destinoTerceroActivo && destinoSeleccionado === 'mano' ? true : undefined,
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
            {c.banco && <span className="text-[10px] px-1 py-0.5 rounded bg-sky-100 text-sky-700 font-medium">{c.banco}</span>}
            <span className={`font-medium text-slate-800 truncate ${compacta ? 'text-xs' : 'text-sm'}`}>{c.nombre}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
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
        <div className={`text-right flex-shrink-0 ${compacta ? 'text-xs' : 'text-sm'} font-bold ${saldo < 0 ? 'text-red-600' : 'text-slate-800'}`}>
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
        <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-50 flex items-center gap-1.5">
          {icon} {label}
        </div>
        {items.map(c => (
          <button key={c.id} type="button"
            onClick={() => { setCuentaOrigenId(c.id); setSelectorAbierto(false); }}
            className={`w-full text-left px-3 py-2.5 hover:bg-teal-50 transition-colors ${
              c.id === cuentaOrigenId ? 'bg-teal-50/70' : ''
            }`}>
            {renderCuentaTarjeta(c, true)}
          </button>
        ))}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* S41 Bloque 5 — Banner de destinatario (visible solo cuando se provee) */}
      {destinatario && (
        <div
          className={`rounded-lg border p-3 ${
            destinatario.tipo === 'colaborador'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                destinatario.tipo === 'colaborador'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {destinatario.tipo === 'colaborador' ? '👤' : '🏢'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {esIngreso ? 'Cobrando a' : 'Pagando a'}
              </div>
              <div className="text-sm font-semibold text-slate-900 truncate">
                {destinatario.nombre}
                <span
                  className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    destinatario.tipo === 'colaborador'
                      ? 'bg-amber-200 text-amber-900'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {destinatario.tipo}
                </span>
              </div>
              {destinatario.tipo === 'colaborador' &&
                destinatario.proveedorOriginalNombre && (
                  <div className="text-[11px] text-amber-800 mt-0.5">
                    Adelantó pago a{' '}
                    <span className="font-medium">
                      {destinatario.proveedorOriginalNombre}
                    </span>
                    . La CxP se liquida con el colaborador.
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* HEADER · DEUDA-PAGOFORM-001 Fase 1 visual S58f · gradient + tabular-nums */}
      <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-purple-700 font-bold">
              {titulo || `${esIngreso ? 'Cobro' : 'Pago'} ${origen}`}
            </div>
            <div className="text-xl font-bold text-purple-900 tabular-nums mt-0.5">
              {monedaOriginal === 'USD' ? '$' : 'S/'} {montoTotal.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Pendiente</div>
            <div className={`text-xl font-bold tabular-nums mt-0.5 ${montoPendiente <= 0 ? 'text-emerald-600' : 'text-rose-700'}`}>
              {monedaOriginal === 'USD' ? '$' : 'S/'} {montoPendiente.toFixed(2)}
            </div>
          </div>
        </div>
        {pagosAnteriores.length > 0 && (
          <div className="mt-3 pt-3 border-t border-purple-200">
            <button type="button" onClick={() => setShowHistorial(!showHistorial)}
              className="flex items-center gap-1.5 text-xs text-purple-700 hover:text-purple-900 font-semibold">
              <History className="w-3.5 h-3.5" />
              <span className="tabular-nums">{pagosAnteriores.length}</span> pago(s) anterior(es)
              {showHistorial ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showHistorial && (
              <div className="mt-2 space-y-1">
                {pagosAnteriores.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-white rounded-lg p-2 border border-purple-100">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 tabular-nums">
                        {typeof p.fecha === 'string' ? p.fecha : p.fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                        {METODOS_PAGO_INFO[p.metodo as MetodoPagoUnificado]?.label ?? p.metodo}
                      </span>
                    </div>
                    <span className="font-bold text-purple-800 tabular-nums">
                      {p.moneda === 'USD' ? '$' : 'S/'} {p.monto.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* TIPO: Completo/Parcial · DEUDA-PAGOFORM-001 Fase 1 visual S58f */}
      {montoPendiente > 0 && (
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-600 font-bold mb-1.5">Tipo de pago</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEsPagoCompleto(true)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-bold border-2 transition-all ${
                esPagoCompleto ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-200' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}>
              <Check className="w-4 h-4 inline mr-1" /> Completo
            </button>
            <button type="button" onClick={() => setEsPagoCompleto(false)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-bold border-2 transition-all ${
                !esPagoCompleto ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-200' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}>
              <ArrowRightLeft className="w-4 h-4 inline mr-1" /> Parcial
            </button>
          </div>
        </div>
      )}

      {/* MONEDA · S58f visual */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-600 font-bold mb-1.5">Moneda de pago</label>
        <div className="flex gap-2">
          {(['PEN', 'USD'] as const).map(m => (
            <button key={m} type="button" onClick={() => setMonedaPago(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                monedaPago === m ? 'bg-purple-50 border-purple-500 text-purple-700 ring-2 ring-purple-200' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}>
              {m === 'PEN' ? 'S/ Soles' : '$ Dólares'}
            </button>
          ))}
        </div>
      </div>

      {/* CUENTA — Selector custom agrupado · S58f label uppercase */}
      <div ref={selectorRef} className="relative">
        <label className="block text-[10px] uppercase tracking-wider text-slate-600 font-bold mb-1.5">
          {esIngreso ? 'Cuenta destino' : 'Cuenta origen'}
        </label>
        {loadingCuentas ? (
          <div className="text-xs text-slate-400 py-2">Cargando cuentas...</div>
        ) : cuentasFiltradas.length === 0 ? (
          <div className="text-xs text-red-500 py-2">No hay cuentas activas en {monedaPago}</div>
        ) : (
          <>
            <button type="button" onClick={() => setSelectorAbierto(!selectorAbierto)}
              className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                selectorAbierto ? 'border-teal-400 ring-2 ring-teal-100' : 'border-slate-200 hover:border-slate-300'
              }`}>
              {cuentaSeleccionada
                ? renderCuentaTarjeta(cuentaSeleccionada)
                : <span className="text-sm text-slate-400">Seleccionar cuenta...</span>
              }
              <ChevronDown className={`absolute right-3 top-9 w-4 h-4 text-slate-400 transition-transform ${selectorAbierto ? 'rotate-180' : ''}`} />
            </button>

            {selectorAbierto && (
              <div className="absolute z-30 w-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg max-h-64 overflow-y-auto">
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

      {/* ============================================
           DESTINO TERCERO · DEUDA-PAGOFORM-001 Fase 2 (opt-in)
           Solo aparece para pagos salientes con tercero pre-cargado.
           Lectura de datosBancarios[] del proveedor / cliente / colaborador.
           NO mueve saldo — es solo evidencia de "a qué cuenta de él envié el dinero".
         ============================================ */}
      {destinoTerceroActivo && (
        <div ref={destinoSelectorRef} className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] uppercase tracking-wider text-violet-700 font-bold">
              Destino del pago · {tercero.terceroNombre || '...'}
            </label>
            <span className="text-[9px] text-slate-400 italic">
              Referencia · NO mueve saldo
            </span>
          </div>

          {tercero.loading ? (
            <div className="text-xs text-slate-400 py-2">
              Cargando datos bancarios del tercero…
            </div>
          ) : tercero.datosBancarios.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-3 text-xs text-slate-600">
              <div className="font-semibold mb-1">
                {tercero.terceroNombre || 'Este tercero'} no tiene datos bancarios registrados.
              </div>
              <div className="text-[11px] text-slate-500">
                Se registrará como <strong>Entregado en mano</strong>. Para asociar una cuenta,
                primero agrégala en la ficha del {tercero.terceroTipo || 'tercero'}.
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setDestinoSelectorAbierto(!destinoSelectorAbierto)}
                className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                  destinoSelectorAbierto
                    ? 'border-violet-400 ring-2 ring-violet-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {datoBancarioSeleccionado ? (
                  <div className="flex items-start gap-2 w-full">
                    <div className="pt-0.5">
                      {datoBancarioSeleccionado.tipo === 'banco' ? (
                        <Building2 className="w-3.5 h-3.5 text-sky-500" />
                      ) : (
                        <Smartphone className="w-3.5 h-3.5 text-purple-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {datoBancarioSeleccionado.banco && (
                          <span className="text-[10px] px-1 py-0.5 rounded bg-sky-100 text-sky-700 font-medium">
                            {datoBancarioSeleccionado.banco}
                          </span>
                        )}
                        <span className="font-medium text-slate-800 truncate text-sm">
                          {datoBancarioSeleccionado.etiqueta}
                        </span>
                        {datoBancarioSeleccionado.esPrincipal && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-bold uppercase">
                            Principal
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                        {datoBancarioSeleccionado.numeroCuenta && (
                          <span>#{datoBancarioSeleccionado.numeroCuenta}</span>
                        )}
                        {datoBancarioSeleccionado.identificador && (
                          <span>· {datoBancarioSeleccionado.identificador}</span>
                        )}
                        {datoBancarioSeleccionado.moneda && (
                          <span>· {datoBancarioSeleccionado.moneda}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : destinoSeleccionado === 'mano' ? (
                  <div className="flex items-center gap-2">
                    <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-sm font-medium text-slate-800">
                      Entregado en mano
                    </span>
                    <span className="text-[10px] text-slate-400 italic ml-auto">
                      Sin destino digital
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">Seleccionar destino…</span>
                )}
                <ChevronDown
                  className={`absolute right-3 top-9 w-4 h-4 text-slate-400 transition-transform ${
                    destinoSelectorAbierto ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {destinoSelectorAbierto && (
                <div className="absolute z-30 w-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg max-h-64 overflow-y-auto">
                  {/* Grupo 1: Datos bancarios del tercero */}
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-violet-500 uppercase tracking-wide bg-violet-50">
                    Datos del tercero · referencia
                  </div>
                  {tercero.datosBancarios.map((d) => {
                    const yaPromovida = Boolean(d.promovidaACuentaCajaId);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setDestinoSeleccionado(d.id);
                          setDestinoSelectorAbierto(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 hover:bg-violet-50 transition-colors ${
                          d.id === destinoSeleccionado ? 'bg-violet-50/70' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2 w-full">
                          <div className="pt-0.5">
                            {d.tipo === 'banco' ? (
                              <Building2 className="w-3.5 h-3.5 text-sky-500" />
                            ) : (
                              <Smartphone className="w-3.5 h-3.5 text-purple-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {d.banco && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-sky-100 text-sky-700 font-medium">
                                  {d.banco}
                                </span>
                              )}
                              <span className="font-medium text-slate-800 truncate text-xs">
                                {d.etiqueta}
                              </span>
                              {d.esPrincipal && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-bold uppercase">
                                  Principal
                                </span>
                              )}
                              {yaPromovida && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold uppercase">
                                  ✓ Caja
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                              {d.numeroCuenta && <span>#{d.numeroCuenta}</span>}
                              {d.identificador && <span>· {d.identificador}</span>}
                              {d.moneda && <span>· {d.moneda}</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {/* Grupo 2: Sin destino digital */}
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-t border-slate-200">
                    Sin destino digital
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDestinoSeleccionado('mano');
                      setDestinoSelectorAbierto(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 hover:bg-emerald-50 transition-colors ${
                      destinoSeleccionado === 'mano' ? 'bg-emerald-50/70' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-slate-800">
                          🤝 Entregado en mano
                        </div>
                        <div className="text-[10px] text-slate-400 italic">
                          Sin asociar a dato bancario del tercero
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Banner de promoción a Caja Recaudadora · solo si hay callback Y dato seleccionado SIN promoción aún */}
          {onPromoverACajaRecaudadora &&
            datoBancarioSeleccionado &&
            !datoBancarioSeleccionado.promovidaACuentaCajaId && (
              <div className="mt-2 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-300 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="text-base flex-shrink-0">💡</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                      ¿Esta cuenta recibe dinero a tu favor?
                    </div>
                    <div className="text-[11px] text-emerald-800 mt-0.5">
                      Si <strong>{tercero.terceroNombre}</strong> te recauda en{' '}
                      <strong>{datoBancarioSeleccionado.etiqueta}</strong>, podés{' '}
                      <strong>promoverla a Caja Recaudadora</strong> y empezar a trackear
                      su saldo en tu sistema.
                    </div>
                    <button
                      type="button"
                      onClick={() => onPromoverACajaRecaudadora(datoBancarioSeleccionado.id)}
                      className="mt-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Promover a Caja Recaudadora →
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
      )}

      {/* MÉTODO DE PAGO */}
      {metodosDisponibles.length > 0 && (
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-600 font-bold mb-1.5">Método de pago</label>
          {metodosDisponibles.length === 1 ? (
            <div className="py-2 px-3 rounded-lg text-xs font-medium bg-teal-50 border border-teal-300 text-teal-700">
              {METODOS_PAGO_INFO[metodosDisponibles[0] as MetodoPagoUnificado]?.label || metodosDisponibles[0]}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {metodosDisponibles.map(m => {
                const info = METODOS_PAGO_INFO[m as MetodoPagoUnificado];
                return (
                  <button key={m} type="button" onClick={() => setMetodoPago(m)}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all flex-shrink-0 ${
                      metodoPago === m ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
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
          <label className="text-[10px] uppercase tracking-wider text-slate-600 font-bold">Monto ({sim})</label>
          <button type="button" onClick={() => setShowTC(!showTC)}
            className="text-[10px] text-slate-400 hover:text-slate-600">
            TC: {tipoCambio.toFixed(3)} {showTC ? '▲' : '▼'}
          </button>
        </div>
        <input type="text" inputMode="decimal"
          value={montoOriginalStr}
          onChange={e => {
            // Permitir solo dígitos + un separador decimal (. o ,) + hasta 2 decimales
            const v = e.target.value.replace(',', '.');
            if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setMontoOriginalStr(v);
          }}
          onBlur={() => {
            // Al salir del campo, normalizar visualmente (ej: "80." → "80.00", "" se queda vacío)
            if (montoOriginalStr && !isNaN(parseFloat(montoOriginalStr))) {
              setMontoOriginalStr(parseFloat(montoOriginalStr).toFixed(2));
            }
          }}
          disabled={esPagoCompleto}
          className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-teal-300 disabled:bg-slate-100" />
        {showTC && (
          <div className="mt-1.5">
            <input type="text" inputMode="decimal"
              value={tipoCambio || ''} onChange={e => setTipoCambio(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-300" />
          </div>
        )}
      </div>

      {/* Equivalencia */}
      {tipoCambio > 0 && montoOriginal > 0 && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 flex justify-between">
          <span>Equivalente:</span>
          <span className="font-medium">
            {monedaPago === 'USD' ? `S/ ${montoPEN.toFixed(2)}` : `$ ${montoUSD.toFixed(2)}`}
          </span>
        </div>
      )}

      {/* FECHA + REFERENCIA · S58f visual */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-600 font-bold mb-1.5">
            <Calendar className="w-3 h-3 inline mr-1" /> Fecha
          </label>
          <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}
            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 tabular-nums" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-600 font-bold mb-1.5">
            Referencia {metodoInfo?.requiereReferencia && <span className="text-rose-500">*</span>}
          </label>
          <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)}
            placeholder="Nro. operación"
            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 tabular-nums" />
        </div>
      </div>

      {/* NOTAS · S58f visual */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-600 font-bold mb-1.5">Notas (opcional)</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
          placeholder="Observaciones..."
          className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 resize-none" />
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
