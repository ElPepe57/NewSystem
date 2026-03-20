import React, { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { Button, Input, Card } from '../../components/common';
import { AuthService } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import { VitaSkinLogo, AuthPageWrapper, DropletDivider } from './AuthDecorations';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const userProfile = useAuthStore(state => state.userProfile);
  const setUser = useAuthStore(state => state.setUser);
  const setError = useAuthStore(state => state.setError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setLocalError] = useState('');

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
    setGoogleLoading(true);

    try {
      const user = await AuthService.loginWithGoogle();
      setUser(user);
      navigate('/dashboard');
    } catch (err: any) {
      setLocalError(err.message);
      setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthPageWrapper>
      <Card className="w-full max-w-md relative z-10 shadow-xl shadow-primary-900/10 border border-primary-100">
        {/* Header con logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <VitaSkinLogo className="h-20 w-20 drop-shadow-lg" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-transparent">
            Vita Skin Peru
          </h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">
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

          {error && (
            <div className="bg-danger-50 border border-danger-200 text-danger-800 px-4 py-3 rounded-lg">
              {error}
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
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">o continúa con</span>
          </div>
        </div>

        {/* Botón Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {googleLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          <span className="text-sm font-medium text-gray-700">
            {googleLoading ? 'Conectando...' : 'Iniciar con Google'}
          </span>
        </button>

        <div className="mt-6 text-center">
          <a href="#" className="text-sm text-primary-600 hover:text-primary-700">
            ¿Olvidaste tu contraseña?
          </a>
        </div>

        {/* Link a registro */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-semibold transition-colors">
              Crear Cuenta
            </Link>
          </p>
        </div>

        {/* Footer sutil */}
        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-400">Productos importados para tu cuidado</p>
        </div>
      </Card>
    </AuthPageWrapper>
  );
};
