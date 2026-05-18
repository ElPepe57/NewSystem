/**
 * TablaDriversProyectados — chk5.D-S3.quater · SF4
 *
 * Tabla canon MOCK 9 §1 · drivers proyectados próximos N días.
 * Columnas: Fecha · Evento · Cuenta · Monto · Tipo · Confianza.
 *
 * Tipo badges (color por tipo de driver):
 *   - cobro          → emerald
 *   - pago_proveedor → rose
 *   - tc_corte       → amber
 *   - pago_critico   → rose-strong (row destacada con ring)
 *   - recaudador     → purple
 *   - wallet_payout  → sky
 *   - fijo_mensual   → indigo
 *
 * Confianza badges:
 *   - alta · emerald
 *   - media · amber
 *   - baja · slate
 */

import React from 'react';
import type { DriverProyectado, ConfianzaDriver, TipoDriver } from './cashFlowHelpers';
import { fmt0, fmtFechaCorta } from './cashFlowHelpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface TablaDriversProyectadosProps {
  drivers: DriverProyectado[];
  /** Horizonte en días · sólo para el subtítulo */
  horizonteDias: number;
  /** Click en una fila · abre detalle (chk5.D-S4) · placeholder por ahora */
  onClickDriver?: (driver: DriverProyectado) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// MAPS canon
// ═════════════════════════════════════════════════════════════════════════

const TIPO_LABEL: Record<TipoDriver, string> = {
  cobro: 'Cobro',
  pago_proveedor: 'Pago prov',
  tc_corte: 'TC corte',
  pago_critico: 'Pago crítico',
  recaudador: 'Recaudador',
  wallet_payout: 'Wallet payout',
  fijo_mensual: 'Fijo mensual',
};

const TIPO_BG: Record<TipoDriver, string> = {
  cobro: 'bg-emerald-100 text-emerald-700',
  pago_proveedor: 'bg-rose-100 text-rose-700',
  tc_corte: 'bg-amber-100 text-amber-700',
  pago_critico: 'bg-rose-100 text-rose-700',
  recaudador: 'bg-purple-100 text-purple-700',
  wallet_payout: 'bg-sky-100 text-sky-700',
  fijo_mensual: 'bg-indigo-100 text-indigo-700',
};

const CONFIANZA_LABEL: Record<ConfianzaDriver, string> = {
  alta: 'Alta · comprometido',
  media: 'Media · estimado',
  baja: 'Baja · supuesto',
};

const CONFIANZA_BG: Record<ConfianzaDriver, string> = {
  alta: 'bg-emerald-100 text-emerald-700',
  media: 'bg-amber-100 text-amber-700',
  baja: 'bg-slate-100 text-slate-700',
};

const ROW_BG: Record<TipoDriver, string> = {
  cobro: 'bg-emerald-50/30',
  pago_proveedor: 'bg-rose-50/30',
  tc_corte: '',
  pago_critico: 'bg-rose-50/40 ring-2 ring-rose-300',
  recaudador: '',
  wallet_payout: '',
  fijo_mensual: '',
};

const MONTO_TEXT: Record<TipoDriver, string> = {
  cobro: 'text-emerald-700',
  pago_proveedor: 'text-rose-700',
  tc_corte: 'text-amber-700',
  pago_critico: 'text-rose-700',
  recaudador: 'text-purple-700',
  wallet_payout: 'text-sky-700',
  fijo_mensual: 'text-indigo-700',
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const TablaDriversProyectados: React.FC<TablaDriversProyectadosProps> = ({
  drivers,
  horizonteDias,
  onClickDriver,
}) => {
  if (drivers.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-[13px] font-bold text-slate-900">
          Drivers proyectados próximos {horizonteDias} días
        </h3>
        <div className="border border-slate-200 rounded-xl p-6 text-center text-[12px] text-slate-500">
          No hay drivers proyectados en este horizonte.
          <br />
          <span className="text-[10px] text-slate-400 italic">
            Esperá a que se acumulen más facturas abiertas y compromisos.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-[13px] font-bold text-slate-900">
          Drivers proyectados próximos {horizonteDias} días
        </h3>
        <span className="text-[11px] text-slate-500">
          {drivers.length} {drivers.length === 1 ? 'evento' : 'eventos'} ·{' '}
          {drivers.filter((d) => d.esCritico).length > 0 ? '⚠️ 1 crítico detectado' : 'sin críticos'}
        </span>
      </div>
      <div className="border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-[11px] min-w-[600px]">
          <thead className="bg-slate-50 text-slate-600 uppercase text-[9px] font-bold">
            <tr>
              <th className="text-left py-2 px-3">Fecha</th>
              <th className="text-left py-2 px-3">Evento</th>
              <th className="text-left py-2 px-3">Cuenta</th>
              <th className="text-right py-2 px-3">Monto</th>
              <th className="text-center py-2 px-3">Tipo</th>
              <th className="text-center py-2 px-3">Confianza</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular-nums">
            {drivers.map((d, idx) => (
              <DriverRow key={`${d.fecha.getTime()}-${idx}`} driver={d} onClick={onClickDriver} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface DriverRowProps {
  driver: DriverProyectado;
  onClick?: (driver: DriverProyectado) => void;
}

const DriverRow: React.FC<DriverRowProps> = ({ driver, onClick }) => {
  const tipoBadge = driver.esCritico ? 'pago_critico' : driver.tipo;
  return (
    <tr
      className={`${ROW_BG[tipoBadge]} ${onClick ? 'cursor-pointer hover:bg-slate-50' : ''} transition-colors`}
      onClick={() => onClick?.(driver)}
    >
      <td className={`py-2 px-3 font-bold ${driver.esCritico ? 'text-rose-900' : 'text-slate-900'}`}>
        {fmtFechaCorta(driver.fecha)}
        {driver.esCritico && ' ⚠️'}
      </td>
      <td className="py-2 px-3 text-slate-900 truncate max-w-[280px]" title={driver.descripcion}>
        {driver.descripcion}
      </td>
      <td className="py-2 px-3 text-slate-700">{driver.cuentaNombre}</td>
      <td className={`py-2 px-3 text-right font-bold whitespace-nowrap ${MONTO_TEXT[tipoBadge]}`}>
        {driver.monto > 0 ? '+' : '−'}
        {driver.moneda === 'USD' ? '$' : 'S/'} {fmt0(Math.abs(driver.monto))}
        {driver.montoUSDSecundario !== undefined && (
          <> + S/ {fmt0(Math.abs(driver.montoUSDSecundario))}</>
        )}
      </td>
      <td className="py-2 px-3 text-center">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${TIPO_BG[tipoBadge]}`}>
          {TIPO_LABEL[tipoBadge]}
        </span>
      </td>
      <td className="py-2 px-3 text-center">
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${CONFIANZA_BG[driver.confianza]}`}
        >
          {CONFIANZA_LABEL[driver.confianza]}
        </span>
      </td>
    </tr>
  );
};
