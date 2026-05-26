/**
 * AjustarSalarioModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F5 · 2026-05-26
 *
 * Modal canon FormModalV2 sky para ajustar el salario de un empleado.
 * Crea un registro en HistorialSalarial + actualiza el PerfilLaboral
 * atomicamente (vía historialSalarialService.registrarVariacion).
 *
 * Usado en:
 *  - /usuarios Ficha 360 → tab Laboral (F8)
 *  - /planilla algún drill futuro
 */
import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { historialSalarialService } from '../../../services/historialSalarial.service';
import { planillaService } from '../../../services/planilla.service';
import type {
  RazonVariacionSalarial,
  PerfilLaboral,
} from '../../../types/planilla.types';
import { RAZON_VARIACION_LABELS } from '../../../types/planilla.types';
import { formatCurrencyPEN } from '../../../utils/format';
import { useAuthStore } from '../../../store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  empleadoNombre: string;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

const RAZONES_ORDENADAS: RazonVariacionSalarial[] = [
  'ajuste_anual',
  'promocion',
  'reasignacion_cargo',
  'merito',
  'correccion',
  'otro',
];

export const AjustarSalarioModal: React.FC<Props> = ({
  isOpen,
  onClose,
  userId,
  empleadoNombre,
  onSuccess,
  onError,
}) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [perfilActual, setPerfilActual] = useState<PerfilLaboral | null>(null);
  const [loadingPerfil, setLoadingPerfil] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [salarioNuevo, setSalarioNuevo] = useState<string>('');
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>('PEN');
  const [efectivoDesde, setEfectivoDesde] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [razon, setRazon] = useState<RazonVariacionSalarial>('ajuste_anual');
  const [notas, setNotas] = useState('');

  // Cargar perfil actual al abrir
  useEffect(() => {
    if (!isOpen || !userId) return;
    setLoadingPerfil(true);
    (async () => {
      try {
        const perfil = await planillaService.getPerfilLaboral(userId);
        setPerfilActual(perfil);
        if (perfil?.monedaSalario) setMoneda(perfil.monedaSalario);
      } catch (err) {
        console.error('[AjustarSalarioModal] error cargando perfil:', err);
      } finally {
        setLoadingPerfil(false);
      }
    })();
  }, [isOpen, userId]);

  // Reset form al cerrar
  useEffect(() => {
    if (!isOpen) {
      setSalarioNuevo('');
      setRazon('ajuste_anual');
      setNotas('');
      setEfectivoDesde(new Date().toISOString().slice(0, 10));
    }
  }, [isOpen]);

  // Cálculo de delta para preview
  const salarioAnterior = perfilActual?.salarioBase ?? 0;
  const salarioNuevoNum = Number(salarioNuevo) || 0;
  const delta = salarioNuevoNum - salarioAnterior;
  const pctVariacion = salarioAnterior > 0 ? (delta / salarioAnterior) * 100 : 0;

  const esValido = useMemo(() => {
    if (!salarioNuevoNum || salarioNuevoNum <= 0) return false;
    if (!efectivoDesde) return false;
    if (delta === 0) return false; // sin cambio · prohibido registrar
    return true;
  }, [salarioNuevoNum, efectivoDesde, delta]);

  const handleSubmit = async () => {
    if (!esValido || submitting || !userProfile) return;
    if (!perfilActual) {
      onError?.('El empleado no tiene perfil laboral configurado. Crea el perfil antes de registrar ajustes.');
      return;
    }
    setSubmitting(true);
    try {
      await historialSalarialService.registrarVariacion(
        {
          userId,
          empleadoNombre,
          salarioNuevo: salarioNuevoNum,
          moneda,
          efectivoDesde: new Date(efectivoDesde),
          razon,
          notas: notas.trim() || undefined,
        },
        userProfile.uid,
      );
      onSuccess?.(
        `Salario de ${empleadoNombre} ajustado a ${formatCurrencyPEN(salarioNuevoNum)} · ${RAZON_VARIACION_LABELS[razon]}`,
      );
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al ajustar salario');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={`Ajustar salario · ${empleadoNombre}`}
      subtitle="Variación queda registrada en el historial salarial"
      icon={TrendingUp}
      iconTone="sky"
      size="md"
      submitLabel={submitting ? 'Guardando...' : 'Registrar variación'}
      submitVariant="primary-soft"
      submitIcon={TrendingUp}
      loading={submitting}
      disabled={!esValido}
    >
      {loadingPerfil ? (
        <div className="text-center py-6 text-[12px] text-slate-500">Cargando perfil...</div>
      ) : !perfilActual ? (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-rose-900">
            <strong>{empleadoNombre}</strong> no tiene perfil laboral configurado. Crea el perfil
            con sueldo base antes de registrar ajustes salariales.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Salario actual */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
              SALARIO ACTUAL
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {formatCurrencyPEN(salarioAnterior)}{' '}
              <span className="text-[11px] text-slate-500 font-normal">
                {perfilActual.monedaSalario}
              </span>
            </div>
          </div>

          {/* Salario nuevo */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Nuevo salario base <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={50}
                value={salarioNuevo}
                onChange={(e) => setSalarioNuevo(e.target.value)}
                placeholder="0.00"
                className="flex-1 text-[14px] tabular-nums border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as 'PEN' | 'USD')}
                className="text-[12px] font-semibold border border-slate-300 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="PEN">PEN</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {/* Preview delta */}
          {salarioNuevoNum > 0 && (
            <div
              className={`rounded-lg border p-3 ${
                delta > 0
                  ? 'bg-emerald-50 border-emerald-200'
                  : delta < 0
                    ? 'bg-rose-50 border-rose-200'
                    : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-[10px] uppercase tracking-wider font-bold ${
                    delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-700' : 'text-slate-700'
                  }`}
                >
                  VARIACIÓN
                </span>
                <ArrowRight
                  className={`w-3.5 h-3.5 ${
                    delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-700' : 'text-slate-400'
                  }`}
                />
              </div>
              <div
                className={`text-lg font-bold tabular-nums ${
                  delta > 0 ? 'text-emerald-900' : delta < 0 ? 'text-rose-900' : 'text-slate-900'
                }`}
              >
                {delta > 0 ? '+' : ''}
                {formatCurrencyPEN(delta)}
                <span className="text-[12px] ml-1 font-normal">
                  ({pctVariacion > 0 ? '+' : ''}
                  {pctVariacion.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}

          {/* Efectivo desde */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Efectivo desde <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={efectivoDesde}
              onChange={(e) => setEfectivoDesde(e.target.value)}
              className="w-full text-[13px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Las boletas a partir de esta fecha usarán el nuevo monto
            </p>
          </div>

          {/* Razón */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Razón de la variación <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {RAZONES_ORDENADAS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRazon(r)}
                  className={`text-[11px] px-2 py-1.5 rounded border transition-colors text-left ${
                    razon === r
                      ? 'bg-sky-50 border-sky-300 text-sky-800 font-bold ring-1 ring-sky-200'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {RAZON_VARIACION_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Notas <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Contexto adicional · referencia a decisión gerencial · etc."
              className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>

          {/* Validaciones inline */}
          {salarioNuevoNum > 0 && delta === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-900 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              El nuevo monto es igual al actual · no se registrará ninguna variación.
            </div>
          )}
        </div>
      )}
    </FormModalV2>
  );
};

export default AjustarSalarioModal;
