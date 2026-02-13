/**
 * Componente Balance General
 * Vista del Balance Sheet: Activos, Pasivos, Patrimonio
 */

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Wallet,
  CreditCard,
  Package,
  Building2,
  Receipt,
  Users,
  PiggyBank,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Banknote,
} from 'lucide-react';
import { contabilidadService } from '../../../services/contabilidad.service';
import type { BalanceGeneral as BalanceGeneralType } from '../../../types/contabilidad.types';

// Formatear moneda
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value);
};

const formatCurrencyUSD = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

// Componente para sección expandible
interface SeccionBalanceProps {
  titulo: string;
  total: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  colorHeader?: string;
  icon?: React.ReactNode;
}

function SeccionBalance({
  titulo,
  total,
  children,
  defaultOpen = true,
  colorHeader = 'bg-gray-100',
  icon,
}: SeccionBalanceProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex justify-between items-center py-3 px-4 ${colorHeader} hover:bg-opacity-80 transition-colors`}
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
          {icon}
          <span className="font-semibold text-gray-800">{titulo}</span>
        </div>
        <span className="font-mono font-bold text-gray-900">{formatCurrency(total)}</span>
      </button>
      {isOpen && <div className="bg-white border-t">{children}</div>}
    </div>
  );
}

// Línea del balance
interface LineaBalanceProps {
  label: string;
  valor: number;
  indent?: number;
  esSubtotal?: boolean;
  detalle?: string;
}

function LineaBalance({ label, valor, indent = 0, esSubtotal, detalle }: LineaBalanceProps) {
  const paddingLeft = indent * 20;

  return (
    <div
      className={`flex justify-between items-center py-2 px-4 ${
        esSubtotal ? 'bg-gray-50 font-semibold border-t' : 'hover:bg-gray-50'
      }`}
      style={{ paddingLeft: `${16 + paddingLeft}px` }}
    >
      <div>
        <span className={`${esSubtotal ? 'text-gray-800' : 'text-gray-600'}`}>{label}</span>
        {detalle && <span className="text-xs text-gray-400 ml-2">{detalle}</span>}
      </div>
      <span className="font-mono">{formatCurrency(valor)}</span>
    </div>
  );
}

interface Props {
  mes: number;
  anio: number;
}

export default function BalanceGeneral({ mes, anio }: Props) {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<BalanceGeneralType | null>(null);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const data = await contabilidadService.generarBalanceGeneral(mes, anio);
      setBalance(data);
    } catch (err) {
      console.error('Error cargando balance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [mes, anio]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!balance) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        No se pudo cargar el Balance General
      </div>
    );
  }

  const { activos, pasivos, patrimonio } = balance;

  return (
    <div className="space-y-6">
      {/* Header del Balance */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">BALANCE GENERAL</h2>
            <p className="text-indigo-100">
              Al {balance.fechaCorte.toLocaleDateString('es-PE', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
            <p className="text-sm text-indigo-200 mt-1">TC: {balance.tipoCambio.toFixed(2)}</p>
          </div>
          <div className="text-right">
            {balance.balanceCuadra ? (
              <div className="flex items-center gap-2 text-green-300">
                <CheckCircle2 className="w-5 h-5" />
                <span>Balance cuadrado</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle className="w-5 h-5" />
                <span>Diferencia: {formatCurrency(balance.diferencia)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Resumen rápido */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-indigo-200 text-sm">Total Activos</div>
            <div className="text-2xl font-bold">{formatCurrency(activos.totalActivos)}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-indigo-200 text-sm">Total Pasivos</div>
            <div className="text-2xl font-bold">{formatCurrency(pasivos.totalPasivos)}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-indigo-200 text-sm">Patrimonio</div>
            <div className="text-2xl font-bold">{formatCurrency(patrimonio.totalPatrimonio)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ACTIVOS */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-3">
            <TrendingUp className="w-6 h-6 text-green-600" />
            ACTIVOS
          </h3>

          {/* Activo Corriente */}
          <SeccionBalance
            titulo="Activo Corriente"
            total={activos.corriente.total}
            colorHeader="bg-green-50"
            icon={<Wallet className="w-5 h-5 text-green-600" />}
          >
            {/* Efectivo */}
            <div className="border-b">
              <div className="px-4 py-2 bg-gray-50 font-medium text-gray-700 flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                Efectivo y Equivalentes
              </div>
              <LineaBalance
                label="Caja Efectivo"
                valor={activos.corriente.efectivo.cajaEfectivo}
                indent={1}
              />
              <LineaBalance
                label="Bancos (PEN)"
                valor={activos.corriente.efectivo.bancosPEN}
                indent={1}
              />
              <LineaBalance
                label="Bancos (USD)"
                valor={activos.corriente.efectivo.bancosUSD}
                indent={1}
                detalle={`${formatCurrencyUSD(activos.corriente.efectivo.bancosUSDOriginal)}`}
              />
              {activos.corriente.efectivo.billeterasDigitales > 0 && (
                <LineaBalance
                  label="Billeteras Digitales"
                  valor={activos.corriente.efectivo.billeterasDigitales}
                  indent={1}
                />
              )}
              <LineaBalance
                label="Total Efectivo"
                valor={activos.corriente.efectivo.total}
                esSubtotal
              />
            </div>

            {/* Cuentas por Cobrar */}
            <div className="border-b">
              <div className="px-4 py-2 bg-gray-50 font-medium text-gray-700 flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Cuentas por Cobrar
              </div>
              <LineaBalance
                label="Ventas Pendientes"
                valor={activos.corriente.cuentasPorCobrar.ventasPendientes}
                indent={1}
                detalle={`${activos.corriente.cuentasPorCobrar.cantidadVentas} ventas`}
              />
              {activos.corriente.cuentasPorCobrar.provisionIncobrables > 0 && (
                <LineaBalance
                  label="(-) Provisión Incobrables"
                  valor={-activos.corriente.cuentasPorCobrar.provisionIncobrables}
                  indent={1}
                />
              )}
              <LineaBalance
                label="Cuentas por Cobrar (Neto)"
                valor={activos.corriente.cuentasPorCobrar.neto}
                esSubtotal
              />
              {/* Antigüedad */}
              <div className="px-6 py-2 text-xs text-gray-500 grid grid-cols-4 gap-2">
                <div>0-7d: {formatCurrency(activos.corriente.cuentasPorCobrar.antiguedad.de0a7dias)}</div>
                <div>8-15d: {formatCurrency(activos.corriente.cuentasPorCobrar.antiguedad.de8a15dias)}</div>
                <div>16-30d: {formatCurrency(activos.corriente.cuentasPorCobrar.antiguedad.de16a30dias)}</div>
                <div className="text-amber-600">&gt;30d: {formatCurrency(activos.corriente.cuentasPorCobrar.antiguedad.mayor30dias)}</div>
              </div>
            </div>

            {/* Inventarios */}
            <div>
              <div className="px-4 py-2 bg-gray-50 font-medium text-gray-700 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Inventarios ({activos.corriente.inventarios.metodoValorizacion})
              </div>
              <div className="px-4 py-2 text-xs text-gray-500">
                CTRU Promedio: {formatCurrency(activos.corriente.inventarios.ctruPromedio)}
              </div>
              <LineaBalance
                label="Inventario USA"
                valor={activos.corriente.inventarios.inventarioUSA.valorPEN}
                indent={1}
                detalle={`${activos.corriente.inventarios.inventarioUSA.unidades} uds (${formatCurrencyUSD(activos.corriente.inventarios.inventarioUSA.valorUSD)})`}
              />
              <div className="px-8 text-xs text-gray-500 pb-1">
                En almacenes: {activos.corriente.inventarios.inventarioUSA.enAlmacenes} |
                En tránsito: {activos.corriente.inventarios.inventarioUSA.enTransito}
              </div>
              <LineaBalance
                label="Inventario Perú"
                valor={activos.corriente.inventarios.inventarioPeru.valorPEN}
                indent={1}
                detalle={`${activos.corriente.inventarios.inventarioPeru.unidades} uds`}
              />
              <div className="px-8 text-xs text-gray-500 pb-1">
                Disponible: {activos.corriente.inventarios.inventarioPeru.disponible} |
                Reservado: {activos.corriente.inventarios.inventarioPeru.reservado}
              </div>
              {pasivos.corriente.anticiposClientes &&
               pasivos.corriente.anticiposClientes.cantidadVentas > 0 &&
               activos.corriente.inventarios.inventarioPeru.reservado > 0 && (
                <div className="px-8 py-1 text-xs text-purple-600 italic">
                  ↳ {activos.corriente.inventarios.inventarioPeru.reservado} uds comprometidas por anticipos de clientes (ver Pasivos)
                </div>
              )}
              <LineaBalance
                label="Total Inventarios"
                valor={activos.corriente.inventarios.totalValorPEN}
                esSubtotal
              />
            </div>

            <LineaBalance
              label="TOTAL ACTIVO CORRIENTE"
              valor={activos.corriente.total}
              esSubtotal
            />
          </SeccionBalance>

          {/* Activo No Corriente */}
          {activos.noCorriente.total > 0 && (
            <SeccionBalance
              titulo="Activo No Corriente"
              total={activos.noCorriente.total}
              colorHeader="bg-gray-100"
              icon={<Building2 className="w-5 h-5 text-gray-600" />}
              defaultOpen={false}
            >
              {activos.noCorriente.propiedadPlantaEquipo && (
                <LineaBalance
                  label="Propiedad, Planta y Equipo"
                  valor={activos.noCorriente.propiedadPlantaEquipo}
                  indent={1}
                />
              )}
              <LineaBalance
                label="TOTAL ACTIVO NO CORRIENTE"
                valor={activos.noCorriente.total}
                esSubtotal
              />
            </SeccionBalance>
          )}

          {/* Total Activos */}
          <div className="bg-green-100 rounded-lg p-4 flex justify-between items-center">
            <span className="font-bold text-green-800 text-lg">TOTAL ACTIVOS</span>
            <span className="font-mono font-bold text-green-800 text-xl">
              {formatCurrency(activos.totalActivos)}
            </span>
          </div>
        </div>

        {/* PASIVOS Y PATRIMONIO */}
        <div className="space-y-6">
          {/* PASIVOS */}
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-3">
              <CreditCard className="w-6 h-6 text-red-600" />
              PASIVOS
            </h3>

            {/* Pasivo Corriente */}
            <SeccionBalance
              titulo="Pasivo Corriente"
              total={pasivos.corriente.total}
              colorHeader="bg-red-50"
              icon={<Receipt className="w-5 h-5 text-red-600" />}
            >
              {/* Cuentas por Pagar Proveedores */}
              <div className="border-b">
                <div className="px-4 py-2 bg-gray-50 font-medium text-gray-700">
                  Cuentas por Pagar (Proveedores)
                </div>
                <LineaBalance
                  label="OCs Pendientes"
                  valor={pasivos.corriente.cuentasPorPagarProveedores.ordenesCompraPendientes}
                  indent={1}
                  detalle={`${pasivos.corriente.cuentasPorPagarProveedores.cantidadOCs} OCs (${formatCurrencyUSD(pasivos.corriente.cuentasPorPagarProveedores.ordenesCompraUSD)})`}
                />
                {/* Antigüedad */}
                <div className="px-6 py-2 text-xs text-gray-500 grid grid-cols-4 gap-2">
                  <div>0-7d: {formatCurrency(pasivos.corriente.cuentasPorPagarProveedores.antiguedad.de0a7dias)}</div>
                  <div>8-15d: {formatCurrency(pasivos.corriente.cuentasPorPagarProveedores.antiguedad.de8a15dias)}</div>
                  <div>16-30d: {formatCurrency(pasivos.corriente.cuentasPorPagarProveedores.antiguedad.de16a30dias)}</div>
                  <div className="text-red-600">&gt;30d: {formatCurrency(pasivos.corriente.cuentasPorPagarProveedores.antiguedad.mayor30dias)}</div>
                </div>
              </div>

              {/* Otras Cuentas por Pagar */}
              <div>
                <div className="px-4 py-2 bg-gray-50 font-medium text-gray-700">
                  Otras Cuentas por Pagar
                </div>
                {pasivos.corriente.otrasCuentasPorPagar.gastosPendientes > 0 && (
                  <LineaBalance
                    label="Gastos Pendientes"
                    valor={pasivos.corriente.otrasCuentasPorPagar.gastosPendientes}
                    indent={1}
                  />
                )}
                {pasivos.corriente.otrasCuentasPorPagar.pagosViajerosPendientes > 0 && (
                  <LineaBalance
                    label="Pagos a Viajeros"
                    valor={pasivos.corriente.otrasCuentasPorPagar.pagosViajerosPendientes}
                    indent={1}
                  />
                )}
                <LineaBalance
                  label="Total Otras CxP"
                  valor={pasivos.corriente.otrasCuentasPorPagar.total}
                  esSubtotal
                />
              </div>

              {/* Anticipos de Clientes */}
              {pasivos.corriente.anticiposClientes &&
               pasivos.corriente.anticiposClientes.totalAnticiposPEN > 0 && (
                <div className="border-b">
                  <div className="px-4 py-2 bg-gray-50 font-medium text-gray-700 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Anticipos de Clientes (Ingresos Diferidos)
                  </div>
                  <LineaBalance
                    label="Anticipos Pendientes de Entrega"
                    valor={pasivos.corriente.anticiposClientes.totalAnticiposPEN}
                    indent={1}
                    detalle={`${pasivos.corriente.anticiposClientes.cantidadVentas} ventas`}
                  />
                  <div className="px-6 py-2 text-xs text-purple-600 bg-purple-50">
                    Respaldado por {activos.corriente.inventarios.inventarioPeru.reservado} uds de inventario reservado (ver Activos)
                  </div>
                </div>
              )}

              {/* Deudas Financieras */}
              {pasivos.corriente.deudasFinancieras &&
               pasivos.corriente.deudasFinancieras.total > 0 && (
                <div className="border-b">
                  <div className="px-4 py-2 bg-red-50 font-medium text-red-700 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Deudas Financieras (Corto Plazo)
                  </div>
                  {pasivos.corriente.deudasFinancieras.tarjetasCredito > 0 && (
                    <LineaBalance
                      label="Tarjetas de Crédito"
                      valor={pasivos.corriente.deudasFinancieras.tarjetasCredito}
                      indent={1}
                    />
                  )}
                  {pasivos.corriente.deudasFinancieras.prestamosViajeros > 0 && (
                    <LineaBalance
                      label="Préstamos Viajeros"
                      valor={pasivos.corriente.deudasFinancieras.prestamosViajeros}
                      indent={1}
                    />
                  )}
                  {pasivos.corriente.deudasFinancieras.otrasDeudas > 0 && (
                    <LineaBalance
                      label="Otras Líneas de Crédito"
                      valor={pasivos.corriente.deudasFinancieras.otrasDeudas}
                      indent={1}
                    />
                  )}
                  {pasivos.corriente.deudasFinancieras.detalle.length > 0 &&
                    pasivos.corriente.deudasFinancieras.detalle.map((d) => (
                      <div key={d.cuentaId} className="px-8 py-1 text-xs text-gray-500 flex justify-between">
                        <span>{d.nombreCuenta} {d.banco ? `(${d.banco})` : ''}</span>
                        <span className="font-mono">{formatCurrency(d.montoPEN)}</span>
                      </div>
                    ))
                  }
                  <LineaBalance
                    label="Total Deudas Financieras"
                    valor={pasivos.corriente.deudasFinancieras.total}
                    esSubtotal
                  />
                </div>
              )}

              <LineaBalance
                label="TOTAL PASIVO CORRIENTE"
                valor={pasivos.corriente.total}
                esSubtotal
              />
            </SeccionBalance>

            {/* Pasivo No Corriente */}
            {pasivos.noCorriente.total > 0 && (
              <SeccionBalance
                titulo="Pasivo No Corriente"
                total={pasivos.noCorriente.total}
                colorHeader="bg-gray-100"
                defaultOpen={false}
              >
                <LineaBalance
                  label="TOTAL PASIVO NO CORRIENTE"
                  valor={pasivos.noCorriente.total}
                  esSubtotal
                />
              </SeccionBalance>
            )}

            {/* Total Pasivos */}
            <div className="bg-red-100 rounded-lg p-4 flex justify-between items-center">
              <span className="font-bold text-red-800 text-lg">TOTAL PASIVOS</span>
              <span className="font-mono font-bold text-red-800 text-xl">
                {formatCurrency(pasivos.totalPasivos)}
              </span>
            </div>
          </div>

          {/* PATRIMONIO */}
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-3">
              <PiggyBank className="w-6 h-6 text-blue-600" />
              PATRIMONIO
            </h3>

            <SeccionBalance
              titulo="Capital y Resultados"
              total={patrimonio.totalPatrimonio}
              colorHeader="bg-blue-50"
              icon={<Users className="w-5 h-5 text-blue-600" />}
            >
              <LineaBalance
                label="Capital Social"
                valor={patrimonio.capitalSocial}
                indent={1}
              />
              {patrimonio.reservas && patrimonio.reservas > 0 && (
                <LineaBalance
                  label="Reservas"
                  valor={patrimonio.reservas}
                  indent={1}
                />
              )}
              <LineaBalance
                label="Utilidades Acumuladas"
                valor={patrimonio.utilidadesAcumuladas}
                indent={1}
                detalle="años anteriores"
              />
              <LineaBalance
                label="Utilidad del Ejercicio"
                valor={patrimonio.utilidadEjercicio}
                indent={1}
                detalle={`${balance.periodo.nombreMes} ${balance.periodo.anio}`}
              />
              <LineaBalance
                label="TOTAL PATRIMONIO"
                valor={patrimonio.totalPatrimonio}
                esSubtotal
              />
            </SeccionBalance>

            {/* Total Patrimonio */}
            <div className="bg-blue-100 rounded-lg p-4 flex justify-between items-center">
              <span className="font-bold text-blue-800 text-lg">TOTAL PATRIMONIO</span>
              <span className="font-mono font-bold text-blue-800 text-xl">
                {formatCurrency(patrimonio.totalPatrimonio)}
              </span>
            </div>
          </div>

          {/* VERIFICACIÓN */}
          <div className={`rounded-lg p-4 flex justify-between items-center ${
            balance.balanceCuadra ? 'bg-green-100' : 'bg-amber-100'
          }`}>
            <span className={`font-bold text-lg ${
              balance.balanceCuadra ? 'text-green-800' : 'text-amber-800'
            }`}>
              PASIVOS + PATRIMONIO
            </span>
            <span className={`font-mono font-bold text-xl ${
              balance.balanceCuadra ? 'text-green-800' : 'text-amber-800'
            }`}>
              {formatCurrency(balance.totalPasivosPatrimonio)}
            </span>
          </div>
        </div>
      </div>

      {/* Nota contable */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Notas:</strong>
        <ul className="mt-2 space-y-1 text-blue-700">
          <li>• El inventario está valorizado usando el método CTRU (Costo Total Real Unitario)</li>
          <li>• Las cuentas en USD se convierten al tipo de cambio vigente: S/ {balance.tipoCambio.toFixed(2)}</li>
          <li>• La provisión para incobrables es el 5% de cartera mayor a 30 días</li>
          <li>• Los anticipos de clientes representan ingresos diferidos: pagos recibidos por ventas cuyo producto aún no ha sido entregado. Al completar la entrega, se reclasifican automáticamente como ingreso realizado</li>
          <li>• Este reporte es para uso interno de gestión</li>
        </ul>
      </div>
    </div>
  );
}
