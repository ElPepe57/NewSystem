import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Package, 
  Warehouse, 
  ShoppingCart, 
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Settings,
  LogOut
} from 'lucide-react';

// CORRECCIÓN: Usamos "../../" (dos puntos) en lugar de tres.
import { useAuthStore } from '../../store/authStore';
import { AuthService } from '../../services/auth.service';

const menuItems = [
  { icon: Home, label: 'Dashboard', path: '/dashboard' },
  { icon: Package, label: 'Productos', path: '/productos' },
  { icon: Warehouse, label: 'Inventario', path: '/inventario' },
  { icon: ShoppingCart, label: 'Compras', path: '/compras' },
  { icon: ShoppingBag, label: 'Ventas', path: '/ventas' },
  { icon: DollarSign, label: 'Tipo de Cambio', path: '/tipo-cambio' },
  { icon: TrendingUp, label: 'Reportes', path: '/reportes' },
  { icon: Settings, label: 'Configuración', path: '/configuracion' },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);

  const handleLogout = async () => {
    try {
      await AuthService.logout();
      logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
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

      {/* Menu Items */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
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