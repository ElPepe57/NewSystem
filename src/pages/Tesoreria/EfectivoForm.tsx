import React, { useState } from 'react';
import { AutocompleteInput } from '../../components/common';
import { FormModal, FormField } from '../../design-system';
import type { CuentaCajaFormData, MonedaTesoreria } from '../../types/tesoreria.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onGuardar: (data: CuentaCajaFormData) => void;
  isSubmitting: boolean;
  titularesExistentes: string[];
}

export const EfectivoForm: React.FC<Props> = ({ isOpen, onClose, onGuardar, isSubmitting, titularesExistentes }) => {
  const [nombre, setNombre] = useState('');
  const [titular, setTitular] = useState('');
  const [tipoMoneda, setTipoMoneda] = useState<'pen' | 'usd' | 'bi'>('pen');
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [saldoInicialPEN, setSaldoInicialPEN] = useState(0);
  const [saldoInicialUSD, setSaldoInicialUSD] = useState(0);
  const [saldoMinimo, setSaldoMinimo] = useState<number | undefined>();

  const handleGuardar = () => {
    if (!nombre || !titular.trim()) return;
    const esBiMoneda = tipoMoneda === 'bi';
    const moneda: MonedaTesoreria = tipoMoneda === 'usd' ? 'USD' : 'PEN';
    onGuardar({
      nombre,
      titular: titular.trim(),
      tipo: 'efectivo',
      moneda,
      esBiMoneda,
      saldoInicial: esBiMoneda ? 0 : saldoInicial,
      saldoInicialPEN: esBiMoneda ? saldoInicialPEN : undefined,
      saldoInicialUSD: esBiMoneda ? saldoInicialUSD : undefined,
      saldoMinimo: saldoMinimo || undefined,
      productoFinanciero: 'caja',
      metodosDisponibles: ['efectivo'],
      metodoPagoAsociado: 'efectivo' as any,
    });
  };

  const reset = () => {
    setNombre(''); setTitular(''); setTipoMoneda('pen');
    setSaldoInicial(0); setSaldoInicialPEN(0); setSaldoInicialUSD(0);
    setSaldoMinimo(undefined);
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title="Nueva Caja de Efectivo"
      size="sm"
      variant="create"
      submitLabel="Crear Caja"
      onSubmit={handleGuardar}
      loading={isSubmitting}
      disabled={!nombre || !titular.trim()}
    >
      <FormField label="Nombre" required>
        <input type="text" value={nombre}
          onChange={e => setNombre(e.target.value)}
          className="w-full rounded-lg border-slate-300 text-sm focus:border-teal-500 focus:ring-teal-500"
          placeholder="Ej: Caja Principal, Caja Tienda" />
      </FormField>

      <FormField>
        <AutocompleteInput
          label="Responsable *"
          value={titular}
          onChange={setTitular}
          suggestions={titularesExistentes}
          allowCreate
          createLabel="Usar nuevo responsable"
          placeholder="Buscar o crear responsable"
          required
        />
      </FormField>

      <FormField label="Moneda">
        <div className="flex gap-2">
          {([['pen', 'Solo PEN'], ['usd', 'Solo USD'], ['bi', 'Bi-moneda']] as const).map(([val, lab]) => (
            <button key={val} type="button"
              onClick={() => setTipoMoneda(val)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                tipoMoneda === val ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}>
              {lab}
            </button>
          ))}
        </div>
      </FormField>

      {tipoMoneda === 'bi' ? (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Saldo inicial PEN">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">S/</span>
              <input type="number" step="0.01" value={saldoInicialPEN || ''}
                onChange={e => setSaldoInicialPEN(parseFloat(e.target.value) || 0)}
                className="w-full pl-7 rounded-lg border-slate-300 text-sm focus:border-teal-500 focus:ring-teal-500" placeholder="0.00" />
            </div>
          </FormField>
          <FormField label="Saldo inicial USD">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              <input type="number" step="0.01" value={saldoInicialUSD || ''}
                onChange={e => setSaldoInicialUSD(parseFloat(e.target.value) || 0)}
                className="w-full pl-7 rounded-lg border-slate-300 text-sm focus:border-teal-500 focus:ring-teal-500" placeholder="0.00" />
            </div>
          </FormField>
        </div>
      ) : (
        <FormField label="Saldo inicial">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{tipoMoneda === 'usd' ? '$' : 'S/'}</span>
            <input type="number" step="0.01" value={saldoInicial || ''}
              onChange={e => setSaldoInicial(parseFloat(e.target.value) || 0)}
              className="w-full pl-8 rounded-lg border-slate-300 text-sm focus:border-teal-500 focus:ring-teal-500" placeholder="0.00" />
          </div>
        </FormField>
      )}

      <FormField label="Alerta saldo mínimo" hint="Opcional — recibirás alerta cuando el saldo baje de este monto">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{tipoMoneda === 'usd' ? '$' : 'S/'}</span>
          <input type="number" step="0.01" value={saldoMinimo || ''}
            onChange={e => setSaldoMinimo(parseFloat(e.target.value) || undefined)}
            className="w-full pl-7 rounded-lg border-slate-300 text-sm focus:border-teal-500 focus:ring-teal-500" placeholder="0" />
        </div>
      </FormField>
    </FormModal>
  );
};
