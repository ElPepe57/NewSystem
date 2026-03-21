import React from 'react';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  ExternalLink,
  ShoppingCart,
  Receipt,
  Truck
} from 'lucide-react';
import { Button, Card } from '../../components/common';
import type {
  DashboardCuentasPendientes,
  PendienteFinanciero
} from '../../types/tesoreria.types';

interface TabPendientesProps {
  dashboardPendientes: DashboardCuentasPendientes | null;
  loadingPendientes: boolean;
  loadPendientes: () => void;
  handleNavigarPendiente: (pendiente: PendienteFinanciero) => void;
}

export const TabPendientes: React.FC<TabPendientesProps> = ({
  dashboardPendientes,
  loadingPendientes,
  loadPendientes,
  handleNavigarPendiente,
}) => {
  if (loadingPendientes) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-500" />
        <span className="ml-3 text-gray-600">Cargando pendientes...</span>
      </div>
    );
  }

  if (!dashboardPendientes) {
    return (
      <div className="flex justify-center items-center py-12">
        <Button variant="primary" onClick={loadPendientes}>
          <RefreshCw className="h-5 w-5 mr-2" />
          Cargar Pendientes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs de Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card padding="md" className="border-l-4 border-l-green-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs sm:text-sm text-gray-600">Por Cobrar (Ventas)</div>
              <div className="text-lg sm:text-2xl font-bold text-green-600 mt-1">
                S/ {dashboardPendientes.cuentasPorCobrar.totalEquivalentePEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {dashboardPendientes.cuentasPorCobrar.cantidadDocumentos} documento(s)
              </div>
            </div>
            <ArrowDownCircle className="h-8 w-8 sm:h-10 sm:w-10 text-green-400" />
          </div>
        </Card>

        <Card padding="md" className="border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs sm:text-sm text-gray-600"><span className="sm:hidden">Por Pagar</span><span className="hidden sm:inline">Por Pagar (OC, Gastos, Viajeros)</span></div>
              <div className="text-lg sm:text-2xl font-bold text-red-600 mt-1">
                S/ {dashboardPendientes.cuentasPorPagar.totalEquivalentePEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {dashboardPendientes.cuentasPorPagar.cantidadDocumentos} documento(s)
                {dashboardPendientes.cuentasPorPagar.totalPendienteUSD > 0 && (
                  <span className="ml-2">
                    (${dashboardPendientes.cuentasPorPagar.totalPendienteUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD)
                  </span>
                )}
              </div>
            </div>
            <ArrowUpCircle className="h-8 w-8 sm:h-10 sm:w-10 text-red-400" />
          </div>
        </Card>

        <Card padding="md" className={`border-l-4 ${dashboardPendientes.balanceNeto.flujoNetoPEN >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs sm:text-sm text-gray-600">Flujo Neto (CxC - CxP)</div>
              <div className={`text-lg sm:text-2xl font-bold mt-1 ${dashboardPendientes.balanceNeto.flujoNetoPEN >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {dashboardPendientes.balanceNeto.flujoNetoPEN >= 0 ? '+' : ''}
                S/ {dashboardPendientes.balanceNeto.flujoNetoPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500 mt-1">TC: {dashboardPendientes.tipoCambioUsado.toFixed(3)}</div>
            </div>
            {dashboardPendientes.balanceNeto.flujoNetoPEN >= 0 ? (
              <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 text-blue-400" />
            ) : (
              <AlertTriangle className="h-8 w-8 sm:h-10 sm:w-10 text-orange-400" />
            )}
          </div>
        </Card>
      </div>

      {/* Flujo de Caja Proyectado */}
      {dashboardPendientes.flujoCajaProyectado && (
        <Card padding="md" className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200">
          <h3 className="font-semibold text-indigo-800 mb-3 sm:mb-4 flex items-center text-sm sm:text-base">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <span className="sm:hidden">Flujo Proyectado</span>
            <span className="hidden sm:inline">Flujo de Caja Proyectado Completo</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm">
              <div className="text-[10px] sm:text-xs text-gray-500 uppercase"><span className="sm:hidden">Saldo Actual</span><span className="hidden sm:inline">Saldo Actual en Cuentas</span></div>
              <div className="text-sm sm:text-lg font-bold text-gray-900 mt-1">
                S/ {dashboardPendientes.flujoCajaProyectado.saldoActualPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
              {dashboardPendientes.flujoCajaProyectado.saldoActualUSD > 0 && (
                <div className="text-xs text-gray-500">
                  + $ {dashboardPendientes.flujoCajaProyectado.saldoActualUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm">
              <div className="text-[10px] sm:text-xs text-gray-500 uppercase"><span className="sm:hidden">Cobrado</span><span className="hidden sm:inline">Cobrado este Mes</span></div>
              <div className="text-sm sm:text-lg font-bold text-green-600 mt-1">
                + S/ {dashboardPendientes.flujoCajaProyectado.ingresosCobradosMesPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
              {dashboardPendientes.flujoCajaProyectado.ingresosCobradosMesUSD > 0 && (
                <div className="text-xs text-green-500">
                  + $ {dashboardPendientes.flujoCajaProyectado.ingresosCobradosMesUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm">
              <div className="text-[10px] sm:text-xs text-gray-500 uppercase"><span className="sm:hidden">Pagado</span><span className="hidden sm:inline">Pagado este Mes</span></div>
              <div className="text-sm sm:text-lg font-bold text-red-600 mt-1">
                - S/ {dashboardPendientes.flujoCajaProyectado.egresosPagadosMesPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
              {dashboardPendientes.flujoCajaProyectado.egresosPagadosMesUSD > 0 && (
                <div className="text-xs text-red-500">
                  - $ {dashboardPendientes.flujoCajaProyectado.egresosPagadosMesUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>

            <div className={`rounded-lg p-2 sm:p-3 shadow-sm ${dashboardPendientes.flujoCajaProyectado.flujoNetoProyectadoPEN >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
              <div className="text-[10px] sm:text-xs text-gray-600 uppercase"><span className="sm:hidden">Proyeccion</span><span className="hidden sm:inline">Proyeccion Total</span></div>
              <div className={`text-sm sm:text-lg font-bold mt-1 ${dashboardPendientes.flujoCajaProyectado.flujoNetoProyectadoPEN >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                S/ {dashboardPendientes.flujoCajaProyectado.flujoNetoProyectadoPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
              <div className={`text-sm font-semibold mt-1 ${dashboardPendientes.flujoCajaProyectado.rentabilidadProyectada >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dashboardPendientes.flujoCajaProyectado.rentabilidadProyectada >= 0 ? '+' : ''}{dashboardPendientes.flujoCajaProyectado.rentabilidadProyectada.toFixed(1)}% s/inversion
              </div>
            </div>
          </div>

          {(dashboardPendientes.flujoCajaProyectado.proyeccionIngresos.cotizacionesPendientes > 0 ||
            dashboardPendientes.flujoCajaProyectado.proyeccionIngresos.expectativasActivas > 0 ||
            dashboardPendientes.flujoCajaProyectado.proyeccionIngresos.inventarioDisponibleValor > 0) && (
            <div className="mt-4 pt-4 border-t border-indigo-200">
              <div className="text-xs text-indigo-600 font-medium mb-2"><span className="sm:hidden">Ingresos Futuros</span><span className="hidden sm:inline">Proyeccion de Ingresos Futuros (potencial)</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-sm">
                <div className="bg-white/50 rounded px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Cotizaciones pendientes</span>
                    <span className="text-xs text-indigo-500 font-medium">40%</span>
                  </div>
                  <div className="font-bold text-gray-900 mt-1">
                    S/ {dashboardPendientes.flujoCajaProyectado.proyeccionIngresos.cotizacionesPendientes.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="bg-white/50 rounded px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Requerimientos activos</span>
                    <span className="text-xs text-indigo-500 font-medium">30%</span>
                  </div>
                  <div className="font-bold text-gray-900 mt-1">
                    S/ {dashboardPendientes.flujoCajaProyectado.proyeccionIngresos.expectativasActivas.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="bg-green-50 rounded px-3 py-2 border border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="text-green-700">Inventario por vender</span>
                    <span className="text-xs text-green-600 font-medium">100%</span>
                  </div>
                  <div className="font-bold text-green-700 mt-1">
                    S/ {dashboardPendientes.flujoCajaProyectado.proyeccionIngresos.inventarioDisponibleValor.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-green-600 mt-1">(costo + flete) x TC x 1.3</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 bg-white/30 rounded p-2">
                <strong>Nota:</strong> Cotizaciones y requerimientos usan factor de probabilidad.
                El inventario usa 100% porque ya incluye el margen de venta (30%).
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Alertas */}
      {dashboardPendientes.alertas.length > 0 && (
        <Card padding="md" className="bg-orange-50 border border-orange-200">
          <div className="flex items-center mb-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
            <h3 className="font-semibold text-orange-800">Alertas ({dashboardPendientes.alertas.length})</h3>
          </div>
          <div className="space-y-2">
            {dashboardPendientes.alertas.slice(0, 5).map((alerta, idx) => (
              <div
                key={idx}
                className={`flex items-center text-sm px-3 py-2 rounded ${
                  alerta.prioridad === 'alta' ? 'bg-red-100 text-red-800' :
                  alerta.prioridad === 'media' ? 'bg-orange-100 text-orange-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}
              >
                {alerta.tipo === 'vencido' && <XCircle className="h-4 w-4 mr-2" />}
                {alerta.tipo === 'proximo_vencer' && <Clock className="h-4 w-4 mr-2" />}
                {alerta.tipo === 'monto_alto' && <DollarSign className="h-4 w-4 mr-2" />}
                {alerta.mensaje}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cuentas por Cobrar */}
        <Card padding="none">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-green-50">
            <h3 className="text-base sm:text-lg font-semibold text-green-800 flex items-center">
              <ArrowDownCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Cuentas por Cobrar
            </h3>
            <p className="text-xs sm:text-sm text-green-600">Ventas pendientes de pago</p>
          </div>
          <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="text-center">
                <div className="text-gray-500">0-7 dias</div>
                <div className="font-bold text-gray-900">S/ {dashboardPendientes.cuentasPorCobrar.pendiente0a7dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500">8-15 dias</div>
                <div className="font-bold text-yellow-600">S/ {dashboardPendientes.cuentasPorCobrar.pendiente8a15dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500">16-30 dias</div>
                <div className="font-bold text-orange-600">S/ {dashboardPendientes.cuentasPorCobrar.pendiente16a30dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500">&gt;30 dias</div>
                <div className="font-bold text-red-600">S/ {dashboardPendientes.cuentasPorCobrar.pendienteMas30dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
            {dashboardPendientes.cuentasPorCobrar.pendientes.length === 0 ? (
              <div className="px-4 sm:px-6 py-8 text-center text-gray-500">
                <CheckCircle className="h-10 w-10 mx-auto text-green-300 mb-2" />
                No hay cuentas pendientes de cobro
              </div>
            ) : (
              dashboardPendientes.cuentasPorCobrar.pendientes.map((p) => (
                <div
                  key={p.id}
                  className="px-4 sm:px-6 py-3 hover:bg-green-50 cursor-pointer transition-colors group"
                  onClick={() => handleNavigarPendiente(p)}
                  title="Clic para ir al registro de cobro"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900 group-hover:text-green-700 flex items-center gap-2">
                        {p.numeroDocumento}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-sm text-gray-500">{p.contraparteNombre}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {p.canal && (
                          <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800">{p.canal}</span>
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          p.diasPendiente <= 7 ? 'bg-gray-100 text-gray-600' :
                          p.diasPendiente <= 15 ? 'bg-yellow-100 text-yellow-800' :
                          p.diasPendiente <= 30 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          <Clock className="h-3 w-3 inline mr-1" />
                          {p.diasPendiente} dias
                        </span>
                        {p.esParcial && (
                          <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-800">Parcial</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">
                        S/ {p.montoPendiente.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                      {p.esParcial && (
                        <div className="text-xs text-gray-500">
                          de S/ {p.montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Cuentas por Pagar */}
        <Card padding="none">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-red-50">
            <h3 className="text-base sm:text-lg font-semibold text-red-800 flex items-center">
              <ArrowUpCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Cuentas por Pagar
            </h3>
            <p className="text-xs sm:text-sm text-red-600">OC, Gastos y Viajeros pendientes</p>
          </div>
          <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="text-center">
                <div className="text-gray-500">0-7 dias</div>
                <div className="font-bold text-gray-900">S/ {dashboardPendientes.cuentasPorPagar.pendiente0a7dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500">8-15 dias</div>
                <div className="font-bold text-yellow-600">S/ {dashboardPendientes.cuentasPorPagar.pendiente8a15dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500">16-30 dias</div>
                <div className="font-bold text-orange-600">S/ {dashboardPendientes.cuentasPorPagar.pendiente16a30dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500">&gt;30 dias</div>
                <div className="font-bold text-red-600">S/ {dashboardPendientes.cuentasPorPagar.pendienteMas30dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-2 border-b border-gray-200">
            <div className="flex flex-wrap gap-2">
              {dashboardPendientes.cuentasPorPagar.porTipo.map((tipo) => (
                <div key={tipo.tipo} className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${
                  tipo.tipo === 'orden_compra_por_pagar' ? 'bg-purple-50 border-purple-200 text-purple-800' :
                  tipo.tipo === 'gasto_por_pagar' ? 'bg-orange-50 border-orange-200 text-orange-800' :
                  'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                  {tipo.tipo === 'orden_compra_por_pagar' && <ShoppingCart className="h-3 w-3" />}
                  {tipo.tipo === 'gasto_por_pagar' && <Receipt className="h-3 w-3" />}
                  {tipo.tipo === 'viajero_por_pagar' && <Truck className="h-3 w-3" />}
                  <span className="font-medium">{tipo.etiqueta}:</span>
                  <span>{tipo.cantidad}</span>
                  {tipo.montoUSD > 0 && (
                    <span className="font-semibold">${tipo.montoUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  )}
                  {tipo.montoPEN > 0 && (
                    <span className="font-semibold">S/{tipo.montoPEN.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
            {dashboardPendientes.cuentasPorPagar.pendientes.length === 0 ? (
              <div className="px-4 sm:px-6 py-8 text-center text-gray-500">
                <CheckCircle className="h-10 w-10 mx-auto text-green-300 mb-2" />
                No hay cuentas pendientes de pago
              </div>
            ) : (
              dashboardPendientes.cuentasPorPagar.pendientes.map((p) => (
                <div
                  key={p.id}
                  className="px-4 sm:px-6 py-3 hover:bg-red-50 cursor-pointer transition-colors group"
                  onClick={() => handleNavigarPendiente(p)}
                  title="Clic para ir al registro de pago"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900 group-hover:text-red-700 flex items-center gap-2">
                        {p.tipo === 'orden_compra_por_pagar' && <ShoppingCart className="h-3.5 w-3.5 text-purple-500" />}
                        {p.tipo === 'gasto_por_pagar' && <Receipt className="h-3.5 w-3.5 text-orange-500" />}
                        {p.tipo === 'viajero_por_pagar' && <Truck className="h-3.5 w-3.5 text-blue-500" />}
                        {p.numeroDocumento}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-sm text-gray-500">{p.contraparteNombre}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-xs rounded inline-flex items-center gap-1 ${
                          p.tipo === 'orden_compra_por_pagar' ? 'bg-purple-100 text-purple-800' :
                          p.tipo === 'gasto_por_pagar' ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {p.tipo === 'orden_compra_por_pagar' ? 'OC' :
                           p.tipo === 'gasto_por_pagar' ? 'Gasto' : 'Flete'}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          p.diasPendiente <= 7 ? 'bg-gray-100 text-gray-600' :
                          p.diasPendiente <= 15 ? 'bg-yellow-100 text-yellow-800' :
                          p.diasPendiente <= 30 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          <Clock className="h-3 w-3 inline mr-1" />
                          {p.diasPendiente} dias
                        </span>
                        {p.esVencido && (
                          <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 font-semibold">Vencido</span>
                        )}
                        {p.esParcial && (
                          <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-800">Parcial</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-600">
                        {p.moneda === 'USD' ? '$ ' : 'S/ '}
                        {p.montoPendiente.toLocaleString(p.moneda === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2 })}
                      </div>
                      {p.moneda === 'USD' && p.montoEquivalentePEN && (
                        <div className="text-xs text-gray-500">
                          ≈ S/ {p.montoEquivalentePEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                      {p.esParcial && p.montoTotal > 0 && (
                        <>
                          <div className="text-xs text-gray-500">
                            de {p.moneda === 'USD' ? '$ ' : 'S/ '}{p.montoTotal.toLocaleString(p.moneda === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div
                              className="bg-red-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (p.montoPagado / p.montoTotal) * 100)}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {((p.montoPagado / p.montoTotal) * 100).toFixed(0)}% pagado
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
