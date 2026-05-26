/**
 * NuevoEsquemaIncentivoModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F5.B · 2026-05-26
 *
 * Wizard 3 pasos canon FormModalV2 violet · Crea esquema de incentivo.
 *
 * Pasos:
 *  1. Tipo (4 cards · Comisión · Bono Meta · Bono KPI · Bono Fijo)
 *  2. Datos base (nombre · descripción · aplicableA · vigencia)
 *  3. Configuración específica del tipo seleccionado
 *
 * Autoguardado: BorradorWizard (canon Borrador + Descartar 2026-05-07).
 * Tipo: 'esquema_incentivo' (declarado en TipoBorradorWizard).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Trophy,
  DollarSign,
  Target,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Save,
  Plus,
  Trash2,
  Info,
} from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { esquemaIncentivoService } from '../../../services/esquemaIncentivo.service';
import { borradorWizardService } from '../../../services/borradorWizard.service';
import { userService } from '../../../services/user.service';
import type {
  TipoIncentivo,
  AplicabilidadIncentivo,
  ConfigComision,
  ConfigBonoMeta,
  ConfigBonoKPI,
  ConfigBonoFijo,
  EscalaComision,
  AplicarSobre,
  ModeloComision,
  MetricaMeta,
  MetricaKPI,
  FrecuenciaBonoFijo,
} from '../../../types/planilla.types';
import {
  TIPO_INCENTIVO_LABELS,
  TIPO_INCENTIVO_DESCRIPCION,
} from '../../../types/planilla.types';
import type { UserProfile, UserRole } from '../../../types/auth.types';
import { ROLE_LABELS, getUserRoles } from '../../../types/auth.types';
import { formatCurrencyPEN } from '../../../utils/format';
import { useAuthStore } from '../../../store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

// ───── Estado del wizard ─────

interface WizardState {
  paso: 1 | 2 | 3;
  tipo: TipoIncentivo | null;
  // Paso 2
  nombre: string;
  descripcion: string;
  aplicableA: AplicabilidadIncentivo;
  vigenteDesde: string;
  vigenteHasta: string;
  // Paso 3 · una config por tipo (solo se usa la del tipo seleccionado)
  configComision: ConfigComision;
  configBonoMeta: ConfigBonoMeta;
  configBonoKPI: ConfigBonoKPI;
  configBonoFijo: ConfigBonoFijo;
}

const INITIAL_STATE: WizardState = {
  paso: 1,
  tipo: null,
  nombre: '',
  descripcion: '',
  aplicableA: { modo: 'todos' },
  vigenteDesde: new Date().toISOString().slice(0, 10),
  vigenteHasta: '',
  configComision: {
    aplicarSobre: 'totalVenta',
    modelo: 'porcentaje_simple',
    porcentaje: 3,
  },
  configBonoMeta: {
    metricaTracked: 'cantidad_envios_entregados',
    objetivoMensual: 50,
    bonoSiCumple: 300,
  },
  configBonoKPI: {
    metricaTracked: 'cierre_mensual_antes_dia_5',
    formulaDescripcion: '',
    bonoSiCumple: 500,
    evaluacionManual: true,
  },
  configBonoFijo: {
    monto: 1000,
    moneda: 'PEN',
    frecuencia: 'mensual',
    condicionado: false,
  },
};

// ───── Mapeos canon ─────

const TIPO_ICONS: Record<TipoIncentivo, React.ComponentType<{ className?: string }>> = {
  comision: DollarSign,
  bono_meta: Target,
  bono_kpi: TrendingUp,
  bono_fijo: Calendar,
};

const TIPO_TINTE: Record<TipoIncentivo, { bg: string; border: string; text: string; ring: string }> = {
  comision: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', ring: 'ring-emerald-300' },
  bono_meta: { bg: 'bg-sky-50', border: 'border-sky-300', text: 'text-sky-700', ring: 'ring-sky-300' },
  bono_kpi: { bg: 'bg-teal-50', border: 'border-teal-300', text: 'text-teal-700', ring: 'ring-teal-300' },
  bono_fijo: { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700', ring: 'ring-indigo-300' },
};

// ───── COMPONENT ─────

export const NuevoEsquemaIncentivoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  onError,
}) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [autoSave, setAutoSave] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Cargar borrador al abrir (si existe) + lista de usuarios
  useEffect(() => {
    if (!isOpen || !userProfile) return;
    (async () => {
      try {
        const [borrador, todosUsers] = await Promise.all([
          borradorWizardService.get(userProfile.uid, 'esquema_incentivo'),
          userService.getAll(),
        ]);
        setUsuarios(todosUsers.filter((u) => u.activo));
        if (borrador?.estado) {
          // Reanudar wizard desde el snapshot
          setState({ ...INITIAL_STATE, ...(borrador.estado as Partial<WizardState>) });
        } else {
          setState(INITIAL_STATE);
        }
      } catch (err) {
        console.error('[NuevoEsquemaIncentivoModal] error cargando borrador:', err);
      }
    })();
  }, [isOpen, userProfile]);

  // Autoguardado a cada cambio (debounce 800ms)
  useEffect(() => {
    if (!isOpen || !userProfile || state === INITIAL_STATE) return;
    setAutoSave('saving');
    const t = window.setTimeout(async () => {
      try {
        await borradorWizardService.save({
          tipo: 'esquema_incentivo',
          userId: userProfile.uid,
          pasoActual: state.paso,
          estado: state as unknown as Record<string, any>,
          resumen: state.nombre || `Esquema ${state.tipo ?? 'sin tipo'} (sin nombre)`,
        });
        setAutoSave('saved');
      } catch (err) {
        console.error('[NuevoEsquemaIncentivoModal] error guardando borrador:', err);
        setAutoSave('idle');
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [state, isOpen, userProfile]);

  // ───── Validaciones por paso ─────
  const validacionPaso = useMemo(() => {
    if (state.paso === 1) return state.tipo !== null;
    if (state.paso === 2) return state.nombre.trim().length > 0 && state.vigenteDesde !== '';
    if (state.paso === 3) {
      if (state.tipo === 'comision') {
        const c = state.configComision;
        if (c.modelo === 'porcentaje_simple') return (c.porcentaje ?? 0) > 0;
        if (c.modelo === 'monto_fijo_por_venta') return (c.montoFijo ?? 0) > 0;
        if (c.modelo === 'escalado') return (c.escalas?.length ?? 0) >= 1;
      }
      if (state.tipo === 'bono_meta') return state.configBonoMeta.objetivoMensual > 0 && state.configBonoMeta.bonoSiCumple > 0;
      if (state.tipo === 'bono_kpi')
        return state.configBonoKPI.formulaDescripcion.trim().length > 0 && state.configBonoKPI.bonoSiCumple > 0;
      if (state.tipo === 'bono_fijo') return state.configBonoFijo.monto > 0;
    }
    return false;
  }, [state]);

  // ───── Navegación ─────
  const irAlPaso = (paso: 1 | 2 | 3) => setState((s) => ({ ...s, paso }));
  const siguiente = () => {
    if (state.paso < 3) irAlPaso((state.paso + 1) as 1 | 2 | 3);
  };
  const anterior = () => {
    if (state.paso > 1) irAlPaso((state.paso - 1) as 1 | 2 | 3);
  };

  // ───── Submit final ─────
  const guardar = async () => {
    if (!validacionPaso || submitting || !userProfile || !state.tipo) return;
    setSubmitting(true);
    try {
      const configuracion =
        state.tipo === 'comision'
          ? state.configComision
          : state.tipo === 'bono_meta'
            ? state.configBonoMeta
            : state.tipo === 'bono_kpi'
              ? state.configBonoKPI
              : state.configBonoFijo;

      await esquemaIncentivoService.crear(
        {
          nombre: state.nombre.trim(),
          descripcion: state.descripcion.trim() || undefined,
          tipo: state.tipo,
          aplicableA: state.aplicableA,
          vigenteDesde: new Date(state.vigenteDesde),
          vigenteHasta: state.vigenteHasta ? new Date(state.vigenteHasta) : undefined,
          configuracion,
        },
        userProfile.uid,
      );
      // Limpiar borrador al confirmar
      await borradorWizardService.delete(userProfile.uid, 'esquema_incentivo');
      onSuccess?.(`Esquema "${state.nombre}" creado · ${TIPO_INCENTIVO_LABELS[state.tipo]}`);
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al crear esquema');
    } finally {
      setSubmitting(false);
    }
  };

  const descartarBorrador = async () => {
    if (!userProfile) return;
    if (!window.confirm('¿Descartar este borrador? El progreso se perderá.')) return;
    try {
      await borradorWizardService.delete(userProfile.uid, 'esquema_incentivo');
      setState(INITIAL_STATE);
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al descartar borrador');
    }
  };

  // ───── Render helpers ─────

  const stepperUI = (
    <div className="flex items-center gap-2 px-1 py-3">
      {[1, 2, 3].map((n) => {
        const activo = state.paso === n;
        const completo = state.paso > n;
        return (
          <React.Fragment key={n}>
            <div
              className={`flex items-center gap-2 px-2 py-1 rounded ${
                activo
                  ? 'bg-violet-100 text-violet-900 font-bold'
                  : completo
                    ? 'text-emerald-700 font-semibold'
                    : 'text-slate-400'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center ${
                  activo
                    ? 'bg-violet-600 text-white'
                    : completo
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {completo ? '✓' : n}
              </div>
              <span className="text-[11px]">
                {n === 1 ? 'Tipo' : n === 2 ? 'Datos' : 'Config'}
              </span>
            </div>
            {n < 3 && <div className="flex-1 h-px bg-slate-200" />}
          </React.Fragment>
        );
      })}
    </div>
  );

  // ───── Paso 1 · Tipo ─────
  const paso1 = (
    <div className="space-y-3">
      <p className="text-[12px] text-slate-600">
        Elegí el tipo de incentivo que querés configurar. Cada tipo aplica a perfiles laborales
        distintos.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(Object.entries(TIPO_INCENTIVO_LABELS) as [TipoIncentivo, string][]).map(([tipo, label]) => {
          const Icon = TIPO_ICONS[tipo];
          const tinte = TIPO_TINTE[tipo];
          const seleccionado = state.tipo === tipo;
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => setState((s) => ({ ...s, tipo }))}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                seleccionado
                  ? `${tinte.bg} ${tinte.border} ring-2 ${tinte.ring}`
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className={`w-9 h-9 ${tinte.bg} rounded-lg flex items-center justify-center mb-2`}>
                <Icon className={`w-5 h-5 ${tinte.text}`} />
              </div>
              <div className="text-[13px] font-bold text-slate-900 mb-0.5">{label}</div>
              <div className="text-[11px] text-slate-600">{TIPO_INCENTIVO_DESCRIPCION[tipo]}</div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ───── Paso 2 · Datos base ─────
  const paso2 = (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          Nombre del esquema <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={state.nombre}
          onChange={(e) => setState((s) => ({ ...s, nombre: e.target.value }))}
          placeholder="Ej. Comisión vendedores Lima · Bono meta logística..."
          className="w-full text-[13px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          Descripción <span className="text-slate-400 font-normal">(opcional)</span>
        </label>
        <textarea
          value={state.descripcion}
          onChange={(e) => setState((s) => ({ ...s, descripcion: e.target.value }))}
          rows={2}
          placeholder="Contexto interno · cómo se calcula · referencia a decisión gerencial..."
          className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />
      </div>

      {/* Aplicabilidad */}
      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          Aplica a <span className="text-rose-500">*</span>
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[12px] cursor-pointer">
            <input
              type="radio"
              checked={state.aplicableA.modo === 'todos'}
              onChange={() => setState((s) => ({ ...s, aplicableA: { modo: 'todos' } }))}
            />
            <span>Todos los empleados activos</span>
          </label>
          <label className="flex items-center gap-2 text-[12px] cursor-pointer">
            <input
              type="radio"
              checked={state.aplicableA.modo === 'rol'}
              onChange={() =>
                setState((s) => ({ ...s, aplicableA: { modo: 'rol', rol: 'vendedor' } }))
              }
            />
            <span>Solo usuarios con un rol específico</span>
          </label>
          {state.aplicableA.modo === 'rol' && (
            <select
              value={state.aplicableA.rol}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  aplicableA: { modo: 'rol', rol: e.target.value as UserRole },
                }))
              }
              className="ml-6 text-[12px] border border-slate-300 rounded px-2 py-1 bg-white"
            >
              {(['vendedor', 'comprador', 'almacenero', 'finanzas', 'supervisor', 'gerente'] as UserRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-[12px] cursor-pointer">
            <input
              type="radio"
              checked={state.aplicableA.modo === 'usuarios'}
              onChange={() =>
                setState((s) => ({
                  ...s,
                  aplicableA: { modo: 'usuarios', userIds: [] },
                }))
              }
            />
            <span>Usuarios específicos</span>
          </label>
          {state.aplicableA.modo === 'usuarios' && (
            <div className="ml-6 space-y-1 max-h-40 overflow-y-auto bg-slate-50 border border-slate-200 rounded p-2">
              {usuarios.length === 0 ? (
                <div className="text-[11px] text-slate-500 italic">Sin usuarios activos</div>
              ) : (
                usuarios.map((u) => {
                  const seleccionado = state.aplicableA.modo === 'usuarios' && state.aplicableA.userIds.includes(u.uid);
                  return (
                    <label key={u.uid} className="flex items-center gap-2 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        onChange={() =>
                          setState((s) => {
                            if (s.aplicableA.modo !== 'usuarios') return s;
                            const ids = s.aplicableA.userIds.includes(u.uid)
                              ? s.aplicableA.userIds.filter((id) => id !== u.uid)
                              : [...s.aplicableA.userIds, u.uid];
                            return { ...s, aplicableA: { modo: 'usuarios', userIds: ids } };
                          })
                        }
                      />
                      <span className="font-semibold">{u.displayName}</span>
                      <span className="text-slate-500 text-[10px]">{getUserRoles(u).join(', ')}</span>
                    </label>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Vigencia */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Vigente desde <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={state.vigenteDesde}
            onChange={(e) => setState((s) => ({ ...s, vigenteDesde: e.target.value }))}
            className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Vigente hasta <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <input
            type="date"
            value={state.vigenteHasta}
            onChange={(e) => setState((s) => ({ ...s, vigenteHasta: e.target.value }))}
            min={state.vigenteDesde || undefined}
            className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>
    </div>
  );

  // ───── Paso 3 · Config por tipo ─────
  const paso3 = (
    <div className="space-y-4">
      {state.tipo === 'comision' && (
        <ConfigComisionForm
          config={state.configComision}
          onChange={(c) => setState((s) => ({ ...s, configComision: c }))}
        />
      )}
      {state.tipo === 'bono_meta' && (
        <ConfigBonoMetaForm
          config={state.configBonoMeta}
          onChange={(c) => setState((s) => ({ ...s, configBonoMeta: c }))}
        />
      )}
      {state.tipo === 'bono_kpi' && (
        <ConfigBonoKPIForm
          config={state.configBonoKPI}
          onChange={(c) => setState((s) => ({ ...s, configBonoKPI: c }))}
        />
      )}
      {state.tipo === 'bono_fijo' && (
        <ConfigBonoFijoForm
          config={state.configBonoFijo}
          onChange={(c) => setState((s) => ({ ...s, configBonoFijo: c }))}
        />
      )}
    </div>
  );

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={state.paso === 3 ? guardar : siguiente}
      title="Nuevo esquema de incentivo"
      subtitle={`Paso ${state.paso} de 3 · ${state.paso === 1 ? 'Tipo' : state.paso === 2 ? 'Datos base + aplicabilidad' : 'Configuración específica'}`}
      icon={Trophy}
      iconTone="purple"
      size="lg"
      submitLabel={state.paso === 3 ? (submitting ? 'Guardando...' : 'Crear esquema') : 'Siguiente'}
      submitVariant="primary-soft"
      submitIcon={state.paso === 3 ? Save : ChevronRight}
      loading={submitting}
      disabled={!validacionPaso}
      autoSaveStatus={autoSave}
      autoSaveLabel="hace segundos"
      footerExtras={
        <>
          {state.paso > 1 && (
            <button
              type="button"
              onClick={anterior}
              className="text-[11px] text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-3 h-3" />
              Anterior
            </button>
          )}
          <button
            type="button"
            onClick={descartarBorrador}
            className="text-[11px] text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Descartar
          </button>
        </>
      }
    >
      {stepperUI}
      {state.paso === 1 && paso1}
      {state.paso === 2 && paso2}
      {state.paso === 3 && paso3}
    </FormModalV2>
  );
};

export default NuevoEsquemaIncentivoModal;

// ═════════════════════════════════════════════════════════════════════════
// SUB-FORMS · uno por cada tipo de incentivo
// ═════════════════════════════════════════════════════════════════════════

export interface ConfigComisionFormProps {
  config: ConfigComision;
  onChange: (c: ConfigComision) => void;
}
export const ConfigComisionForm: React.FC<ConfigComisionFormProps> = ({ config, onChange }) => {
  return (
    <div className="space-y-3">
      <div className="bg-emerald-50 border border-emerald-200 rounded p-2 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-emerald-900">
          La comisión se calcula sobre las ventas del mes asignadas al empleado vendedor.
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">Aplicar sobre</label>
        <select
          value={config.aplicarSobre}
          onChange={(e) => onChange({ ...config, aplicarSobre: e.target.value as AplicarSobre })}
          className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 bg-white"
        >
          <option value="totalVenta">Total de la venta (gross)</option>
          <option value="margenContribucion">Margen de contribución</option>
          <option value="monto">Monto fijo por venta</option>
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">Modelo</label>
        <select
          value={config.modelo}
          onChange={(e) => onChange({ ...config, modelo: e.target.value as ModeloComision })}
          className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 bg-white"
        >
          <option value="porcentaje_simple">Porcentaje simple</option>
          <option value="escalado">Escalado por monto</option>
          <option value="monto_fijo_por_venta">Monto fijo por venta</option>
        </select>
      </div>

      {config.modelo === 'porcentaje_simple' && (
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Porcentaje (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={config.porcentaje ?? 0}
            onChange={(e) => onChange({ ...config, porcentaje: Number(e.target.value) })}
            className="w-32 text-[12px] tabular-nums border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
      )}

      {config.modelo === 'monto_fijo_por_venta' && (
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Monto por venta (S/)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={config.montoFijo ?? 0}
            onChange={(e) => onChange({ ...config, montoFijo: Number(e.target.value) })}
            className="w-32 text-[12px] tabular-nums border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
      )}

      {config.modelo === 'escalado' && (
        <EscalasEditor
          escalas={config.escalas ?? []}
          onChange={(escalas) => onChange({ ...config, escalas })}
        />
      )}
    </div>
  );
};

const EscalasEditor: React.FC<{ escalas: EscalaComision[]; onChange: (e: EscalaComision[]) => void }> = ({
  escalas,
  onChange,
}) => {
  const agregar = () => {
    const ultima = escalas[escalas.length - 1];
    const desde = ultima ? (ultima.hastaS ?? 0) : 0;
    onChange([...escalas, { desdeS: desde, hastaS: undefined, porcentaje: 3 }]);
  };
  const eliminar = (i: number) => onChange(escalas.filter((_, idx) => idx !== i));
  const actualizar = (i: number, patch: Partial<EscalaComision>) => {
    onChange(escalas.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-bold text-slate-700">Escalas</label>
        <button
          type="button"
          onClick={agregar}
          className="text-[11px] font-semibold text-violet-700 inline-flex items-center gap-0.5 hover:bg-violet-50 px-1.5 py-0.5 rounded"
        >
          <Plus className="w-3 h-3" />
          Agregar
        </button>
      </div>
      {escalas.length === 0 ? (
        <div className="text-[11px] text-slate-500 italic">Sin escalas · agregá al menos una</div>
      ) : (
        <div className="space-y-1.5">
          {escalas.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-500">Desde S/</span>
              <input
                type="number"
                value={e.desdeS}
                onChange={(ev) => actualizar(i, { desdeS: Number(ev.target.value) })}
                className="w-24 tabular-nums border border-slate-300 rounded px-1.5 py-0.5"
              />
              <span className="text-slate-500">hasta S/</span>
              <input
                type="number"
                value={e.hastaS ?? ''}
                placeholder="sin tope"
                onChange={(ev) =>
                  actualizar(i, { hastaS: ev.target.value === '' ? undefined : Number(ev.target.value) })
                }
                className="w-24 tabular-nums border border-slate-300 rounded px-1.5 py-0.5"
              />
              <span className="text-slate-500">→</span>
              <input
                type="number"
                step={0.5}
                value={e.porcentaje}
                onChange={(ev) => actualizar(i, { porcentaje: Number(ev.target.value) })}
                className="w-16 tabular-nums border border-slate-300 rounded px-1.5 py-0.5"
              />
              <span className="text-slate-500">%</span>
              <button
                type="button"
                onClick={() => eliminar(i)}
                className="text-rose-600 hover:bg-rose-50 p-0.5 rounded"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export interface ConfigBonoMetaFormProps {
  config: ConfigBonoMeta;
  onChange: (c: ConfigBonoMeta) => void;
}
export const ConfigBonoMetaForm: React.FC<ConfigBonoMetaFormProps> = ({ config, onChange }) => {
  return (
    <div className="space-y-3">
      <div className="bg-sky-50 border border-sky-200 rounded p-2 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-sky-700 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-sky-900">
          Se paga bono si el empleado cumple la meta cuantitativa del mes.
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">Métrica</label>
        <select
          value={config.metricaTracked}
          onChange={(e) => onChange({ ...config, metricaTracked: e.target.value as MetricaMeta })}
          className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 bg-white"
        >
          <option value="cantidad_envios_entregados">Cantidad de envíos entregados</option>
          <option value="tasa_entrega_a_tiempo">Tasa de entrega a tiempo (%)</option>
          <option value="cantidad_ordenes_compra">Cantidad de órdenes de compra</option>
          <option value="tasa_ordenes_completas">Tasa de OC completas (%)</option>
          <option value="cantidad_reclamos_resueltos">Reclamos resueltos</option>
          <option value="custom">Custom (validación manual)</option>
        </select>
      </div>

      {config.metricaTracked === 'custom' && (
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Nombre métrica custom</label>
          <input
            type="text"
            value={config.metricaCustomNombre ?? ''}
            onChange={(e) => onChange({ ...config, metricaCustomNombre: e.target.value })}
            placeholder="Ej. Casos resueltos · Eventos coordinados..."
            className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Objetivo mensual</label>
          <input
            type="number"
            min={1}
            value={config.objetivoMensual}
            onChange={(e) => onChange({ ...config, objetivoMensual: Number(e.target.value) })}
            className="w-full text-[12px] tabular-nums border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Bono si cumple (S/)</label>
          <input
            type="number"
            min={0}
            step={50}
            value={config.bonoSiCumple}
            onChange={(e) => onChange({ ...config, bonoSiCumple: Number(e.target.value) })}
            className="w-full text-[12px] tabular-nums border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded p-3">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
          BONO POR EXCESO (OPCIONAL)
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1">S/ por unidad excedida</label>
            <input
              type="number"
              min={0}
              value={config.bonoExtraporExceso?.porUnidad ?? 0}
              onChange={(e) =>
                onChange({
                  ...config,
                  bonoExtraporExceso: {
                    porUnidad: Number(e.target.value),
                    topeMaximo: config.bonoExtraporExceso?.topeMaximo,
                  },
                })
              }
              className="w-full text-[11px] tabular-nums border border-slate-300 rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1">Tope máximo extra (S/)</label>
            <input
              type="number"
              min={0}
              value={config.bonoExtraporExceso?.topeMaximo ?? ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  bonoExtraporExceso: {
                    porUnidad: config.bonoExtraporExceso?.porUnidad ?? 0,
                    topeMaximo: e.target.value === '' ? undefined : Number(e.target.value),
                  },
                })
              }
              placeholder="sin tope"
              className="w-full text-[11px] tabular-nums border border-slate-300 rounded px-2 py-1"
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-violet-50 border border-violet-200 rounded p-3">
        <div className="text-[10px] uppercase tracking-wider text-violet-700 font-bold mb-1">PREVIEW</div>
        <div className="text-[12px] text-violet-900">
          Si el empleado alcanza <strong>{config.objetivoMensual}</strong> · cobra{' '}
          <strong>{formatCurrencyPEN(config.bonoSiCumple)}</strong>
          {config.bonoExtraporExceso?.porUnidad ? (
            <>
              {' '}+ {formatCurrencyPEN(config.bonoExtraporExceso.porUnidad)} por cada unidad extra
              {config.bonoExtraporExceso.topeMaximo
                ? ` (tope ${formatCurrencyPEN(config.bonoExtraporExceso.topeMaximo)})`
                : ''}
            </>
          ) : null}
          .
        </div>
      </div>
    </div>
  );
};

export interface ConfigBonoKPIFormProps {
  config: ConfigBonoKPI;
  onChange: (c: ConfigBonoKPI) => void;
}
export const ConfigBonoKPIForm: React.FC<ConfigBonoKPIFormProps> = ({ config, onChange }) => {
  return (
    <div className="space-y-3">
      <div className="bg-teal-50 border border-teal-200 rounded p-2 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-teal-700 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-teal-900">
          Bono cualitativo · típico para finanzas/gerencia · requiere validación humana mensual.
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">KPI tracked</label>
        <select
          value={config.metricaTracked}
          onChange={(e) => onChange({ ...config, metricaTracked: e.target.value as MetricaKPI })}
          className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 bg-white"
        >
          <option value="cierre_mensual_antes_dia_5">Cierre mensual antes del día 5</option>
          <option value="conciliacion_bancaria_completa">Conciliación bancaria completa</option>
          <option value="reportes_a_tiempo">Reportes a tiempo</option>
          <option value="dso_bajo_X_dias">DSO bajo X días</option>
          <option value="cartera_vencida_menor_X_pct">Cartera vencida menor X%</option>
          <option value="custom">Custom (definir manualmente)</option>
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          Descripción de la fórmula / criterio <span className="text-rose-500">*</span>
        </label>
        <textarea
          value={config.formulaDescripcion}
          onChange={(e) => onChange({ ...config, formulaDescripcion: e.target.value })}
          rows={2}
          placeholder="Ej. Si DSO < 30 días Y cartera vencida < 10% Y conciliación cerrada"
          className="w-full text-[12px] border border-slate-300 rounded-lg px-3 py-2 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Bono si cumple (S/)</label>
          <input
            type="number"
            min={0}
            step={50}
            value={config.bonoSiCumple}
            onChange={(e) => onChange({ ...config, bonoSiCumple: Number(e.target.value) })}
            className="w-full text-[12px] tabular-nums border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-[11px] cursor-pointer">
            <input
              type="checkbox"
              checked={config.evaluacionManual}
              onChange={(e) => onChange({ ...config, evaluacionManual: e.target.checked })}
            />
            <span>Requiere validación humana</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export interface ConfigBonoFijoFormProps {
  config: ConfigBonoFijo;
  onChange: (c: ConfigBonoFijo) => void;
}
export const ConfigBonoFijoForm: React.FC<ConfigBonoFijoFormProps> = ({ config, onChange }) => {
  return (
    <div className="space-y-3">
      <div className="bg-indigo-50 border border-indigo-200 rounded p-2 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-indigo-700 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-indigo-900">
          Monto fijo recurrente · típico para gerencia. Puede ser mensual · trimestral · etc.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Monto</label>
          <input
            type="number"
            min={0}
            step={100}
            value={config.monto}
            onChange={(e) => onChange({ ...config, monto: Number(e.target.value) })}
            className="w-full text-[13px] tabular-nums border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Moneda</label>
          <select
            value={config.moneda}
            onChange={(e) => onChange({ ...config, moneda: e.target.value as 'PEN' | 'USD' })}
            className="w-full text-[13px] border border-slate-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="PEN">PEN</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">Frecuencia</label>
        <div className="grid grid-cols-4 gap-1.5">
          {(['mensual', 'trimestral', 'semestral', 'anual'] as FrecuenciaBonoFijo[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onChange({ ...config, frecuencia: f })}
              className={`text-[11px] py-1.5 rounded border ${
                config.frecuencia === f
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-800 font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-[11px] cursor-pointer mb-1">
          <input
            type="checkbox"
            checked={config.condicionado}
            onChange={(e) => onChange({ ...config, condicionado: e.target.checked })}
          />
          <strong>Sujeto a aprobación gerencial mensual</strong>
        </label>
        {config.condicionado && (
          <input
            type="text"
            value={config.condicion ?? ''}
            onChange={(e) => onChange({ ...config, condicion: e.target.value })}
            placeholder="Describí la condición (ej. cumplimiento de metas globales)"
            className="w-full text-[11px] border border-slate-300 rounded px-2 py-1 ml-6"
          />
        )}
      </div>

      <div className="bg-violet-50 border border-violet-200 rounded p-3">
        <div className="text-[10px] uppercase tracking-wider text-violet-700 font-bold mb-1">PREVIEW</div>
        <div className="text-[12px] text-violet-900">
          {config.moneda === 'PEN' ? formatCurrencyPEN(config.monto) : `US$ ${config.monto.toLocaleString('es-PE')}`}{' '}
          · {config.frecuencia}
          {config.condicionado ? ' · con aprobación gerencial' : ' · automático'}
        </div>
      </div>
    </div>
  );
};
