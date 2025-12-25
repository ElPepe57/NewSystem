import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Package,
  Warehouse,
  Building2,
  Box,
  ShoppingCart,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Calculator,
  Settings,
  LogOut,
  Receipt,
  ArrowRightLeft,
  FileText,
  Users,
  Activity,
  Wallet,
  ClipboardList,
  Target,
  Database
} from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import { AuthService } from '../../services/auth.service';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISOS } from '../../types/auth.types';

interface MenuItem {
  icon: React.FC<{ className?: string }>;
  label: string;
  path: string;
  permiso?: string;
}

const menuItems: MenuItem[] = [
  { icon: Home, label: 'Dashboard', path: '/dashboard' },
  { icon: Package, label: 'Productos', path: '/productos', permiso: PERMISOS.VER_INVENTARIO },
  { icon: Warehouse, label: 'Inventario', path: '/inventario', permiso: PERMISOS.VER_INVENTARIO },
  { icon: ArrowRightLeft, label: 'Transferencias', path: '/transferencias', permiso: PERMISOS.GESTIONAR_INVENTARIO },
  { icon: Box, label: 'Unidades', path: '/unidades', permiso: PERMISOS.GESTIONAR_INVENTARIO },
  { icon: ShoppingCart, label: 'Compras', path: '/compras', permiso: PERMISOS.GESTIONAR_INVENTARIO },
  { icon: ShoppingBag, label: 'Ventas', path: '/ventas', permiso: PERMISOS.VER_VENTAS },
  { icon: FileText, label: 'Cotizaciones', path: '/cotizaciones', permiso: PERMISOS.VER_VENTAS },
  { icon: Receipt, label: 'Gastos', path: '/gastos', permiso: PERMISOS.VER_FINANZAS },
  { icon: DollarSign, label: 'Tipo de Cambio', path: '/tipo-cambio', permiso: PERMISOS.VER_FINANZAS },
  { icon: Calculator, label: 'CTRU', path: '/ctru', permiso: PERMISOS.VER_FINANZAS },
  { icon: TrendingUp, label: 'Reportes', path: '/reportes', permiso: PERMISOS.VER_FINANZAS },
  { icon: ClipboardList, label: 'Requerimientos', path: '/requerimientos', permiso: PERMISOS.GESTIONAR_INVENTARIO },
  { icon: Wallet, label: 'Tesorería', path: '/tesoreria', permiso: PERMISOS.VER_FINANZAS },
  { icon: Target, label: 'Expectativas', path: '/expectativas', permiso: PERMISOS.VER_FINANZAS },
  { icon: Users, label: 'Usuarios', path: '/usuarios', permiso: PERMISOS.ADMIN_TOTAL },
  { icon: Database, label: 'Maestros', path: '/maestros', permiso: PERMISOS.ADMIN_TOTAL },
  { icon: Activity, label: 'Auditoría', path: '/auditoria', permiso: PERMISOS.ADMIN_TOTAL },
  { icon: Settings, label: 'Configuración', path: '/configuracion', permiso: PERMISOS.ADMIN_TOTAL },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const { hasPermiso, profile, role, displayName } = usePermissions();

  const handleLogout = async () => {
    try {
      await logout();
      await AuthService.logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Filtrar menú según permisos
  const visibleMenuItems = menuItems.filter(item => {
    if (!item.permiso) return true;
    return hasPermiso(item.permiso);
  });

  // Color del badge según rol
  const roleBadgeColor: Record<string, string> = {
    admin: 'bg-red-500',
    vendedor: 'bg-blue-500',
    almacenero: 'bg-green-500',
    invitado: 'bg-gray-500'
  };

  return (
    <div className="w-64 bg-gray-900 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <Package className="h-8 w-8 text-primary-400" />
          <div>
            <h1 className="text-xl font-bold text-white">BusinessMN</h1>
            <p className="text-xs text-gray-400">v2.0</p>
          </div>
        </div>
      </div>

      {/* Usuario actual */}
      {profile && (
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-sm text-white font-medium truncate">{displayName}</p>
          <span className={`inline-block px-2 py-0.5 text-xs rounded-full text-white mt-1 ${roleBadgeColor[role || 'invitado']}`}>
            {role?.toUpperCase() || 'INVITADO'}
          </span>
        </div>
      )}

      {/* Menu Items */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                ${isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
};
