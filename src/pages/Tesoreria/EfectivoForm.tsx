import React, { useState } from 'react';
import { Button, Modal, AutocompleteInput } from '../../components/common';
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
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Nueva Caja de Efectivo" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
          <input type="text" value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
            placeholder="Ej: Caja Principal, Caja Tienda" />
        </div>

        <div>
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
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Moneda</label>
          <div className="flex gap-2">
            {([['pen', 'Solo PEN'], ['usd', 'Solo USD'], ['bi', 'Bi-moneda']] as const).map(([val, lab]) => (
              <button key={val} type="button"
                onClick={() => setTipoMoneda(val)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                  tipoMoneda === val ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                }`}>
                {lab}
              </button>
            ))}
          </div>
        </div>

        {tipoMoneda === 'bi' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Saldo inicial PEN</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">S/</span>
                <input type="number" step="0.01" value={saldoInicialPEN || ''}
                  onChange={e => setSaldoInicialPEN(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500" placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Saldo inicial USD</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                <input type="number" step="0.01" value={saldoInicialUSD || ''}
                  onChange={e => setSaldoInicialUSD(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500" placeholder="0.00" />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Saldo inicial</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{tipoMoneda === 'usd' ? '$' : 'S/'}</span>
              <input type="number" step="0.01" value={saldoInicial || ''}
                onChange={e => setSaldoInicial(parseFloat(e.target.value) || 0)}
                className="w-full pl-8 rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500" placeholder="0.00" />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-600 mb-1">Alerta saldo mínimo (opcional)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">{tipoMoneda === 'usd' ? '$' : 'S/'}</span>
            <input type="number" step="0.01" value={saldoMinimo || ''}
              onChange={e => setSaldoMinimo(parseFloat(e.target.value) || undefined)}
              className="w-full pl-7 rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500" placeholder="0" />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button variant="primary" onClick={handleGuardar}
            disabled={isSubmitting || !nombre || !titular.trim()}>
            {isSubmitting ? 'Creando...' : 'Crear Caja'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
