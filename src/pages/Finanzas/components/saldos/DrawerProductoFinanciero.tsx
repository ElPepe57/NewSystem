/**
 * DrawerProductoFinanciero — chk5.D-S3.ter · SF5
 *
 * Drawer lateral del detalle de producto financiero · canon MOCK 6 §2/§3.
 * Multi-variante · render dinámico según el `kind` del producto.
 *
 * Variantes implementadas:
 *   - cuenta_bancaria    · datos bancarios + canales digitales + saldo + saldo mínimo alerta
 *   - wallet_digital     · balance pendiente + próximo payout + comisión + histórico settles
 *   - tarjeta_credito    · ciclo (corte/pago) + tope control + cuenta pago default + bimoneda
 *   - tarjeta_debito     · cuenta vinculada + disponible Pool USD
 *   - caja_efectivo      · responsable + política operativa + histórico arqueos + operadores
 *   - caja_recaudadora   · responsable tercero + canales aceptados + saldo pendiente liquidar
 *
 * Footer acciones · canon N10:
 *   - Histórico / Ver settles (slate neutral)
 *   - Editar / Ajustar (indigo destacado)
 *   - Acción primary específica por variante:
 *       · Cuenta bancaria   → "Conciliar"
 *       · Wallet            → "Forzar payout"
 *       · TC                → "Pagar TC"
 *       · TC débito         → "Ver Pool USD"
 *       · Caja efectivo     → "Nuevo arqueo"
 *       · Caja recaudadora  → "Liquidar"
 */

import React, { useEffect } from 'react';
import {
  X,
  Percent,
  History,
  LineChart,
  Settings,
  Users,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  ArrowLeftRight,
  Download,
} from 'lucide-react';
import type { ProductoFinancieroUnif, KindProductoSaldo } from './saldosHelpers';
import {
  bancoCortoDe,
  esBiMonedaDe,
  gradientBancoDe,
  kindFinalDe,
  monedaPrincipalDe,
  nombreDe,
  saldoPENDe,
  saldoUSDDe,
  titularNombreDe,
} from './saldosHelpers';
import type { CuentaCaja } from '../../../../types/tesoreria.types';
import type { TarjetaCredito } from '../../../../types/tarjetaCredito.types';
import type { ProductoFinanciero } from '../../../../types/productoFinanciero.types';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface DrawerProductoFinancieroProps {
  producto: ProductoFinancieroUnif;
  onClose: () => void;
  /** Acción primary derecha · varía por variante */
  onAccionPrimary?: () => void;
  /** Acción secundaria · Editar / Ajustar */
  onEditar?: () => void;
  /** Footer izquierda · Histórico / Ver settles */
  onVerHistorico?: () => void;
}

// ═════════════════════════════════════════════════════════════════════════
// MAPS canon
// ═════════════════════════════════════════════════════════════════════════

const HEADER_BG: Record<KindProductoSaldo, string> = {
  cuenta_bancaria: 'bg-gradient-to-br from-teal-50 to-teal-100/40 border-teal-200',
  wallet_digital: 'bg-gradient-to-br from-sky-50 to-sky-100/40 border-sky-200',
  tarjeta_credito: 'bg-gradient-to-br from-amber-50 to-amber-100/40 border-amber-200',
  tarjeta_debito: 'bg-gradient-to-br from-indigo-50 to-indigo-100/40 border-indigo-200',
  caja_efectivo: 'bg-gradient-to-br from-slate-50 to-slate-100/40 border-slate-200',
  caja_recaudadora: 'bg-gradient-to-br from-purple-50 to-purple-100/40 border-purple-200',
};

const PRIMARY_BTN: Record<KindProductoSaldo, string> = {
  cuenta_bancaria: 'bg-teal-600 hover:bg-teal-700',
  wallet_digital: 'bg-sky-600 hover:bg-sky-700',
  tarjeta_credito: 'bg-amber-600 hover:bg-amber-700',
  tarjeta_debito: 'bg-indigo-600 hover:bg-indigo-700',
  caja_efectivo: 'bg-slate-700 hover:bg-slate-800',
  caja_recaudadora: 'bg-purple-600 hover:bg-purple-700',
};

const PRIMARY_BTN_LABEL: Record<KindProductoSaldo, string> = {
  cuenta_bancaria: 'Conciliar',
  wallet_digital: 'Forzar payout',
  tarjeta_credito: 'Pagar TC',
  tarjeta_debito: 'Ver Pool USD',
  caja_efectivo: 'Nuevo arqueo',
  caja_recaudadora: 'Liquidar',
};

const PRIMARY_BTN_ICON: Record<KindProductoSaldo, React.ComponentType<{ className?: string }>> = {
  cuenta_bancaria: ArrowLeftRight,
  wallet_digital: Download,
  tarjeta_credito: CreditCard,
  tarjeta_debito: ArrowLeftRight,
  caja_efectivo: ClipboardCheck,
  caja_recaudadora: ArrowLeftRight,
};

// ═════════════════════════════════════════════════════════════════════════
// HELPERS · formato
// ═════════════════════════════════════════════════════════════════════════

const fmt0 = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export const DrawerProductoFinanciero: React.FC<DrawerProductoFinancieroProps> = ({
  producto,
  onClose,
  onAccionPrimary,
  onEditar,
  onVerHistorico,
}) => {
  const kind = kindFinalDe(producto);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const PrimaryIcon = PRIMARY_BTN_ICON[kind];

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-end sm:items-stretch sm:justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-prod-title"
    >
      <aside
        className="bg-white rounded-t-2xl sm:rounded-none sm:max-w-[560px] w-full sm:h-full flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── HEADER comun · variant por kind ──────────────────────── */}
        <DrawerHeader producto={producto} kind={kind} onClose={onClose} />

        {/* ─── CONTENIDO · multi-variante ──────────────────────────── */}
        <div className="flex-1 p-5 space-y-4 overflow-y-auto">
          {kind === 'cuenta_bancaria' && (
            <ContenidoCuentaBancaria cuenta={producto.kindData as CuentaCaja} />
          )}
          {kind === 'wallet_digital' && (
            <ContenidoWallet cuenta={producto.kindData as CuentaCaja} />
          )}
          {kind === 'tarjeta_credito' && (
            <ContenidoTC tarjeta={producto.kindData as TarjetaCredito} producto={producto} />
          )}
          {kind === 'tarjeta_debito' && (
            <ContenidoTCDebito cuenta={producto.kindData as CuentaCaja} />
          )}
          {kind === 'caja_efectivo' && (
            <ContenidoCajaEfectivo cuenta={producto.kindData as CuentaCaja} />
          )}
          {kind === 'caja_recaudadora' && producto.kind === 'caja_recaudadora' && (
            <ContenidoRecaudadora
              pf={producto.kindData as ProductoFinanciero}
              saldoPendiente={producto.saldoPendientePEN}
            />
          )}
        </div>

        {/* ─── FOOTER acciones · canon N10 ────────────────────────── */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-2 flex-wrap">
          {onVerHistorico ? (
            <button
              type="button"
              onClick={onVerHistorico}
              className="text-[11px] font-semibold text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg"
            >
              {kind === 'wallet_digital' ? 'Ver settles' : 'Histórico'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {onEditar && (
              <button
                type="button"
                onClick={onEditar}
                className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg"
              >
                {kind === 'caja_efectivo' ? 'Ajustar' : 'Editar'}
              </button>
            )}
            {onAccionPrimary && (
              <button
                type="button"
                onClick={onAccionPrimary}
                className={`text-[11px] font-bold text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${PRIMARY_BTN[kind]}`}
              >
                <PrimaryIcon className="w-3 h-3" />
                {PRIMARY_BTN_LABEL[kind]}
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// HEADER COMÚN
// ═════════════════════════════════════════════════════════════════════════

interface DrawerHeaderProps {
  producto: ProductoFinancieroUnif;
  kind: KindProductoSaldo;
  onClose: () => void;
}

const DrawerHeader: React.FC<DrawerHeaderProps> = ({ producto, kind, onClose }) => {
  const gradient = gradientBancoDe(producto);
  const banco = bancoCortoDe(producto);
  const pen = saldoPENDe(producto);
  const usd = saldoUSDDe(producto);
  const isBi = esBiMonedaDe(producto);
  const moneda = monedaPrincipalDe(producto);

  // Para TC el saldo es negativo (deuda) · mostramos magnitud absoluta con signo
  const esTC = kind === 'tarjeta_credito';
  const esTCDebito = kind === 'tarjeta_debito';

  return (
    <div className={`border-b px-5 py-4 ${HEADER_BG[kind]}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-[12px] font-bold ring-2 ring-white/40 flex-shrink-0"
            style={{ background: gradient }}
          >
            {esTC || esTCDebito ? <CreditCard className="w-6 h-6" /> : banco}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span id="drawer-prod-title" className="text-[14px] font-bold text-slate-900">
                {nombreDe(producto)}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              Titular: <strong>{titularNombreDe(producto)}</strong>
              {!esTCDebito && (
                <>
                  {' · '}
                  {isBi ? 'Bimoneda PEN+USD' : `Moneda ${moneda}`}
                </>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700"
          aria-label="Cerrar drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Saldo destacado · diferentes formatos por kind */}
      <div className="bg-white rounded-lg p-3 ring-1 ring-slate-200">
        <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1">
          {esTC || esTCDebito ? 'Deuda actual' : 'Saldo disponible'}
        </div>
        {esTCDebito ? (
          <>
            <div className="text-[20px] font-bold tabular-nums text-indigo-900">(de Pool USD)</div>
            <div className="text-[10px] text-indigo-700 mt-1">
              Esta TC débito vinculada NO tiene saldo propio · descuenta directo del Pool USD.
            </div>
          </>
        ) : isBi ? (
          <div className="flex items-end gap-3">
            <div>
              <div className="text-[9px] uppercase text-slate-500 font-bold">PEN</div>
              <div className="text-[18px] font-bold tabular-nums text-slate-900">
                {esTC ? '−' : ''}S/ {fmt0(Math.abs(pen))}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase text-slate-500 font-bold">USD</div>
              <div className="text-[18px] font-bold tabular-nums text-slate-900">
                {esTC ? '−' : ''}$ {fmt0(Math.abs(usd))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[22px] font-bold tabular-nums text-slate-900">
            {esTC ? '−' : ''}
            {moneda === 'USD' ? '$' : 'S/'} {fmt0(moneda === 'USD' ? Math.abs(usd) : Math.abs(pen))}
          </div>
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// CONTENIDOS POR VARIANTE
// ═════════════════════════════════════════════════════════════════════════

const ContenidoCuentaBancaria: React.FC<{ cuenta: CuentaCaja }> = ({ cuenta }) => {
  return (
    <>
      <SectionTitle icon={Settings} label="Datos bancarios" />
      <div className="bg-slate-50 rounded-lg p-3 text-[11px] space-y-1">
        <DataRow label="Banco" value={cuenta.bancoNombreCompleto ?? cuenta.banco ?? '—'} />
        {cuenta.numeroCuenta && <DataRow label="N° Cuenta" value={cuenta.numeroCuenta} mono />}
        {cuenta.cci && <DataRow label="CCI" value={cuenta.cci} mono />}
        {cuenta.productoFinanciero && (
          <DataRow label="Producto" value={labelProductoFinanciero(cuenta.productoFinanciero)} />
        )}
      </div>

      {cuenta.canalesDigitales && cuenta.canalesDigitales.length > 0 && (
        <>
          <SectionTitle icon={Users} label="Canales digitales activos" />
          <div className="flex flex-wrap gap-1 text-[10px]">
            {cuenta.canalesDigitales.map((cd) => (
              <span
                key={cd.tipo}
                className="bg-emerald-50 ring-1 ring-emerald-200 px-2 py-1 rounded-full text-emerald-700 font-bold"
              >
                {cd.tipo.charAt(0).toUpperCase() + cd.tipo.slice(1)} · {cd.identificador}
              </span>
            ))}
          </div>
        </>
      )}

      {(cuenta.saldoMinimo || cuenta.saldoMinimoPEN || cuenta.saldoMinimoUSD) && (
        <>
          <SectionTitle icon={LineChart} label="Saldo mínimo alerta" />
          <div className="bg-amber-50 ring-1 ring-amber-200/50 rounded-lg p-3 text-[11px] space-y-1">
            {cuenta.saldoMinimo && <DataRow label="Mono" value={`S/ ${fmt0(cuenta.saldoMinimo)}`} />}
            {cuenta.saldoMinimoPEN && <DataRow label="PEN" value={`S/ ${fmt0(cuenta.saldoMinimoPEN)}`} />}
            {cuenta.saldoMinimoUSD && <DataRow label="USD" value={`$ ${fmt0(cuenta.saldoMinimoUSD)}`} />}
          </div>
        </>
      )}
    </>
  );
};

const ContenidoWallet: React.FC<{ cuenta: CuentaCaja }> = ({ cuenta }) => {
  return (
    <>
      <SectionTitle icon={Percent} label="Configuración wallet" />
      <div className="bg-sky-50 ring-1 ring-sky-200/50 rounded-lg p-3 text-[11px] space-y-1">
        <DataRow label="Proveedor" value={labelProductoFinanciero(cuenta.productoFinanciero)} />
        <DataRow label="Moneda" value={cuenta.moneda ?? '—'} />
        {cuenta.banco && <DataRow label="Cuenta payout" value={cuenta.banco} />}
      </div>

      <div className="bg-amber-50 ring-1 ring-amber-200/50 rounded-lg p-3 text-[11px]">
        <strong className="text-amber-900">Comisión vigente:</strong>
        <div className="text-amber-700 mt-1">
          Las comisiones por transacción se aplican a CC-028 (Comisión pasarela). Estructura
          específica (% + fijo) se configura en el módulo Maestros.
        </div>
      </div>
    </>
  );
};

const ContenidoTC: React.FC<{ tarjeta: TarjetaCredito; producto: ProductoFinancieroUnif }> = ({
  tarjeta,
}) => {
  return (
    <>
      <SectionTitle icon={Settings} label="Ciclo · referencial" />
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-[9px] font-bold text-slate-500 uppercase">Día corte</div>
          <div className="font-bold tabular-nums text-slate-900">{tarjeta.diaCorte}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-[9px] font-bold text-slate-500 uppercase">Día pago</div>
          <div className="font-bold tabular-nums text-amber-700">{tarjeta.diaPago}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-[9px] font-bold text-slate-500 uppercase">Marca</div>
          <div className="font-bold text-slate-900">{tarjeta.marca ?? '—'}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-[9px] font-bold text-slate-500 uppercase">Últ. dígitos</div>
          <div className="font-bold font-mono text-slate-900">····{tarjeta.ultimosDigitos}</div>
        </div>
      </div>

      {(tarjeta.topeControlUSD || tarjeta.topeControlPEN) && (
        <>
          <SectionTitle icon={LineChart} label="Tope control (alerta · no bloquea)" />
          <div className="bg-amber-50 ring-1 ring-amber-200/50 rounded-lg p-3 text-[11px] space-y-1">
            {tarjeta.topeControlUSD && (
              <DataRow label="USD" value={`$ ${fmt0(tarjeta.topeControlUSD)}`} />
            )}
            {tarjeta.topeControlPEN && (
              <DataRow label="PEN" value={`S/ ${fmt0(tarjeta.topeControlPEN)}`} />
            )}
          </div>
        </>
      )}

      <div className="bg-indigo-50 ring-1 ring-indigo-200/50 rounded-lg p-3 text-[11px] text-indigo-900">
        <strong>Pago al banco:</strong>{' '}
        {tarjeta.titularidad === 'personal'
          ? 'Reembolso al titular · se elige cuenta origen al momento del pago.'
          : tarjeta.cuentaPagoDefaultId
          ? `Cuenta default configurada (ID: ${tarjeta.cuentaPagoDefaultId.slice(0, 12)}…)`
          : 'Sin cuenta default · se elige al momento del pago.'}
      </div>
    </>
  );
};

const ContenidoTCDebito: React.FC<{ cuenta: CuentaCaja }> = ({ cuenta }) => {
  return (
    <>
      <SectionTitle icon={ArrowLeftRight} label="Cuenta vinculada" />
      <div className="bg-indigo-50 ring-1 ring-indigo-200/50 rounded-lg p-3 text-[11px] space-y-1">
        {cuenta.cuentaVinculadaId ? (
          <DataRow label="ID cuenta origen" value={cuenta.cuentaVinculadaId.slice(0, 16) + '…'} mono />
        ) : (
          <div className="text-indigo-700 italic">Vinculación pendiente de configurar.</div>
        )}
        <div className="pt-2 text-[10px] text-indigo-700">
          Las compras con esta TC débito descuentan directo del saldo de la cuenta vinculada (Pool
          USD si es USD). NO genera deuda propia.
        </div>
      </div>
    </>
  );
};

const ContenidoCajaEfectivo: React.FC<{ cuenta: CuentaCaja }> = ({ cuenta }) => {
  return (
    <>
      <SectionTitle icon={Settings} label="Política operativa" />
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-[9px] font-bold text-slate-500 uppercase">Límite máx</div>
          <div className="font-bold tabular-nums text-slate-900">
            {cuenta.saldoMinimo ? `S/ ${fmt0(cuenta.saldoMinimo)}` : '—'}
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-[9px] font-bold text-slate-500 uppercase">Moneda</div>
          <div className="font-bold text-slate-900">{cuenta.moneda ?? 'PEN'}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-[9px] font-bold text-slate-500 uppercase">Responsable</div>
          <div className="font-bold text-slate-900 truncate">{cuenta.titular ?? '—'}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-[9px] font-bold text-slate-500 uppercase">Estado</div>
          <div className="font-bold text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> {cuenta.activa ? 'Activa' : 'Inactiva'}
          </div>
        </div>
      </div>

      <div className="bg-amber-50 ring-1 ring-amber-200/50 rounded-lg p-3 text-[11px] text-amber-900">
        <strong>Histórico arqueos:</strong> próximamente en chk5.D-S4 · drill completo con
        diferencias detectadas + auditoría por arqueo.
      </div>
    </>
  );
};

const ContenidoRecaudadora: React.FC<{ pf: ProductoFinanciero; saldoPendiente: number }> = ({
  pf,
  saldoPendiente,
}) => {
  return (
    <>
      <SectionTitle icon={Users} label="Responsable tercero" />
      <div className="bg-purple-50 ring-1 ring-purple-200/50 rounded-lg p-3 text-[11px] space-y-1">
        <DataRow label="Nombre" value={pf.responsableTerceroNombre ?? '—'} />
        <DataRow label="Tipo" value={pf.responsableTerceroTipo ?? '—'} />
        {pf.responsableTerceroId && (
          <DataRow label="ID" value={pf.responsableTerceroId.slice(0, 12) + '…'} mono />
        )}
      </div>

      {pf.canalesAceptados && pf.canalesAceptados.length > 0 && (
        <>
          <SectionTitle icon={Percent} label={`Canales aceptados (${pf.canalesAceptados.length})`} />
          <div className="flex flex-wrap gap-1 text-[10px]">
            {pf.canalesAceptados.map((c) => (
              <span
                key={c.tipo}
                className={`px-2 py-1 rounded-full font-bold ${
                  c.activo
                    ? 'bg-purple-50 ring-1 ring-purple-200 text-purple-700'
                    : 'bg-slate-50 ring-1 ring-slate-200 text-slate-400 line-through'
                }`}
              >
                {c.tipo.toUpperCase()}
                {c.identificador && ` · ${c.identificador}`}
              </span>
            ))}
          </div>
        </>
      )}

      <SectionTitle icon={History} label="Saldo pendiente liquidar" />
      <div className="bg-purple-50 ring-1 ring-purple-200/50 rounded-lg p-3 text-[11px]">
        <div className="text-[14px] font-bold tabular-nums text-purple-900">
          S/ {fmt0(saldoPendiente)}
        </div>
        <div className="text-[10px] text-purple-700 mt-1">
          Cobros entrantes − servicios descontados − liquidaciones efectuadas. Liquidar transfiere
          a cuenta bancaria de destino configurada.
        </div>
      </div>
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES INLINE
// ═════════════════════════════════════════════════════════════════════════

interface SectionTitleProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const SectionTitle: React.FC<SectionTitleProps> = ({ icon: Icon, label }) => (
  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 flex items-center gap-1.5">
    <Icon className="w-3.5 h-3.5" /> {label}
  </div>
);

interface DataRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

const DataRow: React.FC<DataRowProps> = ({ label, value, mono }) => (
  <div className="flex justify-between gap-2">
    <span className="text-slate-700">{label}</span>
    <span className={`font-bold text-slate-900 ${mono ? 'font-mono text-[10px]' : ''} truncate`}>
      {value}
    </span>
  </div>
);

function labelProductoFinanciero(pf: CuentaCaja['productoFinanciero']): string {
  const map: Record<string, string> = {
    cuenta_ahorros: 'Cuenta de ahorros',
    cuenta_corriente: 'Cuenta corriente',
    tarjeta_debito: 'Tarjeta débito (vinculada)',
    caja: 'Caja efectivo',
    mercadopago: 'Mercado Pago',
    paypal: 'PayPal',
    zelle: 'Zelle',
    wise: 'Wise',
    binance: 'Binance',
    tarjeta_credito: 'Tarjeta de crédito (legacy)',
    billetera_digital: 'Billetera digital (legacy)',
  };
  return pf ? map[pf] ?? pf : '—';
}
