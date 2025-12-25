import React, { useEffect, useState } from 'react';
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  Banknote,
  Edit2,
  User,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button, Card, Modal } from '../../components/common';
import { TesoreriaService } from '../../services/tesoreria.service';
import { cuentasPendientesService } from '../../services/cuentasPendientes.service';
import { useAuthStore } from '../../store/authStore';
import type {
  MovimientoTesoreria,
  ConversionCambiaria,
  CuentaCaja,
  TesoreriaStats,
  MovimientoTesoreriaFormData,
  ConversionCambiariaFormData,
  CuentaCajaFormData,
  TipoMovimientoTesoreria,
  MonedaTesoreria,
  DashboardCuentasPendientes
} from '../../types/tesoreria.types';

type TabActiva = 'movimientos' | 'conversiones' | 'cuentas' | 'pendientes';

export const Tesoreria: React.FC = () => {
  const user = useAuthStore(state => state.user);

  const [tabActiva, setTabActiva] = useState<TabActiva>('movimientos');
  const [loading, setLoading] = useState(true);

  // Data
  const [movimientos, setMovimientos] = useState<MovimientoTesoreria[]>([]);
  const [conversiones, setConversiones] = useState<ConversionCambiaria[]>([]);
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [stats, setStats] = useState<TesoreriaStats | null>(null);
  const [dashboardPendientes, setDashboardPendientes] = useState<DashboardCuentasPendientes | null>(null);
  const [loadingPendientes, setLoadingPendientes] = useState(false);

  // Modales
  const [isMovimientoModalOpen, setIsMovimientoModalOpen] = useState(false);
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [isCuentaModalOpen, setIsCuentaModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para edición de cuentas
  const [cuentaEditando, setCuentaEditando] = useState<CuentaCaja | null>(null);

  // Forms
  const [movimientoForm, setMovimientoForm] = useState<Partial<MovimientoTesoreriaFormData>>({
    tipo: 'ingreso_venta',
    moneda: 'PEN',
    fecha: new Date(),
    tipoCambio: 3.70,
    metodo: 'efectivo'
  });
  const [conversionForm, setConversionForm] = useState<Partial<ConversionCambiariaFormData>>({
    monedaOrigen: 'USD',
    fecha: new Date(),
    tipoCambio: 3.70
  });
  const [cuentaForm, setCuentaForm] = useState<Partial<CuentaCajaFormData>>({
    moneda: 'PEN',
    tipo: 'efectivo',
    saldoInicial: 0,
    titular: '',
    esBiMoneda: false,
    saldoInicialUSD: 0,
    saldoInicialPEN: 0
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Cargar datos
  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    if (tabActiva === 'pendientes') {
      await loadPendientes();
    }
    setIsRefreshing(false);
  };

  const loadPendientes = async () => {
    setLoadingPendientes(true);
    try {
      const dashboard = await cuentasPendientesService.getDashboard();
      setDashboardPendientes(dashboard);
    } catch (error) {
      console.error('Error cargando pendientes:', error);
    } finally {
      setLoadingPendientes(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [mov, conv, ctas, estadisticas] = await Promise.all([
        TesoreriaService.getMovimientos(),
        TesoreriaService.getConversiones(),
        TesoreriaService.getCuentas(),
        TesoreriaService.getStats()
      ]);
      setMovimientos(mov);
      setConversiones(conv);
      setCuentas(ctas);
      setStats(estadisticas);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleCrearMovimiento = async () => {
    if (!user || !movimientoForm.monto || !movimientoForm.tipo) return;

    setIsSubmitting(true);
    try {
      await TesoreriaService.registrarMovimiento(
        {
          ...movimientoForm,
          fecha: movimientoForm.fecha || new Date(),
          tipoCambio: movimientoForm.tipoCambio || 3.70,
          metodo: movimientoForm.metodo || 'efectivo'
        } as MovimientoTesoreriaFormData,
        user.uid
      );
      setIsMovimientoModalOpen(false);
      setMovimientoForm({
        tipo: 'ingreso_venta',
        moneda: 'PEN',
        fecha: new Date(),
        tipoCambio: 3.70,
        metodo: 'efectivo'
      });
      loadData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCrearConversion = async () => {
    if (!user || !conversionForm.montoOrigen || !conversionForm.tipoCambio) return;

    setIsSubmitting(true);
    try {
      await TesoreriaService.registrarConversion(
        {
          ...conversionForm,
          fecha: conversionForm.fecha || new Date(),
          tipoCambio: conversionForm.tipoCambio || 3.70,
          monedaOrigen: conversionForm.monedaOrigen || 'USD'
        } as ConversionCambiariaFormData,
        user.uid
      );
      setIsConversionModalOpen(false);
      setConversionForm({
        monedaOrigen: 'USD',
        fecha: new Date(),
        tipoCambio: 3.70
      });
      loadData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCrearCuenta = async () => {
    if (!user || !cuentaForm.nombre || !cuentaForm.titular?.trim()) {
      alert('El nombre y el titular de la cuenta son obligatorios');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData: CuentaCajaFormData = {
        ...cuentaForm,
        esBiMoneda: cuentaForm.esBiMoneda || false,
        saldoInicial: cuentaForm.saldoInicial || 0,
        saldoInicialUSD: cuentaForm.saldoInicialUSD || 0,
        saldoInicialPEN: cuentaForm.saldoInicialPEN || 0
      } as CuentaCajaFormData;

      await TesoreriaService.crearCuenta(formData, user.uid);
      setIsCuentaModalOpen(false);
      setCuentaForm({ moneda: 'PEN', tipo: 'efectivo', saldoInicial: 0, titular: '', esBiMoneda: false, saldoInicialUSD: 0, saldoInicialPEN: 0 });
      loadData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditarCuenta = (cuenta: CuentaCaja) => {
    setCuentaEditando(cuenta);
    setCuentaForm({
      nombre: cuenta.nombre,
      titular: cuenta.titular || '',
      tipo: cuenta.tipo,
      moneda: cuenta.moneda,
      esBiMoneda: cuenta.esBiMoneda || false,
      saldoInicial: cuenta.saldoActual,
      saldoInicialUSD: cuenta.saldoUSD || 0,
      saldoInicialPEN: cuenta.saldoPEN || 0,
      saldoMinimo: cuenta.saldoMinimo,
      saldoMinimoUSD: cuenta.saldoMinimoUSD,
      saldoMinimoPEN: cuenta.saldoMinimoPEN,
      banco: cuenta.banco,
      numeroCuenta: cuenta.numeroCuenta,
      cci: cuenta.cci,
      metodoPagoAsociado: cuenta.metodoPagoAsociado,
      esCuentaPorDefecto: cuenta.esCuentaPorDefecto
    });
    setIsCuentaModalOpen(true);
  };

  const handleGuardarCuenta = async () => {
    if (!user || !cuentaForm.nombre || !cuentaForm.titular?.trim()) {
      alert('El nombre y el titular de la cuenta son obligatorios');
      return;
    }

    setIsSubmitting(true);
    try {
      if (cuentaEditando) {
        // Editar cuenta existente
        await TesoreriaService.actualizarCuenta(
          cuentaEditando.id,
          {
            nombre: cuentaForm.nombre,
            titular: cuentaForm.titular,
            tipo: cuentaForm.tipo,
            moneda: cuentaForm.moneda,
            esBiMoneda: cuentaForm.esBiMoneda,
            saldoMinimo: cuentaForm.saldoMinimo,
            saldoMinimoUSD: cuentaForm.saldoMinimoUSD,
            saldoMinimoPEN: cuentaForm.saldoMinimoPEN,
            banco: cuentaForm.banco,
            numeroCuenta: cuentaForm.numeroCuenta,
            cci: cuentaForm.cci,
            metodoPagoAsociado: cuentaForm.metodoPagoAsociado,
            esCuentaPorDefecto: cuentaForm.esCuentaPorDefecto
          },
          user.uid
        );
      } else {
        // Crear nueva cuenta
        const formData: CuentaCajaFormData = {
          ...cuentaForm,
          esBiMoneda: cuentaForm.esBiMoneda || false,
          saldoInicial: cuentaForm.saldoInicial || 0,
          saldoInicialUSD: cuentaForm.saldoInicialUSD || 0,
          saldoInicialPEN: cuentaForm.saldoInicialPEN || 0
        } as CuentaCajaFormData;

        await TesoreriaService.crearCuenta(formData, user.uid);
      }
      setIsCuentaModalOpen(false);
      setCuentaEditando(null);
      setCuentaForm({ moneda: 'PEN', tipo: 'efectivo', saldoInicial: 0, titular: '', esBiMoneda: false, saldoInicialUSD: 0, saldoInicialPEN: 0 });
      loadData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCerrarModalCuenta = () => {
    setIsCuentaModalOpen(false);
    setCuentaEditando(null);
    setCuentaForm({ moneda: 'PEN', tipo: 'efectivo', saldoInicial: 0, titular: '', esBiMoneda: false, saldoInicialUSD: 0, saldoInicialPEN: 0 });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const esIngreso = (tipo: TipoMovimientoTesoreria): boolean => {
    return ['ingreso_venta', 'ingreso_otro', 'ajuste_positivo'].includes(tipo);
  };

  // Recalcular saldos de todas las cuentas basándose en los movimientos
  const handleRecalcularSaldos = async () => {
    if (!window.confirm('¿Recalcular todos los saldos de cuentas basándose en los movimientos registrados?\n\nEsto puede corregir inconsistencias en los saldos.')) {
      return;
    }

    setIsSubmitting(true);
    try {
      const resultado = await TesoreriaService.recalcularTodosLosSaldos();

      if (resultado.errores.length > 0) {
        alert(`Saldos recalculados con algunos errores:\n\n${resultado.errores.join('\n')}`);
      } else {
        alert(`✅ ${resultado.cuentasActualizadas} cuenta(s) actualizadas correctamente`);
      }

      // Recargar datos
      await loadData();
    } catch (error: any) {
      alert(`Error al recalcular saldos: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTipoLabel = (tipo: TipoMovimientoTesoreria): string => {
    const labels: Record<TipoMovimientoTesoreria, string> = {
      'ingreso_venta': 'Venta',
      'ingreso_otro': 'Otro Ingreso',
      'pago_orden_compra': 'Pago OC',
      'pago_viajero': 'Pago Viajero',
      'pago_proveedor_local': 'Prov. Local',
      'gasto_operativo': 'Gasto Op.',
      'conversion_pen_usd': 'Conv. PEN→USD',
      'conversion_usd_pen': 'Conv. USD→PEN',
      'ajuste_positivo': 'Ajuste +',
      'ajuste_negativo': 'Ajuste -',
      'retiro_socio': 'Retiro Socio'
    };
    return labels[tipo] || tipo;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tesorería</h1>
          <p className="text-gray-600 mt-1">
            Gestión de caja, movimientos y conversiones de moneda
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={handleRefresh}
          disabled={isRefreshing || loading}
          title="Actualizar datos"
        >
          <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Saldo Total PEN</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  S/ {stats.saldoTotalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <Banknote className="h-10 w-10 text-green-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Saldo Total USD</div>
                <div className="text-2xl font-bold text-primary-600 mt-1">
                  $ {stats.saldoTotalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <DollarSign className="h-10 w-10 text-primary-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Ingresos Mes</div>
                <div className="text-2xl font-bold text-success-600 mt-1">
                  S/ {stats.ingresosMesPEN.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                </div>
              </div>
              <ArrowUpCircle className="h-10 w-10 text-success-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Egresos Mes</div>
                <div className="text-2xl font-bold text-error-600 mt-1">
                  S/ {stats.egresosMesPEN.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                </div>
              </div>
              <ArrowDownCircle className="h-10 w-10 text-error-400" />
            </div>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setTabActiva('movimientos')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              tabActiva === 'movimientos'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Wallet className="h-5 w-5 inline mr-2" />
            Movimientos
          </button>
          <button
            onClick={() => setTabActiva('conversiones')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              tabActiva === 'conversiones'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <RefreshCw className="h-5 w-5 inline mr-2" />
            Conversiones
          </button>
          <button
            onClick={() => setTabActiva('cuentas')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              tabActiva === 'cuentas'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="h-5 w-5 inline mr-2" />
            Cuentas
          </button>
          <button
            onClick={() => {
              setTabActiva('pendientes');
              if (!dashboardPendientes) loadPendientes();
            }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              tabActiva === 'pendientes'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="h-5 w-5 inline mr-2" />
            CxP / CxC
            {dashboardPendientes && (dashboardPendientes.cuentasPorCobrar.cantidadDocumentos + dashboardPendientes.cuentasPorPagar.cantidadDocumentos) > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800">
                {dashboardPendientes.cuentasPorCobrar.cantidadDocumentos + dashboardPendientes.cuentasPorPagar.cantidadDocumentos}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Contenido de Tab */}
      {tabActiva === 'movimientos' && (
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Movimientos ({movimientos.length})
            </h3>
            <Button variant="primary" onClick={() => setIsMovimientoModalOpen(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Nuevo Movimiento
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Origen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Concepto
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    TC
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No hay movimientos registrados
                    </td>
                  </tr>
                ) : (
                  movimientos.map((mov) => (
                    <tr key={mov.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(mov.fecha)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            esIngreso(mov.tipo)
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {esIngreso(mov.tipo) && <TrendingUp className="h-3 w-3 mr-1" />}
                          {!esIngreso(mov.tipo) && <TrendingDown className="h-3 w-3 mr-1" />}
                          {getTipoLabel(mov.tipo)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {mov.ordenCompraNumero ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-medium">
                            {mov.ordenCompraNumero}
                          </span>
                        ) : mov.ventaNumero ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-medium">
                            {mov.ventaNumero}
                          </span>
                        ) : mov.gastoNumero ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-xs font-medium">
                            {mov.gastoNumero}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {mov.concepto || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        <span
                          className={esIngreso(mov.tipo) ? 'text-green-600' : 'text-red-600'}
                        >
                          {esIngreso(mov.tipo) ? '+' : '-'}
                          {mov.moneda === 'PEN' ? 'S/ ' : '$ '}
                          {mov.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                        {mov.tipoCambio.toFixed(3)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tabActiva === 'conversiones' && (
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Conversiones de Moneda ({conversiones.length})
            </h3>
            <Button variant="primary" onClick={() => setIsConversionModalOpen(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Nueva Conversión
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Origen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Destino
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    TC Usado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    TC Ref.
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Spread
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {conversiones.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No hay conversiones registradas
                    </td>
                  </tr>
                ) : (
                  conversiones.map((conv) => (
                    <tr key={conv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(conv.fecha)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium text-gray-900">
                          {conv.monedaOrigen === 'PEN' ? 'S/ ' : '$ '}
                          {conv.montoOrigen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-gray-500 text-xs">{conv.monedaOrigen}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium text-gray-900">
                          {conv.monedaDestino === 'PEN' ? 'S/ ' : '$ '}
                          {conv.montoDestino.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-gray-500 text-xs">{conv.monedaDestino}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        {conv.tipoCambio.toFixed(3)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                        {conv.tipoCambioReferencia.toFixed(3)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span
                          className={
                            conv.spreadCambiario >= 0 ? 'text-green-600' : 'text-red-600'
                          }
                        >
                          {conv.spreadCambiario >= 0 ? '+' : ''}
                          {conv.spreadCambiario.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tabActiva === 'cuentas' && (
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Cuentas de Caja ({cuentas.length})
            </h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRecalcularSaldos}
                disabled={isSubmitting || cuentas.length === 0}
                title="Recalcular saldos basándose en los movimientos registrados"
              >
                <RefreshCw className={`h-5 w-5 mr-2 ${isSubmitting ? 'animate-spin' : ''}`} />
                Recalcular Saldos
              </Button>
              <Button variant="primary" onClick={() => setIsCuentaModalOpen(true)}>
                <Plus className="h-5 w-5 mr-2" />
                Nueva Cuenta
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {cuentas.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 py-8">
                No hay cuentas registradas
              </div>
            ) : (
              cuentas.map((cuenta) => (
                <Card key={cuenta.id} padding="md" className="border border-gray-200 relative group">
                  {/* Botón de editar */}
                  <button
                    onClick={() => handleEditarCuenta(cuenta)}
                    className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Editar cuenta"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      {cuenta.tipo === 'efectivo' && <Banknote className="h-6 w-6 text-green-500 mr-2" />}
                      {cuenta.tipo === 'banco' && <Building2 className="h-6 w-6 text-blue-500 mr-2" />}
                      {cuenta.tipo === 'digital' && <Wallet className="h-6 w-6 text-purple-500 mr-2" />}
                      <div>
                        <h4 className="font-medium text-gray-900">{cuenta.nombre}</h4>
                        <p className="text-xs text-gray-500">{cuenta.tipo}</p>
                      </div>
                    </div>
                    {cuenta.esBiMoneda ? (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gradient-to-r from-green-100 to-blue-100 text-gray-800 border border-gray-200">
                        BI-MONEDA
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          cuenta.moneda === 'PEN'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {cuenta.moneda}
                      </span>
                    )}
                  </div>

                  {/* Saldos */}
                  {cuenta.esBiMoneda ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Saldo PEN:</span>
                        <span className="text-lg font-bold text-green-600">
                          S/ {(cuenta.saldoPEN || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Saldo USD:</span>
                        <span className="text-lg font-bold text-blue-600">
                          $ {(cuenta.saldoUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-gray-900">
                      {cuenta.moneda === 'PEN' ? 'S/ ' : '$ '}
                      {cuenta.saldoActual.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </div>
                  )}

                  {/* Titular de la cuenta */}
                  {cuenta.titular && (
                    <div className="flex items-center text-sm text-gray-600 mt-2">
                      <User className="h-4 w-4 mr-1 text-gray-400" />
                      <span>{cuenta.titular}</span>
                    </div>
                  )}
                  {cuenta.banco && (
                    <p className="text-sm text-gray-500 mt-1">{cuenta.banco}</p>
                  )}
                </Card>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Tab Pendientes (CxP / CxC) */}
      {tabActiva === 'pendientes' && (
        <div className="space-y-6">
          {loadingPendientes ? (
            <div className="flex justify-center items-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary-500" />
              <span className="ml-3 text-gray-600">Cargando pendientes...</span>
            </div>
          ) : dashboardPendientes ? (
            <>
              {/* KPIs de Balance */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card padding="md" className="border-l-4 border-l-green-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Por Cobrar (Ventas)</div>
                      <div className="text-2xl font-bold text-green-600 mt-1">
                        S/ {dashboardPendientes.cuentasPorCobrar.totalEquivalentePEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {dashboardPendientes.cuentasPorCobrar.cantidadDocumentos} documento(s)
                      </div>
                    </div>
                    <ArrowDownCircle className="h-10 w-10 text-green-400" />
                  </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-red-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Por Pagar (OC, Gastos, Viajeros)</div>
                      <div className="text-2xl font-bold text-red-600 mt-1">
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
                    <ArrowUpCircle className="h-10 w-10 text-red-400" />
                  </div>
                </Card>

                <Card padding="md" className={`border-l-4 ${dashboardPendientes.balanceNeto.flujoNetoPEN >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Flujo Neto Proyectado</div>
                      <div className={`text-2xl font-bold mt-1 ${dashboardPendientes.balanceNeto.flujoNetoPEN >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                        {dashboardPendientes.balanceNeto.flujoNetoPEN >= 0 ? '+' : ''}
                        S/ {dashboardPendientes.balanceNeto.flujoNetoPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        TC: {dashboardPendientes.tipoCambioUsado.toFixed(3)}
                      </div>
                    </div>
                    {dashboardPendientes.balanceNeto.flujoNetoPEN >= 0 ? (
                      <CheckCircle className="h-10 w-10 text-blue-400" />
                    ) : (
                      <AlertTriangle className="h-10 w-10 text-orange-400" />
                    )}
                  </div>
                </Card>
              </div>

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
                  <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
                    <h3 className="text-lg font-semibold text-green-800 flex items-center">
                      <ArrowDownCircle className="h-5 w-5 mr-2" />
                      Cuentas por Cobrar
                    </h3>
                    <p className="text-sm text-green-600">Ventas pendientes de pago</p>
                  </div>

                  {/* Resumen por antigüedad */}
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="text-center">
                        <div className="text-gray-500">0-7 días</div>
                        <div className="font-bold text-gray-900">S/ {dashboardPendientes.cuentasPorCobrar.pendiente0a7dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">8-15 días</div>
                        <div className="font-bold text-yellow-600">S/ {dashboardPendientes.cuentasPorCobrar.pendiente8a15dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">16-30 días</div>
                        <div className="font-bold text-orange-600">S/ {dashboardPendientes.cuentasPorCobrar.pendiente16a30dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">&gt;30 días</div>
                        <div className="font-bold text-red-600">S/ {dashboardPendientes.cuentasPorCobrar.pendienteMas30dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
                    {dashboardPendientes.cuentasPorCobrar.pendientes.length === 0 ? (
                      <div className="px-6 py-8 text-center text-gray-500">
                        <CheckCircle className="h-10 w-10 mx-auto text-green-300 mb-2" />
                        No hay cuentas pendientes de cobro
                      </div>
                    ) : (
                      dashboardPendientes.cuentasPorCobrar.pendientes.map((p) => (
                        <div key={p.id} className="px-6 py-3 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-gray-900">{p.numeroDocumento}</div>
                              <div className="text-sm text-gray-500">{p.contraparteNombre}</div>
                              <div className="flex items-center gap-2 mt-1">
                                {p.canal && (
                                  <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800">
                                    {p.canal}
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  p.diasPendiente <= 7 ? 'bg-gray-100 text-gray-600' :
                                  p.diasPendiente <= 15 ? 'bg-yellow-100 text-yellow-800' :
                                  p.diasPendiente <= 30 ? 'bg-orange-100 text-orange-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  {p.diasPendiente} días
                                </span>
                                {p.esParcial && (
                                  <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-800">
                                    Parcial
                                  </span>
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
                  <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
                    <h3 className="text-lg font-semibold text-red-800 flex items-center">
                      <ArrowUpCircle className="h-5 w-5 mr-2" />
                      Cuentas por Pagar
                    </h3>
                    <p className="text-sm text-red-600">OC, Gastos y Viajeros pendientes</p>
                  </div>

                  {/* Resumen por tipo */}
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex flex-wrap gap-2">
                      {dashboardPendientes.cuentasPorPagar.porTipo.map((tipo) => (
                        <div key={tipo.tipo} className="text-xs px-3 py-1 rounded-full bg-white border border-gray-200">
                          <span className="font-medium">{tipo.etiqueta}:</span>
                          <span className="ml-1 text-gray-600">{tipo.cantidad}</span>
                          {tipo.montoUSD > 0 && (
                            <span className="ml-1 text-blue-600">(${tipo.montoUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })})</span>
                          )}
                          {tipo.montoPEN > 0 && (
                            <span className="ml-1 text-green-600">(S/{tipo.montoPEN.toLocaleString('es-PE', { maximumFractionDigits: 0 })})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
                    {dashboardPendientes.cuentasPorPagar.pendientes.length === 0 ? (
                      <div className="px-6 py-8 text-center text-gray-500">
                        <CheckCircle className="h-10 w-10 mx-auto text-green-300 mb-2" />
                        No hay cuentas pendientes de pago
                      </div>
                    ) : (
                      dashboardPendientes.cuentasPorPagar.pendientes.map((p) => (
                        <div key={p.id} className="px-6 py-3 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-gray-900">{p.numeroDocumento}</div>
                              <div className="text-sm text-gray-500">{p.contraparteNombre}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  p.tipo === 'orden_compra_por_pagar' ? 'bg-purple-100 text-purple-800' :
                                  p.tipo === 'gasto_por_pagar' ? 'bg-orange-100 text-orange-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {p.tipo === 'orden_compra_por_pagar' ? 'OC' :
                                   p.tipo === 'gasto_por_pagar' ? 'Gasto' : 'Viajero'}
                                </span>
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  p.diasPendiente <= 7 ? 'bg-gray-100 text-gray-600' :
                                  p.diasPendiente <= 15 ? 'bg-yellow-100 text-yellow-800' :
                                  p.diasPendiente <= 30 ? 'bg-orange-100 text-orange-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  {p.diasPendiente} días
                                </span>
                                {p.esParcial && (
                                  <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-800">
                                    Parcial
                                  </span>
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
                              {p.esParcial && (
                                <div className="text-xs text-gray-500">
                                  de {p.moneda === 'USD' ? '$ ' : 'S/ '}{p.montoTotal.toLocaleString(p.moneda === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2 })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </>
          ) : (
            <div className="flex justify-center items-center py-12">
              <Button variant="primary" onClick={loadPendientes}>
                <RefreshCw className="h-5 w-5 mr-2" />
                Cargar Pendientes
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modal Nuevo Movimiento */}
      <Modal
        isOpen={isMovimientoModalOpen}
        onClose={() => setIsMovimientoModalOpen(false)}
        title="Nuevo Movimiento"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={movimientoForm.tipo}
                onChange={(e) =>
                  setMovimientoForm({ ...movimientoForm, tipo: e.target.value as TipoMovimientoTesoreria })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <optgroup label="Ingresos">
                  <option value="ingreso_venta">Ingreso por Venta</option>
                  <option value="ingreso_otro">Otro Ingreso</option>
                  <option value="ajuste_positivo">Ajuste Positivo</option>
                </optgroup>
                <optgroup label="Egresos">
                  <option value="pago_orden_compra">Pago Orden de Compra</option>
                  <option value="pago_viajero">Pago a Viajero</option>
                  <option value="pago_proveedor_local">Pago Proveedor Local</option>
                  <option value="gasto_operativo">Gasto Operativo</option>
                  <option value="retiro_socio">Retiro Socio</option>
                  <option value="ajuste_negativo">Ajuste Negativo</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Moneda
              </label>
              <select
                value={movimientoForm.moneda}
                onChange={(e) =>
                  setMovimientoForm({ ...movimientoForm, moneda: e.target.value as MonedaTesoreria })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="PEN">PEN (Soles)</option>
                <option value="USD">USD (Dólares)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto
              </label>
              <input
                type="number"
                step="0.01"
                value={movimientoForm.monto || ''}
                onChange={(e) =>
                  setMovimientoForm({ ...movimientoForm, monto: parseFloat(e.target.value) })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Cambio
              </label>
              <input
                type="number"
                step="0.001"
                value={movimientoForm.tipoCambio || ''}
                onChange={(e) =>
                  setMovimientoForm({ ...movimientoForm, tipoCambio: parseFloat(e.target.value) })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="3.700"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Concepto
            </label>
            <input
              type="text"
              value={movimientoForm.concepto || ''}
              onChange={(e) =>
                setMovimientoForm({ ...movimientoForm, concepto: e.target.value })
              }
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Descripción del movimiento"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referencia
            </label>
            <input
              type="text"
              value={movimientoForm.referencia || ''}
              onChange={(e) =>
                setMovimientoForm({ ...movimientoForm, referencia: e.target.value })
              }
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="N° de documento, factura, etc."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="ghost" onClick={() => setIsMovimientoModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleCrearMovimiento}
              disabled={isSubmitting || !movimientoForm.monto}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Nueva Conversión */}
      <Modal
        isOpen={isConversionModalOpen}
        onClose={() => setIsConversionModalOpen(false)}
        title="Nueva Conversión de Moneda"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Moneda Origen
              </label>
              <select
                value={conversionForm.monedaOrigen}
                onChange={(e) =>
                  setConversionForm({ ...conversionForm, monedaOrigen: e.target.value as MonedaTesoreria })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="USD">USD (Dólares)</option>
                <option value="PEN">PEN (Soles)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto Origen
              </label>
              <input
                type="number"
                step="0.01"
                value={conversionForm.montoOrigen || ''}
                onChange={(e) =>
                  setConversionForm({ ...conversionForm, montoOrigen: parseFloat(e.target.value) })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Cambio
              </label>
              <input
                type="number"
                step="0.001"
                value={conversionForm.tipoCambio || ''}
                onChange={(e) =>
                  setConversionForm({ ...conversionForm, tipoCambio: parseFloat(e.target.value) })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="3.700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entidad de Cambio
              </label>
              <input
                type="text"
                value={conversionForm.entidadCambio || ''}
                onChange={(e) =>
                  setConversionForm({ ...conversionForm, entidadCambio: e.target.value })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="Casa de cambio, banco, etc."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo
            </label>
            <input
              type="text"
              value={conversionForm.motivo || ''}
              onChange={(e) =>
                setConversionForm({ ...conversionForm, motivo: e.target.value })
              }
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Razón de la conversión"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="ghost" onClick={() => setIsConversionModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleCrearConversion}
              disabled={isSubmitting || !conversionForm.montoOrigen || !conversionForm.tipoCambio}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Nueva/Editar Cuenta */}
      <Modal
        isOpen={isCuentaModalOpen}
        onClose={handleCerrarModalCuenta}
        title={cuentaEditando ? 'Editar Cuenta' : 'Nueva Cuenta de Caja'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la Cuenta *
            </label>
            <input
              type="text"
              value={cuentaForm.nombre || ''}
              onChange={(e) => setCuentaForm({ ...cuentaForm, nombre: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Ej: Caja PEN, Cuenta USD BCP"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="inline h-4 w-4 mr-1" />
              Titular de la Cuenta *
            </label>
            <input
              type="text"
              value={cuentaForm.titular || ''}
              onChange={(e) => setCuentaForm({ ...cuentaForm, titular: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Nombre completo del titular"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Persona responsable o propietaria de la cuenta</p>
          </div>

          {/* Toggle Bi-Moneda */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-gray-200">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Cuenta Bi-Moneda
              </label>
              <p className="text-xs text-gray-500">Maneja USD y PEN en la misma cuenta</p>
            </div>
            <button
              type="button"
              onClick={() => setCuentaForm({ ...cuentaForm, esBiMoneda: !cuentaForm.esBiMoneda })}
              disabled={!!cuentaEditando}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                cuentaForm.esBiMoneda ? 'bg-primary-600' : 'bg-gray-200'
              } ${cuentaEditando ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  cuentaForm.esBiMoneda ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {cuentaForm.esBiMoneda ? 'Moneda Principal' : 'Moneda'}
              </label>
              <select
                value={cuentaForm.moneda}
                onChange={(e) => setCuentaForm({ ...cuentaForm, moneda: e.target.value as MonedaTesoreria })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                disabled={!!cuentaEditando}
              >
                <option value="PEN">PEN (Soles)</option>
                <option value="USD">USD (Dólares)</option>
              </select>
              {cuentaEditando && !cuentaForm.esBiMoneda && (
                <p className="text-xs text-gray-500 mt-1">No se puede cambiar la moneda</p>
              )}
              {cuentaForm.esBiMoneda && (
                <p className="text-xs text-gray-500 mt-1">Para display y reportes</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={cuentaForm.tipo}
                onChange={(e) => setCuentaForm({ ...cuentaForm, tipo: e.target.value as any })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="efectivo">Efectivo</option>
                <option value="banco">Banco</option>
                <option value="digital">Digital (Yape/Plin)</option>
              </select>
            </div>
          </div>

          {cuentaForm.tipo === 'banco' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Banco
                </label>
                <input
                  type="text"
                  value={cuentaForm.banco || ''}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, banco: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Ej: BCP, Interbank"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  N° Cuenta
                </label>
                <input
                  type="text"
                  value={cuentaForm.numeroCuenta || ''}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, numeroCuenta: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Opcional"
                />
              </div>
            </div>
          )}

          {cuentaForm.tipo === 'banco' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CCI (Código Interbancario)
              </label>
              <input
                type="text"
                value={cuentaForm.cci || ''}
                onChange={(e) => setCuentaForm({ ...cuentaForm, cci: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="Opcional - Para transferencias interbancarias"
              />
            </div>
          )}

          {/* Saldos Iniciales - Solo para creación */}
          {!cuentaEditando && (
            cuentaForm.esBiMoneda ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Saldo Inicial PEN
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">S/</span>
                    <input
                      type="number"
                      step="0.01"
                      value={cuentaForm.saldoInicialPEN || ''}
                      onChange={(e) =>
                        setCuentaForm({ ...cuentaForm, saldoInicialPEN: parseFloat(e.target.value) })
                      }
                      className="w-full pl-8 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Saldo Inicial USD
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={cuentaForm.saldoInicialUSD || ''}
                      onChange={(e) =>
                        setCuentaForm({ ...cuentaForm, saldoInicialUSD: parseFloat(e.target.value) })
                      }
                      className="w-full pl-8 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Saldo Inicial
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={cuentaForm.saldoInicial || ''}
                  onChange={(e) =>
                    setCuentaForm({ ...cuentaForm, saldoInicial: parseFloat(e.target.value) })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="0.00"
                />
              </div>
            )
          )}

          {/* Saldos Actuales - Solo para edición */}
          {cuentaEditando && (
            cuentaForm.esBiMoneda ? (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">Saldos actuales:</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <span className="text-sm text-gray-500">PEN</span>
                    <p className="text-xl font-bold text-green-600">
                      S/ {(cuentaForm.saldoInicialPEN || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-gray-500">USD</span>
                    <p className="text-xl font-bold text-blue-600">
                      $ {(cuentaForm.saldoInicialUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  Los saldos solo se modifican mediante movimientos
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Saldo actual:</span>{' '}
                  <span className="text-lg font-bold text-gray-900">
                    {cuentaForm.moneda === 'PEN' ? 'S/ ' : '$ '}
                    {cuentaForm.saldoInicial?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  El saldo solo se modifica mediante movimientos
                </p>
              </div>
            )
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="ghost" onClick={handleCerrarModalCuenta}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleGuardarCuenta}
              disabled={isSubmitting || !cuentaForm.nombre || !cuentaForm.titular?.trim()}
            >
              {isSubmitting ? 'Guardando...' : cuentaEditando ? 'Guardar Cambios' : 'Crear Cuenta'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
