import React, { useState } from 'react';
import { Button, Modal, AutocompleteInput } from '../../components/common';
import type { CuentaCajaFormData, MonedaTesoreria } from '../../types/tesoreria.types';

const PLATAFORMAS = [
  { id: 'yape', label: 'Yape' },
  { id: 'plin', label: 'Plin' },
  { id: 'mercado_pago', label: 'Mercado Pago' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'zelle', label: 'Zelle' },
  { id: 'otro', label: 'Otro...' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onGuardar: (data: CuentaCajaFormData) => void;
  isSubmitting: boolean;
  titularesExistentes: string[];
}

export const DigitalForm: React.FC<Props> = ({ isOpen, onClose, onGuardar, isSubmitting, titularesExistentes }) => {
  const [plataforma, setPlataforma] = useState('yape');
  const [nombreCustom, setNombreCustom] = useState('');
  const [nombre, setNombre] = useState('Yape');
  const [titular, setTitular] = useState('');
  const [moneda, setMoneda] = useState<MonedaTesoreria>('PEN');
  const [saldoInicial, setSaldoInicial] = useState(0);

  const handlePlataformaChange = (id: string) => {
    setPlataforma(id);
    if (id !== 'otro') {
      const p = PLATAFORMAS.find(p => p.id === id);
      setNombre(p?.label || '');
    }
    if (id === 'paypal' || id === 'zelle') setMoneda('USD');
    else setMoneda('PEN');
  };

  const handleGuardar = () => {
    const nombreFinal = plataforma === 'otro' ? nombreCustom : nombre;
    if (!nombreFinal || !titular.trim()) return;
    onGuardar({
      nombre: nombreFinal,
      titular: titular.trim(),
      tipo: 'digital',
      moneda,
      esBiMoneda: false,
      saldoInicial,
      productoFinanciero: 'billetera_digital',
      metodosDisponibles: [plataforma === 'otro' ? nombreFinal.toLowerCase().replace(/\s+/g, '_') : plataforma],
      metodoPagoAsociado: plataforma === 'otro' ? undefined : plataforma as any,
    });
  };

  const reset = () => {
    setPlataforma('yape'); setNombreCustom(''); setNombre('Yape');
    setTitular(''); setMoneda('PEN'); setSaldoInicial(0);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Nueva Billetera Digital" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Plataforma</label>
          <div className="grid grid-cols-3 gap-2">
            {PLATAFORMAS.map(p => (
              <button key={p.id} type="button"
                onClick={() => handlePlataformaChange(p.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                  plataforma === p.id ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {plataforma === 'otro' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la plataforma *</label>
            <input type="text" value={nombreCustom}
              onChange={e => setNombreCustom(e.target.value)}
              className="w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Ej: Izipay, Tunki" />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre descriptivo *</label>
          <input type="text" value={plataforma === 'otro' ? nombreCustom : nombre}
            onChange={e => plataforma === 'otro' ? setNombreCustom(e.target.value) : setNombre(e.target.value)}
            className="w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
            placeholder="Ej: Yape Jose" />
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
            <select value={moneda} onChange={e => setMoneda(e.target.value as MonedaTesoreria)}
              className="w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500">
              <option value="PEN">PEN</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Saldo inicial</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{moneda === 'USD' ? '$' : 'S/'}</span>
              <input type="number" step="0.01" value={saldoInicial || ''}
                onChange={e => setSaldoInicial(parseFloat(e.target.value) || 0)}
                className="w-full pl-8 rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="0.00" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button variant="primary" onClick={handleGuardar}
            disabled={isSubmitting || !titular.trim() || (plataforma === 'otro' ? !nombreCustom : !nombre)}>
            {isSubmitting ? 'Creando...' : 'Crear Billetera'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
