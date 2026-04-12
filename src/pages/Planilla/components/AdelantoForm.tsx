/**
 * AdelantoForm.tsx — Modal para registrar un nuevo adelanto de nómina.
 */
import React, { useState, useEffect } from 'react';
import { FormModal } from '../../../design-system';
import { useToastStore } from '../../../store/toastStore';
import { useAuthStore } from '../../../store/authStore';
import { usePlanillaStore } from '../../../store/planillaStore';
import { useTipoCambioStore } from '../../../store/tipoCambioStore';
import { TIPO_ADELANTO_LABELS } from '../../../types/planilla.types';
import type { TipoAdelanto, AdelantoFormData, EmpleadoConPerfil } from '../../../types/planilla.types';

interface AdelantoFormProps {
  open: boolean;
  onClose: () => void;
}

export const AdelantoForm: React.FC<AdelantoFormProps> = ({ open, onClose }) => {
  const toast = useToastStore();
  const { user } = useAuthStore();
  const { empleados, fetchEmpleados, crearAdelanto } = usePlanillaStore();
  const { getTCDelDia } = useTipoCambioStore();

  const [userId, setUserId] = useState('');
  const [tipo, setTipo] = useState<TipoAdelanto>('adelanto_sueldo');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState(0);
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>('PEN');
  const [tipoCambio, setTipoCambio] = useState(3.7);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchEmpleados();
      getTCDelDia().then(tc => { if (tc) setTipoCambio(tc.venta); });
    }
  }, [open]);

  const empleadosConPerfil = empleados.filter(e => e.perfilLaboral?.activo);
  const empleadoSeleccionado = empleados.find(e => e.uid === userId);

  const handleSubmit = async () => {
    if (!user?.uid || !userId || monto <= 0) {
      toast.error('Completa todos los campos requeridos');
      return;
    }

    setLoading(true);
    try {
      const data: AdelantoFormData = {
        userId,
        empleadoNombre: empleadoSeleccionado?.displayName || '',
        tipo,
        descripcion: descripcion || TIPO_ADELANTO_LABELS[tipo],
        monto,
        moneda,
        tipoCambio: moneda === 'USD' ? tipoCambio : undefined,
      };

      const id = await crearAdelanto(data, user.uid);
      toast.success(`Adelanto ${id} registrado`);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal
      isOpen={open}
      onClose={onClose}
      title="Nuevo adelanto"
      size="md"
      onSubmit={handleSubmit}
      submitLabel="Registrar adelanto"
      loading={loading}
      disabled={!userId || monto <= 0}
    >
      {/* Empleado */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Empleado</label>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
        >
          <option value="">Seleccionar empleado...</option>
          {empleadosConPerfil.map(e => (
            <option key={e.uid} value={e.uid}>{e.displayName}</option>
          ))}
        </select>
      </div>

      {/* Tipo */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoAdelanto)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
        >
          {(Object.entries(TIPO_ADELANTO_LABELS) as [TipoAdelanto, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Descripcion */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Descripcion</label>
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Detalle del adelanto..."
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Monto + Moneda */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Monto</label>
          <input
            type="number"
            value={monto}
            onChange={(e) => setMonto(parseFloat(e.target.value) || 0)}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-teal-500"
            step="0.01"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
          <select
            value={moneda}
            onChange={(e) => setMoneda(e.target.value as 'PEN' | 'USD')}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
          >
            <option value="PEN">S/ Soles</option>
            <option value="USD">$ Dolares</option>
          </select>
        </div>
      </div>

      {moneda === 'USD' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de cambio</label>
          <input
            type="number"
            value={tipoCambio}
            onChange={(e) => setTipoCambio(parseFloat(e.target.value) || 0)}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-teal-500"
            step="0.01"
          />
        </div>
      )}
    </FormModal>
  );
};
