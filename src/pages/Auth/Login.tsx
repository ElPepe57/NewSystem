import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Card } from '../../components/common';
import { AuthService } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import { Package } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const setUser = useAuthStore(state => state.setUser);
  const setError = useAuthStore(state => state.setError);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setLocalError] = useState('');

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-primary-600 p-3 rounded-full">
              <Package className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">BusinessMN</h1>
          <p className="text-gray-600 mt-2">Sistema de Gestión Operativa</p>
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

        <div className="mt-6 text-center">
          <a href="#" className="text-sm text-primary-600 hover:text-primary-700">
            ¿Olvidaste tu contraseña?
          </a>
        </div>
      </Card>
    </div>
  );
};
