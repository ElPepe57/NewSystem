import React from 'react';
import { MapPin, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useCollaborationStore } from '../../store/collaborationStore';
import { PRESENCE_THRESHOLD_MS } from '../../types/collaboration.types';
import type { PresenciaUsuario } from '../../types/collaboration.types';

/** Mapa de rutas a nombres legibles */
const PAGINA_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/ventas': 'Ventas',
  '/inventario': 'Inventario',
  '/productos': 'Productos',
  '/requerimientos': 'Requerimientos',
  '/ordenes-compra': 'Órdenes de Compra',
  '/entregas': 'Entregas',
  '/gastos': 'Gastos',
  '/tesoreria': 'Tesorería',
  '/clientes': 'Clientes',
  '/cotizaciones': 'Cotizaciones',
  '/reportes': 'Reportes',
  '/configuracion': 'Configuración',
  '/ctru': 'CTRU',
  '/productos-intel': 'Inteligencia',
  '/usuarios': 'Usuarios',
  '/perfil': 'Perfil',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-gradient-to-r from-red-500 to-orange-500',
  vendedor: 'bg-gradient-to-r from-blue-500 to-cyan-500',
  almacenero: 'bg-gradient-to-r from-green-500 to-emerald-500',
  invitado: 'bg-gray-500',
};

function isRecentlyOnline(user: PresenciaUsuario): boolean {
  if (!user.ultimaActividad) return false;
  const diff = Date.now() - user.ultimaActividad.toMillis();
  return diff < PRESENCE_THRESHOLD_MS;
}

function getPaginaLabel(path?: string): string | null {
  if (!path) return null;
  return PAGINA_LABELS[path] || path.replace('/', '').replace(/-/g, ' ');
}

export const TeamPresence: React.FC = () => {
  const usuariosOnline = useCollaborationStore(s => s.usuariosOnline);
  const { userProfile } = useAuthStore();

  // Separar online vs away
  const online = usuariosOnline.filter(u => u.estado === 'online' && isRecentlyOnline(u));
  const away = usuariosOnline.filter(u => u.estado === 'away' || (u.estado === 'online' && !isRecentlyOnline(u)));

  return (
    <div className="p-3 space-y-3">
      {/* Online */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          En línea ({online.length})
        </h4>
        {online.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nadie más en línea</p>
        ) : (
          <div className="space-y-1.5">
            {online.map(user => (
              <UserRow key={user.uid} user={user} isOnline isSelf={user.uid === userProfile?.uid} />
            ))}
          </div>
        )}
      </div>

      {/* Away */}
      {away.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Ausente ({away.length})
          </h4>
          <div className="space-y-1.5">
            {away.map(user => (
              <UserRow key={user.uid} user={user} isOnline={false} isSelf={user.uid === userProfile?.uid} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const UserRow: React.FC<{ user: PresenciaUsuario; isOnline: boolean; isSelf?: boolean }> = ({ user, isOnline, isSelf }) => {
  const pagina = getPaginaLabel(user.paginaActual);
  const abrirDM = useCollaborationStore(s => s.abrirDM);
  const { userProfile } = useAuthStore();

  const handleClick = () => {
    if (isSelf || !userProfile?.uid) return;
    abrirDM(user, userProfile.uid);
  };

  return (
    <div
      onClick={handleClick}
      className={`group flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${
        isSelf ? 'hover:bg-gray-50' : 'hover:bg-primary-50 cursor-pointer'
      }`}
    >
      {/* Avatar con indicador de estado */}
      <div className="relative">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${ROLE_COLORS[user.role] || 'bg-gray-500'}`}>
            {user.displayName?.charAt(0).toUpperCase() || '?'}
          </div>
        )}
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-yellow-500'}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
        {pagina && (
          <p className="text-[11px] text-gray-400 flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {pagina}
          </p>
        )}
      </div>

      {/* Icono de chat (solo para otros) */}
      {!isSelf && (
        <MessageCircle className="h-4 w-4 text-gray-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
      )}
    </div>
  );
};
