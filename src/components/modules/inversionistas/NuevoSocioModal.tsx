/**
 * NuevoSocioModal.tsx · chk5.PERSONAS-v5.8 · E4-extended (2026-05-28)
 *
 * Modal F6-A (FormModalV2 centrado) para dar de alta a un nuevo socio
 * directamente desde /inversionistas, sin pasar por el wizard 4-pasos de /usuarios.
 *
 * ── 3 modos según email lookup ──────────────────────────────────────────
 *
 *   Modo A · "crear" (user no existe)
 *     Muestra: EmailUserLookup + DatosPersonalesFields + DatosSocioFields
 *     Submit:  useCreateUserWithRelacion.create()
 *
 *   Modo B · "agregar relación" (user existe · sin relación socio vigente)
 *     Muestra: EmailUserLookup + Card readonly con datos del user + DatosSocioFields
 *     Submit:  useCreateUserWithRelacion.addRelacionToExisting(uid, datos)
 *
 *   Modo C · "bloqueado" (user existe · YA tiene relación socio vigente)
 *     Muestra: EmailUserLookup + banner rojo + CTA "Abrir perfil en Usuarios"
 *     Submit:  disabled
 *
 * Borrador canon (2026-05-07): autoguardado via borradorWizardService tipo 'nuevo-socio'.
 * El borrador persiste emailInput (string) · no el objeto UserProfile (no serializable).
 * Si al restaurar el borrador el email ya tiene user → el lookup lo re-detecta solo.
 *
 * Constraints:
 *   - Backend NO se toca · solo services existentes
 *   - Canon F6-A modal centrado · FormModalV2
 *   - Canon F8 · iconos lucide únicos
 *   - iconTone="purple" · color signature del módulo Inversionistas
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Handshake, AlertCircle, User as UserIcon, Mail, Phone } from 'lucide-react';
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
  DatosSocioFields,
  type DatosSocioValues,
} from '../../usuarios/forms/DatosSocioFields';
import { borradorWizardService } from '../../../services/borradorWizard.service';
import { useAuthStore } from '../../../store/authStore';
import type { UserProfile } from '../../../types/auth.types';
import type { RelacionLaboral, SubTipoSocio } from '../../../types/relacionLaboral.types';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export interface NuevoSocioModalProps {
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

const INITIAL_SOCIO: DatosSocioValues = {
  cargoDisplay: '',
  subTipo: '',
  notas: '',
};

// ═════════════════════════════════════════════════════════════════════════
// VALIDACIÓN
// ═════════════════════════════════════════════════════════════════════════

interface ValidationErrors {
  personales?: Partial<Record<keyof DatosPersonalesValues, string>>;
  socio?: Partial<Record<keyof DatosSocioValues, string>>;
}

function validateCrear(
  p: DatosPersonalesValues,
  emailInput: string,
): ValidationErrors {
  const errors: ValidationErrors = {};
  const ep: Partial<Record<keyof DatosPersonalesValues, string>> = {};

  if (!p.displayName.trim() || p.displayName.trim().length < 3)
    ep.displayName = 'Nombre requerido (mín. 3 caracteres)';
  if (!emailInput.trim() || !emailInput.includes('@') || !emailInput.includes('.'))
    ep.email = 'Email inválido';
  if (p.password.length < 8)
    ep.password = 'Password mínimo 8 caracteres';

  if (Object.keys(ep).length > 0) errors.personales = ep;
  return errors;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const NuevoSocioModal: React.FC<NuevoSocioModalProps> = ({
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
  const [socio, setSocio] = useState<DatosSocioValues>(INITIAL_SOCIO);
  const [errors, setErrors] = useState<ValidationErrors>({});

  // ── Lookup state ────────────────────────────────────────────────────────
  const [userExistente, setUserExistente] = useState<UserProfile | null>(null);
  const [relacionesVigentes, setRelacionesVigentes] = useState<RelacionLaboral[]>([]);

  // ── Borrador ────────────────────────────────────────────────────────────
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modo derivado
  const modoBlocked =
    userExistente !== null && relacionesVigentes.some((r) => r.tipo === 'socio');
  const modoAgregarRelacion = userExistente !== null && !modoBlocked;
  const modoCrear = userExistente === null;

  // ─── Restaurar borrador al abrir ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !currentUser?.uid || borradorRestaurado) return;
    void (async () => {
      try {
        const borrador = await borradorWizardService.get(currentUser.uid, 'nuevo-socio');
        if (borrador?.estado) {
          const s = borrador.estado as Record<string, unknown>;
          if (typeof s.emailInput === 'string') setEmailInput(s.emailInput);
          if (s.personales) setPersonales(s.personales as DatosPersonalesValues);
          if (s.socio) setSocio(s.socio as DatosSocioValues);
        }
      } catch (err) {
        console.warn('[NuevoSocioModal] error restaurando borrador:', err);
      } finally {
        setBorradorRestaurado(true);
      }
    })();
  }, [isOpen, currentUser?.uid, borradorRestaurado]);

  // ─── Auto-save borrador cada 800ms tras cambio ────────────────────────
  useEffect(() => {
    if (!isOpen || !currentUser?.uid || !borradorRestaurado) return;
    const hayDatos =
      emailInput.trim() ||
      personales.displayName.trim() ||
      socio.cargoDisplay.trim();
    if (!hayDatos) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const resumen = personales.displayName
        ? `${personales.displayName}${socio.cargoDisplay ? ` · ${socio.cargoDisplay}` : ''}`
        : emailInput
        ? `Draft · ${emailInput}`
        : 'Borrador socio sin nombre';
      void borradorWizardService
        .save({
          tipo: 'nuevo-socio',
          userId: currentUser.uid,
          pasoActual: 1,
          // Serializar emailInput (string) · no el objeto UserProfile
          estado: { emailInput, personales, socio } as unknown as Record<string, unknown>,
          resumen,
        })
        .catch((err) => console.warn('[NuevoSocioModal] error guardando borrador:', err));
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [emailInput, personales, socio, isOpen, currentUser?.uid, borradorRestaurado]);

  // ─── Limpiar borrador ─────────────────────────────────────────────────
  const limpiarBorrador = async () => {
    if (currentUser?.uid) {
      try {
        await borradorWizardService.delete(currentUser.uid, 'nuevo-socio');
      } catch (err) {
        console.warn('[NuevoSocioModal] error limpiando borrador:', err);
      }
    }
  };

  // ─── Reset completo ───────────────────────────────────────────────────
  const resetState = () => {
    setEmailInput('');
    setPersonales(INITIAL_PERSONALES);
    setSocio(INITIAL_SOCIO);
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
    if (user) {
      setPersonales((prev) => ({ ...prev, email: emailInput.trim().toLowerCase() }));
    }
    if (errors.personales?.email) {
      setErrors((prev) => ({
        ...prev,
        personales: { ...prev.personales, email: undefined },
      }));
    }
  };

  // ─── Navegación al UserPanel ──────────────────────────────────────────
  const handleOpenUserPanel = (uid: string) => {
    handleClose();
    navigate('/usuarios', { state: { openUid: uid } });
  };

  // ─── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (modoBlocked) return;

    if (modoAgregarRelacion && userExistente) {
      setErrors({});
      try {
        const { uid } = await addRelacionToExisting(userExistente.uid, {
          tipo: 'socio',
          subTipo: (socio.subTipo || undefined) as SubTipoSocio | undefined,
          cargoDisplay: socio.cargoDisplay.trim() || undefined,
          notas: socio.notas.trim() || undefined,
        });
        await limpiarBorrador();
        resetState();
        onSuccess(uid);
      } catch {
        // hookError se muestra en el banner
      }
      return;
    }

    // Modo crear
    const personalesConEmail: DatosPersonalesValues = {
      ...personales,
      email: emailInput.trim().toLowerCase(),
    };
    const validationErrors = validateCrear(personalesConEmail, emailInput);
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
        tipo: 'socio',
        subTipo: (socio.subTipo || undefined) as SubTipoSocio | undefined,
        cargoDisplay: socio.cargoDisplay.trim() || undefined,
        notas: socio.notas.trim() || undefined,
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

  const handleSocioChange = (
    field: keyof DatosSocioValues,
    value: DatosSocioValues[keyof DatosSocioValues],
  ) => {
    setSocio((prev) => ({ ...prev, [field]: value }));
    if (errors.socio?.[field as keyof DatosSocioValues]) {
      setErrors((prev) => ({
        ...prev,
        socio: { ...prev.socio, [field]: undefined },
      }));
    }
  };

  // ─── canSubmit por modo ───────────────────────────────────────────────
  const canSubmit = (() => {
    if (loading || modoBlocked) return false;
    if (modoAgregarRelacion) return true; // socio no requiere campo obligatorio en DatosSocioFields
    // modo crear
    const emailOk = emailInput.trim().includes('@') && emailInput.trim().includes('.');
    return (
      emailOk &&
      personales.displayName.trim().length >= 3 &&
      personales.password.length >= 8
    );
  })();

  // ─── Labels dinámicos por modo ────────────────────────────────────────
  const submitLabel = loading
    ? modoAgregarRelacion
      ? 'Agregando relación...'
      : 'Creando socio...'
    : modoAgregarRelacion
    ? 'Agregar como socio'
    : 'Agregar al cap table';

  const subtitle = modoAgregarRelacion
    ? `Agregar relación socio a ${userExistente?.displayName ?? 'usuario existente'}`
    : 'Alta al cap table · equity + distribuciones';

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={handleClose}
      onSubmit={handleSubmit}
      title="Nuevo socio"
      subtitle={subtitle}
      icon={Handshake}
      iconTone="purple"
      submitLabel={submitLabel}
      submitVariant="primary-soft"
      submitIcon={Handshake}
      loading={loading}
      disabled={!canSubmit}
      size="lg"
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
            if (!v.trim()) {
              setUserExistente(null);
              setRelacionesVigentes([]);
            }
          }}
          onUserFound={handleUserFound}
          tipoModal="socio"
          tipoLabel="socio"
          lookupFn={lookupUserByEmail}
          error={errors.personales?.email}
          onOpenUserPanel={handleOpenUserPanel}
        />

        {/* ── Modo A: crear nuevo user ── */}
        {modoCrear && (
          <>
            <div className="border-t border-slate-100" />
            {/* Sección 1 · Datos personales (email ya está arriba) */}
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

            {/* Sección 2 · Datos de socio */}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[9px] font-bold">
                  2
                </span>
                Datos de socio
              </div>
              <DatosSocioFields
                values={socio}
                onChange={handleSocioChange}
                errors={errors.socio}
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

            {/* Sección datos de socio */}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[9px] font-bold">
                  1
                </span>
                Datos de socio
              </div>
              <DatosSocioFields
                values={socio}
                onChange={handleSocioChange}
                errors={errors.socio}
              />
            </div>
          </>
        )}

        {/* ── Modo C: bloqueado ── */}
        {modoBlocked && (
          <div className="bg-slate-50 ring-1 ring-slate-200 rounded-lg px-3 py-2.5 text-[12px] text-slate-600">
            Para modificar el rol o datos de este socio, abrí su perfil desde el módulo
            Usuarios.
          </div>
        )}
      </div>
    </FormModalV2>
  );
};
