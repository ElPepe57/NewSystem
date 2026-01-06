import React, { useEffect, useState, useMemo } from 'react';
import { ShoppingCart, User, Calendar, DollarSign, TrendingUp, Package, Truck, CreditCard, Trash2, Calculator, Receipt, FileText, Link2, ClipboardList, PieChart, MapPin } from 'lucide-react';
import { Badge, Button, StatusTimeline } from '../../common';
import type { TimelineStep, NextAction } from '../../common';
import type { Venta, EstadoVenta, EstadoPago } from '../../../types/venta.types';
import type { Requerimiento } from '../../../types/requerimiento.types';
import type { OrdenCompra } from '../../../types/ordenCompra.types';
import { gastoService } from '../../../services/gasto.service';
import { requerimientoService } from '../../../services/requerimiento.service';
import { OrdenCompraService } from '../../../services/ordenCompra.service';
import { useRentabilidadVentas, type RentabilidadVenta } from '../../../hooks/useRentabilidadVentas';
import { EntregasVenta } from './EntregasVenta';

interface VentaCardProps {
  venta: Venta;
  /** Datos de rentabilidad pre-calculados desde el padre (evita llamadas duplicadas al hook) */
  rentabilidadData?: RentabilidadVenta | null;
  onConfirmar?: () => void;
  onAsignarInventario?: () => void;
  onMarcarEntregada?: () => void;
  onCancelar?: () => void;
  onRegistrarPago?: () => void;
  onEliminarPago?: (pagoId: string) => void;
  onAgregarGastos?: () => void;
  /** Handler para programar entrega - reemplaza el antiguo onMarcarEnEntrega */
  onProgramarEntrega?: () => void;
  /** Callback cuando cambian los datos de entregas/gastos - para refrescar rentabilidad */
  onEntregaCompletada?: () => void;
}

const estadoLabels: Record<EstadoVenta, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  cotizacion: { label: 'Cotización', variant: 'default' },
  reservada: { label: 'Reservada', variant: 'info' },
  confirmada: { label: 'Confirmada', variant: 'info' },
  parcial: { label: 'Parcial', variant: 'warning' },
  asignada: { label: 'Asignada', variant: 'warning' },
  en_entrega: { label: 'En Entrega', variant: 'warning' },
  entrega_parcial: { label: 'Entrega Parcial', variant: 'warning' },
  entregada: { label: 'Entregada', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'danger' },
  devuelta: { label: 'Devuelta', variant: 'danger' },
  devolucion_parcial: { label: 'Devolución Parcial', variant: 'warning' }
};

const estadoPagoLabels: Record<EstadoPago, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  pendiente: { label: 'Pago Pendiente', variant: 'danger' },
  parcial: { label: 'Pago Parcial', variant: 'warning' },
  pagado: { label: 'Pagado', variant: 'success' }
};

const metodoPagoLabels: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  yape: 'Yape',
  plin: 'Plin',
  tarjeta: 'Tarjeta',
  mercado_pago: 'Mercado Pago',
  otro: 'Otro'
};

// Tipo de cambio por defecto para conversión de costos legacy en USD
const TC_DEFAULT = 3.70;

/**
 * Detecta si un costo está en USD y lo convierte a PEN si es necesario
 * Heurística: si el costo por unidad es < 15% del precio de venta,
 * probablemente está en USD (margen 85%+ es imposible)
 */
const convertirCostoSiEsUSD = (
  costo: number,
  cantidad: number,
  precioVenta: number,
  tc: number = TC_DEFAULT
): number => {
  if (costo <= 0 || cantidad <= 0) return costo;

  const costoPorUnidad = costo / cantidad;
  const precioPorUnidad = precioVenta / cantidad;
  const ratioCosteVenta = costoPorUnidad / precioPorUnidad;

  // Si el ratio es menor a 0.15 (15%), el costo está en USD
  if (ratioCosteVenta < 0.15) {
    return costo * tc;
  }
  return costo;
};

export const VentaCard: React.FC<VentaCardProps> = ({
  venta,
  rentabilidadData,
  onConfirmar,
  onAsignarInventario,
  onMarcarEntregada,
  onCancelar,
  onRegistrarPago,
  onEliminarPago,
  onAgregarGastos,
  onProgramarEntrega,
  onEntregaCompletada
}) => {
  const [documentosRelacionados, setDocumentosRelacionados] = useState<{
    requerimientos: Requerimiento[];
    ordenesCompra: OrdenCompra[];
    loading: boolean;
  }>({ requerimientos: [], ordenesCompra: [], loading: true });
  const [gastosDirectosVenta, setGastosDirectosVenta] = useState<number>(0);

  // Siempre ejecutar el hook para tener acceso a datos globales (GA/GO totales)
  const ventasArray = useMemo(() => [venta], [venta]);
  const { datos: datosRentabilidad, getRentabilidadVenta, loading: loadingRentabilidad } = useRentabilidadVentas(ventasArray);

  // Usar datos del padre si están disponibles, sino usar los calculados internamente
  const rentabilidadProporcional = rentabilidadData !== undefined
    ? rentabilidadData
    : getRentabilidadVenta(venta.id);

  // Cargar documentos relacionados (requerimientos y OCs)
  useEffect(() => {
    const cargarDocumentosRelacionados = async () => {
      try {
        setDocumentosRelacionados(prev => ({ ...prev, loading: true }));

        // Buscar requerimientos asociados a esta venta
        const todosRequerimientos = await requerimientoService.getAll();
        const requerimientosVenta = todosRequerimientos.filter(
          r => r.ventaId === venta.id || r.cotizacionId === venta.cotizacionOrigenId
        );

        // Buscar órdenes de compra asociadas a los requerimientos
        let ordenesCompraVenta: OrdenCompra[] = [];
        if (requerimientosVenta.length > 0) {
          const todasOCs = await OrdenCompraService.getAll();
          const requerimientoIds = requerimientosVenta.map(r => r.id);
          ordenesCompraVenta = todasOCs.filter(
            oc => oc.requerimientoId && requerimientoIds.includes(oc.requerimientoId)
          );
        }

        setDocumentosRelacionados({
          requerimientos: requerimientosVenta,
          ordenesCompra: ordenesCompraVenta,
          loading: false
        });
      } catch (error) {
        console.error('Error cargando documentos relacionados:', error);
        setDocumentosRelacionados(prev => ({ ...prev, loading: false }));
      }
    };

    cargarDocumentosRelacionados();
  }, [venta.id, venta.cotizacionOrigenId]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Recalcular costos si están en USD (datos legacy)
  const costoTotalPENCorregido = venta.productos.reduce((sum, prod) => {
    if (!prod.costoTotalUnidades) return sum;
    return sum + convertirCostoSiEsUSD(
      prod.costoTotalUnidades,
      prod.cantidad,
      prod.subtotal
    );
  }, 0);

  const utilidadCorregida = venta.totalPEN - costoTotalPENCorregido;
  const margenCorregido = venta.totalPEN > 0
    ? (utilidadCorregida / venta.totalPEN) * 100
    : 0;

  // Cargar gastos directos de esta venta
  useEffect(() => {
    const cargarGastosDirectos = async () => {
      if (venta.estado === 'cotizacion' || venta.estado === 'cancelada') return;
      try {
        const gastosDirectos = await gastoService.getGastosVenta(venta.id);
        const total = gastosDirectos.reduce((sum, g) => sum + g.montoPEN, 0);
        setGastosDirectosVenta(total);
      } catch (error) {
        console.error('Error cargando gastos directos:', error);
      }
    };
    cargarGastosDirectos();
  }, [venta.id, venta.estado]);

  const estadoInfo = estadoLabels[venta.estado];

  // Generar pasos del timeline
  const timelineSteps: TimelineStep[] = useMemo(() => {
    const estadoIndex: Record<string, number> = {
      'cotizacion': 0,
      'confirmada': 1,
      'asignada': 2,
      'en_entrega': 3,
      'entregada': 4,
      'cancelada': -1
    };

    const currentIndex = estadoIndex[venta.estado] ?? 0;
    const isCancelled = venta.estado === 'cancelada';

    return [
      {
        id: 'cotizacion',
        label: 'Cotización',
        date: venta.fechaCreacion,
        status: isCancelled ? 'skipped' : currentIndex >= 0 ? 'completed' : 'pending'
      },
      {
        id: 'confirmada',
        label: 'Confirmada',
        date: venta.fechaConfirmacion,
        status: isCancelled ? 'skipped' : currentIndex > 1 ? 'completed' : currentIndex === 1 ? 'current' : 'pending'
      },
      {
        id: 'asignada',
        label: 'Asignada',
        date: venta.fechaAsignacion,
        status: isCancelled ? 'skipped' : currentIndex > 2 ? 'completed' : currentIndex === 2 ? 'current' : 'pending'
      },
      {
        id: 'en_entrega',
        label: 'En Entrega',
        status: isCancelled ? 'skipped' : currentIndex > 3 ? 'completed' : currentIndex === 3 ? 'current' : 'pending'
      },
      {
        id: 'entregada',
        label: 'Entregada',
        date: venta.fechaEntrega,
        status: isCancelled ? 'skipped' : currentIndex === 4 ? 'completed' : 'pending'
      }
    ];
  }, [venta]);

  // Determinar la siguiente acción basada en el estado
  const nextAction: NextAction | undefined = useMemo(() => {
    if (venta.estado === 'cancelada' || venta.estado === 'entregada') return undefined;

    const actions: Record<string, NextAction> = {
      cotizacion: {
        label: 'Confirmar Venta',
        description: 'Confirma la cotización para continuar con el proceso',
        buttonText: onConfirmar ? 'Confirmar' : undefined,
        onClick: onConfirmar,
        variant: 'primary'
      },
      confirmada: {
        label: 'Asignar Inventario',
        description: 'Asigna unidades del inventario usando FEFO',
        buttonText: onAsignarInventario ? 'Asignar' : undefined,
        onClick: onAsignarInventario,
        variant: 'primary'
      },
      asignada: {
        label: 'Programar Entrega',
        description: 'Programa la entrega con transportista y fecha',
        buttonText: onProgramarEntrega ? 'Programar' : undefined,
        onClick: onProgramarEntrega,
        variant: 'warning'
      },
      en_entrega: {
        label: 'Confirmar Entrega',
        description: 'Confirma que el cliente recibió el pedido',
        buttonText: onMarcarEntregada ? 'Entregado' : undefined,
        onClick: onMarcarEntregada,
        variant: 'success'
      }
    };

    return actions[venta.estado];
  }, [venta.estado, onConfirmar, onAsignarInventario, onProgramarEntrega, onMarcarEntregada]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <ShoppingCart className="h-8 w-8 text-primary-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{venta.numeroVenta}</h2>
              <p className="text-sm text-gray-600">{venta.nombreCliente}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {venta.estado !== 'cotizacion' && venta.estado !== 'cancelada' && venta.estadoPago && (
            <Badge variant={estadoPagoLabels[venta.estadoPago].variant} size="lg">
              {estadoPagoLabels[venta.estadoPago].label}
            </Badge>
          )}
          <Badge variant={estadoInfo.variant} size="lg">
            {estadoInfo.label}
          </Badge>
        </div>
      </div>

      {/* Timeline de Estado */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <StatusTimeline
          steps={timelineSteps}
          nextAction={nextAction}
          orientation="horizontal"
          showDates={true}
          compact={false}
        />
      </div>

      {/* Trazabilidad - Documentos Relacionados */}
      {(venta.numeroCotizacionOrigen || documentosRelacionados.requerimientos.length > 0 || documentosRelacionados.ordenesCompra.length > 0) && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-200">
          <div className="flex items-center mb-3">
            <Link2 className="h-5 w-5 text-indigo-600 mr-2" />
            <h4 className="font-semibold text-gray-900">Trazabilidad</h4>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Cotización Origen */}
            {venta.numeroCotizacionOrigen && (
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-indigo-200 shadow-sm">
                <FileText className="h-4 w-4 text-indigo-500" />
                <div>
                  <span className="text-xs text-gray-500 block">Origen</span>
                  <span className="text-sm font-medium text-indigo-700">{venta.numeroCotizacionOrigen}</span>
                </div>
              </div>
            )}

            {/* Requerimientos */}
            {documentosRelacionados.loading ? (
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200">
                <span className="text-xs text-gray-500">Cargando...</span>
              </div>
            ) : (
              <>
                {documentosRelacionados.requerimientos.map(req => (
                  <div key={req.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-amber-200 shadow-sm">
                    <ClipboardList className="h-4 w-4 text-amber-500" />
                    <div>
                      <span className="text-xs text-gray-500 block">Requerimiento</span>
                      <span className="text-sm font-medium text-amber-700">{req.numeroRequerimiento}</span>
                    </div>
                  </div>
                ))}

                {/* Órdenes de Compra */}
                {documentosRelacionados.ordenesCompra.map(oc => (
                  <div key={oc.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-emerald-200 shadow-sm">
                    <Package className="h-4 w-4 text-emerald-500" />
                    <div>
                      <span className="text-xs text-gray-500 block">Orden Compra</span>
                      <span className="text-sm font-medium text-emerald-700">{oc.numeroOrden}</span>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Mensaje si no hay documentos relacionados */}
            {!documentosRelacionados.loading &&
             !venta.numeroCotizacionOrigen &&
             documentosRelacionados.requerimientos.length === 0 &&
             documentosRelacionados.ordenesCompra.length === 0 && (
              <span className="text-sm text-gray-500 italic">Sin documentos relacionados</span>
            )}
          </div>
        </div>
      )}

      {/* Información del Cliente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <User className="h-5 w-5 text-gray-600 mr-2" />
            <h4 className="font-semibold text-gray-900">Cliente</h4>
          </div>
          <div className="space-y-1 text-sm">
            <div><span className="text-gray-600">Nombre:</span> <span className="text-gray-900 ml-2">{venta.nombreCliente}</span></div>
            {venta.dniRuc && <div><span className="text-gray-600">DNI/RUC:</span> <span className="text-gray-900 ml-2">{venta.dniRuc}</span></div>}
            {venta.emailCliente && <div><span className="text-gray-600">Email:</span> <span className="text-gray-900 ml-2">{venta.emailCliente}</span></div>}
            {venta.telefonoCliente && <div><span className="text-gray-600">Teléfono:</span> <span className="text-gray-900 ml-2">{venta.telefonoCliente}</span></div>}
            {venta.direccionEntrega && <div><span className="text-gray-600">Dirección:</span> <span className="text-gray-900 ml-2">{venta.direccionEntrega}</span></div>}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Calendar className="h-5 w-5 text-gray-600 mr-2" />
            <h4 className="font-semibold text-gray-900">Fechas</h4>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Creación:</span>
              <span className="text-gray-900">{formatDate(venta.fechaCreacion)}</span>
            </div>
            {venta.fechaConfirmacion && (
              <div className="flex justify-between">
                <span className="text-gray-600">Confirmación:</span>
                <span className="text-gray-900">{formatDate(venta.fechaConfirmacion)}</span>
              </div>
            )}
            {venta.fechaAsignacion && (
              <div className="flex justify-between">
                <span className="text-gray-600">Asignación:</span>
                <span className="text-gray-900">{formatDate(venta.fechaAsignacion)}</span>
              </div>
            )}
            {venta.fechaEntrega && (
              <div className="flex justify-between">
                <span className="text-gray-600">Entrega:</span>
                <span className="text-gray-900">{formatDate(venta.fechaEntrega)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Totales y Rentabilidad */}
      <div className="bg-primary-50 p-4 rounded-lg">
        <div className="flex items-center mb-2">
          <DollarSign className="h-5 w-5 text-primary-600 mr-2" />
          <h4 className="font-semibold text-gray-900">Totales</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">S/ {venta.subtotalPEN.toFixed(2)}</span>
            </div>
            {venta.descuento && venta.descuento > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Descuento:</span>
                <span className="text-danger-600">- S/ {venta.descuento.toFixed(2)}</span>
              </div>
            )}
            {venta.costoEnvio && venta.costoEnvio > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Envío {venta.incluyeEnvio ? '(gratis)' : '(cobrado)'}:
                </span>
                <span className={venta.incluyeEnvio ? 'text-gray-400 line-through' : 'text-gray-900'}>
                  {venta.incluyeEnvio ? '' : '+ '}S/ {venta.costoEnvio.toFixed(2)}
                </span>
              </div>
            )}
            <div className="border-t border-primary-200 pt-2">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Total:</span>
                <span className="text-xl font-bold text-primary-600">S/ {venta.totalPEN.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          {venta.utilidadBrutaPEN !== undefined && (
            <div className="space-y-2 border-l border-primary-200 pl-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Costo Total:</span>
                <span className="font-semibold">S/ {costoTotalPENCorregido.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Utilidad Bruta:</span>
                <span className={`font-semibold ${utilidadCorregida >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  S/ {utilidadCorregida.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Margen:</span>
                <div className="flex items-center">
                  <TrendingUp className={`h-4 w-4 mr-1 ${margenCorregido >= 0 ? 'text-success-500' : 'text-danger-500'}`} />
                  <span className={`text-lg font-bold ${margenCorregido >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {margenCorregido.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rentabilidad Neta con Distribución Proporcional - Solo si hay datos calculados */}
      {rentabilidadProporcional && venta.estado !== 'cotizacion' && venta.estado !== 'cancelada' && (
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Calculator className="h-5 w-5 text-orange-600 mr-2" />
              <h4 className="font-semibold text-gray-900">Rentabilidad Neta</h4>
              <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                Distribución Proporcional
              </span>
            </div>
            {onAgregarGastos && (
              <Button size="sm" variant="outline" onClick={onAgregarGastos}>
                <Receipt className="h-4 w-4 mr-1" />
                Agregar Gastos
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Columna izquierda: Flujo de Cálculo */}
            <div className="space-y-2">
              {/* Paso 1: Precio de Venta */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 font-medium">1. Precio de Venta:</span>
                <span className="font-semibold text-gray-900">
                  S/ {venta.totalPEN.toFixed(2)}
                </span>
              </div>

              {/* Paso 2: Costo Base */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">2. (-) Costo Base:</span>
                <span className="font-medium text-gray-700">
                  - S/ {rentabilidadProporcional.costoBase.toFixed(2)}
                </span>
              </div>

              {/* Paso 3: GV (Gastos de Venta) */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  3. (-) GV:
                  <span className="text-xs text-purple-500 ml-1">(comisiones, pasarelas)</span>
                </span>
                <span className="font-medium text-purple-600">
                  - S/ {rentabilidadProporcional.gastosGV.toFixed(2)}
                </span>
              </div>

              {/* Paso 4: GD (Gastos de Distribución) */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  4. (-) GD:
                  <span className="text-xs text-blue-500 ml-1">(delivery - Transportistas)</span>
                </span>
                <span className="font-medium text-blue-600">
                  - S/ {rentabilidadProporcional.gastosGD.toFixed(2)}
                </span>
              </div>

              {/* Resultado: Utilidad Bruta */}
              <div className="flex justify-between text-sm bg-blue-50 p-2 rounded border border-blue-200">
                <span className="text-blue-800 font-medium">= Utilidad Bruta:</span>
                <span className={`font-semibold ${rentabilidadProporcional.utilidadBruta >= 0 ? 'text-blue-700' : 'text-danger-600'}`}>
                  S/ {rentabilidadProporcional.utilidadBruta.toFixed(2)}
                  <span className="text-xs ml-1">({rentabilidadProporcional.margenBruto.toFixed(1)}%)</span>
                </span>
              </div>

              {/* Paso 5: GA/GO */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  5. (-) GA/GO:
                  <span className="text-xs text-orange-500 ml-1">
                    ({((rentabilidadProporcional.costoBase / (datosRentabilidad?.baseCostoTotal || 1)) * 100).toFixed(1)}% prorrateo)
                  </span>
                </span>
                <span className="font-medium text-orange-600">
                  - S/ {rentabilidadProporcional.costoGAGO.toFixed(2)}
                </span>
              </div>

              {/* Resultado Final: Utilidad Neta */}
              <div className="border-t border-orange-300 pt-2 mt-2">
                <div className="flex justify-between bg-gradient-to-r from-green-50 to-emerald-50 p-2 rounded border border-green-200">
                  <span className="font-semibold text-gray-900">= Utilidad Neta:</span>
                  <span className={`text-lg font-bold ${rentabilidadProporcional.utilidadNeta >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    S/ {rentabilidadProporcional.utilidadNeta.toFixed(2)}
                    <span className="text-sm ml-1">({rentabilidadProporcional.margenNeto.toFixed(1)}%)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Columna derecha: Resumen de Costos */}
            <div className="space-y-3">
              {/* Costo Total */}
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <h5 className="text-xs font-medium text-gray-500 mb-2">Costo Total (CTRU)</h5>
                <div className="text-xl font-bold text-gray-900">
                  S/ {rentabilidadProporcional.costoTotal.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <div>Base: S/ {rentabilidadProporcional.costoBase.toFixed(2)}</div>
                  <div className="flex gap-2">
                    <span className="text-purple-600">GV: S/ {rentabilidadProporcional.gastosGV.toFixed(2)}</span>
                    <span className="text-blue-600">GD: S/ {rentabilidadProporcional.gastosGD.toFixed(2)}</span>
                  </div>
                  <div className="text-orange-600">GA/GO: S/ {rentabilidadProporcional.costoGAGO.toFixed(2)}</div>
                </div>
              </div>

              {/* Info global de GA/GO */}
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                <h5 className="text-xs font-medium text-orange-700 mb-2">GA/GO Global</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total GA/GO:</span>
                    <span className="font-medium">S/ {datosRentabilidad?.totalGastosGAGO.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Costo Total:</span>
                    <span className="font-medium">S/ {datosRentabilidad?.baseCostoTotal.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2 italic">
                  Prorrateado por % de costo base
                </p>
              </div>
            </div>
          </div>

          {/* Desglose por Producto */}
          {rentabilidadProporcional.desgloseProductos && rentabilidadProporcional.desgloseProductos.length > 0 && (
            <div className="mt-4 pt-4 border-t border-orange-200">
              <div className="flex items-center mb-3">
                <PieChart className="h-4 w-4 text-orange-600 mr-2" />
                <h5 className="text-sm font-medium text-gray-900">Desglose de Costos por Producto</h5>
              </div>
              <div className="bg-white rounded-lg border border-orange-200 overflow-hidden">
                <table className="min-w-full divide-y divide-orange-100">
                  <thead className="bg-orange-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Producto</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Venta</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Costo Base</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                        <span className="text-purple-600">GV</span>+<span className="text-blue-600">GD</span>
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-orange-600">GA/GO</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Costo Total</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">U. Neta</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Margen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-50">
                    {rentabilidadProporcional.desgloseProductos.map((prod, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">
                          <div className="text-sm font-medium text-gray-900">{prod.nombre}</div>
                          <div className="text-xs text-gray-500">{prod.cantidad} unidad(es)</div>
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-gray-900">
                          S/ {prod.precioVenta.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-gray-900">
                          S/ {prod.costoBase.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-indigo-600">
                          S/ {prod.costoGVGD.toFixed(2)}
                          <div className="text-xs text-gray-400">({prod.proporcionVenta.toFixed(1)}%)</div>
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-orange-600">
                          S/ {prod.costoGAGO.toFixed(2)}
                          <div className="text-xs text-gray-400">({prod.proporcionCosto.toFixed(1)}%)</div>
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                          S/ {prod.costoTotal.toFixed(2)}
                        </td>
                        <td className={`px-3 py-2 text-right text-sm font-medium ${prod.utilidadNeta >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                          S/ {prod.utilidadNeta.toFixed(2)}
                        </td>
                        <td className={`px-3 py-2 text-right text-sm font-medium ${prod.margenNeto >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                          {prod.margenNeto.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gastos Directos - Para ventas confirmadas sin rentabilidad calculada aún */}
      {!rentabilidadProporcional && onAgregarGastos && venta.estado !== 'cotizacion' && venta.estado !== 'cancelada' && (
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Receipt className="h-5 w-5 text-purple-600 mr-2" />
              <div>
                <h4 className="font-semibold text-gray-900">Gastos de Venta</h4>
                <p className="text-xs text-gray-500">Registra comisiones, delivery y otros gastos directos</p>
              </div>
            </div>
            <Button size="sm" variant="primary" onClick={onAgregarGastos}>
              <Receipt className="h-4 w-4 mr-1" />
              Agregar Gastos
            </Button>
          </div>
        </div>
      )}

      {/* Entregas - Solo para ventas asignadas o posteriores */}
      {(venta.estado === 'asignada' || venta.estado === 'en_entrega' || venta.estado === 'entregada' || venta.estado === 'entrega_parcial') && (
        <div className="bg-indigo-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Truck className="h-5 w-5 text-indigo-600 mr-2" />
              <h4 className="font-semibold text-gray-900">Entregas</h4>
            </div>
            {onProgramarEntrega && venta.estado !== 'entregada' && (
              <Button size="sm" variant="primary" onClick={onProgramarEntrega}>
                <MapPin className="h-4 w-4 mr-1" />
                Programar Entrega
              </Button>
            )}
          </div>
          <EntregasVenta ventaId={venta.id} venta={venta} onEntregaCompletada={onEntregaCompletada} />
        </div>
      )}

      {/* Estado de Pago - Solo para ventas confirmadas y no canceladas */}
      {venta.estado !== 'cotizacion' && venta.estado !== 'cancelada' && (
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <CreditCard className="h-5 w-5 text-green-600 mr-2" />
              <h4 className="font-semibold text-gray-900">Estado de Pago</h4>
            </div>
            {venta.estadoPago !== 'pagado' && onRegistrarPago && (
              <Button size="sm" variant="success" onClick={onRegistrarPago}>
                <CreditCard className="h-4 w-4 mr-1" />
                Registrar Pago
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white p-3 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Total Venta</div>
              <div className="text-lg font-bold text-gray-900">S/ {venta.totalPEN.toFixed(2)}</div>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Cobrado</div>
              <div className="text-lg font-bold text-success-600">S/ {(venta.montoPagado || 0).toFixed(2)}</div>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Pendiente</div>
              <div className={`text-lg font-bold ${(venta.montoPendiente || 0) > 0 ? 'text-danger-600' : 'text-success-600'}`}>
                S/ {(venta.montoPendiente || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Historial de pagos */}
          {venta.pagos && venta.pagos.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Historial de Pagos</h5>
              <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
                <table className="min-w-full divide-y divide-green-200">
                  <thead className="bg-green-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Fecha</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Método</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Referencia</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Monto</th>
                      {onEliminarPago && venta.estado !== 'entregada' && (
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Acción</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-100">
                    {venta.pagos.map((pago) => (
                      <tr key={pago.id}>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {formatDate(pago.fecha)}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {metodoPagoLabels[pago.metodoPago] || pago.metodoPago}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {pago.referencia || '-'}
                        </td>
                        <td className="px-3 py-2 text-sm font-semibold text-success-600 text-right">
                          S/ {pago.monto.toFixed(2)}
                        </td>
                        {onEliminarPago && venta.estado !== 'entregada' && (
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => onEliminarPago(pago.id)}
                              className="text-danger-500 hover:text-danger-700 p-1"
                              title="Eliminar pago"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fecha de pago completo */}
          {venta.fechaPagoCompleto && (
            <div className="mt-3 text-sm text-success-600">
              Pago completado el {formatDate(venta.fechaPagoCompleto)}
            </div>
          )}
        </div>
      )}

      {/* Productos */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Productos ({venta.productos.length})</h4>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Cant.</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Precio</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Subtotal</th>
                {venta.estado !== 'cotizacion' && venta.estado !== 'confirmada' && (
                  <>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Costo</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Margen</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {venta.productos.map((producto, index) => {
                // Convertir costo si está en USD (datos legacy)
                const costoCorregido = producto.costoTotalUnidades
                  ? convertirCostoSiEsUSD(producto.costoTotalUnidades, producto.cantidad, producto.subtotal)
                  : 0;
                const utilidadProducto = producto.subtotal - costoCorregido;
                const margenProductoCorregido = producto.subtotal > 0
                  ? (utilidadProducto / producto.subtotal) * 100
                  : 0;

                return (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{producto.marca} {producto.nombreComercial}</div>
                      <div className="text-xs text-gray-500">{producto.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">{producto.cantidad}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">S/ {producto.precioUnitario.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">S/ {producto.subtotal.toFixed(2)}</td>
                    {venta.estado !== 'cotizacion' && venta.estado !== 'confirmada' && (
                      <>
                        <td className="px-4 py-3 text-right text-sm text-gray-900">
                          {producto.costoTotalUnidades ? `S/ ${costoCorregido.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          {producto.costoTotalUnidades ? (
                            <span className={margenProductoCorregido >= 0 ? 'text-success-600' : 'text-danger-600'}>
                              {margenProductoCorregido.toFixed(1)}%
                            </span>
                          ) : '-'}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Observaciones */}
      {venta.observaciones && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-2">Observaciones</h4>
          <p className="text-sm text-gray-700">{venta.observaciones}</p>
        </div>
      )}

      {/* Acciones */}
      {venta.estado !== 'entregada' && venta.estado !== 'cancelada' && (
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center space-x-3">
            {venta.estado === 'cotizacion' && onConfirmar && (
              <Button variant="primary" onClick={onConfirmar}>
                Confirmar Venta
              </Button>
            )}
            
            {venta.estado === 'confirmada' && onAsignarInventario && (
              <Button variant="primary" onClick={onAsignarInventario}>
                <Package className="h-4 w-4 mr-2" />
                Asignar Inventario (FEFO)
              </Button>
            )}
            
            {venta.estado === 'asignada' && onProgramarEntrega && (
              <Button variant="primary" onClick={onProgramarEntrega}>
                <Truck className="h-4 w-4 mr-2" />
                Programar Entrega
              </Button>
            )}
            
            {venta.estado === 'en_entrega' && onMarcarEntregada && (
              <Button variant="success" onClick={onMarcarEntregada}>
                Marcar como Entregada
              </Button>
            )}
          </div>
          
          {onCancelar && (
            <Button variant="danger" onClick={onCancelar}>
              Cancelar Venta
            </Button>
          )}
        </div>
      )}
    </div>
  );
};