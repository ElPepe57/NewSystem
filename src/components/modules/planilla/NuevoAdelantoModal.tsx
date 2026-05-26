/**
 * NuevoAdelantoModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F10.A · 2026-05-26
 *
 * Modal canon FormModalV2 amber · M5 del mockup planilla-v5.3-modales-internos.html.
 * Crea un adelanto de sueldo o préstamo · queda en estado 'pendiente' para aprobación.
 *
 * Reemplaza AdelantoForm.tsx legacy.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, Send, Info, AlertCircle } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { planillaService } from '../../../services/planilla.service';
import type {
  EmpleadoConPerfil,
  TipoAdelanto,
} from '../../../types/planilla.types';
import { formatCurrencyPEN } from '../../../utils/format';
import { useAuthStore } from '../../../store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Empleado pre-seleccionado opcional (para CTAs contextuales) */
  empleadoPreseleccionado?: { uid: string; displayName: string };
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

export const NuevoAdelantoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  empleadoPreseleccionado,
  onSuccess,
  onError,
}) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [empleados, setEmpleados] = useState<EmpleadoConPerfil[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [userId, setUserId] = useState('');
  const [tipo, setTipo] = useState<TipoAdelanto>('adelanto_sueldo');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>('PEN');
  const [descripcion, setDescripcion] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    (async () => {
      try {
        const emps = await planillaService.getEmpleadosActivos();
        setEmpleados(emps);
        if (empleadoPreseleccionado?.uid) {
          setUserId(empleadoPreseleccionado.uid);
        }
      } catch (err) {
        console.error('[NuevoAdelantoModal] error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, empleadoPreseleccionado]);

  // Reset al cerrar
  useEffect(() => {
    if (!isOpen) {
      setUserId('');
      setTipo('adelanto_sueldo');
      setMonto('');
      setMoneda('PEN');
      setDescripcion('');
    }
  }, [isOpen]);

  const montoNum = Number(monto) || 0;
  const empleadoSel = empleados.find((e) => e.uid === userId);

  const esValido = useMemo(() => {
    if (!userId) return false;
    if (montoNum <= 0) return false;
    if (!descripcion.trim()) return false;
    return true;
  }, [userId, montoNum, descripcion]);

  const handleSubmit = async () => {
    if (!esValido || submitting || !userProfile || !empleadoSel) return;
    setSubmitting(true);
    try {
      await planillaService.crearAdelanto(
        {
          userId,
          empleadoNombre: empleadoSel.displayName,
          tipo,
          descripcion: descripcion.trim(),
          monto: montoNum,
          moneda,
        },
        userProfile.uid,
      );
      onSuccess?.(
        `Adelanto creado · ${empleadoSel.displayName} · ${moneda === 'PEN' ? formatCurrencyPEN(montoNum) : `US$ ${montoNum.toLocaleString('es-PE')}`} · estado pendiente de aprobación`,
      );
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al crear adelanto');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Nuevo adelanto"
      subtitle="Se descuenta en la próxima boleta del empleado"
      icon={ArrowDownCircle}
      iconTone="amber"
      size="md"
      submitLabel={submitting ? 'Registrando...' : 'Registrar adelanto'}
      submitVariant="primary-soft"
      submitIcon={Send}
      loading={submitting}
      disabled={!esValido || loading}
    >
      <div className="space-y-3">
        {/* Empleado */}
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">
            Empleado <span className="text-rose-500">*</span>
          </label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={!!empleadoPreseleccionado}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-50"
          >
            <option value="">— Seleccionar —</option>
            {empleados.map((e) => (
              <option key={e.uid} value={e.uid}>
                {e.displayName}
                {e.perfilLaboral?.salarioBase
                  ? ` · disponible ${formatCurrencyPEN(e.perfilLaboral.salarioBase * 0.3)}`
                  : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo (radio grid 2 cols) */}
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">
            Tipo de adelanto
          </label>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            <label
              className={`p-2 rounded text-[11px] text-center font-bold cursor-pointer border-2 transition-colors ${
                tipo === 'adelanto_sueldo'
                  ? 'border-amber-400 bg-amber-50/40 text-amber-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value="adelanto_sueldo"
                checked={tipo === 'adelanto_sueldo'}
                onChange={() => setTipo('adelanto_sueldo')}
                className="hidden"
              />
              Adelanto sueldo
            </label>
            <label
              className={`p-2 rounded text-[11px] text-center cursor-pointer border-2 transition-colors ${
                tipo === 'prestamo'
                  ? 'border-amber-400 bg-amber-50/40 text-amber-700 font-bold'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value="prestamo"
                checked={tipo === 'prestamo'}
                onChange={() => setTipo('prestamo')}
                className="hidden"
              />
              Préstamo
            </label>
          </div>
        </div>

        {/* Monto + Moneda */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">
              Monto <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              step={50}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="500.00"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px] tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">
              Moneda
            </label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as 'PEN' | 'USD')}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="PEN">PEN</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* Razón */}
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">
            Razón (visible al empleado) <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            placeholder="Adelanto por gastos médicos · razón laboral · etc..."
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-[11px] resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Banner info */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[10px] text-amber-900 flex items-start gap-1.5">
          <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>
            Queda en estado <strong>pendiente</strong> · admin/gerente debe aprobar antes de
            que el monto se entregue al empleado.
          </span>
        </div>

        {/* Validación inline */}
        {monto !== '' && montoNum <= 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded p-2 text-[11px] text-rose-900 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            El monto debe ser mayor a 0
          </div>
        )}
      </div>
    </FormModalV2>
  );
};

export default NuevoAdelantoModal;
