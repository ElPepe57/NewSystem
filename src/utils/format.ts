/**
 * Utilidades centralizadas de formateo
 *
 * Reemplaza las ~48 definiciones locales de formatCurrency, formatPercent y
 * formatNumber dispersas por el proyecto.
 *
 * Principio: una sola implementación — cualquier cambio de regla de presentación
 * (símbolo, separadores, decimales) se aplica en un único lugar.
 */

// ---------------------------------------------------------------------------
// formatCurrency — uso general (USD por defecto)
//
// Produce: "$ 1,234.56" / "S/ 1,234.56" / "-$ 1,234.56"
// Separadores en-US para consistencia visual con los precios del negocio
// (la mayoría de las operaciones son en USD).
// ---------------------------------------------------------------------------
export function formatCurrency(
  value: number | null | undefined,
  currency: 'USD' | 'PEN' = 'USD'
): string {
  if (value == null || isNaN(value)) {
    return currency === 'USD' ? '$ 0.00' : 'S/ 0.00';
  }

  const symbol = currency === 'USD' ? '$' : 'S/';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  return value < 0 ? `-${symbol} ${formatted}` : `${symbol} ${formatted}`;
}

// ---------------------------------------------------------------------------
// formatCurrencyPEN — conveniente para componentes que siempre usan soles
//
// Produce: "S/ 1,234.56"
// ---------------------------------------------------------------------------
export function formatCurrencyPEN(value: number | null | undefined): string {
  return formatCurrency(value, 'PEN');
}

// ---------------------------------------------------------------------------
// formatCurrencyCompact — formato abreviado K/M para dashboards y tarjetas
//
// Produce: "$ 1.2M" / "S/ 34.5K" / "$ 500"
// Útil cuando el espacio es limitado (móvil, widgets).
// ---------------------------------------------------------------------------
export function formatCurrencyCompact(
  value: number | null | undefined,
  currency: 'USD' | 'PEN' = 'USD'
): string {
  if (value == null || isNaN(value)) {
    return currency === 'USD' ? '$ 0' : 'S/ 0';
  }

  const symbol = currency === 'USD' ? '$' : 'S/';
  const abs = Math.abs(value);
  let formatted: string;

  if (abs >= 1_000_000) {
    formatted = `${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  } else if (abs >= 1_000) {
    formatted = `${symbol}${(abs / 1_000).toFixed(1)}K`;
  } else {
    formatted = `${symbol}${abs.toFixed(0)}`;
  }

  return value < 0 ? `-${formatted}` : formatted;
}

// ---------------------------------------------------------------------------
// formatNumber — número genérico con separadores de miles
//
// Produce: "1,234.56" / "1,234"
// ---------------------------------------------------------------------------
export function formatNumber(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value == null || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// ---------------------------------------------------------------------------
// formatPercent — porcentaje con signo %
//
// Produce: "12.5%" / "0.0%"
// ---------------------------------------------------------------------------
export function formatPercent(
  value: number | null | undefined,
  decimals = 1
): string {
  if (value == null || isNaN(value)) return '0%';
  return `${value.toFixed(decimals)}%`;
}
