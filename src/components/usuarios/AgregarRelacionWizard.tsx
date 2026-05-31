/**
 * AgregarRelacionWizard.tsx · chk5.PERSONAS-v5.6 · E5.3 (2026-05-28)
 *
 * Wizard de 2 pasos para agregar una NUEVA relación a un usuario EXISTENTE.
 * Distinto del CrearUsuarioWizard (que crea User + relación inicial) · este
 * solo crea una relación adicional para un user ya creado.
 *
 * CASOS DE USO TÍPICOS (canon v5.6):
 *   - Empleado decide también ser socio · agregar relación 'socio' al user
 *   - Honorarios consultor empieza a ser proveedor con RUC propio
 *   - Socio fundador decide trabajar full-time · agregar relación 'empleado'
 *
 * PASOS:
 *   1. Tipo de relación
 *      - 4 cards selectores: empleado · honorarios · socio · externo
 *      - DESHABILITADO si el user ya tiene una vigente del mismo tipo
 *        (canon · 1 relación vigente por tipo · ojo: NO confundir con
 *        múltiples relaciones HISTÓRICAS del mismo tipo · esas sí permitidas)
 *
 *   2. Datos del tipo (idéntico al paso 3 del CrearUsuarioWizard):
 *      - Empleado: cargo + salario + moneda + subtipo
 *      - Honorarios: cargo + tarifa + moneda + subtipo
 *      - Socio: cargo + subtipo
 *      - Externo: subtipo + vinculación Maestros (v5.8)
 *
 * SUBMIT:
 *   - relacionesLaboralesService.create(input, creadoPor)
 *   - onSuccess refresca cache del user · UserPanel muestra la nueva relación
 *
 * NO incluye borrador automático (es flujo corto · 2 pasos · max ~30s).
 * SI se quiere agregar en el futuro · seguir patrón de CrearUsuarioWizard E4.4.
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  AlertTriangle,
  Loader2,
  Briefcase,
  FileText,
  Handshake,
  User as UserIcon,
  Building2,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { relacionesLaboralesService } from '../../services/relacionesLaborales.service';
import { Timestamp } from 'firebase/firestore';
import type {
  RelacionLaboral,
  TipoRelacion,
  SubTipoRelacion,
  TipoEntidadMaestro,
  CrearRelacionInput,
} from '../../types/relacionLaboral.types';
import {
  TIPO_RELACION_LABELS,
  TIPO_RELACION_ICONS,
  TIPO_RELACION_COLORS,
  getRelacionesActivas,
} from '../../types/relacionLaboral.types';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface AgregarRelacionWizardProps {
  isOpen: boolean;
  userId: string | null;
  userDisplayName?: string;
  /** Relaciones vigentes del user · usadas para deshabilitar tipos ya existentes */
  relacionesVigentes: RelacionLaboral[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// STATE
// ═════════════════════════════════════════════════════════════════════════

interface WizardState {
  tipo: TipoRelacion | null;
  subTipo: string;
  cargoDisplay: string;
  monto: number | null;
  moneda: 'PEN' | 'USD';
  notas: string;
  // Externo + vinculación Maestros (v5.8)
  vincularConMaestro: boolean;
  maestroTipo: TipoEntidadMaestro;
  maestroNombre: string;
  maestroId: string;
  rolEnEntidad: string;
}

const INITIAL: WizardState = {
  tipo: null,
  subTipo: '',
  cargoDisplay: '',
  monto: null,
  moneda: 'PEN',
  notas: '',
  vincularConMaestro: false,
  maestroTipo: 'proveedor',
  maestroNombre: '',
  maestroId: '',
  rolEnEntidad: '',
};

const SUBTIPOS: Record<TipoRelacion, Array<{ value: string; label: string }>> = {
  empleado: [
    { value: 'full_time', label: 'Full time' },
    { value: 'medio_tiempo', label: 'Medio tiempo' },
    { value: 'por_horas', label: 'Por horas' },
    { value: 'practicante', label: 'Practicante' },
    { value: 'tercerizado', label: 'Tercerizado' },
  ],
  honorarios: [
    { value: 'consultor', label: 'Consultor' },
    { value: 'asesor', label: 'Asesor' },
    { value: 'profesional_servicios', label: 'Servicios profesionales' },
    { value: 'freelance', label: 'Freelance' },
  ],
  socio: [
    { value: 'fundador', label: 'Fundador' },
    { value: 'inversor', label: 'Inversor' },
    { value: 'minoritario', label: 'Minoritario' },
    { value: 'estrategico', label: 'Estratégico' },
  ],
  externo: [
    { value: 'contacto_proveedor', label: '🛒 Contacto de proveedor' },
    { value: 'contacto_cliente', label: '💼 Contacto de cliente (B2B)' },
    { value: 'cliente_vip', label: '⭐ Cliente VIP' },
    { value: 'tercerizado_logistico', label: '🚚 Tercerizado logístico' },
    { value: 'colaborador_marketing', label: '📸 Colaborador marketing' },
    { value: 'contacto_marca', label: '🤝 Contacto de marca aliada' },
    { value: 'auditor_externo', label: '🔍 Auditor externo' },
    { value: 'otro', label: 'Otro' },
  ],
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const AgregarRelacionWizard: React.FC<AgregarRelacionWizardProps> = ({
  isOpen,
  userId,
  userDisplayName,
  relacionesVigentes,
  onClose,
  onSuccess,
  onError,
}) => {
  const currentUser = useAuthStore((s) => s.userProfile);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [state, setState] = useState<WizardState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset al abrir
  React.useEffect(() => {
    if (isOpen) {
      setPaso(1);
      setState(INITIAL);
      setError(null);
    }
  }, [isOpen]);

  // ESC handler
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) => {
    setState((prev) => ({ ...prev, [k]: v }));
    setError(null);
  };

  // Tipos YA vigentes en el user · se deshabilitan en el paso 1
  const tiposVigentes = useMemo(() => {
    const activas = getRelacionesActivas(relacionesVigentes);
    return new Set(activas.map((r) => r.tipo));
  }, [relacionesVigentes]);

  // Validación
  const validar = (): string | null => {
    if (!state.tipo) return 'Elegí el tipo de relación';
    if (state.tipo === 'empleado' && !state.cargoDisplay.trim()) return 'Cargo requerido';
    if (state.tipo === 'externo' && state.vincularConMaestro && !state.maestroNombre.trim()) {
      return 'Si vinculás con Maestro, completá el nombre o desactivá la vinculación';
    }
    return null;
  };

  const handleSiguiente = () => {
    if (!state.tipo) {
      setError('Elegí el tipo de relación primero');
      return;
    }
    setPaso(2);
  };

  const handleAnterior = () => {
    setPaso(1);
    setError(null);
  };

  const handleSubmit = async () => {
    const err = validar();
    if (err) {
      setError(err);
      return;
    }
    if (!userId || !state.tipo) return;

    setSubmitting(true);
    setError(null);

    try {
      const input: CrearRelacionInput = {
        userId,
        tipo: state.tipo,
        subTipo: (state.subTipo || undefined) as SubTipoRelacion | undefined,
        estado: 'vigente',
        fechaInicio: Timestamp.now(),
        cargoDisplay: state.cargoDisplay.trim() || undefined,
        montoMensualReferencia:
          state.monto !== null && state.monto > 0 ? state.monto : undefined,
        monedaReferencia:
          state.monto !== null && state.monto > 0 ? state.moneda : undefined,
        notas: state.notas.trim() || undefined,
      };

      // Vinculación Maestros · solo si externo + checked + maestroId presente
      if (
        state.tipo === 'externo' &&
        state.vincularConMaestro &&
        state.maestroId.trim()
      ) {
        input.entidadMaestroRef = {
          tipo: state.maestroTipo,
          id: state.maestroId.trim(),
          rolEnEntidad: state.rolEnEntidad.trim() || undefined,
          nombreCachedSnapshot: state.maestroNombre.trim(),
        };
      }

      await relacionesLaboralesService.create(input, currentUser?.uid ?? 'system');

      onSuccess(
        `Relación ${TIPO_RELACION_LABELS[state.tipo]} agregada a ${userDisplayName ?? 'usuario'}`,
      );
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al agregar relación';
      setError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !userId) return null;

  const colors = state.tipo ? TIPO_RELACION_COLORS[state.tipo] : null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
              <Plus className="w-5 h-5 text-teal-700" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">Agregar nueva relación</h2>
              <p className="text-xs text-slate-500 truncate">
                {userDisplayName ? `a ${userDisplayName}` : 'Paso ' + paso + ' de 2'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 flex-shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 py-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className={`flex-1 h-1 rounded-full ${paso >= 1 ? 'bg-teal-600' : 'bg-slate-200'}`} />
            <div className={`flex-1 h-1 rounded-full ${paso >= 2 ? 'bg-teal-600' : 'bg-slate-200'}`} />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span className={paso === 1 ? 'text-teal-700 font-bold' : ''}>1 · Tipo</span>
            <span className={paso === 2 ? 'text-teal-700 font-bold' : ''}>2 · Datos</span>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && (
            <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-2.5 text-xs text-rose-900 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* PASO 1 · Tipo */}
          {paso === 1 && (
            <>
              <p className="text-sm text-slate-600">
                Elegí el tipo de la nueva relación. Los tipos ya vigentes están deshabilitados (se permite
                máximo 1 relación VIGENTE por tipo).
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(['empleado', 'honorarios', 'socio', 'externo'] as TipoRelacion[]).map((t) => {
                  const ya = tiposVigentes.has(t);
                  const activa = state.tipo === t;
                  const c = TIPO_RELACION_COLORS[t];
                  const Icon =
                    t === 'empleado'
                      ? Briefcase
                      : t === 'honorarios'
                        ? FileText
                        : t === 'socio'
                          ? Handshake
                          : UserIcon;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => !ya && set('tipo', t)}
                      disabled={ya}
                      className={`text-left p-4 rounded-xl transition-all ${
                        activa
                          ? `${c.bg} ring-2 ${c.ring}`
                          : ya
                            ? 'bg-slate-50 ring-1 ring-slate-200 opacity-50 cursor-not-allowed'
                            : 'bg-white ring-1 ring-slate-200 hover:ring-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div
                          className={`w-9 h-9 rounded-lg ${activa ? c.bg.replace('-100', '-200') : 'bg-slate-100'} flex items-center justify-center`}
                        >
                          <Icon className={`w-4 h-4 ${activa ? c.text : 'text-slate-600'}`} />
                        </div>
                        <div className={`font-bold ${activa ? c.text : 'text-slate-900'}`}>
                          {TIPO_RELACION_LABELS[t]}
                        </div>
                        {activa && <Check className={`w-4 h-4 ml-auto ${c.text}`} />}
                      </div>
                      {ya && (
                        <p className="text-[10px] text-slate-500 italic">Ya vigente · usá Editar o Reclasificar</p>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 flex items-start gap-2">
                <span className="text-base flex-shrink-0">💡</span>
                <span>
                  Una persona puede tener N relaciones simultáneas de tipos DISTINTOS (empleado + socio).
                  Si necesitás cambiar el tipo de una vigente · usá <strong>Reclasificar</strong>.
                </span>
              </div>
            </>
          )}

          {/* PASO 2 · Datos del tipo */}
          {paso === 2 && state.tipo && colors && (
            <>
              <div className={`${colors.bg} ring-1 ${colors.ring} rounded-lg p-2.5 text-xs ${colors.text} flex items-center gap-2`}>
                <span className="text-lg">{TIPO_RELACION_ICONS[state.tipo]}</span>
                <span>
                  Completá los datos de la nueva relación <strong>{TIPO_RELACION_LABELS[state.tipo]}</strong>
                </span>
              </div>

              {/* Cargo (todos los tipos) */}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
                  {state.tipo === 'empleado' ? 'Cargo *' : state.tipo === 'honorarios' ? 'Servicio / cargo' : state.tipo === 'socio' ? 'Rol / posición' : 'Cargo (opcional)'}
                </label>
                <input
                  type="text"
                  value={state.cargoDisplay}
                  onChange={(e) => set('cargoDisplay', e.target.value)}
                  placeholder={
                    state.tipo === 'empleado'
                      ? 'Ej. Account Manager'
                      : state.tipo === 'honorarios'
                        ? 'Ej. CFO consultor'
                        : state.tipo === 'socio'
                          ? 'Ej. Fundador · Inversor estratégico'
                          : 'Ej. Contacto comercial'
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              {/* Subtipo */}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
                  Subtipo (opcional)
                </label>
                <select
                  value={state.subTipo}
                  onChange={(e) => set('subTipo', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">— ninguno —</option>
                  {SUBTIPOS[state.tipo].map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Monto + moneda · empleado y honorarios */}
              {(state.tipo === 'empleado' || state.tipo === 'honorarios') && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
                      {state.tipo === 'empleado' ? 'Salario bruto mensual' : 'Tarifa mensual'} (opcional)
                    </label>
                    <input
                      type="number"
                      value={state.monto ?? ''}
                      onChange={(e) => set('monto', e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
                      Moneda
                    </label>
                    <select
                      value={state.moneda}
                      onChange={(e) => set('moneda', e.target.value as 'PEN' | 'USD')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="PEN">PEN</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Nota socio · explicación */}
              {state.tipo === 'socio' && (
                <div className="bg-violet-50 ring-1 ring-violet-200 rounded-lg p-3 text-xs text-violet-900 flex items-start gap-2">
                  <span className="flex-shrink-0">ℹ️</span>
                  <span>
                    El % de participación · aporte · distribuciones se configuran después en{' '}
                    <code className="bg-white px-1 rounded">/inversionistas</code>. Acá registramos solo la relación.
                  </span>
                </div>
              )}

              {/* Vinculación Maestros · solo externo (v5.8) */}
              {state.tipo === 'externo' && (
                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-200 rounded-xl p-4 space-y-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.vincularConMaestro}
                      onChange={(e) => set('vincularConMaestro', e.target.checked)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-bold text-indigo-900 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        Vincular con entidad de Maestros (v5.8)
                      </div>
                      <div className="text-xs text-indigo-700 mt-0.5">
                        Si es contacto de un proveedor/cliente/marca existente.
                      </div>
                    </div>
                  </label>

                  {state.vincularConMaestro && (
                    <div className="space-y-2 pt-2 border-t border-indigo-200">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 mb-1 block">
                          Tipo de entidad
                        </label>
                        <select
                          value={state.maestroTipo}
                          onChange={(e) => set('maestroTipo', e.target.value as TipoEntidadMaestro)}
                          className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-lg text-sm"
                        >
                          <option value="proveedor">Proveedor</option>
                          <option value="cliente">Cliente</option>
                          <option value="marca">Marca</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 mb-1 block">
                          Nombre de la entidad
                        </label>
                        <input
                          type="text"
                          value={state.maestroNombre}
                          onChange={(e) => set('maestroNombre', e.target.value)}
                          placeholder="Ej. Skin Labs SAC"
                          className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 mb-1 block">
                          ID de Maestro
                        </label>
                        <input
                          type="text"
                          value={state.maestroId}
                          onChange={(e) => set('maestroId', e.target.value)}
                          placeholder="ID interno · E7 conecta buscador real"
                          className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-lg text-sm font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 mb-1 block">
                          Rol en la entidad (opcional)
                        </label>
                        <input
                          type="text"
                          value={state.rolEnEntidad}
                          onChange={(e) => set('rolEnEntidad', e.target.value)}
                          placeholder="Ej. Sales Representative"
                          className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
                  Notas (opcional)
                </label>
                <textarea
                  rows={2}
                  value={state.notas}
                  onChange={(e) => set('notas', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="Detalles adicionales..."
                />
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancelar
          </button>
          <div className="flex items-center gap-2">
            {paso === 2 && (
              <button
                type="button"
                onClick={handleAnterior}
                disabled={submitting}
                className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Anterior
              </button>
            )}
            {paso === 1 ? (
              <button
                type="button"
                onClick={handleSiguiente}
                disabled={!state.tipo}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                Siguiente
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Agregar relación
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgregarRelacionWizard;
