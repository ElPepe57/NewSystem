import React from 'react';
import {
  Package,
  FileText,
  Users,
  ShoppingCart,
  Search,
  Inbox,
  AlertCircle,
  Plus,
  RefreshCw
} from 'lucide-react';
import { Button } from './Button';

export type EmptyStateType =
  | 'no-data'
  | 'no-results'
  | 'error'
  | 'no-products'
  | 'no-orders'
  | 'no-sales'
  | 'no-customers'
  | 'no-inventory'
  | 'custom';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: React.ReactNode;
}

export interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: EmptyStateAction[];
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const presetConfig: Record<EmptyStateType, {
  icon: React.ReactNode;
  title: string;
  description: string;
}> = {
  'no-data': {
    icon: <Inbox className="h-12 w-12" />,
    title: 'No hay datos',
    description: 'No se encontraron datos para mostrar.'
  },
  'no-results': {
    icon: <Search className="h-12 w-12" />,
    title: 'Sin resultados',
    description: 'No se encontraron resultados para tu búsqueda. Intenta con otros términos.'
  },
  'error': {
    icon: <AlertCircle className="h-12 w-12" />,
    title: 'Error al cargar',
    description: 'Ocurrió un error al cargar los datos. Por favor intenta de nuevo.'
  },
  'no-products': {
    icon: <Package className="h-12 w-12" />,
    title: 'Sin productos',
    description: 'Aún no tienes productos registrados. ¡Agrega tu primer producto!'
  },
  'no-orders': {
    icon: <FileText className="h-12 w-12" />,
    title: 'Sin órdenes',
    description: 'No hay órdenes de compra registradas.'
  },
  'no-sales': {
    icon: <ShoppingCart className="h-12 w-12" />,
    title: 'Sin ventas',
    description: 'Aún no tienes ventas registradas.'
  },
  'no-customers': {
    icon: <Users className="h-12 w-12" />,
    title: 'Sin clientes',
    description: 'No hay clientes registrados en el sistema.'
  },
  'no-inventory': {
    icon: <Package className="h-12 w-12" />,
    title: 'Inventario vacío',
    description: 'No hay unidades en el inventario actualmente.'
  },
  'custom': {
    icon: <Inbox className="h-12 w-12" />,
    title: '',
    description: ''
  }
};

const sizeClasses = {
  sm: {
    container: 'py-8',
    icon: 'h-10 w-10',
    title: 'text-base',
    description: 'text-sm'
  },
  md: {
    container: 'py-12',
    icon: 'h-12 w-12',
    title: 'text-lg',
    description: 'text-sm'
  },
  lg: {
    container: 'py-16',
    icon: 'h-16 w-16',
    title: 'text-xl',
    description: 'text-base'
  }
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'no-data',
  title,
  description,
  icon,
  actions = [],
  className = '',
  size = 'md'
}) => {
  const preset = presetConfig[type];
  const sizes = sizeClasses[size];

  const displayIcon = icon || preset.icon;
  const displayTitle = title || preset.title;
  const displayDescription = description || preset.description;

  // Clonar el icono para aplicar las clases de tamaño
  const styledIcon = React.isValidElement(displayIcon)
    ? React.cloneElement(displayIcon as React.ReactElement<{ className?: string }>, {
        className: `${sizes.icon} text-gray-400`
      })
    : displayIcon;

  return (
    <div className={`flex flex-col items-center justify-center text-center ${sizes.container} ${className}`}>
      {/* Icon */}
      <div className="mb-4 text-gray-400">
        {styledIcon}
      </div>

      {/* Title */}
      {displayTitle && (
        <h3 className={`font-semibold text-gray-900 mb-2 ${sizes.title}`}>
          {displayTitle}
        </h3>
      )}

      {/* Description */}
      {displayDescription && (
        <p className={`text-gray-500 max-w-sm mx-auto mb-6 ${sizes.description}`}>
          {displayDescription}
        </p>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || (index === 0 ? 'primary' : 'outline')}
              onClick={action.onClick}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

// Componentes preconfigurados para casos comunes
export const EmptySearch: React.FC<{
  searchTerm?: string;
  onClear?: () => void;
}> = ({ searchTerm, onClear }) => (
  <EmptyState
    type="no-results"
    description={
      searchTerm
        ? `No se encontraron resultados para "${searchTerm}"`
        : 'No se encontraron resultados para tu búsqueda.'
    }
    actions={onClear ? [{ label: 'Limpiar búsqueda', onClick: onClear, variant: 'outline' }] : []}
  />
);

export const EmptyError: React.FC<{
  message?: string;
  onRetry?: () => void;
}> = ({ message, onRetry }) => (
  <EmptyState
    type="error"
    description={message || 'Ocurrió un error al cargar los datos.'}
    actions={
      onRetry
        ? [{
            label: 'Reintentar',
            onClick: onRetry,
            icon: <RefreshCw className="h-4 w-4 mr-2" />
          }]
        : []
    }
  />
);

export const EmptyList: React.FC<{
  entityName: string;
  onAdd?: () => void;
  addLabel?: string;
}> = ({ entityName, onAdd, addLabel }) => (
  <EmptyState
    type="no-data"
    title={`Sin ${entityName}`}
    description={`No hay ${entityName} registrados en el sistema.`}
    actions={
      onAdd
        ? [{
            label: addLabel || `Agregar ${entityName}`,
            onClick: onAdd,
            icon: <Plus className="h-4 w-4 mr-2" />
          }]
        : []
    }
  />
);

export default EmptyState;
