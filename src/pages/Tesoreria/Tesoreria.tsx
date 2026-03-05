import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  XCircle,
  Trash2,
  MoreVertical,
  ExternalLink,
  ArrowLeftRight,
  CreditCard,
  Truck,
  ShoppingCart,
  Receipt
} from 'lucide-react';
import { Button, Card, Modal, useConfirmDialog, ConfirmDialog } from '../../components/common';
import { TesoreriaService } from '../../services/tesoreria.service';
import { cuentasPendientesService } from '../../services/cuentasPendientes.service';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { useTesoreriaStore } from '../../store/tesoreriaStore';
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
  DashboardCuentasPendientes,
  PendienteFinanciero,
  TransferenciaEntreCuentasFormData
} from '../../types/tesoreria.types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

type TabActiva = 'movimientos' | 'conversiones' | 'transferencias' | 'cuentas' | 'pendientes';

// Interface para transferencia entre cuentas (para el historial)
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
  const {
    movimientos,
    conversiones,
    cuentas,
    stats,
    loading: loadingStore,
    fetchAll: storeFetchAll
  } = useTesoreriaStore();
  const navigate = useNavigate();

  const [tabActiva, setTabActiva] = useState<TabActiva>('movimientos');
  const [loadingLocal, setLoadingLocal] = useState(true);
  const loading = loadingStore || loadingLocal;

  // Data local (derivada o de otros servicios)
  const [transferencias, setTransferencias] = useState<TransferenciaEntreCuentas[]>([]);
  const [dashboardPendientes, setDashboardPendientes] = useState<DashboardCuentasPendientes | null>(null);
  const [loadingPendientes, setLoadingPendientes] = useState(false);

  // Modales
  const [isMovimientoModalOpen, setIsMovimientoModalOpen] = useState(false);
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [isTransferenciaModalOpen, setIsTransferenciaModalOpen] = useState(false);
  const [isCuentaModalOpen, setIsCuentaModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para edición de cuentas
  const [cuentaEditando, setCuentaEditando] = useState<CuentaCaja | null>(null);

  // Estado para edición de movimientos
  const [movimientoEditando, setMovimientoEditando] = useState<MovimientoTesoreria | null>(null);

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
  const [transferenciaForm, setTransferenciaForm] = useState<Partial<TransferenciaEntreCuentasFormData>>({
    moneda: 'PEN',
    fecha: new Date(),
    tipoCambio: 3.70
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRecalculando, setIsRecalculando] = useState(false);
  const [statsOptimizadas, setStatsOptimizadas] = useState(false);

  // Hook para dialogo de confirmacion
  const { dialogProps, confirm } = useConfirmDialog();

  // Cargar datos
  useEffect(() => {
    loadData();
    // Verificar si hay estadísticas materializadas
    TesoreriaService.getEstadisticasAgregadas().then(stats => {
      setStatsOptimizadas(!!stats);
    });
  }, []);

  // Cargar transferencias cuando cambian los movimientos o cuentas
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
      message: 'Esto procesara todos los movimientos y conversiones del año. Solo necesitas hacerlo una vez o si detectas inconsistencias.',
      confirmText: 'Recalcular',
      variant: 'warning'
    });
    if (!confirmed) return;

    setIsRecalculando(true);
    try {
      const resultado = await TesoreriaService.recalcularEstadisticasCompletas(user.uid);
      toast.success(`${resultado.mensaje} (${resultado.tiempoMs}ms)`, 'Estadísticas recalculadas');
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
      // Filtrar movimientos de tipo transferencia_interna
      const movsTrans = movimientos.filter(m =>
        m.tipo === 'transferencia_interna' && m.estado !== 'anulado'
      );

      // Separar SALIDAS y ENTRADAS
      const salidas = movsTrans.filter(m => m.cuentaOrigen && !m.cuentaDestino);
      const entradas = movsTrans.filter(m => m.cuentaDestino && !m.cuentaOrigen);
      // También soportar movimientos legacy que tienen ambas cuentas
      const completos = movsTrans.filter(m => m.cuentaOrigen && m.cuentaDestino);

      const transArray: TransferenciaEntreCuentas[] = [];

      // Emparejar SALIDA + ENTRADA por monto y fecha cercana
      const entradasUsadas = new Set<string>();

      for (const salida of salidas) {
        // Buscar la ENTRADA correspondiente: mismo monto, misma moneda, fecha similar
        const entrada = entradas.find(e =>
          !entradasUsadas.has(e.id) &&
          e.monto === salida.monto &&
          e.moneda === salida.moneda &&
          Math.abs(e.fecha.toMillis() - salida.fecha.toMillis()) < 60000 // dentro de 1 min
        );

        if (entrada) {
          entradasUsadas.add(entrada.id);
        }

        const cuentaOrigenData = cuentas.find(c => c.id === salida.cuentaOrigen);
        const cuentaDestinoData = entrada ? cuentas.find(c => c.id === entrada.cuentaDestino) : null;
        const fechaDate = salida.fecha.toDate();

        transArray.push({
          id: salida.id,
          fecha: fechaDate,
          cuentaOrigenId: salida.cuentaOrigen || '',
          cuentaOrigenNombre: cuentaOrigenData?.nombre || 'Cuenta desconocida',
          cuentaDestinoId: entrada?.cuentaDestino || '',
          cuentaDestinoNombre: cuentaDestinoData?.nombre || 'Cuenta desconocida',
          monto: salida.monto,
          moneda: salida.moneda,
          concepto: salida.concepto?.replace('[SALIDA] ', '').replace('Transferencia entre cuentas: ', '') || '',
          creadoPor: salida.creadoPor,
          creadoEn: salida.fechaCreacion.toDate()
        });
      }

      // Agregar movimientos completos (legacy que ya tienen ambas cuentas)
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

      // Ordenar por fecha descendente
      transArray.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

      setTransferencias(transArray);
    } catch (error) {
      console.error('Error al cargar transferencias:', error);
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
      toast.success('Movimiento registrado');
      loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error al registrar movimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        // Actualizar movimiento existente
        await TesoreriaService.actualizarMovimiento(
          movimientoEditando.id,
          {
            ...movimientoForm,
            fecha: movimientoForm.fecha || new Date(),
            tipoCambio: movimientoForm.tipoCambio || 3.70,
            metodo: movimientoForm.metodo || 'efectivo'
          } as MovimientoTesoreriaFormData,
          user.uid
        );
      } else {
        // Crear nuevo movimiento
        await TesoreriaService.registrarMovimiento(
          {
            ...movimientoForm,
            fecha: movimientoForm.fecha || new Date(),
            tipoCambio: movimientoForm.tipoCambio || 3.70,
            metodo: movimientoForm.metodo || 'efectivo'
          } as MovimientoTesoreriaFormData,
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
    setMovimientoForm({
      tipo: 'ingreso_venta',
      moneda: 'PEN',
      fecha: new Date(),
      tipoCambio: 3.70,
      metodo: 'efectivo'
    });
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

  // Navegar al documento pendiente para registrar pago
  const handleNavigarPendiente = (pendiente: PendienteFinanciero) => {
    switch (pendiente.tipo) {
      case 'venta_por_cobrar':
        // Navegar a Ventas con el ID de la venta para abrir el modal de pago
        navigate(`/ventas?ventaId=${pendiente.documentoId}`);
        break;
      case 'orden_compra_por_pagar':
        // Navegar a Compras (órdenes de compra)
        navigate(`/compras?ocId=${pendiente.documentoId}`);
        break;
      case 'gasto_por_pagar':
        // Navegar a Gastos
        navigate(`/gastos?gastoId=${pendiente.documentoId}`);
        break;
      case 'viajero_por_pagar':
        // Navegar a Transferencias
        navigate(`/transferencias?transferenciaId=${pendiente.documentoId}`);
        break;
      default:
        console.warn('Tipo de pendiente no soportado:', pendiente.tipo);
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
        tipoCambio: 3.70,
        cuentaOrigenId: undefined,
        cuentaDestinoId: undefined
      });
      toast.success('Conversión registrada');
      loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error en conversión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCrearTransferencia = async () => {
    if (!user || !transferenciaForm.monto || !transferenciaForm.cuentaOrigenId || !transferenciaForm.cuentaDestinoId) return;

    setIsSubmitting(true);
    try {
      await TesoreriaService.transferirEntreCuentas(
        {
          ...transferenciaForm,
          fecha: transferenciaForm.fecha || new Date(),
          tipoCambio: transferenciaForm.tipoCambio || 3.70,
          moneda: transferenciaForm.moneda || 'PEN',
          monto: transferenciaForm.monto,
          cuentaOrigenId: transferenciaForm.cuentaOrigenId,
          cuentaDestinoId: transferenciaForm.cuentaDestinoId
        } as TransferenciaEntreCuentasFormData,
        user.uid
      );
      setIsTransferenciaModalOpen(false);
      setTransferenciaForm({
        moneda: 'PEN',
        fecha: new Date(),
        tipoCambio: 3.70
      });
      toast.success('Transferencia realizada');
      // Recargar datos y cargar historial de transferencias
      await loadData();
      await loadTransferencias();
    } catch (error: any) {
      toast.error(error.message, 'Error en transferencia');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCrearCuenta = async () => {
    if (!user || !cuentaForm.nombre || !cuentaForm.titular?.trim()) {
      toast.warning('El nombre y el titular de la cuenta son obligatorios');
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
      toast.success('Cuenta creada');
      loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error al crear cuenta');
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
      toast.warning('El nombre y el titular de la cuenta son obligatorios');
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
    return ['ingreso_venta', 'ingreso_anticipo', 'ingreso_otro', 'ajuste_positivo'].includes(tipo);
  };

  // Para conversiones y transferencias, determinar si es ingreso basándose en cuentaDestino
  const esIngresoMovimiento = (mov: MovimientoTesoreria): boolean => {
    // Transferencias internas: ENTRADA tiene cuentaDestino, SALIDA tiene cuentaOrigen
    if (mov.tipo === 'transferencia_interna') {
      return !!mov.cuentaDestino && !mov.cuentaOrigen;
    }
    // Conversiones: ENTRADA tiene cuentaDestino (dinero que entra), SALIDA tiene cuentaOrigen
    if (mov.tipo === 'conversion_pen_usd' || mov.tipo === 'conversion_usd_pen') {
      return !!mov.cuentaDestino && !mov.cuentaOrigen;
    }
    // Para otros tipos, usar la lógica normal
    return esIngreso(mov.tipo);
  };

  // Determinar si un movimiento es neutro para el saldo global (no cambia patrimonio total)
  const esMovimientoNeutro = (mov: MovimientoTesoreria): boolean => {
    return mov.tipo === 'transferencia_interna';
    // Las conversiones NO son neutras: cambian saldo PEN vs USD
  };

  // ============ Saldo Corrido por Movimiento ============
  // Agrupa por cuenta+moneda para calcular saldos correctos
  // Para cuentas bi-moneda, muestra ambos saldos (PEN y USD) en cada fila
  const saldosCorridos = useMemo(() => {
    const balanceMap = new Map<string, { pen: number; usd: number }>();

    // Paso 1: Agrupar movimientos por cuenta+moneda
    const porCuentaMoneda: Record<string, MovimientoTesoreria[]> = {};
    for (const mov of movimientos) {
      if (mov.estado === 'anulado') continue;
      const cuentaId = esIngresoMovimiento(mov) ? mov.cuentaDestino : mov.cuentaOrigen;
      if (!cuentaId) continue;
      const key = `${cuentaId}|${mov.moneda}`;
      if (!porCuentaMoneda[key]) porCuentaMoneda[key] = [];
      porCuentaMoneda[key].push(mov);
    }

    // Paso 2: Calcular saldo corrido simple por cada track (cuenta+moneda)
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

    // Paso 3: Para cada movimiento, construir el objeto {pen, usd}
    for (const mov of movimientos) {
      if (mov.estado === 'anulado') continue;
      const cuentaId = esIngresoMovimiento(mov) ? mov.cuentaDestino : mov.cuentaOrigen;
      if (!cuentaId) continue;
      const cuenta = cuentas.find(c => c.id === cuentaId);
      if (!cuenta) continue;

      const saldoPropio = saldoSimple.get(mov.id) ?? 0;

      // Verificar si esta cuenta tiene movimientos en la otra moneda (bi-moneda real)
      const otraMoneda = mov.moneda === 'USD' ? 'PEN' : 'USD';
      const otraKey = `${cuentaId}|${otraMoneda}`;
      const tieneOtraMoneda = !!porCuentaMoneda[otraKey] || cuenta.esBiMoneda;

      if (tieneOtraMoneda) {
        let saldoOtra: number | undefined;

        // Para conversiones: buscar el movimiento par (mismo conversionId, otra moneda, misma cuenta)
        if (mov.conversionId && porCuentaMoneda[otraKey]) {
          const movPar = porCuentaMoneda[otraKey].find(m => m.conversionId === mov.conversionId);
          if (movPar) saldoOtra = saldoSimple.get(movPar.id);
        }

        // Fallback: usar el saldo actual de la otra moneda
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

  // ============ Datos para Gráfica de Evolución ============
  const chartEvolucionSaldo = useMemo(() => {
    const movsOrdenados = [...movimientos]
      .filter(m => m.estado !== 'anulado')
      .reverse();

    if (movsOrdenados.length === 0) return [];

    // Calcular saldo PEN total actual
    let saldoPEN = 0;
    cuentas.filter(c => c.activa).forEach(c => {
      saldoPEN += c.saldoPEN ?? c.saldoActual ?? 0;
    });

    // Retroceder: restar todos los movimientos PEN para obtener saldo inicial
    // Excluir movimientos neutros (transferencias): no cambian el patrimonio global
    movimientos.forEach(mov => {
      if (mov.estado === 'anulado' || mov.moneda !== 'PEN' || esMovimientoNeutro(mov)) return;
      if (esIngresoMovimiento(mov)) saldoPEN -= mov.monto;
      else saldoPEN += mov.monto;
    });

    // Avanzar cronológicamente construyendo puntos
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
        fecha: mov.fecha?.toDate
          ? mov.fecha.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
          : '',
        saldo: Number(saldoPEN.toFixed(2))
      });
    }

    return puntos;
  }, [movimientos, cuentas]);

  // ============ Datos para Gráfica de Evolución USD ============
  const chartEvolucionSaldoUSD = useMemo(() => {
    const movsOrdenados = [...movimientos]
      .filter(m => m.estado !== 'anulado')
      .reverse();

    if (movsOrdenados.length === 0) return [];

    // Calcular saldo USD total actual
    let saldoUSD = 0;
    cuentas.filter(c => c.activa).forEach(c => {
      if (c.esBiMoneda) {
        saldoUSD += c.saldoUSD || 0;
      } else if (c.moneda === 'USD') {
        saldoUSD += c.saldoActual ?? 0;
      }
    });

    // Retroceder: restar todos los movimientos USD para obtener saldo inicial
    movimientos.forEach(mov => {
      if (mov.estado === 'anulado' || mov.moneda !== 'USD' || esMovimientoNeutro(mov)) return;
      if (esIngresoMovimiento(mov)) saldoUSD -= mov.monto;
      else saldoUSD += mov.monto;
    });

    // Avanzar cronológicamente construyendo puntos
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
        fecha: mov.fecha?.toDate
          ? mov.fecha.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
          : '',
        saldo: Number(saldoUSD.toFixed(2))
      });
    }

    return puntos;
  }, [movimientos, cuentas]);

  // Recalcular saldos de todas las cuentas basándose en los movimientos
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
        toast.warning(`${resultado.cuentasActualizadas} cuenta(s) actualizadas con ${resultado.errores.length} error(es)`, 'Recálculo parcial');
      } else {
        toast.success(`${resultado.cuentasActualizadas} cuenta(s) actualizadas correctamente`, 'Saldos recalculados');
      }

      // Recargar datos
      await loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error al recalcular saldos');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tesorería</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Gestión de caja, movimientos y conversiones
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {!statsOptimizadas && (
            <Button
              variant="secondary"
              onClick={handleRecalcularEstadisticas}
              disabled={isRecalculando || loading}
              title="Inicializar estadísticas optimizadas (solo una vez)"
              className="text-xs"
            >
              {isRecalculando ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  <span className="hidden sm:inline">Calculando...</span>
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Optimizar</span>
                </>
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

      {/* KPIs - Saldos por Moneda */}
      {stats && (
        <div className="space-y-4">
          {/* Fila 1: Saldos Actuales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card Soles */}
            <Card padding="md" className="bg-gradient-to-br from-green-50 to-white border-green-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-green-800 uppercase tracking-wide">Soles (PEN)</h3>
                <Banknote className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-green-700 mb-3">
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

            {/* Card Dólares */}
            <Card padding="md" className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Dólares (USD)</h3>
                <DollarSign className="h-8 w-8 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-blue-700 mb-3">
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

          {/* Fila 2: Métricas adicionales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card padding="sm" className="bg-gray-50">
              <div className="text-xs text-gray-500 mb-1">Conversiones Mes</div>
              <div className="text-lg font-bold text-gray-800">
                {stats.conversionesMes || 0}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Spread prom: {(stats.spreadPromedioMes || 0).toFixed(3)}
              </div>
            </Card>

            <Card padding="sm" className="bg-gray-50">
              <div className="text-xs text-gray-500 mb-1">TC Promedio Usado</div>
              <div className="text-lg font-bold text-gray-800">
                {(stats.tcPromedioMes || 3.70).toFixed(3)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Este mes
              </div>
            </Card>

            <Card padding="sm" className="bg-amber-50 border-amber-200">
              <div className="text-xs text-amber-700 mb-1">Pagos Pendientes USD</div>
              <div className="text-lg font-bold text-amber-800">
                $ {(stats.pagosPendientesUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-amber-600 mt-1">
                Por pagar
              </div>
            </Card>

            <Card padding="sm" className="bg-amber-50 border-amber-200">
              <div className="text-xs text-amber-700 mb-1">Pagos Pendientes PEN</div>
              <div className="text-lg font-bold text-amber-800">
                S/ {(stats.pagosPendientesPEN || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-amber-600 mt-1">
                Por pagar
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex overflow-x-auto scrollbar-hide space-x-4 sm:space-x-8">
          <button
            onClick={() => setTabActiva('movimientos')}
            className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
              tabActiva === 'movimientos'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Wallet className="h-4 w-4 sm:h-5 sm:w-5 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Movimientos</span>
            <span className="sm:hidden">Mov.</span>
          </button>
          <button
            onClick={() => setTabActiva('conversiones')}
            className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
              tabActiva === 'conversiones'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Conversiones</span>
            <span className="sm:hidden">Conv.</span>
          </button>
          <button
            onClick={() => setTabActiva('transferencias')}
            className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
              tabActiva === 'transferencias'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ArrowLeftRight className="h-4 w-4 sm:h-5 sm:w-5 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Transferencias</span>
            <span className="sm:hidden">Transf.</span>
          </button>
          <button
            onClick={() => setTabActiva('cuentas')}
            className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
              tabActiva === 'cuentas'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 inline mr-1 sm:mr-2" />
            Cuentas
          </button>
          <button
            onClick={() => {
              setTabActiva('pendientes');
              if (!dashboardPendientes) loadPendientes();
            }}
            className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
              tabActiva === 'pendientes'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 inline mr-1 sm:mr-2" />
            CxP/CxC
            {dashboardPendientes && (dashboardPendientes.cuentasPorCobrar.cantidadDocumentos + dashboardPendientes.cuentasPorPagar.cantidadDocumentos) > 0 && (
              <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800">
                {dashboardPendientes.cuentasPorCobrar.cantidadDocumentos + dashboardPendientes.cuentasPorPagar.cantidadDocumentos}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Contenido de Tab */}
      {tabActiva === 'movimientos' && (
        <Card padding="none">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              Movimientos ({movimientos.length})
            </h3>
            <Button variant="primary" onClick={() => setIsMovimientoModalOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
              <span className="sm:hidden">Nuevo</span>
              <span className="hidden sm:inline">Nuevo Movimiento</span>
            </Button>
          </div>

          {/* Gráficas Evolución de Saldo */}
          {(chartEvolucionSaldo.length > 1 || chartEvolucionSaldoUSD.length > 1) && (
            <div className="px-4 sm:px-6 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* PEN */}
              {chartEvolucionSaldo.length > 1 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Evolución de Saldo (PEN)
                  </h4>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartEvolucionSaldo}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v: number) => v >= 1000 ? `S/${(v / 1000).toFixed(1)}K` : `S/${v}`}
                          width={70}
                        />
                        <Tooltip
                          formatter={(value: number) => [`S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 'Saldo']}
                          contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                        />
                        <Line type="monotone" dataKey="saldo" stroke="#10B981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {/* USD */}
              {chartEvolucionSaldoUSD.length > 1 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    Evolución de Saldo (USD)
                  </h4>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartEvolucionSaldoUSD}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v}`}
                          width={70}
                        />
                        <Tooltip
                          formatter={(value: number) => [`$ ${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Saldo']}
                          contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                        />
                        <Line type="monotone" dataKey="saldo" stroke="#3B82F6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tipo
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Doc.
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cuenta
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Concepto
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-green-700 uppercase bg-green-50">
                    Soles (S/)
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-blue-700 uppercase bg-blue-50">
                    Dólares ($)
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    TC
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      No hay movimientos registrados
                    </td>
                  </tr>
                ) : (
                  movimientos.map((mov) => {
                    const esIngresoPEN = mov.moneda === 'PEN' && esIngresoMovimiento(mov);
                    const esEgresoPEN = mov.moneda === 'PEN' && !esIngresoMovimiento(mov);
                    const esIngresoUSD = mov.moneda === 'USD' && esIngresoMovimiento(mov);
                    const esEgresoUSD = mov.moneda === 'USD' && !esIngresoMovimiento(mov);

                    return (
                      <tr
                        key={mov.id}
                        className={`hover:bg-gray-50 ${mov.estado === 'anulado' ? 'opacity-50 bg-gray-100' : ''}`}
                      >
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(mov.fecha)}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                mov.tipo === 'ingreso_anticipo'
                                  ? 'bg-purple-100 text-purple-800'
                                  : esIngresoMovimiento(mov)
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {esIngresoMovimiento(mov) && <TrendingUp className="h-3 w-3 mr-1" />}
                              {!esIngresoMovimiento(mov) && <TrendingDown className="h-3 w-3 mr-1" />}
                              {getTipoLabel(mov.tipo)}
                            </span>
                            {mov.estado === 'anulado' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                                ANULADO
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm">
                          {mov.ordenCompraNumero ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-medium">
                              {mov.ordenCompraNumero}
                            </span>
                          ) : mov.ventaNumero ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-medium">
                              {mov.ventaNumero}
                            </span>
                          ) : mov.cotizacionNumero ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 text-xs font-medium">
                              {mov.cotizacionNumero}
                            </span>
                          ) : mov.transferenciaNumero ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-xs font-medium">
                              {mov.transferenciaNumero}
                            </span>
                          ) : mov.gastoNumero ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-xs font-medium">
                              {mov.gastoNumero}
                            </span>
                          ) : mov.conversionId ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">
                              Conversión
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        {/* Columna de Cuenta */}
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm">
                          {(() => {
                            const cuentaId = esIngresoMovimiento(mov) ? mov.cuentaDestino : mov.cuentaOrigen;
                            const cuenta = cuentaId ? cuentas.find(c => c.id === cuentaId) : null;
                            if (cuenta) {
                              const saldos = saldosCorridos.get(mov.id);
                              return (
                                <div className="flex flex-col">
                                  <span className="font-medium text-gray-900 truncate max-w-[120px]" title={cuenta.nombre}>
                                    {cuenta.nombre}
                                  </span>
                                  {saldos && saldos.pen !== 0 && saldos.usd !== 0 ? (
                                    <div className="flex gap-2 text-xs text-gray-500">
                                      <span className={mov.moneda === 'PEN' ? 'font-semibold text-gray-700' : ''}>
                                        S/{saldos.pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                      </span>
                                      <span className="text-gray-300">|</span>
                                      <span className={mov.moneda === 'USD' ? 'font-semibold text-gray-700' : ''}>
                                        ${saldos.usd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-500">
                                      Saldo: {mov.moneda === 'USD' ? '$' : 'S/'}{(saldos ? (mov.moneda === 'USD' ? saldos.usd : saldos.pen) : 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            return <span className="text-gray-400">-</span>;
                          })()}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-gray-900 max-w-xs truncate" title={mov.concepto}>
                          {mov.concepto || '-'}
                        </td>
                        {/* Columna Soles */}
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm text-right font-medium bg-green-50/30">
                          {mov.moneda === 'PEN' ? (
                            <span className={esIngresoPEN ? 'text-green-600' : 'text-red-600'}>
                              {esIngresoPEN ? '+' : '-'} S/ {mov.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        {/* Columna Dólares */}
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm text-right font-medium bg-blue-50/30">
                          {mov.moneda === 'USD' ? (
                            <span className={esIngresoUSD ? 'text-green-600' : 'text-red-600'}>
                              {esIngresoUSD ? '+' : '-'} $ {mov.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm text-right text-gray-500">
                          {mov.tipoCambio.toFixed(3)}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-center">
                          {mov.estado !== 'anulado' && userProfile?.role === 'admin' && (
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => handleEditarMovimiento(mov)}
                                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-colors"
                                title="Editar movimiento"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleAnularMovimiento(mov)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                title="Anular movimiento"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tabActiva === 'conversiones' && (
        <Card padding="none">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              Conversiones ({conversiones.length})
            </h3>
            <Button variant="primary" onClick={() => setIsConversionModalOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
              <span className="sm:hidden">Nueva</span>
              <span className="hidden sm:inline">Nueva Conversión</span>
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

      {/* Tab de Transferencias entre Cuentas */}
      {tabActiva === 'transferencias' && (
        <Card padding="none">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Transferencias entre Cuentas
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 hidden sm:block">
                Mueve fondos entre tus propias cuentas sin afectar el patrimonio
              </p>
            </div>
            <Button variant="primary" onClick={() => setIsTransferenciaModalOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
              <span className="sm:hidden">Nueva</span>
              <span className="hidden sm:inline">Nueva Transferencia</span>
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
                    Cuenta Origen
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    →
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cuenta Destino
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Concepto
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transferencias.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      <ArrowLeftRight className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium">No hay transferencias registradas</p>
                      <p className="text-sm mt-1">Las transferencias entre cuentas se mostrarán aquí</p>
                    </td>
                  </tr>
                ) : (
                  transferencias.map((transf) => (
                    <tr key={transf.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(transf.fecha)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium text-gray-900">{transf.cuentaOrigenNombre}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <ArrowLeftRight className="h-4 w-4 text-gray-400 inline" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium text-gray-900">{transf.cuentaDestinoNombre}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        {transf.moneda === 'PEN' ? 'S/ ' : '$ '}
                        {transf.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transf.concepto || '-'}
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
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              Cuentas de Caja ({cuentas.length})
            </h3>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={handleRecalcularSaldos}
                disabled={isSubmitting || cuentas.length === 0}
                title="Recalcular saldos basándose en los movimientos registrados"
                className="flex-1 sm:flex-none"
              >
                <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 ${isSubmitting ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Recalcular</span>
              </Button>
              <Button variant="primary" onClick={() => setIsCuentaModalOpen(true)} className="flex-1 sm:flex-none">
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                <span className="sm:hidden">Nueva</span>
                <span className="hidden sm:inline">Nueva Cuenta</span>
              </Button>
            </div>
          </div>
          {cuentas.length === 0 ? (
            <div className="text-center text-gray-500 py-8 px-6">
              No hay cuentas registradas
            </div>
          ) : (
            <>
              {/* === CUENTAS DE CAJA (Activos) === */}
              <div className="p-4 sm:p-6">
                <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Cuentas de Caja
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cuentas.filter(c => c.tipo !== 'credito').map((cuenta) => (
                    <Card key={cuenta.id} padding="md" className="border border-gray-200 relative group">
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
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            cuenta.moneda === 'PEN' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {cuenta.moneda}
                          </span>
                        )}
                      </div>
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
                  ))}
                </div>
              </div>

              {/* === CUENTAS DE CRÉDITO (Deudas) === */}
              {cuentas.some(c => c.tipo === 'credito') && (
                <div className="p-4 sm:p-6 border-t border-red-200 bg-red-50/30">
                  <h4 className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Líneas de Crédito / Deudas
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cuentas.filter(c => c.tipo === 'credito').map((cuenta) => (
                      <Card key={cuenta.id} padding="md" className="border border-red-200 bg-white relative group">
                        <button
                          onClick={() => handleEditarCuenta(cuenta)}
                          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Editar cuenta"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center">
                            <CreditCard className="h-6 w-6 text-red-500 mr-2" />
                            <div>
                              <h4 className="font-medium text-gray-900">{cuenta.nombre}</h4>
                              <p className="text-xs text-red-500">crédito</p>
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                            CRÉDITO
                          </span>
                        </div>
                        {/* Saldo: negativo = deuda */}
                        {cuenta.esBiMoneda ? (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500">PEN:</span>
                              <span className={`text-lg font-bold ${(cuenta.saldoPEN || 0) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                {(cuenta.saldoPEN || 0) < 0 ? 'Deuda: ' : ''}S/ {Math.abs(cuenta.saldoPEN || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500">USD:</span>
                              <span className={`text-lg font-bold ${(cuenta.saldoUSD || 0) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                {(cuenta.saldoUSD || 0) < 0 ? 'Deuda: ' : ''}$ {Math.abs(cuenta.saldoUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className={`text-2xl font-bold ${cuenta.saldoActual < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {cuenta.saldoActual < 0 ? 'Deuda: ' : ''}
                            {cuenta.moneda === 'PEN' ? 'S/ ' : '$ '}
                            {Math.abs(cuenta.saldoActual).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </div>
                        )}
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
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
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
                      <div className="text-sm text-gray-600">Flujo Neto (CxC - CxP)</div>
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

              {/* Flujo de Caja Proyectado Mejorado */}
              {dashboardPendientes.flujoCajaProyectado && (
                <Card padding="md" className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200">
                  <h3 className="font-semibold text-indigo-800 mb-4 flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Flujo de Caja Proyectado Completo
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Saldo Actual */}
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <div className="text-xs text-gray-500 uppercase">Saldo Actual en Cuentas</div>
                      <div className="text-lg font-bold text-gray-900 mt-1">
                        S/ {dashboardPendientes.flujoCajaProyectado.saldoActualPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                      {dashboardPendientes.flujoCajaProyectado.saldoActualUSD > 0 && (
                        <div className="text-xs text-gray-500">
                          + $ {dashboardPendientes.flujoCajaProyectado.saldoActualUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>

                    {/* Ingresos del Mes */}
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <div className="text-xs text-gray-500 uppercase">Cobrado este Mes</div>
                      <div className="text-lg font-bold text-green-600 mt-1">
                        + S/ {dashboardPendientes.flujoCajaProyectado.ingresosCobradosMesPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                      {dashboardPendientes.flujoCajaProyectado.ingresosCobradosMesUSD > 0 && (
                        <div className="text-xs text-green-500">
                          + $ {dashboardPendientes.flujoCajaProyectado.ingresosCobradosMesUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>

                    {/* Egresos del Mes */}
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <div className="text-xs text-gray-500 uppercase">Pagado este Mes</div>
                      <div className="text-lg font-bold text-red-600 mt-1">
                        - S/ {dashboardPendientes.flujoCajaProyectado.egresosPagadosMesPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                      {dashboardPendientes.flujoCajaProyectado.egresosPagadosMesUSD > 0 && (
                        <div className="text-xs text-red-500">
                          - $ {dashboardPendientes.flujoCajaProyectado.egresosPagadosMesUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>

                    {/* Flujo Neto Proyectado Total */}
                    <div className={`rounded-lg p-3 shadow-sm ${dashboardPendientes.flujoCajaProyectado.flujoNetoProyectadoPEN >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                      <div className="text-xs text-gray-600 uppercase">Proyección Total</div>
                      <div className={`text-lg font-bold mt-1 ${dashboardPendientes.flujoCajaProyectado.flujoNetoProyectadoPEN >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                        S/ {dashboardPendientes.flujoCajaProyectado.flujoNetoProyectadoPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                      <div className={`text-sm font-semibold mt-1 ${dashboardPendientes.flujoCajaProyectado.rentabilidadProyectada >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dashboardPendientes.flujoCajaProyectado.rentabilidadProyectada >= 0 ? '+' : ''}{dashboardPendientes.flujoCajaProyectado.rentabilidadProyectada.toFixed(1)}% s/inversión
                      </div>
                    </div>
                  </div>

                  {/* Proyección de Ingresos Futuros */}
                  {(dashboardPendientes.flujoCajaProyectado.proyeccionIngresos.cotizacionesPendientes > 0 ||
                    dashboardPendientes.flujoCajaProyectado.proyeccionIngresos.expectativasActivas > 0 ||
                    dashboardPendientes.flujoCajaProyectado.proyeccionIngresos.inventarioDisponibleValor > 0) && (
                    <div className="mt-4 pt-4 border-t border-indigo-200">
                      <div className="text-xs text-indigo-600 font-medium mb-2">Proyección de Ingresos Futuros (potencial)</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
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
                          <div className="text-xs text-green-600 mt-1">
                            (costo + flete) × TC × 1.3
                          </div>
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
                        <div
                          key={p.id}
                          className="px-6 py-3 hover:bg-green-50 cursor-pointer transition-colors group"
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

                  {/* Resumen por antigüedad */}
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="text-center">
                        <div className="text-gray-500">0-7 días</div>
                        <div className="font-bold text-gray-900">S/ {dashboardPendientes.cuentasPorPagar.pendiente0a7dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">8-15 días</div>
                        <div className="font-bold text-yellow-600">S/ {dashboardPendientes.cuentasPorPagar.pendiente8a15dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">16-30 días</div>
                        <div className="font-bold text-orange-600">S/ {dashboardPendientes.cuentasPorPagar.pendiente16a30dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">&gt;30 días</div>
                        <div className="font-bold text-red-600">S/ {dashboardPendientes.cuentasPorPagar.pendienteMas30dias.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</div>
                      </div>
                    </div>
                  </div>

                  {/* Resumen por tipo */}
                  <div className="px-6 py-2 border-b border-gray-200">
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
                      <div className="px-6 py-8 text-center text-gray-500">
                        <CheckCircle className="h-10 w-10 mx-auto text-green-300 mb-2" />
                        No hay cuentas pendientes de pago
                      </div>
                    ) : (
                      dashboardPendientes.cuentasPorPagar.pendientes.map((p) => (
                        <div
                          key={p.id}
                          className="px-6 py-3 hover:bg-red-50 cursor-pointer transition-colors group"
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
                                  {p.diasPendiente} días
                                </span>
                                {p.esVencido && (
                                  <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 font-semibold">
                                    Vencido
                                  </span>
                                )}
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

      {/* Modal Nuevo/Editar Movimiento */}
      <Modal
        isOpen={isMovimientoModalOpen}
        onClose={handleCerrarModalMovimiento}
        title={movimientoEditando ? `Editar Movimiento ${movimientoEditando.numeroMovimiento}` : 'Nuevo Movimiento'}
        size="lg"
      >
        <div className="space-y-5">
          {/* Sección 1: Tipo y Clasificación */}
          <div className={`rounded-lg p-4 border ${esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria) ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              {esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria)
                ? <ArrowUpCircle className="h-4 w-4 text-green-600" />
                : <ArrowDownCircle className="h-4 w-4 text-red-600" />
              }
              <h4 className={`text-sm font-semibold ${esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria) ? 'text-green-800' : 'text-red-800'}`}>
                {esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria) ? 'Ingreso' : 'Egreso'}
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Tipo de movimiento
                </label>
                <select
                  value={movimientoForm.tipo}
                  onChange={(e) =>
                    setMovimientoForm({ ...movimientoForm, tipo: e.target.value as TipoMovimientoTesoreria })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                >
                  <optgroup label="Ingresos">
                    <option value="ingreso_venta">Ingreso por Venta</option>
                    <option value="ingreso_anticipo">Anticipo / Adelanto</option>
                    <option value="ingreso_otro">Otro Ingreso</option>
                    <option value="aporte_capital">Aporte de Capital (Socio)</option>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  value={(() => {
                    if (!movimientoForm.fecha) return new Date().toISOString().split('T')[0];
                    if (movimientoForm.fecha instanceof Date && !isNaN(movimientoForm.fecha.getTime())) {
                      return movimientoForm.fecha.toISOString().split('T')[0];
                    }
                    return new Date().toISOString().split('T')[0];
                  })()}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const [year, month, day] = e.target.value.split('-').map(Number);
                    const nuevaFecha = new Date(year, month - 1, day, new Date().getHours(), new Date().getMinutes());
                    if (!isNaN(nuevaFecha.getTime())) {
                      setMovimientoForm({ ...movimientoForm, fecha: nuevaFecha });
                    }
                  }}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Sección 2: Monto y Moneda */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-gray-600" />
              <h4 className="text-sm font-semibold text-gray-700">Monto</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Moneda
                </label>
                <select
                  value={movimientoForm.moneda}
                  onChange={(e) =>
                    setMovimientoForm({ ...movimientoForm, moneda: e.target.value as MonedaTesoreria })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                >
                  <option value="PEN">PEN (Soles)</option>
                  <option value="USD">USD (Dólares)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Monto
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    {movimientoForm.moneda === 'USD' ? '$' : 'S/'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={movimientoForm.monto || ''}
                    onChange={(e) =>
                      setMovimientoForm({ ...movimientoForm, monto: parseFloat(e.target.value) })
                    }
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Tipo de Cambio
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={movimientoForm.tipoCambio || ''}
                  onChange={(e) =>
                    setMovimientoForm({ ...movimientoForm, tipoCambio: parseFloat(e.target.value) })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                  placeholder="3.700"
                />
              </div>
            </div>
            {/* Equivalente */}
            {movimientoForm.monto && movimientoForm.tipoCambio ? (
              <div className="mt-2 text-xs text-gray-500 text-right">
                Equivale a{' '}
                <span className="font-medium text-gray-700">
                  {movimientoForm.moneda === 'USD'
                    ? `S/ ${(movimientoForm.monto * movimientoForm.tipoCambio).toFixed(2)}`
                    : `$ ${(movimientoForm.monto / movimientoForm.tipoCambio).toFixed(2)}`
                  }
                </span>
              </div>
            ) : null}
          </div>

          {/* Sección 3: Cuenta y Método */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-blue-800">Cuenta y Método de Pago</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria) ? 'Cuenta destino (donde entra el dinero)' : 'Cuenta origen (de donde sale el dinero)'}
                </label>
                <select
                  value={(esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria) ? movimientoForm.cuentaDestino : movimientoForm.cuentaOrigen) || ''}
                  onChange={(e) => {
                    const value = e.target.value || undefined;
                    if (esIngreso(movimientoForm.tipo as TipoMovimientoTesoreria)) {
                      setMovimientoForm({ ...movimientoForm, cuentaDestino: value });
                    } else {
                      setMovimientoForm({ ...movimientoForm, cuentaOrigen: value });
                    }
                  }}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentas
                    .filter(c => c.activa && (c.esBiMoneda || c.moneda === movimientoForm.moneda))
                    .map(cuenta => {
                      const saldoActual = cuenta.esBiMoneda
                        ? (movimientoForm.moneda === 'USD' ? cuenta.saldoUSD : cuenta.saldoPEN)
                        : cuenta.saldoActual;
                      return (
                        <option key={cuenta.id} value={cuenta.id}>
                          {cuenta.nombre} — Saldo: {movimientoForm.moneda === 'USD' ? '$' : 'S/'}{saldoActual?.toFixed(2) || '0.00'}
                        </option>
                      );
                    })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Método de pago
                </label>
                <select
                  value={movimientoForm.metodo || 'efectivo'}
                  onChange={(e) =>
                    setMovimientoForm({ ...movimientoForm, metodo: e.target.value as any })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia_bancaria">Transferencia Bancaria</option>
                  <option value="yape">Yape</option>
                  <option value="plin">Plin</option>
                  <option value="mercado_pago">MercadoPago</option>
                  <option value="tarjeta">Tarjeta Débito</option>
                  <option value="tarjeta_credito">Tarjeta Crédito</option>
                  <option value="paypal">PayPal</option>
                  <option value="zelle">Zelle</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>

            {movimientoEditando && (
              <div className="mt-3 bg-white/60 rounded p-2 text-xs text-orange-600">
                * Al cambiar cuenta/monto/moneda se ajustarán automáticamente los saldos
              </div>
            )}
          </div>

          {/* Sección 4: Detalle */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <h4 className="text-sm font-semibold text-gray-700">Detalle</h4>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Concepto
              </label>
              <input
                type="text"
                value={movimientoForm.concepto || ''}
                onChange={(e) =>
                  setMovimientoForm({ ...movimientoForm, concepto: e.target.value })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                placeholder="Descripción del movimiento"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Referencia
                </label>
                <input
                  type="text"
                  value={movimientoForm.referencia || ''}
                  onChange={(e) =>
                    setMovimientoForm({ ...movimientoForm, referencia: e.target.value })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                  placeholder="N° de documento, factura, etc."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Notas (opcional)
                </label>
                <input
                  type="text"
                  value={movimientoForm.notas || ''}
                  onChange={(e) =>
                    setMovimientoForm({ ...movimientoForm, notas: e.target.value })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                  placeholder="Notas adicionales"
                />
              </div>
            </div>
          </div>

          {/* Info de documentos relacionados (solo en edición) */}
          {movimientoEditando && (movimientoEditando.ordenCompraNumero || movimientoEditando.ventaNumero || movimientoEditando.gastoNumero) && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-600">Documentos relacionados</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-gray-600 text-xs">
                {movimientoEditando.ordenCompraNumero && (
                  <div className="bg-white rounded px-2 py-1">
                    <span className="font-medium">OC:</span> {movimientoEditando.ordenCompraNumero}
                  </div>
                )}
                {movimientoEditando.ventaNumero && (
                  <div className="bg-white rounded px-2 py-1">
                    <span className="font-medium">Venta:</span> {movimientoEditando.ventaNumero}
                  </div>
                )}
                {movimientoEditando.gastoNumero && (
                  <div className="bg-white rounded px-2 py-1">
                    <span className="font-medium">Gasto:</span> {movimientoEditando.gastoNumero}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2 border-t border-gray-200">
            <Button variant="ghost" onClick={handleCerrarModalMovimiento}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleGuardarMovimiento}
              disabled={isSubmitting || !movimientoForm.monto}
            >
              {isSubmitting ? 'Guardando...' : movimientoEditando ? 'Guardar Cambios' : 'Guardar'}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Moneda Origen
              </label>
              <select
                value={conversionForm.monedaOrigen}
                onChange={(e) =>
                  setConversionForm({
                    ...conversionForm,
                    monedaOrigen: e.target.value as MonedaTesoreria,
                    cuentaOrigenId: undefined,
                    cuentaDestinoId: undefined
                  })
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

          {/* Sección de Cuentas */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Wallet className="h-4 w-4 mr-2 text-primary-600" />
              Vincular con Cuentas (Opcional)
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              Selecciona las cuentas para registrar automáticamente los movimientos de tesorería
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <ArrowUpCircle className="inline h-4 w-4 mr-1 text-red-500" />
                  Cuenta Origen ({conversionForm.monedaOrigen || 'USD'})
                </label>
                <select
                  value={conversionForm.cuentaOrigenId || ''}
                  onChange={(e) =>
                    setConversionForm({ ...conversionForm, cuentaOrigenId: e.target.value || undefined })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="">Sin cuenta (solo registro)</option>
                  {cuentas
                    .filter(c => c.activa && (
                      c.esBiMoneda ||
                      c.moneda === conversionForm.monedaOrigen
                    ))
                    .map(cuenta => {
                      const saldoActual = cuenta.esBiMoneda
                        ? (conversionForm.monedaOrigen === 'USD' ? cuenta.saldoUSD : cuenta.saldoPEN)
                        : cuenta.saldoActual;
                      return (
                        <option key={cuenta.id} value={cuenta.id}>
                          {cuenta.nombre} - Saldo: {conversionForm.monedaOrigen === 'USD' ? '$' : 'S/'}{saldoActual?.toFixed(2) || '0.00'}
                        </option>
                      );
                    })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <ArrowDownCircle className="inline h-4 w-4 mr-1 text-green-500" />
                  Cuenta Destino ({conversionForm.monedaOrigen === 'USD' ? 'PEN' : 'USD'})
                </label>
                <select
                  value={conversionForm.cuentaDestinoId || ''}
                  onChange={(e) =>
                    setConversionForm({ ...conversionForm, cuentaDestinoId: e.target.value || undefined })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="">Sin cuenta (solo registro)</option>
                  {cuentas
                    .filter(c => c.activa && (
                      c.esBiMoneda ||
                      c.moneda === (conversionForm.monedaOrigen === 'USD' ? 'PEN' : 'USD')
                    ))
                    .map(cuenta => {
                      const monedaDestino = conversionForm.monedaOrigen === 'USD' ? 'PEN' : 'USD';
                      const saldoActual = cuenta.esBiMoneda
                        ? (monedaDestino === 'USD' ? cuenta.saldoUSD : cuenta.saldoPEN)
                        : cuenta.saldoActual;
                      return (
                        <option key={cuenta.id} value={cuenta.id}>
                          {cuenta.nombre} - Saldo: {monedaDestino === 'USD' ? '$' : 'S/'}{saldoActual?.toFixed(2) || '0.00'}
                        </option>
                      );
                    })}
                </select>
              </div>
            </div>
          </div>

          {/* Preview de la conversión */}
          {conversionForm.montoOrigen && conversionForm.tipoCambio && (
            <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border border-blue-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Vista Previa de Conversión</h4>
              <div className="flex items-center justify-center space-x-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Sale</p>
                  <p className="text-lg font-bold text-red-600">
                    {conversionForm.monedaOrigen === 'USD' ? '$' : 'S/'}{conversionForm.montoOrigen.toFixed(2)}
                  </p>
                  {conversionForm.cuentaOrigenId && (
                    <p className="text-xs text-gray-500">
                      de {cuentas.find(c => c.id === conversionForm.cuentaOrigenId)?.nombre}
                    </p>
                  )}
                </div>
                <RefreshCw className="h-6 w-6 text-gray-400" />
                <div className="text-center">
                  <p className="text-xs text-gray-500">Entra</p>
                  <p className="text-lg font-bold text-green-600">
                    {conversionForm.monedaOrigen === 'USD'
                      ? `S/${(conversionForm.montoOrigen * conversionForm.tipoCambio).toFixed(2)}`
                      : `$${(conversionForm.montoOrigen / conversionForm.tipoCambio).toFixed(2)}`
                    }
                  </p>
                  {conversionForm.cuentaDestinoId && (
                    <p className="text-xs text-gray-500">
                      a {cuentas.find(c => c.id === conversionForm.cuentaDestinoId)?.nombre}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-center text-gray-500 mt-2">
                TC: {conversionForm.tipoCambio.toFixed(3)}
              </p>

              {/* Movimientos que se generarán */}
              {(conversionForm.cuentaOrigenId || conversionForm.cuentaDestinoId) && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs font-medium text-gray-700 mb-1">Movimientos a generar:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {conversionForm.cuentaOrigenId && (
                      <li className="flex items-center">
                        <ArrowUpCircle className="h-3 w-3 text-red-500 mr-1" />
                        Egreso: {conversionForm.monedaOrigen === 'USD' ? '$' : 'S/'}{conversionForm.montoOrigen.toFixed(2)} de {cuentas.find(c => c.id === conversionForm.cuentaOrigenId)?.nombre}
                      </li>
                    )}
                    {conversionForm.cuentaDestinoId && (
                      <li className="flex items-center">
                        <ArrowDownCircle className="h-3 w-3 text-green-500 mr-1" />
                        Ingreso: {conversionForm.monedaOrigen === 'USD'
                          ? `S/${(conversionForm.montoOrigen * conversionForm.tipoCambio).toFixed(2)}`
                          : `$${(conversionForm.montoOrigen / conversionForm.tipoCambio).toFixed(2)}`
                        } a {cuentas.find(c => c.id === conversionForm.cuentaDestinoId)?.nombre}
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

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

      {/* Modal Transferencia entre Cuentas */}
      <Modal
        isOpen={isTransferenciaModalOpen}
        onClose={() => {
          setIsTransferenciaModalOpen(false);
          setTransferenciaForm({
            moneda: 'PEN',
            fecha: new Date(),
            tipoCambio: 3.70
          });
        }}
        title="Transferencia entre Cuentas"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> Esta operación mueve fondos entre tus propias cuentas.
              No afecta el patrimonio ni se registra como ingreso/egreso.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Moneda
              </label>
              <select
                value={transferenciaForm.moneda}
                onChange={(e) =>
                  setTransferenciaForm({
                    ...transferenciaForm,
                    moneda: e.target.value as MonedaTesoreria,
                    cuentaOrigenId: undefined,
                    cuentaDestinoId: undefined
                  })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="PEN">PEN (Soles)</option>
                <option value="USD">USD (Dólares)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto a Transferir
              </label>
              <input
                type="number"
                step="0.01"
                value={transferenciaForm.monto || ''}
                onChange={(e) =>
                  setTransferenciaForm({ ...transferenciaForm, monto: parseFloat(e.target.value) })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <ArrowUpCircle className="inline h-4 w-4 mr-1 text-red-500" />
                Cuenta Origen (Sale)
              </label>
              <select
                value={transferenciaForm.cuentaOrigenId || ''}
                onChange={(e) =>
                  setTransferenciaForm({ ...transferenciaForm, cuentaOrigenId: e.target.value || undefined })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Seleccionar cuenta...</option>
                {cuentas
                  .filter(c => c.activa && (
                    c.esBiMoneda ||
                    c.moneda === transferenciaForm.moneda
                  ))
                  .filter(c => c.id !== transferenciaForm.cuentaDestinoId)
                  .map(cuenta => {
                    const saldoActual = cuenta.esBiMoneda
                      ? (transferenciaForm.moneda === 'USD' ? cuenta.saldoUSD : cuenta.saldoPEN)
                      : cuenta.saldoActual;
                    return (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombre} - Saldo: {transferenciaForm.moneda === 'USD' ? '$' : 'S/'}{saldoActual?.toFixed(2) || '0.00'}
                      </option>
                    );
                  })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <ArrowDownCircle className="inline h-4 w-4 mr-1 text-green-500" />
                Cuenta Destino (Entra)
              </label>
              <select
                value={transferenciaForm.cuentaDestinoId || ''}
                onChange={(e) =>
                  setTransferenciaForm({ ...transferenciaForm, cuentaDestinoId: e.target.value || undefined })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Seleccionar cuenta...</option>
                {cuentas
                  .filter(c => c.activa && (
                    c.esBiMoneda ||
                    c.moneda === transferenciaForm.moneda
                  ))
                  .filter(c => c.id !== transferenciaForm.cuentaOrigenId)
                  .map(cuenta => {
                    const saldoActual = cuenta.esBiMoneda
                      ? (transferenciaForm.moneda === 'USD' ? cuenta.saldoUSD : cuenta.saldoPEN)
                      : cuenta.saldoActual;
                    return (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombre} - Saldo: {transferenciaForm.moneda === 'USD' ? '$' : 'S/'}{saldoActual?.toFixed(2) || '0.00'}
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Concepto / Motivo (Opcional)
            </label>
            <input
              type="text"
              value={transferenciaForm.concepto || ''}
              onChange={(e) =>
                setTransferenciaForm({ ...transferenciaForm, concepto: e.target.value })
              }
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Ej: Reposición de caja chica, fondeo de cuenta..."
            />
          </div>

          {/* Preview */}
          {transferenciaForm.monto && transferenciaForm.cuentaOrigenId && transferenciaForm.cuentaDestinoId && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Vista Previa de Transferencia</h4>
              <div className="flex items-center justify-center space-x-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Sale de</p>
                  <p className="text-sm font-medium text-gray-900">
                    {cuentas.find(c => c.id === transferenciaForm.cuentaOrigenId)?.nombre}
                  </p>
                  <p className="text-lg font-bold text-red-600">
                    -{transferenciaForm.moneda === 'USD' ? '$' : 'S/'}{transferenciaForm.monto.toFixed(2)}
                  </p>
                </div>
                <ArrowLeftRight className="h-6 w-6 text-purple-400" />
                <div className="text-center">
                  <p className="text-xs text-gray-500">Entra a</p>
                  <p className="text-sm font-medium text-gray-900">
                    {cuentas.find(c => c.id === transferenciaForm.cuentaDestinoId)?.nombre}
                  </p>
                  <p className="text-lg font-bold text-green-600">
                    +{transferenciaForm.moneda === 'USD' ? '$' : 'S/'}{transferenciaForm.monto.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="ghost" onClick={() => setIsTransferenciaModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleCrearTransferencia}
              disabled={
                isSubmitting ||
                !transferenciaForm.monto ||
                !transferenciaForm.cuentaOrigenId ||
                !transferenciaForm.cuentaDestinoId
              }
            >
              {isSubmitting ? 'Procesando...' : 'Realizar Transferencia'}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                <option value="credito">Crédito (TC / Préstamo)</option>
              </select>
            </div>
          </div>

          {(cuentaForm.tipo === 'banco' || cuentaForm.tipo === 'credito') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

          {(cuentaForm.tipo === 'banco' || cuentaForm.tipo === 'credito') && (
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};
