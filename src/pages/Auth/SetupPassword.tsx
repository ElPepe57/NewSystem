/**
 * src/pages/Auth/SetupPassword.tsx
 * chk5.F4-USERS (2026-05-25) · NUEVA · post-invitación de admin.
 *
 * URL: /setup-password/:invitacionId?token=...
 *
 * Flujo:
 *   1. Lee invitacionId de path · token de query string
 *   2. Pide al user setear password (+ confirmación)
 *   3. createUserWithEmailAndPassword (Firebase Auth)
 *   4. Llama CF `acceptInvitation` con uid + token · server valida y crea
 *      UserProfile con estado='activo' + origen='invitacion_admin'
 *   5. Redirige a /dashboard
 */
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { Mail, Eye, EyeOff, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button, Input, Card } from '../../components/common';
import { AuthService } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import { VitaSkinLogo, AuthPageWrapper, DropletDivider } from './AuthDecorations';
import {
  evaluatePasswordStrength,
  strengthBarColor,
  strengthTextColor,
} from '../../utils/passwordStrength';

const functions = getFunctions();

interface InvitacionPreview {
  email: string;
  nombreSugerido?: string;
  invitadoPorNombre: string;
  rolesPreAsignados: string[];
  fechaCaducidad: { toDate: () => Date };
  estado: string;
}

interface AcceptInvitationResponse {
  success: boolean;
}

export const SetupPassword: React.FC = () => {
  const { invitacionId } = useParams<{ invitacionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);

  const token = searchParams.get('token') || '';

  const [invitacion, setInvitacion] = useState<InvitacionPreview | null>(null);
  const [loadingInv, setLoadingInv] = useState(true);
  const [invError, setInvError] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const passwordStrength = evaluatePasswordStrength(password);

  // Si ya está logueado · ir al dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Cargar preview de la invitación (read directo a Firestore)
  // NOTA: la validación real del token se hace en CF acceptInvitation.
  // Acá solo mostramos info de bienvenida.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!invitacionId) {
        setInvError('Link de invitación inválido');
        setLoadingInv(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'invitaciones', invitacionId));
        if (cancelled) return;
        if (!snap.exists()) {
          setInvError('Invitación no encontrada · puede que haya expirado');
          setLoadingInv(false);
          return;
        }
        const data = snap.data() as InvitacionPreview;

        if (data.estado === 'aceptada') {
          setInvError('Esta invitación ya fue usada · ingresá con tu cuenta existente');
          setLoadingInv(false);
          return;
        }
        if (data.estado === 'cancelada' || data.estado === 'expirada') {
          setInvError(`Invitación ${data.estado} · pedile al admin que envíe una nueva`);
          setLoadingInv(false);
          return;
        }

        setInvitacion(data);
        setDisplayName(data.nombreSugerido || '');
        setLoadingInv(false);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Error al cargar invitación';
        setInvError(msg);
        setLoadingInv(false);
      }
    })();
    return () => { cancelled = true; };
  }, [invitacionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!invitacionId || !token || !invitacion) {
      setError('Datos de invitación incompletos');
      return;
    }
    if (!displayName.trim() || displayName.trim().length < 3) {
      setError('El nombre debe tener al menos 3 caracteres');
      return;
    }
    if (passwordStrength.level === 'muy_debil' || passwordStrength.level === 'debil') {
      setError('La contraseña no cumple la política mínima');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Crear cuenta en Firebase Auth con el email de la invitación
      const firebaseUser = await AuthService.register(invitacion.email, password);

      // 2. Llamar CF acceptInvitation (valida JWT + crea UserProfile activo)
      const fn = httpsCallable<
        { invitacionId: string; token: string; uid: string; email: string; displayName: string },
        AcceptInvitationResponse
      >(functions, 'acceptInvitation');
      await fn({
        invitacionId,
        token,
        uid: firebaseUser.uid,
        email: invitacion.email,
        displayName: displayName.trim(),
      });

      // 3. Setear user en store · App.tsx fetchUserProfile cargará el perfil activo
      setUser(firebaseUser);
      navigate('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al activar cuenta';
      setError(msg);
      setSubmitting(false);
    }
  };

  // ── ESTADOS DE RENDER ──────────────────────────────────────────────────

  if (loadingInv) {
    return (
      <AuthPageWrapper>
        <Card className="w-full max-w-md relative z-10 shadow-xl shadow-teal-900/10 border border-teal-100 text-center py-8">
          <Loader className="h-8 w-8 text-teal-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-600">Validando invitación...</p>
        </Card>
      </AuthPageWrapper>
    );
  }

  if (invError || !invitacion) {
    return (
      <AuthPageWrapper>
        <Card className="w-full max-w-md relative z-10 shadow-xl shadow-teal-900/10 border border-red-100">
          <div className="text-center mb-4">
            <div className="flex justify-center mb-3">
              <VitaSkinLogo className="h-14 w-14 drop-shadow-lg" />
            </div>
            <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-2" />
            <h1 className="text-lg font-bold text-slate-900">Invitación inválida</h1>
            <p className="text-sm text-slate-600 mt-2">{invError || 'No pudimos cargar la invitación'}</p>
          </div>
          <Button onClick={() => navigate('/login')} variant="primary" className="w-full">
            Ir a Iniciar Sesión
          </Button>
        </Card>
      </AuthPageWrapper>
    );
  }

  const expiraDate = invitacion.fechaCaducidad?.toDate?.() || new Date();
  const nombreUser = displayName || invitacion.nombreSugerido || invitacion.email.split('@')[0];

  return (
    <AuthPageWrapper>
      <Card className="w-full max-w-md relative z-10 shadow-xl shadow-teal-900/10 border border-teal-100">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="flex justify-center mb-3">
            <VitaSkinLogo className="h-14 w-14 drop-shadow-lg" />
          </div>
          <DropletDivider />
        </div>

        {/* Info invitación */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 text-xs text-teal-900">
          <div className="flex items-start gap-2">
            <Mail className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Invitación válida</strong> · enviada por <strong>{invitacion.invitadoPorNombre}</strong>
              <div className="text-[10px] text-teal-700 mt-1">
                Expira el {expiraDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })}
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-xl font-bold text-slate-900 text-center mb-1">
          Bienvenida, {nombreUser}
        </h1>
        <p className="text-xs text-slate-600 text-center mb-4">
          Definí tu contraseña para activar tu cuenta.
          {invitacion.rolesPreAsignados.length > 0 && (
            <> Tu rol asignado: <strong className="text-teal-700">{invitacion.rolesPreAsignados.join(', ')}</strong></>
          )}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Input
            label="Email"
            type="email"
            value={invitacion.email}
            disabled
            className="bg-slate-50 text-slate-500"
          />

          <Input
            label="Nombre completo"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Juan Pérez"
            required
          />

          <div className="relative">
            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600"
              aria-label="toggle password"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            {password.length > 0 && (
              <>
                <div className="mt-1.5 flex gap-1">
                  {[1, 2, 3, 4].map((seg) => (
                    <div
                      key={seg}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        seg <= passwordStrength.filled
                          ? strengthBarColor(passwordStrength.color)
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <div className={`mt-1 text-[10px] ${strengthTextColor(passwordStrength.color)}`}>
                  {passwordStrength.message}
                </div>
              </>
            )}
          </div>

          <Input
            label="Confirmar contraseña"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite tu contraseña"
            required
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full" loading={submitting}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Activar mi cuenta
          </Button>
        </form>
      </Card>
    </AuthPageWrapper>
  );
};
