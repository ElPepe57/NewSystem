/**
 * EditarEsquemaIncentivoModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F5.B · 2026-05-26
 *
 * Modal canon FormModalV2 violet para editar UN esquema existente.
 *
 * Editable:
 *  - nombre · descripción · vigenteHasta · configuracion
 *
 * NO editable (preservación de cálculos históricos):
 *  - id · tipo · aplicableA · vigenteDesde
 *
 * Si necesitás cambiar algo del segundo grupo · creá un esquema nuevo
 * y desactiva el viejo.
 */
import React, { useEffect, useState } from 'react';
import { Edit2, Save, Info, AlertCircle } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { esquemaIncentivoService } from '../../../services/esquemaIncentivo.service';
import type {
  EsquemaIncentivo,
  ConfigComision,
  ConfigBonoMeta,
  ConfigBonoKPI,
  ConfigBonoFijo,
} from '../../../types/planilla.types';
import { TIPO_INCENTIVO_LABELS } from '../../../types/planilla.types';
import { useAuthStore } from '../../../store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  esquema: EsquemaIncentivo | null;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

export const EditarEsquemaIncentivoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  esquema,
  onSuccess,
  onError,
}) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [submitting, setSubmitting] = useState(false);

  // Form state (inicializado desde el esquema cuando abre)
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [vigenteHasta, setVigenteHasta] = useState('');
  const [configJSON, setConfigJSON] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !esquema) return;
    setNombre(esquema.nombre);
    setDescripcion(esquema.descripcion ?? '');
    setVigenteHasta(esquema.vigenteHasta ? esquema.vigenteHasta.toDate().toISOString().slice(0, 10) : '');
    setConfigJSON(JSON.stringify(esquema.configuracion, null, 2));
    setParseError(null);
  }, [isOpen, esquema]);

  const esValido = nombre.trim().length > 0 && parseError === null;

  const handleSubmit = async () => {
    if (!esquema || !esValido || submitting || !userProfile) return;
    setSubmitting(true);
    try {
      let configuracion: ConfigComision | ConfigBonoMeta | ConfigBonoKPI | ConfigBonoFijo;
      try {
        configuracion = JSON.parse(configJSON);
      } catch {
        setParseError('JSON inválido. Revisá la sintaxis.');
        setSubmitting(false);
        return;
      }
      await esquemaIncentivoService.actualizar(
        esquema.id,
        {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          vigenteHasta: vigenteHasta ? new Date(vigenteHasta) : undefined,
          configuracion,
        },
        userProfile.uid,
      );
      onSuccess?.(`Esquema "${nombre}" actualizado`);
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al actualizar esquema');
    } finally {
      setSubmitting(false);
    }
  };

  const validateJSON = (text: string) => {
    setConfigJSON(text);
    try {
      JSON.parse(text);
      setParseError(null);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'JSON inválido');
    }
  };

  if (!esquema) return null;

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={`Editar · ${esquema.nombre}`}
      subtitle={`${TIPO_INCENTIVO_LABELS[esquema.tipo]} · campos estructurales preservados`}
      icon={Edit2}
      iconTone="purple"
      size="lg"
      submitLabel={submitting ? 'Guardando...' : 'Guardar cambios'}
      submitVariant="primary-soft"
      submitIcon={Save}
      loading={submitting}
      disabled={!esValido}
    >
      <div className="space-y-4">
        {/* Banner restricciones */}
        <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-900">
            <strong>NO editable:</strong> tipo · aplicabilidad · vigente desde. Si necesitás
            cambiar uno de esos, creá un esquema nuevo y desactivá éste.
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Nombre <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full text-[13px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Descripción <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Vigente hasta <span className="text-slate-400 font-normal">(opcional · indefinido si vacío)</span>
          </label>
          <input
            type="date"
            value={vigenteHasta}
            onChange={(e) => setVigenteHasta(e.target.value)}
            className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Configuración <span className="text-slate-400 font-normal">(JSON · editor avanzado)</span>
          </label>
          <textarea
            value={configJSON}
            onChange={(e) => validateJSON(e.target.value)}
            rows={10}
            className="w-full font-mono text-[11px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
          />
          {parseError && (
            <div className="text-[10px] text-rose-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {parseError}
            </div>
          )}
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Editor JSON avanzado · sin UI dedicada por tipo (deuda menor F5.B · canon "rápido y
            seguro"). UI rica vendrá en iteración futura si hay demanda.
          </p>
        </div>
      </div>
    </FormModalV2>
  );
};

export default EditarEsquemaIncentivoModal;
