import React from 'react';
import { TrendingUp, TrendingDown, Minus, Zap, AlertTriangle, Snowflake } from 'lucide-react';
import type { ClasificacionLiquidez, TendenciaProducto } from '../../../types/productoIntel.types';

interface ScoreLiquidezBadgeProps {
  score: number;
  clasificacion: ClasificacionLiquidez;
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
}

const clasificacionConfig = {
  alta: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    icon: Zap,
    label: 'Alta Liquidez'
  },
  media: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    icon: Minus,
    label: 'Liquidez Media'
  },
  baja: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-200',
    icon: AlertTriangle,
    label: 'Baja Liquidez'
  },
  critica: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    icon: Snowflake,
    label: 'Caja Congelada'
  }
};

const sizeConfig = {
  sm: {
    padding: 'px-2 py-0.5',
    text: 'text-xs',
    icon: 'h-3 w-3',
    score: 'text-xs'
  },
  md: {
    padding: 'px-2.5 py-1',
    text: 'text-sm',
    icon: 'h-4 w-4',
    score: 'text-sm'
  },
  lg: {
    padding: 'px-3 py-1.5',
    text: 'text-base',
    icon: 'h-5 w-5',
    score: 'text-base'
  }
};

export const ScoreLiquidezBadge: React.FC<ScoreLiquidezBadgeProps> = ({
  score,
  clasificacion,
  size = 'md',
  showScore = true
}) => {
  const config = clasificacionConfig[clasificacion];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded-full border
        ${config.bg} ${config.text} ${config.border} ${sizes.padding}
      `}
      title={`${config.label} - Score: ${score}/100`}
    >
      <Icon className={sizes.icon} />
      {showScore && (
        <span className={`font-semibold ${sizes.score}`}>{score}</span>
      )}
      <span className={`${sizes.text} hidden sm:inline`}>{config.label}</span>
    </div>
  );
};

// Badge para tendencia
interface TendenciaBadgeProps {
  tendencia: TendenciaProducto;
  variacion?: number;
  size?: 'sm' | 'md';
}

const tendenciaConfig = {
  creciendo: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    icon: TrendingUp,
    label: 'Creciendo'
  },
  estable: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    icon: Minus,
    label: 'Estable'
  },
  decreciendo: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    icon: TrendingDown,
    label: 'Decreciendo'
  },
  nuevo: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    icon: Zap,
    label: 'Nuevo'
  },
  sin_datos: {
    bg: 'bg-gray-50',
    text: 'text-gray-500',
    icon: Minus,
    label: 'Sin datos'
  }
};

export const TendenciaBadge: React.FC<TendenciaBadgeProps> = ({
  tendencia,
  variacion,
  size = 'sm'
}) => {
  const config = tendenciaConfig[tendencia];
  const Icon = config.icon;

  return (
    <div
      className={`
        inline-flex items-center gap-1 rounded px-2 py-0.5
        ${config.bg} ${config.text}
        ${size === 'sm' ? 'text-xs' : 'text-sm'}
      `}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      <span className="font-medium">
        {variacion !== undefined && tendencia !== 'nuevo' && tendencia !== 'sin_datos'
          ? `${variacion > 0 ? '+' : ''}${variacion}%`
          : config.label}
      </span>
    </div>
  );
};

// Badge para rotacion
interface RotacionBadgeProps {
  rotacionDias: number;
  clasificacion: string;
  size?: 'sm' | 'md';
}

const rotacionConfig: Record<string, { bg: string; text: string; label: string }> = {
  muy_alta: { bg: 'bg-green-100', text: 'text-green-800', label: 'Muy alta' },
  alta: { bg: 'bg-green-50', text: 'text-green-700', label: 'Alta' },
  media: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Media' },
  baja: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Baja' },
  muy_baja: { bg: 'bg-red-50', text: 'text-red-700', label: 'Muy baja' },
  sin_movimiento: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Sin mov.' }
};

export const RotacionBadge: React.FC<RotacionBadgeProps> = ({
  rotacionDias,
  clasificacion,
  size = 'sm'
}) => {
  const config = rotacionConfig[clasificacion] || rotacionConfig.media;

  return (
    <div
      className={`
        inline-flex items-center gap-1 rounded px-2 py-0.5
        ${config.bg} ${config.text}
        ${size === 'sm' ? 'text-xs' : 'text-sm'}
      `}
      title={`Se vende en ${rotacionDias} dias aproximadamente`}
    >
      <span className="font-medium">
        {rotacionDias < 999 ? `${rotacionDias}d` : '-'}
      </span>
      <span className="opacity-75">({config.label})</span>
    </div>
  );
};
