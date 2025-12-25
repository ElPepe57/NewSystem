import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserCheck, UserX, Shield, ShoppingBag, Warehouse, User } from 'lucide-react';
import { Card, Badge } from '../../common';
import { userService } from '../../../services/user.service';
import type { UserProfile, UserRole } from '../../../types/auth.types';

interface UsuariosActivosWidgetProps {
  showDetailed?: boolean;
}

export const UsuariosActivosWidget: React.FC<UsuariosActivosWidgetProps> = ({
  showDetailed = false
}) => {
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsuarios = async () => {
      try {
        const data = await userService.getAll();
        setUsuarios(data);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoading(false);
      }
    };
    loadUsuarios();
  }, []);

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4 text-purple-500" />;
      case 'vendedor':
        return <ShoppingBag className="h-4 w-4 text-blue-500" />;
      case 'almacenero':
        return <Warehouse className="h-4 w-4 text-green-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <Badge variant="info">Admin</Badge>;
      case 'vendedor':
        return <Badge variant="success">Vendedor</Badge>;
      case 'almacenero':
        return <Badge variant="warning">Almacenero</Badge>;
      default:
        return <Badge variant="default">Invitado</Badge>;
    }
  };

  const formatLastConnection = (timestamp: any) => {
    if (!timestamp?.toDate) return 'Nunca';
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 5) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  };

  // Estadísticas
  const stats = {
    total: usuarios.length,
    activos: usuarios.filter(u => u.activo).length,
    inactivos: usuarios.filter(u => !u.activo).length,
    porRol: {
      admin: usuarios.filter(u => u.role === 'admin').length,
      vendedor: usuarios.filter(u => u.role === 'vendedor').length,
      almacenero: usuarios.filter(u => u.role === 'almacenero').length,
      invitado: usuarios.filter(u => u.role === 'invitado').length
    }
  };

  // Usuarios con conexión reciente (últimas 24 horas)
  const usuariosRecientes = usuarios.filter(u => {
    if (!u.ultimaConexion?.toDate) return false;
    const diffMs = new Date().getTime() - u.ultimaConexion.toDate().getTime();
    return diffMs < 86400000; // 24 horas
  });

  if (loading) {
    return (
      <Card padding="md">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Users className="h-5 w-5 mr-2 text-primary-500" />
          Usuarios del Sistema
        </h3>
        <Link to="/usuarios" className="text-sm text-primary-600 hover:text-primary-700">
          Gestionar →
        </Link>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="p-3 bg-gray-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="p-3 bg-green-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600">{stats.activos}</div>
          <div className="text-xs text-gray-500">Activos</div>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600">{usuariosRecientes.length}</div>
          <div className="text-xs text-gray-500">Hoy</div>
        </div>
        <div className="p-3 bg-red-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-600">{stats.inactivos}</div>
          <div className="text-xs text-gray-500">Inactivos</div>
        </div>
      </div>

      {/* Distribución por rol */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-2">Por Rol</div>
        <div className="flex gap-2 flex-wrap">
          {stats.porRol.admin > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 rounded-full text-xs">
              <Shield className="h-3 w-3 text-purple-500" />
              <span>{stats.porRol.admin} Admin</span>
            </div>
          )}
          {stats.porRol.vendedor > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full text-xs">
              <ShoppingBag className="h-3 w-3 text-blue-500" />
              <span>{stats.porRol.vendedor} Vendedores</span>
            </div>
          )}
          {stats.porRol.almacenero > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-full text-xs">
              <Warehouse className="h-3 w-3 text-green-500" />
              <span>{stats.porRol.almacenero} Almaceneros</span>
            </div>
          )}
          {stats.porRol.invitado > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs">
              <User className="h-3 w-3 text-gray-500" />
              <span>{stats.porRol.invitado} Invitados</span>
            </div>
          )}
        </div>
      </div>

      {/* Lista detallada */}
      {showDetailed && (
        <div className="border-t pt-4">
          <div className="text-xs text-gray-500 mb-2">Actividad Reciente</div>
          <div className="space-y-2">
            {usuarios
              .sort((a, b) => {
                const dateA = a.ultimaConexion?.toDate?.() || new Date(0);
                const dateB = b.ultimaConexion?.toDate?.() || new Date(0);
                return dateB.getTime() - dateA.getTime();
              })
              .slice(0, 5)
              .map(usuario => (
                <div
                  key={usuario.uid}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    {getRoleIcon(usuario.role)}
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {usuario.displayName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {usuario.email}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {formatLastConnection(usuario.ultimaConexion)}
                    </div>
                    <div className="flex items-center gap-1">
                      {usuario.activo ? (
                        <UserCheck className="h-3 w-3 text-green-500" />
                      ) : (
                        <UserX className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </Card>
  );
};
