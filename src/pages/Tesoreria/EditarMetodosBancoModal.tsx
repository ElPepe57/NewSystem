import React, { useState, useEffect } from 'react';
import { Plus, X, Phone } from 'lucide-react';
import { Button, Modal } from '../../components/common';
import type { CuentaCaja } from '../../types/tesoreria.types';

const METODOS_PREDEFINIDOS = [
  { id: 'transferencia', label: 'Transferencia bancaria', esCanal: false },
  { id: 'yape', label: 'Yape', esCanal: true },
  { id: 'plin', label: 'Plin', esCanal: true },
  { id: 'tarjeta_debito', label: 'Tarjeta Débito', esCanal: false },
  { id: 'tarjeta_credito', label: 'Tarjeta Crédito', esCanal: false },
];

// Métodos que son canales digitales vinculados (no tienen saldo propio)
const CANALES_DIGITALES = ['yape', 'plin'];

interface MetodoDetalle {
  identificador?: string;
  cuentaVinculadaId?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bancoNombre: string;
  metodosActuales: string[];
  metodosDetalleActuales?: Record<string, MetodoDetalle>;
  cuentasBanco: CuentaCaja[];
  onGuardar: (metodos: string[], detalle: Record<string, MetodoDetalle>) => void;
  isSubmitting: boolean;
}

export const EditarMetodosBancoModal: React.FC<Props> = ({
  isOpen, onClose, bancoNombre, metodosActuales, metodosDetalleActuales,
  cuentasBanco, onGuardar, isSubmitting,
}) => {
  const [metodos, setMetodos] = useState<string[]>(metodosActuales);
  const [detalle, setDetalle] = useState<Record<string, MetodoDetalle>>(metodosDetalleActuales || {});
  const [nuevoMetodo, setNuevoMetodo] = useState('');

  useEffect(() => {
    setMetodos(metodosActuales);
    setDetalle(metodosDetalleActuales || {});
  }, [metodosActuales, metodosDetalleActuales]);

  const predefinidos = METODOS_PREDEFINIDOS.map(m => m.id);
  const customMetodos = metodos.filter(m => !predefinidos.includes(m));

  const toggleMetodo = (id: string) => {
    setMetodos(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const actualizarDetalle = (metodo: string, campo: keyof MetodoDetalle, valor: string) => {
    setDetalle(prev => ({
      ...prev,
      [metodo]: { ...prev[metodo], [campo]: valor || undefined }
    }));
  };

  const agregarCustom = () => {
    const trimmed = nuevoMetodo.trim().toLowerCase().replace(/\s+/g, '_');
    if (trimmed && !metodos.includes(trimmed)) {
      setMetodos([...metodos, trimmed]);
      setNuevoMetodo('');
    }
  };

  const esCanal = (id: string) => CANALES_DIGITALES.includes(id);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Métodos de pago — ${bancoNombre}`} size="md">
      <p className="text-xs text-gray-500 mb-4">Aplican a todas las cuentas de este banco</p>

      <div className="space-y-2 mb-4">
        {METODOS_PREDEFINIDOS.map(m => (
          <div key={m.id}>
            <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
              metodos.includes(m.id) ? 'bg-primary-50 border-primary-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}>
              <input type="checkbox" checked={metodos.includes(m.id)}
                onChange={() => toggleMetodo(m.id)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span className="text-sm">{m.label}</span>
              {m.esCanal && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 ml-auto">Canal digital</span>
              )}
            </label>

            {/* Campos extra para canales digitales (Yape, Plin) */}
            {metodos.includes(m.id) && esCanal(m.id) && (
              <div className="ml-6 mt-2 mb-1 p-3 bg-purple-50/50 rounded-lg border border-purple-100 space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs font-medium text-purple-700">Configuración de {m.label}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Teléfono / Identificador</label>
                    <input type="text"
                      value={detalle[m.id]?.identificador || ''}
                      onChange={e => actualizarDetalle(m.id, 'identificador', e.target.value)}
                      className="w-full rounded-md border-gray-300 text-sm py-1.5 px-2 focus:border-primary-500 focus:ring-primary-500"
                      placeholder="987 654 321" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Cuenta vinculada</label>
                    <select
                      value={detalle[m.id]?.cuentaVinculadaId || ''}
                      onChange={e => actualizarDetalle(m.id, 'cuentaVinculadaId', e.target.value)}
                      className="w-full rounded-md border-gray-300 text-sm py-1.5 px-2 focus:border-primary-500 focus:ring-primary-500"
                    >
                      <option value="">Seleccionar cuenta...</option>
                      {cuentasBanco.filter(c => c.activa).map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} ({c.moneda})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-400 mt-0.5">El dinero recibido por {m.label} se registra en esta cuenta</p>
                  </div>
                </div>
              </div>
            )}
          </div>
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
        <Button variant="primary" onClick={() => onGuardar(metodos, detalle)} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </Modal>
  );
};
