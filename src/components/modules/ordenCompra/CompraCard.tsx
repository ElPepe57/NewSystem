/**
 * CompraCard — adaptador OrdenCompra → HubCard (canon DS · F3 rework Compras 2026-06-18).
 *
 * Reemplaza la card legacy (2 layouts a mano · banderas emoji · avatares de iniciales)
 * por HubCard slot-based (canon L3 · grupo Comercial). Mapea:
 *   - OC simple          → <HubCard> (icono estado · proveedor · ruta · monto · estado · acciones)
 *   - OC con sub-órdenes  → <HubCard subRows> con HubCardSubRow por sub-orden (colapsable)
 *
 * COLOR · la card se tematiza por su ESTADO (semántico): icono + monto monocromáticos
 * en el tono del estado (slate/sky/amber/emerald/rose). Canon "el color del grupo NO
 * pinta datos" → el azul Comercial vive en el chrome del shell, no en la card. El PAGO
 * es otro eje de dato → chip semántico aparte en el meta. SIN emojis (código país + lucide).
 *
 * Pieza histórica S54.x "referencia canónica" · DEROGADA · ahora nace del Hub Kit.
 */
import React from 'react';
import {
  Eye, DollarSign, Truck, Plane, Layers, FileText, Check, CheckCircle2, AlertCircle, Ban,
  type LucideIcon,
} from 'lucide-react';
import { HubCard, HubCardSubRow, formatFechaRelativa } from '../../../design-system';
import type { HubCardColor, StatusVariant } from '../../../design-system';
import type { OrdenCompra, SubOrdenCompra } from '../../../types/ordenCompra.types';
import { calcularEstadoDerivadoOC } from '../../../utils/ordenCompra.helpers';
import type { Envio } from '../../../types/envio.types';

// ════════════════════════════════════════════════════════════════════════════
// Props
// ════════════════════════════════════════════════════════════════════════════

interface CompraCardProps {
  orden: OrdenCompra;
  enviosAsociados?: Envio[];
  onView: () => void;
  onRegistrarPago?: () => void;
  onRegistrarPagoSubOrden?: (subOrdenId: string) => void;
  onVerSubOrden?: (subOrdenId: string) => void;
  onVerEnvios?: () => void;
  onVerEnvio?: (envioId: string) => void;
  /** Selección masiva (BulkActionsToolbar · canon F3). */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  className?: string;
}

// ─── Config de estado derivado → tono semántico + icono + label/variant ───────

const ESTADO_CFG: Record<
  string,
  { color: HubCardColor; icon: LucideIcon; label: string; variant: StatusVariant }
> = {
  borrador: { color: 'slate', icon: FileText, label: 'Borrador', variant: 'neutral' },
  enviada: { color: 'sky', icon: Check, label: 'Confirmada', variant: 'info' },
  pagada: { color: 'sky', icon: Check, label: 'Confirmada', variant: 'info' },
  confirmada: { color: 'sky', icon: Check, label: 'Confirmada', variant: 'info' },
  en_transito: { color: 'amber', icon: Truck, label: 'En Despacho', variant: 'warning' },
  en_proceso: { color: 'amber', icon: Truck, label: 'En Despacho', variant: 'warning' },
  despachada: { color: 'amber', icon: Truck, label: 'En Despacho', variant: 'warning' },
  recibida_parcial: { color: 'amber', icon: AlertCircle, label: 'En Despacho', variant: 'warning' },
  recibida: { color: 'emerald', icon: CheckCircle2, label: 'Completada', variant: 'success' },
  completada: { color: 'emerald', icon: CheckCircle2, label: 'Completada', variant: 'success' },
  cancelada: { color: 'rose', icon: Ban, label: 'Cancelada', variant: 'danger' },
};
const ESTADO_DEFAULT = ESTADO_CFG.borrador;

// ─── País → código de 2 letras (reemplaza banderas emoji · canon F8) ──────────

const PAIS_CODIGO: Record<string, string> = {
  USA: 'US', 'Estados Unidos': 'US', CHINA: 'CN', China: 'CN',
  COREA: 'KR', Corea: 'KR', 'Corea del Sur': 'KR', 'JAPÓN': 'JP', 'Japón': 'JP',
  'MÉXICO': 'MX', 'México': 'MX', 'PERÚ': 'PE', 'Perú': 'PE', Peru: 'PE',
};
function paisCodigo(pais?: string): string {
  if (!pais) return '—';
  return PAIS_CODIGO[pais] ?? pais.slice(0, 2).toUpperCase();
}

// ─── Pago → chip semántico (emerald/amber/rose · eje de dato distinto al estado) ──

function pagoMeta(estadoPago: string | undefined, porcentaje: number): React.ReactNode {
  const cfg =
    estadoPago === 'pagado'
      ? { dot: 'bg-emerald-500', text: 'text-emerald-600', label: '100% pagado' }
      : estadoPago === 'parcial'
        ? { dot: 'bg-amber-500', text: 'text-amber-600', label: `${porcentaje}% pagado` }
        : { dot: 'bg-rose-500', text: 'text-rose-600', label: 'Sin pago' };
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Helpers de monto/pago (denormalizado · sin query async por card · S55 F2) ──

function calcPago(orden: OrdenCompra) {
  const tcAprox = orden.tcReferencial || orden.tcCompra || 1;
  const saldoUSD = orden.montoPendiente
    ? orden.montoPendiente / tcAprox
    : orden.estadoPago === 'pagado'
      ? 0
      : orden.totalUSD;
  const pagado = Math.max(0, orden.totalUSD - saldoUSD);
  const pct = orden.totalUSD > 0 ? Math.round((pagado / orden.totalUSD) * 100) : 0;
  return { pct };
}

// ─── Botón de acción icónico (Ver / Pagar / Envíos) ───────────────────────────

const IconBtn: React.FC<{
  icon: LucideIcon;
  title: string;
  tone: 'blue' | 'emerald' | 'sky';
  onClick?: () => void;
  disabled?: boolean;
}> = ({ icon: Icon, title, tone, onClick, disabled }) => {
  const hover = {
    blue: 'text-blue-600 hover:bg-blue-50',
    emerald: 'text-emerald-600 hover:bg-emerald-50',
    sky: 'text-sky-600 hover:bg-sky-50',
  }[tone];
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={
        disabled || !onClick
          ? undefined
          : (e) => {
              e.stopPropagation();
              onClick();
            }
      }
      className={`p-1.5 rounded-lg transition-colors ${
        disabled ? 'text-slate-300 cursor-not-allowed' : hover
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// CompraCard
// ════════════════════════════════════════════════════════════════════════════

export const CompraCard: React.FC<CompraCardProps> = ({
  orden,
  enviosAsociados = [],
  onView,
  onRegistrarPago,
  onRegistrarPagoSubOrden,
  onVerSubOrden,
  onVerEnvios,
  onVerEnvio,
  selectable,
  selected,
  onSelect,
  className,
}) => {
  const subOrdenes = orden.subOrdenes ?? [];
  const tieneSub = subOrdenes.length > 0;
  const estadoDerivado = calcularEstadoDerivadoOC(subOrdenes, orden.estado);
  const cfg = ESTADO_CFG[estadoDerivado] ?? ESTADO_DEFAULT;
  const { pct } = calcPago(orden);
  const estadoPago = orden.estadoPago;
  const pagado = estadoPago === 'pagado';

  const totalSKUs = orden.productos.length;
  const totalUnidades = orden.productos.reduce((s, p) => s + (p.cantidad || 0), 0);

  // Ruta (sin banderas · código país + lucide). DDP → Perú directo · resto → casilla.
  const esDDP = orden.modoEntregaDetallado === 'ddp_directo';
  const envioConCasilla = enviosAsociados.find(
    (e) => e.destinoCasillaNombre || e.destinoCasillaCodigo,
  );
  const destinoNombre = esDDP
    ? 'Perú'
    : envioConCasilla?.destinoCasillaCodigo ||
      envioConCasilla?.destinoCasillaNombre ||
      orden.nombreAlmacenDestino ||
      'Casilla';
  // Destino: NO cae a paisOrigen (eso es el país del proveedor · pintaría 'origen → origen').
  // Si la casilla es desconocida, paisCodigo(undefined) muestra '—' (honesto).
  const destinoPais = esDDP ? 'Peru' : envioConCasilla?.destinoCasillaPais;

  const ruta = (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-[10px] font-bold text-slate-400">{paisCodigo(orden.paisOrigen)}</span>
      <Plane className="w-3 h-3 text-slate-400" />
      <span className="font-mono text-[10px] font-bold text-slate-400">{paisCodigo(destinoPais)}</span>
      <span className="truncate max-w-[120px]">{destinoNombre}</span>
    </span>
  );

  // Acciones — Ver siempre · Pagar (si no pagado) · Envíos (si hay)
  const acciones = (
    <div className="flex items-center gap-0.5">
      <IconBtn icon={Eye} title="Ver detalle" tone="blue" onClick={onView} />
      <IconBtn
        icon={DollarSign}
        title={pagado ? 'Pagado' : 'Registrar pago'}
        tone="emerald"
        onClick={onRegistrarPago}
        disabled={pagado || !onRegistrarPago}
      />
      {!tieneSub && (
        <IconBtn
          icon={Truck}
          title={enviosAsociados.length > 0 ? `Ver envíos (${enviosAsociados.length})` : 'Sin envíos'}
          tone="sky"
          onClick={onVerEnvios}
          disabled={enviosAsociados.length === 0 || !onVerEnvios}
        />
      )}
    </div>
  );

  // ─── Meta común ───────────────────────────────────────────────────────────
  const sep = <span className="text-slate-300">·</span>;

  // ─── OC con sub-órdenes → subRows ─────────────────────────────────────────
  if (tieneSub) {
    const deudor =
      orden.deudorTipo === 'colaborador' && orden.deudorNombre
        ? `${orden.deudorNombre} (colaborador)`
        : orden.nombreProveedor;
    const subRows = subOrdenes.map((sub, idx) => (
      <SubFila
        key={sub.id || `sub-${idx}`}
        sub={sub}
        onClick={onVerSubOrden ? () => onVerSubOrden(sub.id) : undefined}
        onRegistrarPago={onRegistrarPagoSubOrden ? () => onRegistrarPagoSubOrden(sub.id) : undefined}
      />
    ));
    return (
      <HubCard
        color={cfg.color}
        icon={Layers}
        code={orden.numeroOrden}
        title={orden.nombreProveedor}
        meta={
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 font-medium text-slate-600">
              <Layers className="w-2.5 h-2.5" /> {subOrdenes.length} sub-órdenes
            </span>
            {sep} {pagoMeta(estadoPago, pct)} {sep}
            <span className="truncate">Deudor: {deudor}</span> {sep}
            <span>{totalSKUs} SKU · {totalUnidades} und</span>
          </span>
        }
        amount={`$${orden.totalUSD.toFixed(2)}`}
        status={{ label: cfg.label, variant: cfg.variant }}
        actions={acciones}
        subRows={<>{subRows}</>}
        selectable={selectable}
        selected={selected}
        onSelect={onSelect}
        className={className}
      />
    );
  }

  // ─── OC simple ────────────────────────────────────────────────────────────
  return (
    <HubCard
      color={cfg.color}
      icon={cfg.icon}
      code={orden.numeroOrden}
      title={orden.nombreProveedor}
      meta={
        <span className="inline-flex items-center gap-1.5">
          {pagoMeta(estadoPago, pct)} {sep} {ruta} {sep}
          <span>{totalSKUs} SKU · {totalUnidades} und</span> {sep}
          <span>{formatFechaRelativa(orden.fechaCreacion)}</span>
        </span>
      }
      amount={`$${orden.totalUSD.toFixed(2)}`}
      status={{ label: cfg.label, variant: cfg.variant }}
      actions={acciones}
      onClick={onView}
      selectable={selectable}
      selected={selected}
      onSelect={onSelect}
      className={className}
    />
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SubFila — sub-orden como HubCardSubRow
// ════════════════════════════════════════════════════════════════════════════

const SUB_ESTADO: Record<string, { dot: string; label: string; variant: StatusVariant }> = {
  borrador: { dot: 'bg-slate-400', label: 'Confirmada', variant: 'neutral' }, // D-127
  confirmada: { dot: 'bg-slate-400', label: 'Confirmada', variant: 'neutral' },
  en_transito: { dot: 'bg-sky-500', label: 'En Tránsito', variant: 'info' },
  recibida: { dot: 'bg-emerald-500', label: 'Recibida', variant: 'success' },
};

// Pago de la sub-orden · eje de DATO distinto al estado logístico → paleta semántica
// (no viola la gobernanza de color · igual que pagoMeta a nivel OC).
const SUB_PAGO: Record<string, { dot: string; text: string; label: string }> = {
  pagado: { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'Pagada' },
  parcial: { dot: 'bg-amber-500', text: 'text-amber-600', label: 'Parcial' },
  pendiente: { dot: 'bg-rose-500', text: 'text-rose-600', label: 'Sin pago' },
};

const SubFila: React.FC<{ sub: SubOrdenCompra; onClick?: () => void; onRegistrarPago?: () => void }> = ({
  sub,
  onClick,
  onRegistrarPago,
}) => {
  const e = SUB_ESTADO[sub.estado ?? 'borrador'] ?? SUB_ESTADO.borrador;
  const pg = SUB_PAGO[sub.estadoPago ?? 'pendiente'] ?? SUB_PAGO.pendiente;
  const pagada = sub.estadoPago === 'pagado';
  const prods = sub.productos
    .slice(0, 2)
    .map((p) => p.nombreComercial)
    .join(' · ');
  const extra = sub.productos.length > 2 ? ` +${sub.productos.length - 2}` : '';
  return (
    <HubCardSubRow
      dotColor={e.dot}
      label={
        <span className="truncate inline-flex items-center gap-1.5">
          <b className="font-mono">{sub.id}</b>
          {sub.envioNumero && <span className="text-slate-400 font-mono">→ {sub.envioNumero}</span>}
          <span className={`inline-flex items-center gap-1 font-medium ${pg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pg.dot}`} />
            {pg.label}
          </span>
          {prods && <span className="text-slate-500">· {prods}{extra}</span>}
        </span>
      }
      status={{ label: e.label, variant: e.variant }}
      amount={`$${sub.totalUSD.toFixed(2)}`}
      actions={
        onRegistrarPago && !pagada ? (
          <IconBtn icon={DollarSign} title="Registrar pago sub-orden" tone="emerald" onClick={onRegistrarPago} />
        ) : undefined
      }
      onClick={onClick}
    />
  );
};
