/**
 * ProductCard — Imp-L1.1.3 · Refactor visual S58e
 *
 * Card pixel-perfect según mockup M1 que reemplaza la fila/card legacy
 * de productos en TabCuentas y VistaPorTitular. Reusable en M3 (Pipeline)
 * y M4 (drill-down de titular).
 *
 * Soporta los 6 tipos de producto:
 *   - cuenta_ahorros / cuenta_corriente (icon Building2 sky)
 *   - tarjeta_credito (icon CreditCard indigo)
 *   - tarjeta_debito (icon CreditCard sky)
 *   - caja_efectivo (icon Banknote amber)
 *   - wallet_digital (icon Smartphone purple)
 *
 * Variantes visuales:
 *   - Saldo crítico → border-color rojo
 *   - Saldo atención → border-color amber
 *   - TC corte próximo → border-color sky
 *   - Bi-moneda → muestra ambos saldos apilados
 *   - Con canales digitales → badges Yape/Plin/SIP/etc.
 *   - TC con día corte/pago → fechas inline
 *
 * Q-A6 post-L1: botones "Cargar a TC" / "Pagar EC" solo en modal detalle,
 * NO en card del listado. Solo botones genéricos: Ver / Editar / Eliminar.
 */

import React from 'react';
import {
  Building2,
  CreditCard,
  Banknote,
  Smartphone,
  PiggyBank,
  ArrowLeftRight,
  Eye,
  Edit3,
  Trash2,
  Scissors,
  Clock,
} from 'lucide-react';
import { cn } from '../../../design-system/utils';
import { SaldoAlertChip, calcularEstadoSaldo, type SaldoEstado } from './SaldoAlertChip';
import type { CuentaCaja } from '../../../types/tesoreria.types';

// ═════════════════════════════════════════════════════════════════════════
// HELPERS DE FORMATO
// ═════════════════════════════════════════════════════════════════════════

function fmtMonto(n: number, moneda: 'PEN' | 'USD'): { entero: string; decimales: string } {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const entero = `${sign}${moneda === 'USD' ? 'US$' : 'S/'} ${Math.floor(abs).toLocaleString('es-PE')}`;
  const decimales = `.${(abs * 100 - Math.floor(abs) * 100).toFixed(0).padStart(2, '0')}`;
  return { entero, decimales };
}

function fmtTCEnEspañol(diaCorteOPago: number, mesActual?: number): string {
  const mes = mesActual ?? new Date().getMonth();
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${diaCorteOPago.toString().padStart(2, '0')} ${meses[mes]}`;
}

// ═════════════════════════════════════════════════════════════════════════
// MAPEO TIPO PRODUCTO → ICON + COLOR
// ═════════════════════════════════════════════════════════════════════════

interface IconConfig {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}

function getIconConfig(c: CuentaCaja): IconConfig {
  // tipo='credito' → distinguir débito vs crédito por productoFinanciero
  if (c.tipo === 'credito') {
    if (c.productoFinanciero === 'tarjeta_credito') {
      return {
        icon: CreditCard,
        iconBg: 'bg-indigo-50',
        iconColor: 'text-indigo-600',
      };
    }
    return {
      icon: CreditCard,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    };
  }
  if (c.tipo === 'efectivo') {
    return {
      icon: Banknote,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    };
  }
  if (c.tipo === 'digital') {
    return {
      icon: Smartphone,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
    };
  }
  // tipo='banco' — distinguir ahorros vs corriente
  if (c.productoFinanciero === 'cuenta_ahorros') {
    return {
      icon: PiggyBank,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    };
  }
  return {
    icon: Building2,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
  };
}

// ═════════════════════════════════════════════════════════════════════════
// SUBTÍTULO POR TIPO
// ═════════════════════════════════════════════════════════════════════════

function getSubtitulo(c: CuentaCaja): string {
  const partes: string[] = [];

  if (c.tipo === 'credito') {
    partes.push(c.productoFinanciero === 'tarjeta_credito' ? 'Tarjeta crédito' : 'Tarjeta débito');
  } else if (c.tipo === 'banco') {
    partes.push(c.productoFinanciero === 'cuenta_ahorros' ? 'Cuenta ahorros' : 'Cuenta corriente');
  } else if (c.tipo === 'efectivo') {
    partes.push('Caja efectivo');
  } else if (c.tipo === 'digital') {
    const proveedor = c.productoFinanciero;
    const proveedorLabel = proveedor === 'mercadopago' ? 'Mercado Pago'
      : proveedor === 'paypal' ? 'PayPal'
      : proveedor === 'zelle' ? 'Zelle'
      : proveedor === 'wise' ? 'Wise'
      : proveedor === 'binance' ? 'Binance'
      : 'Wallet digital';
    partes.push(proveedorLabel);
  }

  // Moneda
  if (c.esBiMoneda) partes.push('PEN + USD');
  else partes.push(c.moneda);

  // Titularidad
  if (c.titularidad === 'personal' && c.titularNombre) {
    partes.push(c.titularNombre);
  }

  return partes.join(' · ');
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export interface ProductCardProps {
  cuenta: CuentaCaja;
  /** Click en cualquier parte de la card → abrir detalle */
  onVerDetalle?: (c: CuentaCaja) => void;
  onEditar?: (c: CuentaCaja) => void;
  onEliminar?: (c: CuentaCaja) => void;
  /** Si la card está seleccionada (drill-down activo) */
  selected?: boolean;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  cuenta,
  onVerDetalle,
  onEditar,
  onEliminar,
  selected = false,
  className,
}) => {
  const c = cuenta;
  const { icon: Icon, iconBg, iconColor } = getIconConfig(c);
  const subtitulo = getSubtitulo(c);

  // Calcular estado de saldo
  const estado: SaldoEstado = calcularEstadoSaldo({
    saldoActual: c.esBiMoneda ? (c.saldoPEN ?? 0) : c.saldoActual,
    saldoMinimo: c.saldoMinimo,
    esTarjetaCredito: c.tipo === 'credito' && c.productoFinanciero === 'tarjeta_credito',
  });

  // Border color según estado (override sutil del border default)
  const borderStyle =
    estado === 'critico' ? { borderColor: '#fca5a5' }
    : estado === 'atencion' ? { borderColor: '#fde68a' }
    : estado === 'corte_proximo' ? { borderColor: '#bae6fd' }
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    // Solo dispara onVerDetalle si NO se hizo click en un botón de acción
    if ((e.target as HTMLElement).closest('button')) return;
    onVerDetalle?.(c);
  };

  // Saldo display: bi-moneda apilado vs mono-moneda
  const renderSaldo = () => {
    if (c.esBiMoneda) {
      const pen = c.saldoPEN ?? 0;
      const usd = c.saldoUSD ?? 0;
      const penFmt = fmtMonto(pen, 'PEN');
      const usdFmt = fmtMonto(usd, 'USD');
      return (
        <>
          <div className="text-lg font-bold text-emerald-700 tabular-nums">
            {penFmt.entero}
            <span className="text-slate-400 text-sm">{penFmt.decimales}</span>
          </div>
          <div className="text-sm font-semibold text-sky-700 tabular-nums">
            {usdFmt.entero}
            <span className="text-slate-400 text-xs">{usdFmt.decimales}</span>
          </div>
        </>
      );
    }
    const fmt = fmtMonto(c.saldoActual, c.moneda);
    const colorSaldo =
      estado === 'critico' ? 'text-red-600'
      : estado === 'atencion' ? 'text-amber-700'
      : estado === 'corte_proximo' ? 'text-indigo-700'
      : 'text-emerald-700';
    return (
      <div className={cn('text-lg font-bold tabular-nums', colorSaldo)}>
        {fmt.entero}
        <span className="text-slate-400 text-sm">{fmt.decimales}</span>
      </div>
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onVerDetalle?.(c);
        }
      }}
      className={cn(
        'group bg-white border rounded-xl p-4 cursor-pointer',
        'transition-all duration-200 ease-out',
        'hover:shadow-md hover:-translate-y-0.5 hover:border-teal-300',
        'active:scale-[0.99]',
        selected && 'ring-2 ring-teal-300 border-teal-300',
        !selected && 'border-slate-200',
        className,
      )}
      style={borderStyle}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Lado izquierdo: icon + info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
              iconBg,
            )}
          >
            <Icon className={cn('w-5 h-5', iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            {/* Línea 1: nombre + chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-900 truncate">
                {c.nombre}
              </span>
              {c.esBiMoneda && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                  <ArrowLeftRight className="w-2.5 h-2.5" />
                  Bi-moneda
                </span>
              )}
              <SaldoAlertChip estado={estado} />
            </div>
            {/* Línea 2: subtítulo */}
            <div className="text-xs text-slate-500 mt-0.5 truncate">
              {subtitulo}
            </div>
            {/* Línea 3 (TC): días de corte/pago */}
            {c.tipo === 'credito' && c.productoFinanciero === 'tarjeta_credito' && (
              <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                {/* Stub: hoy CuentaCaja no tiene diaCorte/diaPago. Esos campos
                    viven en TarjetaCredito legacy. F4-F5 los unifica. */}
                <span className="flex items-center gap-1 text-slate-500">
                  <Scissors className="w-3 h-3" />
                  Día corte y pago en detalle
                </span>
              </div>
            )}
            {/* Línea 4 (banco): canales digitales */}
            {c.canalesDigitales && c.canalesDigitales.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {c.canalesDigitales.map((canal) => (
                  <span
                    key={`${canal.tipo}-${canal.identificador}`}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700"
                  >
                    <Smartphone className="w-2.5 h-2.5" />
                    {canal.tipo.charAt(0).toUpperCase() + canal.tipo.slice(1)}
                    {canal.identificador && ` · ${canal.identificador}`}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lado derecho: saldo + acciones */}
        <div className="text-right flex-shrink-0">
          {renderSaldo()}
          {/* Acciones inline · ocultas, aparecen en hover */}
          {(onEditar || onEliminar) && (
            <div className="flex items-center gap-1 justify-end mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {onVerDetalle && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerDetalle(c);
                  }}
                  className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors"
                  title="Ver detalle"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              )}
              {onEditar && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditar(c);
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                  title="Editar"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
              {onEliminar && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEliminar(c);
                  }}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
