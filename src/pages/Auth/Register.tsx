import React, { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import { Button, Input, Card } from '../../components/common';
import { AuthService } from '../../services/auth.service';
import { userService } from '../../services/user.service';
import { useAuthStore } from '../../store/authStore';
import { VitaSkinLogo, AuthPageWrapper, DropletDivider } from './AuthDecorations';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const userProfile = useAuthStore(state => state.userProfile);
  const setUser = useAuthStore(state => state.setUser);
  const setUserProfile = useAuthStore(state => state.setUserProfile);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  // Guards: si ya está autenticado, redirigir
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
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
    if (password !== confirmPassword) return 'Las contraseñas no coinciden';
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
      // 1. Crear cuenta en Firebase Auth
      const firebaseUser = await AuthService.register(email, password);

      // 2. Crear perfil en Firestore con activo: false (pendiente de aprobación)
      const profile = await userService.createProfile(
        firebaseUser.uid,
        email,
        displayName.trim(),
        'invitado',
        undefined,
        false // activo: false
      );

      // 3. Actualizar store
      setUser(firebaseUser);
      setUserProfile(profile);

      // 4. Redirigir a pantalla de espera
      navigate('/pending-approval');
    } catch (err: any) {
      setError(err.message);
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
      // fetchUserProfile en App.tsx se encargará de crear el perfil con activo: false
      navigate('/dashboard'); // ProtectedRoute redirigirá a /pending-approval si no está activo
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthPageWrapper>
      <Card className="w-full max-w-md relative z-10 shadow-xl shadow-primary-900/10 border border-primary-100">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <VitaSkinLogo className="h-16 w-16 drop-shadow-lg" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-transparent">
            Crear Cuenta
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
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
            icon={<UserPlus className="h-4 w-4 text-gray-400" />}
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
              placeholder="Mínimo 6 caracteres"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Input
            label="Confirmar Contraseña"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite tu contraseña"
            required
          />

          {error && (
            <div className="bg-danger-50 border border-danger-200 text-danger-800 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={loading}
          >
            Crear Cuenta
          </Button>
        </form>

        {/* Separador */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">o regístrate con</span>
          </div>
        </div>

        {/* Botón Google */}
        <button
          onClick={handleGoogleRegister}
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
          <p className="text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold transition-colors">
              Iniciar Sesión
            </Link>
          </p>
        </div>
      </Card>
    </AuthPageWrapper>
  );
};
