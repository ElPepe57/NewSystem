import React from 'react';

interface SkeletonProps {
  className?: string;
  /** Variante de skeleton */
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  /** Ancho del skeleton */
  width?: string | number;
  /** Alto del skeleton */
  height?: string | number;
  /** Animacion */
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Componente base de Skeleton para indicar carga
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse'
}) => {
  const baseClasses = 'bg-gray-200';

  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg'
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]',
    none: ''
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
};

/**
 * Skeleton para filas de tabla
 */
export const TableRowSkeleton: React.FC<{
  columns?: number;
  rows?: number;
}> = ({ columns = 5, rows = 5 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-gray-100">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <Skeleton variant="text" className="h-4" width={`${Math.random() * 40 + 60}%`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

/**
 * Skeleton para cards de KPI
 */
export const KPISkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Skeleton variant="text" width="60%" height={16} className="mb-2" />
              <Skeleton variant="text" width="40%" height={28} />
            </div>
            <Skeleton variant="circular" width={40} height={40} />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton para lista de items
 */
export const ListSkeleton: React.FC<{
  items?: number;
  showAvatar?: boolean;
}> = ({ items = 5, showAvatar = true }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
          {showAvatar && (
            <Skeleton variant="circular" width={40} height={40} />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="70%" height={16} />
            <Skeleton variant="text" width="50%" height={12} />
          </div>
          <Skeleton variant="rounded" width={60} height={24} />
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton para cards de producto
 */
export const ProductCardSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <Skeleton variant="rounded" width={64} height={64} />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" width="80%" height={16} />
              <Skeleton variant="text" width="60%" height={12} />
              <Skeleton variant="text" width="40%" height={12} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Skeleton variant="text" width="30%" height={20} />
            <Skeleton variant="rounded" width={80} height={28} />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton para formulario
 */
export const FormSkeleton: React.FC<{ fields?: number }> = ({ fields = 4 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-1">
          <Skeleton variant="text" width={100} height={14} className="mb-1" />
          <Skeleton variant="rounded" width="100%" height={40} />
        </div>
      ))}
      <div className="flex gap-3 pt-4">
        <Skeleton variant="rounded" width={100} height={40} />
        <Skeleton variant="rounded" width={100} height={40} />
      </div>
    </div>
  );
};

/**
 * Skeleton para pagina completa con header, KPIs y tabla
 */
export const PageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton variant="text" width={200} height={32} className="mb-2" />
          <Skeleton variant="text" width={300} height={16} />
        </div>
        <Skeleton variant="rounded" width={140} height={40} />
      </div>

      {/* KPIs */}
      <KPISkeleton count={4} />

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <Skeleton variant="rounded" width={250} height={36} />
            <div className="flex gap-2">
              <Skeleton variant="rounded" width={100} height={36} />
              <Skeleton variant="rounded" width={100} height={36} />
            </div>
          </div>
        </div>
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              {Array.from({ length: 6 }).map((_, index) => (
                <th key={index} className="px-4 py-3">
                  <Skeleton variant="text" height={12} width="80%" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <TableRowSkeleton columns={6} rows={8} />
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Skeleton para Dashboard
 */
export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Skeleton variant="text" width={280} height={32} className="mb-2" />
          <Skeleton variant="text" width={200} height={16} />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton variant="rounded" width={120} height={40} />
          <Skeleton variant="rounded" width={100} height={40} />
        </div>
      </div>

      {/* KPIs principales - 4 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <Skeleton variant="circular" width={44} height={44} />
              <Skeleton variant="rounded" width={60} height={24} />
            </div>
            <Skeleton variant="text" width="50%" height={14} className="mb-2" />
            <Skeleton variant="text" width="70%" height={28} />
          </div>
        ))}
      </div>

      {/* Sección 2 filas - KPIs secundarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <Skeleton variant="rounded" width={40} height={40} />
              <div className="flex-1">
                <Skeleton variant="text" width="60%" height={12} className="mb-1" />
                <Skeleton variant="text" width="80%" height={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Gráficos y Widgets - 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico izquierdo */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <Skeleton variant="text" width={180} height={20} />
            <Skeleton variant="rounded" width={100} height={32} />
          </div>
          <Skeleton variant="rounded" width="100%" height={280} />
        </div>

        {/* Gráfico derecho */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <Skeleton variant="text" width={160} height={20} />
            <Skeleton variant="rounded" width={80} height={32} />
          </div>
          <Skeleton variant="rounded" width="100%" height={280} />
        </div>
      </div>

      {/* Widgets inferiores - 3 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <Skeleton variant="text" width={140} height={18} />
              <Skeleton variant="rounded" width={70} height={28} />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton variant="circular" width={36} height={36} />
                  <div className="flex-1">
                    <Skeleton variant="text" width="70%" height={14} />
                    <Skeleton variant="text" width="50%" height={12} />
                  </div>
                  <Skeleton variant="text" width={60} height={16} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton para detalle de entidad
 */
export const DetailSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header con avatar */}
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={80} height={80} />
        <div className="space-y-2">
          <Skeleton variant="text" width={200} height={28} />
          <Skeleton variant="text" width={150} height={16} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
            <Skeleton variant="text" width="50%" height={32} className="mx-auto mb-2" />
            <Skeleton variant="text" width="70%" height={14} className="mx-auto" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 pb-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} variant="text" width={80} height={20} />
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index}>
              <Skeleton variant="text" width={100} height={12} className="mb-1" />
              <Skeleton variant="text" width="80%" height={16} />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index}>
              <Skeleton variant="text" width={100} height={12} className="mb-1" />
              <Skeleton variant="text" width="70%" height={16} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton para pagina de Inventario
 * Header + 6 KPIs + Filtros + Tabla
 */
export const InventarioSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton variant="text" width={180} height={32} className="mb-2" />
          <Skeleton variant="text" width={280} height={16} />
        </div>
        <div className="flex gap-2">
          <Skeleton variant="rounded" width={120} height={40} />
          <Skeleton variant="rounded" width={140} height={40} />
        </div>
      </div>

      {/* 6 KPIs en grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Skeleton variant="circular" width={36} height={36} />
              <Skeleton variant="rounded" width={50} height={20} />
            </div>
            <Skeleton variant="text" width="60%" height={12} className="mb-1" />
            <Skeleton variant="text" width="80%" height={24} />
          </div>
        ))}
      </div>

      {/* Filtros Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <Skeleton variant="rounded" width={280} height={40} className="flex-1" />
          <div className="flex gap-2">
            <Skeleton variant="rounded" width={140} height={40} />
            <Skeleton variant="rounded" width={140} height={40} />
            <Skeleton variant="rounded" width={140} height={40} />
          </div>
        </div>
      </div>

      {/* Tabla Card */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              {Array.from({ length: 7 }).map((_, index) => (
                <th key={index} className="px-4 py-3">
                  <Skeleton variant="text" height={12} width="80%" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <TableRowSkeleton columns={7} rows={10} />
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Skeleton para pagina de Gastos
 * Header + 4 KPIs + Grafico Distribucion + Filtros + Tabla
 */
export const GastosSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton variant="text" width={160} height={32} className="mb-2" />
          <Skeleton variant="text" width={260} height={16} />
        </div>
        <Skeleton variant="rounded" width={140} height={40} />
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Skeleton variant="circular" width={40} height={40} />
              <Skeleton variant="rounded" width={55} height={22} />
            </div>
            <Skeleton variant="text" width="55%" height={14} className="mb-1" />
            <Skeleton variant="text" width="75%" height={26} />
          </div>
        ))}
      </div>

      {/* Distribucion por Tipo - Grafico */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton variant="text" width={180} height={20} />
          <Skeleton variant="rounded" width={100} height={32} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Grafico de dona */}
          <div className="flex items-center justify-center">
            <Skeleton variant="circular" width={200} height={200} />
          </div>
          {/* Leyenda */}
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton variant="rounded" width={16} height={16} />
                <Skeleton variant="text" width="50%" height={14} />
                <Skeleton variant="text" width="25%" height={14} className="ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <Skeleton variant="rounded" width={260} height={40} className="flex-1" />
          <div className="flex gap-2">
            <Skeleton variant="rounded" width={150} height={40} />
            <Skeleton variant="rounded" width={150} height={40} />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              {Array.from({ length: 6 }).map((_, index) => (
                <th key={index} className="px-4 py-3">
                  <Skeleton variant="text" height={12} width="80%" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <TableRowSkeleton columns={6} rows={8} />
          </tbody>
        </table>
      </div>
    </div>
  );
};
