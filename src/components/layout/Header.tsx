import React from 'react';
import { User, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLE_LABELS } from '../../types/auth.types';
import { NotificationCenter } from '../common/NotificationCenter';
import { CollaborationButton } from './CollaborationButton';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const { displayName, role, profile } = usePermissions();

  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 lg:py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Botón hamburguesa - solo visible en móvil */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="h-6 w-6 text-gray-600" />
          </button>

          <div>
            <h2 className="text-base lg:text-xl font-semibold text-gray-900">
              {new Date().toLocaleDateString('es-PE', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2 lg:space-x-4">
          {/* Centro de Notificaciones */}
          <NotificationCenter />

          {/* Colaboración: Equipo en línea + Chat */}
          <CollaborationButton />

          {/* Usuario - click navega a Mi Perfil */}
          <button
            onClick={() => navigate('/perfil')}
            className="flex items-center space-x-2 lg:space-x-3 px-2 lg:px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            title="Mi Perfil"
          >
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt={displayName}
                className="h-8 w-8 lg:h-9 lg:w-9 rounded-full object-cover"
              />
            ) : (
              <div className="bg-primary-100 p-1.5 lg:p-2 rounded-full">
                <User className="h-4 w-4 lg:h-5 lg:w-5 text-primary-600" />
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-900">
                {displayName || user?.email?.split('@')[0] || 'Usuario'}
              </p>
              <p className="text-xs text-gray-500">{role ? ROLE_LABELS[role] : 'Usuario'}</p>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
