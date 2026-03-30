import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Package,
  Warehouse,
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
  Database,
  ChevronDown,
  ChevronRight,
  Boxes,
  BarChart3,
  Shield,
  X,
  BookOpen,
  Zap,
  Droplets,
  ScanLine,
  BrainCircuit,
  Palette
} from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import { AuthService } from '../../services/auth.service';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISOS } from '../../types/auth.types';
import { LineaNegocioSelector } from '../modules/lineaNegocio/LineaNegocioSelector';

interface MenuItem {
  icon: React.FC<{ className?: string }>;
  label: string;
  path: string;
  permiso?: string;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  items: MenuItem[];
  defaultOpen?: boolean;
}

// Grupos de menú reorganizados — Comercial primero, Análisis como grupo propio
const menuGroups: MenuGroup[] = [
  {
    id: 'comercial',
    label: 'Comercial',
    icon: ShoppingBag,
    defaultOpen: true,
    items: [
      { icon: ShoppingCart, label: 'Compras', path: '/compras', permiso: PERMISOS.VER_ORDENES_COMPRA },
      { icon: ShoppingBag, label: 'Ventas', path: '/ventas', permiso: PERMISOS.VER_VENTAS },
      { icon: FileText, label: 'Cotizaciones', path: '/cotizaciones', permiso: PERMISOS.VER_COTIZACIONES },
      { icon: ClipboardList, label: 'Requerimientos', path: '/requerimientos', permiso: PERMISOS.VER_REQUERIMIENTOS },
      { icon: Droplets, label: 'Mercado Libre', path: '/mercado-libre', permiso: PERMISOS.VER_VENTAS },
    ]
  },
  {
    id: 'inventario',
    label: 'Inventario',
    icon: Boxes,
    defaultOpen: true,
    items: [
      { icon: Package, label: 'Productos', path: '/productos', permiso: PERMISOS.VER_INVENTARIO },
      { icon: Warehouse, label: 'Stock', path: '/inventario', permiso: PERMISOS.VER_INVENTARIO },
      { icon: Box, label: 'Unidades', path: '/unidades', permiso: PERMISOS.GESTIONAR_INVENTARIO },
      { icon: ArrowRightLeft, label: 'Transferencias', path: '/transferencias', permiso: PERMISOS.TRANSFERIR_UNIDADES },
      { icon: ScanLine, label: 'Escaner', path: '/escaner', permiso: PERMISOS.VER_INVENTARIO },
    ]
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    icon: Wallet,
    defaultOpen: false,
    items: [
      { icon: Receipt, label: 'Gastos', path: '/gastos', permiso: PERMISOS.VER_GASTOS },
      { icon: Wallet, label: 'Tesorería', path: '/tesoreria', permiso: PERMISOS.VER_TESORERIA },
      { icon: BookOpen, label: 'Contabilidad', path: '/contabilidad', permiso: PERMISOS.VER_TESORERIA },
      { icon: DollarSign, label: 'Tipo de Cambio', path: '/tipo-cambio', permiso: PERMISOS.VER_TESORERIA },
    ]
  },
  {
    id: 'analisis',
    label: 'Análisis',
    icon: BarChart3,
    defaultOpen: true,
    items: [
      { icon: TrendingUp, label: 'Reportes', path: '/reportes', permiso: PERMISOS.VER_REPORTES },
      { icon: Calculator, label: 'Costos CTRU', path: '/ctru', permiso: PERMISOS.VER_CTRU },
      { icon: Zap, label: 'Intel. Productos', path: '/productos-intel', permiso: PERMISOS.VER_INVENTARIO },
      { icon: Activity, label: 'Rendimiento FX', path: '/rendimiento-cambiario', permiso: PERMISOS.VER_TESORERIA },
    ]
  },
  {
    id: 'equipo',
    label: 'Equipo',
    icon: Users,
    defaultOpen: false,
    items: [
      { icon: BrainCircuit, label: 'Notas IA', path: '/notas-ia', permiso: PERMISOS.VER_DASHBOARD },
    ]
  },
  {
    id: 'admin',
    label: 'Administración',
    icon: Shield,
    defaultOpen: false,
    items: [
      { icon: Palette, label: 'Líneas de Negocio', path: '/lineas-negocio', permiso: PERMISOS.GESTIONAR_CONFIGURACION },
      { icon: Database, label: 'Maestros', path: '/maestros', permiso: PERMISOS.GESTIONAR_CONFIGURACION },
      { icon: Users, label: 'Usuarios', path: '/usuarios', permiso: PERMISOS.GESTIONAR_USUARIOS },
      { icon: Activity, label: 'Auditoría', path: '/auditoria', permiso: PERMISOS.VER_AUDITORIA },
      { icon: Settings, label: 'Configuración', path: '/configuracion', permiso: PERMISOS.GESTIONAR_CONFIGURACION },
    ]
  }
];

interface SidebarProps {
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const { hasPermiso, profile, role, displayName } = usePermissions();

  // Estado para grupos expandidos/colapsados
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    menuGroups.forEach(group => {
      if (group.defaultOpen) initial.add(group.id);
    });
    return initial;
  });

  // Auto-expandir el grupo que contiene la ruta activa
  useEffect(() => {
    for (const group of menuGroups) {
      const hasActiveItem = group.items.some(item => location.pathname === item.path);
      if (hasActiveItem && !expandedGroups.has(group.id)) {
        setExpandedGroups(prev => new Set([...prev, group.id]));
        break;
      }
    }
  }, [location.pathname]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      await AuthService.logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Filtrar items según permisos
  const filterItemsByPermiso = (items: MenuItem[]) => {
    return items.filter(item => {
      if (!item.permiso) return true;
      return hasPermiso(item.permiso);
    });
  };

  // Filtrar grupos vacíos (sin items visibles)
  const visibleGroups = menuGroups.map(group => ({
    ...group,
    items: filterItemsByPermiso(group.items)
  })).filter(group => group.items.length > 0);

  // Color y gradiente del badge según rol
  const roleConfig: Record<string, { bg: string; text: string; label: string }> = {
    admin: { bg: 'bg-gradient-to-r from-red-500 to-orange-500', text: 'text-white', label: 'Administrador' },
    gerente: { bg: 'bg-gradient-to-r from-purple-500 to-violet-500', text: 'text-white', label: 'Gerente' },
    vendedor: { bg: 'bg-gradient-to-r from-blue-500 to-cyan-500', text: 'text-white', label: 'Vendedor' },
    comprador: { bg: 'bg-gradient-to-r from-amber-500 to-yellow-500', text: 'text-white', label: 'Comprador' },
    almacenero: { bg: 'bg-gradient-to-r from-green-500 to-emerald-500', text: 'text-white', label: 'Almacenero' },
    finanzas: { bg: 'bg-gradient-to-r from-teal-500 to-cyan-600', text: 'text-white', label: 'Finanzas' },
    supervisor: { bg: 'bg-gradient-to-r from-indigo-500 to-blue-600', text: 'text-white', label: 'Supervisor' },
    invitado: { bg: 'bg-gray-600', text: 'text-gray-300', label: 'Invitado' }
  };

  const currentRole = roleConfig[role || 'invitado'];

  return (
    <div className="w-64 h-full bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 flex flex-col border-r border-gray-800/50 overflow-hidden">
      {/* Logo Vita Skin Peru */}
      <div className="p-5 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg shadow-primary-500/20 relative">
              <Droplets className="h-6 w-6 text-white" />
              {/* Mini hoja decorativa */}
              <svg className="absolute -top-1 -right-1 h-3 w-3 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22L6.66 19.7C7.14 19.87 7.64 20 8.17 20C12.04 20 15.54 17.5 17 14C18.45 10.5 17 8 17 8Z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-tight">Vita Skin</h1>
              <p className="text-[10px] text-primary-400 font-semibold tracking-wider">PERU</p>
            </div>
          </div>
          {/* Botón cerrar - solo visible en móvil */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Usuario actual con mejor diseño */}
      {profile && (
        <div className="mx-3 mt-3 p-3 bg-gray-800/40 rounded-xl border border-gray-700/30">
          <div className="flex items-center space-x-3">
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={displayName}
                className="w-9 h-9 rounded-lg object-cover shadow-inner"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white font-semibold text-sm shadow-inner">
                {displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{displayName}</p>
              <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-md ${currentRole.bg} ${currentRole.text} mt-0.5`}>
                {currentRole.label}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Selector global de Línea de Negocio */}
      <LineaNegocioSelector />

      {/* Dashboard (item principal fuera de grupos) */}
      <div className="px-3 pt-4 pb-2">
        <Link
          to="/dashboard"
          className={`
            flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200
            ${location.pathname === '/dashboard'
              ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25'
              : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
            }
          `}
        >
          <Home className="h-5 w-5" />
          <span className="font-medium">Dashboard</span>
        </Link>
      </div>

      {/* Grupos de Menú */}
      <nav className="flex-1 min-h-0 px-3 py-2 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {visibleGroups.map((group) => {
          const GroupIcon = group.icon;
          const isExpanded = expandedGroups.has(group.id);
          const hasActiveItem = group.items.some(item => location.pathname === item.path);

          return (
            <div key={group.id} className="mb-1">
              {/* Header del grupo */}
              <button
                onClick={() => toggleGroup(group.id)}
                className={`
                  w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200
                  ${hasActiveItem
                    ? 'text-primary-400 bg-primary-500/10'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/40'
                  }
                `}
              >
                <div className="flex items-center space-x-2">
                  <GroupIcon className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">{group.label}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 transition-transform" />
                ) : (
                  <ChevronRight className="h-4 w-4 transition-transform" />
                )}
              </button>

              {/* Items del grupo con animación */}
              <div
                className={`
                  overflow-hidden transition-all duration-200 ease-in-out
                  ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
                `}
              >
                <div className="ml-2 mt-1 space-y-0.5 border-l border-gray-800 pl-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`
                          flex items-center space-x-2.5 px-3 py-2 rounded-lg transition-all duration-150
                          ${isActive
                            ? 'bg-primary-600/90 text-white shadow-md shadow-primary-500/20'
                            : 'text-gray-400 hover:bg-gray-800/60 hover:text-white hover:translate-x-0.5'
                          }
                        `}
                      >
                        <Icon className={`h-4 w-4 ${isActive ? 'text-white' : ''}`} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Logout Button con mejor diseño */}
      <div className="p-3 border-t border-gray-800/50">
        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 w-full group"
        >
          <LogOut className="h-5 w-5 group-hover:rotate-12 transition-transform" />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
};
