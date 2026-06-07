/**
 * MovimientoCapitalModal · F14.G (2026-06-06)
 *
 * Acceso ÚNICO para registrar capital del socio · operación exclusiva de
 * Inversionistas (decisión AI). Reemplaza al AporteCapitalModal (solo aporte).
 *
 * Flujo (pixel-perfect: docs/mockups/inversionistas-registrar-capital-v1.html):
 *   1. Vista "tipo" · selector de socio (si no viene pre-cargado) + 3 radio-cards:
 *      Aporte de cash · Retiro · Tarjeta de crédito.
 *   2. Aporte / Retiro → form en el mismo modal (FormModalV2).
 *   3. Tarjeta → cierra y abre el CuentaWizard pre-contextualizado (onRegistrarTC).
 *
 * 3 accesos al mismo modal: header del módulo (sin socio · con selector) ·
 * botón "Nuevo aporte" de Mi Capital · botón del tab del socio (socio pre-cargado).
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Coins, Check, Landmark, ArrowLeftRight, Calendar, TrendingUp, User,
  Banknote, ArrowUpFromLine, CreditCard, ChevronRight, ArrowLeft, ExternalLink,
  HandCoins,
} from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { tesoreriaService } from '../../../services/tesoreria.service';
import { useAuthStore } from '../../../store/authStore';
import { formatCurrencyPEN } from '../../../utils/format';
import type {
  CuentaCaja, MonedaTesoreria, MetodoTesoreria,
  AporteCapitalFormData, RetiroCapitalFormData,
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

const TIPOS_RETIRO: Array<{ value: 'utilidades' | 'capital' | 'prestamo'; label: string; icon: React.FC<{ className?: string }> }> = [
  { value: 'utilidades', label: 'Utilidades', icon: TrendingUp },
  { value: 'capital', label: 'Capital', icon: Coins },
  { value: 'prestamo', label: 'Préstamo', icon: HandCoins },
];

interface SocioOpt { id: string; nombre: string }

interface Props {
  isOpen: boolean;
  /** Socio pre-cargado (acceso desde el tab del socio). Si ausente, se muestra selector. */
  socioId?: string;
  socioNombre?: string;
  tipoCambio: number;
  /** Catálogo de socios para el selector (acceso desde el header). */
  socios: SocioOpt[];
  onClose: () => void;
  onSuccess: () => void;
  /** Tarjeta de crédito → abre el CuentaWizard pre-contextualizado. */
  onRegistrarTC: (socioId: string, socioNombre: string) => void;
}

type Vista = 'tipo' | 'aporte' | 'retiro';

export default function MovimientoCapitalModal({
  isOpen, socioId, socioNombre, tipoCambio, socios, onClose, onSuccess, onRegistrarTC,
}: Props) {
  const userId = useAuthStore((s) => s.userProfile?.uid ?? '');

  const [vista, setVista] = useState<Vista>('tipo');
  const [socioSel, setSocioSel] = useState('');
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<MonedaTesoreria>('PEN');
  const [cuentaId, setCuentaId] = useState('');
  const [metodo, setMetodo] = useState<MetodoTesoreria>('transferencia_bancaria');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [referencia, setReferencia] = useState('');
  const [tipoRetiro, setTipoRetiro] = useState<'utilidades' | 'capital' | 'prestamo'>('utilidades');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setVista('tipo');
    setSocioSel(socioId ?? '');
    setMonto(''); setMoneda('PEN'); setMetodo('transferencia_bancaria');
    setFecha(new Date().toISOString().slice(0, 10)); setReferencia('');
    setTipoRetiro('utilidades'); setSaving(false); setError(null);
    tesoreriaService.getCuentasActivas().then((cs) => {
      setCuentas(cs);
      setCuentaId(cs.find((c) => c.esCuentaPorDefecto)?.id ?? cs[0]?.id ?? '');
    });
  }, [isOpen, socioId]);

  const cuentasFiltradas = useMemo(
    () => cuentas.filter((c) => c.esBiMoneda || c.moneda === moneda),
    [cuentas, moneda],
  );
  useEffect(() => {
    if (cuentaId && !cuentasFiltradas.find((c) => c.id === cuentaId)) {
      setCuentaId(cuentasFiltradas[0]?.id ?? '');
    }
  }, [cuentasFiltradas, cuentaId]);

  const socioNombreSel = socioNombre ?? socios.find((s) => s.id === socioSel)?.nombre ?? 'Socio';
  const montoNum = parseFloat(monto) || 0;
  const saldoDe = (c: CuentaCaja) => c.esBiMoneda ? (moneda === 'USD' ? c.saldoUSD ?? 0 : c.saldoPEN ?? 0) : c.saldoActual;

  // ── Selección de tipo desde el selector ──────────────────────────────────
  const elegirTipo = (t: 'aporte' | 'retiro' | 'tc') => {
    if (!socioSel) { setError('Elegí el socio primero.'); return; }
    setError(null);
    if (t === 'tc') { onRegistrarTC(socioSel, socioNombreSel); return; }
    setVista(t);
  };

  // ── Submit aporte/retiro ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (montoNum <= 0) { setError('Ingresá un monto mayor a 0.'); return; }
    if (!cuentaId) { setError('Seleccioná la cuenta.'); return; }
    if (!socioSel) { setError('Seleccioná el socio.'); return; }
    if (!userId) { setError('Sesión no válida.'); return; }
    setSaving(true); setError(null);
    const tc = moneda === 'USD' ? tipoCambio : 1;
    try {
      if (vista === 'aporte') {
        const data: AporteCapitalFormData = {
          monto: montoNum, moneda, tipoCambio: tc, cuentaDestinoId: cuentaId,
          socioNombre: socioNombreSel, socioId: socioSel, metodo, fecha: new Date(fecha),
          ...(referencia.trim() ? { referencia: referencia.trim() } : {}),
        };
        await tesoreriaService.registrarAporteCapital(data, userId);
      } else {
        const data: RetiroCapitalFormData = {
          monto: montoNum, moneda, tipoCambio: tc, cuentaOrigenId: cuentaId,
          socioNombre: socioNombreSel, socioId: socioSel, tipoRetiro, metodo, fecha: new Date(fecha),
          ...(referencia.trim() ? { referencia: referencia.trim() } : {}),
        };
        await tesoreriaService.registrarRetiroCapital(data, userId);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar.');
      setSaving(false);
    }
  };

  const esAporte = vista === 'aporte';
  const title = vista === 'tipo' ? 'Registrar capital' : esAporte ? 'Registrar aporte' : 'Registrar retiro';
  const subtitle = vista === 'tipo' ? '¿Qué tipo de capital querés registrar?' : `${socioNombreSel} · ${esAporte ? 'sube' : 'baja'} caja`;

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={title}
      subtitle={subtitle}
      breadcrumb={vista === 'tipo' ? 'Inversionistas · Capital' : `Capital · ${esAporte ? 'Aporte' : 'Retiro'}`}
      icon={Coins}
      iconTone="violet"
      submitLabel={esAporte ? 'Registrar aporte' : 'Registrar retiro'}
      submitIcon={Check}
      loading={saving}
      disabled={montoNum <= 0 || !cuentaId}
      hideFooter={vista === 'tipo'}
      size="md"
    >
      {error && (
        <div className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">{error}</div>
      )}

      {vista === 'tipo' ? (
        <div className="space-y-3">
          {/* Selector de socio (si no viene pre-cargado) */}
          {socioId ? (
            <div className="flex items-center gap-2 border border-violet-200 rounded-lg px-3 py-2 bg-violet-50/40">
              <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[11px] font-bold">
                {socioNombreSel.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1"><div className="text-[13px] font-semibold text-slate-900">{socioNombreSel}</div></div>
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Socio <span className="text-rose-500">*</span></label>
              <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-2.5 focus-within:ring-2 focus-within:ring-violet-500/40">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <select value={socioSel} onChange={(e) => setSocioSel(e.target.value)} className="flex-1 bg-transparent text-[13px] py-2 outline-none">
                  <option value="">Elegí un socio…</option>
                  {socios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* 3 radio-cards de tipo */}
          <button type="button" onClick={() => elegirTipo('aporte')}
            className="w-full flex items-center gap-3 p-3 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 rounded-xl text-left transition-colors">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><Banknote className="w-5 h-5" /></div>
            <div className="flex-1"><div className="text-[13px] font-bold text-slate-900">Aporte de cash</div><div className="text-[11px] text-slate-500">El socio inyecta dinero · sube caja y patrimonio</div></div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
          <button type="button" onClick={() => elegirTipo('retiro')}
            className="w-full flex items-center gap-3 p-3 border border-slate-200 hover:border-rose-300 hover:bg-rose-50/30 rounded-xl text-left transition-colors">
            <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0"><ArrowUpFromLine className="w-5 h-5" /></div>
            <div className="flex-1"><div className="text-[13px] font-bold text-slate-900">Retiro</div><div className="text-[11px] text-slate-500">El socio saca capital, utilidades o préstamo · baja caja</div></div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
          <button type="button" onClick={() => elegirTipo('tc')}
            className="w-full flex items-center gap-3 p-3 border-2 border-rose-200 hover:border-rose-300 bg-gradient-to-r from-rose-50/40 to-transparent rounded-xl text-left transition-colors relative">
            <span className="absolute -top-2 left-3 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">80% del negocio</span>
            <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0"><CreditCard className="w-5 h-5" /></div>
            <div className="flex-1"><div className="text-[13px] font-bold text-slate-900">Tarjeta de crédito</div><div className="text-[11px] text-slate-500">El socio pone su TC personal · deuda asumida por el negocio</div></div>
            <ExternalLink className="w-3.5 h-3.5 text-rose-400" />
          </button>
          <p className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1">
            El aporte de valor (know-how, marca) se edita en el perfil del socio · no es un movimiento.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          <button type="button" onClick={() => setVista('tipo')} className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Cambiar tipo
          </button>

          {/* Socio (ya elegido · read-only) */}
          <div className="flex items-center gap-2 border border-violet-200 rounded-lg px-3 py-2 bg-violet-50/40">
            <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[11px] font-bold">{socioNombreSel.slice(0, 2).toUpperCase()}</div>
            <div className="flex-1"><div className="text-[13px] font-semibold text-slate-900">{socioNombreSel}</div></div>
          </div>

          {/* tipoRetiro (solo retiro) */}
          {!esAporte && (
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Tipo de retiro <span className="text-rose-500">*</span></label>
              <div className="grid grid-cols-3 gap-1.5">
                {TIPOS_RETIRO.map((tr) => {
                  const Ic = tr.icon;
                  const active = tipoRetiro === tr.value;
                  return (
                    <button key={tr.value} type="button" onClick={() => setTipoRetiro(tr.value)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border ${active ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                      <Ic className="w-4 h-4" /><span className={`text-[11px] ${active ? 'font-bold' : 'font-semibold'}`}>{tr.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* monto + moneda */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Monto <span className="text-rose-500">*</span></label>
              <div className="flex items-center border border-slate-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-violet-500/40">
                <span className="text-slate-400 text-[13px] mr-1.5">{moneda === 'USD' ? '$' : 'S/'}</span>
                <input type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00"
                  className="flex-1 outline-none text-[14px] font-semibold tabular-nums text-slate-900 bg-transparent" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Moneda</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-lg p-1 h-[38px]">
                <button type="button" onClick={() => setMoneda('PEN')} className={`rounded-md text-[12px] font-bold ${moneda === 'PEN' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500'}`}>PEN</button>
                <button type="button" onClick={() => setMoneda('USD')} className={`rounded-md text-[12px] font-semibold ${moneda === 'USD' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500'}`}>USD</button>
              </div>
            </div>
          </div>

          {/* cuenta destino/origen */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Cuenta {esAporte ? 'destino' : 'origen'} <span className="text-rose-500">*</span></label>
            <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-2.5 focus-within:ring-2 focus-within:ring-violet-500/40">
              <Landmark className="w-4 h-4 text-slate-400 shrink-0" />
              <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} className="flex-1 bg-transparent text-[13px] py-2 outline-none">
                {cuentasFiltradas.length === 0 && <option value="">Sin cuentas para {moneda}</option>}
                {cuentasFiltradas.map((c) => <option key={c.id} value={c.id}>{c.nombre} · saldo {formatCurrencyPEN(saldoDe(c))}</option>)}
              </select>
            </div>
          </div>

          {/* método + fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Método</label>
              <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-2.5 focus-within:ring-2 focus-within:ring-violet-500/40">
                <ArrowLeftRight className="w-4 h-4 text-slate-400 shrink-0" />
                <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoTesoreria)} className="flex-1 bg-transparent text-[13px] py-2 outline-none">
                  {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Fecha</label>
              <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-2.5 focus-within:ring-2 focus-within:ring-violet-500/40">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="flex-1 bg-transparent text-[13px] tabular-nums py-2 outline-none" />
              </div>
            </div>
          </div>

          {/* referencia */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Referencia <span className="text-slate-400 font-normal">· opcional</span></label>
            <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Nro de operación bancaria…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-violet-500/40 placeholder:text-slate-400" />
          </div>

          {moneda === 'USD' && montoNum > 0 && (
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              Equivale a <span className="tabular-nums font-semibold text-slate-700">{formatCurrencyPEN(montoNum * tipoCambio)}</span>
              <span className="text-slate-400">· TC {tipoCambio.toFixed(3)}</span>
            </div>
          )}
        </div>
      )}
    </FormModalV2>
  );
}
