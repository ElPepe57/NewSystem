/**
 * CrearUsuarioWizard.tsx · chk5.PERSONAS-v5.7 · E4.3 (2026-05-28)
 *
 * @deprecated 2026-05-28 · chk5.PERSONAS-v5.8
 * Reemplazado por NuevoEmpleadoModal (src/components/modules/planilla/NuevoEmpleadoModal.tsx)
 * y NuevoSocioModal (src/components/modules/inversionistas/NuevoSocioModal.tsx) para los
 * flujos más comunes. El wizard general sigue disponible desde /usuarios para tipos
 * externo/honorarios o cuando el admin necesita el flujo de 4 pasos completo.
 * NO invocar desde código nuevo para casos 'empleado' o 'socio'.
 *
 * Wizard de 4 pasos para crear un nuevo colaborador con relación inicial.
 * Reemplaza a NuevoUsuarioModal (queda @deprecated).
 *
 * PASOS:
 *   1. Identidad     · displayName · email · teléfono · password inicial
 *   2. Tipo relación · empleado / honorarios / socio / externo
 *   3. Datos del tipo (condicional por tipo elegido)
 *      - empleado: cargo · salario · moneda · subtipo
 *      - honorarios: cargo · tarifa · moneda · subtipo (consultor/asesor/etc)
 *      - socio: cargo · subtipo (fundador/inversor/etc)
 *      - externo: subtipo · vinculación con Maestro (v5.8 · NUEVO buscador)
 *   4. Permisos + acceso · rol del sistema (default 'invitado') · enviar invitación
 *
 * SUBMIT:
 *   1. userService.createUser(email, password, displayName, role)
 *      → crea UserProfile en Firestore + Firebase Auth
 *   2. relacionesLaboralesService.create({userId, tipo, ...})
 *      → crea RelacionLaboral inicial
 *   3. Si vinculación con Maestro → enriquece relación con entidadMaestroRef
 *   4. onSuccess(uid) · padre auto-abre UserPanel con userId=uid
 *
 * E4.4 agrega borrador automático (borradorWizardService) · canon 2026-05-07.
 *
 * E5+ refina:
 *   - Step 4 con buscador real de Maestros (E4.3 entrega placeholder de búsqueda)
 *   - Validaciones más estrictas
 *   - Resend integration para invitación
 */

import React, { useState } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Save,
  Trash2,
  User as UserIcon,
  Briefcase,
  FileText,
  Handshake,
  Building2,
  Mail,
  Phone,
  Lock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { userService } from '../../services/user.service';
import { relacionesLaboralesService } from '../../services/relacionesLaborales.service';
import { borradorWizardService } from '../../services/borradorWizard.service';
import { useAuthStore } from '../../store/authStore';
import { Timestamp } from 'firebase/firestore';
import type { UserRole, UserProfile } from '../../types/auth.types';
import { ROLE_LABELS } from '../../types/auth.types';
import type {
  TipoRelacion,
  SubTipoRelacion,
  TipoEntidadMaestro,
  CrearRelacionInput,
} from '../../types/relacionLaboral.types';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface CrearUsuarioWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Callback con el uid creado · padre auto-abre UserPanel */
  onSuccess: (uid: string) => void;
  /** Callback de error · padre muestra toast */
  onError: (msg: string) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// STATE DEL WIZARD
// ═════════════════════════════════════════════════════════════════════════

interface WizardState {
  // Paso 1 · Identidad
  displayName: string;
  email: string;
  telefono: string;
  password: string;

  // Paso 2 · Tipo de relación
  tipoRelacion: TipoRelacion | null;

  // Paso 3 · Datos del tipo
  cargoDisplay: string;
  subTipo: string;
  montoMensualReferencia: number | null;
  monedaReferencia: 'PEN' | 'USD';
  notasRelacion: string;
  // Vinculación con Maestro (solo si tipo='externo')
  vincularConMaestro: boolean;
  maestroTipo: TipoEntidadMaestro;
  maestroNombre: string; // placeholder · E4 conecta buscador real
  maestroId: string; // placeholder · E4 conecta buscador real
  rolEnEntidad: string;

  // Paso 4 · Permisos + acceso
  rol: UserRole;
  enviarInvitacion: boolean;
}

const INITIAL_STATE: WizardState = {
  displayName: '',
  email: '',
  telefono: '',
  password: '',
  tipoRelacion: null,
  cargoDisplay: '',
  subTipo: '',
  montoMensualReferencia: null,
  monedaReferencia: 'PEN',
  notasRelacion: '',
  vincularConMaestro: false,
  maestroTipo: 'proveedor',
  maestroNombre: '',
  maestroId: '',
  rolEnEntidad: '',
  rol: 'invitado',
  enviarInvitacion: true,
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export const CrearUsuarioWizard: React.FC<CrearUsuarioWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError,
}) => {
  const currentUser = useAuthStore((s) => s.userProfile);

  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  // chk5.PERSONAS-v5.7 · E4.4 · borrador canon
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);

  const set = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    setValidationError(null);
  };

  // ─── chk5.PERSONAS-v5.7 · E4.4 · BORRADOR canon 2026-05-07 ─────────────
  // Al abrir el wizard: si hay borrador del user logueado, lo restaura.
  // ID determinístico: ${userId}_colaborador · max 1 borrador por user.
  React.useEffect(() => {
    if (!isOpen || !currentUser?.uid || borradorRestaurado) return;
    void (async () => {
      try {
        const borrador = await borradorWizardService.get(currentUser.uid, 'colaborador');
        if (borrador && borrador.estado) {
          // Restauramos sólo si el state es del shape esperado
          const restored = borrador.estado as Partial<WizardState>;
          setState((prev) => ({ ...prev, ...restored }));
          if (typeof borrador.pasoActual === 'number' && borrador.pasoActual >= 1 && borrador.pasoActual <= 4) {
            setPaso(borrador.pasoActual as 1 | 2 | 3 | 4);
          }
        }
      } catch (err) {
        console.warn('[CrearUsuarioWizard] error restaurando borrador:', err);
      } finally {
        setBorradorRestaurado(true);
      }
    })();
  }, [isOpen, currentUser?.uid, borradorRestaurado]);

  // Auto-save · cada vez que cambia state significativamente (debounce simple via depEffect)
  React.useEffect(() => {
    if (!isOpen || !currentUser?.uid || !borradorRestaurado) return;
    // Solo guardar si hay algún dato meaningful (evita guardar el INITIAL_STATE vacío)
    const hayDatos = state.displayName.trim() || state.email.trim() || state.tipoRelacion;
    if (!hayDatos) return;

    const timer = setTimeout(() => {
      const resumen = state.displayName
        ? `${state.displayName}${state.tipoRelacion ? ` · ${state.tipoRelacion}` : ''}`
        : `Borrador sin nombre · paso ${paso}`;
      void borradorWizardService
        .save({
          tipo: 'colaborador',
          userId: currentUser.uid,
          pasoActual: paso,
          estado: state as unknown as Record<string, unknown>,
          resumen,
          montoEstimado: state.montoMensualReferencia ?? undefined,
        })
        .catch((err) => console.warn('[CrearUsuarioWizard] error guardando borrador:', err));
    }, 800);

    return () => clearTimeout(timer);
  }, [state, paso, isOpen, currentUser?.uid, borradorRestaurado]);

  // Limpia borrador al cerrar el wizard sin haber confirmado (estado INITIAL)
  // NOTA: NO limpia cuando el user cierra X · solo cuando descarta explícito o crea.
  const limpiarBorrador = async () => {
    if (currentUser?.uid) {
      try {
        await borradorWizardService.delete(currentUser.uid, 'colaborador');
      } catch (err) {
        console.warn('[CrearUsuarioWizard] error limpiando borrador:', err);
      }
    }
  };

  // ── Validación por paso ────────────────────────────────────────────────
  const validarPaso = (p: 1 | 2 | 3 | 4): string | null => {
    if (p === 1) {
      if (!state.displayName.trim() || state.displayName.trim().length < 3) {
        return 'Nombre completo requerido (mín 3 caracteres)';
      }
      if (!state.email.includes('@') || !state.email.includes('.')) {
        return 'Email inválido';
      }
      if (state.password.length < 8) {
        return 'Password mínimo 8 caracteres';
      }
    }
    if (p === 2) {
      if (!state.tipoRelacion) {
        return 'Elegí un tipo de relación';
      }
    }
    if (p === 3) {
      // Validaciones específicas por tipo
      if (state.tipoRelacion === 'empleado') {
        if (!state.cargoDisplay.trim()) return 'Cargo requerido';
      }
      if (state.tipoRelacion === 'externo' && state.vincularConMaestro) {
        if (!state.maestroNombre.trim()) {
          return 'Si vinculás con Maestro, completá el nombre o desactivá la vinculación.';
        }
      }
    }
    return null;
  };

  const handleSiguiente = () => {
    const err = validarPaso(paso);
    if (err) {
      setValidationError(err);
      return;
    }
    setPaso((p) => (p < 4 ? ((p + 1) as 1 | 2 | 3 | 4) : p));
    setValidationError(null);
  };

  const handleAnterior = () => {
    setPaso((p) => (p > 1 ? ((p - 1) as 1 | 2 | 3 | 4) : p));
    setValidationError(null);
  };

  const handleDescartar = async () => {
    if (confirm('¿Descartar el wizard? Los datos ingresados se perderán.')) {
      await limpiarBorrador();
      setState(INITIAL_STATE);
      setPaso(1);
      setBorradorRestaurado(false);
      onClose();
    }
  };

  /**
   * Cerrar sin descartar · preserva el borrador.
   * Usado cuando el user hace ESC o click overlay · pero sin confirmar destrucción.
   * El borrador queda en BD · banner en /usuarios permite continuarlo después.
   */
  const handleCerrarPreservandoBorrador = () => {
    setBorradorRestaurado(false);
    onClose();
  };

  // ── Submit · crea User + Relación atómicamente ────────────────────────
  const handleSubmit = async () => {
    const errAll = validarPaso(4);
    if (errAll) {
      setValidationError(errAll);
      return;
    }
    if (!state.tipoRelacion) {
      setValidationError('Tipo de relación es obligatorio · volvé al paso 2');
      return;
    }

    setSubmitting(true);
    setValidationError(null);

    try {
      // 1. Crear UserProfile via Cloud Function (Firebase Auth + Firestore)
      // chk5.PERSONAS-v5.7 · E10-fix (2026-05-28) · idempotente:
      // si el email ya existe (User huérfano de un intento fallido anterior),
      // reutilizamos ese uid y sólo creamos la RelacionLaboral. Esto resuelve
      // el caso típico donde la primera vez falló por rules NO deployadas y
      // el User quedó creado en Auth pero sin relación laboral.
      let newUser: UserProfile;
      try {
        newUser = await userService.createUser(
          state.email.trim().toLowerCase(),
          state.password,
          state.displayName.trim(),
          state.rol,
        );
      } catch (createErr) {
        const msg = createErr instanceof Error ? createErr.message : String(createErr);
        const yaExiste = /ya está registrado|already exists|already-exists/i.test(msg);
        if (!yaExiste) {
          throw createErr; // otro tipo de error · propagar
        }
        // Email ya existe · buscar el User huérfano
        const existing = await userService.getByEmail(state.email.trim().toLowerCase());
        if (!existing) {
          throw new Error(
            'El email ya está en Firebase Auth pero no hay UserProfile en Firestore. ' +
            'Contactá al administrador del sistema para limpiar manualmente.',
          );
        }
        // Reutilizar el User existente · pero verificar si ya tiene una relación
        // VIGENTE del mismo tipo (si la tiene · es duplicado real, no orphan recovery)
        const relacionesExistentes = await relacionesLaboralesService.listVigentesByUser(existing.uid);
        const yaConRelacionDelTipo = relacionesExistentes.some((r) => r.tipo === state.tipoRelacion);
        if (yaConRelacionDelTipo) {
          throw new Error(
            `El usuario "${existing.displayName}" ya existe y tiene una relación ` +
            `vigente tipo "${state.tipoRelacion}". Si querés agregar OTRA relación, ` +
            `cerrá este wizard y usá "+ Agregar relación" desde el UserPanel de ese usuario.`,
          );
        }
        // Orphan recovery · reutilizamos el User existente
        newUser = existing;
      }

      // 2. Crear RelacionLaboral inicial
      const relacionInput: CrearRelacionInput = {
        userId: newUser.uid,
        tipo: state.tipoRelacion,
        subTipo: (state.subTipo || undefined) as SubTipoRelacion | undefined,
        estado: 'vigente',
        fechaInicio: Timestamp.now(),
        cargoDisplay: state.cargoDisplay.trim() || undefined,
        montoMensualReferencia:
          state.montoMensualReferencia !== null && state.montoMensualReferencia > 0
            ? state.montoMensualReferencia
            : undefined,
        monedaReferencia:
          state.montoMensualReferencia !== null && state.montoMensualReferencia > 0
            ? state.monedaReferencia
            : undefined,
        notas: state.notasRelacion.trim() || undefined,
      };

      // Vinculación con Maestro (v5.8) · solo si externo + checked + tiene maestroId
      if (
        state.tipoRelacion === 'externo' &&
        state.vincularConMaestro &&
        state.maestroId.trim()
      ) {
        relacionInput.entidadMaestroRef = {
          tipo: state.maestroTipo,
          id: state.maestroId.trim(),
          rolEnEntidad: state.rolEnEntidad.trim() || undefined,
          nombreCachedSnapshot: state.maestroNombre.trim(),
        };
      }

      const creadoPor = currentUser?.uid ?? 'system';
      await relacionesLaboralesService.create(relacionInput, creadoPor);

      // 3. Limpiar borrador (canon E4.4) · ya creó el user · borrador obsoleto
      await limpiarBorrador();

      // 4. Reset + cerrar + notificar
      setState(INITIAL_STATE);
      setPaso(1);
      setBorradorRestaurado(false);
      onSuccess(newUser.uid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al crear usuario';
      onError(msg);
      setValidationError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ESC para cerrar · canon E4.4 · preserva borrador (NO descarta)
  // Para descartar explícitamente · botón "Descartar"
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCerrarPreservandoBorrador();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col sm:flex-row overflow-hidden">
        {/* ═══ SIDEBAR PASOS (desktop) / TOP (mobile) ═══ */}
        <aside className="bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200 p-4 sm:p-5 sm:w-64 flex-shrink-0">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-4">
            Nuevo colaborador
          </div>
          <ol className="flex sm:flex-col gap-3 sm:gap-3 overflow-x-auto scroll-hide">
            <PasoIndicator num={1} label="Identidad" sub="Datos básicos" current={paso === 1} done={paso > 1} />
            <PasoIndicator
              num={2}
              label="Tipo de relación"
              sub={state.tipoRelacion ? `${state.tipoRelacion}` : 'Empleado · honorarios · socio · externo'}
              current={paso === 2}
              done={paso > 2}
            />
            <PasoIndicator
              num={3}
              label="Datos específicos"
              sub="Cargo · monto · vinculación"
              current={paso === 3}
              done={paso > 3}
            />
            <PasoIndicator
              num={4}
              label="Permisos + acceso"
              sub={`Rol: ${ROLE_LABELS[state.rol]}`}
              current={paso === 4}
              done={false}
            />
          </ol>

          {/* Banner borrador canon E4.4 · auto-save activo */}
          <div className="mt-6 bg-amber-50 ring-1 ring-amber-200 rounded-lg p-3 hidden sm:block">
            <div className="flex items-center gap-1.5 text-amber-900 text-xs font-semibold mb-1">
              <Save className="w-3 h-3" />
              Borrador automático
            </div>
            <p className="text-[10px] text-amber-800">
              Tus cambios se guardan solos. Podés cerrar (X) y continuar después
              desde el banner en /usuarios.
            </p>
          </div>
        </aside>

        {/* ═══ CONTENIDO PASO ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header con close X */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-teal-700">
                PASO {paso} DE 4
              </div>
              <h2 id="wizard-title" className="text-lg font-bold text-slate-900 mt-0.5">
                {paso === 1 && 'Identidad del colaborador'}
                {paso === 2 && 'Tipo de relación con el negocio'}
                {paso === 3 && 'Datos específicos de la relación'}
                {paso === 4 && 'Acceso al sistema'}
              </h2>
            </div>
            <button
              onClick={handleCerrarPreservandoBorrador}
              className="w-8 h-8 hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700"
              aria-label="Cerrar wizard (preserva borrador)"
              title="Cerrar · el borrador se conserva para continuar después"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {validationError && (
              <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 flex items-start gap-2 text-xs text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            {paso === 1 && <PasoIdentidad state={state} set={set} />}
            {paso === 2 && <PasoTipoRelacion state={state} set={set} />}
            {paso === 3 && <PasoDatosTipo state={state} set={set} />}
            {paso === 4 && <PasoAcceso state={state} set={set} />}
          </div>

          {/* Footer · acciones */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleDescartar}
              className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1.5"
              disabled={submitting}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Descartar
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAnterior}
                disabled={paso === 1 || submitting}
                className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Anterior
              </button>
              {paso < 4 ? (
                <button
                  type="button"
                  onClick={handleSiguiente}
                  disabled={submitting}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-semibold flex items-center gap-1.5"
                >
                  Siguiente
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Crear colaborador
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES · PasoIndicator
// ═════════════════════════════════════════════════════════════════════════

const PasoIndicator: React.FC<{ num: number; label: string; sub: string; current: boolean; done: boolean }> = ({
  num,
  label,
  sub,
  current,
  done,
}) => (
  <li className="flex items-start gap-2 sm:gap-3 flex-shrink-0">
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
        done
          ? 'bg-teal-600 text-white'
          : current
            ? 'bg-teal-600 text-white ring-4 ring-teal-100'
            : 'bg-slate-200 text-slate-500'
      }`}
    >
      {done ? <Check className="w-3.5 h-3.5" /> : num}
    </div>
    <div className="min-w-0">
      <div className={`text-sm font-semibold ${current || done ? 'text-slate-900' : 'text-slate-400'}`}>{label}</div>
      <div className={`text-xs ${current || done ? 'text-slate-500' : 'text-slate-400'} truncate`}>{sub}</div>
    </div>
  </li>
);

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES · Pasos
// ═════════════════════════════════════════════════════════════════════════

interface PasoProps {
  state: WizardState;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}

const PasoIdentidad: React.FC<PasoProps> = ({ state, set }) => (
  <div className="space-y-3">
    <p className="text-sm text-slate-500">Datos básicos del nuevo colaborador.</p>
    <Field label="Nombre completo *" icon={UserIcon}>
      <input
        type="text"
        value={state.displayName}
        onChange={(e) => set('displayName', e.target.value)}
        placeholder="Ej. Carlos Mendoza Ruiz"
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
      />
    </Field>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Email *" icon={Mail}>
        <input
          type="email"
          value={state.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="carlos@vitaskin.pe"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
        />
      </Field>
      <Field label="Teléfono" icon={Phone}>
        <input
          type="tel"
          value={state.telefono}
          onChange={(e) => set('telefono', e.target.value)}
          placeholder="+51 987 654 321"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
        />
      </Field>
    </div>
    <Field label="Password inicial *" icon={Lock} hint="El usuario podrá cambiarlo después · mínimo 8 caracteres.">
      <input
        type="password"
        value={state.password}
        onChange={(e) => set('password', e.target.value)}
        placeholder="••••••••"
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
        autoComplete="new-password"
      />
    </Field>
  </div>
);

const PasoTipoRelacion: React.FC<PasoProps> = ({ state, set }) => {
  const opciones: Array<{ tipo: TipoRelacion; label: string; icon: React.FC<{ className?: string }>; desc: string; bg: string; ring: string; text: string }> = [
    { tipo: 'empleado', label: 'Empleado', icon: Briefcase, desc: 'En planilla · sueldo fijo · 5ta cat. · CTS · vacaciones', bg: 'bg-teal-50', ring: 'ring-teal-500', text: 'text-teal-900' },
    { tipo: 'honorarios', label: 'Honorarios', icon: FileText, desc: 'Profesional independiente · RxH · 4ta categoría', bg: 'bg-sky-50', ring: 'ring-sky-500', text: 'text-sky-900' },
    { tipo: 'socio', label: 'Socio', icon: Handshake, desc: 'Cap table · distribuciones · sin sueldo (a menos que también sea empleado)', bg: 'bg-purple-50', ring: 'ring-purple-500', text: 'text-purple-900' },
    { tipo: 'externo', label: 'Externo', icon: UserIcon, desc: 'Cliente VIP · proveedor · colaborador · sin staff interno', bg: 'bg-amber-50', ring: 'ring-amber-500', text: 'text-amber-900' },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Elegí la PRIMERA relación. Podés agregar más después desde el tab Relaciones del UserPanel.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {opciones.map(({ tipo, label, icon: Icon, desc, bg, ring, text }) => {
          const active = state.tipoRelacion === tipo;
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => set('tipoRelacion', tipo)}
              className={`text-left p-4 rounded-xl transition-all ${active ? `${bg} ring-2 ${ring}` : 'bg-white ring-1 ring-slate-200 hover:ring-slate-300'}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-9 h-9 rounded-lg ${active ? bg.replace('-50', '-100') : 'bg-slate-100'} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${active ? text : 'text-slate-600'}`} />
                </div>
                <div className={`font-bold ${active ? text : 'text-slate-900'}`}>{label}</div>
                {active && <Check className={`w-4 h-4 ml-auto ${text}`} />}
              </div>
              <p className={`text-xs ${active ? text : 'text-slate-600'} opacity-80`}>{desc}</p>
            </button>
          );
        })}
      </div>
      <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 flex items-start gap-2">
        <span className="text-base flex-shrink-0">💡</span>
        <span>
          <strong className="text-slate-900">¿Es a la vez empleado Y socio?</strong> Elegí UNA acá · después agregás
          la segunda relación desde el UserPanel.
        </span>
      </div>
    </div>
  );
};

const PasoDatosTipo: React.FC<PasoProps> = ({ state, set }) => {
  const t = state.tipoRelacion;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Detalles operativos de la relación tipo <strong>{t ? t : '—'}</strong>.
      </p>

      {t === 'empleado' && (
        <>
          <Field label="Cargo *" hint="Ej. Account Manager · Dev Senior · UX Designer">
            <input
              type="text"
              value={state.cargoDisplay}
              onChange={(e) => set('cargoDisplay', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Salario bruto mensual" hint="Sin descuentos">
              <input
                type="number"
                value={state.montoMensualReferencia ?? ''}
                onChange={(e) => set('montoMensualReferencia', e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                placeholder="3500"
              />
            </Field>
            <Field label="Moneda">
              <select
                value={state.monedaReferencia}
                onChange={(e) => set('monedaReferencia', e.target.value as 'PEN' | 'USD')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="PEN">PEN (S/)</option>
                <option value="USD">USD ($)</option>
              </select>
            </Field>
            <Field label="Subtipo">
              <select
                value={state.subTipo}
                onChange={(e) => set('subTipo', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">— ninguno —</option>
                <option value="full_time">Full time</option>
                <option value="medio_tiempo">Medio tiempo</option>
                <option value="por_horas">Por horas</option>
                <option value="practicante">Practicante</option>
                <option value="tercerizado">Tercerizado</option>
              </select>
            </Field>
          </div>
        </>
      )}

      {t === 'honorarios' && (
        <>
          <Field label="Servicio / cargo" hint="Ej. CFO consultor · Diseñador gráfico">
            <input
              type="text"
              value={state.cargoDisplay}
              onChange={(e) => set('cargoDisplay', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Tarifa mensual" hint="Antes de retención 4ta">
              <input
                type="number"
                value={state.montoMensualReferencia ?? ''}
                onChange={(e) => set('montoMensualReferencia', e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                placeholder="4500"
              />
            </Field>
            <Field label="Moneda">
              <select
                value={state.monedaReferencia}
                onChange={(e) => set('monedaReferencia', e.target.value as 'PEN' | 'USD')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="PEN">PEN (S/)</option>
                <option value="USD">USD ($)</option>
              </select>
            </Field>
            <Field label="Subtipo">
              <select
                value={state.subTipo}
                onChange={(e) => set('subTipo', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">— ninguno —</option>
                <option value="consultor">Consultor</option>
                <option value="asesor">Asesor</option>
                <option value="profesional_servicios">Servicios profesionales</option>
                <option value="freelance">Freelance</option>
              </select>
            </Field>
          </div>
        </>
      )}

      {t === 'socio' && (
        <>
          <Field label="Rol / posición" hint="Ej. Fundador · Inversor estratégico">
            <input
              type="text"
              value={state.cargoDisplay}
              onChange={(e) => set('cargoDisplay', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            />
          </Field>
          <Field label="Subtipo">
            <select
              value={state.subTipo}
              onChange={(e) => set('subTipo', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">— ninguno —</option>
              <option value="fundador">Fundador</option>
              <option value="inversor">Inversor</option>
              <option value="minoritario">Minoritario</option>
              <option value="estrategico">Estratégico</option>
            </select>
          </Field>
          <div className="bg-purple-50 ring-1 ring-purple-200 rounded-lg p-3 text-xs text-purple-900 flex items-start gap-2">
            <span className="flex-shrink-0">ℹ️</span>
            <span>
              <strong>Cap table %, aporte y distribuciones</strong> se configuran después en{' '}
              <code className="bg-white px-1 rounded">/inversionistas</code>. Acá solo registramos la relación.
            </span>
          </div>
        </>
      )}

      {t === 'externo' && (
        <>
          <Field label="Subtipo de externo">
            <select
              value={state.subTipo}
              onChange={(e) => set('subTipo', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">— elegí uno —</option>
              <option value="contacto_proveedor">🛒 Contacto de proveedor</option>
              <option value="contacto_cliente">💼 Contacto de cliente (B2B)</option>
              <option value="cliente_vip">⭐ Cliente VIP (persona natural)</option>
              <option value="tercerizado_logistico">🚚 Tercerizado logístico</option>
              <option value="colaborador_marketing">📸 Colaborador marketing</option>
              <option value="contacto_marca">🤝 Contacto de marca aliada</option>
              <option value="auditor_externo">🔍 Auditor externo</option>
              <option value="otro">Otro</option>
            </select>
          </Field>

          {/* Vinculación con Maestros · v5.8 */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 ring-1 ring-indigo-200 rounded-xl p-4 space-y-3">
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
                  Recomendado si es contacto de un proveedor/cliente/marca existente.
                </div>
              </div>
            </label>

            {state.vincularConMaestro && (
              <div className="space-y-2 pt-2 border-t border-indigo-200">
                <Field label="Tipo de entidad">
                  <select
                    value={state.maestroTipo}
                    onChange={(e) => set('maestroTipo', e.target.value as TipoEntidadMaestro)}
                    className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-lg text-sm"
                  >
                    <option value="proveedor">Proveedor</option>
                    <option value="cliente">Cliente</option>
                    <option value="marca">Marca</option>
                  </select>
                </Field>
                <Field label="Nombre de la entidad" hint="E4.3 placeholder · E7 conecta buscador real con autocomplete">
                  <input
                    type="text"
                    value={state.maestroNombre}
                    onChange={(e) => set('maestroNombre', e.target.value)}
                    placeholder="Ej. Skin Labs SAC"
                    className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-lg text-sm"
                  />
                </Field>
                <Field label="ID de Maestro" hint="Por ahora ingresar manualmente · E7 reemplaza con buscador">
                  <input
                    type="text"
                    value={state.maestroId}
                    onChange={(e) => set('maestroId', e.target.value)}
                    placeholder="ID interno del proveedor/cliente"
                    className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-lg text-sm font-mono text-xs"
                  />
                </Field>
                <Field label="Rol en la entidad" hint="Opcional">
                  <input
                    type="text"
                    value={state.rolEnEntidad}
                    onChange={(e) => set('rolEnEntidad', e.target.value)}
                    placeholder="Ej. Sales Representative · Account Manager"
                    className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-lg text-sm"
                  />
                </Field>
              </div>
            )}
          </div>
        </>
      )}

      <Field label="Notas (opcional)">
        <textarea
          rows={2}
          value={state.notasRelacion}
          onChange={(e) => set('notasRelacion', e.target.value)}
          placeholder="Cualquier detalle adicional sobre la relación..."
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
      </Field>
    </div>
  );
};

const PasoAcceso: React.FC<PasoProps> = ({ state, set }) => {
  const rolesDisponibles: UserRole[] = ['invitado', 'vendedor', 'comprador', 'almacenero', 'finanzas', 'supervisor', 'gerente', 'socio', 'admin'];
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Definí el nivel de acceso del colaborador al sistema. El rol controla qué módulos puede ver y operar.
      </p>
      <Field label="Rol del sistema *" hint="Default: invitado (sin acceso operativo hasta que se promueva)">
        <select
          value={state.rol}
          onChange={(e) => set('rol', e.target.value as UserRole)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          {rolesDisponibles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </Field>

      <div className="bg-amber-50 ring-1 ring-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
        <span className="flex-shrink-0">💡</span>
        <div>
          <strong>Tip:</strong> los usuarios <strong>externos</strong> y <strong>colaboradores puntuales</strong>
          típicamente reciben rol <code className="bg-white px-1 rounded">invitado</code> y se les habilita
          permisos puntuales después.
        </div>
      </div>

      <Field label="Acceso al sistema">
        <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-lg ring-1 ring-slate-200">
          <input
            type="checkbox"
            checked={state.enviarInvitacion}
            onChange={(e) => set('enviarInvitacion', e.target.checked)}
          />
          <div>
            <div className="text-sm font-semibold text-slate-900">Enviar email de bienvenida</div>
            <div className="text-xs text-slate-500">
              El usuario recibe sus credenciales y puede ingresar al sistema. (E9 implementa Resend real ·
              por ahora se crea solo en Firebase Auth con el password ingresado.)
            </div>
          </div>
        </label>
      </Field>

      {/* Resumen para confirmación */}
      <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-xl p-3 mt-4">
        <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 mb-2">
          Vas a crear:
        </div>
        <ul className="text-xs text-emerald-900 space-y-1">
          <li>
            👤 <strong>{state.displayName || '— sin nombre —'}</strong> · {state.email || '— sin email —'}
          </li>
          <li>
            💼 Relación <strong>{state.tipoRelacion || '— sin tipo —'}</strong>
            {state.cargoDisplay && ` · ${state.cargoDisplay}`}
            {state.montoMensualReferencia &&
              ` · ${state.monedaReferencia === 'USD' ? '$' : 'S/'}${state.montoMensualReferencia}`}
          </li>
          {state.tipoRelacion === 'externo' && state.vincularConMaestro && state.maestroNombre && (
            <li>
              🔗 Vinculado a <strong>{state.maestroNombre}</strong> ({state.maestroTipo})
            </li>
          )}
          <li>
            🛡️ Rol: <strong>{ROLE_LABELS[state.rol]}</strong>
          </li>
        </ul>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// HELPER · Field wrapper consistente
// ═════════════════════════════════════════════════════════════════════════

const Field: React.FC<{ label: string; icon?: React.FC<{ className?: string }>; hint?: string; children: React.ReactNode }> = ({
  label,
  icon: Icon,
  hint,
  children,
}) => (
  <div>
    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 flex items-center gap-1.5">
      {Icon && <Icon className="w-3 h-3 text-slate-400" />}
      {label}
    </label>
    {children}
    {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
  </div>
);

export default CrearUsuarioWizard;
