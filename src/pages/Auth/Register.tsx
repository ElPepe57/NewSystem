import React, { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Button, Input, Card } from '../../components/common';
import { TurnstileWidget } from '../../components/common/TurnstileWidget';
import { AuthService } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import { VitaSkinLogo, AuthPageWrapper, DropletDivider } from './AuthDecorations';
import {
  evaluatePasswordStrength,
  strengthBarColor,
  strengthTextColor,
} from '../../utils/passwordStrength';

const functions = getFunctions();

interface ValidateSignupResponse {
  success: boolean;
  message: string;
}

interface CompletarSignupResponse {
  success: boolean;
}

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const userProfile = useAuthStore(state => state.userProfile);
  const setUser = useAuthStore(state => state.setUser);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordStrength = evaluatePasswordStrength(password);

  // Guards · si ya está autenticado, redirigir
  if (user && userProfile?.activo) {
    return <Navigate to="/dashboard" replace />;
  }
  if (user && userProfile && !userProfile.activo) {
    return <Navigate to="/pending-approval" replace />;
  }

  const validateForm = (): string | null => {
    if (!displayName.trim()) return 'El nombre completo es requerido';
    if (displayName.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres';
    if (!email.trim()) return 'El email es requerido';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email inválido';
    if (passwordStrength.level === 'muy_debil' || passwordStrength.level === 'debil') {
      return 'La contraseña no cumple la política mínima';
    }
    if (password !== confirmPassword) return 'Las contraseñas no coinciden';
    if (!captchaToken) return 'Completa el captcha antes de continuar';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      // 1. Pre-validación server-side · captcha + whitelist + rate-limit + duplicado
      const validateFn = httpsCallable<{ email: string; captchaToken: string }, ValidateSignupResponse>(
        functions,
        'validateSelfSignup',
      );
      await validateFn({ email: email.trim().toLowerCase(), captchaToken });

      // 2. Crear cuenta en Firebase Auth
      const firebaseUser = await AuthService.register(email.trim().toLowerCase(), password);

      // 3. Completar perfil server-side (estado: pendiente_aprobacion + notif admins)
      const completarFn = httpsCallable<
        { uid: string; email: string; displayName: string; userAgent?: string },
        CompletarSignupResponse
      >(functions, 'completarSelfSignup');
      await completarFn({
        uid: firebaseUser.uid,
        email: email.trim().toLowerCase(),
        displayName: displayName.trim(),
        userAgent: navigator.userAgent,
      });

      // 4. Setear user en store · redirige a /pending-approval automáticamente
      setUser(firebaseUser);
      navigate('/pending-approval');
    } catch (err) {
      // HttpsError llega con err.code (functions/...) y err.message
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      const firebaseUser = await AuthService.loginWithGoogle();
      setUser(firebaseUser);
      // fetchUserProfile en App.tsx creará el perfil con activo: false
      // El usuario será redirigido a /pending-approval vía ProtectedRoute
      navigate('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrarse con Google';
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthPageWrapper>
      <Card className="w-full max-w-md relative z-10 shadow-xl shadow-teal-900/10 border border-teal-100">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <VitaSkinLogo className="h-16 w-16 drop-shadow-lg" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Crear Cuenta</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Completa tus datos para solicitar acceso al sistema
          </p>
          <DropletDivider />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Input
            label="Nombre Completo"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Juan Pérez"
            required
            icon={<UserPlus className="h-4 w-4 text-slate-400" />}
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
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
              className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            {/* Password strength indicator */}
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
                {passwordStrength.hints.length > 0 && (
                  <ul className="mt-1 text-[10px] text-slate-500 space-y-0.5">
                    {passwordStrength.hints.slice(0, 2).map((hint, i) => (
                      <li key={i}>· {hint}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <Input
            label="Confirmar Contraseña"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite tu contraseña"
            required
          />

          {/* Cloudflare Turnstile captcha */}
          <div className="pt-1">
            <TurnstileWidget
              onSuccess={(token) => setCaptchaToken(token)}
              onError={() => setCaptchaToken('')}
              onExpired={() => setCaptchaToken('')}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={loading}
            disabled={!captchaToken}
          >
            Crear Cuenta
          </Button>
        </form>

        {/* Separador */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-slate-500">o regístrate con</span>
          </div>
        </div>

        {/* Botón Google */}
        <button
          onClick={handleGoogleRegister}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {googleLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          <span className="text-sm font-medium text-slate-700">
            {googleLoading ? 'Conectando...' : 'Registrarse con Google'}
          </span>
        </button>

        {/* Info de aprobación */}
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-700 text-center leading-relaxed">
            Después de registrarte, un administrador revisará y aprobará tu solicitud de acceso al sistema.
          </p>
        </div>

        {/* Link a login */}
        <div className="mt-4 text-center">
          <p className="text-sm text-slate-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-teal-600 hover:text-teal-700 font-semibold transition-colors">
              Iniciar Sesión
            </Link>
          </p>
        </div>
      </Card>
    </AuthPageWrapper>
  );
};
