import React, { useEffect, useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  MessageCircle,
  Phone,
  Download,
  Eye,
  TrendingUp,
  DollarSign,
  Lock,
  AlertTriangle,
  Package,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  RefreshCw,
  UserCheck,
  Undo2,
  ThumbsDown,
  Archive,
  User,
  ExternalLink,
  Copy,
  Edit3,
  ShoppingCart
} from 'lucide-react';
import { Card, Badge, Button, Input, Select, Modal } from '../../components/common';
import { CotizacionForm } from './CotizacionForm';
import { CotizacionCard } from './CotizacionCard';
import { RegistrarAdelantoModal } from '../../components/modules/venta/RegistrarAdelantoModal';
import { useCotizacionStore } from '../../store/cotizacionStore';
import { useConfiguracionStore } from '../../store/configuracionStore';
import { useAuthStore } from '../../store/authStore';
import { exportService } from '../../services/export.service';
import { CotizacionPdfService } from '../../services/cotizacionPdf.service';
import { tesoreriaService } from '../../services/tesoreria.service';
import { tipoCambioService } from '../../services/tipoCambio.service';
import type { Cotizacion, MotivoRechazo } from '../../types/cotizacion.types';
import type { MetodoPago } from '../../types/venta.types';
import type { CuentaCaja, MonedaTesoreria } from '../../types/tesoreria.types';

type VistaType = 'kanban' | 'lista';

// Sección colapsable
interface SeccionColapsableProps {
  titulo: string;
  icono: React.ReactNode;
  cantidad: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: 'warning' | 'info' | 'success' | 'danger';
}

const SeccionColapsable: React.FC<SeccionColapsableProps> = ({
  titulo,
  icono,
  cantidad,
  children,
  defaultOpen = false,
  variant = 'info'
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const variantStyles = {
    warning: 'border-amber-200 bg-amber-50',
    info: 'border-blue-200 bg-blue-50',
    success: 'border-green-200 bg-green-50',
    danger: 'border-red-200 bg-red-50'
  };

  const iconStyles = {
    warning: 'text-amber-600',
    info: 'text-blue-600',
    success: 'text-green-600',
    danger: 'text-red-600'
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${variantStyles[variant]}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={iconStyles[variant]}>{icono}</span>
          <span className="font-medium text-gray-800">{titulo}</span>
          <Badge variant={variant} size="sm">{cantidad}</Badge>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 bg-white border-t">
          {children}
        </div>
      )}
    </div>
  );
};

// Card de Kanban
interface KanbanCardProps {
  cotizacion: Cotizacion;
  onView: () => void;
  onWhatsApp: () => void;
  onDownloadPdf?: () => void;
  onValidar?: () => void;
  onRegistrarAdelanto?: () => void;
  onConfirmar?: () => void;
  onRevertir?: () => void;
  onRechazar?: () => void;
  showValidar?: boolean;
  showAdelanto?: boolean;
  showConfirmar?: boolean;
  showRevertir?: boolean;
  showRechazar?: boolean;
}

const KanbanCard: React.FC<KanbanCardProps> = ({
  cotizacion,
  onView,
  onWhatsApp,
  onDownloadPdf,
  onValidar,
  onRegistrarAdelanto,
  onConfirmar,
  onRevertir,
  onRechazar,
  showValidar = false,
  showAdelanto = false,
  showConfirmar = false,
  showRevertir = false,
  showRechazar = false
}) => {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount);

  const getDiasAntiguedad = (timestamp: any): number => {
    if (!timestamp?.toDate) return 0;
    const fecha = timestamp.toDate();
    const hoy = new Date();
    return Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
  };

  const dias = getDiasAntiguedad(cotizacion.fechaCreacion);

  // Verificar productos sin stock
  const requiereStock = cotizacion.productos.some(p => p.requiereStock);

  return (
    <div className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-sm font-semibold text-primary-600">{cotizacion.numeroCotizacion}</span>
          {requiereStock && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
              <AlertTriangle className="h-3 w-3 mr-0.5" />
              Sin stock
            </span>
          )}
        </div>
        <Badge variant={dias > 7 ? 'warning' : dias > 3 ? 'info' : 'success'} size="sm">
          {dias === 0 ? 'Hoy' : `${dias}d`}
        </Badge>
      </div>

      <div className="mb-2">
        <p className="text-sm font-medium text-gray-900 truncate">{cotizacion.nombreCliente}</p>
        {cotizacion.telefonoCliente && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {cotizacion.telefonoCliente}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-lg font-bold text-gray-900">{formatCurrency(cotizacion.totalPEN)}</span>
        <span className="text-xs text-gray-500">{cotizacion.productos.length} prod.</span>
      </div>

      <div className="flex items-center gap-1 pt-2 border-t">
        <button
          onClick={onView}
          className="flex-1 p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
          title="Ver detalles"
        >
          <Eye className="h-4 w-4 mx-auto" />
        </button>
        {onDownloadPdf && (
          <button
            onClick={onDownloadPdf}
            className="flex-1 p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
            title="Descargar PDF"
          >
            <Download className="h-4 w-4 mx-auto" />
          </button>
        )}
        {cotizacion.telefonoCliente && (
          <button
            onClick={onWhatsApp}
            className="flex-1 p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
            title="WhatsApp"
          >
            <MessageCircle className="h-4 w-4 mx-auto" />
          </button>
        )}
        {showValidar && onValidar && (
          <button
            onClick={onValidar}
            className="flex-1 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Validar (cliente confirmó)"
          >
            <UserCheck className="h-4 w-4 mx-auto" />
          </button>
        )}
        {showRevertir && onRevertir && (
          <button
            onClick={onRevertir}
            className="flex-1 p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
            title="Revertir validación"
          >
            <Undo2 className="h-4 w-4 mx-auto" />
          </button>
        )}
        {showAdelanto && onRegistrarAdelanto && (
          <button
            onClick={onRegistrarAdelanto}
            className={`flex-1 p-1.5 text-gray-500 rounded transition-colors ${
              cotizacion.estado === 'pendiente_adelanto'
                ? 'hover:text-green-600 hover:bg-green-50'
                : 'hover:text-purple-600 hover:bg-purple-50'
            }`}
            title={cotizacion.estado === 'pendiente_adelanto' ? 'Registrar Pago' : 'Comprometer Adelanto'}
          >
            {cotizacion.estado === 'pendiente_adelanto' ? (
              <DollarSign className="h-4 w-4 mx-auto" />
            ) : (
              <Lock className="h-4 w-4 mx-auto" />
            )}
          </button>
        )}
        {showConfirmar && onConfirmar && (
          <button
            onClick={onConfirmar}
            className="flex-1 p-1.5 text-gray-500 hover:text-success-600 hover:bg-success-50 rounded transition-colors"
            title="Confirmar venta"
          >
            <CheckCircle className="h-4 w-4 mx-auto" />
          </button>
        )}
        {showRechazar && onRechazar && (
          <button
            onClick={onRechazar}
            className="flex-1 p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Rechazar cotización"
          >
            <ThumbsDown className="h-4 w-4 mx-auto" />
          </button>
        )}
      </div>
    </div>
  );
};

// Opciones de motivo de rechazo
const MOTIVOS_RECHAZO: { value: MotivoRechazo; label: string }[] = [
  { value: 'precio_alto', label: 'Precio muy alto' },
  { value: 'encontro_mejor_opcion', label: 'Encontró mejor opción' },
  { value: 'sin_presupuesto', label: 'Sin presupuesto' },
  { value: 'producto_diferente', label: 'Quería otro producto' },
  { value: 'demora_entrega', label: 'Demora en entrega' },
  { value: 'cambio_necesidad', label: 'Ya no necesita' },
  { value: 'sin_respuesta', label: 'Sin respuesta' },
  { value: 'otro', label: 'Otro motivo' }
];

export const Cotizaciones: React.FC = () => {
  const { user } = useAuthStore();
  const { empresa, fetchEmpresa } = useConfiguracionStore();
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
    deleteCotizacion
  } = useCotizacionStore();

  const [showModal, setShowModal] = useState(false);
  const [cotizacionEditar, setCotizacionEditar] = useState<Cotizacion | null>(null);  // Para modo edición
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

  // Estados para el formulario de adelanto
  const [montoAdelanto, setMontoAdelanto] = useState(0);
  const [metodoPagoAdelanto, setMetodoPagoAdelanto] = useState<MetodoPago>('yape');
  const [referenciaAdelanto, setReferenciaAdelanto] = useState('');
  const [cuentaDestinoId, setCuentaDestinoId] = useState('');
  const [cuentasDisponibles, setCuentasDisponibles] = useState<CuentaCaja[]>([]);
  const [procesandoAdelanto, setProcesandoAdelanto] = useState(false);
  // Tipo de modal: 'comprometer' = solo monto, 'pago' = monto + método + referencia
  const [tipoModalAdelanto, setTipoModalAdelanto] = useState<'comprometer' | 'pago'>('comprometer');
  // Bimoneda: moneda del adelanto (PEN por defecto)
  const [monedaAdelanto, setMonedaAdelanto] = useState<MonedaTesoreria>('PEN');
  // Tipo de cambio para conversión USD → PEN
  const [tipoCambioAdelanto, setTipoCambioAdelanto] = useState<number>(3.7); // TC por defecto

  useEffect(() => {
    fetchCotizaciones();
    fetchStats();
    fetchEmpresa();
  }, [fetchCotizaciones, fetchStats, fetchEmpresa]);

  // Filtrar cotizaciones
  const cotizacionesFiltradas = useMemo(() => {
    let filtradas = [...todasCotizaciones];

    if (busqueda) {
      const termino = busqueda.toLowerCase();
      filtradas = filtradas.filter(c =>
        c.numeroCotizacion.toLowerCase().includes(termino) ||
        c.nombreCliente.toLowerCase().includes(termino) ||
        (c.telefonoCliente && c.telefonoCliente.includes(busqueda))
      );
    }

    if (filtroCanal) {
      filtradas = filtradas.filter(c => c.canal === filtroCanal);
    }

    return filtradas;
  }, [todasCotizaciones, busqueda, filtroCanal]);

  // ========== NUEVO FLUJO: Categorizar por ACCIÓN del vendedor ==========
  const {
    nuevas,              // Seguimiento inicial
    pendienteAdelanto,   // Esperando pago de adelanto
    listasParaConfirmar, // Pueden convertirse en venta (validadas + adelanto_pagado)
    conFaltanteStock,    // Requieren stock (solo en estados activos)
    confirmadas,         // Convertidas en venta (historial)
    rechazadas           // Para análisis
  } = useMemo(() => {
    const nuevas = cotizacionesFiltradas.filter(c => c.estado === 'nueva');

    // Pendiente adelanto: cliente comprometió pero no ha pagado
    const pendienteAdelanto = cotizacionesFiltradas.filter(c => c.estado === 'pendiente_adelanto');

    // Listas para confirmar: validadas (sin adelanto) + adelanto_pagado + con_abono (legacy)
    const listasParaConfirmar = cotizacionesFiltradas.filter(c =>
      c.estado === 'validada' ||
      c.estado === 'adelanto_pagado' ||
      c.estado === 'con_abono' // Legacy
    );

    // Confirmadas: convertidas en venta (historial con link a venta)
    const confirmadas = cotizacionesFiltradas.filter(c => c.estado === 'confirmada');

    // Rechazadas y vencidas (para análisis)
    const rechazadas = cotizacionesFiltradas.filter(c =>
      c.estado === 'rechazada' || c.estado === 'vencida'
    );

    // Faltante de stock: solo en estados activos que aún no confirmaron
    const conFaltanteStock = cotizacionesFiltradas.filter(c =>
      (c.estado === 'nueva' || c.estado === 'validada' || c.estado === 'pendiente_adelanto') &&
      c.productos.some(p => p.requiereStock)
    );

    return { nuevas, pendienteAdelanto, listasParaConfirmar, conFaltanteStock, confirmadas, rechazadas };
  }, [cotizacionesFiltradas]);

  // Subcategorías de "Listas para confirmar"
  const { sinAdelanto, conAdelantoPagado, reservasVirtuales, porVencer } = useMemo(() => {
    // Sin adelanto (7 días vigencia)
    const sinAdelanto = listasParaConfirmar.filter(c => c.estado === 'validada');

    // Con adelanto pagado (90 días vigencia, stock reservado)
    const conAdelantoPagado = listasParaConfirmar.filter(c =>
      c.estado === 'adelanto_pagado' || c.estado === 'con_abono'
    );

    // Reservas virtuales (esperando stock)
    const reservasVirtuales = conAdelantoPagado.filter(c =>
      c.reservaStock?.tipoReserva === 'virtual'
    );

    // Por vencer (próximas 48 horas)
    const porVencer = listasParaConfirmar.filter(c => {
      if (!c.fechaVencimiento) return false;
      const vencimiento = c.fechaVencimiento.toDate?.() || new Date();
      const ahora = new Date();
      const diff = vencimiento.getTime() - ahora.getTime();
      return diff > 0 && diff < 48 * 60 * 60 * 1000; // 48 horas
    });

    return { sinAdelanto, conAdelantoPagado, reservasVirtuales, porVencer };
  }, [listasParaConfirmar]);

  // Alias para compatibilidad con código existente
  const validadas = sinAdelanto;
  const conAbono = conAdelantoPagado;
  const reservasPorVencer = porVencer;
  const reservasFisicas = conAdelantoPagado.filter(c => c.reservaStock?.tipoReserva === 'fisica');

  // Métricas usando stats del store
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

  const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount);

  const formatCurrencyBimoneda = (amount: number, moneda: MonedaTesoreria): string =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda }).format(amount);

  const formatFecha = (timestamp: any): string => {
    if (!timestamp?.toDate) return '-';
    return timestamp.toDate().toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleVerDetalles = (cotizacion: Cotizacion) => {
    setSelectedCotizacion(cotizacion);
    setShowDetailsModal(true);
  };

  const handleConfirmar = async (cotizacion: Cotizacion) => {
    if (!user) return;

    const requiereStock = cotizacion.productos.some(p => p.requiereStock);
    const mensaje = requiereStock
      ? `⚠️ Esta cotización tiene productos SIN STOCK.\n\n¿Confirmar ${cotizacion.numeroCotizacion} como venta?`
      : `¿Confirmar la cotización ${cotizacion.numeroCotizacion}?`;

    if (!window.confirm(mensaje)) return;

    try {
      const resultado = await confirmarCotizacion(cotizacion.id, user.uid);
      alert(`✅ Cotización confirmada.\nVenta creada: ${resultado.numeroVenta}`);
      setShowDetailsModal(false);
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
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
        {
          motivo: motivoRechazo,
          descripcion: descripcionRechazo || undefined
        },
        user.uid
      );
      alert('Cotización rechazada. Se guardó para análisis de demanda.');
      setShowRechazoModal(false);
      setCotizacionParaRechazar(null);
      setShowDetailsModal(false);
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const handleEliminar = async (cotizacion: Cotizacion) => {
    if (!window.confirm(`¿Eliminar ${cotizacion.numeroCotizacion}?`)) return;
    try {
      await deleteCotizacion(cotizacion.id);
      setShowDetailsModal(false);
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  // Handler para editar cotización
  const handleEditar = (cotizacion: Cotizacion) => {
    const estadosEditables = ['nueva', 'validada', 'pendiente_adelanto'];
    if (!estadosEditables.includes(cotizacion.estado)) {
      alert('Solo se pueden editar cotizaciones en estados: Nueva, Validada o Esperando Pago');
      return;
    }
    setCotizacionEditar(cotizacion);
    setShowDetailsModal(false);
    setShowModal(true);
  };

  // Handler para duplicar cotización (crear nueva basada en existente)
  const handleDuplicar = (cotizacion: Cotizacion) => {
    // Crear una copia de la cotización sin ID ni estado para que se cree como nueva
    const cotizacionDuplicada = {
      ...cotizacion,
      id: '', // Sin ID para que se cree nueva
      numeroCotizacion: '', // Se generará nuevo
      estado: 'nueva' as const,
      // Limpiar campos de flujo
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

    if (!window.confirm(`¿Confirmar que el cliente "${cotizacion.nombreCliente}" validó su interés en la cotización ${cotizacion.numeroCotizacion}?`)) return;

    try {
      await validarCotizacion(cotizacion.id, user.uid);
      alert('✅ Cotización validada. Ahora puedes registrar el adelanto.');
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const handleRevertirValidacion = async (cotizacion: Cotizacion) => {
    if (!user) return;

    if (!window.confirm(`¿Revertir la validación de ${cotizacion.numeroCotizacion}?`)) return;

    try {
      await revertirValidacion(cotizacion.id, user.uid);
      alert('✅ Validación revertida.');
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  // Abrir modal para COMPROMETER adelanto (nueva/validada → pendiente_adelanto)
  const handleComprometerAdelanto = (cotizacion: Cotizacion) => {
    setCotizacionParaAdelanto(cotizacion);
    setMontoAdelanto(Math.round(cotizacion.totalPEN * 0.5 * 100) / 100);
    setTipoModalAdelanto('comprometer');
    setShowAdelantoModal(true);
  };

  // Cargar cuentas disponibles según la moneda seleccionada
  const cargarCuentasPorMoneda = async (moneda: MonedaTesoreria) => {
    try {
      const cuentas = await tesoreriaService.getCuentasActivas(moneda);
      setCuentasDisponibles(cuentas);
      // Seleccionar la primera cuenta por defecto si existe
      if (cuentas.length > 0) {
        setCuentaDestinoId(cuentas[0].id);
      } else {
        setCuentaDestinoId('');
      }

      // Si es USD, cargar el tipo de cambio del día
      if (moneda === 'USD') {
        try {
          const tcDelDia = await tipoCambioService.getTCDelDia();
          if (tcDelDia) {
            // Usar TC de venta (el cliente paga en USD, nosotros recibimos el equivalente)
            setTipoCambioAdelanto(tcDelDia.venta);
          }
        } catch (tcError) {
          console.warn('No se pudo cargar el tipo de cambio:', tcError);
          // Mantener el TC por defecto
        }
      }
    } catch (error) {
      console.warn('No se pudieron cargar las cuentas:', error);
      setCuentasDisponibles([]);
      setCuentaDestinoId('');
    }
  };

  // Abrir modal para REGISTRAR PAGO de adelanto (pendiente_adelanto → adelanto_pagado)
  const handleRegistrarPagoAdelanto = async (cotizacion: Cotizacion) => {
    setCotizacionParaAdelanto(cotizacion);
    // Si ya tiene adelanto comprometido, usar ese monto
    const montoComprometido = cotizacion.adelantoComprometido?.monto || Math.round(cotizacion.totalPEN * 0.5 * 100) / 100;
    setMontoAdelanto(montoComprometido);
    setMetodoPagoAdelanto('yape');
    setReferenciaAdelanto('');
    setCuentaDestinoId('');
    setMonedaAdelanto('PEN'); // Por defecto PEN
    setTipoModalAdelanto('pago');

    // Cargar cuentas disponibles para PEN (moneda por defecto)
    await cargarCuentasPorMoneda('PEN');

    setShowAdelantoModal(true);
  };

  // Legacy: mantener para compatibilidad con KanbanCard
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

    try {
      if (tipoModalAdelanto === 'comprometer') {
        // SOLO COMPROMETER: nueva/validada → pendiente_adelanto
        const porcentaje = Math.round((data.monto / cotizacionParaAdelanto.totalPEN) * 100);
        await comprometerAdelanto(
          cotizacionParaAdelanto.id,
          { monto: data.monto, porcentaje, diasParaPagar: 3 },
          user.uid
        );

        alert(`✅ Adelanto comprometido por ${formatCurrency(data.monto)}\n\nLa cotización ahora está en "Esperando Pago".\nRegistra el pago cuando el cliente lo realice.`);
      } else {
        // REGISTRAR PAGO: pendiente_adelanto → adelanto_pagado
        if (!data.metodoPago) {
          throw new Error('Selecciona un método de pago');
        }

        const monedaPago = data.moneda || 'PEN';

        // Si es USD, el monto a guardar es el equivalente en USD (montoPEN / TC)
        // El montoEquivalentePEN es el monto original comprometido
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
            // Para USD, el monto original en PEN (el comprometido)
            montoEquivalentePEN: monedaPago === 'USD' ? data.monto : undefined
          },
          user.uid
        );

        const tipoMsg = resultado.tipoReserva === 'fisica'
          ? '✅ Stock reservado físicamente'
          : '⏳ Reserva virtual creada';

        const monedaLabel = monedaPago === 'USD' && data.tipoCambio
          ? `\n\nPago: ${formatCurrencyBimoneda(montoFinal, 'USD')} (TC: ${data.tipoCambio.toFixed(3)}) = ${formatCurrency(data.monto)}`
          : '';
        alert(`${tipoMsg}${monedaLabel}\n\nVigencia: 90 días (con adelanto pagado)`);
      }

      setShowAdelantoModal(false);
      setCotizacionParaAdelanto(null);
      setShowDetailsModal(false);
    } catch (error: any) {
      throw error;
    }
  };

  const handleWhatsApp = (cotizacion: Cotizacion) => {
    if (!cotizacion.telefonoCliente) {
      alert('No hay teléfono registrado');
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
      alert('Error: No se ha cargado la información de la empresa');
      return;
    }

    setGenerandoPdf(true);
    try {
      await CotizacionPdfService.downloadPdf(cotizacion, empresa);
    } catch (error: any) {
      alert(`Error al generar PDF: ${error.message}`);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const handleAbrirPdf = async (cotizacion: Cotizacion) => {
    if (!empresa) {
      alert('Error: No se ha cargado la información de la empresa');
      return;
    }

    setGenerandoPdf(true);
    try {
      await CotizacionPdfService.openPdf(cotizacion, empresa);
    } catch (error: any) {
      alert(`Error al generar PDF: ${error.message}`);
    } finally {
      setGenerandoPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-gray-600 mt-1">Flujo: Nueva → Validada → Con Abono → Confirmada | Colección: cotizaciones/</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchCotizaciones()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Cotización
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card padding="md" className="border-l-4 border-l-gray-400">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase">Nuevas</div>
              <div className="text-2xl font-bold text-gray-600">{metricas.nuevas}</div>
            </div>
            <FileText className="h-8 w-8 text-gray-300" />
          </div>
        </Card>

        <Card padding="md" className="border-l-4 border-l-amber-400">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase">Esperando Pago</div>
              <div className="text-2xl font-bold text-amber-600">{metricas.pendienteAdelanto}</div>
            </div>
            <Clock className="h-8 w-8 text-amber-300" />
          </div>
        </Card>

        <Card padding="md" className="border-l-4 border-l-green-400">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase">Listas</div>
              <div className="text-2xl font-bold text-green-600">{metricas.listasParaConfirmar}</div>
            </div>
            <CheckCircle className="h-8 w-8 text-green-300" />
          </div>
        </Card>

        <Card padding="md" className="border-l-4 border-l-red-400">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase">Rechazadas</div>
              <div className="text-2xl font-bold text-red-600">{metricas.rechazadas}</div>
            </div>
            <ThumbsDown className="h-8 w-8 text-red-300" />
          </div>
        </Card>

        <Card padding="md" className="border-l-4 border-l-amber-400">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase">Por Vencer</div>
              <div className="text-2xl font-bold text-amber-600">{metricas.proximasAVencer}</div>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-300" />
          </div>
        </Card>

        <Card padding="md" className="border-l-4 border-l-purple-400">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase">Pipeline</div>
              <div className="text-lg font-bold text-purple-600">{formatCurrency(metricas.valorTotal)}</div>
            </div>
            <DollarSign className="h-8 w-8 text-purple-300" />
          </div>
        </Card>

        <Card padding="md" className="border-l-4 border-l-teal-400">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase">Conversión</div>
              <div className="text-2xl font-bold text-teal-600">{metricas.tasaConversion.toFixed(1)}%</div>
            </div>
            <TrendingUp className="h-8 w-8 text-teal-300" />
          </div>
        </Card>
      </div>

      {/* Secciones de Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Reservas por vencer */}
        <SeccionColapsable
          titulo="Reservas por Vencer"
          icono={<AlertTriangle className="h-5 w-5" />}
          cantidad={reservasPorVencer.length}
          variant="danger"
          defaultOpen={reservasPorVencer.length > 0}
        >
          {reservasPorVencer.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">No hay reservas próximas a vencer</p>
          ) : (
            <div className="space-y-2 pt-2">
              {reservasPorVencer.map(r => (
                <div key={r.id} className="flex items-center justify-between p-2 bg-red-50 rounded">
                  <div>
                    <span className="font-medium text-sm">{r.numeroVenta}</span>
                    <span className="text-xs text-gray-500 ml-2">{r.nombreCliente}</span>
                  </div>
                  <Button size="sm" variant="danger" onClick={() => handleVerDetalles(r)}>
                    Ver
                  </Button>
                </div>
              ))}
            </div>
          )}
        </SeccionColapsable>

        {/* Cotizaciones con faltante */}
        <SeccionColapsable
          titulo="Sin Stock Disponible"
          icono={<Package className="h-5 w-5" />}
          cantidad={conFaltanteStock.length}
          variant="warning"
          defaultOpen={conFaltanteStock.length > 0}
        >
          {conFaltanteStock.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">Todas las cotizaciones tienen stock</p>
          ) : (
            <div className="space-y-2 pt-2">
              {conFaltanteStock.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 bg-amber-50 rounded">
                  <div>
                    <span className="font-medium text-sm">{c.numeroVenta}</span>
                    <span className="text-xs text-gray-500 ml-2">{c.nombreCliente}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleVerDetalles(c)}>
                    Ver
                  </Button>
                </div>
              ))}
              {conFaltanteStock.length > 5 && (
                <p className="text-xs text-gray-500 text-center">+{conFaltanteStock.length - 5} más</p>
              )}
            </div>
          )}
        </SeccionColapsable>

        {/* Reservas virtuales */}
        <SeccionColapsable
          titulo="Reservas Virtuales"
          icono={<Clock className="h-5 w-5" />}
          cantidad={reservasVirtuales.length}
          variant="info"
          defaultOpen={reservasVirtuales.length > 0}
        >
          {reservasVirtuales.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">No hay reservas virtuales pendientes</p>
          ) : (
            <div className="space-y-2 pt-2">
              {reservasVirtuales.map(r => (
                <div key={r.id} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                  <div>
                    <span className="font-medium text-sm">{r.numeroVenta}</span>
                    <span className="text-xs text-gray-500 ml-2">Esperando stock</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleVerDetalles(r)}>
                    Ver
                  </Button>
                </div>
              ))}
            </div>
          )}
        </SeccionColapsable>
      </div>

      {/* Barra de búsqueda y vista */}
      <Card padding="md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por número, cliente o teléfono..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <Select
              value={filtroCanal}
              onChange={(e) => setFiltroCanal(e.target.value)}
              options={[
                { value: '', label: 'Todos los canales' },
                { value: 'mercado_libre', label: 'Mercado Libre' },
                { value: 'directo', label: 'Directo' },
                { value: 'otro', label: 'Otro' }
              ]}
            />
          </div>

          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setVista('kanban')}
              className={`px-3 py-2 flex items-center gap-1 ${vista === 'kanban' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </button>
            <button
              onClick={() => setVista('lista')}
              className={`px-3 py-2 flex items-center gap-1 ${vista === 'lista' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
          </div>
        </div>
      </Card>

      {/* Contenido principal */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : vista === 'kanban' ? (
        /* Vista Kanban - 4 columnas por ACCIÓN del vendedor */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Columna 1: SEGUIMIENTO - Cotizaciones nuevas sin respuesta */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <h3 className="font-semibold text-gray-700">Seguimiento</h3>
              <Badge variant="default" size="sm">{nuevas.length}</Badge>
            </div>
            <p className="text-xs text-gray-500 mb-3">Cotizaciones sin respuesta del cliente</p>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {nuevas.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Sin cotizaciones nuevas</p>
              ) : (
                nuevas.map(c => (
                  <KanbanCard
                    key={c.id}
                    cotizacion={c}
                    onView={() => handleVerDetalles(c)}
                    onWhatsApp={() => handleWhatsApp(c)}
                    onDownloadPdf={() => handleDescargarPdf(c)}
                    onValidar={() => handleValidar(c)}
                    onRegistrarAdelanto={() => handleComprometerAdelanto(c)}
                    onRechazar={() => handleRechazar(c)}
                    showValidar={true}
                    showAdelanto={true}
                    showRechazar={true}
                  />
                ))
              )}
            </div>
          </div>

          {/* Columna 2: ESPERANDO PAGO - Cliente comprometió adelanto pero no pagó */}
          <div className="bg-amber-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <h3 className="font-semibold text-gray-700">Esperando Pago</h3>
              <Badge variant="warning" size="sm">{pendienteAdelanto.length}</Badge>
            </div>
            <p className="text-xs text-gray-500 mb-3">Comprometieron adelanto, pendiente de pago</p>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {pendienteAdelanto.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Sin pagos pendientes</p>
              ) : (
                pendienteAdelanto.map(c => (
                  <KanbanCard
                    key={c.id}
                    cotizacion={c}
                    onView={() => handleVerDetalles(c)}
                    onWhatsApp={() => handleWhatsApp(c)}
                    onDownloadPdf={() => handleDescargarPdf(c)}
                    onRegistrarAdelanto={() => handleRegistrarPagoAdelanto(c)}
                    onRechazar={() => handleRechazar(c)}
                    showAdelanto={true}
                    showRechazar={true}
                  />
                ))
              )}
            </div>
          </div>

          {/* Columna 3: LISTAS PARA CONFIRMAR - Pueden convertirse en venta */}
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <h3 className="font-semibold text-gray-700">Listas</h3>
              <Badge variant="success" size="sm">{listasParaConfirmar.length}</Badge>
            </div>
            <p className="text-xs text-gray-500 mb-3">Pueden confirmarse como venta</p>

            {/* Subcategorías */}
            {sinAdelanto.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-blue-600 mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Sin adelanto ({sinAdelanto.length}) - 7 días
                </div>
                <div className="space-y-2">
                  {sinAdelanto.map(c => (
                    <KanbanCard
                      key={c.id}
                      cotizacion={c}
                      onView={() => handleVerDetalles(c)}
                      onWhatsApp={() => handleWhatsApp(c)}
                      onDownloadPdf={() => handleDescargarPdf(c)}
                      onRegistrarAdelanto={() => handleComprometerAdelanto(c)}
                      onConfirmar={() => handleConfirmar(c)}
                      onRechazar={() => handleRechazar(c)}
                      showAdelanto={true}
                      showConfirmar={true}
                      showRechazar={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {conAdelantoPagado.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Con adelanto ({conAdelantoPagado.length}) - Stock reservado
                </div>
                <div className="space-y-2">
                  {conAdelantoPagado.map(c => (
                    <KanbanCard
                      key={c.id}
                      cotizacion={c}
                      onView={() => handleVerDetalles(c)}
                      onWhatsApp={() => handleWhatsApp(c)}
                      onDownloadPdf={() => handleDescargarPdf(c)}
                      onConfirmar={() => handleConfirmar(c)}
                      showConfirmar={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {listasParaConfirmar.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Sin cotizaciones listas</p>
            )}
          </div>

          {/* Columna 4: ARCHIVO - Confirmadas y Rechazadas/Vencidas */}
          <div className="space-y-4">
            {/* Sección: CONFIRMADAS - Convertidas en venta */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <h3 className="font-semibold text-gray-700">Confirmadas</h3>
                <Badge variant="info" size="sm">{confirmadas.length}</Badge>
              </div>
              <p className="text-xs text-gray-500 mb-3">Convertidas en venta</p>
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {confirmadas.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Sin confirmadas</p>
                ) : (
                  confirmadas.map(c => (
                    <div key={c.id} className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-semibold text-blue-600">{c.numeroCotizacion}</span>
                        {c.numeroVenta && (
                          <a
                            href={`/ventas?id=${c.ventaId}`}
                            className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-1 hover:bg-green-200 transition-colors"
                          >
                            <ShoppingCart className="h-3 w-3" />
                            {c.numeroVenta}
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 truncate">{c.nombreCliente}</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(c.totalPEN)}</p>
                      {c.fechaConfirmacion && (
                        <p className="text-xs text-gray-500 mt-1">
                          Confirmada: {c.fechaConfirmacion.toDate?.().toLocaleDateString('es-PE')}
                        </p>
                      )}
                      <div className="flex gap-1 mt-2 pt-2 border-t">
                        <button
                          onClick={() => handleVerDetalles(c)}
                          className="flex-1 p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4 mx-auto" />
                        </button>
                        {c.ventaId && (
                          <a
                            href={`/ventas?id=${c.ventaId}`}
                            className="flex-1 p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Ir a la venta"
                          >
                            <ExternalLink className="h-4 w-4 mx-auto" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sección: RECHAZADAS - Para análisis */}
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <h3 className="font-semibold text-gray-700">Archivo</h3>
                <Badge variant="danger" size="sm">{rechazadas.length}</Badge>
              </div>
              <p className="text-xs text-gray-500 mb-3">Rechazadas y vencidas (análisis)</p>
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {rechazadas.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Sin rechazos</p>
                ) : (
                  rechazadas.map(c => (
                    <div key={c.id} className="bg-white border border-red-200 rounded-lg p-3 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-semibold text-red-600">{c.numeroCotizacion}</span>
                        {c.rechazo?.motivo && (
                          <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                            {MOTIVOS_RECHAZO.find(m => m.value === c.rechazo?.motivo)?.label || c.rechazo.motivo}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 truncate">{c.nombreCliente}</p>
                      <p className="text-lg font-bold text-gray-500 line-through">{formatCurrency(c.totalPEN)}</p>
                      <div className="flex gap-1 mt-2 pt-2 border-t">
                        <button
                          onClick={() => handleVerDetalles(c)}
                          className="flex-1 p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        >
                          <Eye className="h-4 w-4 mx-auto" />
                        </button>
                        <button
                          onClick={() => handleEliminar(c)}
                          className="flex-1 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Archive className="h-4 w-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Vista Lista */
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cotización</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cotizacionesFiltradas.map((item) => {
                  const requiereStock = item.productos.some(p => p.requiereStock);
                  return (
                  <tr key={item.id} className={`hover:bg-gray-50 ${item.estado === 'rechazada' || item.estado === 'vencida' ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-primary-600">{item.numeroCotizacion}</span>
                        {requiereStock && (
                          <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">Sin stock</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{item.productos.length} producto(s)</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.nombreCliente}</div>
                      {item.telefonoCliente && (
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {item.telefonoCliente}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <Badge variant={
                          item.estado === 'nueva' ? 'default' :
                          item.estado === 'validada' ? 'info' :
                          item.estado === 'pendiente_adelanto' ? 'warning' :
                          item.estado === 'adelanto_pagado' ? 'success' :
                          item.estado === 'con_abono' ? 'success' : // Legacy
                          item.estado === 'confirmada' ? 'success' :
                          item.estado === 'rechazada' ? 'danger' :
                          item.estado === 'vencida' ? 'warning' : 'default'
                        }>
                          {item.estado === 'nueva' ? 'Nueva' :
                           item.estado === 'validada' ? 'Validada (sin adelanto)' :
                           item.estado === 'pendiente_adelanto' ? 'Esperando Pago' :
                           item.estado === 'adelanto_pagado' ? 'Adelanto Pagado' :
                           item.estado === 'con_abono' ? 'Con Adelanto' : // Legacy
                           item.estado === 'confirmada' ? 'Confirmada' :
                           item.estado === 'rechazada' ? 'Rechazada' :
                           item.estado === 'vencida' ? 'Vencida' : item.estado}
                        </Badge>
                        {(item.estado === 'adelanto_pagado' || item.estado === 'con_abono') && item.reservaStock && (
                          <Badge
                            variant={item.reservaStock.tipoReserva === 'fisica' ? 'success' : 'warning'}
                            size="sm"
                          >
                            {item.reservaStock.tipoReserva === 'fisica' ? '✓ Stock Reservado' : '⏳ Esperando Stock'}
                          </Badge>
                        )}
                        {item.estado === 'pendiente_adelanto' && item.adelantoComprometido && (
                          <span className="text-xs text-amber-600">
                            {item.adelantoComprometido.porcentaje}% comprometido
                          </span>
                        )}
                        {item.estado === 'rechazada' && item.rechazo?.motivo && (
                          <span className="text-xs text-red-600">
                            {MOTIVOS_RECHAZO.find(m => m.value === item.rechazo?.motivo)?.label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(item.totalPEN)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-900">{formatFecha(item.fechaCreacion)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleVerDetalles(item)} className="p-1.5 text-gray-400 hover:text-primary-600" title="Ver">
                          <Eye className="h-4 w-4" />
                        </button>
                        {item.telefonoCliente && (
                          <button onClick={() => handleWhatsApp(item)} className="p-1.5 text-gray-400 hover:text-green-600" title="WhatsApp">
                            <MessageCircle className="h-4 w-4" />
                          </button>
                        )}
                        {item.estado === 'nueva' && (
                          <>
                            <button onClick={() => handleValidar(item)} className="p-1.5 text-gray-400 hover:text-blue-600" title="Validar">
                              <UserCheck className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleRechazar(item)} className="p-1.5 text-gray-400 hover:text-red-600" title="Rechazar">
                              <ThumbsDown className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {item.estado === 'validada' && (
                          <>
                            <button onClick={() => handleConfirmar(item)} className="p-1.5 text-gray-400 hover:text-success-600" title="Confirmar Venta (sin adelanto)">
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleRegistrarAdelanto(item)} className="p-1.5 text-gray-400 hover:text-purple-600" title="Comprometer Adelanto">
                              <Lock className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleRevertirValidacion(item)} className="p-1.5 text-gray-400 hover:text-orange-600" title="Revertir">
                              <Undo2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleRechazar(item)} className="p-1.5 text-gray-400 hover:text-red-600" title="Rechazar">
                              <ThumbsDown className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {item.estado === 'pendiente_adelanto' && (
                          <>
                            <button onClick={() => handleRegistrarAdelanto(item)} className="p-1.5 text-gray-400 hover:text-green-600" title="Registrar Pago">
                              <DollarSign className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleRechazar(item)} className="p-1.5 text-gray-400 hover:text-red-600" title="Rechazar">
                              <ThumbsDown className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {(item.estado === 'adelanto_pagado' || item.estado === 'con_abono') && (
                          <button onClick={() => handleConfirmar(item)} className="p-1.5 text-gray-400 hover:text-success-600" title="Confirmar Venta">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {(item.estado === 'nueva' || item.estado === 'rechazada') && (
                          <button onClick={() => handleEliminar(item)} className="p-1.5 text-gray-400 hover:text-danger-600" title="Eliminar">
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {cotizacionesFiltradas.length === 0 && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay cotizaciones</h3>
              <div className="mt-6">
                <Button onClick={() => setShowModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Cotización
                </Button>
              </div>
            </div>
          )}
        </Card>
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

      {/* Modal Detalles - Expandido */}
      {showDetailsModal && selectedCotizacion && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title={`Cotización ${selectedCotizacion.numeroCotizacion}`}
          size="xl"
        >
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            {/* ===== HEADER: Estado y Total ===== */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg">
              <div className="flex items-center gap-4">
                <Badge
                  variant={
                    selectedCotizacion.estado === 'nueva' ? 'default' :
                    selectedCotizacion.estado === 'validada' ? 'info' :
                    selectedCotizacion.estado === 'con_abono' ? 'success' :
                    selectedCotizacion.estado === 'confirmada' ? 'success' :
                    selectedCotizacion.estado === 'rechazada' ? 'danger' :
                    selectedCotizacion.estado === 'vencida' ? 'warning' : 'default'
                  }
                  size="lg"
                >
                  {selectedCotizacion.estado === 'nueva' ? 'Nueva' :
                   selectedCotizacion.estado === 'validada' ? 'Validada' :
                   selectedCotizacion.estado === 'con_abono' ? 'Con Abono' :
                   selectedCotizacion.estado === 'confirmada' ? 'Confirmada' :
                   selectedCotizacion.estado === 'rechazada' ? 'Rechazada' :
                   selectedCotizacion.estado === 'vencida' ? 'Vencida' : selectedCotizacion.estado}
                </Badge>
                <span className="text-sm text-gray-600">
                  Canal: <span className="font-medium">{selectedCotizacion.canal === 'mercado_libre' ? 'Mercado Libre' : selectedCotizacion.canal === 'directo' ? 'Directo' : selectedCotizacion.canal}</span>
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-2xl font-bold text-primary-600">{formatCurrency(selectedCotizacion.totalPEN)}</p>
              </div>
            </div>

            {/* ===== INFORMACIÓN DEL CLIENTE ===== */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Información del Cliente
                </h4>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Nombre</p>
                  <p className="font-medium text-gray-900">{selectedCotizacion.nombreCliente}</p>
                </div>
                {selectedCotizacion.telefonoCliente && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Teléfono</p>
                    <p className="font-medium text-gray-900 flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {selectedCotizacion.telefonoCliente}
                    </p>
                  </div>
                )}
                {selectedCotizacion.emailCliente && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Email</p>
                    <p className="font-medium text-gray-900">{selectedCotizacion.emailCliente}</p>
                  </div>
                )}
                {selectedCotizacion.dniRuc && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase">DNI/RUC</p>
                    <p className="font-medium text-gray-900">{selectedCotizacion.dniRuc}</p>
                  </div>
                )}
                {selectedCotizacion.direccionEntrega && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 uppercase">Dirección de Entrega</p>
                    <p className="font-medium text-gray-900">{selectedCotizacion.direccionEntrega}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ===== TABLA DE PRODUCTOS ===== */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Productos ({selectedCotizacion.productos.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Stock</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cant.</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">P. Unit.</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedCotizacion.productos.map((producto, idx) => {
                      const sinStock = producto.requiereStock || (producto.stockDisponible !== undefined && producto.stockDisponible < producto.cantidad);
                      return (
                        <tr key={idx} className={sinStock ? 'bg-amber-50' : ''}>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{producto.sku}</div>
                            <div className="text-xs text-gray-500">{producto.marca} - {producto.nombreComercial}</div>
                            {producto.presentacion && (
                              <div className="text-xs text-gray-400">{producto.presentacion}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {producto.stockDisponible !== undefined ? (
                              <Badge variant={sinStock ? 'warning' : 'success'} size="sm">
                                {Math.max(0, producto.stockDisponible)}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-medium">{producto.cantidad}</td>
                          <td className="px-4 py-3 text-right text-sm">{formatCurrency(producto.precioUnitario)}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(producto.subtotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Totales */}
              <div className="bg-gray-50 px-4 py-3 border-t">
                <div className="flex flex-col items-end gap-1">
                  <div className="flex justify-between w-48">
                    <span className="text-sm text-gray-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(selectedCotizacion.subtotalPEN)}</span>
                  </div>
                  {selectedCotizacion.descuento && selectedCotizacion.descuento > 0 && (
                    <div className="flex justify-between w-48">
                      <span className="text-sm text-gray-600">Descuento:</span>
                      <span className="font-medium text-red-600">-{formatCurrency(selectedCotizacion.descuento)}</span>
                    </div>
                  )}
                  {selectedCotizacion.costoEnvio && selectedCotizacion.costoEnvio > 0 && (
                    <div className="flex justify-between w-48">
                      <span className="text-sm text-gray-600">Envío:</span>
                      <span className="font-medium">{formatCurrency(selectedCotizacion.costoEnvio)}</span>
                    </div>
                  )}
                  {selectedCotizacion.incluyeEnvio && (
                    <div className="flex justify-between w-48">
                      <span className="text-sm text-gray-600">Envío:</span>
                      <span className="font-medium text-green-600">GRATIS</span>
                    </div>
                  )}
                  <div className="flex justify-between w-48 pt-2 border-t mt-1">
                    <span className="font-semibold">TOTAL:</span>
                    <span className="font-bold text-lg text-primary-600">{formatCurrency(selectedCotizacion.totalPEN)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== HISTORIAL DEL FLUJO ===== */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Historial del Flujo
                </h4>
              </div>
              <div className="p-4">
                <div className="relative">
                  {/* Línea vertical */}
                  <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200"></div>

                  <div className="space-y-4">
                    {/* Creación */}
                    <div className="flex items-start gap-3 relative">
                      <div className="w-4 h-4 rounded-full bg-gray-400 border-2 border-white z-10"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Cotización creada</p>
                        <p className="text-xs text-gray-500">{formatFecha(selectedCotizacion.fechaCreacion)}</p>
                      </div>
                    </div>

                    {/* Validación */}
                    {selectedCotizacion.fechaValidacion && (
                      <div className="flex items-start gap-3 relative">
                        <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white z-10"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Cliente validó interés</p>
                          <p className="text-xs text-gray-500">{formatFecha(selectedCotizacion.fechaValidacion)}</p>
                        </div>
                      </div>
                    )}

                    {/* Adelanto */}
                    {selectedCotizacion.fechaAdelanto && selectedCotizacion.adelanto && (
                      <div className="flex items-start gap-3 relative">
                        <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white z-10"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Adelanto registrado: {
                              selectedCotizacion.adelanto.moneda === 'USD'
                                ? `${formatCurrency(selectedCotizacion.adelanto.montoEquivalentePEN || 0)} (${formatCurrencyBimoneda(selectedCotizacion.adelanto.monto, 'USD')})`
                                : formatCurrency(selectedCotizacion.adelanto.monto)
                            }
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFecha(selectedCotizacion.fechaAdelanto)} - {selectedCotizacion.adelanto.metodoPago}
                            {selectedCotizacion.adelanto.moneda === 'USD' && selectedCotizacion.adelanto.tipoCambio && (
                              <span className="ml-1">(TC: {selectedCotizacion.adelanto.tipoCambio.toFixed(3)})</span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Confirmación */}
                    {selectedCotizacion.fechaConfirmacion && (
                      <div className="flex items-start gap-3 relative">
                        <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white z-10"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Confirmada como venta</p>
                          <p className="text-xs text-gray-500">{formatFecha(selectedCotizacion.fechaConfirmacion)}</p>
                          {selectedCotizacion.numeroVenta && (
                            <p className="text-xs font-medium text-green-600">{selectedCotizacion.numeroVenta}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Rechazo */}
                    {selectedCotizacion.fechaRechazo && (
                      <div className="flex items-start gap-3 relative">
                        <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white z-10"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Rechazada</p>
                          <p className="text-xs text-gray-500">{formatFecha(selectedCotizacion.fechaRechazo)}</p>
                        </div>
                      </div>
                    )}

                    {/* Vencimiento */}
                    {selectedCotizacion.fechaVencimiento && (
                      <div className="flex items-start gap-3 relative">
                        <div className={`w-4 h-4 rounded-full border-2 border-white z-10 ${
                          selectedCotizacion.estado === 'vencida' ? 'bg-amber-500' : 'bg-gray-300'
                        }`}></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {selectedCotizacion.estado === 'vencida' ? 'Venció' : 'Vence'}
                          </p>
                          <p className="text-xs text-gray-500">{formatFecha(selectedCotizacion.fechaVencimiento)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ===== RESERVA DE STOCK (si existe) ===== */}
            {selectedCotizacion.reservaStock && (
              <div className={`border rounded-lg overflow-hidden ${
                selectedCotizacion.reservaStock.tipoReserva === 'fisica' ? 'border-green-200' : 'border-purple-200'
              }`}>
                <div className={`px-4 py-2 border-b ${
                  selectedCotizacion.reservaStock.tipoReserva === 'fisica' ? 'bg-green-50' : 'bg-purple-50'
                }`}>
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Reserva de Stock
                    <Badge variant={selectedCotizacion.reservaStock.tipoReserva === 'fisica' ? 'success' : 'warning'}>
                      {selectedCotizacion.reservaStock.tipoReserva === 'fisica' ? 'Física' : 'Virtual'}
                    </Badge>
                  </h4>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Fecha Reserva</p>
                      <p className="font-medium">{formatFecha(selectedCotizacion.reservaStock.fechaReserva)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Vigencia Hasta</p>
                      <p className="font-medium">{formatFecha(selectedCotizacion.reservaStock.vigenciaHasta)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Duración</p>
                      <p className="font-medium">{selectedCotizacion.reservaStock.horasVigencia}h</p>
                    </div>
                  </div>

                  {/* Productos reservados */}
                  {selectedCotizacion.reservaStock.productosReservados.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-2">Productos Reservados</p>
                      <div className="space-y-1">
                        {selectedCotizacion.reservaStock.productosReservados.map((pr, idx) => (
                          <div key={idx} className="flex justify-between text-sm bg-gray-50 px-2 py-1 rounded">
                            <span>{pr.sku || `Producto ${idx + 1}`}</span>
                            <span className="font-medium">{pr.cantidad} uds</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stock virtual (si aplica) */}
                  {selectedCotizacion.reservaStock.tipoReserva === 'virtual' && selectedCotizacion.reservaStock.stockVirtual && (
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm font-medium text-purple-800 mb-2">Esperando Stock</p>
                      {selectedCotizacion.reservaStock.stockVirtual.productosVirtuales?.map((pv, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{pv.sku || `Producto ${idx + 1}`}</span>
                          <span className="font-medium text-purple-600">{pv.cantidadRequerida} uds pendientes</span>
                        </div>
                      ))}
                      {selectedCotizacion.reservaStock.stockVirtual.fechaEstimadaStock && (
                        <p className="text-xs text-purple-600 mt-2">
                          Estimado: {formatFecha(selectedCotizacion.reservaStock.stockVirtual.fechaEstimadaStock)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== RECHAZO (si existe) ===== */}
            {selectedCotizacion.rechazo && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-800 flex items-center gap-2 mb-2">
                  <ThumbsDown className="h-4 w-4" />
                  Información del Rechazo
                </h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-red-600 uppercase">Motivo</p>
                    <p className="font-medium text-red-800">
                      {MOTIVOS_RECHAZO.find(m => m.value === selectedCotizacion.rechazo?.motivo)?.label || selectedCotizacion.rechazo.motivo}
                    </p>
                  </div>
                  {selectedCotizacion.rechazo.descripcion && (
                    <div>
                      <p className="text-xs text-red-600 uppercase">Descripción</p>
                      <p className="text-sm text-red-700">{selectedCotizacion.rechazo.descripcion}</p>
                    </div>
                  )}
                  {selectedCotizacion.rechazo.precioEsperado && (
                    <div>
                      <p className="text-xs text-red-600 uppercase">Precio Esperado</p>
                      <p className="font-medium text-red-800">{formatCurrency(selectedCotizacion.rechazo.precioEsperado)}</p>
                    </div>
                  )}
                  {selectedCotizacion.rechazo.competidor && (
                    <div>
                      <p className="text-xs text-red-600 uppercase">Competidor</p>
                      <p className="text-sm text-red-700">{selectedCotizacion.rechazo.competidor}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== VENTA CREADA (si fue confirmada) ===== */}
            {selectedCotizacion.estado === 'confirmada' && selectedCotizacion.numeroVenta && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Venta Creada
                </h4>
                <p className="text-lg font-bold text-green-700 mt-1">{selectedCotizacion.numeroVenta}</p>
              </div>
            )}

            {/* ===== OBSERVACIONES ===== */}
            {selectedCotizacion.observaciones && (
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-gray-700 mb-2">Observaciones</h4>
                <p className="text-sm text-gray-600">{selectedCotizacion.observaciones}</p>
              </div>
            )}
          </div>

          {/* ===== ACCIONES ===== */}
          <div className="mt-6 pt-4 border-t space-y-3">
            {/* Acciones de PDF y comunicación */}
            <div className="flex gap-2 flex-wrap">
              {/* Botón Editar - solo en estados editables */}
              {['nueva', 'validada', 'pendiente_adelanto'].includes(selectedCotizacion.estado) && (
                <Button
                  variant="outline"
                  onClick={() => handleEditar(selectedCotizacion)}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
              {/* Botón Duplicar - siempre disponible */}
              <Button
                variant="outline"
                onClick={() => handleDuplicar(selectedCotizacion)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicar
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDescargarPdf(selectedCotizacion)}
                disabled={generandoPdf}
              >
                <Download className="h-4 w-4 mr-2" />
                {generandoPdf ? 'Generando...' : 'Descargar PDF'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAbrirPdf(selectedCotizacion)}
                disabled={generandoPdf}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver PDF
              </Button>
              {selectedCotizacion.telefonoCliente && (
                <Button variant="outline" onClick={() => handleWhatsApp(selectedCotizacion)}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              )}
            </div>

            {/* Acciones del flujo */}
            <div className="flex gap-2 flex-wrap">
              {selectedCotizacion.estado === 'nueva' && (
                <>
                  <Button variant="primary" onClick={() => handleValidar(selectedCotizacion)}>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Validar (sin adelanto)
                  </Button>
                  <Button variant="secondary" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => handleComprometerAdelanto(selectedCotizacion)}>
                    <Lock className="h-4 w-4 mr-2" />
                    Comprometer Adelanto
                  </Button>
                  <Button variant="danger" onClick={() => handleRechazar(selectedCotizacion)}>
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    Rechazar
                  </Button>
                </>
              )}
              {selectedCotizacion.estado === 'validada' && (
                <>
                  <Button variant="success" onClick={() => handleConfirmar(selectedCotizacion)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar Venta
                  </Button>
                  <Button variant="secondary" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => handleComprometerAdelanto(selectedCotizacion)}>
                    <Lock className="h-4 w-4 mr-2" />
                    Comprometer Adelanto
                  </Button>
                  <Button variant="outline" onClick={() => handleRevertirValidacion(selectedCotizacion)}>
                    <Undo2 className="h-4 w-4 mr-2" />
                    Revertir
                  </Button>
                  <Button variant="danger" onClick={() => handleRechazar(selectedCotizacion)}>
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    Rechazar
                  </Button>
                </>
              )}
              {selectedCotizacion.estado === 'pendiente_adelanto' && (
                <>
                  <Button variant="success" onClick={() => handleRegistrarPagoAdelanto(selectedCotizacion)}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Registrar Pago
                  </Button>
                  <Button variant="danger" onClick={() => handleRechazar(selectedCotizacion)}>
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    Rechazar
                  </Button>
                </>
              )}
              {(selectedCotizacion.estado === 'adelanto_pagado' || selectedCotizacion.estado === 'con_abono') && (
                <Button variant="success" onClick={() => handleConfirmar(selectedCotizacion)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Venta
                </Button>
              )}
              {(selectedCotizacion.estado === 'nueva' || selectedCotizacion.estado === 'rechazada') && (
                <Button variant="outline" onClick={() => handleEliminar(selectedCotizacion)}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Adelanto (comprometer o registrar pago) */}
      {showAdelantoModal && cotizacionParaAdelanto && (
        <Modal
          isOpen={showAdelantoModal}
          onClose={() => {
            setShowAdelantoModal(false);
            setCotizacionParaAdelanto(null);
          }}
          title={tipoModalAdelanto === 'comprometer' ? 'Comprometer Adelanto' : 'Registrar Pago de Adelanto'}
          size="md"
        >
          <div className="space-y-5">
            {/* Info de la cotización */}
            <div className={`rounded-lg p-4 ${tipoModalAdelanto === 'comprometer' ? 'bg-gradient-to-r from-purple-50 to-indigo-50' : 'bg-gradient-to-r from-green-50 to-emerald-50'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">Cotización</p>
                  <p className="font-bold text-primary-600">{cotizacionParaAdelanto.numeroCotizacion}</p>
                  <p className="text-sm text-gray-700 mt-1">{cotizacionParaAdelanto.nombreCliente}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(cotizacionParaAdelanto.totalPEN)}</p>
                </div>
              </div>
            </div>

            {/* Mensaje explicativo según tipo */}
            {tipoModalAdelanto === 'comprometer' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>Comprometer adelanto:</strong> El cliente se compromete a pagar este monto.
                  La cotización pasará a "Esperando Pago" hasta que registres el pago.
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  <strong>Registrar pago:</strong> El cliente ya pagó el adelanto.
                  El stock se reservará y la cotización estará lista para confirmar.
                </p>
              </div>
            )}

            {/* Productos resumidos */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase mb-2">Productos ({cotizacionParaAdelanto.productos.length})</p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {cotizacionParaAdelanto.productos.map((p, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-700">{p.cantidad}x {p.marca} {p.nombreComercial}</span>
                    <span className="font-medium">{formatCurrency(p.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Formulario de adelanto */}
            <div className="space-y-4">
              {/* Monto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto del Adelanto (S/)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={cotizacionParaAdelanto.totalPEN}
                  value={montoAdelanto}
                  onChange={(e) => setMontoAdelanto(parseFloat(e.target.value) || 0)}
                  disabled={tipoModalAdelanto === 'pago' && !!cotizacionParaAdelanto.adelantoComprometido}
                />
                {/* Botones de porcentaje rápido - solo para comprometer */}
                {tipoModalAdelanto === 'comprometer' && (
                  <div className="flex gap-2 mt-2">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setMontoAdelanto(Math.round(cotizacionParaAdelanto.totalPEN * pct / 100 * 100) / 100)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          Math.abs(montoAdelanto - (cotizacionParaAdelanto.totalPEN * pct / 100)) < 0.01
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Campos SOLO para registrar pago */}
              {tipoModalAdelanto === 'pago' && (
                <>
                  {/* Selector de moneda */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Moneda del Pago
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMonedaAdelanto('PEN');
                          cargarCuentasPorMoneda('PEN');
                        }}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                          monedaAdelanto === 'PEN'
                            ? 'bg-green-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        🇵🇪 Soles (PEN)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMonedaAdelanto('USD');
                          cargarCuentasPorMoneda('USD');
                        }}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                          monedaAdelanto === 'USD'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        🇺🇸 Dólares (USD)
                      </button>
                    </div>
                  </div>

                  {/* Método de pago */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Método de Pago
                    </label>
                    <Select
                      value={metodoPagoAdelanto}
                      onChange={(e) => setMetodoPagoAdelanto(e.target.value as MetodoPago)}
                      options={monedaAdelanto === 'PEN' ? [
                        { value: 'yape', label: 'Yape' },
                        { value: 'plin', label: 'Plin' },
                        { value: 'transferencia', label: 'Transferencia' },
                        { value: 'efectivo', label: 'Efectivo' }
                      ] : [
                        { value: 'transferencia', label: 'Transferencia' },
                        { value: 'efectivo', label: 'Efectivo' },
                        { value: 'paypal', label: 'PayPal' },
                        { value: 'zelle', label: 'Zelle' }
                      ]}
                    />
                  </div>

                  {/* Cuenta destino */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cuenta Destino {monedaAdelanto === 'USD' && '(USD)'}
                    </label>
                    {cuentasDisponibles.length > 0 ? (
                      <Select
                        value={cuentaDestinoId}
                        onChange={(e) => setCuentaDestinoId(e.target.value)}
                        options={cuentasDisponibles.map(c => ({
                          value: c.id,
                          label: `${c.nombre} (${c.tipo})${c.esBiMoneda ? ' - Bimoneda' : ''}`
                        }))}
                      />
                    ) : (
                      <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                        No hay cuentas configuradas para {monedaAdelanto}
                      </p>
                    )}
                  </div>

                  {/* Tipo de cambio - Solo para USD */}
                  {monedaAdelanto === 'USD' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo de Cambio (PEN → USD)
                        </label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0.01"
                          value={tipoCambioAdelanto}
                          onChange={(e) => setTipoCambioAdelanto(parseFloat(e.target.value) || 3.7)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          TC del día cargado automáticamente. Puedes ajustarlo si es necesario.
                        </p>
                      </div>
                      <div className="bg-white rounded p-2 border border-blue-100">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Adelanto comprometido:</span>
                          <span className="font-medium">{formatCurrency(montoAdelanto)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm mt-1">
                          <span className="text-gray-600">Equivalente a pagar en USD:</span>
                          <span className="font-bold text-blue-700">
                            {formatCurrencyBimoneda(
                              Math.round((montoAdelanto / tipoCambioAdelanto) * 100) / 100,
                              'USD'
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Referencia */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Referencia / N° Operación (opcional)
                    </label>
                    <Input
                      type="text"
                      value={referenciaAdelanto}
                      onChange={(e) => setReferenciaAdelanto(e.target.value)}
                      placeholder="Ej: OP-123456"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Resumen */}
            <div className={`border rounded-lg p-4 ${tipoModalAdelanto === 'comprometer' ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200'}`}>
              {tipoModalAdelanto === 'comprometer' ? (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Adelanto:</span>
                    <span className="font-bold text-purple-700">{formatCurrency(montoAdelanto)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Saldo pendiente:</span>
                    <span className="font-bold text-gray-900">{formatCurrency(cotizacionParaAdelanto.totalPEN - montoAdelanto)}</span>
                  </div>
                </>
              ) : (
                <>
                  {/* Pago en PEN */}
                  {monedaAdelanto === 'PEN' && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Adelanto a pagar:</span>
                      <span className="font-bold text-green-700">{formatCurrency(montoAdelanto)}</span>
                    </div>
                  )}
                  {/* Pago en USD */}
                  {monedaAdelanto === 'USD' && (
                    <>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600">Adelanto comprometido:</span>
                        <span className="font-medium text-gray-700">{formatCurrency(montoAdelanto)}</span>
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600">A pagar en USD:</span>
                        <span className="font-bold text-blue-700">
                          {formatCurrencyBimoneda(
                            Math.round((montoAdelanto / tipoCambioAdelanto) * 100) / 100,
                            'USD'
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2 text-xs text-gray-500">
                        <span>TC aplicado:</span>
                        <span>{tipoCambioAdelanto.toFixed(3)}</span>
                      </div>
                    </>
                  )}
                  <div className={`mt-3 pt-3 border-t border-green-200`}>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Clock className="h-4 w-4" />
                      <span>El stock se reservará por <strong>90 días</strong></span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowAdelantoModal(false);
                  setCotizacionParaAdelanto(null);
                }}
                disabled={procesandoAdelanto}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                className={`flex-1 ${tipoModalAdelanto === 'comprometer' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'}`}
                disabled={procesandoAdelanto || montoAdelanto <= 0 || montoAdelanto > cotizacionParaAdelanto.totalPEN}
                onClick={async () => {
                  setProcesandoAdelanto(true);
                  try {
                    await handleConfirmarAdelanto({
                      monto: montoAdelanto,
                      metodoPago: tipoModalAdelanto === 'pago' ? metodoPagoAdelanto : undefined,
                      referencia: tipoModalAdelanto === 'pago' ? (referenciaAdelanto || undefined) : undefined,
                      cuentaDestinoId: tipoModalAdelanto === 'pago' ? (cuentaDestinoId || undefined) : undefined,
                      moneda: tipoModalAdelanto === 'pago' ? monedaAdelanto : undefined,
                      tipoCambio: tipoModalAdelanto === 'pago' && monedaAdelanto === 'USD' ? tipoCambioAdelanto : undefined
                    });
                  } catch (error: any) {
                    alert(`❌ Error: ${error.message}`);
                  } finally {
                    setProcesandoAdelanto(false);
                  }
                }}
              >
                {tipoModalAdelanto === 'comprometer' ? (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    {procesandoAdelanto ? 'Procesando...' : 'Comprometer Adelanto'}
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    {procesandoAdelanto ? 'Procesando...' : 'Registrar Pago'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Rechazar Cotización */}
      {showRechazoModal && cotizacionParaRechazar && (
        <Modal
          isOpen={showRechazoModal}
          onClose={() => {
            setShowRechazoModal(false);
            setCotizacionParaRechazar(null);
          }}
          title="Rechazar Cotización"
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Cotización</p>
              <p className="font-semibold text-primary-600">{cotizacionParaRechazar.numeroCotizacion}</p>
              <p className="text-sm mt-1">{cotizacionParaRechazar.nombreCliente}</p>
              <p className="text-lg font-bold mt-2">{formatCurrency(cotizacionParaRechazar.totalPEN)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo del rechazo
              </label>
              <Select
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value as MotivoRechazo)}
                options={MOTIVOS_RECHAZO}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción adicional (opcional)
              </label>
              <textarea
                value={descripcionRechazo}
                onChange={(e) => setDescripcionRechazo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={3}
                placeholder="¿Qué dijo el cliente? ¿Fue a la competencia?"
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              Esta información se guardará para análisis de demanda
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowRechazoModal(false);
                  setCotizacionParaRechazar(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleConfirmarRechazo}
              >
                <ThumbsDown className="h-4 w-4 mr-2" />
                Confirmar Rechazo
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
