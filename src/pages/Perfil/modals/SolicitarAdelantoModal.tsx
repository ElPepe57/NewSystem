/**
 * SolicitarAdelantoModal · F10.F.1.N · 2026-05-27
 *
 * Modal canon FormModalV2 amber para que empleado solicite adelanto.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 14 (líneas 1375-1448).
 *
 * Estructura canon:
 *   - Header: iconTone="amber" + ArrowDownCircle + título "Solicitar adelanto"
 *   - Body:
 *     · Tipo de adelanto (radio: adelanto_sueldo · reembolso_gasto · prestamo)
 *     · Monto + moneda (PEN/USD)
 *     · Razón / descripción (textarea obligatoria)
 *     · Banner info: "Requiere aprobación admin · descuento en próxima boleta"
 *   - Footer: Cancelar + Solicitar (variant primary-soft amber)
 *
 * Connector: planillaService.crearAdelanto
 */
import React, { useState } from 'react';
import { ArrowDownCircle, AlertTriangle, Info } from 'lucide-react';
import { FormModalV2 } from '../../../design-system';
import { planillaService } from '../../../services/planilla.service';
import { usePermissions } from '../../../hooks/usePermissions';
import type { TipoAdelanto } from '../../../types/planilla.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (adelantoId: string) => void;
}

interface TipoOption {
  value: TipoAdelanto;
  label: string;
  descripcion: string;
}

const TIPOS: TipoOption[] = [
  {
    value: 'adelanto_sueldo',
    label: 'Adelanto de sueldo',
    descripcion: 'Se descuenta de tu próxima boleta · sin interés',
  },
  {
    value: 'reembolso_gasto',
    label: 'Reembolso de gasto',
    descripcion: 'Gasto que pagaste de tu bolsillo · sin descuento posterior',
  },
  {
    value: 'prestamo',
    label: 'Préstamo',
    descripcion: 'Mayor a 1 sueldo · plan de descuento acordado con RRHH',
  },
];

export const SolicitarAdelantoModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const { profile, displayName } = usePermissions();
  const [tipo, setTipo] = useState<TipoAdelanto>('adelanto_sueldo');
  const [monto, setMonto] = useState<string>('');
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>('PEN');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoNumber = parseFloat(monto) || 0;
  const descripcionValida = descripcion.trim().length >= 10;
  const canSubmit = montoNumber > 0 && descripcionValida && !saving && !!profile;

  const handleClose = () => {
    setTipo('adelanto_sueldo');
    setMonto('');
    setMoneda('PEN');
    setDescripcion('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || !profile) return;
    setSaving(true);
    setError(null);
    try {
      const id = await planillaService.crearAdelanto(
        {
          userId: profile.uid,
          empleadoNombre: displayName,
          tipo,
          descripcion: descripcion.trim(),
          monto: montoNumber,
          moneda,
        },
        profile.uid,
      );
      onSuccess?.(id);
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Error al solicitar adelanto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={handleClose}
      onSubmit={handleSubmit}
      title="Solicitar adelanto"
      subtitle="Tu solicitud requiere aprobación del admin · te notificaremos por email"
      icon={ArrowDownCircle}
      iconTone="amber"
      submitLabel={saving ? 'Enviando...' : 'Solicitar adelanto'}
      submitVariant="primary-soft"
      submitIcon={ArrowDownCircle}
      loading={saving}
      disabled={!canSubmit}
      size="md"
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-[12px] text-rose-800 inline-flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Tipo · radio cards */}
        <div>
          <label className="text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-2 block">
            Tipo de adelanto <span className="text-rose-600">*</span>
          </label>
          <div className="space-y-2">
            {TIPOS.map((t) => (
              <label
                key={t.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  tipo === t.value
                    ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="tipo-adelanto"
                  value={t.value}
                  checked={tipo === t.value}
                  onChange={() => setTipo(t.value)}
                  className="mt-1"
                  disabled={saving}
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] font-bold ${tipo === t.value ? 'text-amber-900' : 'text-slate-900'}`}>
                    {t.label}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{t.descripcion}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Monto + moneda */}
        <div>
          <label className="text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-1.5 block">
            Monto <span className="text-rose-600">*</span>
          </label>
          <div className="flex items-center gap-2">
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as 'PEN' | 'USD')}
              className="px-3 py-2.5 border border-slate-300 rounded-lg text-[13px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
              disabled={saving}
            >
              <option value="PEN">PEN · S/</option>
              <option value="USD">USD · $</option>
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
              placeholder="0.00"
              disabled={saving}
            />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-1.5 block">
            Razón <span className="text-rose-600">*</span>
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
            placeholder="Explicá brevemente el motivo del adelanto (será visible al admin)"
            rows={3}
            maxLength={300}
            disabled={saving}
          />
          <div className="text-[10px] text-slate-500 mt-1">
            {descripcion.length}/300 · {descripcionValida ? '' : `mínimo 10 caracteres`}
          </div>
        </div>

        {/* Banner info */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800 inline-flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Tu solicitud quedará pendiente hasta que el admin la apruebe. Te notificaremos por email
            cuando haya una respuesta · típicamente dentro de las 24h.
          </span>
        </div>
      </div>
    </FormModalV2>
  );
};

export default SolicitarAdelantoModal;
