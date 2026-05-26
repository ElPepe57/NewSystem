/**
 * src/pages/Auth/ForgotPassword.tsx
 * chk5.F4-USERS (2026-05-25) · Recuperación de password.
 *
 * Usa AuthService.resetPassword (Firebase nativo · sendPasswordResetEmail)
 * que ya existía. Esta ruta antes era un placeholder href="#" en Login.tsx.
 */
import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { KeyRound, ArrowLeft, MailCheck, AlertCircle } from 'lucide-react';
import { Button, Input, Card } from '../../components/common';
import { AuthService } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import { VitaSkinLogo, AuthPageWrapper, DropletDivider } from './AuthDecorations';

export const ForgotPassword: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const userProfile = useAuthStore(state => state.userProfile);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  // Guard · si ya está autenticado y activo, ir al dashboard
  if (user && userProfile?.activo) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Ingresá un email válido');
      return;
    }

    setLoading(true);
    try {
      await AuthService.resetPassword(email.trim().toLowerCase());
      setEnviado(true);
    } catch (err) {
      // Mensaje genérico para evitar email enumeration (SEC-004 pattern)
      // Tratamos errores de email-not-found como éxito (no revelar si existe)
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      if (msg.includes('Credenciales inválidas') || msg.includes('Email inválido')) {
        // Mostrar éxito igual · no revelar si el email existe
        setEnviado(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
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
          <div className="flex items-center justify-center gap-2 mb-2">
            <KeyRound className="h-5 w-5 text-teal-600" />
            <h1 className="text-xl font-bold text-slate-900">Recuperar contraseña</h1>
          </div>
          <p className="text-slate-500 text-sm">
            Te enviaremos un link para restablecer
          </p>
          <DropletDivider />
        </div>

        {!enviado ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoFocus
            />

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" variant="primary" className="w-full" loading={loading}>
              Enviar link de recuperación
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
              <MailCheck className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">Email enviado</p>
                <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                  Si existe una cuenta asociada a <strong>{email}</strong>, recibirás
                  un email con instrucciones. Revisá tu inbox (link válido 60 minutos).
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 text-center leading-relaxed">
              ¿No te llegó? Revisá tu carpeta de spam o
              <button
                onClick={() => { setEnviado(false); setError(''); }}
                className="text-teal-600 hover:text-teal-700 font-semibold ml-1"
              >
                reintentá
              </button>.
            </p>
          </div>
        )}

        {/* Volver a login */}
        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-semibold transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a Iniciar Sesión
          </Link>
        </div>
      </Card>
    </AuthPageWrapper>
  );
};
