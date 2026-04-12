import React, { useState } from 'react';
import { Building2, CreditCard, Plus } from 'lucide-react';
import { Button, FormSection, AutocompleteInput } from '../../components/common';
import { FormModal, FormField } from '../../design-system';
import type { CuentaCajaFormData, MonedaTesoreria } from '../../types/tesoreria.types';

const METODOS_BANCO = [
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'tarjeta_debito', label: 'Tarjeta Débito' },
  { id: 'tarjeta_credito', label: 'Tarjeta Crédito' },
];
// Yape/Plin se configuran por cuenta individual, no a nivel de banco

const PRODUCTOS_BANCO = [
  { value: 'cuenta_ahorros', label: 'Cuenta de Ahorros' },
  { value: 'cuenta_corriente', label: 'Cuenta Corriente' },
  { value: 'tarjeta_credito', label: 'Tarjeta de Crédito' },
  { value: 'tarjeta_debito', label: 'Tarjeta de Débito' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onGuardar: (data: CuentaCajaFormData) => void;
  isSubmitting: boolean;
  titularesExistentes: string[];
}

export const BancoNuevoForm: React.FC<Props> = ({ isOpen, onClose, onGuardar, isSubmitting, titularesExistentes }) => {
  // Banco
  const [bancoAlias, setBancoAlias] = useState('');
  const [bancoNombre, setBancoNombre] = useState('');
  const [metodos, setMetodos] = useState<string[]>(['transferencia']);
  const [nuevoMetodo, setNuevoMetodo] = useState('');

  // Primera cuenta
  const [nombre, setNombre] = useState('');
  const [titular, setTitular] = useState('');
  const [titularidad, setTitularidad] = useState<'empresa' | 'personal'>('empresa');
  const [producto, setProducto] = useState('cuenta_ahorros');
  const [moneda, setMoneda] = useState<MonedaTesoreria>('PEN');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [cci, setCci] = useState('');
  const [saldoInicial, setSaldoInicial] = useState(0);
  // Línea de crédito
  const [lineaLimite, setLineaLimite] = useState(0);
  const [lineaTasa, setLineaTasa] = useState(0);
  const [lineaCorte, setLineaCorte] = useState(0);
  const [lineaPago, setLineaPago] = useState(0);

  const esCredito = producto === 'tarjeta_credito';
  const tipo = esCredito ? 'credito' as const : 'banco' as const;

  const toggleMetodo = (id: string) => {
    setMetodos(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const agregarCustomMetodo = () => {
    const trimmed = nuevoMetodo.trim().toLowerCase().replace(/\s+/g, '_');
    if (trimmed && !metodos.includes(trimmed)) {
      setMetodos([...metodos, trimmed]);
      setNuevoMetodo('');
    }
  };

  const handleGuardar = () => {
    if (!bancoAlias.trim() || !nombre || !titular.trim()) return;
    onGuardar({
      nombre,
      titular: titular.trim(),
      tipo,
      banco: bancoAlias.trim(),
      bancoNombreCompleto: bancoNombre.trim() || undefined,
      moneda,
      esBiMoneda: false,
      saldoInicial,
      numeroCuenta: numeroCuenta || undefined,
      cci: cci || undefined,
      productoFinanciero: producto as any,
      titularidad,
      metodosDisponibles: metodos,
      lineaCreditoLimite: esCredito ? lineaLimite : undefined,
      lineaCreditoTasa: esCredito ? lineaTasa : undefined,
      lineaCreditoFechaCorte: esCredito ? lineaCorte : undefined,
      lineaCreditoFechaPago: esCredito ? lineaPago : undefined,
    });
  };

  const reset = () => {
    setBancoAlias(''); setBancoNombre(''); setMetodos(['transferencia']); setNuevoMetodo('');
    setNombre(''); setTitular(''); setTitularidad('empresa'); setProducto('cuenta_ahorros');
    setMoneda('PEN'); setNumeroCuenta(''); setCci(''); setSaldoInicial(0);
    setLineaLimite(0); setLineaTasa(0); setLineaCorte(0); setLineaPago(0);
  };

  const ic = 'w-full rounded-md border-slate-300 text-sm focus:border-teal-500 focus:ring-teal-500';

  return (
    <FormModal
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title="Nuevo Banco"
      size="lg"
      variant="create"
      submitLabel="Crear Banco"
      onSubmit={handleGuardar}
      loading={isSubmitting}
      disabled={!bancoAlias.trim() || !nombre || !titular.trim()}
    >
      <div className="space-y-3">
        {/* Sección 1: Datos del Banco */}
        <FormSection title="Datos del Banco" icon={<Building2 className="h-4 w-4" />} defaultOpen>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Alias" required hint="Nombre corto para identificar">
              <input type="text" value={bancoAlias}
                onChange={e => setBancoAlias(e.target.value)}
                className={ic} placeholder="BCP, IBK, BBVA" />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Nombre Completo">
                <input type="text" value={bancoNombre}
                  onChange={e => setBancoNombre(e.target.value)}
                  className={ic} placeholder="Banco de Crédito del Perú (opcional)" />
              </FormField>
            </div>
          </div>

          <FormField label="Métodos de pago">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {METODOS_BANCO.map(m => (
                <label key={m.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                  metodos.includes(m.id) ? 'bg-teal-50 border-teal-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}>
                  <input type="checkbox" checked={metodos.includes(m.id)}
                    onChange={() => toggleMetodo(m.id)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input type="text" value={nuevoMetodo}
                onChange={e => setNuevoMetodo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), agregarCustomMetodo())}
                className={ic} placeholder="Método personalizado" />
              <Button variant="outline" size="sm" onClick={agregarCustomMetodo} disabled={!nuevoMetodo.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </FormField>
        </FormSection>

        {/* Sección 2: Primera Cuenta */}
        <FormSection title="Primera Cuenta" icon={<CreditCard className="h-4 w-4" />} defaultOpen>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre de la cuenta *</label>
              <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                className={ic} placeholder="Ej: Cuenta Ahorros PEN" />
            </div>
            <div>
              <AutocompleteInput
                label="Titular *"
                value={titular}
                onChange={setTitular}
                suggestions={titularesExistentes}
                allowCreate
                createLabel="Usar nuevo titular"
                placeholder="Buscar o crear titular"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Producto</label>
              <select value={producto} onChange={e => setProducto(e.target.value)} className={ic}>
                {PRODUCTOS_BANCO.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Moneda</label>
              <select value={moneda} onChange={e => setMoneda(e.target.value as MonedaTesoreria)} className={ic}>
                <option value="PEN">PEN (Soles)</option>
                <option value="USD">USD (Dólares)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Titularidad</label>
              <select value={titularidad} onChange={e => setTitularidad(e.target.value as any)} className={ic}>
                <option value="empresa">Empresa</option>
                <option value="personal">Personal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Número de cuenta</label>
              <input type="text" value={numeroCuenta}
                onChange={e => setNumeroCuenta(e.target.value)}
                className={ic} placeholder="Ej: 191-12345678-0-01" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">CCI (opcional)</label>
              <input type="text" value={cci}
                onChange={e => setCci(e.target.value)}
                className={ic} placeholder="Código interbancario" />
            </div>
          </div>

          {/* Saldo inicial */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Saldo inicial</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{moneda === 'USD' ? '$' : 'S/'}</span>
              <input type="number" step="0.01" value={saldoInicial || ''}
                onChange={e => setSaldoInicial(parseFloat(e.target.value) || 0)}
                className={ic + ' pl-8'} placeholder="0.00" />
            </div>
          </div>

          {/* Línea de crédito */}
          {esCredito && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
              <h4 className="text-sm font-medium text-amber-800">Línea de Crédito</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Límite</label>
                  <input type="number" step="0.01" value={lineaLimite || ''}
                    onChange={e => setLineaLimite(+e.target.value)}
                    className="w-full px-3 py-2 rounded-md border-slate-300 text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Tasa anual (%)</label>
                  <input type="number" step="0.1" value={lineaTasa || ''}
                    onChange={e => setLineaTasa(+e.target.value)}
                    className="w-full px-3 py-2 rounded-md border-slate-300 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Día corte</label>
                  <input type="number" min="1" max="28" value={lineaCorte || ''}
                    onChange={e => setLineaCorte(+e.target.value)}
                    className="w-full px-3 py-2 rounded-md border-slate-300 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Día pago</label>
                  <input type="number" min="1" max="28" value={lineaPago || ''}
                    onChange={e => setLineaPago(+e.target.value)}
                    className="w-full px-3 py-2 rounded-md border-slate-300 text-sm" />
                </div>
              </div>
            </div>
          )}
        </FormSection>

      </div>
    </FormModal>
  );
};
