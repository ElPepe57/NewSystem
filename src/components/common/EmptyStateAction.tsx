import React from 'react';
import {
  Package,
  ShoppingCart,
  Users,
  FileText,
  Search,
  Plus,
  AlertCircle,
  CheckCircle,
  Inbox,
  FolderOpen,
  type LucideIcon
} from 'lucide-react';
import { Button } from './Button';

export type EmptyStateVariant =
  | 'no-data'
  | 'no-results'
  | 'error'
  | 'success'
  | 'empty-folder';

export type EmptyStateIcon =
  | 'package'
  | 'cart'
  | 'users'
  | 'file'
  | 'search'
  | 'inbox'
  | 'folder'
  | 'alert'
  | 'check';

export interface EmptyStateActionProps {
  /** Titulo principal */
  title: string;
  /** Descripcion o mensaje secundario */
  description?: string;
  /** Variante visual */
  variant?: EmptyStateVariant;
  /** Icono predefinido */
  icon?: EmptyStateIcon;
  /** Icono personalizado (componente) */
  customIcon?: React.ReactNode;
  /** Texto del boton de accion primaria */
  actionLabel?: string;
  /** Callback de accion primaria */
  onAction?: () => void;
  /** Texto del boton secundario */
  secondaryActionLabel?: string;
  /** Callback de accion secundaria */
  onSecondaryAction?: () => void;
  /** Tamano del componente */
  size?: 'sm' | 'md' | 'lg';
  /** Clases adicionales */
  className?: string;
}

const iconMap: Record<EmptyStateIcon, LucideIcon> = {
  package: Package,
  cart: ShoppingCart,
  users: Users,
  file: FileText,
  search: Search,
  inbox: Inbox,
  folder: FolderOpen,
  alert: AlertCircle,
  check: CheckCircle
};

const variantStyles: Record<EmptyStateVariant, { iconBg: string; iconColor: string }> = {
  'no-data': { iconBg: 'bg-gray-100', iconColor: 'text-gray-400' },
  'no-results': { iconBg: 'bg-amber-50', iconColor: 'text-amber-400' },
  'error': { iconBg: 'bg-red-50', iconColor: 'text-red-400' },
  'success': { iconBg: 'bg-green-50', iconColor: 'text-green-400' },
  'empty-folder': { iconBg: 'bg-blue-50', iconColor: 'text-blue-400' }
};

const sizeStyles = {
  sm: {
    container: 'py-8',
    iconContainer: 'w-12 h-12',
    iconSize: 'h-6 w-6',
    title: 'text-base',
    description: 'text-sm'
  },
  md: {
    container: 'py-12',
    iconContainer: 'w-16 h-16',
    iconSize: 'h-8 w-8',
    title: 'text-lg',
    description: 'text-sm'
  },
  lg: {
    container: 'py-16',
    iconContainer: 'w-20 h-20',
    iconSize: 'h-10 w-10',
    title: 'text-xl',
    description: 'text-base'
  }
};

/**
 * Componente de estado vacio con acciones
 *
 * @example
 * <EmptyStateAction
 *   title="No hay productos"
 *   description="Comienza agregando tu primer producto al catálogo"
 *   icon="package"
 *   actionLabel="Agregar Producto"
 *   onAction={() => setModalOpen(true)}
 * />
 *
 * @example
 * <EmptyStateAction
 *   title="Sin resultados"
 *   description="No se encontraron items con los filtros aplicados"
 *   variant="no-results"
 *   icon="search"
 *   actionLabel="Limpiar filtros"
 *   onAction={clearFilters}
 * />
 */
export const EmptyStateAction: React.FC<EmptyStateActionProps> = ({
  title,
  description,
  variant = 'no-data',
  icon = 'inbox',
  customIcon,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  size = 'md',
  className = ''
}) => {
  const IconComponent = iconMap[icon];
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${sizeStyle.container} ${className}`}>
      {/* Icono */}
      <div
        className={`
          ${sizeStyle.iconContainer} rounded-full flex items-center justify-center mb-4
          ${variantStyle.iconBg}
        `}
      >
        {customIcon || (
          <IconComponent className={`${sizeStyle.iconSize} ${variantStyle.iconColor}`} />
        )}
      </div>

      {/* Titulo */}
      <h3 className={`font-semibold text-gray-900 ${sizeStyle.title}`}>{title}</h3>

      {/* Descripcion */}
      {description && (
        <p className={`mt-2 text-gray-500 max-w-md ${sizeStyle.description}`}>
          {description}
        </p>
      )}

      {/* Acciones */}
      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-6 flex items-center gap-3">
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
          {actionLabel && onAction && (
            <Button variant="primary" size="sm" onClick={onAction}>
              <Plus className="h-4 w-4 mr-2" />
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Variante compacta para usar en cards o secciones pequenas
 */
export const EmptyStateCompact: React.FC<{
  message: string;
  icon?: EmptyStateIcon;
  className?: string;
}> = ({ message, icon = 'inbox', className = '' }) => {
  const IconComponent = iconMap[icon];

  return (
    <div className={`flex items-center justify-center gap-2 py-4 text-gray-500 ${className}`}>
      <IconComponent className="h-4 w-4" />
      <span className="text-sm">{message}</span>
    </div>
  );
};

/**
 * Estado vacio para tablas (ocupa toda la fila)
 */
export const TableEmptyState: React.FC<{
  colSpan: number;
  message?: string;
  icon?: EmptyStateIcon;
}> = ({ colSpan, message = 'No hay datos para mostrar', icon = 'inbox' }) => {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12">
        <EmptyStateCompact message={message} icon={icon} />
      </td>
    </tr>
  );
};
