import React from 'react';
import { List, DollarSign, Package, Users, FileText } from 'lucide-react';

export type SummaryIcon = 'list' | 'money' | 'package' | 'users' | 'file';

interface SummaryItem {
  label: string;
  value: string | number;
  icon?: SummaryIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

interface ListSummaryProps {
  /** Numero de items filtrados */
  filteredCount: number;
  /** Numero total de items */
  totalCount: number;
  /** Etiqueta para el tipo de elemento (ej: "productos", "ventas") */
  itemLabel?: string;
  /** Items de resumen adicionales (ej: total en soles, cantidad de unidades) */
  summaryItems?: SummaryItem[];
  /** Clases adicionales para el contenedor */
  className?: string;
}

const iconMap: Record<SummaryIcon, React.ReactNode> = {
  list: <List className="h-4 w-4" />,
  money: <DollarSign className="h-4 w-4" />,
  package: <Package className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  file: <FileText className="h-4 w-4" />
};

const variantStyles: Record<string, string> = {
  default: 'text-gray-600',
  success: 'text-green-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
  info: 'text-blue-600'
};

/**
 * Componente para mostrar resumen de listas con totales
 *
 * Uso:
 * <ListSummary
 *   filteredCount={productosFiltrados.length}
 *   totalCount={productos.length}
 *   itemLabel="productos"
 *   summaryItems={[
 *     { label: 'Total', value: formatCurrency(totalVentas), icon: 'money', variant: 'success' },
 *     { label: 'Stock', value: totalStock, icon: 'package' }
 *   ]}
 * />
 */
export const ListSummary: React.FC<ListSummaryProps> = ({
  filteredCount,
  totalCount,
  itemLabel = 'elementos',
  summaryItems = [],
  className = ''
}) => {
  const isFiltered = filteredCount !== totalCount;

  return (
    <div className={`flex flex-wrap items-center gap-4 py-2 px-4 bg-gray-50 border border-gray-200 rounded-lg text-sm ${className}`}>
      {/* Contador principal */}
      <div className="flex items-center gap-2 text-gray-600">
        <List className="h-4 w-4" />
        <span>
          {isFiltered ? (
            <>
              Mostrando <span className="font-semibold text-gray-900">{filteredCount}</span> de {totalCount} {itemLabel}
            </>
          ) : (
            <>
              <span className="font-semibold text-gray-900">{totalCount}</span> {itemLabel}
            </>
          )}
        </span>
      </div>

      {/* Separador si hay items adicionales */}
      {summaryItems.length > 0 && (
        <div className="hidden sm:block w-px h-4 bg-gray-300" />
      )}

      {/* Items de resumen adicionales */}
      {summaryItems.map((item, index) => (
        <div
          key={index}
          className={`flex items-center gap-1.5 ${variantStyles[item.variant || 'default']}`}
        >
          {item.icon && iconMap[item.icon]}
          <span className="text-gray-500">{item.label}:</span>
          <span className="font-semibold">{item.value}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * Version compacta para usar en headers de tablas
 */
export const ListSummaryCompact: React.FC<{
  count: number;
  label?: string;
  className?: string;
}> = ({ count, label = 'resultados', className = '' }) => (
  <span className={`text-sm text-gray-500 ${className}`}>
    <span className="font-medium text-gray-700">{count}</span> {label}
  </span>
);
