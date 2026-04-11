/**
 * EmpleadoForm.tsx — Modal para crear/editar perfil laboral de un usuario.
 */
import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../../../components/common';
import { useToastStore } from '../../../store/toastStore';
import { usePlanillaStore } from '../../../store/planillaStore';
import { TIPO_EMPLEADO_LABELS } from '../../../types/planilla.types';
import type { EmpleadoConPerfil, PerfilLaboralFormData, TipoEmpleado, TipoComision } from '../../../types/planilla.types';

interface EmpleadoFormProps {
  empleado: EmpleadoConPerfil | null;
  open: boolean;
  onClose: () => void;
}

export const EmpleadoForm: React.FC<EmpleadoFormProps> = ({ empleado, open, onClose }) => {
  const toast = useToastStore();
  const { guardarPerfilLaboral } = usePlanillaStore();
  const [loading, setLoading] = useState(false);

  const perfil = empleado?.perfilLaboral;

  const [tipo, setTipo] = useState<TipoEmpleado>(perfil?.tipo || 'empleado');
  const [salarioBase, setSalarioBase] = useState(perfil?.salarioBase || 0);
  const [monedaSalario, setMonedaSalario] = useState<'PEN' | 'USD'>(perfil?.monedaSalario || 'PEN');
  const [tieneComision, setTieneComision] = useState(!!perfil?.esquemaComision);
  const [tipoComision, setTipoComision] = useState<TipoComision>(perfil?.esquemaComision?.tipo || 'porcentaje_venta');
  const [porcentaje, setPorcentaje] = useState(perfil?.esquemaComision?.porcentaje || 0);
  const [montoFijo, setMontoFijo] = useState(perfil?.esquemaComision?.montoFijo || 0);
  const [banco, setBanco] = useState(perfil?.banco || '');
  const [numeroCuenta, setNumeroCuenta] = useState(perfil?.numeroCuenta || '');
  const [cci, setCci] = useState(perfil?.cci || '');

  useEffect(() => {
    if (perfil) {
      setTipo(perfil.tipo);
      setSalarioBase(perfil.salarioBase || 0);
      setMonedaSalario(perfil.monedaSalario || 'PEN');
      setTieneComision(!!perfil.esquemaComision);
      setTipoComision(perfil.esquemaComision?.tipo || 'porcentaje_venta');
      setPorcentaje(perfil.esquemaComision?.porcentaje || 0);
      setMontoFijo(perfil.esquemaComision?.montoFijo || 0);
      setBanco(perfil.banco || '');
      setNumeroCuenta(perfil.numeroCuenta || '');
      setCci(perfil.cci || '');
    }
  }, [perfil]);

  const handleSubmit = async () => {
    if (!empleado) return;
    setLoading(true);
    try {
      const data: PerfilLaboralFormData = {
        tipo,
        salarioBase: tipo !== 'comisionista' ? salarioBase : undefined,
        monedaSalario,
        esquemaComision: tieneComision ? {
          tipo: tipoComision,
          porcentaje: tipoComision === 'porcentaje_venta' ? porcentaje : undefined,
          montoFijo: tipoComision === 'monto_fijo' ? montoFijo : undefined,
        } : undefined,
        banco: banco || undefined,
        numeroCuenta: numeroCuenta || undefined,
        cci: cci || undefined,
      };
      await guardarPerfilLaboral(empleado.uid, data);
      toast.success(`Perfil laboral de ${empleado.displayName} guardado`);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!empleado) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title={`Perfil Laboral — ${empleado.displayName}`} size="lg">
      <div className="space-y-4">
        {/* Info del usuario */}
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <div><span className="font-medium">Email:</span> {empleado.email}</div>
          <div><span className="font-medium">Cargo:</span> {empleado.cargo || '—'}</div>
          <div><span className="font-medium">Rol:</span> {empleado.role}</div>
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de perfil</label>
          <div className="flex gap-2">
            {(Object.entries(TIPO_EMPLEADO_LABELS) as [TipoEmpleado, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTipo(key)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  tipo === key
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Salario (no para comisionistas puros) */}
        {tipo !== 'comisionista' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Salario base mensual</label>
              <input
                type="number"
                value={salarioBase}
                onChange={(e) => setSalarioBase(parseFloat(e.target.value) || 0)}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-teal-500"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
              <select
                value={monedaSalario}
                onChange={(e) => setMonedaSalario(e.target.value as 'PEN' | 'USD')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
              >
                <option value="PEN">S/ Soles</option>
                <option value="USD">$ Dolares</option>
              </select>
            </div>
          </div>
        )}

        {/* Comisiones */}
        <div className="border rounded-lg p-3 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={tieneComision}
              onChange={(e) => setTieneComision(e.target.checked)}
              className="rounded border-slate-300"
            />
            Esquema de comisiones por ventas
          </label>

          {tieneComision && (
            <div className="space-y-3 pl-6">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTipoComision('porcentaje_venta')}
                  className={`px-3 py-1.5 text-sm rounded-lg border ${
                    tipoComision === 'porcentaje_venta'
                      ? 'bg-teal-100 border-teal-300 text-teal-700'
                      : 'bg-white border-slate-300'
                  }`}
                >
                  % de la venta
                </button>
                <button
                  type="button"
                  onClick={() => setTipoComision('monto_fijo')}
                  className={`px-3 py-1.5 text-sm rounded-lg border ${
                    tipoComision === 'monto_fijo'
                      ? 'bg-teal-100 border-teal-300 text-teal-700'
                      : 'bg-white border-slate-300'
                  }`}
                >
                  Monto fijo por venta
                </button>
              </div>

              {tipoComision === 'porcentaje_venta' ? (
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Porcentaje sobre totalPEN</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={porcentaje}
                      onChange={(e) => setPorcentaje(parseFloat(e.target.value) || 0)}
                      className="w-24 border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-teal-500"
                      step="0.5"
                      min="0"
                      max="100"
                    />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Monto fijo por venta (PEN)</label>
                  <input
                    type="number"
                    value={montoFijo}
                    onChange={(e) => setMontoFijo(parseFloat(e.target.value) || 0)}
                    className="w-32 border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-teal-500"
                    step="1"
                    min="0"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Datos bancarios */}
        <div className="border-t pt-3">
          <h4 className="text-sm font-medium text-slate-700 mb-2">Datos bancarios (opcional)</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Banco</label>
              <input
                type="text"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                placeholder="BCP, IBK..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Nro. cuenta</label>
              <input
                type="text"
                value={numeroCuenta}
                onChange={(e) => setNumeroCuenta(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">CCI</label>
              <input
                type="text"
                value={cci}
                onChange={(e) => setCci(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar perfil laboral'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
