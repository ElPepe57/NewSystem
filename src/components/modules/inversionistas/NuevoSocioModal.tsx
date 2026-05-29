/**
 * NuevoSocioModal.tsx · chk5.PERSONAS-v5.8 · E4 (2026-05-28)
 *
 * Modal F6-A (FormModalV2 centrado) para dar de alta a un nuevo socio
 * directamente desde /inversionistas, sin pasar por el wizard 4-pasos de /usuarios.
 *
 * Estructura del body (2 secciones visuales · todo visible a la vez):
 *   Sección 1: "Datos personales"  → DatosPersonalesFields
 *   Sección 2: "Datos de socio"    → DatosSocioFields
 *
 * Submit: useCreateUserWithRelacion con tipo='socio'
 *
 * Borrador canon (2026-05-07): autoguardado via borradorWizardService tipo 'nuevo-socio'.
 * Se restaura al abrir si existe borrador del usuario activo.
 *
 * Constraints:
 *   - Backend NO se toca · solo services existentes
 *   - Canon F6-A modal centrado · FormModalV2
 *   - Canon F8 · iconos lucide únicos
 *   - iconTone="purple" · color signature del módulo Inversionistas
 */

import React, { useEffect, useRef, useState } from 'react';
import { Handshake, AlertCircle } from 'lucide-react';
import { FormModalV2 } from '../../../design-system';
import { useCreateUserWithRelacion } from '../../../hooks/useCreateUserWithRelacion';
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
import type { SubTipoSocio } from '../../../types/relacionLaboral.types';

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

function validate(
  p: DatosPersonalesValues,
): ValidationErrors {
  const errors: ValidationErrors = {};
  const ep: Partial<Record<keyof DatosPersonalesValues, string>> = {};

  if (!p.displayName.trim() || p.displayName.trim().length < 3) {
    ep.displayName = 'Nombre requerido (mín. 3 caracteres)';
  }
  if (!p.email.trim() || !p.email.includes('@') || !p.email.includes('.')) {
    ep.email = 'Email inválido';
  }
  if (p.password.length < 8) {
    ep.password = 'Password mínimo 8 caracteres';
  }

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
  const currentUser = useAuthStore((s) => s.userProfile);
  const { create, loading, error: hookError, clearError } = useCreateUserWithRelacion(
    currentUser?.uid ?? 'system',
  );

  const [personales, setPersonales] = useState<DatosPersonalesValues>(INITIAL_PERSONALES);
  const [socio, setSocio] = useState<DatosSocioValues>(INITIAL_SOCIO);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Restaurar borrador al abrir ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !currentUser?.uid || borradorRestaurado) return;
    void (async () => {
      try {
        const borrador = await borradorWizardService.get(currentUser.uid, 'nuevo-socio');
        if (borrador?.estado) {
          const s = borrador.estado as Record<string, unknown>;
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
    const hayDatos = personales.displayName.trim() || personales.email.trim();
    if (!hayDatos) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const resumen = personales.displayName
        ? `${personales.displayName}${socio.cargoDisplay ? ` · ${socio.cargoDisplay}` : ''}`
        : 'Borrador socio sin nombre';
      void borradorWizardService
        .save({
          tipo: 'nuevo-socio',
          userId: currentUser.uid,
          pasoActual: 1,
          estado: { personales, socio } as unknown as Record<string, unknown>,
          resumen,
        })
        .catch((err) => console.warn('[NuevoSocioModal] error guardando borrador:', err));
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [personales, socio, isOpen, currentUser?.uid, borradorRestaurado]);

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
    setPersonales(INITIAL_PERSONALES);
    setSocio(INITIAL_SOCIO);
    setErrors({});
    setBorradorRestaurado(false);
    clearError();
  };

  const handleClose = () => {
    // Cierra preservando borrador
    setBorradorRestaurado(false);
    onClose();
  };

  // ─── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const validationErrors = validate(personales);
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
        tipo: 'socio',
        subTipo: (socio.subTipo || undefined) as SubTipoSocio | undefined,
        cargoDisplay: socio.cargoDisplay.trim() || undefined,
        notas: socio.notas.trim() || undefined,
      });

      await limpiarBorrador();
      resetState();
      onSuccess(uid);
    } catch {
      // Error ya está en hookError · se muestra en el banner
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

  const canSubmit =
    !loading &&
    personales.displayName.trim().length >= 3 &&
    personales.email.includes('@') &&
    personales.password.length >= 8;

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={handleClose}
      onSubmit={handleSubmit}
      title="Nuevo socio"
      subtitle="Alta al cap table · equity + distribuciones"
      icon={Handshake}
      iconTone="purple"
      submitLabel={loading ? 'Creando socio...' : 'Agregar al cap table'}
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
      </div>
    </FormModalV2>
  );
};
