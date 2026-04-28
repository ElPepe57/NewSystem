/**
 * Paso 1 — Tipo de cuenta + producto financiero · S58c v2
 *
 * 4 tipos: banco / digital / efectivo / credito
 * Productos válidos cambian según el tipo (mockup sección 2).
 */

import React, { useEffect } from 'react';
import {
  Building2,
  Smartphone,
  Banknote,
  CreditCard,
} from 'lucide-react';
import { cn } from '../../../design-system/utils';
import {
  PRODUCTOS_POR_TIPO,
  PRODUCTO_LABEL,
  type CuentaWizardState,
  type TipoCuenta,
  type ProductoFinancieroNuevo,
} from './types';

interface Paso1Props {
  state: CuentaWizardState;
  setState: React.Dispatch<React.SetStateAction<CuentaWizardState>>;
}

const TIPO_OPTIONS: Array<{
  value: TipoCuenta;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
  color: string;
}> = [
  {
    value: 'banco',
    label: 'Banco',
    icon: Building2,
    hint: 'BCP, IBK, BBVA, Scotiabank · soporta canales Yape/Plin',
    color: 'emerald',
  },
  {
    value: 'digital',
    label: 'Digital',
    icon: Smartphone,
    hint: 'Mercado Pago, PayPal, Zelle, Wise · cuentas independientes',
    color: 'purple',
  },
  {
    value: 'efectivo',
    label: 'Caja',
    icon: Banknote,
    hint: 'Caja chica, efectivo en custodia',
    color: 'amber',
  },
  {
    value: 'credito',
    label: 'Crédito',
    icon: CreditCard,
    hint: 'Tarjeta débito vinculada a una cuenta de ahorros',
    color: 'sky',
  },
];

const TIPO_COLOR_CLASSES: Record<string, { active: string; inactive: string }> = {
  emerald: {
    active: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    inactive: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
  },
  purple: {
    active: 'border-purple-500 bg-purple-50 text-purple-700',
    inactive: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
  },
  amber: {
    active: 'border-amber-500 bg-amber-50 text-amber-700',
    inactive: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
  },
  sky: {
    active: 'border-sky-500 bg-sky-50 text-sky-700',
    inactive: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
  },
};

export const Paso1TipoProducto: React.FC<Paso1Props> = ({ state, setState }) => {
  const productosDisponibles = PRODUCTOS_POR_TIPO[state.tipo];

  // Auto-seleccionar primer producto si el actual no es válido para el tipo
  useEffect(() => {
    if (
      !state.productoFinanciero ||
      !productosDisponibles.includes(state.productoFinanciero)
    ) {
      setState((s) => ({
        ...s,
        productoFinanciero: productosDisponibles[0],
        // Auto-aplicar moneda por default según producto digital
        moneda:
          state.tipo === 'digital' && productosDisponibles[0] === 'zelle'
            ? 'USD'
            : state.tipo === 'digital' && productosDisponibles[0] === 'mercadopago'
              ? 'PEN'
              : s.moneda,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tipo, productosDisponibles]);

  const handleSelectTipo = (tipo: TipoCuenta) => {
    setState((s) => ({
      ...s,
      tipo,
      // Reset producto (se auto-elige el primero válido)
      productoFinanciero: undefined,
      // Reset bi-moneda si el tipo no lo soporta
      esBiMoneda: tipo === 'banco' || tipo === 'efectivo' ? s.esBiMoneda : false,
      // Reset canales si no es banco
      canalesDigitales: tipo === 'banco' ? s.canalesDigitales : [],
    }));
  };

  return (
    <div className="space-y-5">
      {/* Tipo de cuenta */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
          Tipo de cuenta
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TIPO_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = state.tipo === opt.value;
            const colorClasses = TIPO_COLOR_CLASSES[opt.color];
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectTipo(opt.value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all',
                  active ? colorClasses.active : colorClasses.inactive,
                )}
              >
                <Icon className={cn('w-5 h-5', active && 'opacity-100')} />
                <span
                  className={cn(
                    'text-[11px]',
                    active ? 'font-semibold' : 'font-medium',
                  )}
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
          {TIPO_OPTIONS.find((o) => o.value === state.tipo)?.hint}
        </p>
      </div>

      {/* Producto financiero */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
          Producto financiero
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {productosDisponibles.map((prod) => {
            const active = state.productoFinanciero === prod;
            return (
              <button
                key={prod}
                type="button"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    productoFinanciero: prod as ProductoFinancieroNuevo,
                  }))
                }
                className={cn(
                  'p-3 rounded-lg border-2 text-left transition-all',
                  active
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                <div
                  className={cn(
                    'text-[12px]',
                    active ? 'font-semibold' : 'font-medium',
                  )}
                >
                  {PRODUCTO_LABEL[prod]}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {PRODUCTO_HINT[prod]}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notas críticas según tipo */}
      {state.tipo === 'banco' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-[11px] text-emerald-900">
          <strong>Nota:</strong> Yape, Plin, SIP, Ágora y BIM son <strong>canales</strong> de
          esta cuenta bancaria, no cuentas separadas. Se configuran en el Paso 4.
        </div>
      )}
      {state.tipo === 'credito' && (
        <div className="bg-sky-50 border border-sky-200 rounded-md p-3 text-[11px] text-sky-900">
          <strong>Nota:</strong> Las tarjetas débito están vinculadas a una cuenta de ahorros.
          Las tarjetas de <strong>crédito</strong> tienen su propio módulo (S58d).
        </div>
      )}
      {state.tipo === 'digital' && (
        <div className="bg-purple-50 border border-purple-200 rounded-md p-3 text-[11px] text-purple-900">
          <strong>Nota:</strong> Mercado Pago, PayPal, Zelle, Wise y Binance son cuentas
          <strong> independientes</strong> con saldo propio.
        </div>
      )}
    </div>
  );
};

const PRODUCTO_HINT: Record<ProductoFinancieroNuevo, string> = {
  cuenta_ahorros: 'Sin chequera, alta liquidez',
  cuenta_corriente: 'Con chequera, soporta sobregiro',
  tarjeta_debito: 'Plástico vinculado a ahorros',
  caja: 'Efectivo en custodia',
  mercadopago: 'PEN · Latam',
  paypal: 'USD principalmente',
  zelle: 'USD · USA',
  wise: 'Multi-moneda',
  binance: 'Crypto + fiat',
};
