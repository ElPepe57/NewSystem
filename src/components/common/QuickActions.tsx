import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus,
  ShoppingCart,
  Package,
  Receipt,
  Truck,
  Users,
  X,
  FileText,
  DollarSign,
  ArrowRightLeft,
  Box
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  color: string;
  description?: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'nueva-venta',
    label: 'Nueva Venta',
    icon: ShoppingCart,
    path: '/ventas?action=new',
    color: 'bg-green-500 hover:bg-green-600',
    description: 'Crear una venta o cotizacion'
  },
  {
    id: 'nueva-cotizacion',
    label: 'Nueva Cotizacion',
    icon: FileText,
    path: '/cotizaciones?action=new',
    color: 'bg-blue-500 hover:bg-blue-600',
    description: 'Crear cotizacion rapida'
  },
  {
    id: 'nuevo-gasto',
    label: 'Nuevo Gasto',
    icon: Receipt,
    path: '/gastos?action=new',
    color: 'bg-orange-500 hover:bg-orange-600',
    description: 'Registrar gasto operativo'
  },
  {
    id: 'nueva-orden',
    label: 'Nueva Orden',
    icon: Package,
    path: '/compras?action=new',
    color: 'bg-purple-500 hover:bg-purple-600',
    description: 'Crear orden de compra'
  },
  {
    id: 'nueva-transferencia',
    label: 'Transferencia',
    icon: ArrowRightLeft,
    path: '/transferencias?action=new',
    color: 'bg-indigo-500 hover:bg-indigo-600',
    description: 'Transferir inventario'
  },
  {
    id: 'nuevo-producto',
    label: 'Nuevo Producto',
    icon: Box,
    path: '/productos?action=new',
    color: 'bg-teal-500 hover:bg-teal-600',
    description: 'Agregar producto al catalogo'
  }
];

export const QuickActions: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menu al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K para abrir/cerrar
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Escape para cerrar
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleAction = (action: QuickAction) => {
    setIsOpen(false);
    navigate(action.path);
  };

  // No mostrar en ciertas rutas
  const hiddenRoutes = ['/login', '/registro'];
  if (hiddenRoutes.includes(location.pathname)) {
    return null;
  }

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 z-50">
      {/* Menu de acciones */}
      <div
        className={`absolute bottom-16 right-0 transition-all duration-300 ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden min-w-[240px]">
          <div className="p-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Acciones Rapidas</h3>
            <p className="text-xs text-gray-500 mt-0.5">Ctrl+K para abrir</p>
          </div>
          <div className="p-2 max-h-[400px] overflow-y-auto">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => handleAction(action)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`p-2 rounded-lg ${action.color} text-white transition-transform group-hover:scale-110`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{action.label}</div>
                    {action.description && (
                      <div className="text-xs text-gray-500 truncate">{action.description}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Boton flotante principal */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-gray-700 hover:bg-gray-800 rotate-45'
            : 'bg-primary-600 hover:bg-primary-700 rotate-0'
        }`}
        title="Acciones rapidas (Ctrl+K)"
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <Plus className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Indicador de atajo */}
      {!isOpen && (
        <div className="absolute -top-2 -right-2 bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded font-mono">
          K
        </div>
      )}
    </div>
  );
};
