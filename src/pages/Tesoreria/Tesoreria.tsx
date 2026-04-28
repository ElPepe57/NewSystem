import React, { useEffect, useState, useMemo } from 'react';
import { useTipoCambio } from '../../hooks/useTipoCambio';

import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  DollarSign,
  TrendingUp,
  Building2,
  Banknote,
  ArrowLeftRight,
  Layers,
  CreditCard
} from 'lucide-react';
import { Button, Card, useConfirmDialog, ConfirmDialog } from '../../components/common';
import { Toolbar, KPIBar, StatCard } from '../../design-system';
import { useSearchParams } from 'react-router-dom';
import { cuentaCorrienteService } from '../../services/cuentaCorriente.service';
import { LineaDropdown } from '../../components/common/LineaDropdown';
import { TesoreriaService } from '../../services/tesoreria.service';

import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { useTesoreriaStore } from '../../store/tesoreriaStore';
import { useLineaFilter } from '../../hooks/useLineaFilter';
// S58 Fase 3 — submit optimista con toast undo
import { useOptimisticSubmit } from '../../hooks/useOptimisticSubmit';
import type {
  MovimientoTesoreria,
  CuentaCaja,
  MovimientoTesoreriaFormData,
  ConversionCambiariaFormData,
  CuentaCajaFormData,
  TipoMovimientoTesoreria,
  MonedaTesoreria,
  TransferenciaEntreCuentasFormData
} from '../../types/tesoreria.types';

import { TabMovimientos } from './TabMovimientos';
import { TabConversiones } from './TabConversiones';
import { TabTransferencias } from './TabTransferencias';
import { TabCuentas } from './TabCuentas';
import { TabPagosMasivos } from './TabPagosMasivos';
import { TabTarjetasCredito } from './TabTarjetasCredito';
import { PoolUSDWidget } from '../../components/modules/tesoreria/PoolUSDWidget';

type TabActiva = 'movimientos' | 'conversiones' | 'transferencias' | 'cuentas' | 'pagosMasivos' | 'tarjetas';

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

  // Filtrar movimientos por línea de negocio (sin lineaNegocioId = compartidos, siempre visibles)
  const movimientosPorLinea = useLineaFilter(movimientos, m => m.lineaNegocioId, { allowUndefined: true });

  // ── Filtro adicional por entidad CC (S57 Fase C+) ──
  // Si la URL trae ?entidadId=XYZ&entidadTipo=proveedor, filtramos los
  // movimientos de tesorería para mostrar solo los que tienen contraparte
  // en la CC de esa entidad (mediante movimientoTesoreriaId del libro CC).
  const [searchParams, setSearchParams] = useSearchParams();
  const entidadIdParam = searchParams.get('entidadId');
  const entidadTipoParam = searchParams.get('entidadTipo') as
    | 'cliente' | 'proveedor' | 'colaborador' | 'empleado' | null;
  const entidadNombreParam = searchParams.get('entidadNombre');

  const [tesoreriaIdsDeEntidad, setTesoreriaIdsDeEntidad] = useState<Set<string> | null>(null);
  const [filtroEntidadCargando, setFiltroEntidadCargando] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!entidadIdParam || !entidadTipoParam) {
      setTesoreriaIdsDeEntidad(null);
      return;
    }
    setFiltroEntidadCargando(true);
    const ccId = `${entidadTipoParam}_${entidadIdParam}`;
    cuentaCorrienteService
      .getMovimientos(ccId, { limit: 500 })
      .then((movsCC) => {
        if (cancelled) return;
        const ids = new Set<string>();
        for (const m of movsCC) {
          if (m.movimientoTesoreriaId) ids.add(m.movimientoTesoreriaId);
        }
        setTesoreriaIdsDeEntidad(ids);
      })
      .finally(() => {
        if (!cancelled) setFiltroEntidadCargando(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entidadIdParam, entidadTipoParam]);

  const movimientosFiltrados = useMemo(() => {
    if (!tesoreriaIdsDeEntidad) return movimientosPorLinea;
    return movimientosPorLinea.filter((m) => tesoreriaIdsDeEntidad.has(m.id));
  }, [movimientosPorLinea, tesoreriaIdsDeEntidad]);

  const limpiarFiltroEntidad = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('entidadId');
    next.delete('entidadTipo');
    next.delete('entidadNombre');
    setSearchParams(next, { replace: true });
  };

  const [tabActiva, setTabActiva] = useState<TabActiva>('movimientos');
  const [loadingLocal, setLoadingLocal] = useState(true);
  const loading = loadingStore || loadingLocal;

  const [transferencias, setTransferencias] = useState<TransferenciaEntreCuentas[]>([]);
  // Modales
  const [isMovimientoModalOpen, setIsMovimientoModalOpen] = useState(false);
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [isTransferenciaModalOpen, setIsTransferenciaModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado edicion
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
      'aporte_capital': 'Aporte Capital',
      'pago_nomina': 'Pago Nómina',
      'adelanto_empleado': 'Adelanto Empleado'
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
      const dataNormalizada = {
        ...movimientoForm,
        fecha: movimientoForm.fecha || new Date(),
        tipoCambio: movimientoForm.tipoCambio || tcDefault,
        metodo: movimientoForm.metodo || 'efectivo',
      } as MovimientoTesoreriaFormData;

      if (movimientoEditando) {
        // Edit: sin undo (revert sería complejo), solo toast normal
        await TesoreriaService.actualizarMovimiento(
          movimientoEditando.id,
          dataNormalizada,
          user.uid,
        );
        handleCerrarModalMovimiento();
        toast.success('Movimiento actualizado');
        loadData();
      } else {
        // S58 Fase 3 — Optimistic submit + toast con undo
        const movId = await TesoreriaService.registrarMovimiento(dataNormalizada, user.uid);
        handleCerrarModalMovimiento();
        loadData();

        // Recuperar el numeroMovimiento para mensaje legible (best-effort)
        let numero = movId.slice(-6).toUpperCase();
        try {
          const created = await TesoreriaService.getMovimientoById(movId);
          if (created?.numeroMovimiento) numero = created.numeroMovimiento;
        } catch {
          /* fallback al id corto */
        }

        toast.successWithUndo(
          `Movimiento ${numero} creado`,
          async () => {
            try {
              await TesoreriaService.eliminarMovimiento(movId, user.uid);
              toast.info('Movimiento anulado');
              loadData();
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'No se pudo deshacer';
              toast.error(msg);
            }
          },
        );
      }
    } catch (error: any) {
      toast.error(error.message, 'Error al guardar movimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCerrarModalMovimiento = () => {
    setIsMovimientoModalOpen(false);
    setMovimientoEditando(null);
    // S58 Fase 3 — Smart defaults: fecha=hoy, TC=día, cuenta destino por defecto
    const cuentaPorDefectoPEN = cuentas.find(
      (c) => c.activa && c.esCuentaPorDefecto && (c.esBiMoneda || c.moneda === 'PEN'),
    );
    setMovimientoForm({
      tipo: 'ingreso_venta',
      moneda: 'PEN',
      fecha: new Date(),
      tipoCambio: tcDefault,
      metodo: 'efectivo',
      cuentaDestino: cuentaPorDefectoPEN?.id,
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

  // Crear cuenta nueva (desde cualquier formulario: banco, digital, efectivo)
  const handleGuardarCuentaNueva = async (data: CuentaCajaFormData) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await TesoreriaService.crearCuenta(data, user.uid);
      toast.success('Cuenta creada');
      loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error al crear cuenta');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guardar cambios de edición
  const handleGuardarEdicion = async (cuenta: CuentaCaja, data: CuentaCajaFormData) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await TesoreriaService.actualizarCuenta(
        cuenta.id,
        {
          nombre: data.nombre,
          titular: data.titular,
          tipo: data.tipo,
          moneda: data.moneda,
          esBiMoneda: data.esBiMoneda,
          saldoMinimo: data.saldoMinimo,
          saldoMinimoUSD: data.saldoMinimoUSD,
          saldoMinimoPEN: data.saldoMinimoPEN,
          banco: data.banco,
          bancoNombreCompleto: data.bancoNombreCompleto,
          numeroCuenta: data.numeroCuenta,
          cci: data.cci,
          productoFinanciero: data.productoFinanciero,
          titularidad: data.titularidad,
          cuentaVinculadaId: data.cuentaVinculadaId,
          metodosDisponibles: data.metodosDisponibles,
          metodosDetalle: data.metodosDetalle,
          numerosCuenta: data.numerosCuenta,
          lineaCreditoLimite: data.lineaCreditoLimite,
          lineaCreditoTasa: data.lineaCreditoTasa,
          lineaCreditoFechaCorte: data.lineaCreditoFechaCorte,
          lineaCreditoFechaPago: data.lineaCreditoFechaPago,
        },
        user.uid
      );
      toast.success('Cuenta actualizada');
      loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error al guardar cuenta');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sincronizar métodos de pago para todas las cuentas de un banco
  const handleGuardarMetodosBanco = async (bancoNombre: string, metodos: string[]) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const count = await TesoreriaService.syncMetodosBanco(bancoNombre, metodos, user.uid);
      toast.success(`Métodos actualizados en ${count} cuenta${count !== 1 ? 's' : ''} de ${bancoNombre}`);
      loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error al sincronizar métodos');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar cuenta permanentemente (con validaciones)
  const handleEliminarCuenta = async (cuenta: CuentaCaja) => {
    // 1. Verificar saldo
    const { tieneSaldo, detalle } = TesoreriaService.cuentaTieneSaldo(cuenta);
    if (tieneSaldo) {
      toast.error(`No se puede eliminar: tiene saldo pendiente (${detalle}). Transfiera los fondos primero.`, 'Cuenta con saldo');
      return;
    }

    // 2. Verificar movimientos
    const numMovimientos = await TesoreriaService.cuentaTieneMovimientos(cuenta.id);
    const mensaje = numMovimientos > 0
      ? `¿Eliminar "${cuenta.nombre}" permanentemente? Esta cuenta tiene ${numMovimientos} movimiento${numMovimientos > 1 ? 's' : ''} asociado${numMovimientos > 1 ? 's' : ''}. Los movimientos se conservarán pero la referencia a esta cuenta se perderá.`
      : `¿Eliminar "${cuenta.nombre}" permanentemente? Esta acción no se puede deshacer.`;

    const confirmed = await confirm({
      title: 'Eliminar Cuenta',
      message: mensaje,
      confirmText: 'Eliminar permanentemente',
      variant: 'danger'
    });
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await TesoreriaService.eliminarCuenta(cuenta.id);
      if (cuentaDetalle?.id === cuenta.id) setCuentaDetalle(null);
      toast.success(`Cuenta "${cuenta.nombre}" eliminada`);
      loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error al eliminar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReconciliarPagos = async () => {
    const confirmed = await confirm({
      title: 'Reconciliar Pagos',
      message: 'Esto buscará pagos en ventas, OC y gastos cuyo movimiento de tesorería fue anulado, y los limpiará automáticamente. Los montos pendientes se recalcularán.',
      confirmText: 'Reconciliar',
      variant: 'warning'
    });
    if (!confirmed) return;
    setIsSubmitting(true);
    try {
      const r = await TesoreriaService.reconciliarPagosHuerfanos();
      const total = r.ventasCorregidas + r.ocCorregidas + r.gastosCorregidos;
      if (total === 0) {
        toast.success('No se encontraron pagos huérfanos. Todo está sincronizado.');
      } else {
        toast.success(
          `Corregidos: ${r.ventasCorregidas} ventas, ${r.ocCorregidas} OC, ${r.gastosCorregidos} gastos`,
          'Reconciliación completada'
        );
      }
      if (r.errores.length > 0) {
        toast.warning(r.errores.join('; '), 'Errores en reconciliación');
      }
      await loadData();
    } catch (error: any) {
      toast.error(error.message, 'Error en reconciliación');
    } finally {
      setIsSubmitting(false);
    }
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
    <>
      {/* Actions inline (sub-header Stripe-style). Optimizar = outline,
           Refresh = ghost (icon-only). Consistente con las otras 2
           sub-vistas del hub Finanzas. */}
      <div className="flex items-center justify-end gap-2 mb-3 px-1">
        {!statsOptimizadas && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalcularEstadisticas}
            disabled={isRecalculando || loading}
            title="Inicializar estadisticas optimizadas (solo una vez)"
          >
            {isRecalculando ? (
              <><RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /><span className="hidden sm:inline">Calculando...</span></>
            ) : (
              <><TrendingUp className="h-4 w-4 mr-1.5" /><span className="hidden sm:inline">Optimizar</span></>
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || loading}
          title="Actualizar datos"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Banner: filtro por entidad activo (cross-link desde Saldos / drawer CC) */}
      {entidadIdParam && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5 mb-3 flex items-center justify-between gap-3">
          <div className="text-[12px] text-teal-900 min-w-0">
            <span className="font-semibold">Filtrando por entidad:</span>{' '}
            <span className="truncate">
              {entidadNombreParam || entidadIdParam.slice(0, 8)}
            </span>
            {entidadTipoParam && (
              <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">
                {entidadTipoParam}
              </span>
            )}
            {filtroEntidadCargando && (
              <span className="ml-2 text-[10px] text-teal-600 italic">cargando vínculos...</span>
            )}
            {!filtroEntidadCargando && tesoreriaIdsDeEntidad && (
              <span className="ml-2 text-[11px] text-teal-700">
                · {tesoreriaIdsDeEntidad.size} movimiento{tesoreriaIdsDeEntidad.size !== 1 ? 's' : ''} vinculado{tesoreriaIdsDeEntidad.size !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={limpiarFiltroEntidad}
            className="text-[11px] px-2.5 py-1 bg-white border border-teal-300 text-teal-700 rounded-md hover:bg-teal-50 font-medium whitespace-nowrap"
          >
            Quitar filtro
          </button>
        </div>
      )}

      {/* Pool USD Widget */}
      <PoolUSDWidget />

      {/* Toolbar */}
      <Toolbar />

      {/* S57 Fase A+ — KPIs alineados con la paleta del Hub Finanzas:
           teal (marca) para saldos, amber (semántico) para pendientes,
           slate (neutral) para conversiones. */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {/* Saldo PEN total (teal · marca) */}
          <div className="bg-gradient-to-br from-teal-50 to-white border border-teal-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-teal-700 font-semibold">Saldo PEN</span>
              <Banknote className="w-3.5 h-3.5 text-teal-500" />
            </div>
            <div className="text-2xl font-bold text-teal-700 tabular-nums">
              {`S/ ${stats.saldoTotalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
            </div>
            <div className="text-[10px] text-teal-700/70 mt-2">Total en cuentas locales</div>
          </div>

          {/* Saldo USD total (teal · marca) */}
          <div className="bg-gradient-to-br from-teal-50 to-white border border-teal-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-teal-700 font-semibold">Saldo USD</span>
              <DollarSign className="w-3.5 h-3.5 text-teal-500" />
            </div>
            <div className="text-2xl font-bold text-teal-700 tabular-nums">
              {`US$ ${stats.saldoTotalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </div>
            <div className="text-[10px] text-teal-700/70 mt-2">Total en moneda extranjera</div>
          </div>

          {/* Pendientes (amber · semántico de atención) */}
          <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Pendientes</span>
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-700 tabular-nums">
              {`S/ ${(stats.pagosPendientesPEN || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
            </div>
            {(stats.pagosPendientesUSD || 0) > 0 && (
              <div className="text-xs text-amber-600 tabular-nums mt-0.5">
                + US$ {(stats.pagosPendientesUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            )}
            <div className="text-[10px] text-amber-700/70 mt-2">Por cobrar/pagar</div>
          </div>

          {/* Conversiones del mes (slate · neutral, contador) */}
          <div className="bg-gradient-to-br from-slate-100 to-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-700 font-semibold">Conversiones</span>
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">
              {stats.conversionesMes || 0}
            </div>
            <div className="text-[10px] text-slate-600 mt-2">
              Este mes · TC prom: {(stats.tcPromedioMes || tcDefault).toFixed(3)}
            </div>
          </div>
        </div>
      )}

      {/* S57 Fase A+ — Tabs sub-módulo monocromáticas: teal para activo,
           slate neutro para inactivos. Antes era 'fiesta de colores'
           (purple/sky/emerald/amber/slate) que confundía visualmente. */}
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Sub-módulo</div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {([
            { key: 'movimientos', icon: Wallet, label: 'Movimientos' },
            { key: 'conversiones', icon: RefreshCw, label: 'Conversiones' },
            { key: 'transferencias', icon: ArrowLeftRight, label: 'Transferencias' },
            { key: 'cuentas', icon: Building2, label: 'Cuentas bancarias' },
            { key: 'tarjetas', icon: CreditCard, label: 'Tarjetas' },
            { key: 'pagosMasivos', icon: Layers, label: 'Pagos masivos' },
          ] as { key: TabActiva; icon: any; label: string }[]).map(({ key, icon: Icon, label }) => {
            const activo = 'bg-teal-600 text-white';
            const inactivo = 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200';
            const isActive = tabActiva === key;
            return (
              <button
                key={key}
                onClick={() => setTabActiva(key)}
                className={`px-3 py-1.5 rounded-md text-[12px] flex items-center gap-1.5 whitespace-nowrap transition-colors font-medium ${isActive ? activo : inactivo}`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            );
          })}
        </div>
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
          isSubmitting={isSubmitting}
          handleRecalcularSaldos={handleRecalcularSaldos}
          handleReconciliarPagos={handleReconciliarPagos}
          handleGuardarCuentaNueva={handleGuardarCuentaNueva}
          handleGuardarEdicion={handleGuardarEdicion}
          handleGuardarMetodosBanco={handleGuardarMetodosBanco}
          handleEliminarCuenta={handleEliminarCuenta}
          getTipoLabel={getTipoLabel}
          esIngresoMovimiento={esIngresoMovimiento}
        />
      )}

      {tabActiva === 'pagosMasivos' && (
        <TabPagosMasivos />
      )}

      {tabActiva === 'tarjetas' && (
        <TabTarjetasCredito />
      )}

      <ConfirmDialog {...dialogProps} />
    </>
  );
};
