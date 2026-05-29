/**
 * NuevoEmpleadoModal.tsx · chk5.PERSONAS-v5.8 · E3 (2026-05-28)
 *
 * Modal F6-A (FormModalV2 centrado) para dar de alta a un nuevo empleado
 * directamente desde /planilla, sin pasar por el wizard 4-pasos de /usuarios.
 *
 * Estructura del body (2 secciones visuales · todo visible a la vez):
 *   Sección 1: "Datos personales"   → DatosPersonalesFields
 *   Sección 2: "Datos laborales"    → DatosLaboralesFields (subTipo planilla)
 *
 * Submit: useCreateUserWithRelacion con tipo='empleado'
 *
 * Borrador canon (2026-05-07): autoguardado via borradorWizardService tipo 'nuevo-empleado'.
 * Se restaura al abrir si existe borrador del usuario activo.
 *
 * Constraints:
 *   - Backend NO se toca · solo services existentes
 *   - Canon F6-A modal centrado · FormModalV2
 *   - Canon F7 · tabular-nums en montos
 *   - Canon F8 · iconos lucide únicos
 */

import React, { useEffect, useRef, useState } from 'react';
import { Briefcase, AlertCircle } from 'lucide-react';
import { FormModalV2 } from '../../../design-system';
import { useCreateUserWithRelacion } from '../../../hooks/useCreateUserWithRelacion';
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
import type { SubTipoEmpleado } from '../../../types/relacionLaboral.types';

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
  global?: string;
}

function validate(
  p: DatosPersonalesValues,
  l: DatosLaboralesValues,
): ValidationErrors {
  const errors: ValidationErrors = {};
  const ep: Partial<Record<keyof DatosPersonalesValues, string>> = {};
  const el: Partial<Record<keyof DatosLaboralesValues, string>> = {};

  if (!p.displayName.trim() || p.displayName.trim().length < 3) {
    ep.displayName = 'Nombre requerido (mín. 3 caracteres)';
  }
  if (!p.email.trim() || !p.email.includes('@') || !p.email.includes('.')) {
    ep.email = 'Email inválido';
  }
  if (p.password.length < 8) {
    ep.password = 'Password mínimo 8 caracteres';
  }
  if (!l.cargoDisplay.trim()) {
    el.cargoDisplay = 'Cargo requerido';
  }

  if (Object.keys(ep).length > 0) errors.personales = ep;
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
  const currentUser = useAuthStore((s) => s.userProfile);
  const { create, loading, error: hookError, clearError } = useCreateUserWithRelacion(
    currentUser?.uid ?? 'system',
  );

  const [personales, setPersonales] = useState<DatosPersonalesValues>(INITIAL_PERSONALES);
  const [laborales, setLaborales] = useState<DatosLaboralesValues>(INITIAL_LABORALES);
  const [enviarInvitacion, setEnviarInvitacion] = useState(true);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Restaurar borrador al abrir ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !currentUser?.uid || borradorRestaurado) return;
    void (async () => {
      try {
        const borrador = await borradorWizardService.get(currentUser.uid, 'nuevo-empleado');
        if (borrador?.estado) {
          const s = borrador.estado as Record<string, unknown>;
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
    const hayDatos = personales.displayName.trim() || personales.email.trim();
    if (!hayDatos) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const resumen = personales.displayName
        ? `${personales.displayName}${laborales.cargoDisplay ? ` · ${laborales.cargoDisplay}` : ''}`
        : 'Borrador empleado sin nombre';
      void borradorWizardService
        .save({
          tipo: 'nuevo-empleado',
          userId: currentUser.uid,
          pasoActual: 1,
          estado: { personales, laborales } as unknown as Record<string, unknown>,
          resumen,
          montoEstimado:
            laborales.montoMensualReferencia !== '' ? Number(laborales.montoMensualReferencia) : undefined,
        })
        .catch((err) => console.warn('[NuevoEmpleadoModal] error guardando borrador:', err));
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [personales, laborales, isOpen, currentUser?.uid, borradorRestaurado]);

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
    setPersonales(INITIAL_PERSONALES);
    setLaborales(INITIAL_LABORALES);
    setEnviarInvitacion(true);
    setErrors({});
    setBorradorRestaurado(false);
    clearError();
  };

  const handleClose = () => {
    // Cierra preservando borrador (el usuario puede continuar después)
    setBorradorRestaurado(false);
    onClose();
  };

  // ─── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const validationErrors = validate(personales, laborales);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    try {
      const { uid } = await create({
        displayName: personales.displayName.trim(),
        email: personales.email.trim().toLowerCase(),
        telefono: personales.telefono.trim() || undefined,
        password: personales.password,
        tipo: 'empleado',
        subTipo: (laborales.subTipo || undefined) as SubTipoEmpleado | undefined,
        cargoDisplay: laborales.cargoDisplay.trim() || undefined,
        montoMensualReferencia:
          laborales.montoMensualReferencia !== '' ? Number(laborales.montoMensualReferencia) : undefined,
        monedaReferencia: laborales.monedaReferencia,
        notas: laborales.notas.trim() || undefined,
      });

      await limpiarBorrador();
      resetState();
      onSuccess(uid);
    } catch {
      // El error ya está en hookError · se muestra en el banner
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

  const canSubmit =
    !loading &&
    personales.displayName.trim().length >= 3 &&
    personales.email.includes('@') &&
    personales.password.length >= 8 &&
    laborales.cargoDisplay.trim().length > 0;

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={handleClose}
      onSubmit={handleSubmit}
      title="Nuevo empleado"
      subtitle="Alta a planilla · 5ta categoría · sueldo fijo mensual"
      icon={Briefcase}
      iconTone="teal"
      submitLabel={loading ? 'Creando empleado...' : 'Agregar a planilla'}
      submitVariant="primary-soft"
      submitIcon={Briefcase}
      loading={loading}
      disabled={!canSubmit}
      size="lg"
      footerExtras={
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enviarInvitacion}
            onChange={(e) => setEnviarInvitacion(e.target.checked)}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-[12px] text-slate-600">Enviar invitación al email</span>
        </label>
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

        {/* Sección 1 · Datos personales */}
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[9px] font-bold">
              1
            </span>
            Datos personales
          </div>
          <DatosPersonalesFields
            values={personales}
            onChange={handlePersonalesChange}
            errors={errors.personales}
          />
        </div>

        {/* Divisor */}
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
      </div>
    </FormModalV2>
  );
};
