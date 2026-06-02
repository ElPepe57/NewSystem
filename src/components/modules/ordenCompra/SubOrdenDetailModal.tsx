import React from 'react';
import {
  X,
  Package,
  DollarSign,
  Truck,
  ExternalLink,
  ArrowLeft,
  Check,
  ChevronRight,
  Edit3,
  CheckCircle2,
} from 'lucide-react';
import { cn, StatusBadge, formatFechaRelativa } from '../../../design-system';
import type {
  OrdenCompra,
  SubOrdenCompra,
} from '../../../types/ordenCompra.types';
import type { Envio } from '../../../types/envio.types';
import { getDescripcionProducto } from '../../../utils/producto.helpers';
// S55 Fase 2 — pagos viven en CC; hook reactivo lee desde movimientosCC
import { usePagosOC } from '../../../hooks/usePagosOC';

// ════════════════════════════════════════════════════════════════════════════
// SubOrdenDetailModal — Detalle standalone de una sub-orden (S41 Flujo 3)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Estructura fiel al mockup `rework-subordenes-s41.html` pane-detalle:
 *
 *   Header enriquecido:
 *     - Breadcrumb OC-XXX › SUB-XXX
 *     - Título "Sub-orden SUB-XXX"
 *     - Pills estado + estado pago (derecha)
 *     - Pipeline horizontal grande 3 estados con fechas
 *
 *   4 KPIs (Total / Productos / Envío vinculado / Pagos)
 *
 *   Secciones:
 *     - Productos (tabla con SKU mono blue + descripción rica)
 *     - Cargos comerciales (desglose + ajuste proveedor + cobrado)
 *     - Envío vinculado (card blue con ruta + courier + tracking + fecha)
 *     - Pagos (ámbar si no hay / lista si hay)
 *
 *   Footer: "← Volver a OC-XXX" | Editar cargos | Marcar recibida
 */

interface SubOrdenDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  orden: OrdenCompra;
  subOrden: SubOrdenCompra;
  envio?: Envio | null; // envío vinculado (se busca desde el store por subOrden.envioId)
  onBackToOC?: () => void;
  onRegistrarPago?: () => void;
  onEditarCargos?: () => void;
  onMarcarRecibida?: () => void;
  onVerEnvio?: () => void;
}

// ─── Main ───────────────────────────────────────────────────────────────────

export const SubOrdenDetailModal: React.FC<SubOrdenDetailModalProps> = ({
  isOpen,
  onClose,
  orden,
  subOrden,
  envio,
  onBackToOC,
  onRegistrarPago,
  onEditarCargos,
  onMarcarRecibida,
  onVerEnvio,
}) => {
  if (!isOpen) return null;

  // ─── Derivados ─────────────────────────────────────────────────────────
  const estado = subOrden.estado ?? 'borrador';
  const estadoPago = subOrden.estadoPago ?? 'pendiente';

  const totalUnidades = subOrden.productos.reduce(
    (s, p) => s + (p.cantidad || 0),
    0
  );
  const totalProductosSKU = subOrden.productos.length;
  const subtotalProductos =
    subOrden.subtotalProductosUSD ??
    subOrden.productos.reduce(
      (s, p) => s + (p.costoUnitario || 0) * (p.cantidad || 0),
      0
    );
  const shipping = subOrden.shippingUSD ?? 0;
  const descuento = subOrden.descuentoUSD ?? 0;
  const impuesto = subOrden.impuestoUSD ?? 0;
  const totalCalculado = subtotalProductos + shipping - descuento + impuesto;
  const ajusteProveedor = subOrden.totalUSD - totalCalculado;
  const tieneAjuste = Math.abs(ajusteProveedor) > 0.01;

  // S55 Fase 2 — Pagos vienen del hook reactivo (CC). Filtramos por sub-orden
  // usando heurística de notas (legacy `subOrdenId` campo + nuevo formato
  // `subOrdenId=X` en notas, ver ordenCompra.pagos.service.ts).
  const { pagos: pagosCC } = usePagosOC(orden.id);
  const totalPagado = pagosCC
    .filter((p) =>
      p.subOrdenId === subOrden.id ||
      (p.notas && p.notas.includes(`subOrdenId=${subOrden.id}`))
    )
    .reduce((s, p) => s + (p.montoUSD || 0), 0);
  const saldoPendiente = Math.max(0, subOrden.totalUSD - totalPagado);
  const deudorNombre =
    orden.deudorTipo === 'colaborador' && orden.deudorNombre
      ? orden.deudorNombre
      : orden.nombreProveedor;

  // ═══ Render ════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        {/* ─── Header enriquecido ─── */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <button
                  type="button"
                  onClick={onBackToOC}
                  className="text-blue-600 hover:underline hover:text-blue-800 cursor-pointer font-mono"
                >
                  {orden.numeroOrden}
                </button>
                <ChevronRight className="w-3 h-3" />
                <span className="font-mono">{subOrden.id}</span>
              </div>
              <div className="text-xl font-semibold text-slate-800">
                Sub-orden {subOrden.id}
              </div>
              {subOrden.referenciaProveedor && (
                <div className="text-xs text-slate-500 mt-1">
                  Ref. proveedor:{' '}
                  <span className="font-mono">{subOrden.referenciaProveedor}</span>
                </div>
              )}
            </div>
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-end gap-1">
                <EstadoSubOrdenPill estado={estado} />
                <EstadoPagoPill estado={estadoPago} />
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 ml-2"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Pipeline horizontal grande 3 estados */}
          <PipelineGrande3
            estado={estado}
            fechaConfirmada={
              orden.fechaCreacion
                ? formatFechaRelativa(orden.fechaCreacion)
                : null
            }
            fechaEnTransito={
              subOrden.fechaEnvio
                ? formatFechaRelativa(subOrden.fechaEnvio)
                : null
            }
            fechaRecibida={
              subOrden.fechaRecepcion
                ? formatFechaRelativa(subOrden.fechaRecepcion)
                : null
            }
          />
        </div>

        {/* ─── 4 KPIs ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-slate-200">
          <KpiCell
            label="Total sub-orden"
            value={`$${subOrden.totalUSD.toFixed(2)}`}
            tone="default"
          />
          <KpiCell
            label="Productos"
            value={`${totalProductosSKU} SKUs · ${totalUnidades} und`}
            tone="default"
          />
          <KpiCell
            label="Envío vinculado"
            value={subOrden.envioNumero ?? '—'}
            tone={subOrden.envioNumero ? 'blue' : 'muted'}
            mono
          />
          <KpiCell
            label="Pagos"
            value={`$${totalPagado.toFixed(2)} / $${subOrden.totalUSD.toFixed(2)}`}
            tone={
              estadoPago === 'pagado'
                ? 'success'
                : totalPagado > 0
                  ? 'warning'
                  : 'danger'
            }
          />
        </div>

        {/* ─── Secciones ─── */}
        <div className="p-6 space-y-5">
          {/* Productos */}
          <section>
            <div className="text-xs font-semibold text-slate-500 mb-2 tracking-wide">
              PRODUCTOS ({subOrden.productos.length})
            </div>
            <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr className="text-slate-600">
                  <th className="text-left p-2 font-semibold">SKU</th>
                  <th className="text-left p-2 font-semibold">Producto</th>
                  <th className="text-right p-2 font-semibold">Cant.</th>
                  <th className="text-right p-2 font-semibold">Precio</th>
                  <th className="text-right p-2 font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {subOrden.productos.map((p, idx) => (
                  <tr
                    key={`${p.productoId}-${idx}`}
                    className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="p-2 font-mono text-blue-600">{p.sku}</td>
                    <td className="p-2">
                      <div className="font-medium">{p.nombreComercial}</div>
                      <div className="text-slate-500">
                        {getDescripcionProducto(p)}
                      </div>
                    </td>
                    <td className="p-2 text-right tabular-nums">{p.cantidad}</td>
                    <td className="p-2 text-right tabular-nums">
                      ${(p.costoUnitario || 0).toFixed(2)}
                    </td>
                    <td className="p-2 text-right font-medium tabular-nums">
                      $
                      {((p.cantidad || 0) * (p.costoUnitario || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Cargos comerciales */}
          <section>
            <div className="text-xs font-semibold text-slate-500 mb-2 tracking-wide">
              CARGOS COMERCIALES{' '}
              <span className="font-normal text-slate-400">
                (asignados por el proveedor a esta sub-orden)
              </span>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 text-xs">
              <CargoDesgloseRow
                label="Subtotal productos"
                value={subtotalProductos}
              />
              {shipping > 0 && (
                <CargoDesgloseRow
                  label="+ Shipping internacional"
                  value={shipping}
                />
              )}
              {descuento > 0 && (
                <CargoDesgloseRow
                  label="− Descuento"
                  value={-descuento}
                  accent="emerald"
                />
              )}
              {impuesto > 0 && (
                <CargoDesgloseRow label="+ Impuestos" value={impuesto} />
              )}

              <div className="flex items-center justify-between pt-2 border-t-2 border-slate-300 mt-2">
                <span className="font-semibold">Total sub-orden</span>
                <span className="font-semibold text-lg text-slate-800 tabular-nums">
                  ${totalCalculado.toFixed(2)}
                </span>
              </div>

              {tieneAjuste && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Ajuste proveedor
                    </span>
                    <span className="font-medium text-slate-600 tabular-nums">
                      {ajusteProveedor > 0 ? '+' : ''}$
                      {ajusteProveedor.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="font-semibold text-blue-700">Cobrado</span>
                    <span className="font-semibold text-blue-700 tabular-nums">
                      ${subOrden.totalUSD.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Envío vinculado */}
          {(envio || subOrden.envioNumero) && (
            <section>
              <div className="text-xs font-semibold text-slate-500 mb-2 tracking-wide">
                ENVÍO VINCULADO
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 font-mono">
                      {subOrden.envioNumero ?? envio?.numeroEnvio}
                    </span>
                    {envio && <EnvioEstadoPill estado={envio.estado} />}
                  </div>
                  {onVerEnvio && (
                    <button
                      type="button"
                      onClick={onVerEnvio}
                      className="text-xs text-blue-700 font-medium hover:underline flex items-center gap-1"
                    >
                      Ver envío <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <InfoItem
                    label="Ruta"
                    value={
                      envio
                        ? `${getFlag(envio.origenProveedorPais)} ${
                            envio.origenProveedorNombre ??
                            envio.origenCasillaNombre ??
                            'Origen'
                          } → ${getFlag(envio.destinoCasillaPais)} ${
                            envio.destinoCasillaNombre ?? 'Destino'
                          }`
                        : `${getFlag(orden.paisOrigen)} → 🇵🇪`
                    }
                  />
                  <InfoItem
                    label="Courier"
                    value={envio?.courier ?? subOrden.courier ?? '—'}
                  />
                  <InfoItem
                    label="Tracking"
                    value={
                      envio?.numeroTracking ?? subOrden.numeroTracking ?? '—'
                    }
                    mono
                  />
                  <InfoItem
                    label="Despachado"
                    value={
                      subOrden.fechaEnvio
                        ? formatFechaRelativa(subOrden.fechaEnvio)
                        : envio?.fechaSalida
                          ? formatFechaRelativa(envio.fechaSalida)
                          : '—'
                    }
                  />
                </div>
              </div>
            </section>
          )}

          {/* Pagos */}
          <section>
            <div className="text-xs font-semibold text-slate-500 mb-2 tracking-wide">
              PAGOS
            </div>
            {estadoPago === 'pagado' ? (
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="text-sm text-emerald-900 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Pagada completamente
                  </div>
                  <div className="text-xs text-emerald-700">
                    ${subOrden.totalUSD.toFixed(2)} · Pagado a: {deudorNombre}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-sm text-amber-900 font-medium">
                    {totalPagado === 0
                      ? 'Sin pagos registrados'
                      : `Pago parcial — $${totalPagado.toFixed(2)} de $${subOrden.totalUSD.toFixed(2)}`}
                  </div>
                  <div className="text-xs text-amber-700">
                    Saldo pendiente:{' '}
                    <span className="font-semibold tabular-nums">
                      ${saldoPendiente.toFixed(2)}
                    </span>{' '}
                    · Deudor: <strong>{deudorNombre}</strong>
                    {orden.deudorTipo === 'colaborador' && (
                      <span className="ml-1 px-1.5 py-0.5 bg-amber-200 text-amber-900 text-[9px] font-semibold rounded uppercase">
                        colaborador
                      </span>
                    )}
                  </div>
                </div>
                {onRegistrarPago && (
                  <button
                    type="button"
                    onClick={onRegistrarPago}
                    className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                  >
                    Registrar pago
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ─── Footer acciones ─── */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
          <button
            type="button"
            onClick={onBackToOC ?? onClose}
            className="text-sm text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a {orden.numeroOrden}
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {onEditarCargos && (
              <button
                type="button"
                onClick={onEditarCargos}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar cargos
              </button>
            )}
            {onMarcarRecibida && estado !== 'recibida' && (
              <button
                type="button"
                onClick={onMarcarRecibida}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Marcar recibida
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Subcomponentes
// ════════════════════════════════════════════════════════════════════════════

const EstadoSubOrdenPill: React.FC<{ estado: string }> = ({ estado }) => {
  const conf: Record<string, { variant: 'neutral' | 'info' | 'success'; label: string }> = {
    borrador: { variant: 'neutral', label: 'Confirmada' },
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

const EstadoPagoPill: React.FC<{ estado: string }> = ({ estado }) => {
  if (estado === 'pagado')
    return (
      <StatusBadge variant="success" size="sm">
        Pagada
      </StatusBadge>
    );
  if (estado === 'parcial')
    return (
      <StatusBadge variant="info" size="sm">
        Pago parcial
      </StatusBadge>
    );
  return (
    <StatusBadge variant="warning" size="sm">
      Pago pendiente
    </StatusBadge>
  );
};

const EnvioEstadoPill: React.FC<{ estado: string }> = ({ estado }) => {
  const conf: Record<string, { variant: 'neutral' | 'info' | 'warning' | 'success' | 'danger'; label: string }> = {
    borrador: { variant: 'neutral', label: 'Borrador' },
    confirmado: { variant: 'warning', label: 'Confirmado' },
    en_transito: { variant: 'info', label: 'En Tránsito' },
    retenida_aduana: { variant: 'danger', label: 'Aduana' },
    recibida_parcial: { variant: 'warning', label: 'Parcial' },
    recibida_completa: { variant: 'success', label: 'Completada' },
    perdida_total: { variant: 'danger', label: 'Perdida' },
    cancelada: { variant: 'danger', label: 'Cancelada' },
  };
  const c = conf[estado] ?? { variant: 'neutral' as const, label: estado };
  return (
    <StatusBadge variant={c.variant} size="sm">
      {c.label}
    </StatusBadge>
  );
};

/**
 * Pipeline horizontal grande 3-estados:
 * Confirmada → En Tránsito → Recibida
 * Cada nodo: círculo grande con ícono + label + fecha debajo
 */
const PipelineGrande3: React.FC<{
  estado: string;
  fechaConfirmada: string | null;
  fechaEnTransito: string | null;
  fechaRecibida: string | null;
}> = ({ estado, fechaConfirmada, fechaEnTransito, fechaRecibida }) => {
  const stage = (() => {
    if (estado === 'borrador') return 0;
    if (estado === 'en_transito') return 1;
    if (estado === 'recibida') return 2;
    return 0;
  })();

  const nodes = [
    { label: 'Confirmada', fecha: fechaConfirmada },
    { label: 'En Tránsito', fecha: fechaEnTransito },
    { label: 'Recibida', fecha: fechaRecibida },
  ];

  return (
    <div className="flex items-center gap-0 pt-2">
      {nodes.map((n, i) => {
        const done = i < stage || (i === stage && i === 2);
        const active = i === stage && i !== 2;
        const pending = i > stage;
        return (
          <React.Fragment key={n.label}>
            <div className="flex-1 flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                    done && 'bg-emerald-500 text-white',
                    active && 'bg-blue-600 text-white ring-4 ring-blue-100',
                    pending && 'bg-slate-200 text-slate-400'
                  )}
                >
                  {done ? '✓' : active ? '●' : '—'}
                </div>
                <div
                  className={cn(
                    'text-xs mt-1',
                    active ? 'font-semibold text-slate-700' : 'text-slate-600',
                    pending && 'text-slate-400'
                  )}
                >
                  {n.label}
                </div>
                <div
                  className={cn(
                    'text-xs',
                    active ? 'text-slate-600' : 'text-slate-400'
                  )}
                >
                  {n.fecha ?? '—'}
                </div>
              </div>
              {i < nodes.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2',
                    i < stage ? 'bg-emerald-500' : 'bg-slate-200'
                  )}
                />
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

const KpiCell: React.FC<{
  label: string;
  value: string;
  tone: 'default' | 'blue' | 'warning' | 'success' | 'muted' | 'danger';
  mono?: boolean;
}> = ({ label, value, tone, mono }) => {
  const toneClass = {
    default: 'text-slate-800',
    blue: 'text-blue-600',
    warning: 'text-amber-600',
    success: 'text-emerald-700',
    muted: 'text-slate-400',
    danger: 'text-red-600',
  }[tone];

  return (
    <div className="p-4 text-center border-r border-slate-100 last:border-r-0">
      <div className="text-xs text-slate-400">{label}</div>
      <div
        className={cn(
          'text-lg font-semibold mt-0.5',
          toneClass,
          mono && 'font-mono text-sm'
        )}
      >
        {value}
      </div>
    </div>
  );
};

const InfoItem: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div>
    <div className="text-slate-500 text-[10px] uppercase tracking-wide">
      {label}
    </div>
    <div
      className={cn(
        'font-medium text-slate-800 truncate',
        mono && 'font-mono text-blue-700'
      )}
    >
      {value}
    </div>
  </div>
);

const CargoDesgloseRow: React.FC<{
  label: string;
  value: number;
  accent?: 'emerald';
}> = ({ label, value, accent }) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-600">{label}</span>
    <span
      className={cn(
        'font-medium tabular-nums',
        accent === 'emerald' ? 'text-emerald-600' : 'text-slate-800'
      )}
    >
      {value < 0 ? '-' : ''}${Math.abs(value).toFixed(2)}
    </span>
  </div>
);

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
