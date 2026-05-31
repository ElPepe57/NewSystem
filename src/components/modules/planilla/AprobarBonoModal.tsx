/**
 * AprobarBonoModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F5 · 2026-05-26
 *
 * Modal canon FormModalV2 emerald para aprobar UN cálculo de incentivo.
 * Cambia estado de 'calculado' → 'aprobado'. Listo para incluir en boleta.
 */
import React, { useState } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
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

export const AprobarBonoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  calculo,
  onSuccess,
  onError,
}) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!calculo || submitting || !userProfile) return;
    setSubmitting(true);
    try {
      await calculoIncentivoService.aprobar(calculo.id, userProfile.uid);
      onSuccess?.(
        `Bono aprobado · ${calculo.empleadoNombre} · ${formatCurrencyPEN(calculo.bonoCalculado)} · ${calculo.esquemaNombre}`,
      );
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al aprobar bono');
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
      title="Aprobar bono de incentivo"
      subtitle={`${calculo.empleadoNombre} · ${calculo.esquemaNombre}`}
      icon={CheckCircle2}
      iconTone="emerald"
      size="md"
      submitLabel={submitting ? 'Aprobando...' : 'Aprobar bono'}
      submitVariant="success-soft"
      submitIcon={CheckCircle2}
      loading={submitting}
    >
      <div className="space-y-3">
        {/* Card resumen del cálculo */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
              BONO A APROBAR
            </span>
            <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">
              {TIPO_INCENTIVO_LABELS[calculo.esquemaTipo]}
            </span>
          </div>
          <div className="text-3xl font-bold tabular-nums text-emerald-900">
            {formatCurrencyPEN(calculo.bonoCalculado)}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">
            {calculo.empleadoNombre} ·{' '}
            {`${String(calculo.mes).padStart(2, '0')}/${calculo.anio}`}
          </div>
        </div>

        {/* Detalle métrica */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-700 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Esquema:</span>
            <span className="font-semibold">{calculo.esquemaNombre}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Valor medido:</span>
            <span className="font-semibold tabular-nums">
              {calculo.metricaCalculada.valorMedido.toLocaleString('es-PE')}{' '}
              {calculo.metricaCalculada.unidad}
            </span>
          </div>
          {calculo.metricaCalculada.cumplePct !== undefined && (
            <div className="flex justify-between">
              <span className="text-slate-500">Cumplimiento:</span>
              <span className="font-semibold tabular-nums">
                {calculo.metricaCalculada.cumplePct.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Info aprobación */}
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-violet-700 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-violet-900">
            Al aprobar · el bono queda en estado "aprobado" y se incluirá automáticamente en la
            boleta del mes al generarla. Si necesitás ajustar el monto, rechazá y registrá
            manualmente vía Nueva boleta.
          </div>
        </div>
      </div>
    </FormModalV2>
  );
};

export default AprobarBonoModal;
