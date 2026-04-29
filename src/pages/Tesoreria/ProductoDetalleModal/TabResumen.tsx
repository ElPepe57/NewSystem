/**
 * TabResumen — Imp-L2 · M2 detalle producto · tab "Resumen"
 *
 * Muestra los datos completos del producto en 2 grids paralelos:
 *   - Datos del producto (tipo, banco, número, CCI, moneda)
 *   - Relación bancaria (titular, RUC/DNI, etiqueta, etc.)
 *
 * Si tiene canalesDigitales, los muestra como preview en card purple.
 */

import React from 'react';
import { Smartphone } from 'lucide-react';
import type { CuentaCaja } from '../../../types/tesoreria.types';

function fmtSaldo(n: number, moneda: 'PEN' | 'USD'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  return `${sym} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const FilaDato: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({
  label,
  value,
  mono = false,
}) => (
  <div className="flex justify-between text-sm gap-3">
    <span className="text-slate-500 flex-shrink-0">{label}</span>
    <span
      className={`font-medium text-slate-800 truncate text-right ${mono ? 'font-mono' : ''}`}
      title={typeof value === 'string' ? value : undefined}
    >
      {value || '—'}
    </span>
  </div>
);

export const TabResumen: React.FC<{ cuenta: CuentaCaja }> = ({ cuenta }) => {
  const tipoLabel = (() => {
    if (cuenta.tipo === 'banco') return cuenta.productoFinanciero === 'cuenta_ahorros' ? 'Cuenta de ahorros' : 'Cuenta corriente';
    if (cuenta.tipo === 'efectivo') return 'Caja efectivo';
    if (cuenta.tipo === 'digital') return 'Wallet digital';
    if (cuenta.productoFinanciero === 'tarjeta_credito') return 'Tarjeta de crédito';
    return 'Tarjeta de débito';
  })();

  const titularidadLabel = cuenta.titularidad === 'personal' ? 'Personal' : 'Empresa';

  return (
    <div className="p-5 sm:p-6 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Datos del producto */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Datos del producto
          </div>
          <div className="space-y-2">
            <FilaDato label="Tipo" value={tipoLabel} />
            {cuenta.banco && (
              <FilaDato
                label="Banco"
                value={
                  cuenta.bancoNombreCompleto
                    ? `${cuenta.banco} · ${cuenta.bancoNombreCompleto}`
                    : cuenta.banco
                }
              />
            )}
            {cuenta.numeroCuenta && (
              <FilaDato label="Número de cuenta" value={cuenta.numeroCuenta} mono />
            )}
            {cuenta.cci && <FilaDato label="CCI" value={cuenta.cci} mono />}
            <FilaDato
              label="Moneda"
              value={cuenta.esBiMoneda ? `${cuenta.moneda} (bi-moneda)` : cuenta.moneda}
            />
            {!cuenta.activa && <FilaDato label="Estado" value="Inactiva" />}
          </div>
        </div>

        {/* Relación bancaria / titularidad */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Titularidad
          </div>
          <div className="space-y-2">
            <FilaDato label="Tipo" value={titularidadLabel} />
            <FilaDato
              label="Titular"
              value={cuenta.titularNombre || cuenta.titular || '—'}
            />
            {cuenta.titularEntidadTipo && (
              <FilaDato label="Vinculación" value={cuenta.titularEntidadTipo} />
            )}
            {cuenta.saldoMinimo !== undefined && cuenta.saldoMinimo > 0 && (
              <FilaDato
                label={`Saldo mínimo ${cuenta.moneda}`}
                value={fmtSaldo(cuenta.saldoMinimo, cuenta.moneda)}
              />
            )}
            {cuenta.esBiMoneda && cuenta.saldoMinimoPEN !== undefined && (
              <FilaDato
                label="Mínimo PEN"
                value={fmtSaldo(cuenta.saldoMinimoPEN, 'PEN')}
              />
            )}
            {cuenta.esBiMoneda && cuenta.saldoMinimoUSD !== undefined && (
              <FilaDato
                label="Mínimo USD"
                value={fmtSaldo(cuenta.saldoMinimoUSD, 'USD')}
              />
            )}
          </div>
        </div>
      </div>

      {/* Canales digitales preview */}
      {cuenta.canalesDigitales && cuenta.canalesDigitales.length > 0 && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
              Canales digitales adosados
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {cuenta.canalesDigitales.map((canal) => (
              <div
                key={`${canal.tipo}-${canal.identificador}`}
                className="bg-white border border-purple-200 rounded-lg px-3 py-2 flex items-center gap-2"
              >
                <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-[9px] font-bold text-purple-700">
                    {canal.tipo.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-purple-900">
                    {canal.tipo.charAt(0).toUpperCase() + canal.tipo.slice(1)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {canal.identificador}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {cuenta.banco && (
            <div className="text-xs text-purple-500 mt-3">
              Banco subyacente: {cuenta.banco} · Operativa automáticamente
            </div>
          )}
        </div>
      )}

      {/* Notas adicionales */}
      <div className="text-xs text-slate-400 italic">
        ID interno: {cuenta.id}
      </div>
    </div>
  );
};
