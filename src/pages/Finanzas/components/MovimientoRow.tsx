/**
 * MovimientoRow — chk5.D-S3 · SF3
 *
 * Row individual del ledger transaccional canon MOCK 7 §1 · pixel-perfect.
 * Renderiza un MovimientoTesoreria como fila clickable que abre drawer
 * detalle al click.
 *
 * Mapeo de TipoMovimientoTesoreria → variante visual (8 variantes):
 *   1. INGRESO (emerald)      · ingreso_venta · ingreso_anticipo · ingreso_otro · aporte_capital
 *   2. EGRESO (rose)          · pago_orden_compra · pago_proveedor_local · gasto_operativo · retiro_socio · pago_viajero
 *   3. CONVERSION (teal)      · conversion_usd_pen · conversion_pen_usd · destaca FX
 *   4. TRANSFERENCIA (indigo) · transferencia_interna
 *   5. PLANILLA (purple)      · pago_nomina · adelanto_empleado
 *   6. AJUSTE (amber)         · ajuste_positivo · ajuste_negativo
 *
 * Variantes adicionales detectadas vía referencia/método (MOCK 7 §1):
 *   - TC (amber + icon credit-card) · cuando metodo='tarjeta_credito' (sólo para egresos)
 *   - GK Recaudadora (purple badge) · cuando cuentaOrigen/Destino apunta a una caja_recaudadora
 *   - Pagos masivos (indigo badge) · cuando referencia contiene 'BATCH-' o 'PAGO-MASIVO-'
 *
 * Diseño canon v9.0 M1 copy-paste literal del mockup §1 ledger rows.
 */

import React from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Repeat,
  ArrowLeftRight,
  CreditCard,
  Truck,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { MovimientoTesoreria } from '../../../types/tesoreria.types';
import {
  TIPOS_INGRESO,
  TIPOS_EGRESO,
  TIPOS_CONVERSION,
} from '../../../services/tesoreria.shared';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface MovimientoRowProps {
  movimiento: MovimientoTesoreria;
  onClick: () => void;
  /** Nombre legible de la cuenta · si no se pasa muestra ID truncado */
  cuentaNombre?: string;
  /** Highlight background sutil · usado por conversiones · default false */
  highlight?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// VARIANT RESOLVER · maps tipo+método → estilo visual
// ═════════════════════════════════════════════════════════════════════════

type Variant = 'ingreso' | 'egreso' | 'conversion' | 'transferencia' | 'planilla' | 'ajuste' | 'cargo_tc' | 'settle_pasarela';

function resolverVariant(mov: MovimientoTesoreria): Variant {
  // Settle de pasarela (Stripe · MP · etc) · detectar por referencia
  if (
    mov.referencia &&
    /SETTLE|stripe|mercado.?pago|mp.?payout/i.test(mov.referencia)
  ) {
    return 'settle_pasarela';
  }
  // Cargo TC · método tarjeta_credito siempre es cargo TC
  if (mov.metodo === 'tarjeta_credito') return 'cargo_tc';
  // Planilla
  if (mov.tipo === 'pago_nomina' || mov.tipo === 'adelanto_empleado') {
    return 'planilla';
  }
  // Transferencia interna
  if (mov.tipo === 'transferencia_interna') return 'transferencia';
  // Conversiones
  if (TIPOS_CONVERSION.includes(mov.tipo)) return 'conversion';
  // Ajustes
  if (mov.tipo === 'ajuste_positivo' || mov.tipo === 'ajuste_negativo') {
    return 'ajuste';
  }
  // Ingreso · Egreso
  if (TIPOS_INGRESO.includes(mov.tipo)) return 'ingreso';
  if (TIPOS_EGRESO.includes(mov.tipo)) return 'egreso';
  // Default · egreso (no debería pasar)
  return 'egreso';
}

const VARIANT_CONFIG: Record<
  Variant,
  {
    icon: LucideIcon;
    iconBg: string;
    iconText: string;
    montoColor: string;
    estadoLabel: string;
    estadoColor: string;
  }
> = {
  ingreso: {
    icon: ArrowDownCircle,
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-700',
    montoColor: 'text-emerald-700',
    estadoLabel: 'Confirmado',
    estadoColor: 'text-emerald-700',
  },
  egreso: {
    icon: ArrowUpCircle,
    iconBg: 'bg-rose-100',
    iconText: 'text-rose-700',
    montoColor: 'text-rose-700',
    estadoLabel: 'Confirmado',
    estadoColor: 'text-rose-700',
  },
  conversion: {
    icon: Repeat,
    iconBg: 'bg-teal-100',
    iconText: 'text-teal-700',
    montoColor: 'text-teal-700',
    estadoLabel: '+ ganancia FX',
    estadoColor: 'text-emerald-700',
  },
  transferencia: {
    icon: ArrowLeftRight,
    iconBg: 'bg-indigo-100',
    iconText: 'text-indigo-700',
    montoColor: 'text-indigo-700',
    estadoLabel: 'Interna',
    estadoColor: 'text-indigo-700',
  },
  planilla: {
    icon: Wallet,
    iconBg: 'bg-purple-100',
    iconText: 'text-purple-700',
    montoColor: 'text-purple-700',
    estadoLabel: 'Planilla',
    estadoColor: 'text-purple-700',
  },
  ajuste: {
    icon: Wallet,
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-700',
    montoColor: 'text-amber-700',
    estadoLabel: 'Ajuste',
    estadoColor: 'text-amber-700',
  },
  cargo_tc: {
    icon: CreditCard,
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-700',
    montoColor: 'text-amber-700',
    estadoLabel: 'Cargo TC',
    estadoColor: 'text-amber-700',
  },
  settle_pasarela: {
    icon: Smartphone,
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-700',
    montoColor: 'text-sky-700',
    estadoLabel: 'Settle pasarela',
    estadoColor: 'text-sky-700',
  },
};

// ═════════════════════════════════════════════════════════════════════════
// HELPERS · formato
// ═════════════════════════════════════════════════════════════════════════

const fmt0 = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function formatHora(d: Date): string {
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function simboloMoneda(moneda: string): string {
  return moneda === 'USD' ? '$' : 'S/';
}

/** Detecta si el movimiento viene de una caja recaudadora (badge purple "via GK") */
function esViaCajaRecaudadora(mov: MovimientoTesoreria): boolean {
  // Heurística: si concepto/referencia/notas menciona 'GK Xpress' · 'recaudadora'
  const haystack = `${mov.concepto ?? ''} ${mov.referencia ?? ''} ${mov.notas ?? ''}`.toLowerCase();
  return /recaudadora|gk\s*xpress|gk\b/i.test(haystack);
}

/** Detecta si es pago batch (badge indigo "Pagos masivos") */
function esPagoBatch(mov: MovimientoTesoreria): boolean {
  return !!(mov.referencia && /BATCH|PAGO[\s_-]?MASIVO/i.test(mov.referencia));
}

/** Devuelve label del documento origen para cross-link · ej "F-015" · "OC-2026-098" */
function getDocOrigenLabel(mov: MovimientoTesoreria): string | null {
  if (mov.ventaNumero) return mov.ventaNumero;
  if (mov.ordenCompraNumero) return mov.ordenCompraNumero;
  if (mov.gastoNumero) return mov.gastoNumero;
  if (mov.cotizacionNumero) return mov.cotizacionNumero;
  if (mov.transferenciaNumero) return mov.transferenciaNumero;
  return null;
}

function getCuentaDisplay(mov: MovimientoTesoreria, cuentaNombre?: string): string {
  if (cuentaNombre) return cuentaNombre;
  // Fallback · primer fragmento de cuentaOrigen o cuentaDestino
  const id = mov.cuentaOrigen ?? mov.cuentaDestino ?? '';
  return id.length > 12 ? `…${id.slice(-8)}` : id || '—';
}

function getMetodoLabel(metodo: string): string {
  const map: Record<string, string> = {
    efectivo: 'efectivo',
    transferencia_bancaria: 'transf',
    yape: 'Yape',
    plin: 'Plin',
    tarjeta: 'tarjeta',
    tarjeta_credito: 'TC',
    prestamo_viajero: 'préstamo viajero',
    mercado_pago: 'MP',
    paypal: 'PayPal',
    zelle: 'Zelle',
    otro: 'otro',
  };
  return map[metodo] ?? metodo;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const MovimientoRow: React.FC<MovimientoRowProps> = ({
  movimiento: mov,
  onClick,
  cuentaNombre,
  highlight,
}) => {
  const variant = resolverVariant(mov);
  const cfg = VARIANT_CONFIG[variant];
  const Icon = cfg.icon;

  const anulado = mov.estado === 'anulado';
  const pendiente = mov.estado === 'pendiente';

  const fecha = mov.fecha.toDate();
  const hora = formatHora(fecha);
  const docOrigen = getDocOrigenLabel(mov);
  const cuentaDisplay = getCuentaDisplay(mov, cuentaNombre);
  const metodoLabel = getMetodoLabel(mov.metodo);

  const viaGK = esViaCajaRecaudadora(mov);
  const esBatch = esPagoBatch(mov);

  // Background row · canon mockup: conversiones tienen tinte teal sutil
  const bgRow =
    variant === 'conversion' || highlight ? 'bg-teal-50/20' : '';

  // Concept principal · usa el campo concepto del mov o un fallback descriptivo
  const conceptoPrincipal = mov.concepto || `${variant} · ${mov.tipo}`;

  // Monto · formato según variante
  let montoLabel: string;
  let estadoFinalLabel: string = cfg.estadoLabel;
  let estadoFinalColor: string = cfg.estadoColor;

  if (variant === 'conversion') {
    // Conversión muestra origen → destino
    const sigOrigen = mov.tipo === 'conversion_usd_pen' ? '$' : 'S/';
    const sigDestino = mov.tipo === 'conversion_usd_pen' ? 'S/' : '$';
    const destinoEquiv =
      mov.tipo === 'conversion_usd_pen' ? mov.montoEquivalentePEN : mov.montoEquivalenteUSD;
    montoLabel = `${sigOrigen} ${fmt0(mov.monto)} → ${sigDestino} ${fmt0(destinoEquiv)}`;
  } else if (variant === 'transferencia') {
    // Transferencia: monto neutro · no signo
    montoLabel = `${simboloMoneda(mov.moneda)} ${fmt0(mov.monto)}`;
  } else if (variant === 'ingreso') {
    montoLabel = `+${simboloMoneda(mov.moneda)} ${fmt0(mov.monto)}`;
  } else {
    montoLabel = `−${simboloMoneda(mov.moneda)} ${fmt0(mov.monto)}`;
  }

  // Override estado si está pendiente o anulado
  if (anulado) {
    estadoFinalLabel = 'Anulado';
    estadoFinalColor = 'text-slate-500 line-through';
  } else if (pendiente) {
    estadoFinalLabel = 'Pendiente';
    estadoFinalColor = 'text-amber-700';
  } else if (viaGK) {
    estadoFinalLabel = 'A liquidar';
    estadoFinalColor = 'text-purple-700';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-6 py-2.5 hover:bg-slate-50 flex items-center gap-3 text-left transition-colors ${bgRow} ${
        anulado ? 'opacity-60' : ''
      }`}
    >
      {/* Icon wrapper · color por variant */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg} ${cfg.iconText}`}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Concepto + badges + doc origen + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-bold text-slate-900 truncate">
            {conceptoPrincipal}
          </span>
          {docOrigen && (
            <span className="text-[10px] text-blue-700 hover:underline">
              {docOrigen} ↗
            </span>
          )}
          {viaGK && (
            <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
              via GK
            </span>
          )}
          {esBatch && (
            <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
              Pagos masivos
            </span>
          )}
          {variant === 'transferencia' && (
            <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
              Sin diferencial
            </span>
          )}
          {variant === 'conversion' && (
            <span className="text-[9px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
              FX
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-500 truncate">
          {hora} · {cuentaDisplay} · {metodoLabel}
          {mov.numeroMovimiento && <> · {mov.numeroMovimiento}</>}
          {variant === 'conversion' && mov.tipoCambio > 0 && (
            <> · TC {mov.tipoCambio.toFixed(3)}</>
          )}
        </div>
      </div>

      {/* Monto + estado · derecha */}
      <div className="text-right flex-shrink-0">
        <div className={`text-[14px] font-bold tabular-nums ${cfg.montoColor}`}>
          {montoLabel}
        </div>
        <div className={`text-[10px] ${estadoFinalColor}`}>{estadoFinalLabel}</div>
      </div>
    </button>
  );
};
