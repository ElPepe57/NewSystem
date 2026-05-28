import React, { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { Button, Input, Card } from '../../components/common';
import { AuthService, AccountExistsError } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import { VitaSkinLogo, AuthPageWrapper, DropletDivider } from './AuthDecorations';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const userProfile = useAuthStore(state => state.userProfile);
  const setUser = useAuthStore(state => state.setUser);
  const setError = useAuthStore(state => state.setError);
  // chk5.AUTH-GUARD.fix (2026-05-28) · leer error del store (ej. cruce de identidad
  // detectado por el guard de authStore que fuerza logout y nos devuelve aquí).
  const storeError = useAuthStore(state => state.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setLocalError] = useState('');
  // chk5.AUTH-LINK · banner especial cuando Google login falla por account-exists
  const [linkingHint, setLinkingHint] = useState<{ email: string; methods: string[] } | null>(null);

  // Si ya está autenticado, redirigir
  if (user && userProfile?.activo) {
    return <Navigate to="/dashboard" replace />;
  }
  if (user && userProfile && !userProfile.activo) {
    return <Navigate to="/pending-approval" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setLoading(true);

    try {
      const user = await AuthService.login(email, password);
      setUser(user);
      navigate('/dashboard');
    } catch (err: any) {
      setLocalError(err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLocalError('');
    setLinkingHint(null);
    setGoogleLoading(true);

    try {
      const user = await AuthService.loginWithGoogle();
      setUser(user);
      navigate('/dashboard');
    } catch (err: any) {
      // chk5.AUTH-LINK · UX especial cuando el email ya tiene otro provider
      if (err instanceof AccountExistsError) {
        setLinkingHint({ email: err.email, methods: err.existingMethods });
        // Auto-rellenar el email para que el user solo escriba password
        setEmail(err.email);
        setLocalError('');
      } else {
        setLocalError(err.message);
        setError(err.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthPageWrapper>
      <Card className="w-full max-w-md relative z-10 shadow-xl shadow-teal-900/10 border border-teal-100">
        {/* Header con logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <VitaSkinLogo className="h-20 w-20 drop-shadow-lg" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Vita Skin Peru
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">
            Vitaminas, Skincare y Bienestar
          </p>
          <DropletDivider />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
          />

          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {/* chk5.AUTH-LINK · banner especial cuando Google login falla porque
              el email ya está registrado con password. UX clara · auto-llena email. */}
          {linkingHint && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-lg text-sm space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Ya tenés cuenta con este email</span>
              </div>
              <p className="text-xs">
                <strong>{linkingHint.email}</strong> está registrado con{' '}
                {linkingHint.methods.includes('password') ? 'contraseña' : 'otro método'}.
                Ingresá tu contraseña abajo · desde tu perfil podés vincular Google después.
              </p>
              {!linkingHint.methods.includes('password') && (
                <p className="text-xs">
                  Si no recordás tu contraseña ·{' '}
                  <Link to="/forgot-password" className="underline font-semibold">
                    resetearla acá
                  </Link>
                  .
                </p>
              )}
            </div>
          )}

          {(error || storeError) && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error || storeError}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={loading}
          >
            Iniciar Sesión
          </Button>
        </form>

        {/* Separador */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-slate-500">o continúa con</span>
          </div>
        </div>

        {/* Botón Google */}
        <button
          onClick={handleGoogleLogin}
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
            {googleLoading ? 'Conectando...' : 'Iniciar con Google'}
          </span>
        </button>

        <div className="mt-6 text-center">
          <Link to="/forgot-password" className="text-sm text-teal-600 hover:text-teal-700 font-medium">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {/* Link a registro */}
        <div className="mt-4 text-center">
          <p className="text-sm text-slate-500">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-teal-600 hover:text-teal-700 font-semibold transition-colors">
              Crear Cuenta
            </Link>
          </p>
        </div>

        {/* Footer sutil */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">Productos importados para tu cuidado</p>
        </div>
      </Card>
    </AuthPageWrapper>
  );
};
