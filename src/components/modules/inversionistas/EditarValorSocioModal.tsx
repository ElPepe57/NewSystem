/**
 * EditarValorSocioModal · F14.4 (2026-06-06) · decisión D3
 *
 * Edita el sub-perfil de socio (participación + aporte de valor) desde el hogar
 * del capital en Inversionistas. Persiste en `datosSocio` (/users/{uid}/private/),
 * que sigue siendo la fuente de verdad privada · acá solo se ORQUESTA la edición
 * (canon "admin ve todo" · el cap table es responsabilidad de gestión).
 *
 * Reusa el DatosSocioForm existente (no duplica el formulario de valor).
 */
import React, { useState, useEffect } from 'react';
import { Brain, Check } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import DatosSocioForm from '../usuarios/DatosSocioForm';
import { getDatosSocio, setDatosSocio } from '../../../services/datosSocio.service';
import { useAuthStore } from '../../../store/authStore';
import type { DatosSocio, DatosSocioFormData } from '../../../types/datosSocio.types';

interface Props {
  isOpen: boolean;
  /** uid del UserProfile del socio (panelUid). */
  userId: string;
  socioNombre: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditarValorSocioModal({
  isOpen,
  userId,
  socioNombre,
  onClose,
  onSuccess,
}: Props) {
  const actorUid = useAuthStore((s) => s.userProfile?.uid ?? '');

  const [initialData, setInitialData] = useState<DatosSocio | null>(null);
  const [formData, setFormData] = useState<DatosSocioFormData | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;
    setLoading(true);
    setError(null);
    setFormData(null);
    setIsValid(false);
    getDatosSocio(userId)
      .then((d) => {
        setInitialData(d);
        setLoading(false);
      })
      .catch(() => {
        setError('No se pudieron cargar los datos del socio.');
        setLoading(false);
      });
  }, [isOpen, userId]);

  const handleSubmit = async () => {
    if (!formData || !isValid) {
      setError('Completá los campos requeridos (participación y, si aplica, el aporte de valor).');
      return;
    }
    if (!actorUid) {
      setError('Sesión no válida.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await setDatosSocio(userId, formData, actorUid);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los datos.');
      setSaving(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Participación y aporte de valor"
      subtitle={`${socioNombre} · cap table del negocio`}
      breadcrumb="Capital · Valor"
      icon={Brain}
      iconTone="violet"
      submitLabel="Guardar"
      submitIcon={Check}
      loading={saving}
      disabled={loading || !isValid}
      size="lg"
    >
      {error && (
        <div className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}
      {loading ? (
        <div className="py-10 text-center text-[12px] text-slate-500">Cargando datos del socio…</div>
      ) : (
        <DatosSocioForm
          key={userId}
          initialData={initialData ?? undefined}
          onChange={(d, v) => {
            setFormData(d);
            setIsValid(v);
          }}
        />
      )}
    </FormModalV2>
  );
}
