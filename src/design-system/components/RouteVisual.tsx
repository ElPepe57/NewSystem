import React from 'react';
import { ArrowRight, MapPin, Package, Warehouse, Truck, Plane } from 'lucide-react';
import { cn } from '../utils';

// ════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════

export type RouteNodeType =
  | 'proveedor'
  | 'casilla'
  | 'destino'
  | 'almacen'
  | 'cliente'
  | 'custom';

export type RouteNodeState = 'pending' | 'active' | 'done' | 'empty';

export interface RouteNode {
  /** Tipo semántico del nodo — afecta icono por defecto */
  tipo?: RouteNodeType;
  /** Bandera o emoji del país (ej: '🇺🇸', '🇵🇪') */
  flag?: string;
  /** Nombre descriptivo (ej: "Amazon", "CAS-004") */
  nombre?: string;
  /** Código o identificador (ej: "CAS-004", "LIM-01") */
  codigo?: string;
  /** Subtexto (ej: "Casilla USA", "Almacén propio") */
  subtexto?: string;
  /** Estado visual del nodo */
  state?: RouteNodeState;
  /** Icono custom (sobreescribe el default por tipo) */
  icon?: React.ReactNode;
}

export interface RouteSegment {
  /** Etiqueta del segmento entre 2 nodos (ej: "DHL", "Angie", "FedEx") */
  label?: string;
  /** Sub-etiqueta (ej: "3-5 días", "Tracking: ABC123") */
  subtexto?: string;
  /** Estado visual */
  state?: RouteNodeState;
  /** Icono custom (sobreescribe el default avión/camión) */
  icon?: React.ReactNode;
}

interface RouteVisualProps {
  /** Nodos de la ruta (mínimo 2) */
  nodes: RouteNode[];
  /** Segmentos entre nodos (nodes.length - 1) — opcional */
  segments?: RouteSegment[];
  /** Orientación del layout */
  orientation?: 'horizontal' | 'vertical';
  /** Tamaño de los nodos */
  size?: 'sm' | 'md' | 'lg';
  /** ClassName adicional */
  className?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Icons por tipo
// ════════════════════════════════════════════════════════════════════════════

const TYPE_ICONS: Record<RouteNodeType, React.ReactNode> = {
  proveedor: <Package className="w-4 h-4" />,
  casilla: <Warehouse className="w-4 h-4" />,
  destino: <MapPin className="w-4 h-4" />,
  almacen: <Warehouse className="w-4 h-4" />,
  cliente: <MapPin className="w-4 h-4" />,
  custom: null,
};

// ════════════════════════════════════════════════════════════════════════════
// Node Component
// ════════════════════════════════════════════════════════════════════════════

const NodeDisplay: React.FC<{ node: RouteNode; size: 'sm' | 'md' | 'lg' }> = ({
  node,
  size,
}) => {
  const state = node.state ?? 'done';
  const tipoIcon = node.tipo ? TYPE_ICONS[node.tipo] : null;
  const icon = node.icon ?? tipoIcon;

  const sizeMap = {
    sm: { box: 'w-12 h-12', flag: 'text-xl', label: 'text-xs', sub: 'text-[10px]' },
    md: { box: 'w-16 h-16', flag: 'text-2xl', label: 'text-sm', sub: 'text-xs' },
    lg: { box: 'w-20 h-20', flag: 'text-3xl', label: 'text-sm', sub: 'text-xs' },
  }[size];

  const stateClasses = {
    pending: 'bg-slate-100 border-slate-200 text-slate-400',
    active: 'bg-teal-50 border-teal-400 text-teal-900 ring-2 ring-teal-100',
    done: 'bg-white border-slate-300 text-slate-800',
    empty: 'bg-slate-50 border-dashed border-slate-300 text-slate-400',
  }[state];

  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 min-w-0 text-center">
      <div
        className={cn(
          'rounded-xl border-2 flex items-center justify-center transition-colors',
          sizeMap.box,
          stateClasses
        )}
      >
        {node.flag ? (
          <span className={sizeMap.flag}>{node.flag}</span>
        ) : (
          icon
        )}
      </div>
      {node.nombre && (
        <div className={cn('font-semibold text-slate-900 truncate max-w-[8rem]', sizeMap.label)}>
          {node.nombre}
        </div>
      )}
      {node.codigo && (
        <div className={cn('font-mono text-teal-600', sizeMap.sub)}>
          {node.codigo}
        </div>
      )}
      {node.subtexto && (
        <div className={cn('text-slate-500 truncate max-w-[8rem]', sizeMap.sub)}>
          {node.subtexto}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Segment Component
// ════════════════════════════════════════════════════════════════════════════

const SegmentDisplay: React.FC<{
  segment?: RouteSegment;
  orientation: 'horizontal' | 'vertical';
}> = ({ segment, orientation }) => {
  const state = segment?.state ?? 'done';

  const lineColor = {
    pending: 'bg-slate-200',
    active: 'bg-teal-500',
    done: 'bg-emerald-500',
    empty: 'bg-slate-200',
  }[state];

  const icon =
    segment?.icon ??
    (orientation === 'horizontal' ? (
      <Plane className="w-3.5 h-3.5" />
    ) : (
      <Truck className="w-3.5 h-3.5" />
    ));

  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col items-center gap-1 py-2">
        <div className={cn('w-0.5 flex-1 min-h-[1.5rem]', lineColor)} />
        {segment?.label && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-700">
            {icon}
            {segment.label}
          </div>
        )}
        {segment?.subtexto && (
          <div className="text-[10px] text-slate-500">{segment.subtexto}</div>
        )}
        <div className={cn('w-0.5 flex-1 min-h-[1.5rem]', lineColor)} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center min-w-[3rem] px-2">
      <div className="relative w-full flex items-center">
        <div className={cn('flex-1 h-0.5', lineColor)} />
        {segment?.label && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-full text-[11px] font-medium text-slate-700 whitespace-nowrap shadow-sm">
            {icon}
            {segment.label}
          </div>
        )}
        <div className={cn('flex-1 h-0.5', lineColor)} />
        <ArrowRight
          className={cn(
            'w-4 h-4 -ml-2',
            state === 'done' && 'text-emerald-500',
            state === 'active' && 'text-teal-500',
            (state === 'pending' || state === 'empty') && 'text-slate-300'
          )}
        />
      </div>
      {segment?.subtexto && (
        <div className="text-[10px] text-slate-500 mt-1 text-center">
          {segment.subtexto}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// RouteVisual — Main export
// ════════════════════════════════════════════════════════════════════════════

/**
 * RouteVisual — Visualización de ruta logística A→B→C.
 *
 * Usado para mostrar el flujo de un envío: proveedor → casilla → destino final.
 *
 * Ejemplo horizontal:
 *   <RouteVisual
 *     nodes={[
 *       { flag: '🇺🇸', nombre: 'Amazon', subtexto: 'Proveedor', tipo: 'proveedor' },
 *       { flag: '🇺🇸', nombre: 'CAS-004', codigo: 'CAS-004', tipo: 'casilla' },
 *       { flag: '🇵🇪', nombre: 'Lima', subtexto: 'Almacén', tipo: 'almacen' },
 *     ]}
 *     segments={[
 *       { label: 'FedEx', subtexto: '3 días', state: 'done' },
 *       { label: 'Angie', subtexto: 'Viajero', state: 'active' },
 *     ]}
 *   />
 */
export const RouteVisual: React.FC<RouteVisualProps> = ({
  nodes,
  segments,
  orientation = 'horizontal',
  size = 'md',
  className,
}) => {
  if (nodes.length < 2) {
    console.warn('[RouteVisual] se necesitan al menos 2 nodos.');
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-stretch',
        orientation === 'horizontal' && 'flex-row gap-1',
        orientation === 'vertical' && 'flex-col gap-1',
        className
      )}
    >
      {nodes.map((node, index) => (
        <React.Fragment key={index}>
          <NodeDisplay node={node} size={size} />
          {index < nodes.length - 1 && (
            <SegmentDisplay
              segment={segments?.[index]}
              orientation={orientation}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
