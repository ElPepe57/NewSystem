import React from 'react';
import {
  FileText,
  Building2,
  Wallet,
  CreditCard,
  TrendingUp,
  Plus,
  Trash2,
  User,
  Star,
} from 'lucide-react';
import { Button, FormSection } from '../../components/common';
import type {
  CuentaCaja,
  CuentaCajaFormData,
  MonedaTesoreria,
  NumeroCuentaBancaria,
} from '../../types/tesoreria.types';

interface CuentaCajaFormProps {
  cuentaForm: Partial<CuentaCajaFormData>;
  setCuentaForm: React.Dispatch<React.SetStateAction<Partial<CuentaCajaFormData>>>;
  cuentaEditando: CuentaCaja | null;
  cuentas: CuentaCaja[];
  isSubmitting: boolean;
  onGuardar: () => void;
  onCancelar: () => void;
}

// ===== Helpers =====

const TIPO_NUMERO_LABELS: Record<NumeroCuentaBancaria['tipo'], string> = {
  ahorros: 'Ahorros',
  corriente: 'Corriente',
  cci: 'CCI',
  swift: 'SWIFT',
  iban: 'IBAN',
  otro: 'Otro',
};

function getMetodosOpciones(tipo?: string, banco?: string, nombre?: string) {
  const opciones: { id: string; label: string }[] = [];
  if (tipo === 'efectivo') opciones.push({ id: 'efectivo', label: 'Efectivo' });
  if (tipo === 'banco') {
    opciones.push({ id: 'transferencia', label: 'Transferencia' });
    const b = (banco || '').toUpperCase();
    if (b.includes('BCP')) opciones.push({ id: 'yape', label: 'Yape' });
    if (b.includes('INTERBANK') || b.includes('IBK')) opciones.push({ id: 'plin', label: 'Plin' });
  }
  if (tipo === 'digital') {
    const n = (nombre || '').toLowerCase();
    if (n.includes('mercado')) opciones.push({ id: 'mercado_pago', label: 'Mercado Pago' });
    else if (n.includes('paypal')) opciones.push({ id: 'paypal', label: 'PayPal' });
    else if (n.includes('zelle')) opciones.push({ id: 'zelle', label: 'Zelle' });
    else opciones.push({ id: 'otro', label: 'Otro' });
  }
  if (tipo === 'credito') {
    opciones.push({ id: 'tarjeta_credito', label: 'Tarjeta Crédito' });
    opciones.push({ id: 'tarjeta_debito', label: 'Tarjeta Débito' });
  }
  return opciones;
}

function getProductoOpciones(tipo?: string) {
  switch (tipo) {
    case 'efectivo': return [{ value: 'caja', label: 'Caja' }];
    case 'banco': return [
      { value: 'cuenta_ahorros', label: 'Cuenta de Ahorros' },
      { value: 'cuenta_corriente', label: 'Cuenta Corriente' },
    ];
    case 'credito': return [
      { value: 'tarjeta_credito', label: 'Tarjeta de Crédito' },
      { value: 'tarjeta_debito', label: 'Tarjeta de Débito' },
    ];
    case 'digital': return [{ value: 'billetera_digital', label: 'Billetera Digital' }];
    default: return [];
  }
}

// ===== Input helpers =====

const inputClass = 'w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';
const smallInputClass = 'w-full px-3 py-2 rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500';

// ===== Component =====

export const CuentaCajaForm: React.FC<CuentaCajaFormProps> = ({
  cuentaForm,
  setCuentaForm,
  cuentaEditando,
  cuentas,
  isSubmitting,
  onGuardar,
  onCancelar,
}) => {
  const esBanco = cuentaForm.tipo === 'banco' || cuentaForm.tipo === 'credito';
  const esCredito = cuentaForm.productoFinanciero === 'tarjeta_credito' || cuentaForm.tipo === 'credito';
  const numerosCuenta = cuentaForm.numerosCuenta || [];
  const metodosSeleccionados = cuentaForm.metodosDisponibles || [];

  // ===== Handlers para números de cuenta =====

  const agregarNumeroCuenta = () => {
    const nuevo: NumeroCuentaBancaria = {
      id: crypto.randomUUID(),
      tipo: 'ahorros',
      numero: '',
      esPrincipal: numerosCuenta.length === 0,
    };
    setCuentaForm({ ...cuentaForm, numerosCuenta: [...numerosCuenta, nuevo] });
  };

  const actualizarNumeroCuenta = (id: string, cambios: Partial<NumeroCuentaBancaria>) => {
    const nuevos = numerosCuenta.map(n => {
      if (n.id !== id) return cambios.esPrincipal ? { ...n, esPrincipal: false } : n;
      return { ...n, ...cambios };
    });
    setCuentaForm({ ...cuentaForm, numerosCuenta: nuevos });
  };

  const eliminarNumeroCuenta = (id: string) => {
    let nuevos = numerosCuenta.filter(n => n.id !== id);
    if (nuevos.length > 0 && !nuevos.some(n => n.esPrincipal)) {
      nuevos = [{ ...nuevos[0], esPrincipal: true }, ...nuevos.slice(1)];
    }
    setCuentaForm({ ...cuentaForm, numerosCuenta: nuevos });
  };

  // ===== Contadores para badges =====

  const bancariosCampos = [cuentaForm.banco, cuentaForm.productoFinanciero].filter(Boolean).length + numerosCuenta.length;

  return (
    <div className="space-y-3">
      {/* ========== SECCIÓN 1: Información General ========== */}
      <FormSection
        title="Información General"
        icon={<FileText className="h-4 w-4" />}
        defaultOpen={true}
        badge={
          cuentaForm.nombre && cuentaForm.titular?.trim() ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">OK</span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Requerido</span>
          )
        }
      >
        <div>
          <label className={labelClass}>Nombre de la Cuenta *</label>
          <input
            type="text"
            value={cuentaForm.nombre || ''}
            onChange={(e) => setCuentaForm({ ...cuentaForm, nombre: e.target.value })}
            className={inputClass}
            placeholder="Ej: Caja PEN, Cuenta USD BCP"
          />
        </div>

        <div>
          <label className={labelClass}>
            <User className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
            Titular *
          </label>
          <input
            type="text"
            value={cuentaForm.titular || ''}
            onChange={(e) => setCuentaForm({ ...cuentaForm, titular: e.target.value })}
            className={inputClass}
            placeholder="Nombre completo del titular"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Tipo</label>
            <select
              value={cuentaForm.tipo || 'efectivo'}
              onChange={(e) => setCuentaForm({ ...cuentaForm, tipo: e.target.value as any, productoFinanciero: undefined, metodosDisponibles: [] })}
              className={inputClass}
            >
              <option value="efectivo">Efectivo</option>
              <option value="banco">Banco</option>
              <option value="digital">Digital (Yape/Plin)</option>
              <option value="credito">Crédito (TC / Préstamo)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{cuentaForm.esBiMoneda ? 'Moneda Principal' : 'Moneda'}</label>
            <select
              value={cuentaForm.moneda || 'PEN'}
              onChange={(e) => setCuentaForm({ ...cuentaForm, moneda: e.target.value as MonedaTesoreria })}
              className={inputClass}
              disabled={!!cuentaEditando}
            >
              <option value="PEN">PEN (Soles)</option>
              <option value="USD">USD (Dólares)</option>
            </select>
          </div>
        </div>

        {/* Toggle Bi-Moneda */}
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-gray-200">
          <div>
            <span className="text-sm font-medium text-gray-700">Cuenta Bi-Moneda</span>
            <p className="text-xs text-gray-500">Maneja USD y PEN en la misma cuenta</p>
          </div>
          <button
            type="button"
            onClick={() => setCuentaForm({ ...cuentaForm, esBiMoneda: !cuentaForm.esBiMoneda })}
            disabled={!!cuentaEditando}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
              cuentaForm.esBiMoneda ? 'bg-primary-600' : 'bg-gray-200'
            } ${cuentaEditando ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              cuentaForm.esBiMoneda ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        <div>
          <label className={labelClass}>Titularidad</label>
          <select
            value={cuentaForm.titularidad || ''}
            onChange={(e) => setCuentaForm({ ...cuentaForm, titularidad: e.target.value as any })}
            className={inputClass}
          >
            <option value="">Seleccionar...</option>
            <option value="empresa">Empresa</option>
            <option value="personal">Personal</option>
          </select>
        </div>
      </FormSection>

      {/* ========== SECCIÓN 2: Datos Bancarios ========== */}
      {esBanco && (
        <FormSection
          title="Datos Bancarios"
          icon={<Building2 className="h-4 w-4" />}
          defaultOpen={true}
          badge={
            bancariosCampos > 0 ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{bancariosCampos}</span>
            ) : undefined
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Banco</label>
              <input
                type="text"
                value={cuentaForm.banco || ''}
                onChange={(e) => setCuentaForm({ ...cuentaForm, banco: e.target.value })}
                className={inputClass}
                placeholder="Ej: BCP, Interbank"
              />
            </div>
            <div>
              <label className={labelClass}>Producto Financiero</label>
              <select
                value={cuentaForm.productoFinanciero || ''}
                onChange={(e) => setCuentaForm({ ...cuentaForm, productoFinanciero: e.target.value as any })}
                className={inputClass}
              >
                <option value="">Seleccionar...</option>
                {getProductoOpciones(cuentaForm.tipo).map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cuenta vinculada (solo para tarjeta débito) */}
          {cuentaForm.productoFinanciero === 'tarjeta_debito' && (
            <div>
              <label className={labelClass}>Cuenta Vinculada (origen de fondos)</label>
              <select
                value={cuentaForm.cuentaVinculadaId || ''}
                onChange={(e) => setCuentaForm({ ...cuentaForm, cuentaVinculadaId: e.target.value })}
                className={inputClass}
              >
                <option value="">Sin vincular</option>
                {cuentas
                  .filter(c => c.activa && c.tipo === 'banco' && c.id !== cuentaEditando?.id)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} {c.banco ? `(${c.banco})` : ''}</option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Cuenta de ahorros de donde se descuenta al usar esta tarjeta</p>
            </div>
          )}

          {/* Números de cuenta (array dinámico) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass + ' mb-0'}>Números de Cuenta</label>
              <button
                type="button"
                onClick={agregarNumeroCuenta}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </button>
            </div>

            {numerosCuenta.length === 0 ? (
              <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-xs text-gray-400">Sin números de cuenta</p>
                <button
                  type="button"
                  onClick={agregarNumeroCuenta}
                  className="mt-1 text-xs text-primary-600 hover:underline"
                >
                  + Agregar primer número
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {numerosCuenta.map((num) => (
                  <div key={num.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                    num.esPrincipal ? 'bg-primary-50/50 border-primary-200' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <select
                      value={num.tipo}
                      onChange={(e) => actualizarNumeroCuenta(num.id, { tipo: e.target.value as NumeroCuentaBancaria['tipo'] })}
                      className="rounded-md border-gray-300 text-xs py-1.5 px-2 w-24 flex-shrink-0 focus:border-primary-500 focus:ring-primary-500"
                    >
                      {Object.entries(TIPO_NUMERO_LABELS).map(([val, lab]) => (
                        <option key={val} value={val}>{lab}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={num.numero}
                      onChange={(e) => actualizarNumeroCuenta(num.id, { numero: e.target.value })}
                      className="flex-1 rounded-md border-gray-300 text-sm py-1.5 px-2 focus:border-primary-500 focus:ring-primary-500"
                      placeholder="Número de cuenta"
                    />

                    <input
                      type="text"
                      value={num.etiqueta || ''}
                      onChange={(e) => actualizarNumeroCuenta(num.id, { etiqueta: e.target.value })}
                      className="w-24 rounded-md border-gray-300 text-xs py-1.5 px-2 focus:border-primary-500 focus:ring-primary-500 hidden sm:block"
                      placeholder="Etiqueta"
                    />

                    <button
                      type="button"
                      onClick={() => actualizarNumeroCuenta(num.id, { esPrincipal: true })}
                      className={`p-1.5 rounded-full flex-shrink-0 transition-colors ${
                        num.esPrincipal
                          ? 'text-amber-500 bg-amber-50'
                          : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'
                      }`}
                      title={num.esPrincipal ? 'Principal' : 'Marcar como principal'}
                    >
                      <Star className="h-3.5 w-3.5" fill={num.esPrincipal ? 'currentColor' : 'none'} />
                    </button>

                    <button
                      type="button"
                      onClick={() => eliminarNumeroCuenta(num.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full flex-shrink-0 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormSection>
      )}

      {/* ========== SECCIÓN 3: Métodos de Pago ========== */}
      <FormSection
        title="Métodos de Pago"
        icon={<Wallet className="h-4 w-4" />}
        defaultOpen={!cuentaEditando}
        badge={
          metodosSeleccionados.length > 0 ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">{metodosSeleccionados.length}</span>
          ) : undefined
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {getMetodosOpciones(cuentaForm.tipo, cuentaForm.banco, cuentaForm.nombre).map(op => (
            <label key={op.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
              metodosSeleccionados.includes(op.id) ? 'bg-primary-50 border-primary-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}>
              <input
                type="checkbox"
                checked={metodosSeleccionados.includes(op.id)}
                onChange={(e) => {
                  const nuevos = e.target.checked
                    ? [...metodosSeleccionados, op.id]
                    : metodosSeleccionados.filter(m => m !== op.id);
                  setCuentaForm({ ...cuentaForm, metodosDisponibles: nuevos });
                }}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm">{op.label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-500">Estos métodos aparecerán al registrar pagos desde esta cuenta</p>

        {/* Cuenta por defecto */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            checked={cuentaForm.esCuentaPorDefecto || false}
            onChange={(e) => setCuentaForm({ ...cuentaForm, esCuentaPorDefecto: e.target.checked })}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700">Usar como cuenta por defecto</span>
        </div>
      </FormSection>

      {/* ========== SECCIÓN 4: Línea de Crédito ========== */}
      {esCredito && (
        <FormSection
          title="Línea de Crédito"
          icon={<CreditCard className="h-4 w-4" />}
          defaultOpen={true}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Límite</label>
              <input type="number" step="0.01" placeholder="0.00"
                value={cuentaForm.lineaCreditoLimite || ''}
                onChange={(e) => setCuentaForm({ ...cuentaForm, lineaCreditoLimite: +e.target.value })}
                className={smallInputClass} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tasa anual (%)</label>
              <input type="number" step="0.1" placeholder="0.0"
                value={cuentaForm.lineaCreditoTasa || ''}
                onChange={(e) => setCuentaForm({ ...cuentaForm, lineaCreditoTasa: +e.target.value })}
                className={smallInputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Día de corte</label>
              <input type="number" min="1" max="28" placeholder="15"
                value={cuentaForm.lineaCreditoFechaCorte || ''}
                onChange={(e) => setCuentaForm({ ...cuentaForm, lineaCreditoFechaCorte: +e.target.value })}
                className={smallInputClass} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Día de pago</label>
              <input type="number" min="1" max="28" placeholder="5"
                value={cuentaForm.lineaCreditoFechaPago || ''}
                onChange={(e) => setCuentaForm({ ...cuentaForm, lineaCreditoFechaPago: +e.target.value })}
                className={smallInputClass} />
            </div>
          </div>

          {/* Mostrar utilizado/disponible en edición */}
          {cuentaEditando?.lineaCredito && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/50 rounded-lg">
              <div className="text-center">
                <span className="text-xs text-gray-500">Utilizado</span>
                <p className="text-sm font-bold text-amber-700">
                  {cuentaEditando.moneda === 'USD' ? '$' : 'S/'} {(cuentaEditando.lineaCredito.utilizado || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-center">
                <span className="text-xs text-gray-500">Disponible</span>
                <p className="text-sm font-bold text-green-600">
                  {cuentaEditando.moneda === 'USD' ? '$' : 'S/'} {(cuentaEditando.lineaCredito.disponible || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}
        </FormSection>
      )}

      {/* ========== SECCIÓN 5: Saldos ========== */}
      <FormSection
        title="Saldos"
        icon={<TrendingUp className="h-4 w-4" />}
        defaultOpen={!cuentaEditando}
      >
        {!cuentaEditando ? (
          // Creación: saldos iniciales
          cuentaForm.esBiMoneda ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Saldo Inicial PEN</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">S/</span>
                  <input type="number" step="0.01"
                    value={cuentaForm.saldoInicialPEN || ''}
                    onChange={(e) => setCuentaForm({ ...cuentaForm, saldoInicialPEN: parseFloat(e.target.value) })}
                    className={inputClass + ' pl-8'} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Saldo Inicial USD</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input type="number" step="0.01"
                    value={cuentaForm.saldoInicialUSD || ''}
                    onChange={(e) => setCuentaForm({ ...cuentaForm, saldoInicialUSD: parseFloat(e.target.value) })}
                    className={inputClass + ' pl-8'} placeholder="0.00" />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className={labelClass}>Saldo Inicial</label>
              <input type="number" step="0.01"
                value={cuentaForm.saldoInicial || ''}
                onChange={(e) => setCuentaForm({ ...cuentaForm, saldoInicial: parseFloat(e.target.value) })}
                className={inputClass} placeholder="0.00" />
            </div>
          )
        ) : (
          // Edición: saldos actuales read-only
          cuentaForm.esBiMoneda ? (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <span className="text-xs text-gray-500">PEN</span>
                  <p className="text-xl font-bold text-green-600">
                    S/ {(cuentaForm.saldoInicialPEN || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-xs text-gray-500">USD</span>
                  <p className="text-xl font-bold text-blue-600">
                    $ {(cuentaForm.saldoInicialUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">Los saldos solo se modifican mediante movimientos</p>
            </div>
          ) : (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Saldo actual:</span>{' '}
                <span className="text-lg font-bold text-gray-900">
                  {cuentaForm.moneda === 'PEN' ? 'S/ ' : '$ '}
                  {cuentaForm.saldoInicial?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-1">El saldo solo se modifica mediante movimientos</p>
            </div>
          )
        )}

        {/* Saldos mínimos (editables siempre) */}
        <div className="pt-2 border-t border-gray-100">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Alerta de saldo mínimo</label>
          {cuentaForm.esBiMoneda ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Mínimo PEN</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">S/</span>
                  <input type="number" step="0.01"
                    value={cuentaForm.saldoMinimoPEN || ''}
                    onChange={(e) => setCuentaForm({ ...cuentaForm, saldoMinimoPEN: parseFloat(e.target.value) })}
                    className={smallInputClass + ' pl-7'} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Mínimo USD</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                  <input type="number" step="0.01"
                    value={cuentaForm.saldoMinimoUSD || ''}
                    onChange={(e) => setCuentaForm({ ...cuentaForm, saldoMinimoUSD: parseFloat(e.target.value) })}
                    className={smallInputClass + ' pl-7'} placeholder="0" />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">
                  {cuentaForm.moneda === 'USD' ? '$' : 'S/'}
                </span>
                <input type="number" step="0.01"
                  value={cuentaForm.saldoMinimo || ''}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, saldoMinimo: parseFloat(e.target.value) })}
                  className={smallInputClass + ' pl-7'} placeholder="0" />
              </div>
            </div>
          )}
        </div>
      </FormSection>

      {/* ========== Botones ========== */}
      <div className="flex justify-end space-x-3 pt-2">
        <Button variant="ghost" onClick={onCancelar}>Cancelar</Button>
        <Button
          variant="primary"
          onClick={onGuardar}
          disabled={isSubmitting || !cuentaForm.nombre || !cuentaForm.titular?.trim()}
        >
          {isSubmitting ? 'Guardando...' : cuentaEditando ? 'Guardar Cambios' : 'Crear Cuenta'}
        </Button>
      </div>
    </div>
  );
};
