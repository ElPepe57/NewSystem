import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

// ============================================
// TIPOS
// ============================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
  homeHref?: string;
  separator?: React.ReactNode;
  className?: string;
  maxItems?: number;
  itemClassName?: string;
  activeClassName?: string;
}

// ============================================
// MAPEO DE RUTAS A LABELS
// ============================================

const ROUTE_LABELS: Record<string, string> = {
  '': 'Inicio',
  'dashboard': 'Dashboard',
  'productos': 'Productos',
  'inventario': 'Inventario',
  'almacenes': 'Almacenes',
  'unidades': 'Unidades',
  'transferencias': 'Transferencias',
  'ordenes-compra': 'Órdenes de Compra',
  'ventas': 'Ventas',
  'cotizaciones': 'Cotizaciones',
  'gastos': 'Gastos',
  'reportes': 'Reportes',
  'tipo-cambio': 'Tipo de Cambio',
  'ctru': 'CTRU',
  'configuracion': 'Configuración',
  'usuarios': 'Usuarios',
  'auditoria': 'Auditoría',
  'tesoreria': 'Tesorería',
  'requerimientos': 'Requerimientos',
  'expectativas': 'Expectativas',
  'maestros': 'Maestros',
  'nuevo': 'Nuevo',
  'editar': 'Editar',
  'detalle': 'Detalle',
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  showHome = true,
  homeHref = '/dashboard',
  separator,
  className = '',
  maxItems = 4,
  itemClassName = '',
  activeClassName = '',
}) => {
  const location = useLocation();

  // Generar items automáticamente desde la URL si no se proporcionan
  const breadcrumbItems = React.useMemo(() => {
    if (items) return items;

    const pathSegments = location.pathname.split('/').filter(Boolean);

    return pathSegments.map((segment, index) => {
      const href = '/' + pathSegments.slice(0, index + 1).join('/');
      const label = ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

      return {
        label,
        href: index < pathSegments.length - 1 ? href : undefined, // Último item sin link
        icon: undefined,
      };
    });
  }, [items, location.pathname]);

  // Aplicar límite de items con ellipsis
  const displayItems = React.useMemo(() => {
    if (breadcrumbItems.length <= maxItems) return breadcrumbItems;

    const firstItem = breadcrumbItems[0];
    const lastItems = breadcrumbItems.slice(-2);

    return [
      firstItem,
      { label: '...', href: undefined, icon: undefined },
      ...lastItems,
    ];
  }, [breadcrumbItems, maxItems]);

  const separatorElement = separator || (
    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
  );

  if (displayItems.length === 0 && !showHome) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center text-sm ${className}`}
    >
      <ol className="flex items-center flex-wrap gap-1">
        {/* Home */}
        {showHome && (
          <li className="flex items-center">
            <Link
              to={homeHref}
              className={`
                flex items-center gap-1 text-gray-500 hover:text-blue-600
                transition-colors duration-200
                ${itemClassName}
              `}
              aria-label="Ir al inicio"
            >
              <Home className="w-4 h-4" />
              <span className="sr-only md:not-sr-only">Inicio</span>
            </Link>
            {displayItems.length > 0 && (
              <span className="mx-2" aria-hidden="true">
                {separatorElement}
              </span>
            )}
          </li>
        )}

        {/* Items */}
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const isEllipsis = item.label === '...';

          return (
            <li key={index} className="flex items-center">
              {isEllipsis ? (
                <span className="text-gray-400 px-1">...</span>
              ) : item.href && !isLast ? (
                <Link
                  to={item.href}
                  className={`
                    flex items-center gap-1 text-gray-500 hover:text-blue-600
                    transition-colors duration-200
                    ${itemClassName}
                  `}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={`
                    flex items-center gap-1 font-medium text-gray-900
                    ${activeClassName}
                  `}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              )}

              {!isLast && (
                <span className="mx-2" aria-hidden="true">
                  {separatorElement}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// ============================================
// COMPONENTE SIMPLE (Sin routing automático)
// ============================================

export interface SimpleBreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const SimpleBreadcrumbs: React.FC<SimpleBreadcrumbsProps> = ({
  items,
  className = '',
}) => {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-sm ${className}`}>
      <ol className="flex items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center">
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className="flex items-center gap-1 text-gray-500 hover:text-blue-600 transition-colors"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className="flex items-center gap-1 font-medium text-gray-900"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              )}

              {!isLast && (
                <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// ============================================
// HOOK PARA BREADCRUMBS DINÁMICOS
// ============================================

export interface UseBreadcrumbsOptions {
  basePath?: string;
  customLabels?: Record<string, string>;
}

export const useBreadcrumbs = (options: UseBreadcrumbsOptions = {}) => {
  const location = useLocation();
  const { basePath = '', customLabels = {} } = options;

  const items = React.useMemo(() => {
    const allLabels = { ...ROUTE_LABELS, ...customLabels };
    let pathToProcess = location.pathname;

    if (basePath && pathToProcess.startsWith(basePath)) {
      pathToProcess = pathToProcess.slice(basePath.length);
    }

    const segments = pathToProcess.split('/').filter(Boolean);

    return segments.map((segment, index) => {
      const href = basePath + '/' + segments.slice(0, index + 1).join('/');
      const label = allLabels[segment] ||
        segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

      return {
        label,
        href: index < segments.length - 1 ? href : undefined,
        segment,
      };
    });
  }, [location.pathname, basePath, customLabels]);

  return {
    items,
    currentPath: location.pathname,
  };
};

// ============================================
// COMPONENTE CON PÁGINA HEADER
// ============================================

export interface PageHeaderWithBreadcrumbsProps {
  title: string;
  subtitle?: string;
  breadcrumbItems?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeaderWithBreadcrumbs: React.FC<PageHeaderWithBreadcrumbsProps> = ({
  title,
  subtitle,
  breadcrumbItems,
  actions,
  className = '',
}) => {
  return (
    <div className={`mb-6 ${className}`}>
      <Breadcrumbs items={breadcrumbItems} className="mb-3" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default Breadcrumbs;
