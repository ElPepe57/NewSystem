import React, { useState } from 'react';
import {
  Eye,
  DollarSign,
  Truck,
  Layers,
  ChevronDown,
  ChevronRight,
  Info,
  ExternalLink,
} from 'lucide-react';
import { cn, StatusBadge, formatFechaRelativa } from '../../../design-system';
import type {
  OrdenCompra,
  EstadoOrden,
  SubOrdenCompra,
} from '../../../types/ordenCompra.types';
import { calcularEstadoDerivadoOC } from '../../../utils/ordenCompra.helpers';
import type { Envio } from '../../../types/envio.types';

// ════════════════════════════════════════════════════════════════════════════
// CompraCard — card moderna de OC (S41 rework, alineada al mockup de sub-órdenes)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Comportamiento fiel al mockup `rework-subordenes-s41.html` Flujo 1:
 *
 *   OC sin sub-órdenes: card compacta 5-col (Proveedor / Productos / Pipeline dots
 *     4-etapas / Envío / Fecha)
 *
 *   OC con sub-órdenes:
 *     - Header OC con pills (Estado / Pago / Chip X sub-órdenes) + Total USD
 *     - Grid 5-col (Proveedor / Productos / Ruta / Deudor / Fecha)
 *     - Sección "DESGLOSE DEL PROVEEDOR" con sub-órdenes anidadas
 *     - Cada sub-orden como SubOrdenExpandible (colapsada por default)
 *     - Footer con acciones globales + ayuda contextual
 */

interface CompraCardProps {
  orden: OrdenCompra;
  enviosAsociados?: Envio[];
  onView: () => void;
  onRegistrarPago?: () => void;
  onRegistrarPagoSubOrden?: (subOrdenId: string) => void;
  onVerSubOrden?: (subOrdenId: string) => void;
  onVerEnvios?: () => void;
  onVerEnvio?: (envioId: string) => void;
  className?: string;
}

// ─── Main export ────────────────────────────────────────────────────────────

export const CompraCard: React.FC<CompraCardProps> = ({
  orden,
  enviosAsociados = [],
  onView,
  onRegistrarPago,
  onRegistrarPagoSubOrden,
  onVerSubOrden,
  onVerEnvios,
  onVerEnvio,
  className,
}) => {
  const tieneSubOrdenes = (orden.subOrdenes?.length ?? 0) > 0;

  if (!tieneSubOrdenes) {
    return (
      <CompraCardSimple
        orden={orden}
        enviosAsociados={enviosAsociados}
        onView={onView}
        onRegistrarPago={onRegistrarPago}
        onVerEnvios={onVerEnvios}
        className={className}
      />
    );
  }

  return (
    <CompraCardConSubOrdenes
      orden={orden}
      enviosAsociados={enviosAsociados}
      onView={onView}
      onRegistrarPago={onRegistrarPago}
      onRegistrarPagoSubOrden={onRegistrarPagoSubOrden}
      onVerSubOrden={onVerSubOrden}
      onVerEnvio={onVerEnvio}
      className={className}
    />
  );
};

// ════════════════════════════════════════════════════════════════════════════
// CompraCardSimple — OC sin sub-órdenes (mockup: card 5-col con pipeline dots)
// ════════════════════════════════════════════════════════════════════════════

const CompraCardSimple: React.FC<{
  orden: OrdenCompra;
  enviosAsociados: Envio[];
  onView: () => void;
  onRegistrarPago?: () => void;
  onVerEnvios?: () => void;
  className?: string;
}> = ({ orden, enviosAsociados, onView, onRegistrarPago, onVerEnvios, className }) => {
  const estadoDerivado = calcularEstadoDerivadoOC(
    orden.subOrdenes ?? [],
    orden.estado
  );
  const estadoPago = orden.estadoPago;
  const totalPagado = (orden.historialPagos ?? []).reduce(
    (s, p) => s + (p.montoUSD || 0),
    0
  );
  const saldoPendiente = Math.max(0, orden.totalUSD - totalPagado);
  const envioPrincipal = enviosAsociados[0];

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-teal-300 transition-all cursor-pointer',
        className
      )}
      onClick={onView}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-lg font-semibold text-slate-800 font-mono">
            {orden.numeroOrden}
          </span>
          <EstadoOCPill estado={estadoDerivado} />
          <EstadoPagoPill estado={estadoPago} />
          <span className="text-xs text-slate-400">· Sin sub-órdenes</span>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-slate-400">Total USD</div>
          <div className="text-lg font-semibold text-slate-800 tabular-nums">
            ${orden.totalUSD.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Grid 5-col */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
        <div>
          <div className="text-slate-400 mb-1">Proveedor</div>
          <div className="font-medium text-slate-700 flex items-center gap-1">
            <span>{getFlag(orden.paisOrigen)}</span>
            <span className="truncate">{orden.nombreProveedor}</span>
          </div>
        </div>
        <div>
          <div className="text-slate-400 mb-1">Productos</div>
          <div className="font-medium text-slate-700 truncate">
            {resumenProductos(orden)}
          </div>
        </div>
        <div>
          <div className="text-slate-400 mb-1">Pipeline</div>
          <PipelineDots4 estado={estadoDerivado} />
        </div>
        <div>
          <div className="text-slate-400 mb-1">Envío</div>
          <div className="font-medium text-slate-700 font-mono truncate">
            {envioPrincipal?.numeroEnvio ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-slate-400 mb-1">Fecha</div>
          <div className="font-medium text-slate-700">
            {formatFechaRelativa(orden.fechaCreacion as any)}
          </div>
        </div>
      </div>

      {/* Acciones (inline, solo si aplican) */}
      {(onRegistrarPago || onVerEnvios) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          {onRegistrarPago && estadoPago !== 'pagado' && (
            <ActionButton
              icon={<DollarSign className="w-4 h-4" />}
              label="Pago"
              onClick={(e) => {
                e.stopPropagation();
                onRegistrarPago();
              }}
              variant="emerald"
            />
          )}
          {onVerEnvios && enviosAsociados.length > 0 && (
            <ActionButton
              icon={<Truck className="w-4 h-4" />}
              label={`Envíos (${enviosAsociados.length})`}
              onClick={(e) => {
                e.stopPropagation();
                onVerEnvios();
              }}
              variant="sky"
            />
          )}
          {saldoPendiente > 0 && (
            <span className="ml-2 text-xs text-amber-700 tabular-nums">
              ${saldoPendiente.toFixed(2)} pendiente
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// CompraCardConSubOrdenes — OC con sub-órdenes anidadas (mockup S41 Flujo 1)
// ════════════════════════════════════════════════════════════════════════════

const CompraCardConSubOrdenes: React.FC<{
  orden: OrdenCompra;
  enviosAsociados: Envio[];
  onView: () => void;
  onRegistrarPago?: () => void;
  onRegistrarPagoSubOrden?: (subOrdenId: string) => void;
  onVerSubOrden?: (subOrdenId: string) => void;
  onVerEnvio?: (envioId: string) => void;
  className?: string;
}> = ({
  orden,
  enviosAsociados,
  onView,
  onRegistrarPago,
  onRegistrarPagoSubOrden,
  onVerSubOrden,
  onVerEnvio,
  className,
}) => {
  const subOrdenes = orden.subOrdenes ?? [];
  const estadoDerivado = calcularEstadoDerivadoOC(subOrdenes, orden.estado);
  const estadoPago = orden.estadoPago;
  const deudorNombre =
    orden.deudorTipo === 'colaborador' && orden.deudorNombre
      ? `${orden.deudorNombre} (colaborador)`
      : orden.nombreProveedor;

  // Mapa envioId → envío para lookup en sub-órdenes
  const envioPorId = new Map<string, Envio>();
  enviosAsociados.forEach((e) => envioPorId.set(e.id, e));

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-slate-200 shadow-sm',
        className
      )}
    >
      {/* ═══ Header OC padre ═══ */}
      <div className="p-5 border-b border-slate-100 cursor-pointer hover:bg-slate-50/40 transition-colors" onClick={onView}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-lg font-semibold text-slate-800 font-mono">
              {orden.numeroOrden}
            </span>
            <EstadoOCPill estado={estadoDerivado} />
            <EstadoPagoPill estado={estadoPago} />
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5">
              <Layers className="w-2.5 h-2.5" />
              {subOrdenes.length} sub-órdenes
            </span>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-slate-400">Total USD</div>
            <div className="text-lg font-semibold text-slate-800 tabular-nums">
              ${orden.totalUSD.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Grid 5-col con Ruta + Deudor */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <div className="text-slate-400 mb-1">Proveedor</div>
            <div className="font-medium text-slate-700 flex items-center gap-1">
              <span>{getFlag(orden.paisOrigen)}</span>
              <span className="truncate">{orden.nombreProveedor}</span>
            </div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Productos</div>
            <div className="font-medium text-slate-700 truncate">
              {resumenProductos(orden)}
            </div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Ruta</div>
            <div className="font-medium text-slate-700 text-[11px]">
              {getFlag(orden.paisOrigen)} →{' '}
              {orden.nombreAlmacenDestino?.slice(0, 10) || 'Casilla'} → 🇵🇪
            </div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Deudor</div>
            <div
              className={cn(
                'font-medium truncate',
                orden.deudorTipo === 'colaborador'
                  ? 'text-amber-700'
                  : 'text-slate-700'
              )}
            >
              {deudorNombre}
            </div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Fecha</div>
            <div className="font-medium text-slate-700">
              {formatFechaRelativa(orden.fechaCreacion as any)}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Sección DESGLOSE DEL PROVEEDOR ═══ */}
      <div className="px-5 py-4 bg-slate-50">
        <div className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-2 tracking-wide">
          <Layers className="w-3 h-3" />
          DESGLOSE DEL PROVEEDOR ({subOrdenes.length}{' '}
          SUB-{subOrdenes.length === 1 ? 'ORDEN' : 'ÓRDENES'})
        </div>

        <div className="space-y-2">
          {subOrdenes.map((sub, idx) => (
            <SubOrdenExpandible
              key={sub.id || `sub-${idx}`}
              subOrden={sub}
              envio={sub.envioId ? envioPorId.get(sub.envioId) : undefined}
              onRegistrarPago={
                onRegistrarPagoSubOrden
                  ? () => onRegistrarPagoSubOrden(sub.id)
                  : undefined
              }
              onVerEnvio={
                onVerEnvio && sub.envioId ? () => onVerEnvio(sub.envioId!) : undefined
              }
              onVerDetalle={
                onVerSubOrden ? () => onVerSubOrden(sub.id) : undefined
              }
            />
          ))}
        </div>
      </div>

      {/* ═══ Footer OC con acciones globales ═══ */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 rounded-b-2xl">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <Info className="w-3 h-3" />
          Cada sub-orden tiene su ciclo de vida independiente. La OC padre refleja el
          agregado.
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Ver detalle completo
          </button>
          {onRegistrarPago && estadoPago !== 'pagado' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRegistrarPago();
              }}
              className="px-3 py-1.5 text-xs font-medium text-teal-700 border border-teal-300 rounded-lg hover:bg-teal-50"
            >
              Registrar pago OC completa
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SubOrdenExpandible — cada sub-orden como card colapsable (mockup Flujo 1)
// ════════════════════════════════════════════════════════════════════════════

const SubOrdenExpandible: React.FC<{
  subOrden: SubOrdenCompra;
  envio?: Envio;
  onRegistrarPago?: () => void;
  onVerEnvio?: () => void;
  onVerDetalle?: () => void;
}> = ({ subOrden, envio, onRegistrarPago, onVerEnvio, onVerDetalle }) => {
  const [expandido, setExpandido] = useState(false);
  const estado = subOrden.estado ?? 'borrador';
  const estadoPago = subOrden.estadoPago ?? 'pendiente';
  const productosResumen = subOrden.productos
    .map((p) => `${p.nombreComercial} (x${p.cantidad})`)
    .join(' · ');
  const totalCargos =
    (subOrden.shippingUSD ?? 0) +
    (subOrden.impuestoUSD ?? 0) -
    (subOrden.descuentoUSD ?? 0);

  return (
    <div
      className={cn(
        'bg-white rounded-xl border transition-all',
        expandido
          ? 'border-teal-300 shadow-sm'
          : 'border-slate-200 hover:shadow-sm hover:border-teal-300'
      )}
    >
      {/* Header sub-orden (siempre visible) */}
      <button
        type="button"
        onClick={() => setExpandido(!expandido)}
        className="w-full p-3 flex items-center justify-between text-left gap-3"
      >
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          {expandido ? (
            <ChevronDown className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-slate-700 font-mono">
            {subOrden.id}
          </span>
          {subOrden.envioNumero && (
            <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
              → {subOrden.envioNumero}
            </span>
          )}

          {/* Mini-pipeline 3 dots */}
          <PipelineDots3 estado={estado} className="ml-2" />

          <EstadoSubOrdenPill estado={estado} />
          <EstadoPagoSubPill estado={estadoPago} />
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right hidden md:block">
            <div className="text-[10px] text-slate-400">Productos</div>
            <div className="text-xs font-medium text-slate-600 truncate max-w-[14rem]">
              {productosResumen || '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400">Total</div>
            <div className="text-sm font-semibold text-slate-800 tabular-nums">
              ${subOrden.totalUSD.toFixed(2)}
            </div>
          </div>
        </div>
      </button>

      {/* Contenido expandido */}
      {expandido && (
        <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-3">
          {/* Grid 2-col: Productos + Cargos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Productos */}
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 mb-2 tracking-wide">
                PRODUCTOS
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {subOrden.productos.map((p, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-1.5 truncate">{p.nombreComercial}</td>
                      <td className="py-1.5 text-right text-slate-500 tabular-nums">
                        ×{p.cantidad}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        ${(p.costoUnitario || 0).toFixed(2)}
                      </td>
                      <td className="py-1.5 text-right font-medium tabular-nums">
                        ${((p.cantidad || 0) * (p.costoUnitario || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200">
                    <td colSpan={3} className="py-1.5 text-xs text-slate-500">
                      Subtotal productos
                    </td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">
                      ${(subOrden.subtotalProductosUSD ?? subOrden.totalUSD - totalCargos).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Cargos del proveedor */}
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 mb-2 tracking-wide">
                CARGOS DEL PROVEEDOR{' '}
                <span className="font-normal text-slate-400">
                  (asignados al confirmar)
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                {(subOrden.shippingUSD ?? 0) > 0 && (
                  <CargoRow
                    label="+ Shipping"
                    value={`$${(subOrden.shippingUSD ?? 0).toFixed(2)}`}
                  />
                )}
                {(subOrden.descuentoUSD ?? 0) > 0 && (
                  <CargoRow
                    label="− Descuento"
                    value={`-$${(subOrden.descuentoUSD ?? 0).toFixed(2)}`}
                    accent="success"
                  />
                )}
                {(subOrden.impuestoUSD ?? 0) > 0 && (
                  <CargoRow
                    label="+ Impuestos"
                    value={`$${(subOrden.impuestoUSD ?? 0).toFixed(2)}`}
                  />
                )}
                {totalCargos === 0 && (
                  <div className="text-slate-400 italic text-center py-2">
                    Sin cargos adicionales
                  </div>
                )}
                {totalCargos !== 0 && (
                  <div className="flex items-center justify-between py-2 border-t-2 border-slate-200 mt-2">
                    <span className="font-semibold">Cargos netos</span>
                    <span className="font-semibold tabular-nums">
                      ${totalCargos.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Total + acciones */}
          <div className="flex items-center justify-between bg-teal-50 rounded-lg p-3 flex-wrap gap-2">
            <div>
              <div className="text-xs text-teal-700 font-medium">
                Total sub-orden:{' '}
                <span className="text-slate-800 tabular-nums">
                  ${subOrden.totalUSD.toFixed(2)}
                </span>
              </div>
              {subOrden.referenciaProveedor && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Referencia proveedor: {subOrden.referenciaProveedor}
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {onVerDetalle && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerDetalle();
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"
                >
                  Ver detalle completo
                </button>
              )}
              {onVerEnvio && subOrden.envioId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerEnvio();
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-teal-700 border border-teal-300 rounded-lg hover:bg-teal-50 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  Ver envío
                </button>
              )}
              {onRegistrarPago && estadoPago !== 'pagado' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRegistrarPago();
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                >
                  Registrar pago
                </button>
              )}
            </div>
          </div>

          {/* Tracking del envío (si existe) */}
          {envio && (
            <div className="flex items-center gap-4 bg-white rounded-lg p-2.5 border border-slate-200 text-xs flex-wrap">
              {envio.courier && (
                <div className="flex items-center gap-1.5">
                  <Truck className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-500">Courier:</span>
                  <span className="font-medium text-slate-700">{envio.courier}</span>
                </div>
              )}
              {envio.numeroTracking && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Tracking:</span>
                  <span className="font-mono text-teal-700">{envio.numeroTracking}</span>
                </div>
              )}
              {envio.fechaSalida && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-slate-500">Despachado:</span>
                  <span className="font-medium text-slate-700">
                    {formatFechaRelativa(envio.fechaSalida as any)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Sub-components de presentación
// ════════════════════════════════════════════════════════════════════════════

const EstadoOCPill: React.FC<{ estado: EstadoOrden | string }> = ({ estado }) => {
  const conf: Record<string, { variant: 'neutral' | 'info' | 'warning' | 'success' | 'danger'; label: string }> = {
    borrador: { variant: 'neutral', label: 'Borrador' },
    enviada: { variant: 'info', label: 'Confirmada' },
    pagada: { variant: 'info', label: 'Confirmada' },
    en_transito: { variant: 'warning', label: 'En Despacho' },
    recibida_parcial: { variant: 'warning', label: 'En Despacho' },
    en_proceso: { variant: 'warning', label: 'En Despacho' },
    despachada: { variant: 'warning', label: 'En Despacho' },
    recibida: { variant: 'success', label: 'Completada' },
    completada: { variant: 'success', label: 'Completada' },
    cancelada: { variant: 'danger', label: 'Cancelada' },
  };
  const c = conf[estado] ?? { variant: 'neutral' as const, label: estado };
  return (
    <StatusBadge variant={c.variant} size="sm" dot>
      {c.label}
    </StatusBadge>
  );
};

const EstadoPagoPill: React.FC<{ estado: string }> = ({ estado }) => {
  if (estado === 'pagado')
    return <StatusBadge variant="success" size="sm">Pagado</StatusBadge>;
  if (estado === 'parcial')
    return <StatusBadge variant="info" size="sm">Pago Parcial</StatusBadge>;
  return <StatusBadge variant="warning" size="sm">Pendiente</StatusBadge>;
};

const EstadoSubOrdenPill: React.FC<{ estado: string }> = ({ estado }) => {
  const conf: Record<string, { variant: 'neutral' | 'info' | 'success'; label: string }> = {
    borrador: { variant: 'neutral', label: 'Confirmada' }, // S41: borrador se muestra como confirmada (decisión D-127)
    en_transito: { variant: 'info', label: 'En Tránsito' },
    recibida: { variant: 'success', label: 'Recibida' },
  };
  const c = conf[estado] ?? { variant: 'neutral' as const, label: estado };
  return (
    <StatusBadge variant={c.variant} size="sm">
      {c.label}
    </StatusBadge>
  );
};

const EstadoPagoSubPill: React.FC<{ estado: string }> = ({ estado }) => {
  if (estado === 'pagado')
    return <StatusBadge variant="success" size="sm">Pagada</StatusBadge>;
  if (estado === 'parcial')
    return <StatusBadge variant="info" size="sm">Pago parcial</StatusBadge>;
  return <StatusBadge variant="warning" size="sm">Pago pendiente</StatusBadge>;
};

/** Pipeline visual de 4 dots: Borrador → Confirmada → En Tránsito → Completada */
const PipelineDots4: React.FC<{ estado: string }> = ({ estado }) => {
  const stage = (() => {
    if (estado === 'borrador') return 0;
    if (['enviada', 'pagada', 'confirmada'].includes(estado)) return 1;
    if (
      ['en_transito', 'en_proceso', 'despachada', 'recibida_parcial'].includes(estado)
    )
      return 2;
    if (['recibida', 'completada'].includes(estado)) return 3;
    return 0;
  })();

  return (
    <div className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3].map((i) => {
        const done = i <= stage;
        const active = i === stage;
        return (
          <React.Fragment key={i}>
            <span
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                done && !active && 'bg-emerald-500',
                active && 'bg-teal-600 ring-2 ring-teal-100',
                !done && 'bg-slate-200'
              )}
            />
            {i < 3 && (
              <span
                className={cn(
                  'w-3 h-0.5',
                  i < stage ? 'bg-emerald-500' : 'bg-slate-200'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Pipeline visual de 3 dots para sub-orden: Confirmada → En Tránsito → Recibida */
const PipelineDots3: React.FC<{ estado: string; className?: string }> = ({
  estado,
  className,
}) => {
  const stage = (() => {
    if (estado === 'borrador') return 0;
    if (estado === 'en_transito') return 1;
    if (estado === 'recibida') return 2;
    return 0;
  })();

  return (
    <div className={cn('inline-flex items-center gap-0.5', className)}>
      {[0, 1, 2].map((i) => {
        const done = i < stage;
        const active = i === stage;
        return (
          <React.Fragment key={i}>
            <span
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                done && 'bg-emerald-500',
                active && stage === 2 && 'bg-emerald-500',
                active && stage !== 2 && 'bg-teal-600 ring-2 ring-teal-100',
                !done && !active && 'bg-slate-200'
              )}
            />
            {i < 2 && (
              <span
                className={cn(
                  'w-3 h-0.5',
                  i < stage ? 'bg-emerald-500' : 'bg-slate-200'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const CargoRow: React.FC<{
  label: string;
  value: string;
  accent?: 'success';
}> = ({ label, value, accent }) => (
  <div className="flex items-center justify-between py-1 border-b border-slate-100 last:border-b-0">
    <span className="text-slate-600">{label}</span>
    <span
      className={cn(
        'font-medium tabular-nums',
        accent === 'success' ? 'text-emerald-600' : 'text-slate-700'
      )}
    >
      {value}
    </span>
  </div>
);

const ActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant: 'teal' | 'emerald' | 'sky';
}> = ({ icon, label, onClick, variant }) => {
  const classes = {
    teal: 'text-teal-700 border-teal-300 hover:bg-teal-50',
    emerald: 'text-emerald-700 border-emerald-300 hover:bg-emerald-50',
    sky: 'text-sky-700 border-sky-300 hover:bg-sky-50',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors',
        classes
      )}
    >
      {icon}
      {label}
    </button>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getFlag(pais?: string): string {
  if (!pais) return '🌐';
  const flags: Record<string, string> = {
    USA: '🇺🇸',
    'Estados Unidos': '🇺🇸',
    CHINA: '🇨🇳',
    China: '🇨🇳',
    COREA: '🇰🇷',
    Corea: '🇰🇷',
    'Corea del Sur': '🇰🇷',
    JAPÓN: '🇯🇵',
    Japón: '🇯🇵',
    MÉXICO: '🇲🇽',
    México: '🇲🇽',
    PERÚ: '🇵🇪',
    Perú: '🇵🇪',
    Peru: '🇵🇪',
  };
  return flags[pais] ?? '🌐';
}

function resumenProductos(orden: OrdenCompra): string {
  const items = orden.productos.slice(0, 3);
  const resumen = items
    .map((p) => `${p.nombreComercial} (x${p.cantidad})`)
    .join(' · ');
  const restantes = orden.productos.length - items.length;
  return restantes > 0 ? `${resumen} · +${restantes} más` : resumen;
}
