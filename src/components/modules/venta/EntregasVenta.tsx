import React, { useEffect, useState } from 'react';
import { formatFecha as formatDate } from '../../../utils/dateFormatters';
import {
  Truck,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Printer,
  MapPin,
  Phone,
  Calendar,
  DollarSign,
  CreditCard,
  AlertTriangle,
  Pencil,
  Wallet,
  PlusCircle,
  MoreVertical
} from 'lucide-react';
import { Button, Badge, Modal, Input } from '../../common';
import { useEntregaStore } from '../../../store/entregaStore';
import { useAuthStore } from '../../../store/authStore';
import { useToastStore } from '../../../store/toastStore';
import { useTransportistaStore } from '../../../store/transportistaStore';
import { pdfService } from '../../../services/pdf.service';
import { invalidarCacheGastos } from '../../../hooks/useRentabilidadVentas';
import { tesoreriaService } from '../../../services/tesoreria.service';
import { gastoService } from '../../../services/gasto.service';
import type { Entrega, EstadoEntrega, MotivoFallo } from '../../../types/entrega.types';
import type { Venta, MetodoPago } from '../../../types/venta.types';
import type { CuentaCaja } from '../../../types/tesoreria.types';

interface EntregasVentaProps {
  ventaId: string;
  venta: Venta;
  /** Callback cuando se completa una entrega - para refrescar rentabilidad en el padre */
  onEntregaCompletada?: () => void;
}

const estadoConfig: Record<EstadoEntrega, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; icon: React.ReactNode }> = {
  programada: { label: 'Programada', variant: 'info', icon: <Clock className="h-4 w-4" /> },
  en_camino: { label: 'En Camino', variant: 'warning', icon: <Truck className="h-4 w-4" /> },
  entregada: { label: 'Entregada', variant: 'success', icon: <CheckCircle className="h-4 w-4" /> },
  fallida: { label: 'Fallida', variant: 'danger', icon: <XCircle className="h-4 w-4" /> },
  reprogramada: { label: 'Reprogramada', variant: 'warning', icon: <Calendar className="h-4 w-4" /> },
  cancelada: { label: 'Cancelada', variant: 'danger', icon: <XCircle className="h-4 w-4" /> }
};

const courierLabels: Record<string, string> = {
  olva: 'Olva',
  mercado_envios: 'M. Envios',
  urbano: 'Urbano',
  shalom: 'Shalom',
  otro: 'Otro'
};

const motivoFalloOptions: Array<{ value: MotivoFallo; label: string; icon: string }> = [
  { value: 'no_encontrado', label: 'No encontro la direccion', icon: '📍' },
  { value: 'ausente', label: 'Cliente ausente', icon: '🚪' },
  { value: 'rechazo', label: 'Cliente rechazo el producto', icon: '❌' },
  { value: 'producto_danado', label: 'Producto danado', icon: '📦' },
  { value: 'pago_rechazado', label: 'No pudo realizar el cobro', icon: '💳' },
  { value: 'otro', label: 'Otro motivo', icon: '📝' },
];

const metodoPagoOptions: Array<{ value: MetodoPago; label: string }> = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'transferencia', label: 'Transferencia' }
];

// Mapeo de MetodoPago (venta) a MetodoTesoreria para buscar cuenta default
const metodoTesoreriaMap: Record<string, string> = {
  'efectivo': 'efectivo',
  'yape': 'yape',
  'plin': 'plin',
  'transferencia': 'transferencia_bancaria',
  'tarjeta': 'tarjeta',
  'otro': 'otro'
};

export const EntregasVenta: React.FC<EntregasVentaProps> = ({ ventaId, venta, onEntregaCompletada }) => {
  const { fetchByVenta, fetchResumenVenta, resumenVenta, marcarEnCamino, registrarResultado, corregirEntrega } = useEntregaStore();
  const user = useAuthStore(state => state.user);
  const toast = useToastStore();
  const { transportistasActivos, fetchActivos } = useTransportistaStore();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  // =============================================
  // ISSUE 2: Estado para modal de fallo
  // =============================================
  const [entregaFallida, setEntregaFallida] = useState<Entrega | null>(null);
  const [motivoFalloSeleccionado, setMotivoFalloSeleccionado] = useState<MotivoFallo>('otro');
  const [descripcionFallo, setDescripcionFallo] = useState('');

  // =============================================
  // ISSUE 3: Estado para modal de completar con cobro
  // =============================================
  const [entregaCompletando, setEntregaCompletando] = useState<Entrega | null>(null);
  const [cobroRealizado, setCobroRealizado] = useState(false);
  const [montoRecaudado, setMontoRecaudado] = useState(0);
  const [metodoPagoRecibido, setMetodoPagoRecibido] = useState<MetodoPago>('efectivo');
  const [cuentaDestinoId, setCuentaDestinoId] = useState<string>('');
  const [cuentasDisponibles, setCuentasDisponibles] = useState<CuentaCaja[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState(false);
  const [fechaEntregaReal, setFechaEntregaReal] = useState<string>(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  // Menu desplegable de acciones por entrega
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);

  // Estado para modal de correccion de entrega
  const [entregaEditando, setEntregaEditando] = useState<Entrega | null>(null);
  const [editTransportistaId, setEditTransportistaId] = useState('');
  const [editCostoTransportista, setEditCostoTransportista] = useState(0);

  // Estado para costo extra de entrega
  const [entregaCostoExtra, setEntregaCostoExtra] = useState<Entrega | null>(null);
  const [costoExtraMonto, setCostoExtraMonto] = useState('');
  const [costoExtraDescripcion, setCostoExtraDescripcion] = useState('');

  useEffect(() => {
    const cargar = async () => {
      try {
        const entregasVenta = await fetchByVenta(ventaId);
        setEntregas(entregasVenta);
        await fetchResumenVenta(ventaId);
      } catch (error) {
        console.error('Error cargando entregas:', error);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [ventaId, fetchByVenta, fetchResumenVenta]);


  const handlePrintGuia = async (entrega: Entrega) => {
    try {
      await pdfService.downloadGuiaTransportista(entrega);
    } catch (error) {
      console.error('Error generando guia:', error);
      toast.error('Error al generar la guia de transportista');
    }
  };

  const handlePrintCargo = async (entrega: Entrega) => {
    try {
      await pdfService.downloadCargoCliente(entrega);
    } catch (error) {
      console.error('Error generando cargo:', error);
      toast.error('Error al generar el cargo de cliente');
    }
  };

  // Despachar entrega (entregar producto al transportista)
  const handleDespachar = async (entrega: Entrega) => {
    if (!user) return;
    setProcesando(entrega.id);
    try {
      await marcarEnCamino(entrega.id, user.uid);
      const entregasActualizadas = await fetchByVenta(ventaId);
      setEntregas(entregasActualizadas);
      toast.success(`Entrega ${entrega.codigo} despachada al transportista`);
      onEntregaCompletada?.();
    } catch (error: any) {
      toast.error(error.message || 'Error al despachar entrega');
    } finally {
      setProcesando(null);
    }
  };

  // =============================================
  // ISSUE 3: Completar entrega con confirmacion de cobro
  // =============================================
  const cargarCuentasYDefault = async (metodo: MetodoPago) => {
    setLoadingCuentas(true);
    try {
      const cuentas = await tesoreriaService.getCuentasActivas('PEN');
      setCuentasDisponibles(cuentas);
      // Pre-seleccionar cuenta default para el método de pago
      const metodoTes = metodoTesoreriaMap[metodo] || 'efectivo';
      const cuentaDefault = await tesoreriaService.getCuentaPorMetodoPago(metodoTes as any, 'PEN');
      if (cuentaDefault) {
        setCuentaDestinoId(cuentaDefault.id);
      } else if (cuentas.length > 0) {
        setCuentaDestinoId(cuentas[0].id);
      }
    } catch (error) {
      console.error('Error al cargar cuentas:', error);
    } finally {
      setLoadingCuentas(false);
    }
  };

  const handleCompletarEntrega = (entrega: Entrega) => {
    if (!user) return;

    // Siempre inicializar fecha y hora de entrega real
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setFechaEntregaReal(now.toISOString().slice(0, 16));

    if (entrega.cobroPendiente && entrega.montoPorCobrar && entrega.montoPorCobrar > 0) {
      // Tiene cobro pendiente: abrir modal para confirmar cobro
      setEntregaCompletando(entrega);
      setCobroRealizado(true);
      setMontoRecaudado(entrega.montoPorCobrar);
      const metodo = (entrega.metodoPagoEsperado as MetodoPago) || 'efectivo';
      setMetodoPagoRecibido(metodo);
      setCuentaDestinoId('');
      // Cargar cuentas disponibles
      cargarCuentasYDefault(metodo);
    } else {
      // Sin cobro: abrir modal tambien para permitir fecha retroactiva
      setEntregaCompletando(entrega);
    }
  };

  const confirmarCompletarEntrega = async (
    entrega: Entrega,
    cobro: boolean,
    monto: number,
    metodo: MetodoPago | undefined,
    cuenta: string | undefined,
    fechaEntrega?: string
  ) => {
    if (!user) return;

    setProcesando(entrega.id);
    try {
      await registrarResultado({
        entregaId: entrega.id,
        exitosa: true,
        fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : undefined,
        cobroRealizado: cobro || undefined,
        montoRecaudado: cobro ? monto : undefined,
        metodoPagoRecibido: cobro ? metodo : undefined,
        cuentaDestinoId: cobro && cuenta ? cuenta : undefined,
        notasEntrega: cobro
          ? `Entrega completada con cobro de S/ ${monto.toFixed(2)} (${metodo})`
          : 'Entrega completada desde panel de ventas'
      }, user.uid);

      const entregasActualizadas = await fetchByVenta(ventaId);
      setEntregas(entregasActualizadas);
      await fetchResumenVenta(ventaId);

      let mensaje = `Entrega ${entrega.codigo} completada. GD de S/ ${(entrega.costoTransportista || 0).toFixed(2)} registrado.`;
      if (cobro && monto > 0) {
        mensaje += ` Cobro de S/ ${monto.toFixed(2)} registrado en la venta.`;
      }
      toast.success(mensaje, 'Entrega Exitosa');

      setEntregaCompletando(null);

      setTimeout(() => {
        invalidarCacheGastos();
        if (onEntregaCompletada) {
          onEntregaCompletada();
        }
      }, 500);
    } catch (error: any) {
      toast.error(error.message || 'Error al completar entrega');
    } finally {
      setProcesando(null);
    }
  };

  // =============================================
  // ISSUE 2: Marcar entrega como fallida con modal
  // =============================================
  const handleMarcarFallida = (entrega: Entrega) => {
    if (!user) return;
    setEntregaFallida(entrega);
    setMotivoFalloSeleccionado('otro');
    setDescripcionFallo('');
  };

  const handleConfirmarFallo = async () => {
    if (!user || !entregaFallida) return;

    if (motivoFalloSeleccionado === 'otro' && !descripcionFallo.trim()) {
      toast.error('Ingresa una descripcion del motivo');
      return;
    }

    const labelMotivo = motivoFalloOptions.find(o => o.value === motivoFalloSeleccionado)?.label || motivoFalloSeleccionado;

    setProcesando(entregaFallida.id);
    try {
      await registrarResultado({
        entregaId: entregaFallida.id,
        exitosa: false,
        motivoFallo: motivoFalloSeleccionado,
        descripcionFallo: descripcionFallo.trim() || undefined,
        notasEntrega: `Fallida: ${labelMotivo}${descripcionFallo.trim() ? ' - ' + descripcionFallo.trim() : ''}`
      }, user.uid);

      const entregasActualizadas = await fetchByVenta(ventaId);
      setEntregas(entregasActualizadas);
      await fetchResumenVenta(ventaId);

      toast.warning(`Entrega ${entregaFallida.codigo} marcada como fallida: ${labelMotivo}`);
      setEntregaFallida(null);
    } catch (error: any) {
      toast.error(error.message || 'Error al marcar entrega como fallida');
    } finally {
      setProcesando(null);
    }
  };

  // =============================================
  // Corregir entrega (transportista y/o tarifa)
  // =============================================
  const estadosEditables: EstadoEntrega[] = ['programada', 'en_camino', 'reprogramada', 'entregada'];

  const handleEditarEntrega = (entrega: Entrega) => {
    setEntregaEditando(entrega);
    setEditTransportistaId(entrega.transportistaId);
    setEditCostoTransportista(entrega.costoTransportista || 0);
    fetchActivos();
  };

  const handleConfirmarEdicion = async () => {
    if (!user || !entregaEditando) return;

    const cambios: { transportistaId?: string; costoTransportista?: number } = {};

    if (editTransportistaId !== entregaEditando.transportistaId) {
      cambios.transportistaId = editTransportistaId;
    }
    if (editCostoTransportista !== (entregaEditando.costoTransportista || 0)) {
      cambios.costoTransportista = editCostoTransportista;
    }

    if (Object.keys(cambios).length === 0) {
      setEntregaEditando(null);
      return;
    }

    setProcesando(entregaEditando.id);
    try {
      await corregirEntrega(entregaEditando.id, cambios, user.uid);

      const entregasActualizadas = await fetchByVenta(ventaId);
      setEntregas(entregasActualizadas);
      await fetchResumenVenta(ventaId);

      toast.success(`Entrega ${entregaEditando.codigo} corregida`);
      setEntregaEditando(null);

      // Siempre refrescar rentabilidad si hay gasto GD asociado (cualquier estado)
      if (onEntregaCompletada && (entregaEditando.gastoDistribucionId || entregaEditando.estado === 'entregada')) {
        setTimeout(() => {
          invalidarCacheGastos();
          onEntregaCompletada();
        }, 500);
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al corregir entrega');
    } finally {
      setProcesando(null);
    }
  };

  // Handler para agregar costo extra a una entrega
  const handleAgregarCostoExtra = async () => {
    if (!user || !entregaCostoExtra || !costoExtraMonto || Number(costoExtraMonto) <= 0) return;

    setProcesando(entregaCostoExtra.id);
    try {
      await gastoService.crearGastoDistribucion({
        entregaId: entregaCostoExtra.id,
        entregaCodigo: entregaCostoExtra.codigo,
        ventaId: entregaCostoExtra.ventaId,
        ventaNumero: venta.numeroVenta,
        transportistaId: entregaCostoExtra.transportistaId,
        transportistaNombre: entregaCostoExtra.nombreTransportista,
        costoEntrega: Number(costoExtraMonto),
        distrito: entregaCostoExtra.distrito,
        descripcionExtra: costoExtraDescripcion || 'Costo adicional de transporte'
      }, user.uid);

      toast.success(`Costo extra S/ ${Number(costoExtraMonto).toFixed(2)} registrado para ${entregaCostoExtra.codigo}`);
      setEntregaCostoExtra(null);
      setCostoExtraMonto('');
      setCostoExtraDescripcion('');

      invalidarCacheGastos();
      if (onEntregaCompletada) onEntregaCompletada();
    } catch (error: any) {
      toast.error(error.message || 'Error al registrar costo extra');
    } finally {
      setProcesando(null);
    }
  };

  // Auto-fill costo cuando cambia transportista en modal de edicion
  useEffect(() => {
    if (entregaEditando && editTransportistaId) {
      // Solo auto-fill si el transportista cambio respecto al original
      if (editTransportistaId !== entregaEditando.transportistaId) {
        const transportista = transportistasActivos.find(t => t.id === editTransportistaId);
        if (transportista) {
          const costo = transportista.costoFijo ?? transportista.costoPromedioPorEntrega ?? 0;
          setEditCostoTransportista(costo);
        }
      }
    }
  }, [editTransportistaId, transportistasActivos, entregaEditando]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (entregas.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <Truck className="h-10 w-10 mx-auto mb-2 text-gray-400" />
        <p>No hay entregas programadas para esta venta</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      {resumenVenta && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Package className="h-5 w-5 text-blue-600 mr-2" />
              <span className="font-medium text-gray-900">Resumen de Entregas</span>
            </div>
            <Badge variant={resumenVenta.entregaCompleta ? 'success' : 'warning'}>
              {resumenVenta.entregaCompleta ? 'Entrega Completa' : 'Entrega Parcial'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-3 text-sm">
            <div>
              <span className="text-gray-500 text-xs sm:text-sm">Productos</span>
              <p className="font-semibold text-gray-900">
                {resumenVenta.productosEntregados} / {resumenVenta.totalProductos}
              </p>
            </div>
            <div>
              <span className="text-gray-500 text-xs sm:text-sm">Entregas</span>
              <p className="font-semibold text-gray-900">{resumenVenta.entregas.length}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-gray-500 text-xs sm:text-sm">Costo Distribucion</span>
              <p className="font-semibold text-amber-600">
                S/ {resumenVenta.costoTotalDistribucion.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de entregas */}
      <div className="space-y-3">
        {entregas.map((entrega) => {
          const estadoInfo = estadoConfig[entrega.estado];

          return (
            <div
              key={entrega.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    entrega.tipoTransportista === 'interno' ? 'bg-blue-100' : 'bg-purple-100'
                  }`}>
                    <Truck className={`h-5 w-5 ${
                      entrega.tipoTransportista === 'interno' ? 'text-blue-600' : 'text-purple-600'
                    }`} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{entrega.codigo}</div>
                    <div className="text-sm text-gray-500">
                      Entrega {entrega.numeroEntrega}{entrega.totalEntregas ? ` de ${entrega.totalEntregas}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={estadoInfo.variant}>
                    <span className="flex items-center gap-1">
                      {estadoInfo.icon}
                      {estadoInfo.label}
                    </span>
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm mb-3">
                <div>
                  <div className="flex items-center text-gray-500 mb-1">
                    <Truck className="h-4 w-4 mr-1 flex-shrink-0" />
                    <span className="text-xs sm:text-sm">Transportista</span>
                  </div>
                  <div className="font-medium text-gray-900">
                    {entrega.nombreTransportista}
                    {entrega.courierExterno && (
                      <span className="text-gray-500 ml-1">
                        ({courierLabels[entrega.courierExterno]})
                      </span>
                    )}
                  </div>
                  {entrega.telefonoTransportista && (
                    <a href={`tel:${entrega.telefonoTransportista}`} className="text-gray-500 flex items-center mt-1 hover:text-blue-600">
                      <Phone className="h-3 w-3 mr-1" />
                      {entrega.telefonoTransportista}
                    </a>
                  )}
                </div>
                <div>
                  <div className="flex items-center text-gray-500 mb-1">
                    <Calendar className="h-4 w-4 mr-1 flex-shrink-0" />
                    <span className="text-xs sm:text-sm">Programada</span>
                  </div>
                  <div className="font-medium text-gray-900">
                    {formatDate(entrega.fechaProgramada)}
                  </div>
                  {entrega.horaProgramada && (
                    <div className="text-gray-500">{entrega.horaProgramada}</div>
                  )}
                </div>
              </div>

              <div className="flex items-start text-sm text-gray-600 mb-3">
                <MapPin className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0 text-gray-400" />
                <span>
                  {entrega.direccionEntrega}
                  {entrega.distrito && ` - ${entrega.distrito}`}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
                  <span className="text-gray-500">
                    <Package className="h-4 w-4 inline mr-1" />
                    {entrega.cantidadItems} items
                  </span>
                  {entrega.cobroPendiente && entrega.montoPorCobrar && (
                    <span className="text-amber-600 font-medium">
                      <CreditCard className="h-3.5 w-3.5 inline mr-1" />
                      Cobrar: S/ {entrega.montoPorCobrar.toFixed(2)}
                    </span>
                  )}
                  {/* ISSUE 6: Display de costo mas prominente */}
                  <span className={`font-medium ${
                    (entrega.costoTransportista || 0) > 0 ? 'text-blue-600' : 'text-red-500'
                  }`}>
                    <DollarSign className="h-3.5 w-3.5 inline mr-0.5" />
                    GD: S/ {(entrega.costoTransportista || 0).toFixed(2)}
                    {(entrega.costoTransportista || 0) === 0 && (
                      <span className="text-xs ml-1">(sin costo)</span>
                    )}
                  </span>
                  {/* Mostrar si el cobro ya fue realizado */}
                  {entrega.cobroRealizado && entrega.montoRecaudado && (
                    <Badge variant="success" className="text-xs">
                      Cobrado: S/ {entrega.montoRecaudado.toFixed(2)}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePrintGuia(entrega)}
                    title="Guia para transportista"
                  >
                    <FileText className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Guia</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePrintCargo(entrega)}
                    title="Cargo para cliente"
                  >
                    <Printer className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Cargo</span>
                  </Button>
                  {/* Menu desplegable para acciones secundarias */}
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setMenuAbierto(menuAbierto === entrega.id ? null : entrega.id)}
                      title="Mas opciones"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                    {menuAbierto === entrega.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[160px]">
                        {estadosEditables.includes(entrega.estado) && (
                          <button
                            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => { handleEditarEntrega(entrega); setMenuAbierto(null); }}
                          >
                            <Pencil className="h-4 w-4 mr-2 text-gray-400" />
                            Editar
                          </button>
                        )}
                        {entrega.estado !== 'cancelada' && (
                          <button
                            className="w-full flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
                            onClick={() => {
                              setEntregaCostoExtra(entrega);
                              setCostoExtraMonto('');
                              setCostoExtraDescripcion('');
                              setMenuAbierto(null);
                            }}
                          >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Costo Extra
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de accion segun estado de entrega */}
              {(entrega.estado === 'programada' || entrega.estado === 'reprogramada') && (
                <div className="flex items-center justify-center gap-2 pt-3 border-t mt-3">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleDespachar(entrega)}
                    disabled={procesando === entrega.id}
                    className="flex-1 sm:flex-none"
                  >
                    <Truck className="h-4 w-4 mr-1" />
                    {procesando === entrega.id ? 'Procesando...' : 'Despachar'}
                  </Button>
                </div>
              )}

              {entrega.estado === 'en_camino' && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-3 border-t mt-3">
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => handleCompletarEntrega(entrega)}
                    disabled={procesando === entrega.id}
                    className="flex-1 sm:flex-none"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {procesando === entrega.id ? 'Procesando...' : 'Entregada'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleMarcarFallida(entrega)}
                    disabled={procesando === entrega.id}
                    className="flex-1 sm:flex-none"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    No Entregada
                  </Button>
                </div>
              )}

              {/* Info de fallo (para entregas fallidas) */}
              {entrega.estado === 'fallida' && entrega.motivoFallo && (
                <div className="mt-2 pt-2 border-t">
                  <div className="flex items-center text-sm text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                    <span className="font-medium">
                      {motivoFalloOptions.find(o => o.value === entrega.motivoFallo)?.label || entrega.motivoFallo}
                    </span>
                  </div>
                  {entrega.descripcionFallo && (
                    <p className="text-xs text-gray-500 mt-1 ml-5">{entrega.descripcionFallo}</p>
                  )}
                </div>
              )}

              {entrega.numeroTracking && (
                <div className="mt-2 pt-2 border-t text-sm">
                  <span className="text-gray-500">Tracking:</span>
                  <span className="font-mono ml-2 text-gray-900">{entrega.numeroTracking}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* =============================================
          ISSUE 2: Modal de Entrega Fallida
          ============================================= */}
      {entregaFallida && (
        <Modal
          isOpen={!!entregaFallida}
          onClose={() => setEntregaFallida(null)}
          title="Registrar Entrega Fallida"
          size="sm"
        >
          <div className="space-y-4">
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <p className="text-sm font-medium text-red-800">
                Entrega: {entregaFallida.codigo}
              </p>
              <p className="text-xs text-red-600 mt-1">
                {entregaFallida.nombreCliente} - {entregaFallida.direccionEntrega}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo del fallo *
              </label>
              <div className="space-y-2">
                {motivoFalloOptions.map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      motivoFalloSeleccionado === opt.value
                        ? 'border-red-400 bg-red-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="motivoFallo"
                      value={opt.value}
                      checked={motivoFalloSeleccionado === opt.value}
                      onChange={(e) => setMotivoFalloSeleccionado(e.target.value as MotivoFallo)}
                      className="sr-only"
                    />
                    <span className="mr-2">{opt.icon}</span>
                    <span className={`text-sm ${
                      motivoFalloSeleccionado === opt.value ? 'font-medium text-red-800' : 'text-gray-700'
                    }`}>
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripcion adicional {motivoFalloSeleccionado === 'otro' ? '*' : '(opcional)'}
              </label>
              <textarea
                value={descripcionFallo}
                onChange={(e) => setDescripcionFallo(e.target.value)}
                rows={3}
                placeholder="Detalle del motivo..."
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-sm"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setEntregaFallida(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmarFallo}
                loading={procesando === entregaFallida.id}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Confirmar Fallo
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* =============================================
          ISSUE 3: Modal de Completar Entrega con Cobro
          ============================================= */}
      {entregaCompletando && (
        <Modal
          isOpen={!!entregaCompletando}
          onClose={() => setEntregaCompletando(null)}
          title="Completar Entrega"
          size="sm"
        >
          <div className="space-y-4">
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-800">
                {entregaCompletando.codigo}
              </p>
              <p className="text-xs text-green-600 mt-1">
                GD: S/ {(entregaCompletando.costoTransportista || 0).toFixed(2)} - {entregaCompletando.nombreTransportista}
              </p>
            </div>

            {/* Fecha real de entrega */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="h-4 w-4 inline mr-1" />
                Fecha de Entrega
              </label>
              <input
                type="datetime-local"
                value={fechaEntregaReal}
                onChange={(e) => setFechaEntregaReal(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {fechaEntregaReal && (() => {
                const now = new Date();
                const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                return !fechaEntregaReal.startsWith(hoy);
              })() && (
                <p className="text-xs text-amber-600 mt-1">
                  Registrando entrega con fecha diferente a hoy
                </p>
              )}
            </div>

            {/* Seccion de cobro */}
            {entregaCompletando.cobroPendiente && entregaCompletando.montoPorCobrar && entregaCompletando.montoPorCobrar > 0 ? (
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-amber-900">
                    <CreditCard className="h-4 w-4 inline mr-1" />
                    Cobro Pendiente
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Esperado: S/ {(entregaCompletando.montoPorCobrar || 0).toFixed(2)}
                    {entregaCompletando.metodoPagoEsperado && ` (${entregaCompletando.metodoPagoEsperado})`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3 p-2 bg-white rounded-lg">
                <span className="text-sm text-gray-700 font-medium">Se realizo el cobro?</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cobroRealizado}
                    onChange={(e) => setCobroRealizado(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>

              {cobroRealizado && (
                <div className="space-y-3">
                  <Input
                    label="Monto Recaudado (S/)"
                    type="number"
                    value={montoRecaudado}
                    onChange={(e) => setMontoRecaudado(parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.01}
                    icon={<DollarSign className="h-5 w-5 text-gray-400" />}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Metodo de Pago
                    </label>
                    <select
                      value={metodoPagoRecibido}
                      onChange={(e) => {
                        const nuevoMetodo = e.target.value as MetodoPago;
                        setMetodoPagoRecibido(nuevoMetodo);
                        // Re-seleccionar cuenta default para el nuevo método
                        cargarCuentasYDefault(nuevoMetodo);
                      }}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    >
                      {metodoPagoOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selector de cuenta destino */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Wallet className="h-4 w-4 inline mr-1" />
                      Cuenta Destino
                    </label>
                    {loadingCuentas ? (
                      <div className="text-sm text-gray-500 py-2">Cargando cuentas...</div>
                    ) : cuentasDisponibles.length === 0 ? (
                      <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                        <AlertTriangle className="inline h-3 w-3 mr-1" />
                        No hay cuentas disponibles. Configure cuentas en Tesoreria.
                      </div>
                    ) : (
                      <>
                        <select
                          value={cuentaDestinoId}
                          onChange={(e) => setCuentaDestinoId(e.target.value)}
                          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        >
                          <option value="">Seleccionar cuenta...</option>
                          {cuentasDisponibles.map((cuenta) => {
                            const saldo = cuenta.esBiMoneda
                              ? (cuenta.saldoPEN || 0)
                              : cuenta.saldoActual;
                            return (
                              <option key={cuenta.id} value={cuenta.id}>
                                {cuenta.nombre}{cuenta.banco ? ` (${cuenta.banco})` : ''} - Saldo: S/ {saldo.toFixed(2)}
                              </option>
                            );
                          })}
                        </select>
                      </>
                    )}
                  </div>
                </div>
              )}

              {!cobroRealizado && (
                <div className="p-2 bg-red-50 rounded-lg border border-red-200 mt-2">
                  <p className="text-xs text-red-700">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    El cobro pendiente de S/ {(entregaCompletando.montoPorCobrar || 0).toFixed(2)} quedara sin cobrar.
                  </p>
                </div>
              )}
            </div>
            ) : (
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">
                  Sin cobro pendiente en esta entrega.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setEntregaCompletando(null)}>
                Cancelar
              </Button>
              <Button
                variant="success"
                onClick={() => confirmarCompletarEntrega(
                  entregaCompletando,
                  cobroRealizado,
                  montoRecaudado,
                  metodoPagoRecibido,
                  cuentaDestinoId || undefined,
                  fechaEntregaReal || undefined
                )}
                loading={procesando === entregaCompletando.id}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Completar Entrega
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Correccion de Entrega */}
      {/* Modal Costo Extra */}
      {entregaCostoExtra && (
        <Modal
          isOpen={!!entregaCostoExtra}
          onClose={() => setEntregaCostoExtra(null)}
          title="Agregar Costo de Transporte"
          size="sm"
        >
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800">
                {entregaCostoExtra.codigo} - {entregaCostoExtra.nombreTransportista}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Costo base: S/ {(entregaCostoExtra.costoTransportista || 0).toFixed(2)}
              </p>
            </div>

            <Input
              label="Monto adicional (S/)"
              type="number"
              value={costoExtraMonto}
              onChange={(e) => setCostoExtraMonto(e.target.value)}
              min={0}
              step={0.01}
              placeholder="0.00"
              icon={<DollarSign className="h-5 w-5 text-gray-400" />}
            />

            <Input
              label="Descripción"
              type="text"
              value={costoExtraDescripcion}
              onChange={(e) => setCostoExtraDescripcion(e.target.value)}
              placeholder="Recargo por volumen, tarifa recalculada..."
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setEntregaCostoExtra(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleAgregarCostoExtra}
                loading={procesando === entregaCostoExtra.id}
                disabled={!costoExtraMonto || Number(costoExtraMonto) <= 0}
              >
                <PlusCircle className="h-4 w-4 mr-1" />
                Registrar Costo
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {entregaEditando && (
        <Modal
          isOpen={!!entregaEditando}
          onClose={() => setEntregaEditando(null)}
          title="Corregir Entrega"
          size="sm"
        >
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800">
                {entregaEditando.codigo}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {entregaEditando.nombreCliente} - {entregaEditando.direccionEntrega}
              </p>
            </div>

            {entregaEditando.estado === 'entregada' && (
              <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-700">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  Esta entrega ya fue completada. Se actualizara tambien el gasto GD asociado.
                </p>
              </div>
            )}

            {/* Transportista */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Truck className="h-4 w-4 inline mr-2" />
                Transportista
              </label>
              <select
                value={editTransportistaId}
                onChange={(e) => setEditTransportistaId(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              >
                <option value="">Seleccionar transportista...</option>
                <optgroup label="Internos (Lima)">
                  {transportistasActivos
                    .filter(t => t.tipo === 'interno')
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.nombre} - S/ {(t.costoFijo ?? t.costoPromedioPorEntrega)?.toFixed(2) || '0.00'}
                      </option>
                    ))
                  }
                </optgroup>
                <optgroup label="Externos (Couriers)">
                  {transportistasActivos
                    .filter(t => t.tipo === 'externo')
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.nombre} ({courierLabels[t.courierExterno || 'otro']}) - S/ {(t.costoFijo ?? t.costoPromedioPorEntrega)?.toFixed(2) || '0.00'}
                      </option>
                    ))
                  }
                </optgroup>
              </select>
            </div>

            {/* Costo GD */}
            <Input
              label="Costo GD (S/)"
              type="number"
              value={editCostoTransportista}
              onChange={(e) => setEditCostoTransportista(parseFloat(e.target.value) || 0)}
              min={0}
              step={0.01}
              icon={<DollarSign className="h-5 w-5 text-gray-400" />}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setEntregaEditando(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmarEdicion}
                loading={procesando === entregaEditando.id}
                disabled={!editTransportistaId}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Guardar Cambios
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
