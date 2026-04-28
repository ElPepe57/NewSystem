/**
 * TarjetaDetailModal — S58d F5
 *
 * Modal grande con detalle completo de una tarjeta:
 *   - Header hero con plástico grande + saldo CC + cargos pendientes count
 *   - Tabs:
 *     1. Cargos · todos (pendientes + pagados) con descripción y estado
 *     2. Pagos · estado de cuenta · banco / reembolso con monto y diferencial
 *     3. Extracto CC · reutiliza CuentaCorrienteTab para movimientos detallados
 *
 * Acciones rápidas:
 *   - "Cargar a tarjeta" (abre wizard)
 *   - "Pagar/Reembolsar" (abre wizard)
 *   - "Editar" (abre form)
 */

import React, { useState } from 'react';
import {
  X,
  Receipt,
  HandCoins,
  Pencil,
  Building,
  IdCard,
  CircleAlert,
  CheckCheck,
  Clock,
  CircleCheck,
  ArrowDown,
  ArrowUp,
  Wallet,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { CuentaCorrienteTab } from '../../../components/modules/cuentaCorriente';
import type { TarjetaCredito } from '../../../types/tarjetaCredito.types';
import type { Timestamp } from 'firebase/firestore';
import { cn } from '../../../design-system/utils';
import {
  useSaldoCCTarjeta,
  useCargosTarjeta,
  usePagosTarjeta,
} from './hooks';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface TarjetaDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  tarjeta: TarjetaCredito | null;
  onCargar?: (tarjeta: TarjetaCredito) => void;
  onPagar?: (tarjeta: TarjetaCredito) => void;
  onEditar?: (tarjeta: TarjetaCredito) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

type TabActivo = 'cargos' | 'pagos' | 'extracto';

function formatMoney(n: number, moneda: 'USD' | 'PEN'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  return `${sym} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFecha(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getCardGradient(banco: string, marca?: string): string {
  const b = banco.toLowerCase();
  if (b.includes('bbva')) return 'bg-gradient-to-br from-blue-700 to-blue-500';
  if (b.includes('bcp')) return 'bg-gradient-to-br from-indigo-800 to-sky-500';
  if (b.includes('interbank') || b.includes('ibk'))
    return 'bg-gradient-to-br from-emerald-700 to-emerald-500';
  if (b.includes('scotia')) return 'bg-gradient-to-br from-red-700 to-red-500';
  if (marca === 'amex') return 'bg-gradient-to-br from-slate-800 to-slate-600';
  return 'bg-gradient-to-br from-slate-700 to-slate-500';
}

// ═════════════════════════════════════════════════════════════════════════
// TAB BUTTON
// ═════════════════════════════════════════════════════════════════════════

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
}> = ({ active, onClick, icon: Icon, label, count }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex items-center gap-1.5 py-2.5 px-3 text-[12px] font-medium border-b-2 transition-colors',
      active
        ? 'border-amber-500 text-amber-700'
        : 'border-transparent text-slate-500 hover:text-slate-700',
    )}
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
    {count !== undefined && count > 0 && (
      <span
        className={cn(
          'text-[9px] px-1.5 py-0.5 rounded-full font-bold',
          active ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600',
        )}
      >
        {count}
      </span>
    )}
  </button>
);

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const TarjetaDetailModal: React.FC<TarjetaDetailModalProps> = ({
  isOpen,
  onClose,
  tarjeta,
  onCargar,
  onPagar,
  onEditar,
}) => {
  const [tab, setTab] = useState<TabActivo>('cargos');

  const { saldoUSD, saldoPEN, loading: loadingSaldo } = useSaldoCCTarjeta(
    tarjeta?.id,
  );
  const { cargos, loading: loadingCargos } = useCargosTarjeta(tarjeta?.id);
  const { pagos, loading: loadingPagos } = usePagosTarjeta(tarjeta?.id);

  if (!isOpen || !tarjeta) return null;

  const titularidad = tarjeta.titularidad ?? 'empresa';
  const esPersonal = titularidad === 'personal';

  const cargosPendientes = cargos.filter((c) => c.estado !== 'pagado');
  const cargosPagados = cargos.filter((c) => c.estado === 'pagado');

  const monedaPrincipal = tarjeta.moneda;
  const saldoPrincipal = monedaPrincipal === 'USD' ? saldoUSD : saldoPEN;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="xl" contentPadding="none">
      <div className="flex flex-col">
        {/* HEADER · Plástico + saldo */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Plástico */}
            <div
              className={cn(
                getCardGradient(tarjeta.banco, tarjeta.marca),
                'text-white rounded-xl p-4 shadow-md w-72 flex-shrink-0 relative',
              )}
            >
              <div
                className={cn(
                  'absolute top-2 right-2 text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold',
                  esPersonal
                    ? 'bg-sky-500/30 text-sky-50'
                    : 'bg-emerald-500/30 text-emerald-50',
                )}
              >
                {esPersonal
                  ? `Personal · ${tarjeta.titularNombre?.split(' ')[0] || 'Titular'}`
                  : 'Empresarial'}
              </div>
              <div className="flex items-center justify-between mb-6">
                <div className="text-[10px] uppercase tracking-wider opacity-80">
                  {tarjeta.banco}
                </div>
                {tarjeta.marca && (
                  <div className="text-[10px] uppercase tracking-wider opacity-80">
                    {tarjeta.marca}
                  </div>
                )}
              </div>
              <div className="text-[11px] font-mono opacity-70 tracking-widest">
                •••• •••• •••• {tarjeta.ultimosDigitos}
              </div>
              <div className="flex items-end justify-between mt-3">
                <div>
                  <div className="text-[8px] uppercase tracking-wider opacity-60">
                    Titular
                  </div>
                  <div className="text-[11px] font-medium uppercase">
                    {(tarjeta.titularNombre || 'Vita Skin Peru SAC').toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* Saldo principal + KPIs */}
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                {esPersonal
                  ? `Deuda con ${tarjeta.titularNombre?.split(' ')[0] || 'titular'}`
                  : `Deuda con ${tarjeta.banco} (banco emisor)`}
              </div>
              <div
                className={cn(
                  'text-3xl font-bold tabular-nums',
                  saldoPrincipal > 0.01
                    ? 'text-red-700'
                    : saldoPrincipal < -0.01
                      ? 'text-emerald-700'
                      : 'text-slate-400',
                )}
              >
                {loadingSaldo
                  ? '…'
                  : saldoPrincipal > 0.01
                    ? `−${formatMoney(saldoPrincipal, monedaPrincipal)}`
                    : saldoPrincipal < -0.01
                      ? `+${formatMoney(Math.abs(saldoPrincipal), monedaPrincipal)}`
                      : formatMoney(0, monedaPrincipal)}
              </div>
              {tarjeta.esBiMoneda &&
                Math.abs(monedaPrincipal === 'USD' ? saldoPEN : saldoUSD) > 0.01 && (
                  <div className="text-[12px] text-slate-600 mt-0.5 tabular-nums">
                    +{' '}
                    {formatMoney(
                      Math.abs(monedaPrincipal === 'USD' ? saldoPEN : saldoUSD),
                      monedaPrincipal === 'USD' ? 'PEN' : 'USD',
                    )}{' '}
                    en {monedaPrincipal === 'USD' ? 'PEN' : 'USD'}
                  </div>
                )}

              {/* Mini KPIs */}
              <div className="grid grid-cols-3 gap-3 mt-4 max-w-md">
                <div>
                  <div className="text-[9px] uppercase text-slate-500 font-semibold tracking-wider">
                    Cargos pend.
                  </div>
                  <div className="text-[14px] font-bold text-slate-900">
                    {loadingCargos ? '…' : cargosPendientes.length}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-slate-500 font-semibold tracking-wider">
                    Cargos pagados
                  </div>
                  <div className="text-[14px] font-bold text-slate-900">
                    {loadingCargos ? '…' : cargosPagados.length}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-slate-500 font-semibold tracking-wider">
                    {esPersonal ? 'Reembolsos' : 'Pagos'}
                  </div>
                  <div className="text-[14px] font-bold text-slate-900">
                    {loadingPagos ? '…' : pagos.length}
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {onCargar && (
                  <button
                    type="button"
                    onClick={() => onCargar(tarjeta)}
                    className="text-[11px] px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-md font-semibold flex items-center gap-1.5"
                  >
                    <Receipt className="w-3 h-3" />
                    Cargar a tarjeta
                  </button>
                )}
                {onPagar && (
                  <button
                    type="button"
                    onClick={() => onPagar(tarjeta)}
                    className={cn(
                      'text-[11px] px-3 py-1.5 border rounded-md font-semibold flex items-center gap-1.5',
                      esPersonal
                        ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
                    )}
                  >
                    <HandCoins className="w-3 h-3" />
                    {esPersonal ? 'Reembolsar al titular' : 'Pagar al banco'}
                  </button>
                )}
                {onEditar && (
                  <button
                    type="button"
                    onClick={() => onEditar(tarjeta)}
                    className="text-[11px] px-3 py-1.5 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-md font-medium flex items-center gap-1.5"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </button>
                )}
              </div>
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="border-b border-slate-200 bg-white px-4">
          <div className="flex items-center gap-1">
            <TabButton
              active={tab === 'cargos'}
              onClick={() => setTab('cargos')}
              icon={Receipt}
              label="Cargos"
              count={cargos.length}
            />
            <TabButton
              active={tab === 'pagos'}
              onClick={() => setTab('pagos')}
              icon={HandCoins}
              label={esPersonal ? 'Reembolsos' : 'Pagos al banco'}
              count={pagos.length}
            />
            <TabButton
              active={tab === 'extracto'}
              onClick={() => setTab('extracto')}
              icon={Wallet}
              label="Extracto CC"
            />
          </div>
        </div>

        {/* CONTENIDO TABS */}
        <div className="px-6 py-5 max-h-[60vh] overflow-auto">
          {tab === 'cargos' && (
            <CargosTab
              cargos={cargos}
              loading={loadingCargos}
              moneda={monedaPrincipal}
            />
          )}
          {tab === 'pagos' && (
            <PagosTab
              pagos={pagos}
              loading={loadingPagos}
              moneda={monedaPrincipal}
              esPersonal={esPersonal}
            />
          )}
          {tab === 'extracto' && (
            <CuentaCorrienteTab
              entidadId={tarjeta.id}
              tipo="tarjeta_credito"
              entidadNombre={tarjeta.nombre}
              showSaldoBanner={false}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// TAB: Cargos
// ═════════════════════════════════════════════════════════════════════════

const CargosTab: React.FC<{
  cargos: import('../../../types/tarjetaCredito.types').CargoTarjeta[];
  loading: boolean;
  moneda: 'USD' | 'PEN';
}> = ({ cargos, loading, moneda }) => {
  if (loading) {
    return (
      <div className="text-center py-8 text-[12px] text-slate-500">
        Cargando cargos…
      </div>
    );
  }
  if (cargos.length === 0) {
    return (
      <div className="text-center py-8 px-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
        <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-[12px] text-slate-500 font-medium">Sin cargos</p>
        <p className="text-[11px] text-slate-400 mt-1">
          Esta tarjeta no tiene movimientos registrados todavía.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {cargos.map((cargo) => {
        const estadoIcon =
          cargo.estado === 'pagado'
            ? CheckCheck
            : cargo.estado === 'parcial'
              ? Clock
              : CircleAlert;
        const estadoColor =
          cargo.estado === 'pagado'
            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
            : cargo.estado === 'parcial'
              ? 'text-amber-700 bg-amber-50 border-amber-200'
              : 'text-slate-600 bg-slate-50 border-slate-200';
        const Icon = estadoIcon;
        return (
          <div
            key={cargo.id}
            className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-[12px] font-semibold text-slate-900">
                    {cargo.numeroCargo}
                  </span>
                  <span
                    className={cn(
                      'text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-bold flex items-center gap-0.5',
                      estadoColor,
                    )}
                  >
                    <Icon className="w-2.5 h-2.5" />
                    {cargo.estado}
                  </span>
                </div>
                <div className="text-[12px] text-slate-700 truncate">
                  {cargo.descripcion}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {formatFecha(cargo.fecha)}
                  {cargo.documentosCancelados.length > 0 && (
                    <>
                      {' · '}
                      {cargo.documentosCancelados.length} documento
                      {cargo.documentosCancelados.length !== 1 ? 's' : ''}{' '}
                      cancelado
                      {cargo.documentosCancelados.length !== 1 ? 's' : ''}
                    </>
                  )}
                  {cargo.tcDelDia && (
                    <>{' · '}TC {cargo.tcDelDia.toFixed(3)}</>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[14px] font-bold text-slate-900 tabular-nums">
                  {formatMoney(cargo.monto, cargo.moneda)}
                </div>
                {cargo.estado === 'parcial' && (
                  <div className="text-[10px] text-amber-700 tabular-nums">
                    {formatMoney(cargo.montoPagado, cargo.moneda)} pagado
                  </div>
                )}
                {cargo.estado === 'pagado' &&
                  cargo.diferencialCambiarioPEN !== undefined &&
                  Math.abs(cargo.diferencialCambiarioPEN) > 0.01 && (
                    <div
                      className={cn(
                        'text-[10px] tabular-nums font-semibold',
                        cargo.diferencialCambiarioPEN > 0
                          ? 'text-emerald-700'
                          : 'text-red-700',
                      )}
                    >
                      Δ{' '}
                      {cargo.diferencialCambiarioPEN > 0 ? '+' : ''}
                      S/ {cargo.diferencialCambiarioPEN.toFixed(2)}
                    </div>
                  )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// TAB: Pagos
// ═════════════════════════════════════════════════════════════════════════

const PagosTab: React.FC<{
  pagos: import('../../../types/tarjetaCredito.types').PagoEstadoCuentaTarjeta[];
  loading: boolean;
  moneda: 'USD' | 'PEN';
  esPersonal: boolean;
}> = ({ pagos, loading, esPersonal }) => {
  if (loading) {
    return (
      <div className="text-center py-8 text-[12px] text-slate-500">
        Cargando pagos…
      </div>
    );
  }
  if (pagos.length === 0) {
    return (
      <div className="text-center py-8 px-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
        <HandCoins className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-[12px] text-slate-500 font-medium">
          Sin {esPersonal ? 'reembolsos' : 'pagos'}
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          {esPersonal
            ? 'Aún no se han reembolsado cargos al titular.'
            : 'Aún no se ha pagado el estado de cuenta al banco.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pagos.map((pago) => {
        const ModoIcon = pago.modo === 'reembolso_titular' ? IdCard : Building;
        const modoTone =
          pago.modo === 'reembolso_titular'
            ? 'text-sky-700 bg-sky-50 border-sky-200'
            : 'text-amber-700 bg-amber-50 border-amber-200';
        return (
          <div
            key={pago.id}
            className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-[12px] font-semibold text-slate-900">
                    {pago.numeroPago}
                  </span>
                  <span
                    className={cn(
                      'text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-bold flex items-center gap-0.5',
                      modoTone,
                    )}
                  >
                    <ModoIcon className="w-2.5 h-2.5" />
                    {pago.modo === 'reembolso_titular' ? 'Reembolso' : 'Banco'}
                  </span>
                </div>
                <div className="text-[12px] text-slate-700 truncate">
                  Desde {pago.cuentaOrigenNombre}
                  {pago.modo === 'reembolso_titular' && pago.titularNombre && (
                    <> · a {pago.titularNombre}</>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {formatFecha(pago.fecha)}
                  {' · '}
                  {pago.aplicaciones.length} cargo
                  {pago.aplicaciones.length !== 1 ? 's' : ''} saldado
                  {pago.aplicaciones.length !== 1 ? 's' : ''}
                  {' · '}TC {pago.tipoCambio.toFixed(3)}
                  {pago.referencia && <> · {pago.referencia}</>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[14px] font-bold text-slate-900 tabular-nums flex items-center gap-1">
                  <ArrowDown className="w-3 h-3 text-red-500" />
                  {formatMoney(pago.monto, pago.moneda)}
                </div>
                {pago.modo === 'banco_emisor' &&
                  pago.diferencialCambiarioPENTotal !== undefined &&
                  Math.abs(pago.diferencialCambiarioPENTotal) > 0.01 && (
                    <div
                      className={cn(
                        'text-[10px] tabular-nums font-semibold',
                        pago.diferencialCambiarioPENTotal > 0
                          ? 'text-emerald-700'
                          : 'text-red-700',
                      )}
                    >
                      Δ{' '}
                      {pago.diferencialCambiarioPENTotal > 0 ? '+' : ''}
                      S/ {pago.diferencialCambiarioPENTotal.toFixed(2)}
                    </div>
                  )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
