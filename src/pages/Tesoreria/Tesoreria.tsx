import React, { useEffect, useState, useMemo } from 'react';
import { useTipoCambio } from '../../hooks/useTipoCambio';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  DollarSign,
  TrendingUp,
  Building2,
  Banknote,
  FileText,
  ArrowLeftRight
} from 'lucide-react';
import { Button, Card, useConfirmDialog, ConfirmDialog } from '../../components/common';
import { TesoreriaService } from '../../services/tesoreria.service';
import { cuentasPendientesService } from '../../services/cuentasPendientes.service';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { useTesoreriaStore } from '../../store/tesoreriaStore';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import type {
  MovimientoTesoreria,
  CuentaCaja,
  MovimientoTesoreriaFormData,
  ConversionCambiariaFormData,
  CuentaCajaFormData,
  TipoMovimientoTesoreria,
  MonedaTesoreria,
  DashboardCuentasPendientes,
  PendienteFinanciero,
  TransferenciaEntreCuentasFormData
} from '../../types/tesoreria.types';

import { TabMovimientos } from './TabMovimientos';
import { TabConversiones } from './TabConversiones';
import { TabTransferencias } from './TabTransferencias';
import { TabCuentas } from './TabCuentas';
import { TabPendientes } from './TabPendientes';

type TabActiva = 'movimientos' | 'conversiones' | 'transferencias' | 'cuentas' | 'pendientes';

interface TransferenciaEntreCuentas {
  id: string;
  fecha: Date;
  cuentaOrigenId: string;
  cuentaOrigenNombre: string;
  cuentaDestinoId: string;
  cuentaDestinoNombre: string;
  monto: number;
  moneda: MonedaTesoreria;
  concepto?: string;
  creadoPor: string;
  creadoEn: Date;
}

export const Tesoreria: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const userProfile = useAuthStore(state => state.userProfile);
  const toast = useToastStore();
  const { tc: tcActual } = useTipoCambio();
  const tcDefault = tcActual?.venta ?? 3.70;
  const {
    movimientos,
    conversiones,
    cuentas,
    stats,
    loading: loadingStore,
    fetchAll: storeFetchAll
  } = useTesoreriaStore();
  const navigate = useNavigate();

  // Filtrar movimientos por línea de negocio (sin lineaNegocioId = compartidos, siempre visibles)
  const movimientosFiltrados = useLineaFilter(movimientos, m => m.lineaNegocioId, { allowUndefined: true });

  const [tabActiva, setTabActiva] = useState<TabActiva>('movimientos');
  const [loadingLocal, setLoadingLocal] = useState(true);
  const loading = loadingStore || loadingLocal;

  const [transferencias, setTransferencias] = useState<TransferenciaEntreCuentas[]>([]);
  const [dashboardPendientes, setDashboardPendientes] = useState<DashboardCuentasPendientes | null>(null);
  const [loadingPendientes, setLoadingPendientes] = useState(false);

  // Modales
  const [isMovimientoModalOpen, setIsMovimientoModalOpen] = useState(false);
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [isTransferenciaModalOpen, setIsTransferenciaModalOpen] = useState(false);
  const [isCuentaModalOpen, setIsCuentaModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado edicion
  const [cuentaEditando, setCuentaEditando] = useState<CuentaCaja | null>(null);
  const [cuentaDetalle, setCuentaDetalle] = useState<CuentaCaja | null>(null);
  const [movsLimit, setMovsLimit] = useState(50);
  const [movimientoEditando, setMovimientoEditando] = useState<MovimientoTesoreria | null>(null);

  // Forms
  const [movimientoForm, setMovimientoForm] = useState<Partial<MovimientoTesoreriaFormData>>({
    tipo: 'ingreso_venta',
    moneda: 'PEN',
    fecha: new Date(),
    tipoCambio: tcDefault,
    metodo: 'efectivo'
  });
  const [conversionForm, setConversionForm] = useState<Partial<ConversionCambiariaFormData>>({
    monedaOrigen: 'USD',
    fecha: new Date(),
    tipoCambio: tcDefault
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
  const [transferenciaForm, setTransferenciaForm] = useState<Partial<TransferenciaEntreCuentasFormData>>({
    moneda: 'PEN',
    fecha: new Date(),
    tipoCambio: tcDefault
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRecalculando, setIsRecalculando] = useState(false);
  const [statsOptimizadas, setStatsOptimizadas] = useState(false);

  const { dialogProps, confirm } = useConfirmDialog();

  // Sincronizar TC en formularios cuando el hook async carga el valor real
  useEffect(() => {
    if (tcActual) {
      const tcVenta = tcActual.venta;
      setMovimientoForm(prev => ({ ...prev, tipoCambio: prev.tipoCambio === 3.70 ? tcVenta : prev.tipoCambio }));
      setConversionForm(prev => ({ ...prev, tipoCambio: prev.tipoCambio === 3.70 ? tcVenta : prev.tipoCambio }));
      setTransferenciaForm(prev => ({ ...prev, tipoCambio: prev.tipoCambio === 3.70 ? tcVenta : prev.tipoCambio }));
    }
  }, [tcActual]);

  useEffect(() => {
    loadData();
    TesoreriaService.getEstadisticasAgregadas().then(s => {
      setStatsOptimizadas(!!s);
    });
  }, []);

  useEffect(() => {
    if (movimientos.length > 0 && cuentas.length > 0) {
      loadTransferencias();
    }
  }, [movimientos, cuentas]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    if (tabActiva === 'pendientes') {
      await loadPendientes();
    }
    setIsRefreshing(false);
  };

  const handleRecalcularEstadisticas = async () => {
    if (!user) return;
    const confirmed = await confirm({
      title: 'Recalcular Estadisticas',
      message: 'Esto procesara todos los movimientos y conversiones del anio. Solo necesitas hacerlo una vez o si detectas inconsistencias.',
      confirmText: 'Recalcular',
      variant: 'warning'
    });
    if (!confirmed) return;
    setIsRecalculando(true);
    try {
      const resultado = await TesoreriaService.recalcularEstadisticasCompletas(user.uid);
      toast.success(`${resultado.mensaje} (${resultado.tiempoMs}ms)`, 'Estadisticas recalculadas');
      setStatsOptimizadas(true);
      await loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error al recalcular');
    } finally {
      setIsRecalculando(false);
    }
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
    setLoadingLocal(true);
    try {
      await storeFetchAll();
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoadingLocal(false);
    }
  };

  const loadTransferencias = async () => {
    try {
      const movsTrans = movimientos.filter(m =>
        m.tipo === 'transferencia_interna' && m.estado !== 'anulado'
      );

      const salidas = movsTrans.filter(m => m.cuentaOrigen && !m.cuentaDestino);
      const entradas = movsTrans.filter(m => m.cuentaDestino && !m.cuentaOrigen);
      const completos = movsTrans.filter(m => m.cuentaOrigen && m.cuentaDestino);

      const transArray: TransferenciaEntreCuentas[] = [];
      const entradasUsadas = new Set<string>();

      for (const salida of salidas) {
        const entrada = entradas.find(e =>
          !entradasUsadas.has(e.id) &&
          e.monto === salida.monto &&
          e.moneda === salida.moneda &&
          Math.abs(e.fecha.toMillis() - salida.fecha.toMillis()) < 3600000
        );
        if (entrada) entradasUsadas.add(entrada.id);

        const cuentaOrigenData = cuentas.find(c => c.id === salida.cuentaOrigen);
        const cuentaDestinoData = entrada ? cuentas.find(c => c.id === entrada.cuentaDestino) : null;

        transArray.push({
          id: salida.id,
          fecha: salida.fecha.toDate(),
          cuentaOrigenId: salida.cuentaOrigen || '',
          cuentaOrigenNombre: cuentaOrigenData?.nombre || 'Cuenta desconocida',
          cuentaDestinoId: entrada?.cuentaDestino || '',
          cuentaDestinoNombre: cuentaDestinoData?.nombre || (entrada ? 'Cuenta desconocida' : '(sin emparejar)'),
          monto: salida.monto,
          moneda: salida.moneda,
          concepto: salida.concepto?.replace('[SALIDA] ', '').replace('Transferencia entre cuentas: ', '') || '',
          creadoPor: salida.creadoPor,
          creadoEn: salida.fechaCreacion.toDate()
        });
      }

      for (const entrada of entradas) {
        if (entradasUsadas.has(entrada.id)) continue;
        const cuentaDestinoData = cuentas.find(c => c.id === entrada.cuentaDestino);
        transArray.push({
          id: entrada.id,
          fecha: entrada.fecha.toDate(),
          cuentaOrigenId: '',
          cuentaOrigenNombre: '(sin emparejar)',
          cuentaDestinoId: entrada.cuentaDestino || '',
          cuentaDestinoNombre: cuentaDestinoData?.nombre || 'Cuenta desconocida',
          monto: entrada.monto,
          moneda: entrada.moneda,
          concepto: entrada.concepto?.replace('[ENTRADA] ', '').replace('Transferencia entre cuentas: ', '') || '',
          creadoPor: entrada.creadoPor,
          creadoEn: entrada.fechaCreacion.toDate()
        });
      }

      for (const mov of completos) {
        const cuentaOrigenData = cuentas.find(c => c.id === mov.cuentaOrigen);
        const cuentaDestinoData = cuentas.find(c => c.id === mov.cuentaDestino);
        transArray.push({
          id: mov.id,
          fecha: mov.fecha.toDate(),
          cuentaOrigenId: mov.cuentaOrigen || '',
          cuentaOrigenNombre: cuentaOrigenData?.nombre || 'Cuenta desconocida',
          cuentaDestinoId: mov.cuentaDestino || '',
          cuentaDestinoNombre: cuentaDestinoData?.nombre || 'Cuenta desconocida',
          monto: mov.monto,
          moneda: mov.moneda,
          concepto: mov.concepto?.replace('Transferencia entre cuentas: ', '') || '',
          creadoPor: mov.creadoPor,
          creadoEn: mov.fechaCreacion.toDate()
        });
      }

      transArray.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
      setTransferencias(transArray);
    } catch (error) {
      console.error('Error al cargar transferencias:', error);
    }
  };

  // ============ Helpers ============
  const esIngreso = (tipo: TipoMovimientoTesoreria): boolean => {
    return ['ingreso_venta', 'ingreso_anticipo', 'ingreso_otro', 'ajuste_positivo'].includes(tipo);
  };

  const esIngresoMovimiento = (mov: MovimientoTesoreria): boolean => {
    if (mov.tipo === 'transferencia_interna') return !!mov.cuentaDestino && !mov.cuentaOrigen;
    if (mov.tipo === 'conversion_pen_usd' || mov.tipo === 'conversion_usd_pen') {
      return !!mov.cuentaDestino && !mov.cuentaOrigen;
    }
    return esIngreso(mov.tipo);
  };

  const esMovimientoNeutro = (mov: MovimientoTesoreria): boolean => mov.tipo === 'transferencia_interna';

  const getTipoLabel = (tipo: TipoMovimientoTesoreria): string => {
    const labels: Record<TipoMovimientoTesoreria, string> = {
      'ingreso_venta': 'Venta',
      'ingreso_anticipo': 'Anticipo',
      'ingreso_otro': 'Otro Ingreso',
      'pago_orden_compra': 'Pago OC',
      'pago_viajero': 'Pago Viajero',
      'pago_proveedor_local': 'Prov. Local',
      'gasto_operativo': 'Gasto Op.',
      'conversion_pen_usd': 'Conv. PEN→USD',
      'conversion_usd_pen': 'Conv. USD→PEN',
      'ajuste_positivo': 'Ajuste +',
      'ajuste_negativo': 'Ajuste -',
      'retiro_socio': 'Retiro Socio',
      'transferencia_interna': 'Transferencia',
      'aporte_capital': 'Aporte Capital'
    };
    return labels[tipo] || tipo;
  };

  // ============ Handlers Movimientos ============
  const handleEditarMovimiento = (mov: MovimientoTesoreria) => {
    setMovimientoEditando(mov);
    setMovimientoForm({
      tipo: mov.tipo,
      moneda: mov.moneda,
      monto: mov.monto,
      tipoCambio: mov.tipoCambio,
      concepto: mov.concepto,
      referencia: mov.referencia,
      notas: mov.notas,
      fecha: mov.fecha.toDate ? mov.fecha.toDate() : new Date(mov.fecha as any),
      metodo: mov.metodo,
      cuentaOrigen: mov.cuentaOrigen,
      cuentaDestino: mov.cuentaDestino
    });
    setIsMovimientoModalOpen(true);
  };

  const handleGuardarMovimiento = async () => {
    if (!user || !movimientoForm.monto || !movimientoForm.tipo) return;
    setIsSubmitting(true);
    try {
      if (movimientoEditando) {
        await TesoreriaService.actualizarMovimiento(
          movimientoEditando.id,
          { ...movimientoForm, fecha: movimientoForm.fecha || new Date(), tipoCambio: movimientoForm.tipoCambio || tcDefault, metodo: movimientoForm.metodo || 'efectivo' } as MovimientoTesoreriaFormData,
          user.uid
        );
      } else {
        await TesoreriaService.registrarMovimiento(
          { ...movimientoForm, fecha: movimientoForm.fecha || new Date(), tipoCambio: movimientoForm.tipoCambio || tcDefault, metodo: movimientoForm.metodo || 'efectivo' } as MovimientoTesoreriaFormData,
          user.uid
        );
      }
      handleCerrarModalMovimiento();
      toast.success('Movimiento guardado');
      loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error al guardar movimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCerrarModalMovimiento = () => {
    setIsMovimientoModalOpen(false);
    setMovimientoEditando(null);
    setMovimientoForm({ tipo: 'ingreso_venta', moneda: 'PEN', fecha: new Date(), tipoCambio: tcDefault, metodo: 'efectivo' });
  };

  const handleAnularMovimiento = async (mov: MovimientoTesoreria) => {
    if (!user) return;
    const confirmed = await confirm({
      title: 'Anular Movimiento',
      message: `¿Anular el movimiento ${mov.numeroMovimiento}? Esta accion revertira el efecto en los saldos de las cuentas.`,
      confirmText: 'Anular',
      variant: 'danger'
    });
    if (!confirmed) return;
    setIsSubmitting(true);
    try {
      await TesoreriaService.eliminarMovimiento(mov.id, user.uid);
      toast.success('Movimiento anulado');
      loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error al anular movimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============ Handlers Conversion ============
  const handleCrearConversion = async () => {
    if (!user || !conversionForm.montoOrigen || !conversionForm.tipoCambio) return;
    setIsSubmitting(true);
    try {
      await TesoreriaService.registrarConversion(
        { ...conversionForm, fecha: conversionForm.fecha || new Date(), tipoCambio: conversionForm.tipoCambio || tcDefault, monedaOrigen: conversionForm.monedaOrigen || 'USD' } as ConversionCambiariaFormData,
        user.uid
      );
      setIsConversionModalOpen(false);
      setConversionForm({ monedaOrigen: 'USD', fecha: new Date(), tipoCambio: tcDefault, cuentaOrigenId: undefined, cuentaDestinoId: undefined });
      toast.success('Conversion registrada');
      loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error en conversion');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============ Handlers Transferencia ============
  const handleCrearTransferencia = async () => {
    if (!user || !transferenciaForm.monto || !transferenciaForm.cuentaOrigenId || !transferenciaForm.cuentaDestinoId) return;
    setIsSubmitting(true);
    try {
      await TesoreriaService.transferirEntreCuentas(
        {
          ...transferenciaForm,
          fecha: transferenciaForm.fecha || new Date(),
          tipoCambio: transferenciaForm.tipoCambio || tcDefault,
          moneda: transferenciaForm.moneda || 'PEN',
          monto: transferenciaForm.monto,
          cuentaOrigenId: transferenciaForm.cuentaOrigenId,
          cuentaDestinoId: transferenciaForm.cuentaDestinoId
        } as TransferenciaEntreCuentasFormData,
        user.uid
      );
      setIsTransferenciaModalOpen(false);
      setTransferenciaForm({ moneda: 'PEN', fecha: new Date(), tipoCambio: tcDefault });
      toast.success('Transferencia realizada');
      await loadData();
      await loadTransferencias();
    } catch (error: any) {
      toast.error(error.message, 'Error en transferencia');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============ Handlers Cuenta ============
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
      toast.warning('El nombre y el titular de la cuenta son obligatorios');
      return;
    }
    setIsSubmitting(true);
    try {
      if (cuentaEditando) {
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
        const formData: CuentaCajaFormData = {
          ...cuentaForm,
          esBiMoneda: cuentaForm.esBiMoneda || false,
          saldoInicial: cuentaForm.saldoInicial || 0,
          saldoInicialUSD: cuentaForm.saldoInicialUSD || 0,
          saldoInicialPEN: cuentaForm.saldoInicialPEN || 0
        } as CuentaCajaFormData;
        await TesoreriaService.crearCuenta(formData, user.uid);
      }
      handleCerrarModalCuenta();
      toast.success('Cuenta guardada');
      loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error al guardar cuenta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCerrarModalCuenta = () => {
    setIsCuentaModalOpen(false);
    setCuentaEditando(null);
    setCuentaForm({ moneda: 'PEN', tipo: 'efectivo', saldoInicial: 0, titular: '', esBiMoneda: false, saldoInicialUSD: 0, saldoInicialPEN: 0 });
  };

  const handleRecalcularSaldos = async () => {
    const confirmed = await confirm({
      title: 'Recalcular Saldos',
      message: 'Esto recalculara todos los saldos de cuentas basandose en los movimientos registrados. Puede corregir inconsistencias en los saldos.',
      confirmText: 'Recalcular',
      variant: 'warning'
    });
    if (!confirmed) return;
    setIsSubmitting(true);
    try {
      const resultado = await TesoreriaService.recalcularTodosLosSaldos();
      if (resultado.errores.length > 0) {
        toast.warning(`${resultado.cuentasActualizadas} cuenta(s) actualizadas con ${resultado.errores.length} error(es)`, 'Recalculo parcial');
      } else {
        toast.success(`${resultado.cuentasActualizadas} cuenta(s) actualizadas correctamente`, 'Saldos recalculados');
      }
      await loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error al recalcular saldos');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNavigarPendiente = (pendiente: PendienteFinanciero) => {
    switch (pendiente.tipo) {
      case 'venta_por_cobrar': navigate(`/ventas?ventaId=${pendiente.documentoId}`); break;
      case 'orden_compra_por_pagar': navigate(`/compras?ocId=${pendiente.documentoId}`); break;
      case 'gasto_por_pagar': navigate(`/gastos?gastoId=${pendiente.documentoId}`); break;
      case 'viajero_por_pagar': navigate(`/transferencias?transferenciaId=${pendiente.documentoId}`); break;
      default: console.warn('Tipo de pendiente no soportado:', pendiente.tipo);
    }
  };

  // ============ Computed values ============
  const saldosCorridos = useMemo(() => {
    const balanceMap = new Map<string, { pen: number; usd: number }>();

    const porCuentaMoneda: Record<string, MovimientoTesoreria[]> = {};
    for (const mov of movimientos) {
      if (mov.estado === 'anulado') continue;
      const cuentaId = esIngresoMovimiento(mov) ? mov.cuentaDestino : mov.cuentaOrigen;
      if (!cuentaId) continue;
      const key = `${cuentaId}|${mov.moneda}`;
      if (!porCuentaMoneda[key]) porCuentaMoneda[key] = [];
      porCuentaMoneda[key].push(mov);
    }

    const saldoSimple = new Map<string, number>();
    Object.entries(porCuentaMoneda).forEach(([key, movsGrupo]) => {
      const [cuentaId, moneda] = key.split('|');
      const cuenta = cuentas.find(c => c.id === cuentaId);
      if (!cuenta) return;

      let saldo: number;
      if (cuenta.esBiMoneda) {
        saldo = moneda === 'USD' ? (cuenta.saldoUSD ?? 0) : (cuenta.saldoPEN ?? 0);
      } else {
        saldo = cuenta.saldoActual ?? 0;
      }

      for (const mov of movsGrupo) {
        saldoSimple.set(mov.id, Number(saldo.toFixed(2)));
        if (esIngresoMovimiento(mov)) saldo -= mov.monto;
        else saldo += mov.monto;
      }
    });

    for (const mov of movimientos) {
      if (mov.estado === 'anulado') continue;
      const cuentaId = esIngresoMovimiento(mov) ? mov.cuentaDestino : mov.cuentaOrigen;
      if (!cuentaId) continue;
      const cuenta = cuentas.find(c => c.id === cuentaId);
      if (!cuenta) continue;

      const saldoPropio = saldoSimple.get(mov.id) ?? 0;
      const otraMoneda = mov.moneda === 'USD' ? 'PEN' : 'USD';
      const otraKey = `${cuentaId}|${otraMoneda}`;
      const tieneOtraMoneda = !!porCuentaMoneda[otraKey] || cuenta.esBiMoneda;

      if (tieneOtraMoneda) {
        let saldoOtra: number | undefined;
        if (mov.conversionId && porCuentaMoneda[otraKey]) {
          const movPar = porCuentaMoneda[otraKey].find(m => m.conversionId === mov.conversionId);
          if (movPar) saldoOtra = saldoSimple.get(movPar.id);
        }
        if (saldoOtra === undefined) {
          saldoOtra = otraMoneda === 'USD'
            ? (cuenta.saldoUSD ?? (cuenta.moneda === 'USD' ? cuenta.saldoActual : 0))
            : (cuenta.saldoPEN ?? (cuenta.moneda === 'PEN' ? cuenta.saldoActual : 0));
        }
        balanceMap.set(mov.id, mov.moneda === 'PEN'
          ? { pen: saldoPropio, usd: saldoOtra }
          : { pen: saldoOtra, usd: saldoPropio }
        );
      } else {
        balanceMap.set(mov.id, mov.moneda === 'PEN'
          ? { pen: saldoPropio, usd: 0 }
          : { pen: 0, usd: saldoPropio }
        );
      }
    }

    return balanceMap;
  }, [movimientos, cuentas]);

  const chartEvolucionSaldo = useMemo(() => {
    const movsOrdenados = [...movimientos].filter(m => m.estado !== 'anulado').reverse();
    if (movsOrdenados.length === 0) return [];
    let saldoPEN = 0;
    cuentas.filter(c => c.activa).forEach(c => { saldoPEN += c.saldoPEN ?? c.saldoActual ?? 0; });
    movimientos.forEach(mov => {
      if (mov.estado === 'anulado' || mov.moneda !== 'PEN' || esMovimientoNeutro(mov)) return;
      if (esIngresoMovimiento(mov)) saldoPEN -= mov.monto;
      else saldoPEN += mov.monto;
    });
    const puntos: { fecha: string; saldo: number }[] = [];
    const fechaInicial = movsOrdenados[0].fecha?.toDate?.()
      ? movsOrdenados[0].fecha.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
      : '';
    puntos.push({ fecha: fechaInicial, saldo: Number(saldoPEN.toFixed(2)) });
    for (const mov of movsOrdenados) {
      if (mov.moneda !== 'PEN' || esMovimientoNeutro(mov)) continue;
      if (esIngresoMovimiento(mov)) saldoPEN += mov.monto;
      else saldoPEN -= mov.monto;
      puntos.push({
        fecha: mov.fecha?.toDate ? mov.fecha.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '',
        saldo: Number(saldoPEN.toFixed(2))
      });
    }
    return puntos;
  }, [movimientos, cuentas]);

  const chartEvolucionSaldoUSD = useMemo(() => {
    const movsOrdenados = [...movimientos].filter(m => m.estado !== 'anulado').reverse();
    if (movsOrdenados.length === 0) return [];
    let saldoUSD = 0;
    cuentas.filter(c => c.activa).forEach(c => {
      if (c.esBiMoneda) saldoUSD += c.saldoUSD || 0;
      else if (c.moneda === 'USD') saldoUSD += c.saldoActual ?? 0;
    });
    movimientos.forEach(mov => {
      if (mov.estado === 'anulado' || mov.moneda !== 'USD' || esMovimientoNeutro(mov)) return;
      if (esIngresoMovimiento(mov)) saldoUSD -= mov.monto;
      else saldoUSD += mov.monto;
    });
    const puntos: { fecha: string; saldo: number }[] = [];
    const movsUSD = movsOrdenados.filter(m => m.moneda === 'USD' && !esMovimientoNeutro(m));
    if (movsUSD.length === 0) return [];
    const fechaInicial = movsUSD[0].fecha?.toDate?.()
      ? movsUSD[0].fecha.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
      : '';
    puntos.push({ fecha: fechaInicial, saldo: Number(saldoUSD.toFixed(2)) });
    for (const mov of movsUSD) {
      if (esIngresoMovimiento(mov)) saldoUSD += mov.monto;
      else saldoUSD -= mov.monto;
      puntos.push({
        fecha: mov.fecha?.toDate ? mov.fecha.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '',
        saldo: Number(saldoUSD.toFixed(2))
      });
    }
    return puntos;
  }, [movimientos, cuentas]);

  const totalesMovimientos = useMemo(() => {
    const activos = movimientosFiltrados.filter(m => m.estado !== 'anulado');
    let entradasPEN = 0, salidasPEN = 0, entradasUSD = 0, salidasUSD = 0;
    for (const mov of activos) {
      const esIng = esIngresoMovimiento(mov);
      if (mov.moneda === 'PEN') { if (esIng) entradasPEN += mov.monto; else salidasPEN += mov.monto; }
      else { if (esIng) entradasUSD += mov.monto; else salidasUSD += mov.monto; }
    }
    return { entradasPEN, salidasPEN, entradasUSD, salidasUSD, total: activos.length };
  }, [movimientosFiltrados]);

  const isAdmin = userProfile?.role === 'admin';

  // ============ Render ============
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tesoreria</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Gestion de caja, movimientos y conversiones
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {!statsOptimizadas && (
            <Button
              variant="secondary"
              onClick={handleRecalcularEstadisticas}
              disabled={isRecalculando || loading}
              title="Inicializar estadisticas optimizadas (solo una vez)"
              className="text-xs"
            >
              {isRecalculando ? (
                <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /><span className="hidden sm:inline">Calculando...</span></>
              ) : (
                <><TrendingUp className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Optimizar</span></>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            title="Actualizar datos"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card padding="md" className="bg-gradient-to-br from-green-50 to-white border-green-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-green-800 uppercase tracking-wide">Soles (PEN)</h3>
                <Banknote className="h-5 w-5 sm:h-8 sm:w-8 text-green-500" />
              </div>
              <div className="text-xl sm:text-3xl font-bold text-green-700 mb-2 sm:mb-3">
                S/ {stats.saldoTotalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-3 border-t border-green-200">
                <div>
                  <div className="flex items-center text-xs text-gray-500 mb-1">
                    <ArrowUpCircle className="h-3 w-3 mr-1 text-green-500" />
                    Ingresos Mes
                  </div>
                  <div className="text-sm font-semibold text-green-600">
                    +S/ {stats.ingresosMesPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="flex items-center text-xs text-gray-500 mb-1">
                    <ArrowDownCircle className="h-3 w-3 mr-1 text-red-500" />
                    Egresos Mes
                  </div>
                  <div className="text-sm font-semibold text-red-600">
                    -S/ {stats.egresosMesPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-green-100">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Balance Mes:</span>
                  <span className={`font-semibold ${(stats.ingresosMesPEN - stats.egresosMesPEN) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(stats.ingresosMesPEN - stats.egresosMesPEN) >= 0 ? '+' : ''}S/ {(stats.ingresosMesPEN - stats.egresosMesPEN).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </Card>

            <Card padding="md" className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Dolares (USD)</h3>
                <DollarSign className="h-5 w-5 sm:h-8 sm:w-8 text-blue-500" />
              </div>
              <div className="text-xl sm:text-3xl font-bold text-blue-700 mb-2 sm:mb-3">
                $ {stats.saldoTotalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-3 border-t border-blue-200">
                <div>
                  <div className="flex items-center text-xs text-gray-500 mb-1">
                    <ArrowUpCircle className="h-3 w-3 mr-1 text-green-500" />
                    Ingresos Mes
                  </div>
                  <div className="text-sm font-semibold text-green-600">
                    +$ {stats.ingresosMesUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="flex items-center text-xs text-gray-500 mb-1">
                    <ArrowDownCircle className="h-3 w-3 mr-1 text-red-500" />
                    Egresos Mes
                  </div>
                  <div className="text-sm font-semibold text-red-600">
                    -$ {stats.egresosMesUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-blue-100">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Balance Mes:</span>
                  <span className={`font-semibold ${(stats.ingresosMesUSD - stats.egresosMesUSD) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(stats.ingresosMesUSD - stats.egresosMesUSD) >= 0 ? '+' : ''}$ {(stats.ingresosMesUSD - stats.egresosMesUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <Card padding="sm" className="bg-gray-50">
              <div className="text-[10px] sm:text-xs text-gray-500 mb-1">Conversiones Mes</div>
              <div className="text-base sm:text-lg font-bold text-gray-800">{stats.conversionesMes || 0}</div>
              <div className="text-xs text-gray-400 mt-1">Spread prom: {(stats.spreadPromedioMes || 0).toFixed(3)}</div>
            </Card>
            <Card padding="sm" className="bg-gray-50">
              <div className="text-[10px] sm:text-xs text-gray-500 mb-1"><span className="sm:hidden">TC Prom.</span><span className="hidden sm:inline">TC Promedio Usado</span></div>
              <div className="text-base sm:text-lg font-bold text-gray-800">{(stats.tcPromedioMes || tcDefault).toFixed(3)}</div>
              <div className="text-xs text-gray-400 mt-1">Este mes</div>
            </Card>
            <Card padding="sm" className="bg-amber-50 border-amber-200">
              <div className="text-[10px] sm:text-xs text-amber-700 mb-1"><span className="sm:hidden">Pend. USD</span><span className="hidden sm:inline">Pagos Pendientes USD</span></div>
              <div className="text-base sm:text-lg font-bold text-amber-800">$ {(stats.pagosPendientesUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div className="text-xs text-amber-600 mt-1">Por pagar</div>
            </Card>
            <Card padding="sm" className="bg-amber-50 border-amber-200">
              <div className="text-[10px] sm:text-xs text-amber-700 mb-1"><span className="sm:hidden">Pend. PEN</span><span className="hidden sm:inline">Pagos Pendientes PEN</span></div>
              <div className="text-base sm:text-lg font-bold text-amber-800">S/ {(stats.pagosPendientesPEN || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</div>
              <div className="text-xs text-amber-600 mt-1">Por pagar</div>
            </Card>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex sm:space-x-8">
          {([
            { key: 'movimientos', icon: Wallet, label: 'Movimientos', labelSm: 'Mov.' },
            { key: 'conversiones', icon: RefreshCw, label: 'Conversiones', labelSm: 'Conv.' },
            { key: 'transferencias', icon: ArrowLeftRight, label: 'Transferencias', labelSm: 'Transf.' },
            { key: 'cuentas', icon: Building2, label: 'Cuentas', labelSm: 'Ctas.' },
            { key: 'pendientes', icon: FileText, label: 'CxP/CxC', labelSm: 'CxP' },
          ] as { key: TabActiva; icon: any; label: string; labelSm: string }[]).map(({ key, icon: Icon, label, labelSm }) => (
            <button
              key={key}
              onClick={() => {
                setTabActiva(key);
                if (key === 'pendientes' && !dashboardPendientes) loadPendientes();
              }}
              className={`flex-1 sm:flex-none py-2.5 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex items-center justify-center sm:justify-start gap-1 sm:gap-2 ${
                tabActiva === key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{labelSm}</span>
              {key === 'pendientes' && dashboardPendientes &&
                (dashboardPendientes.cuentasPorCobrar.cantidadDocumentos + dashboardPendientes.cuentasPorPagar.cantidadDocumentos) > 0 && (
                <span className="px-1 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded-full bg-orange-100 text-orange-800">
                  {dashboardPendientes.cuentasPorCobrar.cantidadDocumentos + dashboardPendientes.cuentasPorPagar.cantidadDocumentos}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {tabActiva === 'movimientos' && (
        <TabMovimientos
          movimientosFiltrados={movimientosFiltrados}
          cuentas={cuentas}
          saldosCorridos={saldosCorridos}
          chartEvolucionSaldo={chartEvolucionSaldo}
          chartEvolucionSaldoUSD={chartEvolucionSaldoUSD}
          totalesMovimientos={totalesMovimientos}
          isMovimientoModalOpen={isMovimientoModalOpen}
          setIsMovimientoModalOpen={setIsMovimientoModalOpen}
          movimientoEditando={movimientoEditando}
          movimientoForm={movimientoForm}
          setMovimientoForm={setMovimientoForm}
          isSubmitting={isSubmitting}
          tcDefault={tcDefault}
          isAdmin={isAdmin}
          esIngreso={esIngreso}
          esIngresoMovimiento={esIngresoMovimiento}
          getTipoLabel={getTipoLabel}
          handleEditarMovimiento={handleEditarMovimiento}
          handleAnularMovimiento={handleAnularMovimiento}
          handleGuardarMovimiento={handleGuardarMovimiento}
          handleCerrarModalMovimiento={handleCerrarModalMovimiento}
        />
      )}

      {tabActiva === 'conversiones' && (
        <TabConversiones
          conversiones={conversiones}
          cuentas={cuentas}
          isConversionModalOpen={isConversionModalOpen}
          setIsConversionModalOpen={setIsConversionModalOpen}
          conversionForm={conversionForm}
          setConversionForm={setConversionForm}
          isSubmitting={isSubmitting}
          tcDefault={tcDefault}
          handleCrearConversion={handleCrearConversion}
        />
      )}

      {tabActiva === 'transferencias' && (
        <TabTransferencias
          transferencias={transferencias}
          cuentas={cuentas}
          isTransferenciaModalOpen={isTransferenciaModalOpen}
          setIsTransferenciaModalOpen={setIsTransferenciaModalOpen}
          transferenciaForm={transferenciaForm}
          setTransferenciaForm={setTransferenciaForm}
          isSubmitting={isSubmitting}
          tcDefault={tcDefault}
          handleCrearTransferencia={handleCrearTransferencia}
        />
      )}

      {tabActiva === 'cuentas' && (
        <TabCuentas
          cuentas={cuentas}
          movimientosFiltrados={movimientosFiltrados}
          cuentaDetalle={cuentaDetalle}
          setCuentaDetalle={setCuentaDetalle}
          movsLimit={movsLimit}
          setMovsLimit={setMovsLimit}
          isCuentaModalOpen={isCuentaModalOpen}
          setIsCuentaModalOpen={setIsCuentaModalOpen}
          cuentaEditando={cuentaEditando}
          cuentaForm={cuentaForm}
          setCuentaForm={setCuentaForm}
          isSubmitting={isSubmitting}
          handleEditarCuenta={handleEditarCuenta}
          handleGuardarCuenta={handleGuardarCuenta}
          handleCerrarModalCuenta={handleCerrarModalCuenta}
          handleRecalcularSaldos={handleRecalcularSaldos}
          getTipoLabel={getTipoLabel}
          esIngresoMovimiento={esIngresoMovimiento}
        />
      )}

      {tabActiva === 'pendientes' && (
        <TabPendientes
          dashboardPendientes={dashboardPendientes}
          loadingPendientes={loadingPendientes}
          loadPendientes={loadPendientes}
          handleNavigarPendiente={handleNavigarPendiente}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
};
