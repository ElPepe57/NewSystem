import React from 'react';
import { User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { NotificationCenter } from '../common/NotificationCenter';

export const Header: React.FC = () => {
  const user = useAuthStore(state => state.user);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {new Date().toLocaleDateString('es-PE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </h2>
        </div>

        <div className="flex items-center space-x-4">
          {/* Centro de Notificaciones */}
          <NotificationCenter />

          {/* Usuario */}
          <div className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <div className="bg-primary-100 p-2 rounded-full">
              <User className="h-5 w-5 text-primary-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">
                {user?.email?.split('@')[0] || 'Usuario'}
              </p>
              <p className="text-xs text-gray-500">Socio</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
