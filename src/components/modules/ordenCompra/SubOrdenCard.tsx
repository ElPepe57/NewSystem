import React, { useState } from 'react';
import { Clock, Truck, CheckCircle2, CreditCard, Send, Box, ChevronDown, ChevronRight, Package } from 'lucide-react';
import { cn } from '../../../design-system';
import type { SubOrdenCompra } from '../../../types/ordenCompra.types';
import { getDescripcionProducto } from '../../../utils/producto.helpers';

// ─── Types ─────────────────────────────────────────────────

interface SubOrdenCardProps {
  subOrden: SubOrdenCompra;
  index: number;
  mode: 'compact' | 'full';
  loading?: boolean;
  onMarcarEnTransito?: (id: string) => void;
  onRecibirProductos?: (id: string) => void;
  onRegistrarPago?: (id: string) => void;
  trackingDraft?: { tracking: string; courier: string };
  onTrackingChange?: (draft: { tracking: string; courier: string }) => void;
}

// ─── Mini Pipeline ─────────────────────────────────────────

const PASOS = [
  { key: 'borrador', label: 'Pendiente', icon: Clock },
  { key: 'en_transito', label: 'En Transito', icon: Truck },
  { key: 'recibida', label: 'Recibida', icon: CheckCircle2 },
] as const;

const MiniPipeline: React.FC<{ estado: string; compact?: boolean }> = ({ estado, compact }) => {
  const pasoIdx = estado === 'recibida' ? 2 : estado === 'en_transito' ? 1 : 0;

  return (
    <div className="flex items-center gap-1">
      {PASOS.map((paso, i) => {
        const completado = i < pasoIdx;
        const actual = i === pasoIdx;
        const PasoIcon = paso.icon;

        return (
          <React.Fragment key={paso.key}>
            {i > 0 && (
              <div className={cn(
                'flex-1',
                compact ? 'h-px max-w-4' : 'h-px max-w-8',
                completado ? 'bg-emerald-400' : 'bg-slate-200'
              )} />
            )}
            <div className="flex items-center gap-1" title={paso.label}>
              <div className={cn(
                'rounded-full flex items-center justify-center shrink-0',
                compact ? 'w-4 h-4' : 'w-5 h-5',
                completado ? 'bg-emerald-500 text-white' :
                actual ? 'bg-sky-100 text-sky-600 ring-2 ring-sky-300' :
                'bg-slate-100 text-slate-400'
              )}>
                <PasoIcon className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
              </div>
              {!compact && (
                <span className={cn(
                  'text-[10px] font-medium hidden sm:inline',
                  completado ? 'text-emerald-700' :
                  actual ? 'text-sky-700' :
                  'text-slate-400'
                )}>{paso.label}</span>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Pago Badge ────────────────────────────────────────────

const PagoBadge: React.FC<{ pagado: boolean }> = ({ pagado }) => (
  <span className={cn(
    'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0',
    pagado
      ? 'text-emerald-700 bg-emerald-50'
      : 'text-slate-500 bg-slate-100'
  )}>
    <CreditCard className="w-3 h-3" />
    {pagado ? 'Pagada' : 'Pago pendiente'}
  </span>
);

// ─── Acción Contextual ────────────────────────────────────

const AccionContextual: React.FC<{
  estado: string;
  pagado: boolean;
  loading?: boolean;
  onMarcarEnTransito?: () => void;
  onRecibirProductos?: () => void;
  onRegistrarPago?: () => void;
}> = ({ estado, pagado, loading, onMarcarEnTransito, onRecibirProductos, onRegistrarPago }) => {
  if (estado === 'borrador' && onMarcarEnTransito) {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={onMarcarEnTransito}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
      >
        <Send className="w-3 h-3" />
        {loading ? 'Guardando...' : 'Marcar en Transito'}
      </button>
    );
  }
  if (estado === 'en_transito' && onRecibirProductos) {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={onRecibirProductos}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
      >
        <Box className="w-3 h-3" />
        {loading ? 'Guardando...' : 'Recibir Productos'}
      </button>
    );
  }
  if (estado === 'recibida' && !pagado && onRegistrarPago) {
    return (
      <button
        type="button"
        onClick={onRegistrarPago}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
      >
        <CreditCard className="w-3 h-3" />
        Registrar Pago
      </button>
    );
  }
  if (estado === 'recibida' && pagado) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-lg">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Completada
      </span>
    );
  }
  return null;
};

// ─── Border color por estado ──────────────────────────────

const getBorderColor = (estado: string) => {
  if (estado === 'recibida') return 'border-l-emerald-400';
  if (estado === 'en_transito') return 'border-l-amber-400';
  return 'border-l-slate-300';
};

// ─── SubOrdenCard ─────────────────────────────────────────

export const SubOrdenCard: React.FC<SubOrdenCardProps> = ({
  subOrden: sub,
  index,
  mode,
  loading = false,
  onMarcarEnTransito,
  onRecibirProductos,
  onRegistrarPago,
  trackingDraft,
  onTrackingChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const estado = sub.estado || 'borrador';
  const pagado = sub.estadoPago === 'pagado';
  const unidades = sub.productos.reduce((s, p) => s + p.cantidad, 0);

  // ── Modo Compact (tabla expandable) ──
  if (mode === 'compact') {
    return (
      <div className={cn('bg-white rounded-lg border border-slate-200 border-l-4 overflow-hidden', getBorderColor(estado))}>
        {/* Header clickable */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
        >
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          }
          <span className="text-xs font-semibold text-slate-700 shrink-0">Sub-orden {index + 1}</span>
          <MiniPipeline estado={estado} compact />
          <PagoBadge pagado={pagado} />
          <span className="text-[10px] text-slate-400 shrink-0">{sub.productos.length} prod. / {unidades}u</span>
          {sub.referenciaProveedor && (
            <span className="text-[10px] text-slate-500 truncate hidden sm:inline">Ref: {sub.referenciaProveedor}</span>
          )}
          {sub.envioNumero && (
            <span className="text-[10px] text-sky-600 font-medium hidden sm:inline">{sub.envioNumero}</span>
          )}
          <span className="text-xs font-semibold text-slate-900 font-mono ml-auto shrink-0">${sub.totalUSD.toFixed(2)}</span>
        </button>

        {/* Contenido expandido */}
        {expanded && (
          <div className="px-4 pb-3 border-t border-slate-100 space-y-2 pt-2">
            {/* Productos */}
            <div className="hidden sm:block">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase">Producto</th>
                    <th className="text-right px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase w-12">Cant.</th>
                    <th className="text-right px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase w-20">C. Unit.</th>
                    <th className="text-right px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase w-20">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sub.productos.map((prod, pIdx) => {
                    const desc = getDescripcionProducto(prod);
                    return (
                      <tr key={pIdx}>
                        <td className="px-2 py-1.5">
                          <div className="font-medium text-slate-900">{prod.marca} {prod.nombreComercial}</div>
                          {desc && <div className="text-[10px] text-slate-400">{prod.sku} · {desc}</div>}
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium">{prod.cantidad}</td>
                        <td className="px-2 py-1.5 text-right font-mono">${(prod.costoUnitario ?? 0).toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-medium">${(prod.subtotal ?? 0).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Costos + total */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <div className="flex gap-3">
                <span>{unidades} unidades</span>
                {(sub.descuentoUSD || 0) > 0 && <span className="text-red-500">Desc: -${sub.descuentoUSD!.toFixed(2)}</span>}
                {(sub.shippingUSD || 0) > 0 && <span>Envio: ${sub.shippingUSD!.toFixed(2)}</span>}
                {(sub.impuestoUSD || 0) > 0 && <span>Tax: ${sub.impuestoUSD!.toFixed(2)}</span>}
              </div>
              {sub.numeroTracking && (
                <span className="flex items-center gap-1 text-sky-600">
                  <Truck className="w-3 h-3" /> {sub.numeroTracking}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Modo Full (card detalle) ──
  return (
    <div className={cn(
      'bg-white rounded-lg border border-slate-200 border-l-4 p-4 space-y-3',
      getBorderColor(estado)
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-slate-900">Sub-orden {index + 1}</span>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {sub.referenciaProveedor && (
              <span className="text-xs text-slate-500 font-mono">Ref: {sub.referenciaProveedor}</span>
            )}
            {sub.envioNumero && (
              <span className="text-[10px] text-sky-600 font-medium bg-sky-50 px-1.5 py-0.5 rounded">{sub.envioNumero}</span>
            )}
          </div>
        </div>
        <span className="text-sm font-bold tabular-nums text-slate-900 shrink-0">${sub.totalUSD.toFixed(2)}</span>
      </div>

      {/* Pipeline + Pago */}
      <div className="flex items-center justify-between gap-3">
        <MiniPipeline estado={estado} />
        <PagoBadge pagado={pagado} />
      </div>

      {/* Tracking inputs — solo cuando no recibida */}
      {estado !== 'recibida' && trackingDraft && onTrackingChange && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">Tracking</label>
            <input
              type="text"
              value={trackingDraft.tracking}
              onChange={e => onTrackingChange({ ...trackingDraft, tracking: e.target.value })}
              placeholder="Numero de tracking"
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">Courier</label>
            <input
              type="text"
              value={trackingDraft.courier}
              onChange={e => onTrackingChange({ ...trackingDraft, courier: e.target.value })}
              placeholder="USPS, FedEx, DHL..."
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Tracking display — cuando recibida */}
      {estado === 'recibida' && (sub.numeroTracking || sub.courier) && (
        <div className="flex gap-4 text-xs text-slate-500">
          {sub.numeroTracking && <span><span className="font-medium text-slate-700">Tracking:</span> {sub.numeroTracking}</span>}
          {sub.courier && <span><span className="font-medium text-slate-700">Courier:</span> {sub.courier}</span>}
        </div>
      )}

      {/* Productos */}
      <div className="space-y-1">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide flex items-center gap-1">
          <Package className="w-3 h-3" /> Productos ({sub.productos.length})
        </p>
        {sub.productos.map((prod, pIdx) => (
          <div key={pIdx} className="flex items-center justify-between text-xs">
            <span className="text-slate-700 truncate flex-1 mr-2">{prod.nombreComercial}</span>
            <span className="text-slate-500 tabular-nums shrink-0">
              {prod.cantidad}u · ${prod.costoUnitario.toFixed(2)}/ud
            </span>
          </div>
        ))}
      </div>

      {/* Costos */}
      {(sub.descuentoUSD || sub.shippingUSD || sub.impuestoUSD) ? (
        <div className="flex gap-3 text-[10px] tabular-nums">
          {(sub.descuentoUSD || 0) > 0 && <span className="text-red-500">Desc: -${sub.descuentoUSD!.toFixed(2)}</span>}
          {(sub.shippingUSD || 0) > 0 && <span className="text-sky-600">Ship: +${sub.shippingUSD!.toFixed(2)}</span>}
          {(sub.impuestoUSD || 0) > 0 && <span className="text-amber-600">Tax: +${sub.impuestoUSD!.toFixed(2)}</span>}
        </div>
      ) : null}

      {/* Acción */}
      <AccionContextual
        estado={estado}
        pagado={pagado}
        loading={loading}
        onMarcarEnTransito={onMarcarEnTransito ? () => onMarcarEnTransito(sub.id) : undefined}
        onRecibirProductos={onRecibirProductos ? () => onRecibirProductos(sub.id) : undefined}
        onRegistrarPago={onRegistrarPago ? () => onRegistrarPago(sub.id) : undefined}
      />
    </div>
  );
};
