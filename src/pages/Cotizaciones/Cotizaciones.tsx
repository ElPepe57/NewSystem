import React, { useEffect, useState, useMemo } from 'react';
import { formatCurrencyPEN, formatCurrency as formatCurrencyUtil } from '../../utils/format';
import { Plus, RefreshCw } from 'lucide-react';
import { Button, ConfirmDialog, useConfirmDialog } from '../../components/common';
import { CotizacionForm } from './CotizacionForm';
import { CotizacionesMetricas } from './CotizacionesMetricas';
import { CotizacionesAlertas } from './CotizacionesAlertas';
import { CotizacionesFiltros } from './CotizacionesFiltros';
import { KanbanView } from './KanbanView';
import { ListaView } from './ListaView';
import { CotizacionDetailModal } from './CotizacionDetailModal';
import { AdelantoModal } from './AdelantoModal';
import { RechazoModal } from './RechazoModal';
import { useCotizacionStore } from '../../store/cotizacionStore';
import { useConfiguracionStore } from '../../store/configuracionStore';
import { useAuthStore } from '../../store/authStore';
import { useCanalVentaStore } from '../../store/canalVentaStore';
import { CotizacionPdfService } from '../../services/cotizacionPdf.service';
import { tesoreriaService } from '../../services/tesoreria.service';
import { tipoCambioService } from '../../services/tipoCambio.service';
import type { Cotizacion, MotivoRechazo } from '../../types/cotizacion.types';
import type { MetodoPago } from '../../types/venta.types';
import { useLineaFilter } from '../../hooks/useLineaFilter';
import { useToastStore } from '../../store/toastStore';
import type { CuentaCaja, MonedaTesoreria } from '../../types/tesoreria.types';

type VistaType = 'kanban' | 'lista';

export const Cotizaciones: React.FC = () => {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const { empresa, fetchEmpresa } = useConfiguracionStore();
  const { canales: canalesVenta, fetchCanales: fetchCanalesVenta } = useCanalVentaStore();
  const {
    cotizaciones: todasCotizaciones,
    loading,
    stats,
    fetchCotizaciones,
    fetchStats,
    validarCotizacion,
    revertirValidacion,
    comprometerAdelanto,
    registrarPagoAdelanto,
    confirmarCotizacion,
    rechazarCotizacion,
    deleteCotizacion,
    actualizarDiasCompromisoEntrega,
    actualizarDiasValidez,
    actualizarTiempoEstimadoImportacion
  } = useCotizacionStore();

  const [showModal, setShowModal] = useState(false);
  const [cotizacionEditar, setCotizacionEditar] = useState<Cotizacion | null>(null);
  const [selectedCotizacion, setSelectedCotizacion] = useState<Cotizacion | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAdelantoModal, setShowAdelantoModal] = useState(false);
  const [showRechazoModal, setShowRechazoModal] = useState(false);
  const [cotizacionParaAdelanto, setCotizacionParaAdelanto] = useState<Cotizacion | null>(null);
  const [cotizacionParaRechazar, setCotizacionParaRechazar] = useState<Cotizacion | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState<MotivoRechazo>('precio_alto');
  const [descripcionRechazo, setDescripcionRechazo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState<VistaType>('kanban');
  const [filtroCanal, setFiltroCanal] = useState('');
  const [generandoPdf, setGenerandoPdf] = useState(false);

  // Estado para el modal de adelanto
  const [montoAdelanto, setMontoAdelanto] = useState(0);
  const [metodoPagoAdelanto, setMetodoPagoAdelanto] = useState<MetodoPago>('yape');
  const [referenciaAdelanto, setReferenciaAdelanto] = useState('');
  const [cuentaDestinoId, setCuentaDestinoId] = useState('');
  const [cuentasDisponibles, setCuentasDisponibles] = useState<CuentaCaja[]>([]);
  const [procesandoAdelanto, setProcesandoAdelanto] = useState(false);
  const [tipoModalAdelanto, setTipoModalAdelanto] = useState<'comprometer' | 'pago'>('comprometer');
  const [monedaAdelanto, setMonedaAdelanto] = useState<MonedaTesoreria>('PEN');
  const [tipoCambioAdelanto, setTipoCambioAdelanto] = useState<number>(3.7);

  const { dialogProps, confirm } = useConfirmDialog();

  useEffect(() => {
    fetchCotizaciones();
    fetchStats();
    fetchEmpresa();
    fetchCanalesVenta();
  }, [fetchCotizaciones, fetchStats, fetchEmpresa, fetchCanalesVenta]);

  const resolverNombreCanal = (canalId: string): string => {
    if (!canalId) return '-';
    if (canalId === 'mercado_libre') return 'Mercado Libre';
    if (canalId === 'directo') return 'Directo';
    const canal = canalesVenta.find(c => c.id === canalId);
    return canal?.nombre || canalId;
  };

  // Filtrar por línea de negocio global
  const cotizacionesPorLinea = useLineaFilter(todasCotizaciones, c => c.lineaNegocioId);

  const cotizacionesFiltradas = useMemo(() => {
    let filtradas = [...cotizacionesPorLinea];
    if (busqueda) {
      const termino = busqueda.toLowerCase();
      filtradas = filtradas.filter(c => {
        const numeroCotizacion = (c.numeroCotizacion ?? '').toLowerCase();
        const nombreCliente = (c.nombreCliente ?? '').toLowerCase();
        const telefonoCliente = c.telefonoCliente ?? '';
        return numeroCotizacion.includes(termino) ||
               nombreCliente.includes(termino) ||
               telefonoCliente.includes(busqueda);
      });
    }
    if (filtroCanal) {
      filtradas = filtradas.filter(c => c.canal === filtroCanal);
    }
    return filtradas;
  }, [cotizacionesPorLinea, busqueda, filtroCanal]);

  const {
    nuevas,
    pendienteAdelanto,
    listasParaConfirmar,
    conFaltanteStock,
    confirmadas,
    rechazadas
  } = useMemo(() => {
    const nuevas = cotizacionesFiltradas.filter(c => c.estado === 'nueva');
    const pendienteAdelanto = cotizacionesFiltradas.filter(c => c.estado === 'pendiente_adelanto');
    const listasParaConfirmar = cotizacionesFiltradas.filter(c =>
      c.estado === 'validada' || c.estado === 'adelanto_pagado' || c.estado === 'con_abono'
    );
    const confirmadas = cotizacionesFiltradas.filter(c => c.estado === 'confirmada');
    const rechazadas = cotizacionesFiltradas.filter(c =>
      c.estado === 'rechazada' || c.estado === 'vencida'
    );
    const conFaltanteStock = cotizacionesFiltradas.filter(c =>
      (c.estado === 'nueva' || c.estado === 'validada' || c.estado === 'pendiente_adelanto') &&
      c.productos.some(p => p.requiereStock)
    );
    return { nuevas, pendienteAdelanto, listasParaConfirmar, conFaltanteStock, confirmadas, rechazadas };
  }, [cotizacionesFiltradas]);

  const { sinAdelanto, conAdelantoPagado, reservasVirtuales, porVencer } = useMemo(() => {
    const sinAdelanto = listasParaConfirmar.filter(c => c.estado === 'validada');
    const conAdelantoPagado = listasParaConfirmar.filter(c =>
      c.estado === 'adelanto_pagado' || c.estado === 'con_abono'
    );
    const reservasVirtuales = conAdelantoPagado.filter(c =>
      c.reservaStock?.tipoReserva === 'virtual'
    );
    const porVencer = listasParaConfirmar.filter(c => {
      if (!c.fechaVencimiento) return false;
      const vencimiento = c.fechaVencimiento.toDate?.() || new Date();
      const ahora = new Date();
      const diff = vencimiento.getTime() - ahora.getTime();
      return diff > 0 && diff < 48 * 60 * 60 * 1000;
    });
    return { sinAdelanto, conAdelantoPagado, reservasVirtuales, porVencer };
  }, [listasParaConfirmar]);

  const reservasPorVencer = porVencer;

  const metricas = useMemo(() => {
    const valorTotal = cotizacionesFiltradas
      .filter(c => c.estado !== 'rechazada' && c.estado !== 'vencida' && c.estado !== 'confirmada')
      .reduce((sum, c) => sum + c.totalPEN, 0);
    const valorReservado = conAdelantoPagado.reduce((sum, c) => sum + c.totalPEN, 0);
    const valorEsperandoPago = pendienteAdelanto.reduce((sum, c) => sum + c.totalPEN, 0);
    const valorConfirmado = confirmadas.reduce((sum, c) => sum + c.totalPEN, 0);
    return {
      pendientes: nuevas.length + pendienteAdelanto.length,
      nuevas: nuevas.length,
      pendienteAdelanto: pendienteAdelanto.length,
      listasParaConfirmar: listasParaConfirmar.length,
      sinAdelanto: sinAdelanto.length,
      conAdelanto: conAdelantoPagado.length,
      confirmadas: confirmadas.length,
      rechazadas: rechazadas.length,
      valorTotal,
      valorReservado,
      valorEsperandoPago,
      valorConfirmado,
      proximasAVencer: porVencer.length,
      virtuales: reservasVirtuales.length,
      tasaConversion: stats?.tasaConversion || 0
    };
  }, [cotizacionesFiltradas, nuevas, pendienteAdelanto, listasParaConfirmar, sinAdelanto, conAdelantoPagado, confirmadas, rechazadas, porVencer, reservasVirtuales, stats]);

  const formatCurrency = (amount: number): string => formatCurrencyPEN(amount);

  const handleVerDetalles = (cotizacion: Cotizacion) => {
    setSelectedCotizacion(cotizacion);
    setShowDetailsModal(true);
  };

  const handleConfirmar = async (cotizacion: Cotizacion) => {
    if (!user) return;
    const requiereStock = cotizacion.productos.some(p => p.requiereStock);
    const confirmed = await confirm({
      title: 'Confirmar Cotizacion',
      message: requiereStock
        ? `Esta cotizacion tiene productos SIN STOCK. ¿Confirmar ${cotizacion.numeroCotizacion} como venta?`
        : `¿Confirmar la cotizacion ${cotizacion.numeroCotizacion} como venta?`,
      confirmText: 'Confirmar',
      variant: requiereStock ? 'warning' : 'success'
    });
    if (!confirmed) return;
    try {
      const resultado = await confirmarCotizacion(cotizacion.id, user.uid);
      toast.success(`Cotización confirmada. Venta creada: ${resultado.numeroVenta}`);
      setShowDetailsModal(false);
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleRechazar = (cotizacion: Cotizacion) => {
    setCotizacionParaRechazar(cotizacion);
    setMotivoRechazo('precio_alto');
    setDescripcionRechazo('');
    setShowRechazoModal(true);
  };

  const handleConfirmarRechazo = async () => {
    if (!user || !cotizacionParaRechazar) return;
    try {
      await rechazarCotizacion(
        cotizacionParaRechazar.id,
        { motivo: motivoRechazo, descripcion: descripcionRechazo || undefined },
        user.uid
      );
      toast.success('Cotización rechazada. Se guardó para análisis de demanda.');
      setShowRechazoModal(false);
      setCotizacionParaRechazar(null);
      setShowDetailsModal(false);
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleEliminar = async (cotizacion: Cotizacion) => {
    const confirmed = await confirm({
      title: 'Eliminar Cotizacion',
      message: `¿Eliminar ${cotizacion.numeroCotizacion}? Esta accion no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await deleteCotizacion(cotizacion.id);
      setShowDetailsModal(false);
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleEditar = (cotizacion: Cotizacion) => {
    const estadosEditables = ['nueva', 'validada', 'pendiente_adelanto'];
    if (!estadosEditables.includes(cotizacion.estado)) {
      toast.warning('Solo se pueden editar cotizaciones en estados: Nueva, Validada o Esperando Pago');
      return;
    }
    setCotizacionEditar(cotizacion);
    setShowDetailsModal(false);
    setShowModal(true);
  };

  const handleDuplicar = (cotizacion: Cotizacion) => {
    const cotizacionDuplicada = {
      ...cotizacion,
      id: '',
      numeroCotizacion: '',
      estado: 'nueva' as const,
      fechaValidacion: undefined,
      fechaCompromisoAdelanto: undefined,
      fechaAdelanto: undefined,
      fechaConfirmacion: undefined,
      fechaRechazo: undefined,
      adelantoComprometido: undefined,
      adelanto: undefined,
      reservaStock: undefined,
      rechazo: undefined,
      ventaId: undefined,
      numeroVenta: undefined,
      observaciones: cotizacion.observaciones
        ? `[Duplicada de ${cotizacion.numeroCotizacion}] ${cotizacion.observaciones}`
        : `Duplicada de ${cotizacion.numeroCotizacion}`
    } as Cotizacion;
    setCotizacionEditar(cotizacionDuplicada);
    setShowDetailsModal(false);
    setShowModal(true);
  };

  const handleValidar = async (cotizacion: Cotizacion) => {
    if (!user) return;
    const confirmed = await confirm({
      title: 'Validar Cotizacion',
      message: `¿Confirmar que el cliente "${cotizacion.nombreCliente}" valido su interes en la cotizacion ${cotizacion.numeroCotizacion}?`,
      confirmText: 'Validar',
      variant: 'info'
    });
    if (!confirmed) return;
    try {
      await validarCotizacion(cotizacion.id, user.uid);
      toast.success('Cotización validada. Ahora puedes registrar el adelanto.');
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleRevertirValidacion = async (cotizacion: Cotizacion) => {
    if (!user) return;
    const confirmed = await confirm({
      title: 'Revertir Validacion',
      message: `¿Revertir la validacion de ${cotizacion.numeroCotizacion}? Esto devolvera la cotizacion al estado "Nueva".`,
      confirmText: 'Revertir',
      variant: 'warning'
    });
    if (!confirmed) return;
    try {
      await revertirValidacion(cotizacion.id, user.uid);
      toast.success('Validación revertida.');
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleComprometerAdelanto = (cotizacion: Cotizacion) => {
    setCotizacionParaAdelanto(cotizacion);
    setMontoAdelanto(Math.round(cotizacion.totalPEN * 0.5 * 100) / 100);
    setTipoModalAdelanto('comprometer');
    setShowAdelantoModal(true);
  };

  const cargarCuentasPorMoneda = async (moneda: MonedaTesoreria) => {
    try {
      const cuentas = await tesoreriaService.getCuentasActivas(moneda);
      setCuentasDisponibles(cuentas);
      if (cuentas.length > 0) {
        setCuentaDestinoId(cuentas[0].id);
      } else {
        setCuentaDestinoId('');
      }
      if (moneda === 'USD') {
        try {
          const tcDelDia = await tipoCambioService.getTCDelDia();
          if (tcDelDia) {
            setTipoCambioAdelanto(tcDelDia.venta);
          }
        } catch (tcError) {
          console.warn('No se pudo cargar el tipo de cambio:', tcError);
        }
      }
    } catch (error) {
      console.warn('No se pudieron cargar las cuentas:', error);
      setCuentasDisponibles([]);
      setCuentaDestinoId('');
    }
  };

  const handleRegistrarPagoAdelanto = async (cotizacion: Cotizacion) => {
    setCotizacionParaAdelanto(cotizacion);
    const montoComprometido = cotizacion.adelantoComprometido?.monto || Math.round(cotizacion.totalPEN * 0.5 * 100) / 100;
    setMontoAdelanto(montoComprometido);
    setMetodoPagoAdelanto('yape');
    setReferenciaAdelanto('');
    setCuentaDestinoId('');
    setMonedaAdelanto('PEN');
    setTipoModalAdelanto('pago');
    await cargarCuentasPorMoneda('PEN');
    setShowAdelantoModal(true);
  };

  const handleRegistrarAdelanto = (cotizacion: Cotizacion) => {
    if (cotizacion.estado === 'pendiente_adelanto') {
      handleRegistrarPagoAdelanto(cotizacion);
    } else {
      handleComprometerAdelanto(cotizacion);
    }
  };

  const handleConfirmarAdelanto = async (data: {
    monto: number;
    metodoPago?: MetodoPago;
    referencia?: string;
    cuentaDestinoId?: string;
    moneda?: MonedaTesoreria;
    tipoCambio?: number;
  }) => {
    if (!user || !cotizacionParaAdelanto) return;
    setProcesandoAdelanto(true);
    try {
      if (tipoModalAdelanto === 'comprometer') {
        const porcentaje = Math.round((data.monto / cotizacionParaAdelanto.totalPEN) * 100);
        await comprometerAdelanto(
          cotizacionParaAdelanto.id,
          { monto: data.monto, porcentaje, diasParaPagar: 3 },
          user.uid
        );
        toast.success(`Adelanto comprometido por ${formatCurrency(data.monto)}. Registra el pago cuando el cliente lo realice.`);
      } else {
        if (!data.metodoPago) {
          throw new Error('Selecciona un método de pago');
        }
        const monedaPago = data.moneda || 'PEN';
        const montoFinal = monedaPago === 'USD' && data.tipoCambio
          ? Math.round((data.monto / data.tipoCambio) * 100) / 100
          : data.monto;
        const resultado = await registrarPagoAdelanto(
          cotizacionParaAdelanto.id,
          {
            monto: montoFinal,
            metodoPago: data.metodoPago,
            referencia: data.referencia,
            cuentaDestinoId: data.cuentaDestinoId,
            moneda: monedaPago,
            tipoCambio: monedaPago === 'USD' ? data.tipoCambio : undefined,
            montoEquivalentePEN: monedaPago === 'USD' ? data.monto : undefined
          },
          user.uid
        );
        const tipoMsg = resultado.tipoReserva === 'fisica'
          ? 'Stock reservado físicamente'
          : 'Reserva virtual creada';
        const monedaLabel = monedaPago === 'USD' && data.tipoCambio
          ? ` — Pago: ${formatCurrencyUtil(montoFinal, 'USD')} (TC: ${data.tipoCambio.toFixed(3)}) = ${formatCurrency(data.monto)}`
          : '';
        toast.success(`${tipoMsg}${monedaLabel}. Vigencia: 90 días (con adelanto pagado)`);
      }
      setShowAdelantoModal(false);
      setCotizacionParaAdelanto(null);
      setShowDetailsModal(false);
    } catch (error: any) {
      throw error;
    } finally {
      setProcesandoAdelanto(false);
    }
  };

  const handleWhatsApp = (cotizacion: Cotizacion) => {
    if (!cotizacion.telefonoCliente) {
      toast.warning('No hay teléfono registrado');
      return;
    }
    const productos = cotizacion.productos.map(p =>
      `• ${p.cantidad}x ${p.marca} ${p.nombreComercial} - ${formatCurrency(p.subtotal)}`
    ).join('\n');
    const mensaje = encodeURIComponent(
      `Hola ${cotizacion.nombreCliente},\n\n` +
      `Te envío la cotización *${cotizacion.numeroCotizacion}*:\n\n` +
      `${productos}\n\n` +
      `*Total: ${formatCurrency(cotizacion.totalPEN)}*`
    );
    const telefono = cotizacion.telefonoCliente.replace(/\D/g, '');
    window.open(`https://wa.me/51${telefono}?text=${mensaje}`, '_blank');
  };

  const handleDescargarPdf = async (cotizacion: Cotizacion) => {
    if (!empresa) {
      toast.error('No se ha cargado la información de la empresa');
      return;
    }
    setGenerandoPdf(true);
    try {
      await CotizacionPdfService.downloadPdf(cotizacion, empresa);
    } catch (error: any) {
      toast.error(`Error al generar PDF: ${error.message}`);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const handleAbrirPdf = async (cotizacion: Cotizacion) => {
    if (!empresa) {
      toast.error('No se ha cargado la información de la empresa');
      return;
    }
    setGenerandoPdf(true);
    try {
      await CotizacionPdfService.openPdf(cotizacion, empresa);
    } catch (error: any) {
      toast.error(`Error al generar PDF: ${error.message}`);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const handleMonedaAdelantoChange = (moneda: MonedaTesoreria) => {
    setMonedaAdelanto(moneda);
    cargarCuentasPorMoneda(moneda);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base hidden sm:block">Flujo: Nueva → Validada → Con Abono → Confirmada</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchCotizaciones()} className="flex-1 sm:flex-initial justify-center">
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Button onClick={() => setShowModal(true)} className="flex-1 sm:flex-initial justify-center">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Cotización
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <CotizacionesMetricas metricas={metricas} />

      {/* Alertas */}
      <CotizacionesAlertas
        reservasPorVencer={reservasPorVencer}
        conFaltanteStock={conFaltanteStock}
        reservasVirtuales={reservasVirtuales}
        onVerDetalles={handleVerDetalles}
      />

      {/* Filtros */}
      <CotizacionesFiltros
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        filtroCanal={filtroCanal}
        onFiltroCanalChange={setFiltroCanal}
        vista={vista}
        onVistaChange={setVista}
      />

      {/* Contenido principal */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : vista === 'kanban' ? (
        <KanbanView
          nuevas={nuevas}
          pendienteAdelanto={pendienteAdelanto}
          listasParaConfirmar={listasParaConfirmar}
          sinAdelanto={sinAdelanto}
          conAdelantoPagado={conAdelantoPagado}
          confirmadas={confirmadas}
          rechazadas={rechazadas}
          userId={user?.uid}
          onVerDetalles={handleVerDetalles}
          onWhatsApp={handleWhatsApp}
          onDescargarPdf={handleDescargarPdf}
          onValidar={handleValidar}
          onComprometerAdelanto={handleComprometerAdelanto}
          onRegistrarPagoAdelanto={handleRegistrarPagoAdelanto}
          onConfirmar={handleConfirmar}
          onRechazar={handleRechazar}
          onEliminar={handleEliminar}
          onActualizarDiasValidez={actualizarDiasValidez}
          onActualizarTiempoImportacion={actualizarTiempoEstimadoImportacion}
          onActualizarDiasEntrega={actualizarDiasCompromisoEntrega}
        />
      ) : (
        <ListaView
          cotizaciones={cotizacionesFiltradas}
          onVerDetalles={handleVerDetalles}
          onWhatsApp={handleWhatsApp}
          onValidar={handleValidar}
          onConfirmar={handleConfirmar}
          onRegistrarAdelanto={handleRegistrarAdelanto}
          onRevertirValidacion={handleRevertirValidacion}
          onRechazar={handleRechazar}
          onEliminar={handleEliminar}
          onNuevaCotizacion={() => setShowModal(true)}
        />
      )}

      {/* Modal Nueva/Editar Cotización */}
      {showModal && (
        <CotizacionForm
          onClose={() => {
            setShowModal(false);
            setCotizacionEditar(null);
          }}
          cotizacionEditar={cotizacionEditar}
        />
      )}

      {/* Modal Detalles */}
      {showDetailsModal && selectedCotizacion && (
        <CotizacionDetailModal
          isOpen={showDetailsModal}
          cotizacion={selectedCotizacion}
          generandoPdf={generandoPdf}
          resolverNombreCanal={resolverNombreCanal}
          onClose={() => setShowDetailsModal(false)}
          onEditar={handleEditar}
          onDuplicar={handleDuplicar}
          onDescargarPdf={handleDescargarPdf}
          onAbrirPdf={handleAbrirPdf}
          onWhatsApp={handleWhatsApp}
          onValidar={handleValidar}
          onComprometerAdelanto={handleComprometerAdelanto}
          onRegistrarPagoAdelanto={handleRegistrarPagoAdelanto}
          onRevertirValidacion={handleRevertirValidacion}
          onConfirmar={handleConfirmar}
          onRechazar={handleRechazar}
          onEliminar={handleEliminar}
        />
      )}

      {/* Modal Adelanto */}
      {showAdelantoModal && cotizacionParaAdelanto && (
        <AdelantoModal
          isOpen={showAdelantoModal}
          cotizacion={cotizacionParaAdelanto}
          tipoModal={tipoModalAdelanto}
          monto={montoAdelanto}
          metodoPago={metodoPagoAdelanto}
          referencia={referenciaAdelanto}
          cuentaDestinoId={cuentaDestinoId}
          cuentasDisponibles={cuentasDisponibles}
          moneda={monedaAdelanto}
          tipoCambio={tipoCambioAdelanto}
          procesando={procesandoAdelanto}
          onMonto={setMontoAdelanto}
          onMetodoPago={setMetodoPagoAdelanto}
          onReferencia={setReferenciaAdelanto}
          onCuentaDestino={setCuentaDestinoId}
          onMonedaChange={handleMonedaAdelantoChange}
          onTipoCambio={setTipoCambioAdelanto}
          onConfirmar={handleConfirmarAdelanto}
          onClose={() => {
            setShowAdelantoModal(false);
            setCotizacionParaAdelanto(null);
          }}
        />
      )}

      {/* Modal Rechazar */}
      {showRechazoModal && cotizacionParaRechazar && (
        <RechazoModal
          isOpen={showRechazoModal}
          cotizacion={cotizacionParaRechazar}
          motivo={motivoRechazo}
          descripcion={descripcionRechazo}
          onMotivo={setMotivoRechazo}
          onDescripcion={setDescripcionRechazo}
          onConfirmar={handleConfirmarRechazo}
          onClose={() => {
            setShowRechazoModal(false);
            setCotizacionParaRechazar(null);
          }}
        />
      )}

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};
