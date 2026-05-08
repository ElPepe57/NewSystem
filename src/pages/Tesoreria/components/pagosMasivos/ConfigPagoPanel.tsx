/**
 * ConfigPagoPanel.tsx
 *
 * Panel lateral para configurar cuenta, método, TC y referencia
 * compartidos para todos los pagos del lote.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, CreditCard, Smartphone, Banknote, AlertCircle } from 'lucide-react';
import { Button } from '../../../../components/common';
import { useTesoreriaStore } from '../../../../store/tesoreriaStore';
import { useTipoCambioStore } from '../../../../store/tipoCambioStore';
import { usePagoMasivoStore } from '../../../../store/pagoMasivoStore';
import { METODOS_PAGO_INFO } from '../../../../types/pago.types';
import { formatCurrency } from '../../../../utils/format';
import type { CuentaCaja } from '../../../../types/tesoreria.types';
import type { ConfigPagoMasivo } from '../../../../types/pagoMasivo.types';
import type { MetodoPagoUnificado } from '../../../../types/pago.types';

function getIconoCuenta(tipo: string) {
  switch (tipo) {
    case 'efectivo': return <Banknote size={16} className="text-emerald-600" />;
    case 'digital': return <Smartphone size={16} className="text-purple-600" />;
    case 'credito': return <CreditCard size={16} className="text-amber-600" />;
    default: return <Wallet size={16} className="text-sky-600" />;
  }
}

function getMetodosDisponibles(cuenta: CuentaCaja | undefined): MetodoPagoUnificado[] {
  if (!cuenta) return [];
  const metodos: MetodoPagoUnificado[] = [];
  if (cuenta.metodosDisponibles?.length) {
    metodos.push(...cuenta.metodosDisponibles as MetodoPagoUnificado[]);
  }
  if (cuenta.metodosDetalle) {
    for (const key of Object.keys(cuenta.metodosDetalle)) {
      if (!metodos.includes(key as MetodoPagoUnificado)) {
        metodos.push(key as MetodoPagoUnificado);
      }
    }
  }
  if (metodos.length === 0) {
    if (cuenta.tipo === 'efectivo') metodos.push('efectivo');
    else if (cuenta.tipo === 'banco') metodos.push('transferencia');
    else if (cuenta.tipo === 'digital') metodos.push('otro');
  }
  return metodos;
}

interface ConfigPagoPanelProps {
  onProcesar: (config: ConfigPagoMasivo) => void;
  loading: boolean;
}

export const ConfigPagoPanel: React.FC<ConfigPagoPanelProps> = ({ onProcesar, loading }) => {
  const { cuentas, fetchCuentas } = useTesoreriaStore();
  const { getTCDelDia } = useTipoCambioStore();
  const { seleccionados } = usePagoMasivoStore();

  const [monedaPago, setMonedaPago] = useState<'PEN' | 'USD'>('PEN');
  const [cuentaId, setCuentaId] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPagoUnificado>('transferencia');
  const [tipoCambio, setTipoCambio] = useState(3.7);
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (cuentas.length === 0) fetchCuentas();
    getTCDelDia().then(tc => { if (tc) setTipoCambio(tc.venta); });
  }, []);

  const cuentasFiltradas = useMemo(() =>
    cuentas.filter((c) => c.activa !== false),
    [cuentas]
  );

  const cuentaSeleccionada = useMemo(() =>
    cuentasFiltradas.find((c) => c.id === cuentaId),
    [cuentasFiltradas, cuentaId]
  );

  const metodosDisponibles = useMemo(() =>
    getMetodosDisponibles(cuentaSeleccionada),
    [cuentaSeleccionada]
  );

  useEffect(() => {
    if (cuentaSeleccionada && metodosDisponibles.length > 0 && !metodosDisponibles.includes(metodoPago)) {
      setMetodoPago(metodosDisponibles[0]);
    }
  }, [cuentaSeleccionada, metodosDisponibles]);

  // Auto-seleccionar primera cuenta
  useEffect(() => {
    if (!cuentaId && cuentasFiltradas.length > 0) {
      setCuentaId(cuentasFiltradas[0].id);
    }
  }, [cuentasFiltradas]);

  const totalSeleccionado = useMemo(() => {
    let pen = 0, usd = 0;
    for (const item of seleccionados.values()) {
      if (item.monedaDocumento === 'PEN') pen += item.montoPagar;
      else usd += item.montoPagar;
    }
    return { pen, usd, count: seleccionados.size };
  }, [seleccionados]);

  const handleProcesar = () => {
    if (!cuentaId || seleccionados.size === 0) return;
    onProcesar({
      monedaPago,
      tipoCambio,
      metodoPago,
      cuentaId,
      cuentaNombre: cuentaSeleccionada?.nombre || '',
      referencia,
      notas,
      fechaPago,
    });
  };

  const metodoInfo = METODOS_PAGO_INFO[metodoPago];

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4 sticky top-4">
      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
        <Wallet size={18} />
        Configuracion del pago
      </h3>

      {/* Fecha */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de pago</label>
        <input
          type="date"
          value={fechaPago}
          onChange={(e) => setFechaPago(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Moneda */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Moneda de pago</label>
        <div className="flex gap-2">
          {(['PEN', 'USD'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonedaPago(m)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                monedaPago === m
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {m === 'PEN' ? 'S/ Soles' : '$ Dolares'}
            </button>
          ))}
        </div>
      </div>

      {/* Tipo de cambio */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de cambio</label>
        <input
          type="number"
          value={tipoCambio}
          onChange={(e) => setTipoCambio(parseFloat(e.target.value) || 0)}
          step="0.01"
          min="0.01"
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Cuenta */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Cuenta</label>
        <select
          value={cuentaId}
          onChange={(e) => setCuentaId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
        >
          <option value="">Seleccionar cuenta...</option>
          {cuentasFiltradas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} ({formatCurrency(c.saldoActual, c.moneda || 'PEN')})
            </option>
          ))}
        </select>
        {cuentaSeleccionada && (
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            {getIconoCuenta(cuentaSeleccionada.tipo)}
            <span>{cuentaSeleccionada.tipo} — {cuentaSeleccionada.banco || 'Sin banco'}</span>
          </div>
        )}
      </div>

      {/* Metodo */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Metodo de pago</label>
        <select
          value={metodoPago}
          onChange={(e) => setMetodoPago(e.target.value as MetodoPagoUnificado)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
        >
          {metodosDisponibles.map((m) => (
            <option key={m} value={m}>{METODOS_PAGO_INFO[m]?.label || m}</option>
          ))}
        </select>
      </div>

      {/* Referencia */}
      {metodoInfo?.requiereReferencia && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Referencia / Nro. operacion</label>
          <input
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Ej: OP-123456"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
          />
        </div>
      )}

      {/* Notas */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notas (opcional)</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Notas del lote..."
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Resumen */}
      <div className="border-t pt-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Documentos:</span>
          <span className="font-semibold">{totalSeleccionado.count}</span>
        </div>
        {totalSeleccionado.pen > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Total PEN:</span>
            <span className="font-semibold font-mono">{formatCurrency(totalSeleccionado.pen, 'PEN')}</span>
          </div>
        )}
        {totalSeleccionado.usd > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Total USD:</span>
            <span className="font-semibold font-mono">{formatCurrency(totalSeleccionado.usd, 'USD')}</span>
          </div>
        )}
      </div>

      {/* Boton procesar */}
      <Button
        onClick={handleProcesar}
        disabled={seleccionados.size === 0 || !cuentaId || loading}
        className="w-full"
        variant="primary"
      >
        {loading ? 'Procesando...' : `Procesar ${totalSeleccionado.count} pago${totalSeleccionado.count !== 1 ? 's' : ''}`}
      </Button>

      {seleccionados.size === 0 && (
        <p className="text-xs text-slate-400 flex items-center gap-1">
          <AlertCircle size={12} /> Selecciona documentos de la tabla
        </p>
      )}
    </div>
  );
};
