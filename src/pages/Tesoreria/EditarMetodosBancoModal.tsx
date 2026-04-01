import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Modal } from '../../components/common';

const METODOS_PREDEFINIDOS = [
  { id: 'transferencia', label: 'Transferencia bancaria' },
  { id: 'tarjeta_debito', label: 'Tarjeta Débito' },
  { id: 'tarjeta_credito', label: 'Tarjeta Crédito' },
];
// Yape/Plin se configuran por cuenta individual, no a nivel de banco

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bancoNombre: string;
  metodosActuales: string[];
  onGuardar: (metodos: string[]) => void;
  isSubmitting: boolean;
}

export const EditarMetodosBancoModal: React.FC<Props> = ({
  isOpen, onClose, bancoNombre, metodosActuales, onGuardar, isSubmitting,
}) => {
  const [metodos, setMetodos] = useState<string[]>(metodosActuales);
  const [nuevoMetodo, setNuevoMetodo] = useState('');

  useEffect(() => {
    setMetodos(metodosActuales);
  }, [metodosActuales]);

  const predefinidos = METODOS_PREDEFINIDOS.map(m => m.id);
  const customMetodos = metodos.filter(m => !predefinidos.includes(m));

  const toggleMetodo = (id: string) => {
    setMetodos(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const agregarCustom = () => {
    const trimmed = nuevoMetodo.trim().toLowerCase().replace(/\s+/g, '_');
    if (trimmed && !metodos.includes(trimmed)) {
      setMetodos([...metodos, trimmed]);
      setNuevoMetodo('');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Métodos de pago — ${bancoNombre}`} size="sm">
      <p className="text-xs text-gray-500 mb-3">Aplican a todas las cuentas de este banco. Yape/Plin se configuran por cuenta individual.</p>

      <div className="space-y-2 mb-4">
        {METODOS_PREDEFINIDOS.map(m => (
          <label key={m.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
            metodos.includes(m.id) ? 'bg-primary-50 border-primary-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
          }`}>
            <input type="checkbox" checked={metodos.includes(m.id)}
              onChange={() => toggleMetodo(m.id)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span className="text-sm">{m.label}</span>
          </label>
        ))}
      </div>

      {customMetodos.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Personalizados</p>
          <div className="space-y-1">
            {customMetodos.map(m => (
              <div key={m} className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-sm">{m}</span>
                <button type="button" onClick={() => setMetodos(metodos.filter(x => x !== m))}
                  className="p-1 text-gray-400 hover:text-red-500 rounded-full">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <input type="text" value={nuevoMetodo}
          onChange={e => setNuevoMetodo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), agregarCustom())}
          className="flex-1 rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          placeholder="Agregar método personalizado" />
        <Button variant="outline" size="sm" onClick={agregarCustom} disabled={!nuevoMetodo.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={() => onGuardar(metodos)} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </Modal>
  );
};
