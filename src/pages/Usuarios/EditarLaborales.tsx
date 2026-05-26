/**
 * src/pages/Usuarios/EditarLaborales.tsx
 * chk5.F4-USERS (2026-05-25) · Drill page · /usuarios/:uid/editar/laborales
 *
 * Canon F6.B (drill full-page para forms ricos). Sticky footer + breadcrumb
 * 3 niveles. Reusa DatosLaboralesForm existente.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronRight, Home, Save, BriefcaseBusiness, Loader, AlertCircle, ArrowLeft } from 'lucide-react';
import { userService } from '../../services/user.service';
import { datosLaboralesService } from '../../services/datosLaborales.service';
import DatosLaboralesForm from '../../components/modules/usuarios/DatosLaboralesForm';
import type { UserProfile } from '../../types/auth.types';
import type { DatosLaborales, DatosLaboralesFormData } from '../../types/datosLaborales.types';
import { useAuthStore } from '../../store/authStore';
import { hasAnyRole } from '../../types/auth.types';

export default function EditarLaborales() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.userProfile);
  const isAdmin = hasAnyRole(currentUser, ['admin', 'gerente']);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [datosLab, setDatosLab] = useState<DatosLaborales | null>(null);
  const [pending, setPending] = useState<DatosLaboralesFormData | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [user, datos] = await Promise.all([
          userService.getByUid(uid),
          datosLaboralesService.get(uid).catch(() => null),
        ]);
        if (cancelled) return;
        if (!user) {
          setError('Usuario no encontrado');
          return;
        }
        setProfile(user);
        setDatosLab(datos);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  const handleSave = async () => {
    if (!uid || !pending || !isValid || !currentUser) return;
    setSaving(true);
    setError(null);
    try {
      // service.set es idempotente · maneja create + update internamente
      await datosLaboralesService.set(uid, pending, currentUser.uid);
      navigate(-1);  // Vuelve al listado
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <p className="text-[14px] font-bold text-slate-900">Acceso restringido</p>
        <p className="text-[12px] text-slate-500 mt-1">Solo admin o gerente puede editar datos laborales</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="w-8 h-8 text-sky-600 animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <p className="text-[14px] font-bold text-slate-900">{error || 'No pudimos cargar la página'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-[12px] text-slate-600 underline">Volver</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-3 sm:p-6">
      {/* Breadcrumb canon S9.D1 · 3 niveles */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50">
          <Home className="w-3 h-3" />
          <Link to="/" className="hover:text-sky-600">Dashboard</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/usuarios" className="hover:text-sky-600">Usuarios</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-900 font-semibold truncate max-w-[120px]">{profile.displayName}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-900 font-semibold">Datos laborales</span>
        </div>

        {/* Header */}
        <div className="px-4 sm:px-6 py-5 border-b border-slate-100 flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-sky-600 rounded-xl flex items-center justify-center text-white flex-shrink-0">
            <BriefcaseBusiness className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[18px] font-bold text-slate-900">Datos laborales</h1>
            <p className="text-[12px] text-slate-500 truncate">
              {profile.displayName} · {profile.email}
              {datosLab ? ' · actualizando registro existente' : ' · creando nuevo registro'}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="px-4 sm:px-6 py-5">
          <DatosLaboralesForm
            initialData={datosLab || undefined}
            onChange={(data, valid) => {
              setPending(data);
              setIsValid(valid);
            }}
          />

          {error && (
            <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-lg text-[12px] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between sticky bottom-0">
          <button
            onClick={() => navigate(-1)}
            disabled={saving}
            className="text-[12px] text-slate-600 hover:text-slate-900 font-medium px-3 py-1.5 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-[12px] font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            {saving ? (
              <Loader className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
