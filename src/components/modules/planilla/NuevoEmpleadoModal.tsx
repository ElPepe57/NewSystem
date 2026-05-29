/**
 * NuevoEmpleadoModal.tsx · chk5.PERSONAS-v5.8 · E3-extended (2026-05-28)
 *
 * Modal F6-A (FormModalV2 centrado) para dar de alta a un nuevo empleado
 * directamente desde /planilla, sin pasar por el wizard 4-pasos de /usuarios.
 *
 * ── 3 modos según email lookup ──────────────────────────────────────────
 *
 *   Modo A · "crear" (user no existe)
 *     Muestra: EmailUserLookup + DatosPersonalesFields + DatosLaboralesFields
 *     Submit:  useCreateUserWithRelacion.create()
 *
 *   Modo B · "agregar relación" (user existe · sin relación empleado vigente)
 *     Muestra: EmailUserLookup + Card readonly con datos del user + DatosLaboralesFields
 *     Submit:  useCreateUserWithRelacion.addRelacionToExisting(uid, datos)
 *
 *   Modo C · "bloqueado" (user existe · YA tiene relación empleado vigente)
 *     Muestra: EmailUserLookup + banner rojo + CTA "Abrir perfil en Usuarios"
 *     Submit:  disabled
 *
 * Borrador canon (2026-05-07): autoguardado via borradorWizardService tipo 'nuevo-empleado'.
 * El borrador persiste el email del lookup (string) · no el objeto UserProfile (no serializable).
 * Si al restaurar el borrador el email ya tiene user → el lookup lo re-detecta solo.
 *
 * Constraints:
 *   - Backend NO se toca · solo services existentes
 *   - Canon F6-A modal centrado · FormModalV2
 *   - Canon F7 · tabular-nums en montos
 *   - Canon F8 · iconos lucide únicos
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, AlertCircle, User as UserIcon, Mail, Phone } from 'lucide-react';
import { FormModalV2 } from '../../../design-system';
import {
  useCreateUserWithRelacion,
} from '../../../hooks/useCreateUserWithRelacion';
import {
  EmailUserLookup,
} from '../../usuarios/forms/EmailUserLookup';
import {
  DatosPersonalesFields,
  type DatosPersonalesValues,
} from '../../usuarios/forms/DatosPersonalesFields';
import {
  DatosLaboralesFields,
  type DatosLaboralesValues,
} from '../../usuarios/forms/DatosLaboralesFields';
import { borradorWizardService } from '../../../services/borradorWizard.service';
import { useAuthStore } from '../../../store/authStore';
import type { UserProfile } from '../../../types/auth.types';
import type { RelacionLaboral, SubTipoEmpleado } from '../../../types/relacionLaboral.types';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export interface NuevoEmpleadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (uid: string) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// STATE INICIAL
// ═════════════════════════════════════════════════════════════════════════

const INITIAL_PERSONALES: DatosPersonalesValues = {
  displayName: '',
  email: '',
  telefono: '',
  password: '',
};

const INITIAL_LABORALES: DatosLaboralesValues = {
  cargoDisplay: '',
  subTipo: '',
  montoMensualReferencia: '',
  monedaReferencia: 'PEN',
  notas: '',
};

// ═════════════════════════════════════════════════════════════════════════
// VALIDACIÓN
// ═════════════════════════════════════════════════════════════════════════

interface ValidationErrors {
  personales?: Partial<Record<keyof DatosPersonalesValues, string>>;
  laborales?: Partial<Record<keyof DatosLaboralesValues, string>>;
}

function validateCrear(
  p: DatosPersonalesValues,
  l: DatosLaboralesValues,
): ValidationErrors {
  const errors: ValidationErrors = {};
  const ep: Partial<Record<keyof DatosPersonalesValues, string>> = {};
  const el: Partial<Record<keyof DatosLaboralesValues, string>> = {};

  if (!p.displayName.trim() || p.displayName.trim().length < 3)
    ep.displayName = 'Nombre requerido (mín. 3 caracteres)';
  if (!p.email.trim() || !p.email.includes('@') || !p.email.includes('.'))
    ep.email = 'Email inválido';
  if (p.password.length < 8)
    ep.password = 'Password mínimo 8 caracteres';
  if (!l.cargoDisplay.trim())
    el.cargoDisplay = 'Cargo requerido';

  if (Object.keys(ep).length > 0) errors.personales = ep;
  if (Object.keys(el).length > 0) errors.laborales = el;
  return errors;
}

function validateAgregarRelacion(l: DatosLaboralesValues): ValidationErrors {
  const errors: ValidationErrors = {};
  const el: Partial<Record<keyof DatosLaboralesValues, string>> = {};
  if (!l.cargoDisplay.trim()) el.cargoDisplay = 'Cargo requerido';
  if (Object.keys(el).length > 0) errors.laborales = el;
  return errors;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const NuevoEmpleadoModal: React.FC<NuevoEmpleadoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.userProfile);
  const {
    create,
    lookupUserByEmail,
    addRelacionToExisting,
    loading,
    error: hookError,
    clearError,
  } = useCreateUserWithRelacion(currentUser?.uid ?? 'system');

  // ── Form state ──────────────────────────────────────────────────────────
  const [emailInput, setEmailInput] = useState('');
  const [personales, setPersonales] = useState<DatosPersonalesValues>(INITIAL_PERSONALES);
  const [laborales, setLaborales] = useState<DatosLaboralesValues>(INITIAL_LABORALES);
  const [enviarInvitacion, setEnviarInvitacion] = useState(true);
  const [errors, setErrors] = useState<ValidationErrors>({});

  // ── Lookup state ────────────────────────────────────────────────────────
  const [userExistente, setUserExistente] = useState<UserProfile | null>(null);
  const [relacionesVigentes, setRelacionesVigentes] = useState<RelacionLaboral[]>([]);

  // ── Borrador ────────────────────────────────────────────────────────────
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modo derivado
  const modoBlocked =
    userExistente !== null && relacionesVigentes.some((r) => r.tipo === 'empleado');
  const modoAgregarRelacion =
    userExistente !== null && !modoBlocked;
  const modoCrear = userExistente === null;

  // ─── Restaurar borrador al abrir ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !currentUser?.uid || borradorRestaurado) return;
    void (async () => {
      try {
        const borrador = await borradorWizardService.get(currentUser.uid, 'nuevo-empleado');
        if (borrador?.estado) {
          const s = borrador.estado as Record<string, unknown>;
          if (typeof s.emailInput === 'string') setEmailInput(s.emailInput);
          if (s.personales) setPersonales(s.personales as DatosPersonalesValues);
          if (s.laborales) setLaborales(s.laborales as DatosLaboralesValues);
        }
      } catch (err) {
        console.warn('[NuevoEmpleadoModal] error restaurando borrador:', err);
      } finally {
        setBorradorRestaurado(true);
      }
    })();
  }, [isOpen, currentUser?.uid, borradorRestaurado]);

  // ─── Auto-save borrador cada 800ms tras cambio ────────────────────────
  useEffect(() => {
    if (!isOpen || !currentUser?.uid || !borradorRestaurado) return;
    // Guardar solo si hay algo que preservar
    const hayDatos =
      emailInput.trim() ||
      personales.displayName.trim() ||
      laborales.cargoDisplay.trim();
    if (!hayDatos) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const resumen = personales.displayName
        ? `${personales.displayName}${laborales.cargoDisplay ? ` · ${laborales.cargoDisplay}` : ''}`
        : emailInput
        ? `Draft · ${emailInput}`
        : 'Borrador empleado sin nombre';
      void borradorWizardService
        .save({
          tipo: 'nuevo-empleado',
          userId: currentUser.uid,
          pasoActual: 1,
          // Serializar emailInput (string) · no el objeto UserProfile
          estado: { emailInput, personales, laborales } as unknown as Record<string, unknown>,
          resumen,
          montoEstimado:
            laborales.montoMensualReferencia !== ''
              ? Number(laborales.montoMensualReferencia)
              : undefined,
        })
        .catch((err) => console.warn('[NuevoEmpleadoModal] error guardando borrador:', err));
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [emailInput, personales, laborales, isOpen, currentUser?.uid, borradorRestaurado]);

  // ─── Limpiar borrador ─────────────────────────────────────────────────
  const limpiarBorrador = async () => {
    if (currentUser?.uid) {
      try {
        await borradorWizardService.delete(currentUser.uid, 'nuevo-empleado');
      } catch (err) {
        console.warn('[NuevoEmpleadoModal] error limpiando borrador:', err);
      }
    }
  };

  // ─── Reset completo ───────────────────────────────────────────────────
  const resetState = () => {
    setEmailInput('');
    setPersonales(INITIAL_PERSONALES);
    setLaborales(INITIAL_LABORALES);
    setEnviarInvitacion(true);
    setErrors({});
    setUserExistente(null);
    setRelacionesVigentes([]);
    setBorradorRestaurado(false);
    clearError();
  };

  const handleClose = () => {
    setBorradorRestaurado(false);
    onClose();
  };

  // ─── Callback del lookup ──────────────────────────────────────────────
  const handleUserFound = (user: UserProfile | null, relaciones: RelacionLaboral[]) => {
    setUserExistente(user);
    setRelacionesVigentes(relaciones);
    // Si encontramos un user, sincronizar el campo email en DatosPersonalesFields
    if (user) {
      setPersonales((prev) => ({ ...prev, email: emailInput.trim().toLowerCase() }));
    }
    // Limpiar errores del email si ya era válido
    if (errors.personales?.email) {
      setErrors((prev) => ({
        ...prev,
        personales: { ...prev.personales, email: undefined },
      }));
    }
  };

  // ─── Navegación al UserPanel del user bloqueado ───────────────────────
  const handleOpenUserPanel = (uid: string) => {
    handleClose();
    navigate('/usuarios', { state: { openUid: uid } });
  };

  // ─── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (modoBlocked) return;

    if (modoAgregarRelacion && userExistente) {
      const validationErrors = validateAgregarRelacion(laborales);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
      setErrors({});
      try {
        const { uid } = await addRelacionToExisting(userExistente.uid, {
          tipo: 'empleado',
          subTipo: (laborales.subTipo || undefined) as SubTipoEmpleado | undefined,
          cargoDisplay: laborales.cargoDisplay.trim() || undefined,
          montoMensualReferencia:
            laborales.montoMensualReferencia !== ''
              ? Number(laborales.montoMensualReferencia)
              : undefined,
          monedaReferencia: laborales.monedaReferencia,
          notas: laborales.notas.trim() || undefined,
        });
        await limpiarBorrador();
        resetState();
        onSuccess(uid);
      } catch {
        // hookError se muestra en el banner
      }
      return;
    }

    // Modo crear: validar con datos personales del email sync
    const personalesConEmail: DatosPersonalesValues = {
      ...personales,
      email: emailInput.trim().toLowerCase(),
    };
    const validationErrors = validateCrear(personalesConEmail, laborales);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    try {
      const { uid } = await create({
        displayName: personalesConEmail.displayName.trim(),
        email: personalesConEmail.email,
        telefono: personalesConEmail.telefono.trim() || undefined,
        password: personalesConEmail.password,
        tipo: 'empleado',
        subTipo: (laborales.subTipo || undefined) as SubTipoEmpleado | undefined,
        cargoDisplay: laborales.cargoDisplay.trim() || undefined,
        montoMensualReferencia:
          laborales.montoMensualReferencia !== ''
            ? Number(laborales.montoMensualReferencia)
            : undefined,
        monedaReferencia: laborales.monedaReferencia,
        notas: laborales.notas.trim() || undefined,
      });

      await limpiarBorrador();
      resetState();
      onSuccess(uid);
    } catch {
      // hookError se muestra en el banner
    }
  };

  // ─── Handlers de onChange ─────────────────────────────────────────────
  const handlePersonalesChange = (
    field: keyof DatosPersonalesValues,
    value: string,
  ) => {
    setPersonales((prev) => ({ ...prev, [field]: value }));
    if (errors.personales?.[field]) {
      setErrors((prev) => ({
        ...prev,
        personales: { ...prev.personales, [field]: undefined },
      }));
    }
  };

  const handleLaboralesChange = (
    field: keyof DatosLaboralesValues,
    value: DatosLaboralesValues[keyof DatosLaboralesValues],
  ) => {
    setLaborales((prev) => ({ ...prev, [field]: value }));
    if (errors.laborales?.[field as keyof DatosLaboralesValues]) {
      setErrors((prev) => ({
        ...prev,
        laborales: { ...prev.laborales, [field]: undefined },
      }));
    }
  };

  // ─── canSubmit por modo ───────────────────────────────────────────────
  const canSubmit = (() => {
    if (loading || modoBlocked) return false;
    if (modoAgregarRelacion) return laborales.cargoDisplay.trim().length > 0;
    // modo crear
    const emailOk = emailInput.trim().includes('@') && emailInput.trim().includes('.');
    return (
      emailOk &&
      personales.displayName.trim().length >= 3 &&
      personales.password.length >= 8 &&
      laborales.cargoDisplay.trim().length > 0
    );
  })();

  // ─── Labels dinámicos por modo ────────────────────────────────────────
  const submitLabel = loading
    ? modoAgregarRelacion
      ? 'Agregando relación...'
      : 'Creando empleado...'
    : modoAgregarRelacion
    ? 'Agregar como empleado'
    : 'Agregar a planilla';

  const subtitle = modoAgregarRelacion
    ? `Agregar relación empleado a ${userExistente?.displayName ?? 'usuario existente'}`
    : 'Alta a planilla · 5ta categoría · sueldo fijo mensual';

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={handleClose}
      onSubmit={handleSubmit}
      title="Nuevo empleado"
      subtitle={subtitle}
      icon={Briefcase}
      iconTone="teal"
      submitLabel={submitLabel}
      submitVariant="primary-soft"
      submitIcon={Briefcase}
      loading={loading}
      disabled={!canSubmit}
      size="lg"
      footerExtras={
        modoCrear ? (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enviarInvitacion}
              onChange={(e) => setEnviarInvitacion(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-[12px] text-slate-600">Enviar invitación al email</span>
          </label>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {/* Error global del hook */}
        {hookError && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 flex items-start gap-2 text-[12px] text-rose-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
            <span>{hookError}</span>
          </div>
        )}

        {/* ── Email lookup · siempre arriba ── */}
        <EmailUserLookup
          value={emailInput}
          onChange={(v) => {
            setEmailInput(v);
            // Resetear lookup si el usuario borra el email
            if (!v.trim()) {
              setUserExistente(null);
              setRelacionesVigentes([]);
            }
          }}
          onUserFound={handleUserFound}
          tipoModal="empleado"
          tipoLabel="empleado"
          lookupFn={lookupUserByEmail}
          error={errors.personales?.email}
          onOpenUserPanel={handleOpenUserPanel}
        />

        {/* ── Modo A: crear nuevo user ── */}
        {modoCrear && (
          <>
            <div className="border-t border-slate-100" />
            {/* Sección 1 · Datos personales (sin el campo email — ya está arriba) */}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[9px] font-bold">
                  1
                </span>
                Datos personales
              </div>
              <DatosPersonalesFields
                values={{ ...personales, email: emailInput }}
                onChange={handlePersonalesChange}
                errors={errors.personales}
                hideEmail
              />
            </div>

            <div className="border-t border-slate-100" />

            {/* Sección 2 · Datos laborales */}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[9px] font-bold">
                  2
                </span>
                Datos laborales
              </div>
              <DatosLaboralesFields
                values={laborales}
                onChange={handleLaboralesChange}
                errors={errors.laborales}
              />
            </div>
          </>
        )}

        {/* ── Modo B: agregar relación a user existente ── */}
        {modoAgregarRelacion && userExistente && (
          <>
            <div className="border-t border-slate-100" />

            {/* Card read-only con datos del user */}
            <div className="bg-slate-50 ring-1 ring-slate-200 rounded-lg px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                Datos personales (existentes)
              </div>
              <div className="space-y-1 text-[12px] text-slate-700">
                <div className="flex items-center gap-1.5">
                  <UserIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span className="font-semibold">{userExistente.displayName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span>{userExistente.email}</span>
                </div>
                {userExistente.telefono && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span>{userExistente.telefono}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Sección datos laborales */}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[9px] font-bold">
                  1
                </span>
                Datos laborales
              </div>
              <DatosLaboralesFields
                values={laborales}
                onChange={handleLaboralesChange}
                errors={errors.laborales}
              />
            </div>
          </>
        )}

        {/* ── Modo C: bloqueado (ya tiene relación empleado) ── */}
        {modoBlocked && (
          <div className="bg-slate-50 ring-1 ring-slate-200 rounded-lg px-3 py-2.5 text-[12px] text-slate-600">
            Para modificar el cargo o sueldo de este empleado, abrí su perfil
            desde el módulo Usuarios.
          </div>
        )}
      </div>
    </FormModalV2>
  );
};
