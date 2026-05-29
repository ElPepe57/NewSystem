/**
 * NuevoEmpleadoModal.tsx · chk5.PERSONAS-v5.9 · E2 (2026-05-28)
 *
 * Modal F6-A (FormModalV2 centrado) para dar de alta a un nuevo empleado
 * directamente desde /planilla, sin pasar por el wizard 4-pasos de /usuarios.
 *
 * ── 3 modos según autocomplete ──────────────────────────────────────────
 *
 *   Modo A · "crear" (user no existe)
 *     Muestra: PersonaAutocomplete + DatosPersonalesFields + DatosLaboralesFields
 *     Submit:  useCreateUserWithRelacion.create()
 *
 *   Modo B · "agregar relación" (user existe · sin relación empleado vigente)
 *     Muestra: PersonaAutocomplete (chip pill) + InfoRelevantePanel + DatosLaboralesFields
 *     Submit:  useCreateUserWithRelacion.addRelacionToExisting(uid, datos)
 *
 *   Modo C · "bloqueado" (user existe · YA tiene relación empleado vigente)
 *     Muestra: PersonaAutocomplete (chip pill con indicador rojo) + banner
 *     Submit:  disabled
 *
 * Borrador canon (2026-05-07): autoguardado via borradorWizardService tipo 'nuevo-empleado'.
 * El borrador persiste emailInput (string) · no el objeto UserProfile (no serializable).
 * Si al restaurar el borrador había emailInput → el autocomplete lo muestra pre-cargado;
 * el user NO se auto-selecciona (no queremos auto-selección sin gesto del usuario).
 *
 * Constraints:
 *   - Backend NO se toca · solo services existentes
 *   - Canon F6-A modal centrado · FormModalV2
 *   - Canon F7 · tabular-nums en montos
 *   - Canon F8 · iconos lucide únicos
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, AlertCircle } from 'lucide-react';
import { FormModalV2 } from '../../../design-system';
import {
  useCreateUserWithRelacion,
} from '../../../hooks/useCreateUserWithRelacion';
import {
  PersonaAutocomplete,
} from '../../usuarios/forms/PersonaAutocomplete';
import {
  DatosPersonalesFields,
  type DatosPersonalesValues,
} from '../../usuarios/forms/DatosPersonalesFields';
import {
  DatosLaboralesFields,
  type DatosLaboralesValues,
} from '../../usuarios/forms/DatosLaboralesFields';
import {
  InfoRelevantePanel,
} from '../../usuarios/forms/InfoRelevantePanel';
import { borradorWizardService } from '../../../services/borradorWizard.service';
import { userService } from '../../../services/user.service';
import { useAuthStore } from '../../../store/authStore';
import type { UserProfile } from '../../../types/auth.types';
import type {
  DatosLaboralesSnapshot,
  DatosSocioSnapshot,
  RelacionLaboral,
  SubTipoEmpleado,
  TipoRelacion,
} from '../../../types/relacionLaboral.types';

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

  // ── Teléfono pendiente (de InfoRelevantePanel alerta 3) ─────────────────
  const [telefonoPending, setTelefonoPending] = useState<string | null>(null);

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
    setTelefonoPending(null);
    setBorradorRestaurado(false);
    clearError();
  };

  const handleClose = () => {
    setBorradorRestaurado(false);
    onClose();
  };

  // ─── Callback autocomplete: user seleccionado del dropdown ──────────
  const handleUserSelected = (user: UserProfile, relaciones: RelacionLaboral[]) => {
    setUserExistente(user);
    setRelacionesVigentes(relaciones);
    // Sincronizar emailInput con el email del user seleccionado
    setEmailInput(user.email);
    // Limpiar error de email si existía
    if (errors.personales?.email) {
      setErrors((prev) => ({
        ...prev,
        personales: { ...prev.personales, email: undefined },
      }));
    }
  };

  // ─── Callback autocomplete: "Crear nuevo con X" ───────────────────────
  const handleCreateNew = (query: string) => {
    // Resetear user existente
    setUserExistente(null);
    setRelacionesVigentes([]);
    // Pre-llenar según si es email o nombre
    const isEmail = query.includes('@');
    if (isEmail) {
      setEmailInput(query);
    } else {
      setPersonales((prev) => ({ ...prev, displayName: query }));
    }
  };

  // ─── Callback autocomplete: deseleccionar (click X en pill) ──────────
  const handleDeselect = () => {
    setUserExistente(null);
    setRelacionesVigentes([]);
    setEmailInput('');
    setTelefonoPending(null);
  };

  // ─── Callback InfoRelevantePanel: pre-rellenar desde historial ────────
  const handlePrefillFromHistory = (
    snapshot: DatosLaboralesSnapshot | DatosSocioSnapshot,
    _tipo: TipoRelacion,
  ) => {
    // Narrowing: solo aplica cuando tiene campo 'salarioBruto' (DatosLaboralesSnapshot)
    if ('salarioBruto' in snapshot) {
      const s = snapshot as DatosLaboralesSnapshot;
      setLaborales((prev) => ({
        ...prev,
        cargoDisplay: s.cargo || prev.cargoDisplay,
        montoMensualReferencia:
          s.salarioBruto > 0 ? s.salarioBruto : prev.montoMensualReferencia,
        monedaReferencia: s.monedaSalario ?? prev.monedaReferencia,
      }));
    }
  };

  // ─── Callback InfoRelevantePanel: teléfono pending ────────────────────
  const handleTelefonoPending = (telefono: string) => {
    setTelefonoPending(telefono);
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
        // Aplicar teléfono pending antes de crear la relación (si el admin lo completó)
        if (telefonoPending) {
          await userService.updateProfile(userExistente.uid, { telefono: telefonoPending });
        }
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

        {/* ── Autocomplete de personas · siempre arriba ── */}
        <PersonaAutocomplete
          inputValue={emailInput}
          onInputChange={(v) => setEmailInput(v)}
          userExistente={userExistente}
          relacionesVigentes={relacionesVigentes}
          onUserSelected={handleUserSelected}
          onCreateNew={handleCreateNew}
          onDeselect={handleDeselect}
          tipoModal="empleado"
          error={errors.personales?.email}
        />

        {/* Banner bloqueado · CTA al UserPanel */}
        {modoBlocked && userExistente && (
          <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="text-[12px] text-rose-800 flex-1">
              <span>
                Ya tiene una relaci&oacute;n de <strong>empleado</strong> vigente.
                Para modificar su cargo o sueldo, abrí su perfil desde Usuarios.
              </span>
              <button
                type="button"
                onClick={() => handleOpenUserPanel(userExistente.uid)}
                className="block mt-1 text-[11px] font-semibold text-rose-700 underline hover:text-rose-900"
              >
                Abrir perfil de {userExistente.displayName} en Usuarios &rarr;
              </button>
            </div>
          </div>
        )}

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
            {/* Panel de información relevante · alertas contextuales */}
            <InfoRelevantePanel
              user={userExistente}
              tipoModal="empleado"
              relacionesVigentes={relacionesVigentes}
              onPrefillFromHistory={handlePrefillFromHistory}
              onTelefonoPending={handleTelefonoPending}
            />

            <div className="border-t border-slate-100" />
            {/* La chip-pill del autocomplete ya muestra los datos del user. Solo mostramos los datos laborales. */}
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
      </div>
    </FormModalV2>
  );
};
