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
  Palette,
  Target,
  MapPin,
  Banknote,
  Network,
  Coins
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
      { icon: ArrowRightLeft, label: 'Env\u00edos', path: '/envios', permiso: PERMISOS.TRANSFERIR_UNIDADES },
      { icon: Network, label: 'Red Log\u00edstica', path: '/red-logistica', permiso: PERMISOS.VER_INVENTARIO },
      { icon: ScanLine, label: 'Escaner', path: '/escaner', permiso: PERMISOS.VER_INVENTARIO },
    ]
  },
  {
    // S57 Fase C+ — Grupo renombrado a "Finanzas y Contabilidad" para evitar
    // shadowing con el módulo "Finanzas" (hub). Estándar industria
    // (Odoo: "Accounting & Finance", NetSuite: "Financials").
    // Los sub-items Saldos y Cash flow se accedían también vía sidebar pero
    // duplicaban la navegación de las tabs internas del FinanzasLayout.
    // Patrón Stripe/Linear: el sidebar lleva al hub, las tabs hacen sub-nav.
    id: 'finanzas',
    label: 'Finanzas y Contabilidad',
    icon: Wallet,
    defaultOpen: false,
    items: [
      // Hub Finanzas (Overview/Saldos/Cash flow vía tabs internas)
      { icon: Coins, label: 'Finanzas', path: '/finanzas', permiso: PERMISOS.VER_TESORERIA },
      { icon: DollarSign, label: 'Tipo de Cambio', path: '/tipo-cambio', permiso: PERMISOS.VER_TESORERIA },
      { icon: Receipt, label: 'Gastos Fijos', path: '/gastos', permiso: PERMISOS.VER_GASTOS },
      { icon: BookOpen, label: 'Contabilidad', path: '/contabilidad', permiso: PERMISOS.VER_TESORERIA },
      { icon: Banknote, label: 'Planilla', path: '/planilla', permiso: PERMISOS.VER_PLANILLA },
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
      { icon: Target, label: 'Proyeccion', path: '/proyeccion', permiso: PERMISOS.VER_CTRU },
      { icon: MapPin, label: 'Mapa Ventas', path: '/mapa-ventas', permiso: PERMISOS.VER_REPORTES },
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

  // Color del badge según rol — flat, sin gradientes
  const roleConfig: Record<string, { bg: string; text: string; label: string }> = {
    admin: { bg: 'bg-red-50', text: 'text-red-700', label: 'Administrador' },
    gerente: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Gerente' },
    vendedor: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Vendedor' },
    comprador: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Comprador' },
    almacenero: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Almacenero' },
    finanzas: { bg: 'bg-teal-50', text: 'text-teal-700', label: 'Finanzas' },
    supervisor: { bg: 'bg-teal-50', text: 'text-teal-700', label: 'Supervisor' },
    invitado: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Invitado' }
  };

  const currentRole = roleConfig[role || 'invitado'];

  return (
    <div className="w-64 h-full bg-white flex flex-col border-r border-slate-200 overflow-hidden">
      {/* Logo Vita Skin Peru */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-600 rounded-xl relative">
              <Droplets className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">Vita Skin</h1>
              <p className="text-[10px] text-teal-600 font-semibold tracking-wider">PERU</p>
            </div>
          </div>
          {/* Botón cerrar - solo visible en móvil */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Usuario actual */}
      {profile && (
        <div className="mx-3 mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex items-center space-x-3">
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={displayName}
                className="w-9 h-9 rounded-lg object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700 font-semibold text-sm">
                {displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-900 font-medium truncate">{displayName}</p>
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
              ? 'bg-teal-50 text-teal-700 font-semibold'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }
          `}
        >
          <Home className="h-5 w-5" />
          <span className="font-medium">Dashboard</span>
        </Link>
      </div>

      {/* Grupos de Menú */}
      <nav className="flex-1 min-h-0 px-3 py-2 space-y-1 overflow-y-auto">
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
                    ? 'text-teal-700'
                    : 'text-slate-400 hover:text-slate-600'
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
                <div className="ml-2 mt-1 space-y-0.5 border-l border-slate-200 pl-2">
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
                            ? 'bg-teal-50 text-teal-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }
                        `}
                      >
                        <Icon className={`h-4 w-4 ${isActive ? 'text-teal-600' : ''}`} />
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

      {/* Logout */}
      <div className="p-3 border-t border-slate-100">
        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all duration-200 w-full group"
        >
          <LogOut className="h-5 w-5 group-hover:rotate-12 transition-transform" />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
};
