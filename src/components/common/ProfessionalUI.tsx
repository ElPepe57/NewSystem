import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ============================================
// ENTITY AVATAR - Avatar profesional con iniciales
// ============================================
interface EntityAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'viajero' | 'almacen-usa' | 'almacen-peru' | 'default';
  imageUrl?: string;
  status?: 'active' | 'inactive' | 'warning';
  className?: string;
}

export const EntityAvatar: React.FC<EntityAvatarProps> = ({
  name,
  size = 'md',
  variant = 'default',
  imageUrl,
  status,
  className = ''
}) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const sizeStyles = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-12 w-12 text-sm',
    lg: 'h-16 w-16 text-lg',
    xl: 'h-20 w-20 text-xl'
  };

  const variantStyles = {
    viajero: 'bg-gradient-to-br from-purple-500 to-purple-700 text-white',
    'almacen-usa': 'bg-gradient-to-br from-blue-500 to-blue-700 text-white',
    'almacen-peru': 'bg-gradient-to-br from-red-500 to-red-700 text-white',
    default: 'bg-gradient-to-br from-gray-400 to-gray-600 text-white'
  };

  const statusColors = {
    active: 'bg-green-500 ring-2 ring-white',
    inactive: 'bg-gray-400 ring-2 ring-white',
    warning: 'bg-amber-500 ring-2 ring-white'
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      <div
        className={`
          ${sizeStyles[size]}
          ${variantStyles[variant]}
          rounded-xl flex items-center justify-center font-bold
          shadow-lg transform transition-all duration-200
          hover:scale-105 hover:shadow-xl
        `}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover rounded-xl" />
        ) : (
          getInitials(name)
        )}
      </div>
      {status && (
        <span
          className={`
            absolute -bottom-1 -right-1 h-4 w-4 rounded-full
            ${statusColors[status]}
          `}
        />
      )}
    </div>
  );
};

// ============================================
// GRADIENT HEADER - Header con gradiente profesional
// ============================================
interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  stats?: Array<{
    label: string;
    value: string | number;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
  }>;
  variant?: 'purple' | 'blue' | 'green' | 'red' | 'dark';
}

export const GradientHeader: React.FC<GradientHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  actions,
  stats,
  variant = 'dark'
}) => {
  const gradients = {
    purple: 'from-purple-600 via-purple-700 to-indigo-800',
    blue: 'from-blue-600 via-blue-700 to-indigo-800',
    green: 'from-emerald-600 via-teal-700 to-cyan-800',
    red: 'from-red-600 via-rose-700 to-pink-800',
    dark: 'from-slate-700 via-slate-800 to-slate-900'
  };

  return (
    <div className={`bg-gradient-to-r ${gradients[variant]} rounded-2xl p-6 text-white shadow-xl`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          {Icon && (
            <div className="h-14 w-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Icon className="h-7 w-7 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-white/70 mt-1 text-sm">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center space-x-3">
            {actions}
          </div>
        )}
      </div>

      {stats && stats.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/15 transition-colors"
            >
              <div className="text-white/60 text-xs font-medium uppercase tracking-wider">
                {stat.label}
              </div>
              <div className="mt-1 flex items-baseline space-x-2">
                <span className="text-2xl font-bold">{stat.value}</span>
                {stat.trend && (
                  <span className={`flex items-center text-xs font-medium ${
                    stat.trend === 'up' ? 'text-green-400' :
                    stat.trend === 'down' ? 'text-red-400' : 'text-white/50'
                  }`}>
                    {stat.trend === 'up' && <TrendingUp className="h-3 w-3 mr-0.5" />}
                    {stat.trend === 'down' && <TrendingDown className="h-3 w-3 mr-0.5" />}
                    {stat.trend === 'neutral' && <Minus className="h-3 w-3 mr-0.5" />}
                    {stat.trendValue}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// STAT CARD - Tarjeta de estadística con hover
// ============================================
interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'purple' | 'blue' | 'green' | 'red' | 'amber' | 'default';
  onClick?: () => void;
  active?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  subtitle,
  trend,
  trendValue,
  variant = 'default',
  onClick,
  active = false
}) => {
  const variants = {
    purple: {
      bg: 'bg-purple-50',
      icon: 'bg-purple-100 text-purple-600',
      value: 'text-purple-700',
      ring: 'ring-purple-500',
      hover: 'hover:bg-purple-100'
    },
    blue: {
      bg: 'bg-blue-50',
      icon: 'bg-blue-100 text-blue-600',
      value: 'text-blue-700',
      ring: 'ring-blue-500',
      hover: 'hover:bg-blue-100'
    },
    green: {
      bg: 'bg-emerald-50',
      icon: 'bg-emerald-100 text-emerald-600',
      value: 'text-emerald-700',
      ring: 'ring-emerald-500',
      hover: 'hover:bg-emerald-100'
    },
    red: {
      bg: 'bg-red-50',
      icon: 'bg-red-100 text-red-600',
      value: 'text-red-700',
      ring: 'ring-red-500',
      hover: 'hover:bg-red-100'
    },
    amber: {
      bg: 'bg-amber-50',
      icon: 'bg-amber-100 text-amber-600',
      value: 'text-amber-700',
      ring: 'ring-amber-500',
      hover: 'hover:bg-amber-100'
    },
    default: {
      bg: 'bg-gray-50',
      icon: 'bg-gray-100 text-gray-600',
      value: 'text-gray-700',
      ring: 'ring-gray-400',
      hover: 'hover:bg-gray-100'
    }
  };

  const style = variants[variant];

  return (
    <div
      onClick={onClick}
      className={`
        ${style.bg} ${style.hover}
        rounded-xl p-5 transition-all duration-200
        ${onClick ? 'cursor-pointer transform hover:scale-[1.02] hover:shadow-md' : ''}
        ${active ? `ring-2 ${style.ring} shadow-md` : ''}
      `}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className={`mt-2 text-3xl font-bold ${style.value}`}>{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          )}
          {trend && trendValue && (
            <div className={`mt-2 flex items-center text-xs font-medium ${
              trend === 'up' ? 'text-green-600' :
              trend === 'down' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {trend === 'up' && <TrendingUp className="h-3 w-3 mr-1" />}
              {trend === 'down' && <TrendingDown className="h-3 w-3 mr-1" />}
              {trend === 'neutral' && <Minus className="h-3 w-3 mr-1" />}
              {trendValue}
            </div>
          )}
        </div>
        <div className={`h-12 w-12 ${style.icon} rounded-xl flex items-center justify-center`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

// ============================================
// ENTITY CARD - Tarjeta de entidad profesional
// ============================================
interface EntityCardProps {
  name: string;
  code?: string;
  variant: 'viajero' | 'almacen-usa' | 'almacen-peru';
  status: 'active' | 'inactive';
  stats: Array<{
    label: string;
    value: string | number;
    icon?: LucideIcon;
  }>;
  tags?: Array<{
    label: string;
    variant: 'success' | 'warning' | 'info' | 'default';
  }>;
  details?: Array<{
    icon: LucideIcon;
    text: string;
    highlight?: boolean;
  }>;
  actionLabel?: string;
  onAction?: () => void;
  onClick?: () => void;
  highlight?: React.ReactNode;
}

export const EntityCard: React.FC<EntityCardProps> = ({
  name,
  code,
  variant,
  status,
  stats,
  tags = [],
  details = [],
  onClick,
  highlight
}) => {
  const variantConfig = {
    viajero: {
      accent: 'border-l-purple-500',
      statBg: 'bg-purple-50',
      statText: 'text-purple-700'
    },
    'almacen-usa': {
      accent: 'border-l-blue-500',
      statBg: 'bg-blue-50',
      statText: 'text-blue-700'
    },
    'almacen-peru': {
      accent: 'border-l-red-500',
      statBg: 'bg-red-50',
      statText: 'text-red-700'
    }
  };

  const config = variantConfig[variant];

  const tagVariants = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-800',
    info: 'bg-blue-100 text-blue-800',
    default: 'bg-gray-100 text-gray-800'
  };

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 ${config.accent}
        transition-all duration-300 overflow-hidden
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' : ''}
      `}
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <EntityAvatar
              name={name}
              variant={variant}
              status={status === 'active' ? 'active' : 'inactive'}
              size="lg"
            />
            <div>
              <h3 className="text-lg font-bold text-gray-900">{name}</h3>
              {code && (
                <p className="text-sm text-gray-500 font-mono">{code}</p>
              )}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${tagVariants[tag.variant]}`}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          {stats.slice(0, 4).map((stat, idx) => (
            <div key={idx} className={`${config.statBg} rounded-lg p-3`}>
              <div className="flex items-center text-gray-500 text-xs mb-1">
                {stat.icon && <stat.icon className="h-3 w-3 mr-1" />}
                {stat.label}
              </div>
              <div className={`text-xl font-bold ${config.statText}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Highlight Section (e.g., próximo viaje) */}
      {highlight && (
        <div className="px-5 pb-3">
          {highlight}
        </div>
      )}

      {/* Details Footer */}
      {details.length > 0 && (
        <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
          <div className="space-y-1.5">
            {details.map((detail, idx) => (
              <div
                key={idx}
                className={`flex items-center text-sm ${
                  detail.highlight ? 'text-purple-600 font-medium' : 'text-gray-600'
                }`}
              >
                <detail.icon className={`h-4 w-4 mr-2 ${detail.highlight ? 'text-purple-500' : 'text-gray-400'}`} />
                {detail.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// TAB NAVIGATION - Navegación con tabs profesional
// ============================================
interface Tab {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
  emoji?: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange,
  variant = 'underline'
}) => {
  if (variant === 'pills') {
    return (
      <div className="flex space-x-2 bg-gray-100 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm
              transition-all duration-200
              ${activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            {tab.emoji && <span>{tab.emoji}</span>}
            {tab.icon && <tab.icon className="h-4 w-4" />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`
                ml-1 px-2 py-0.5 text-xs font-medium rounded-full
                ${activeTab === tab.id ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700'}
              `}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm
              transition-all duration-200
              ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {tab.emoji && <span className="text-base">{tab.emoji}</span>}
            {tab.icon && <tab.icon className="h-4 w-4" />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`
                ml-1 px-2 py-0.5 text-xs font-medium rounded-full
                ${activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
              `}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};

// ============================================
// SECTION HEADER - Encabezado de sección
// ============================================
interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  iconColor?: string;
  action?: React.ReactNode;
  count?: number;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon: Icon,
  iconColor = 'text-gray-600',
  action,
  count
}) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold text-gray-900 flex items-center">
        {Icon && <Icon className={`h-5 w-5 mr-2 ${iconColor}`} />}
        {title}
        {count !== undefined && (
          <span className="ml-2 text-sm font-normal text-gray-500">({count})</span>
        )}
      </h2>
      {action}
    </div>
  );
};

// ============================================
// EMPTY STATE - Estado vacío profesional
// ============================================
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action
}) => {
  return (
    <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12">
      <div className="text-center">
        <div className="mx-auto h-16 w-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        {description && (
          <p className="text-gray-500 max-w-sm mx-auto mb-6">{description}</p>
        )}
        {action}
      </div>
    </div>
  );
};

// ============================================
// HIGHLIGHT BOX - Caja de resaltado (próximo viaje, etc)
// ============================================
interface HighlightBoxProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subValue?: string;
  variant?: 'info' | 'warning' | 'success' | 'default';
}

export const HighlightBox: React.FC<HighlightBoxProps> = ({
  icon: Icon,
  label,
  value,
  subValue,
  variant = 'default'
}) => {
  const variants = {
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-amber-50 border-amber-200',
    success: 'bg-green-50 border-green-200',
    default: 'bg-gray-50 border-gray-200'
  };

  const iconColors = {
    info: 'text-blue-600',
    warning: 'text-amber-600',
    success: 'text-green-600',
    default: 'text-gray-600'
  };

  const textColors = {
    info: 'text-blue-700',
    warning: 'text-amber-700',
    success: 'text-green-700',
    default: 'text-gray-700'
  };

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${variants[variant]}`}>
      <div className="flex items-center space-x-2">
        <Icon className={`h-4 w-4 ${iconColors[variant]}`} />
        <span className={`text-sm font-medium ${textColors[variant]}`}>{label}</span>
      </div>
      <div className="text-right">
        <div className={`text-sm font-bold ${textColors[variant]}`}>{value}</div>
        {subValue && (
          <div className={`text-xs ${textColors[variant]} opacity-75`}>{subValue}</div>
        )}
      </div>
    </div>
  );
};

// ============================================
// MASTER CARD - Tarjeta universal para entidades maestras
// ============================================
export type MasterCardVariant = 'cliente' | 'marca' | 'proveedor' | 'competidor' | 'viajero' | 'almacen-usa' | 'almacen-peru';

interface MasterCardProps {
  name: string;
  code?: string;
  subtitle?: string;
  variant: MasterCardVariant;
  status?: 'active' | 'inactive' | 'warning';
  stats?: Array<{
    label: string;
    value: string | number;
    icon?: LucideIcon;
  }>;
  badges?: Array<{
    label: string;
    variant: 'success' | 'warning' | 'info' | 'danger' | 'default' | 'purple';
  }>;
  details?: Array<{
    icon: LucideIcon;
    text: string;
    highlight?: boolean;
  }>;
  highlight?: React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const MasterCard: React.FC<MasterCardProps> = ({
  name,
  code,
  subtitle,
  variant,
  status = 'active',
  stats = [],
  badges = [],
  details = [],
  highlight,
  actions,
  onClick,
  onView,
  onEdit,
  onDelete
}) => {
  const variantConfig = {
    cliente: {
      gradient: 'from-blue-500 to-blue-700',
      accent: 'border-l-blue-500',
      statBg: 'bg-blue-50',
      statText: 'text-blue-700',
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600'
    },
    marca: {
      gradient: 'from-emerald-500 to-emerald-700',
      accent: 'border-l-emerald-500',
      statBg: 'bg-emerald-50',
      statText: 'text-emerald-700',
      iconBg: 'bg-emerald-100',
      iconText: 'text-emerald-600'
    },
    proveedor: {
      gradient: 'from-purple-500 to-purple-700',
      accent: 'border-l-purple-500',
      statBg: 'bg-purple-50',
      statText: 'text-purple-700',
      iconBg: 'bg-purple-100',
      iconText: 'text-purple-600'
    },
    competidor: {
      gradient: 'from-red-500 to-red-700',
      accent: 'border-l-red-500',
      statBg: 'bg-red-50',
      statText: 'text-red-700',
      iconBg: 'bg-red-100',
      iconText: 'text-red-600'
    },
    viajero: {
      gradient: 'from-purple-500 to-purple-700',
      accent: 'border-l-purple-500',
      statBg: 'bg-purple-50',
      statText: 'text-purple-700',
      iconBg: 'bg-purple-100',
      iconText: 'text-purple-600'
    },
    'almacen-usa': {
      gradient: 'from-blue-500 to-blue-700',
      accent: 'border-l-blue-500',
      statBg: 'bg-blue-50',
      statText: 'text-blue-700',
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600'
    },
    'almacen-peru': {
      gradient: 'from-red-500 to-red-700',
      accent: 'border-l-red-500',
      statBg: 'bg-red-50',
      statText: 'text-red-700',
      iconBg: 'bg-red-100',
      iconText: 'text-red-600'
    }
  };

  const badgeVariants = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-800',
    info: 'bg-blue-100 text-blue-800',
    danger: 'bg-red-100 text-red-800',
    default: 'bg-gray-100 text-gray-800',
    purple: 'bg-purple-100 text-purple-800'
  };

  const config = variantConfig[variant];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const statusColors = {
    active: 'bg-green-500 ring-2 ring-white',
    inactive: 'bg-gray-400 ring-2 ring-white',
    warning: 'bg-amber-500 ring-2 ring-white'
  };

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 ${config.accent}
        transition-all duration-300 overflow-hidden
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' : ''}
      `}
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            {/* Avatar */}
            <div className="relative">
              <div
                className={`
                  h-14 w-14 bg-gradient-to-br ${config.gradient} text-white
                  rounded-xl flex items-center justify-center font-bold text-lg
                  shadow-lg transform transition-all duration-200 hover:scale-105
                `}
              >
                {getInitials(name)}
              </div>
              <span
                className={`
                  absolute -bottom-1 -right-1 h-4 w-4 rounded-full
                  ${statusColors[status]}
                `}
              />
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 truncate">{name}</h3>
              {code && (
                <p className="text-sm text-gray-500 font-mono">{code}</p>
              )}
              {subtitle && (
                <p className="text-sm text-gray-500 truncate">{subtitle}</p>
              )}
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {badges.map((badge, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${badgeVariants[badge.variant]}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Actions */}
          {(actions || onView || onEdit || onDelete) && (
            <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
              {actions}
            </div>
          )}
        </div>

        {/* Stats */}
        {stats.length > 0 && (
          <div className={`mt-4 grid grid-cols-${Math.min(stats.length, 3)} gap-2`}>
            {stats.slice(0, 3).map((stat, idx) => (
              <div key={idx} className={`${config.statBg} rounded-lg p-2.5`}>
                <div className="flex items-center text-gray-500 text-xs mb-0.5">
                  {stat.icon && <stat.icon className="h-3 w-3 mr-1" />}
                  {stat.label}
                </div>
                <div className={`text-lg font-bold ${config.statText}`}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Highlight Section */}
      {highlight && (
        <div className="px-5 pb-3">
          {highlight}
        </div>
      )}

      {/* Details Footer */}
      {details.length > 0 && (
        <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
          <div className="space-y-1.5">
            {details.slice(0, 3).map((detail, idx) => (
              <div
                key={idx}
                className={`flex items-center text-sm ${
                  detail.highlight ? `${config.statText} font-medium` : 'text-gray-600'
                }`}
              >
                <detail.icon className={`h-4 w-4 mr-2 flex-shrink-0 ${detail.highlight ? config.iconText : 'text-gray-400'}`} />
                <span className="truncate">{detail.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// QUICK STAT ROW - Fila de estadística rápida
// ============================================
interface QuickStatRowProps {
  items: Array<{
    label: string;
    value: string | number;
    icon?: LucideIcon;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  }>;
}

export const QuickStatRow: React.FC<QuickStatRowProps> = ({ items }) => {
  const variantColors = {
    default: 'text-gray-900',
    success: 'text-green-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    info: 'text-blue-600'
  };

  return (
    <div className="flex items-center divide-x divide-gray-200 bg-white rounded-lg border border-gray-200 overflow-hidden">
      {items.map((item, idx) => (
        <div key={idx} className="flex-1 px-4 py-3 text-center">
          <div className="text-xs text-gray-500 flex items-center justify-center">
            {item.icon && <item.icon className="h-3 w-3 mr-1" />}
            {item.label}
          </div>
          <div className={`text-lg font-bold ${variantColors[item.variant || 'default']}`}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
};
