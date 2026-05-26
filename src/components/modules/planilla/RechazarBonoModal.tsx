/**
 * RechazarBonoModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F5 · 2026-05-26
 *
 * Modal canon FormModalV2 red para rechazar UN cálculo de incentivo.
 * Razón obligatoria. Cambia estado 'calculado' → 'rechazado'.
 */
import React, { useEffect, useState } from 'react';
import { XCircle, AlertCircle } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { calculoIncentivoService } from '../../../services/calculoIncentivo.service';
import type { CalculoIncentivoMes } from '../../../types/planilla.types';
import { TIPO_INCENTIVO_LABELS } from '../../../types/planilla.types';
import { formatCurrencyPEN } from '../../../utils/format';
import { useAuthStore } from '../../../store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  calculo: CalculoIncentivoMes | null;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

const RAZONES_SUGERIDAS = [
  'Métrica no alcanza umbral · cálculo incorrecto',
  'Evento extraordinario · cliente devolvió ventas',
  'Empleado en período de prueba · sin bono este mes',
  'Esquema modificado · monto recalcular manualmente',
  'Error en data fuente · recalcular después',
];

export const RechazarBonoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  calculo,
  onSuccess,
  onError,
}) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [razon, setRazon] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) setRazon('');
  }, [isOpen]);

  const esValido = razon.trim().length >= 8;

  const handleSubmit = async () => {
    if (!calculo || !esValido || submitting || !userProfile) return;
    setSubmitting(true);
    try {
      await calculoIncentivoService.rechazar(calculo.id, userProfile.uid, razon.trim());
      onSuccess?.(
        `Bono rechazado · ${calculo.empleadoNombre} · ${formatCurrencyPEN(calculo.bonoCalculado)} · razón: "${razon.trim().slice(0, 60)}${razon.length > 60 ? '...' : ''}"`,
      );
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al rechazar bono');
    } finally {
      setSubmitting(false);
    }
  };

  if (!calculo) return null;

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Rechazar bono de incentivo"
      subtitle={`${calculo.empleadoNombre} · ${calculo.esquemaNombre}`}
      icon={XCircle}
      iconTone="red"
      size="md"
      submitLabel={submitting ? 'Rechazando...' : 'Rechazar bono'}
      submitVariant="danger-soft"
      submitIcon={XCircle}
      loading={submitting}
      disabled={!esValido}
    >
      <div className="space-y-4">
        {/* Card resumen rojo */}
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">
              BONO A RECHAZAR
            </span>
            <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold uppercase">
              {TIPO_INCENTIVO_LABELS[calculo.esquemaTipo]}
            </span>
          </div>
          <div className="text-2xl font-bold tabular-nums text-rose-900">
            {formatCurrencyPEN(calculo.bonoCalculado)}
          </div>
          <div className="text-[11px] text-rose-700 mt-1">
            {calculo.empleadoNombre} ·{' '}
            {`${String(calculo.mes).padStart(2, '0')}/${calculo.anio}`}
          </div>
        </div>

        {/* Sugerencias rápidas */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
            RAZONES FRECUENTES (click para usar)
          </div>
          <div className="space-y-1">
            {RAZONES_SUGERIDAS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRazon(r)}
                className={`w-full text-left text-[11px] px-2 py-1.5 rounded border transition-colors ${
                  razon === r
                    ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Razón obligatoria */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Razón del rechazo <span className="text-rose-500">*</span>
            <span className="text-slate-400 font-normal ml-1">(mínimo 8 caracteres)</span>
          </label>
          <textarea
            value={razon}
            onChange={(e) => setRazon(e.target.value)}
            rows={3}
            placeholder="Explicá por qué se rechaza este bono..."
            className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-slate-500">
              {razon.length} carácter{razon.length === 1 ? '' : 'es'}
            </span>
            {!esValido && razon.length > 0 && (
              <span className="text-[10px] text-rose-600">Necesita al menos 8 caracteres</span>
            )}
          </div>
        </div>

        {/* Aviso impacto */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-900">
            El rechazo queda registrado con tu nombre y la razón. El empleado NO recibirá este
            bono en la boleta del mes. Si fue un error · podés ejecutar "Calcular bonos" de
            nuevo para regenerar.
          </div>
        </div>
      </div>
    </FormModalV2>
  );
};

export default RechazarBonoModal;
