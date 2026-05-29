/**
 * Componente Balance General · canon v5.1 chk5.E-S3
 *
 * Pixel-perfect contra docs/mockups/contabilidad-tab-balance-general-v5.1.html
 * - Sin header interno (el shell de Contabilidad ya lo provee)
 * - §1 Ecuación contable header banner
 * - §2 Grid 3 columnas: Activo (teal) | Pasivo (rose) | Patrimonio (indigo)
 * - Headers gradient FROM-500 TO-700 por columna
 * - Sub-secciones colapsables (Corriente vs No Corriente)
 * - Anticipos cross-cutting purple · Utilidad período cross-cutting amber
 * - Footer cada columna color-50 con TOTAL bold tabular
 * - §3 Banner cuadre emerald al final
 */

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  CreditCard,
  PiggyBank,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Scale,
  Loader2,
  Lightbulb,
} from 'lucide-react';
// chk5.PERF-CACHE · balance vía cache compartido (cross-módulo · dedup · TTL).
import { getBalanceGeneralCached } from '../../../services/contabilidadCache';
import type { BalanceGeneral as BalanceGeneralType } from '../../../types/contabilidad.types';
import { formatCurrencyPEN } from '../../../utils/format';
// chk5.E-B · Sprint B · donuts composición + tooltips
import { DonutChartCanon, TooltipPedagogico } from '../../common';
import type { DonutSegment } from '../../common';

const formatCurrency = (value: number): string => formatCurrencyPEN(value);

// ============================================================================
// SUB-COMPONENTES (hoist arriba del default export)
// ============================================================================

interface SubSeccionColapsableProps {
  titulo: string;
  total: number;
  color: 'teal' | 'rose' | 'indigo';
  defaultOpen?: boolean;
  emptyMsg?: string;
  children?: React.ReactNode;
}

function SubSeccionColapsable({
  titulo,
  total,
  color,
  defaultOpen = true,
  emptyMsg,
  children,
}: SubSeccionColapsableProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const labelColor =
    color === 'teal'
      ? 'text-teal-700'
      : color === 'rose'
      ? 'text-rose-700'
      : 'text-indigo-700';
  const valueColor =
    color === 'teal'
      ? 'text-teal-900'
      : color === 'rose'
      ? 'text-rose-900'
      : 'text-indigo-900';

  return (
    <div className="px-4 py-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span className={`text-[11px] uppercase tracking-wider font-bold ${labelColor}`}>
            {titulo}
          </span>
        </div>
        <span className={`text-[13px] font-bold tabular-nums ${valueColor}`}>
          {formatCurrency(total)}
        </span>
      </button>
      {isOpen && (
        <div className="mt-2 ml-5 space-y-1 text-[12px]">
          {children || (
            <div className="text-[10px] text-slate-500 italic">{emptyMsg || 'Sin movimientos'}</div>
          )}
        </div>
      )}
    </div>
  );
}

interface LineaItemProps {
  label: string;
  valor: number;
  detalleMl3?: string;
}

function LineaItem({ label, valor, detalleMl3 }: LineaItemProps) {
  return (
    <>
      <div className="flex justify-between">
        <span className="text-slate-600">{label}</span>
        <span className="tabular-nums font-medium text-slate-900">{formatCurrency(valor)}</span>
      </div>
      {detalleMl3 && (
        <div className="flex justify-between ml-3 text-[11px] text-slate-500">
          <span>{detalleMl3}</span>
          <span></span>
        </div>
      )}
    </>
  );
}

interface ColumnaBalanceProps {
  titulo: string;
  icon: React.ReactNode;
  total: number;
  color: 'teal' | 'rose' | 'indigo';
  children: React.ReactNode;
}

function ColumnaBalance({ titulo, icon, total, color, children }: ColumnaBalanceProps) {
  const borderCls =
    color === 'teal'
      ? 'border-teal-200'
      : color === 'rose'
      ? 'border-rose-200'
      : 'border-indigo-200';
  const gradientCls =
    color === 'teal'
      ? 'from-teal-500 to-teal-700'
      : color === 'rose'
      ? 'from-rose-500 to-rose-700'
      : 'from-indigo-500 to-indigo-700';
  const footerBgCls =
    color === 'teal'
      ? 'bg-teal-50 border-teal-200'
      : color === 'rose'
      ? 'bg-rose-50 border-rose-200'
      : 'bg-indigo-50 border-indigo-200';
  const footerTextCls =
    color === 'teal'
      ? 'text-teal-900'
      : color === 'rose'
      ? 'text-rose-900'
      : 'text-indigo-900';

  return (
    <section className={`bg-white border ${borderCls} rounded-2xl overflow-hidden`}>
      {/* Header gradient FROM-500 TO-700 */}
      <div className={`bg-gradient-to-r ${gradientCls} text-white px-4 py-3`}>
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-bold flex items-center gap-2">
            {icon}
            {titulo}
          </h2>
          <span className="text-[16px] font-bold tabular-nums">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Cuerpo dividido */}
      <div className="divide-y divide-slate-100">{children}</div>

      {/* Footer TOTAL */}
      <div className={`${footerBgCls} px-4 py-2 flex justify-between items-center border-t`}>
        <span className={`text-[11px] uppercase tracking-wider font-bold ${footerTextCls}`}>
          TOTAL {titulo}
        </span>
        <span className={`text-[16px] font-bold tabular-nums ${footerTextCls}`}>
          {formatCurrency(total)}
        </span>
      </div>
    </section>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface Props {
  mes: number;
  anio: number;
}

export default function BalanceGeneral({ mes, anio }: Props) {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<BalanceGeneralType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cargarDatos = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getBalanceGeneralCached(mes, anio);
      setBalance(data);
    } catch (err) {
      console.error('Error cargando balance:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido al cargar el balance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [mes, anio]);

  // ===== LOADING STATE · canon v5.1 spinner purple + skeleton =====
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-50">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-slate-700">Calculando Balance General…</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Procesando activos · pasivos · patrimonio · TC
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl mx-auto pt-2">
          <div className="h-48 rounded-2xl bg-slate-100 animate-pulse"></div>
          <div className="h-48 rounded-2xl bg-slate-100 animate-pulse"></div>
          <div className="h-48 rounded-2xl bg-slate-100 animate-pulse"></div>
        </div>
      </div>
    );
  }

  // ===== ERROR STATE · canon v5.1 borde rose =====
  if (errorMsg || !balance) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-rose-600" />
        </div>
        <div>
          <div className="text-[14px] font-bold text-rose-900 mb-1">
            No se pudo cargar el Balance General
          </div>
          <div className="text-[11px] text-slate-600 max-w-md mx-auto">
            {errorMsg || 'Verificá que tengas movimientos registrados para este período'}
          </div>
        </div>
        <button
          onClick={cargarDatos}
          className="text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const { activos, pasivos, patrimonio } = balance;
  const totalCuadrado = activos.totalActivos - balance.totalPasivosPatrimonio;
  const balanceCuadra = balance.balanceCuadra;

  return (
    <div className="space-y-4">
      {/* §1 · Ecuación contable header banner */}
      <section className="bg-gradient-to-r from-slate-50 to-slate-100/40 ring-1 ring-slate-200/50 rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Scale className="w-5 h-5 text-slate-700" />
            <div>
              <div className="text-[13px] font-bold text-slate-900">
                Balance General · {balance.periodo.nombreMes} {balance.periodo.anio}
              </div>
              <div className="text-[11px] text-slate-500">
                Ecuación contable: <strong>ACTIVO = PASIVO + PATRIMONIO</strong>
                <span className="ml-2 text-slate-400">· TC: S/ {balance.tipoCambio.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Cuadre</div>
              {balanceCuadra ? (
                <div className="text-[14px] font-bold tabular-nums text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  OK · S/ 0.00
                </div>
              ) : (
                <div className="text-[14px] font-bold tabular-nums text-rose-700 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {formatCurrency(Math.abs(balance.diferencia))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* §1.5 · chk5.E-B · 3 donuts composición · NUEVO Sprint B */}
      <DonutsComposicion balance={balance} />

      {/* §2 · Grid 3 columnas: Activo | Pasivo | Patrimonio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ===== ACTIVO ===== */}
        <ColumnaBalance
          titulo="ACTIVO"
          icon={<Wallet className="w-4 h-4" />}
          total={activos.totalActivos}
          color="teal"
        >
          {/* Activo Corriente · expandido default */}
          <SubSeccionColapsable
            titulo="Activo Corriente"
            total={activos.corriente.total}
            color="teal"
            defaultOpen
          >
            <LineaItem
              label="Efectivo y equivalentes"
              valor={activos.corriente.efectivo.total}
            />
            <LineaItem
              label="Cuentas por cobrar · clientes"
              valor={activos.corriente.cuentasPorCobrar.ventasPendientes}
              detalleMl3={`· ${activos.corriente.cuentasPorCobrar.cantidadVentas} ventas pendientes`}
            />
            {activos.corriente.cuentasPorCobrar.provisionIncobrables > 0 && (
              <div className="flex justify-between ml-3 text-[11px] text-slate-500">
                <span>(−) Provisión incobrables</span>
                <span className="tabular-nums">
                  −{formatCurrency(activos.corriente.cuentasPorCobrar.provisionIncobrables)}
                </span>
              </div>
            )}
            <LineaItem
              label="Inventarios"
              valor={activos.corriente.inventarios.totalValorPEN}
            />
            {activos.corriente.inventarios.inventarioUSA.valorPEN > 0 && (
              <div className="flex justify-between ml-3 text-[11px] text-slate-500">
                <span>
                  · USA · {formatCurrency(activos.corriente.inventarios.inventarioUSA.valorPEN)}
                  {activos.corriente.inventarios.totalValorPEN > 0 &&
                    ` (${Math.round(
                      (activos.corriente.inventarios.inventarioUSA.valorPEN /
                        activos.corriente.inventarios.totalValorPEN) *
                        100,
                    )}%)`}
                </span>
                <span></span>
              </div>
            )}
            {activos.corriente.inventarios.inventarioPeru.valorPEN > 0 && (
              <div className="flex justify-between ml-3 text-[11px] text-slate-500">
                <span>
                  · Perú · {formatCurrency(activos.corriente.inventarios.inventarioPeru.valorPEN)}
                  {activos.corriente.inventarios.totalValorPEN > 0 &&
                    ` (${Math.round(
                      (activos.corriente.inventarios.inventarioPeru.valorPEN /
                        activos.corriente.inventarios.totalValorPEN) *
                        100,
                    )}%)`}
                </span>
                <span></span>
              </div>
            )}
          </SubSeccionColapsable>

          {/* Activo No Corriente · colapsado default */}
          <SubSeccionColapsable
            titulo="Activo No Corriente"
            total={activos.noCorriente.total}
            color="teal"
            defaultOpen={false}
            emptyMsg="(Activos fijos en módulo futuro · placeholder)"
          >
            {activos.noCorriente.propiedadPlantaEquipo &&
              activos.noCorriente.propiedadPlantaEquipo > 0 && (
                <LineaItem
                  label="Propiedad · planta y equipo"
                  valor={activos.noCorriente.propiedadPlantaEquipo}
                />
              )}
          </SubSeccionColapsable>
        </ColumnaBalance>

        {/* ===== PASIVO ===== */}
        <ColumnaBalance
          titulo="PASIVO"
          icon={<CreditCard className="w-4 h-4" />}
          total={pasivos.totalPasivos}
          color="rose"
        >
          {/* Pasivo Corriente · expandido default */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider font-bold text-rose-700">
                Pasivo Corriente
              </span>
              <span className="text-[13px] font-bold tabular-nums text-rose-900">
                {formatCurrency(pasivos.corriente.total)}
              </span>
            </div>
            <div className="ml-2 space-y-1 text-[12px]">
              <LineaItem
                label="CxP proveedores"
                valor={pasivos.corriente.cuentasPorPagarProveedores.ordenesCompraPendientes}
                detalleMl3={`· OCs recibidas sin pagar (${pasivos.corriente.cuentasPorPagarProveedores.cantidadOCs})`}
              />
              <LineaItem
                label="Otras CxP"
                valor={pasivos.corriente.otrasCuentasPorPagar.total}
                detalleMl3="· Gastos · pagos viajeros pendientes"
              />

              {/* Anticipos clientes · cross-cutting purple */}
              {pasivos.corriente.anticiposClientes &&
                pasivos.corriente.anticiposClientes.totalAnticiposPEN > 0 && (
                  <>
                    <div className="flex justify-between bg-purple-50 -mx-2 px-2 py-1 rounded mt-1">
                      <span className="text-purple-700 font-medium">Anticipos clientes</span>
                      <span className="tabular-nums font-bold text-purple-700">
                        {formatCurrency(pasivos.corriente.anticiposClientes.totalAnticiposPEN)}
                      </span>
                    </div>
                    <div className="flex justify-between ml-3 text-[11px] text-purple-600">
                      <span>
                        · {pasivos.corriente.anticiposClientes.cantidadVentas} ventas sin entregar
                        · pasivo
                      </span>
                      <span></span>
                    </div>
                  </>
                )}

              {pasivos.corriente.deudasFinancieras &&
                pasivos.corriente.deudasFinancieras.total > 0 && (
                  <LineaItem
                    label="Deudas TC bancos"
                    valor={pasivos.corriente.deudasFinancieras.total}
                  />
                )}
            </div>
          </div>

          {/* Pasivo No Corriente */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-bold text-rose-700">
                Pasivo No Corriente
              </span>
              <span className="text-[13px] font-bold tabular-nums text-rose-900">
                {formatCurrency(pasivos.noCorriente.total)}
              </span>
            </div>
            <div className="ml-2 mt-1 text-[10px] text-slate-500 italic">
              {pasivos.noCorriente.total === 0
                ? 'Sin deudas a largo plazo'
                : 'Deudas financieras a largo plazo'}
            </div>
          </div>
        </ColumnaBalance>

        {/* ===== PATRIMONIO ===== */}
        <ColumnaBalance
          titulo="PATRIMONIO"
          icon={<PiggyBank className="w-4 h-4" />}
          total={patrimonio.totalPatrimonio}
          color="indigo"
        >
          <div className="px-4 py-3 space-y-1 text-[12px]">
            <LineaItem label="Capital social" valor={patrimonio.capitalSocial} />
            {patrimonio.reservas !== undefined && patrimonio.reservas > 0 && (
              <LineaItem label="Reserva legal" valor={patrimonio.reservas} />
            )}
            <LineaItem
              label="Utilidades acumuladas"
              valor={patrimonio.utilidadesAcumuladas}
              detalleMl3="· años anteriores"
            />

            {/* Utilidad del período · cross-cutting amber */}
            <div className="flex justify-between bg-amber-50 -mx-2 px-2 py-1 rounded mt-1">
              <span className="text-amber-700 font-medium">Utilidad del período</span>
              <span className="tabular-nums font-bold text-amber-700">
                {formatCurrency(patrimonio.utilidadEjercicio)}
              </span>
            </div>
            <div className="flex justify-between ml-3 text-[11px] text-amber-600">
              <span>
                · {balance.periodo.nombreMes} {balance.periodo.anio}
              </span>
              <span></span>
            </div>
          </div>
        </ColumnaBalance>
      </div>

      {/* §3 · Validación de cuadre */}
      {balanceCuadra ? (
        <section className="bg-emerald-50 ring-1 ring-emerald-200 rounded-2xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-3 text-[12px]">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <div className="font-bold text-emerald-900">Balance cuadrado ✓</div>
                <div className="text-emerald-700 text-[10px]">
                  Activo {formatCurrency(activos.totalActivos)} = Pasivo{' '}
                  {formatCurrency(pasivos.totalPasivos)} + Patrimonio{' '}
                  {formatCurrency(patrimonio.totalPatrimonio)}
                </div>
              </div>
            </div>
            <span className="text-[10px] tabular-nums bg-emerald-100 text-emerald-800 px-2 py-1 rounded">
              Diferencia: S/ 0.00
            </span>
          </div>
        </section>
      ) : (
        <section className="bg-rose-50 ring-1 ring-rose-200 rounded-2xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-3 text-[12px]">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <div>
                <div className="font-bold text-rose-900">Balance NO cuadra · revisar</div>
                <div className="text-rose-700 text-[10px]">
                  Activo {formatCurrency(activos.totalActivos)} ≠ Pasivo{' '}
                  {formatCurrency(pasivos.totalPasivos)} + Patrimonio{' '}
                  {formatCurrency(patrimonio.totalPatrimonio)}
                </div>
              </div>
            </div>
            <span className="text-[10px] tabular-nums bg-rose-100 text-rose-800 px-2 py-1 rounded font-bold">
              Diferencia: {formatCurrency(Math.abs(totalCuadrado))}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================================
// chk5.E-B · Sprint B · DonutsComposicion · 3 donuts (Activo · Pasivo · Patrimonio)
// ============================================================================

interface DonutsComposicionProps {
  balance: BalanceGeneralType;
}

function DonutsComposicion({ balance }: DonutsComposicionProps) {
  const { activos, pasivos, patrimonio } = balance;

  // === ACTIVO segments ===
  const activoSegments: DonutSegment[] = [];
  if (activos.corriente.efectivo.total > 0) {
    activoSegments.push({
      label: 'Efectivo + bancos',
      value: activos.corriente.efectivo.total,
      color: 'teal',
    });
  }
  if (activos.corriente.cuentasPorCobrar.neto > 0) {
    activoSegments.push({
      label: 'CxC clientes',
      value: activos.corriente.cuentasPorCobrar.neto,
      color: 'purple',
    });
  }
  if (activos.corriente.inventarios.totalValorPEN > 0) {
    activoSegments.push({
      label: 'Inventarios',
      value: activos.corriente.inventarios.totalValorPEN,
      color: 'blue',
    });
  }
  if (activos.noCorriente.total > 0) {
    activoSegments.push({
      label: 'Activo no corriente',
      value: activos.noCorriente.total,
      color: 'slate',
    });
  }

  // === PASIVO segments ===
  const pasivoSegments: DonutSegment[] = [];
  const cxpProv = pasivos.corriente.cuentasPorPagarProveedores.ordenesCompraPendientes;
  if (cxpProv > 0) {
    pasivoSegments.push({ label: 'CxP proveedores', value: cxpProv, color: 'rose' });
  }
  const anticipos = pasivos.corriente.anticiposClientes?.totalAnticiposPEN ?? 0;
  if (anticipos > 0) {
    pasivoSegments.push({ label: 'Anticipos clientes', value: anticipos, color: 'purple' });
  }
  const deudasFin = pasivos.corriente.deudasFinancieras?.total ?? 0;
  if (deudasFin > 0) {
    pasivoSegments.push({ label: 'Deudas TC bancos', value: deudasFin, color: 'amber' });
  }
  if (pasivos.corriente.otrasCuentasPorPagar.total > 0) {
    pasivoSegments.push({
      label: 'Otras CxP',
      value: pasivos.corriente.otrasCuentasPorPagar.total,
      color: 'slate',
    });
  }

  // === PATRIMONIO segments ===
  const patrSegments: DonutSegment[] = [];
  if (patrimonio.capitalSocial > 0) {
    patrSegments.push({ label: 'Capital social', value: patrimonio.capitalSocial, color: 'indigo' });
  }
  if ((patrimonio.reservas ?? 0) > 0) {
    patrSegments.push({ label: 'Reserva legal', value: patrimonio.reservas!, color: 'sky' });
  }
  if (patrimonio.utilidadesAcumuladas > 0) {
    patrSegments.push({
      label: 'Utilidades acumuladas',
      value: patrimonio.utilidadesAcumuladas,
      color: 'indigo',
    });
  }
  if (patrimonio.utilidadEjercicio > 0) {
    patrSegments.push({
      label: 'Utilidad del período',
      value: patrimonio.utilidadEjercicio,
      color: 'amber',
    });
  }

  // Insights automáticos · derivados del % de cada segmento principal
  const insightActivo = generarInsightActivo(activoSegments, activos.totalActivos);
  const insightPasivo = generarInsightPasivo(pasivoSegments, pasivos.totalPasivos);
  const insightPatrimonio = generarInsightPatrimonio(patrSegments, patrimonio.totalPatrimonio);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* ACTIVO */}
      <div className="bg-white border border-teal-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-teal-700 font-bold">
              ACTIVO · composición
            </div>
            <div className="text-[16px] font-bold tabular-nums text-teal-900">
              {formatCurrency(activos.totalActivos)}
            </div>
          </div>
          <Wallet className="w-4 h-4 text-teal-700" />
        </div>
        <DonutChartCanon
          segments={activoSegments}
          total={activos.totalActivos}
          sizeClass="w-20 h-20"
          formatValue={formatCurrency}
        />
        {insightActivo && (
          <div className="mt-3 pt-2 border-t border-teal-100 text-[10px] text-teal-700 flex items-start gap-1.5">
            <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span dangerouslySetInnerHTML={{ __html: insightActivo }} />
          </div>
        )}
      </div>

      {/* PASIVO */}
      <div className="bg-white border border-rose-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">
              PASIVO · composición
            </div>
            <div className="text-[16px] font-bold tabular-nums text-rose-900">
              {formatCurrency(pasivos.totalPasivos)}
            </div>
          </div>
          <CreditCard className="w-4 h-4 text-rose-700" />
        </div>
        <DonutChartCanon
          segments={pasivoSegments}
          total={pasivos.totalPasivos}
          sizeClass="w-20 h-20"
          formatValue={formatCurrency}
        />
        {insightPasivo && (
          <div className="mt-3 pt-2 border-t border-rose-100 text-[10px] text-rose-700 flex items-start gap-1.5">
            <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span dangerouslySetInnerHTML={{ __html: insightPasivo }} />
          </div>
        )}
      </div>

      {/* PATRIMONIO */}
      <div className="bg-white border border-indigo-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">
              PATRIMONIO · composición
            </div>
            <div className="text-[16px] font-bold tabular-nums text-indigo-900">
              {formatCurrency(patrimonio.totalPatrimonio)}
            </div>
          </div>
          <PiggyBank className="w-4 h-4 text-indigo-700" />
        </div>
        <DonutChartCanon
          segments={patrSegments}
          total={patrimonio.totalPatrimonio}
          sizeClass="w-20 h-20"
          formatValue={formatCurrency}
        />
        {insightPatrimonio && (
          <div className="mt-3 pt-2 border-t border-indigo-100 text-[10px] text-indigo-700 flex items-start gap-1.5">
            <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span dangerouslySetInnerHTML={{ __html: insightPatrimonio }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Helpers de insights =====
function generarInsightActivo(segments: DonutSegment[], total: number): string | null {
  if (total === 0 || segments.length === 0) return null;
  const sorted = [...segments].sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const pct = ((top.value / total) * 100).toFixed(0);
  return `Tu activo más grande es <strong>${top.label} (${pct}%)</strong>.`;
}

function generarInsightPasivo(segments: DonutSegment[], total: number): string | null {
  if (total === 0 || segments.length === 0) return null;
  const anticipos = segments.find((s) => s.label.includes('Anticipos'));
  if (anticipos) {
    const pct = ((anticipos.value / total) * 100).toFixed(0);
    return `El <strong>${pct}% son anticipos</strong> · ventas ya cobradas sin entregar.`;
  }
  const sorted = [...segments].sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const pct = ((top.value / total) * 100).toFixed(0);
  return `Tu deuda principal es <strong>${top.label} (${pct}%)</strong>.`;
}

function generarInsightPatrimonio(segments: DonutSegment[], total: number): string | null {
  if (total === 0 || segments.length === 0) return null;
  const utilAcum = segments.find((s) => s.label.includes('Utilidades acumuladas'));
  const utilPer = segments.find((s) => s.label.includes('Utilidad del período'));
  const utilTotal = (utilAcum?.value ?? 0) + (utilPer?.value ?? 0);
  if (utilTotal > 0) {
    const pct = ((utilTotal / total) * 100).toFixed(0);
    return `Utilidades acumuladas + período son <strong>${pct}%</strong> · empresa rentable.`;
  }
  return `Capital social representa <strong>${(((segments[0]?.value ?? 0) / total) * 100).toFixed(0)}%</strong> · faltan utilidades retenidas.`;
}
