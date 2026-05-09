/**
 * UnidadDetailsModal · canon F6 pixel-perfect mockup X (chk4.16)
 *
 * Estructura del mockup stock-canon-s3.6-X.html (líneas 1029-1170):
 *   1. Header gradient soft (canon F1):
 *      · Avatar coloreado por línea (ProductoAvatar w-12)
 *      · Mini-breadcrumb (SKU · Marca · Estado badge)
 *      · h2 nombre del producto
 *      · Subtítulo: Recepción + fecha + envío + vencimiento
 *      · Botón Editar + X cerrar
 *      · KPIs row 4-col (Costo · Casilla · OC · Recibida)
 *   2. Tabs sticky (canon F5/F6):
 *      · Resumen · Movimientos (count) · Costos
 *   3. Body con tab activo:
 *      · Resumen: Información producto + Trazabilidad + banner promoción + CTRU
 *      · Movimientos: lista cronológica con timeline
 *      · Costos: breakdown CTRU
 *   4. Footer: botón Cerrar
 */

import React, { useState } from 'react';
import {
  Info, Route, DollarSign, X, Edit2, AlertTriangle, Unlock, ShoppingCart,
} from 'lucide-react';
import { formatFecha, calcularDiasParaVencer } from '../../../../utils/dateFormatters';
import { formatCurrency } from '../../../../utils/format';
import { Badge, Button } from '../../../../components/common';
import { useUserName } from '../../../../hooks/useUserNames';
import { useLineaNegocioStore } from '../../../../store/lineaNegocioStore';
import type { LineaNegocio } from '../../../../types/lineaNegocio.types';
import type { Unidad, EstadoUnidad } from '../../../../types/unidad.types';
import {
  getLabelEstadoUnidad, esEstadoEnOrigen, esEstadoEnTransitoOrigen, getPaisEmoji,
} from '../../../../utils/multiOrigen.helpers';
import { getDescripcionProducto } from '../../../../utils/producto.helpers';
import { ProductoAvatar } from '../shell/ProductoAvatar';

interface UnidadDetailsModalProps {
  unidad: Unidad;
  productoInfo?: { presentacion?: string; contenido?: string; dosaje?: string; sabor?: string; atributosSkincare?: any };
  onClose: () => void;
  onLiberarReserva?: (unidad: Unidad) => void;
  onCrearPromocion?: (unidad: Unidad) => void;
  onEditar?: (unidad: Unidad) => void;
}

type TabUnidad = 'resumen' | 'movimientos' | 'costos';

const getEstadoVariant = (estado: EstadoUnidad): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  if (esEstadoEnOrigen(estado)) return 'success';
  if (esEstadoEnTransitoOrigen(estado)) return 'info';
  switch (estado) {
    case 'en_transito_peru': return 'info';
    case 'disponible_peru': return 'success';
    case 'reservada':
    case 'asignada_pedido': return 'warning';
    case 'vendida': return 'default';
    case 'vencida':
    case 'danada': return 'danger';
    default: return 'default';
  }
};

const TIPO_MOVIMIENTO_LABELS: Record<string, { label: string; color: string }> = {
  recepcion: { label: 'Recepción', color: 'bg-emerald-500' },
  transferencia: { label: 'Transferencia', color: 'bg-sky-500' },
  reserva: { label: 'Reserva', color: 'bg-purple-500' },
  venta: { label: 'Venta', color: 'bg-teal-500' },
  ajuste: { label: 'Ajuste', color: 'bg-slate-500' },
  vencimiento: { label: 'Vencimiento', color: 'bg-rose-500' },
  daño: { label: 'Daño', color: 'bg-rose-500' },
};

export const UnidadDetailsModal: React.FC<UnidadDetailsModalProps> = ({
  unidad,
  productoInfo,
  onClose,
  onLiberarReserva,
  onCrearPromocion,
  onEditar,
}) => {
  const [tab, setTab] = useState<TabUnidad>('resumen');

  const lineas = useLineaNegocioStore(state => state.lineas);
  const linea = lineas.find(ln => ln.id === unidad.lineaNegocioId) ?? null;

  const creadoPorNombre = useUserName(unidad.creadoPor);
  const actualizadoPorNombre = useUserName(unidad.actualizadoPor);

  const diasParaVencer = calcularDiasParaVencer(unidad.fechaVencimiento) ?? 999;
  const estadoLabel = getLabelEstadoUnidad(unidad.estado, unidad.paisOrigen || unidad.pais);
  const estadoVariant = getEstadoVariant(unidad.estado);
  const venceProximo = diasParaVencer <= 30 && diasParaVencer >= 0 && unidad.estado !== 'vendida';
  const vencido = diasParaVencer < 0;

  const descripcion = productoInfo ? getDescripcionProducto(productoInfo) : '';

  // Texto subtítulo del header (canon mockup X)
  const subtituloHeader = (
    <>
      Recepción <span className="font-mono">{unidad.lote || '-'}</span>
      {unidad.fechaRecepcion && (
        <span className="text-slate-500 font-normal"> · {formatFecha(unidad.fechaRecepcion)}</span>
      )}
      {unidad.envioNumero && (
        <span className="text-slate-500 font-normal"> · {unidad.envioNumero}</span>
      )}
      {venceProximo && (
        <span className="text-amber-700 font-bold"> · Vence en {diasParaVencer} días</span>
      )}
      {vencido && (
        <span className="text-rose-700 font-bold"> · Vencido hace {Math.abs(diasParaVencer)} días</span>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden w-full max-w-3xl my-8 flex flex-col max-h-[90vh]">
        {/* Header gradient soft (canon F1) */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-5 py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <ProductoAvatar linea={linea} size="md" />
              <div className="min-w-0 flex-1">
                {/* Mini-breadcrumb */}
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1 flex-wrap">
                  <span className="font-mono">{unidad.productoSKU || '-'}</span>
                  {unidad.productoNombre && (
                    <>
                      <span>·</span>
                      <span className="truncate max-w-[200px]">{unidad.productoNombre}</span>
                    </>
                  )}
                  <span>·</span>
                  <Badge variant={estadoVariant} size="sm">{estadoLabel}</Badge>
                </div>
                {/* h2 nombre del producto */}
                <h2 className="text-base lg:text-xl font-bold text-slate-900 leading-tight truncate">
                  {unidad.productoNombre || 'Producto sin nombre'}
                </h2>
                {/* Subtítulo: recepción + fecha + envío + vencimiento */}
                <p className="text-xs lg:text-sm text-slate-700 font-medium mt-0.5">
                  {subtituloHeader}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onEditar && (
                <button
                  type="button"
                  onClick={() => onEditar(unidad)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* KPIs row 4-col */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Costo unitario</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">
                {formatCurrency(unidad.costoUnitarioUSD || 0, 'USD')}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Casilla actual</div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
                {getPaisEmoji(unidad.pais)} {unidad.almacenNombre || '-'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">OC origen</div>
              <div className="text-sm font-mono text-slate-900 mt-0.5 truncate">
                {unidad.ordenCompraNumero || '-'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Recibida</div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                {unidad.fechaRecepcion ? formatFecha(unidad.fechaRecepcion) : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs sticky */}
        <div className="border-b border-slate-200 bg-white sticky top-0 z-10 px-5 flex-shrink-0">
          <div className="flex items-center gap-1 -mb-px">
            <TabButton
              active={tab === 'resumen'}
              onClick={() => setTab('resumen')}
              icon={Info}
              label="Resumen"
            />
            <TabButton
              active={tab === 'movimientos'}
              onClick={() => setTab('movimientos')}
              icon={Route}
              label="Movimientos"
              count={unidad.movimientos?.length}
            />
            <TabButton
              active={tab === 'costos'}
              onClick={() => setTab('costos')}
              icon={DollarSign}
              label="Costos"
            />
          </div>
        </div>

        {/* Body scroll · ocupa el espacio disponible */}
        <div className="p-5 overflow-y-auto flex-1">
          {tab === 'resumen' && (
            <ResumenTab
              unidad={unidad}
              productoInfo={productoInfo}
              descripcion={descripcion}
              linea={linea}
              venceProximo={venceProximo}
              vencido={vencido}
              diasParaVencer={diasParaVencer}
              onCrearPromocion={onCrearPromocion}
              onLiberarReserva={onLiberarReserva}
            />
          )}

          {tab === 'movimientos' && <MovimientosTab unidad={unidad} />}

          {tab === 'costos' && <CostosTab unidad={unidad} />}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-2 bg-slate-50/50 flex-shrink-0">
          <div className="text-[10px] text-slate-400">
            Creado {formatFecha(unidad.fechaCreacion)} · {creadoPorNombre}
            {unidad.fechaActualizacion && (
              <> · Actualizado {formatFecha(unidad.fechaActualizacion)} · {actualizadoPorNombre}</>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count?: number;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon: Icon, label, count }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 border-b-2 font-medium text-xs transition-colors ${
      active
        ? 'border-teal-600 text-teal-700 font-semibold'
        : 'border-transparent text-slate-600 hover:text-slate-900'
    }`}
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
    {typeof count === 'number' && count > 0 && (
      <span className="text-[10px] text-slate-400 tabular-nums">{count}</span>
    )}
  </button>
);

// ─── Tab Resumen ─────────────────────────────────────────────────────────────

interface ResumenTabProps {
  unidad: Unidad;
  productoInfo?: { presentacion?: string; contenido?: string; dosaje?: string; sabor?: string; atributosSkincare?: any };
  descripcion: string;
  linea: LineaNegocio | null;
  venceProximo: boolean;
  vencido: boolean;
  diasParaVencer: number;
  onCrearPromocion?: (unidad: Unidad) => void;
  onLiberarReserva?: (unidad: Unidad) => void;
}

const ResumenTab: React.FC<ResumenTabProps> = ({
  unidad, productoInfo, descripcion, linea,
  venceProximo, vencido, diasParaVencer,
  onCrearPromocion, onLiberarReserva,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Información del producto</div>
          <div className="space-y-1.5 text-xs">
            <Row label="Línea" value={linea?.nombre || '-'} />
            {descripcion && <Row label="Descripción" value={descripcion} />}
            {productoInfo?.presentacion && <Row label="Presentación" value={productoInfo.presentacion} />}
            {productoInfo?.contenido && <Row label="Contenido" value={productoInfo.contenido} />}
            {productoInfo?.dosaje && <Row label="Dosaje" value={productoInfo.dosaje} />}
            {productoInfo?.sabor && <Row label="Sabor" value={productoInfo.sabor} />}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Trazabilidad</div>
          <div className="space-y-1.5 text-xs">
            <Row label="Lote" value={<span className="font-mono">{unidad.lote || '-'}</span>} />
            {unidad.fechaRecepcion && <Row label="Fecha llegada" value={formatFecha(unidad.fechaRecepcion)} />}
            {unidad.fechaVencimiento && (
              <Row
                label="Vencimiento"
                value={
                  <span className={vencido ? 'text-rose-700 font-bold' : venceProximo ? 'text-amber-700 font-bold' : 'text-slate-900'}>
                    {formatFecha(unidad.fechaVencimiento)}
                  </span>
                }
              />
            )}
            {unidad.paisOrigen && (
              <Row label="País origen" value={`${getPaisEmoji(unidad.paisOrigen)} ${unidad.paisOrigen}`} />
            )}
            {unidad.envioNumero && (
              <Row label="Envío" value={<span className="font-mono text-sky-600">{unidad.envioNumero}</span>} />
            )}
            {unidad.ordenCompraNumero && (
              <Row label="OC origen" value={<span className="font-mono">{unidad.ordenCompraNumero}</span>} />
            )}
          </div>
        </div>
      </div>

      {/* Banner vencimiento próximo + CTA */}
      {venceProximo && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2.5 flex-wrap">
          <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <div className="flex-1 text-xs text-amber-900 min-w-0">
            <strong>Vencimiento próximo · {diasParaVencer} días</strong>
            <span className="text-amber-700 ml-1">· considerar promoción para liquidar antes del vencimiento</span>
          </div>
          {onCrearPromocion && (
            <button
              type="button"
              onClick={() => onCrearPromocion(unidad)}
              className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded transition-colors"
            >
              Crear promoción
            </button>
          )}
        </div>
      )}

      {vencido && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-700 flex-shrink-0" />
          <div className="flex-1 text-xs text-rose-900">
            <strong>Producto vencido</strong>
            <span className="text-rose-700 ml-1">· hace {Math.abs(diasParaVencer)} días · gestionar baja desde tab Atención</span>
          </div>
        </div>
      )}

      {/* Reservada · acción liberar */}
      {unidad.estado === 'reservada' && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center gap-2.5 flex-wrap">
          <ShoppingCart className="w-4 h-4 text-purple-700 flex-shrink-0" />
          <div className="flex-1 text-xs text-purple-900 min-w-0">
            <strong>Unidad reservada</strong>
            {(unidad as any).reservadaPara && (
              <span className="text-purple-700 ml-1">· cotización <span className="font-mono">{(unidad as any).reservadaPara}</span></span>
            )}
            {unidad.fechaReserva && (
              <span className="text-purple-700 ml-1">· desde {formatFecha(unidad.fechaReserva)}</span>
            )}
          </div>
          {onLiberarReserva && (
            <Button variant="warning" size="sm" onClick={() => onLiberarReserva(unidad)}>
              <Unlock className="w-3.5 h-3.5 mr-1" />
              Liberar
            </Button>
          )}
        </div>
      )}

      {/* Venta (si aplica) */}
      {unidad.ventaId && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-4 h-4 text-emerald-700" />
            <strong className="text-emerald-900">Venta registrada</strong>
          </div>
          <div className="text-emerald-800 space-y-0.5">
            <div>Número: <span className="font-mono">{unidad.ventaNumero}</span></div>
            {unidad.precioVentaPEN !== undefined && (
              <div>Precio: <span className="font-bold tabular-nums">{formatCurrency(unidad.precioVentaPEN, 'PEN')}</span></div>
            )}
            {unidad.fechaVenta && <div>Fecha: {formatFecha(unidad.fechaVenta)}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-slate-500 flex-shrink-0">{label}</span>
    <span className="text-slate-900 font-medium text-right truncate">{value}</span>
  </div>
);

// ─── Tab Movimientos ─────────────────────────────────────────────────────────

const MovimientosTab: React.FC<{ unidad: Unidad }> = ({ unidad }) => {
  if (!unidad.movimientos || unidad.movimientos.length === 0) {
    return (
      <div className="text-center py-12 text-xs text-slate-500">
        <Route className="mx-auto w-8 h-8 text-slate-300 mb-2" />
        Sin movimientos registrados
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {unidad.movimientos.map((mov, idx) => {
        const tipoInfo = TIPO_MOVIMIENTO_LABELS[mov.tipo] || { label: mov.tipo, color: 'bg-slate-500' };
        return (
          <div key={mov.id || idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${tipoInfo.color}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-xs font-medium text-slate-900">{tipoInfo.label}</span>
                <span className="text-[10px] text-slate-500 tabular-nums">{formatFecha(mov.fecha)}</span>
              </div>
              {mov.observaciones && (
                <div className="text-xs text-slate-600 mt-1">{mov.observaciones}</div>
              )}
              {mov.documentoRelacionado && (
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  Ref: {mov.documentoRelacionado.numero}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Tab Costos ──────────────────────────────────────────────────────────────

const CostosTab: React.FC<{ unidad: Unidad }> = ({ unidad }) => {
  const costoBase = unidad.costoUnitarioUSD || 0;
  const flete = unidad.costoFleteUSD || 0;
  const ctru = unidad.ctruDinamico;
  const tcPago = unidad.tcPago;

  const totalUSD = costoBase + flete;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Costos del lote</div>
        <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-700">Costo adquisición</span>
            <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(costoBase, 'USD')}</span>
          </div>
          {flete > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-700">+ Flete prorrateado</span>
              <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(flete, 'USD')}</span>
            </div>
          )}
          <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
            <span className="text-[11px] text-slate-700 font-bold">Total USD</span>
            <span className="text-base font-bold text-teal-600 tabular-nums">{formatCurrency(totalUSD, 'USD')}</span>
          </div>
        </div>
      </div>

      {ctru !== undefined && (
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">CTRU final (PEN)</div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-emerald-700">Costo total real unitario</div>
              {tcPago !== undefined && (
                <div className="text-[10px] text-emerald-600 mt-0.5">
                  Tipo de cambio: <span className="font-bold tabular-nums">{tcPago.toFixed(3)}</span>
                </div>
              )}
            </div>
            <div className="text-xl font-bold text-emerald-700 tabular-nums">
              {formatCurrency(ctru, 'PEN')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
