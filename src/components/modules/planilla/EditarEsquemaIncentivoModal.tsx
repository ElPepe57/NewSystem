/**
 * EditarEsquemaIncentivoModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F10.C · 2026-05-26 (rewrite canon · reemplaza JSON editor)
 *
 * Modal canon FormModalV2 violet para editar UN esquema existente con UI rica
 * por tipo (reusa los 4 sub-forms de NuevoEsquemaIncentivoModal).
 *
 * Editable:
 *  - nombre · descripción · vigenteHasta · configuracion (UI rica por tipo)
 *
 * NO editable (preservación de cálculos históricos):
 *  - id · tipo · aplicableA · vigenteDesde
 *
 * Si necesitás cambiar algo del segundo grupo · creá un esquema nuevo
 * y desactivá el viejo.
 */
import React, { useEffect, useState } from 'react';
import { Edit2, Save, AlertCircle, DollarSign, Target, TrendingUp, Calendar } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { esquemaIncentivoService } from '../../../services/esquemaIncentivo.service';
import type {
  EsquemaIncentivo,
  ConfigComision,
  ConfigBonoMeta,
  ConfigBonoKPI,
  ConfigBonoFijo,
  TipoIncentivo,
} from '../../../types/planilla.types';
import { TIPO_INCENTIVO_LABELS } from '../../../types/planilla.types';
import { useAuthStore } from '../../../store/authStore';
// Reuso los 4 sub-forms canon de NuevoEsquemaIncentivoModal (DRY)
import {
  ConfigComisionForm,
  ConfigBonoMetaForm,
  ConfigBonoKPIForm,
  ConfigBonoFijoForm,
} from './NuevoEsquemaIncentivoModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  esquema: EsquemaIncentivo | null;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

const TIPO_ICONS: Record<TipoIncentivo, React.ComponentType<{ className?: string }>> = {
  comision: DollarSign,
  bono_meta: Target,
  bono_kpi: TrendingUp,
  bono_fijo: Calendar,
};

const TIPO_BADGE: Record<TipoIncentivo, string> = {
  comision: 'bg-emerald-100 text-emerald-700',
  bono_meta: 'bg-sky-100 text-sky-700',
  bono_kpi: 'bg-teal-100 text-teal-700',
  bono_fijo: 'bg-indigo-100 text-indigo-700',
};

export const EditarEsquemaIncentivoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  esquema,
  onSuccess,
  onError,
}) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [submitting, setSubmitting] = useState(false);

  // Form state · campos editables
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [vigenteHasta, setVigenteHasta] = useState('');
  const [configComision, setConfigComision] = useState<ConfigComision | null>(null);
  const [configBonoMeta, setConfigBonoMeta] = useState<ConfigBonoMeta | null>(null);
  const [configBonoKPI, setConfigBonoKPI] = useState<ConfigBonoKPI | null>(null);
  const [configBonoFijo, setConfigBonoFijo] = useState<ConfigBonoFijo | null>(null);

  useEffect(() => {
    if (!isOpen || !esquema) return;
    setNombre(esquema.nombre);
    setDescripcion(esquema.descripcion ?? '');
    setVigenteHasta(
      esquema.vigenteHasta ? esquema.vigenteHasta.toDate().toISOString().slice(0, 10) : '',
    );
    // Inicializa el config del tipo correcto (los otros quedan null)
    setConfigComision(null);
    setConfigBonoMeta(null);
    setConfigBonoKPI(null);
    setConfigBonoFijo(null);
    switch (esquema.tipo) {
      case 'comision':
        setConfigComision({ ...(esquema.configuracion as ConfigComision) });
        break;
      case 'bono_meta':
        setConfigBonoMeta({ ...(esquema.configuracion as ConfigBonoMeta) });
        break;
      case 'bono_kpi':
        setConfigBonoKPI({ ...(esquema.configuracion as ConfigBonoKPI) });
        break;
      case 'bono_fijo':
        setConfigBonoFijo({ ...(esquema.configuracion as ConfigBonoFijo) });
        break;
    }
  }, [isOpen, esquema]);

  const configActual = (): ConfigComision | ConfigBonoMeta | ConfigBonoKPI | ConfigBonoFijo | null => {
    if (!esquema) return null;
    if (esquema.tipo === 'comision') return configComision;
    if (esquema.tipo === 'bono_meta') return configBonoMeta;
    if (esquema.tipo === 'bono_kpi') return configBonoKPI;
    if (esquema.tipo === 'bono_fijo') return configBonoFijo;
    return null;
  };

  const validacionConfig = (): boolean => {
    if (!esquema) return false;
    if (esquema.tipo === 'comision' && configComision) {
      const c = configComision;
      if (c.modelo === 'porcentaje_simple') return (c.porcentaje ?? 0) > 0;
      if (c.modelo === 'monto_fijo_por_venta') return (c.montoFijo ?? 0) > 0;
      if (c.modelo === 'escalado') return (c.escalas?.length ?? 0) >= 1;
    }
    if (esquema.tipo === 'bono_meta' && configBonoMeta)
      return configBonoMeta.objetivoMensual > 0 && configBonoMeta.bonoSiCumple > 0;
    if (esquema.tipo === 'bono_kpi' && configBonoKPI)
      return configBonoKPI.formulaDescripcion.trim().length > 0 && configBonoKPI.bonoSiCumple > 0;
    if (esquema.tipo === 'bono_fijo' && configBonoFijo) return configBonoFijo.monto > 0;
    return false;
  };

  const esValido = nombre.trim().length > 0 && validacionConfig();

  const handleSubmit = async () => {
    if (!esquema || !esValido || submitting || !userProfile) return;
    const config = configActual();
    if (!config) return;
    setSubmitting(true);
    try {
      await esquemaIncentivoService.actualizar(
        esquema.id,
        {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          vigenteHasta: vigenteHasta ? new Date(vigenteHasta) : undefined,
          configuracion: config,
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

  if (!esquema) return null;

  const Icon = TIPO_ICONS[esquema.tipo];

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

        {/* Header con tipo */}
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
            <Icon className="w-5 h-5 text-violet-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-bold text-slate-900">{esquema.nombre}</span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${TIPO_BADGE[esquema.tipo]}`}
              >
                {TIPO_INCENTIVO_LABELS[esquema.tipo]}
              </span>
            </div>
            <div className="text-[10px] text-slate-500">
              Aplica a:{' '}
              <strong>
                {esquema.aplicableA.modo === 'rol'
                  ? `rol ${esquema.aplicableA.rol}`
                  : esquema.aplicableA.modo === 'usuarios'
                    ? `${esquema.aplicableA.userIds.length} usuario(s)`
                    : 'todos los empleados'}
              </strong>{' '}
              · vigente desde {esquema.vigenteDesde.toDate().toLocaleDateString('es-PE')}
            </div>
          </div>
        </div>

        {/* Nombre editable */}
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

        {/* Descripción editable */}
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

        {/* Vigente hasta editable */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Vigente hasta{' '}
            <span className="text-slate-400 font-normal">(opcional · indefinido si vacío)</span>
          </label>
          <input
            type="date"
            value={vigenteHasta}
            onChange={(e) => setVigenteHasta(e.target.value)}
            min={esquema.vigenteDesde.toDate().toISOString().slice(0, 10)}
            className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Config editable · UI RICA POR TIPO · reusa sub-forms de NuevoEsquema */}
        <div>
          <div className="text-[11px] font-bold text-slate-700 mb-2">Configuración del incentivo</div>
          {esquema.tipo === 'comision' && configComision && (
            <ConfigComisionForm config={configComision} onChange={setConfigComision} />
          )}
          {esquema.tipo === 'bono_meta' && configBonoMeta && (
            <ConfigBonoMetaForm config={configBonoMeta} onChange={setConfigBonoMeta} />
          )}
          {esquema.tipo === 'bono_kpi' && configBonoKPI && (
            <ConfigBonoKPIForm config={configBonoKPI} onChange={setConfigBonoKPI} />
          )}
          {esquema.tipo === 'bono_fijo' && configBonoFijo && (
            <ConfigBonoFijoForm config={configBonoFijo} onChange={setConfigBonoFijo} />
          )}
        </div>
      </div>
    </FormModalV2>
  );
};

export default EditarEsquemaIncentivoModal;
