/**
 * MetodosInicioSesion.tsx · chk5.AUTH-LINK (2026-05-28)
 *
 * Sección "Métodos de inicio de sesión" para /perfil.
 * Permite al user gestionar los providers de Firebase Auth vinculados a su cuenta:
 *   - Email + Contraseña (password)
 *   - Google (google.com)
 *
 * Acciones:
 *   · Si NO tiene Google → botón "Vincular Google" (linkWithPopup)
 *   · Si NO tiene password → botón "Configurar contraseña" (linkWithCredential)
 *   · Desvincular un provider (siempre que tenga al menos otro · seguridad)
 *
 * Casos de uso típicos canon v5.x:
 *   - Carlos creó cuenta con email/password · ahora quiere usar también su Google
 *     personal · click "Vincular Google" · puede entrar con ambos
 *   - Ana entró desde invitación con Google · quiere configurar password como
 *     fallback · click "Configurar contraseña"
 *   - Diego desvincula Google porque cambió de email personal · OK si tiene password
 *     (no se permite desvincular único provider · canon UX)
 */

import React, { useState } from 'react';
import {
  Mail,
  Key,
  Loader2,
  AlertCircle,
  CheckCircle,
  Unlink,
  Link as LinkIcon,
} from 'lucide-react';
import { AuthService } from '../../services/auth.service';

// SVG inline del logo de Google · evita dependencia externa
const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

interface ProviderRowProps {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  isLinked: boolean;
  onLink?: () => void;
  onUnlink?: () => void;
  loading?: boolean;
}

const ProviderRow: React.FC<ProviderRowProps> = ({
  icon,
  label,
  subtitle,
  isLinked,
  onLink,
  onUnlink,
  loading,
}) => (
  <div className="bg-white ring-1 ring-slate-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-[180px]">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-slate-900">{label}</span>
        {isLinked && (
          <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold inline-flex items-center gap-0.5">
            <CheckCircle className="w-2.5 h-2.5" />
            Vinculado
          </span>
        )}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
    </div>
    {isLinked ? (
      onUnlink && (
        <button
          type="button"
          onClick={onUnlink}
          disabled={loading}
          className="text-xs text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
          Desvincular
        </button>
      )
    ) : (
      onLink && (
        <button
          type="button"
          onClick={onLink}
          disabled={loading}
          className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1 font-semibold disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
          Vincular
        </button>
      )
    )}
  </div>
);

export const MetodosInicioSesion: React.FC = () => {
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwd, setPwd] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');

  // Recalcular providers cada vez que refresh cambie
  const providers = React.useMemo(() => AuthService.getCurrentProviders(), [refresh]);
  const hasPassword = providers.includes('password');
  const hasGoogle = providers.includes('google.com');
  const currentUser = AuthService.getCurrentUser();

  const handleLinkGoogle = async () => {
    setError(null);
    setSuccess(null);
    setLoadingProvider('google.com');
    try {
      await AuthService.linkGoogleToCurrentUser();
      setSuccess('Google vinculado · ahora podés entrar con cualquiera de los 2 métodos');
      setRefresh((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al vincular Google');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!confirm('¿Desvincular Google? Vas a tener que usar tu contraseña para entrar.')) return;
    setError(null);
    setSuccess(null);
    setLoadingProvider('google.com');
    try {
      await AuthService.unlinkProvider('google.com');
      setSuccess('Google desvinculado');
      setRefresh((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desvincular Google');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleAddPassword = async () => {
    setError(null);
    setSuccess(null);
    if (pwd.length < 8) {
      setError('La contraseña debe tener mínimo 8 caracteres');
      return;
    }
    if (pwd !== pwdConfirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (!currentUser?.email) {
      setError('No se puede agregar contraseña sin email registrado');
      return;
    }
    setLoadingProvider('password');
    try {
      await AuthService.linkPasswordToCurrentUser(currentUser.email, pwd);
      setSuccess('Contraseña configurada · ahora podés entrar con email + contraseña');
      setShowPasswordForm(false);
      setPwd('');
      setPwdConfirm('');
      setRefresh((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al configurar contraseña');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleUnlinkPassword = async () => {
    if (!confirm('¿Desvincular contraseña? Vas a tener que entrar SOLO con Google.')) return;
    setError(null);
    setSuccess(null);
    setLoadingProvider('password');
    try {
      await AuthService.unlinkProvider('password');
      setSuccess('Contraseña desvinculada');
      setRefresh((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desvincular contraseña');
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div className="bg-white ring-1 ring-slate-200 rounded-2xl p-5 space-y-3">
      <div>
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Key className="w-4 h-4 text-purple-700" />
          Métodos de inicio de sesión
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Vinculá Google + Contraseña a tu cuenta · podés iniciar sesión con cualquiera.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 flex items-start gap-2 text-xs text-rose-900">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-lg p-3 flex items-start gap-2 text-xs text-emerald-900">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Email + contraseña */}
      <ProviderRow
        icon={<Mail className="w-5 h-5 text-slate-700" />}
        label="Email + contraseña"
        subtitle={
          hasPassword
            ? `Podés entrar con ${currentUser?.email ?? 'tu email'} + contraseña`
            : 'Sin contraseña configurada · solo entrás con otro método'
        }
        isLinked={hasPassword}
        onLink={hasPassword ? undefined : () => setShowPasswordForm(true)}
        onUnlink={hasPassword ? handleUnlinkPassword : undefined}
        loading={loadingProvider === 'password'}
      />

      {/* Form inline para configurar contraseña (cuando hasPassword=false) */}
      {showPasswordForm && !hasPassword && (
        <div className="bg-slate-50 ring-1 ring-slate-200 rounded-lg p-3 space-y-2">
          <div className="text-xs font-bold text-slate-700">Configurar contraseña</div>
          <input
            type="password"
            placeholder="Nueva contraseña (mín 8 caracteres)"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoComplete="new-password"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
          <input
            type="password"
            placeholder="Confirmar contraseña"
            value={pwdConfirm}
            onChange={(e) => setPwdConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowPasswordForm(false);
                setPwd('');
                setPwdConfirm('');
                setError(null);
              }}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAddPassword}
              disabled={loadingProvider === 'password'}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-60"
            >
              {loadingProvider === 'password' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle className="w-3 h-3" />
              )}
              Configurar
            </button>
          </div>
        </div>
      )}

      {/* Google */}
      <ProviderRow
        icon={<GoogleIcon className="w-5 h-5" />}
        label="Google"
        subtitle={
          hasGoogle
            ? `Podés entrar con tu cuenta de Google asociada`
            : 'Sin Google vinculado · vinculalo para entrada rápida'
        }
        isLinked={hasGoogle}
        onLink={hasGoogle ? undefined : handleLinkGoogle}
        onUnlink={hasGoogle ? handleUnlinkGoogle : undefined}
        loading={loadingProvider === 'google.com'}
      />

      <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-600 flex items-start gap-2">
        <span className="flex-shrink-0">💡</span>
        <span>
          <strong>Tip de seguridad:</strong> mantené AL MENOS 2 métodos vinculados · si perdés
          acceso a uno (ej. olvido contraseña · cambio de Google), podés entrar con el otro y
          resetear el primero desde acá.
        </span>
      </div>
    </div>
  );
};

export default MetodosInicioSesion;
