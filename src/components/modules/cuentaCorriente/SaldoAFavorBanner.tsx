/**
 * SaldoAFavorBanner — S55 Fase 7 · Banner reutilizable para Wizards
 *
 * Cuando se está creando una OC nueva (proveedor) o Venta nueva (cliente),
 * detecta si la entidad tiene saldo a favor y ofrece aplicarlo.
 *
 * Convención (alineada con CC):
 *  - Para PROVEEDOR: `cc.saldoUSD > 0` significa "el proveedor nos debe USD"
 *    → aplicable a la próxima OC con ese proveedor
 *  - Para CLIENTE: `cc.saldoPEN < 0` significa "le debemos al cliente PEN"
 *    → aplicable como descuento a la próxima venta
 *
 * Uso:
 *   <SaldoAFavorBanner
 *     entidadId={proveedorId}
 *     tipo="proveedor"
 *     moneda="USD"
 *     onAplicar={(monto) => setMontoAplicado(monto)}
 *   />
 */

import React, { useState } from 'react';
import { Wallet, Check } from 'lucide-react';
import { useCuentaCorriente } from '../../../hooks/useCuentaCorriente';
import type { TipoEntidadCC, MonedaCC } from '../../../types/cuentaCorriente.types';
import { Button } from '../../common';

interface SaldoAFavorBannerProps {
  entidadId: string;
  tipo: TipoEntidadCC;
  /** Moneda del documento que se está creando (filtra qué saldo es aplicable). */
  moneda: MonedaCC;
  /**
   * Si tipo='cliente': considera saldo a favor cuando `cc.saldo < 0`
   * (le debemos al cliente).
   * Si tipo='proveedor' u otro: considera saldo a favor cuando `cc.saldo > 0`
   * (la entidad nos debe).
   */
  onAplicar?: (montoSugerido: number) => void;
  /** Monto máximo aplicable (típicamente totalDocActual). */
  montoMaximo?: number;
  /** Modo solo display (no muestra botón "Aplicar"). */
  readOnly?: boolean;
}

export const SaldoAFavorBanner: React.FC<SaldoAFavorBannerProps> = ({
  entidadId,
  tipo,
  moneda,
  onAplicar,
  montoMaximo,
  readOnly = false,
}) => {
  const { cc, loading } = useCuentaCorriente(entidadId, tipo);
  const [aplicado, setAplicado] = useState(false);

  if (loading || !cc) return null;

  const saldoEnMoneda = moneda === 'USD' ? cc.saldoUSD : cc.saldoPEN;

  // Convención: para cliente, saldo NEGATIVO = le debemos (saldo a favor del cliente).
  // Para otros tipos, saldo POSITIVO = entidad nos debe (saldo a favor nuestro
  // para aplicar a próximo pago).
  const saldoAFavor =
    tipo === 'cliente' ? Math.max(0, -saldoEnMoneda) : Math.max(0, saldoEnMoneda);

  if (saldoAFavor < 0.01) return null;

  // Cap al monto del documento actual (no se puede aplicar más del total)
  const montoAplicable = montoMaximo
    ? Math.min(saldoAFavor, montoMaximo)
    : saldoAFavor;

  const simbolo = moneda === 'USD' ? 'US$' : 'S/';
  const labelTipo = tipo === 'cliente' ? 'cliente' : tipo === 'proveedor' ? 'proveedor' : tipo;

  const handleAplicar = () => {
    if (!onAplicar) return;
    onAplicar(montoAplicable);
    setAplicado(true);
  };

  if (aplicado) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2 text-emerald-900 text-sm">
        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span>
          Saldo de <strong>{simbolo} {montoAplicable.toFixed(2)}</strong> aplicado al documento.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Wallet className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-emerald-900">
            Saldo a favor disponible: {simbolo} {saldoAFavor.toFixed(2)}
          </div>
          <div className="text-[12px] text-emerald-700 mt-0.5">
            {tipo === 'cliente'
              ? `Este ${labelTipo} tiene un saldo a favor que puede aplicarse como descuento a esta venta.`
              : `Este ${labelTipo} tiene un saldo a favor (te debe) que puede aplicarse al pago de este documento.`}
            {montoMaximo !== undefined && montoAplicable < saldoAFavor && (
              <span className="block mt-0.5">
                Aplicable: {simbolo} {montoAplicable.toFixed(2)} (cap del total del documento).
              </span>
            )}
          </div>
        </div>
        {!readOnly && onAplicar && (
          <Button variant="primary" size="sm" onClick={handleAplicar}>
            Aplicar saldo
          </Button>
        )}
      </div>
    </div>
  );
};
