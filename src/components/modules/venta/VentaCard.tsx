import React, { useEffect, useState } from 'react';
import { ShoppingCart, User, Calendar, DollarSign, TrendingUp, Package, Truck, CreditCard, Trash2, Calculator, Clock, AlertTriangle, CheckCircle, Lock, FileText, ExternalLink } from 'lucide-react';
import { Badge, Button } from '../../common';
import type { Venta, EstadoVenta, EstadoPago, TipoReserva } from '../../../types/venta.types';
import { gastoService } from '../../../services/gasto.service';
import { VentaService } from '../../../services/venta.service';

interface VentaCardProps {
  venta: Venta;
  onConfirmar?: () => void;
  onAsignarInventario?: () => void;
  onMarcarEnEntrega?: () => void;
  onMarcarEntregada?: () => void;
  onCancelar?: () => void;
  onRegistrarPago?: () => void;
  onEliminarPago?: (pagoId: string) => void;
  onRegistrarAdelanto?: () => void;  // Nueva acción para reservar stock
}

interface DatosRentabilidadNeta {
  gastosOperativosMes: number;
  unidadesVendidasMes: number;
  cargaOperativaPorUnidad: number;
  cantidadUnidadesVenta: number;
  cargaOperativaVenta: number;
  utilidadNeta: number;
  margenNeto: number;
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

const tipoReservaLabels: Record<TipoReserva, { label: string; variant: 'success' | 'warning'; icon: string }> = {
  fisica: { label: 'Reserva Física', variant: 'success', icon: '✓' },
  virtual: { label: 'Reserva Virtual', variant: 'warning', icon: '⏳' }
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
  onConfirmar,
  onAsignarInventario,
  onMarcarEnEntrega,
  onMarcarEntregada,
  onCancelar,
  onRegistrarPago,
  onEliminarPago,
  onRegistrarAdelanto
}) => {
  const [rentabilidadNeta, setRentabilidadNeta] = useState<DatosRentabilidadNeta | null>(null);

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

  // Calcular rentabilidad neta (con carga operativa)
  useEffect(() => {
    const calcularRentabilidadNeta = async () => {
      // Solo calcular si la venta tiene unidades asignadas
      if (venta.estado === 'cotizacion' || venta.estado === 'confirmada' || !venta.utilidadBrutaPEN) {
        return;
      }

      try {
        // Obtener gastos prorrateables del mes
        const todosLosGastos = await gastoService.getAll();
        const gastosProrrateables = todosLosGastos.filter(g => g.esProrrateable);
        const gastosOperativosMes = gastosProrrateables.reduce((sum, g) => sum + g.montoPEN, 0);

        // Obtener unidades vendidas del mes
        const ventas = await VentaService.getAll();
        const ahora = new Date();
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

        const ventasMes = ventas.filter(v => {
          if (v.estado === 'cancelada' || v.estado === 'cotizacion') return false;
          const fechaVenta = v.fechaCreacion?.toDate?.() ?? new Date();
          return fechaVenta >= inicioMes;
        });

        const unidadesVendidasMes = ventasMes.reduce((sum, v) => {
          return sum + v.productos.reduce((s, p) => s + p.cantidad, 0);
        }, 0);

        // Calcular carga operativa
        const cargaOperativaPorUnidad = unidadesVendidasMes > 0
          ? gastosOperativosMes / unidadesVendidasMes
          : 0;

        // Cantidad de unidades en esta venta
        const cantidadUnidadesVenta = venta.productos.reduce((sum, p) => sum + p.cantidad, 0);
        const cargaOperativaVenta = cargaOperativaPorUnidad * cantidadUnidadesVenta;

        // Utilidad y margen neto
        const utilidadNeta = utilidadCorregida - cargaOperativaVenta;
        const margenNeto = venta.totalPEN > 0 ? (utilidadNeta / venta.totalPEN) * 100 : 0;

        setRentabilidadNeta({
          gastosOperativosMes,
          unidadesVendidasMes,
          cargaOperativaPorUnidad,
          cantidadUnidadesVenta,
          cargaOperativaVenta,
          utilidadNeta,
          margenNeto
        });
      } catch (error) {
        console.error('Error calculando rentabilidad neta:', error);
      }
    };

    calcularRentabilidadNeta();
  }, [venta, utilidadCorregida]);

  const estadoInfo = estadoLabels[venta.estado];

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
              {venta.numeroCotizacionOrigen && (
                <a
                  href={`/cotizaciones?id=${venta.cotizacionOrigenId}`}
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 mt-1"
                >
                  <FileText className="h-3 w-3" />
                  Desde {venta.numeroCotizacionOrigen}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Badge de tipo de reserva */}
          {venta.estado === 'reservada' && venta.stockReservado && (
            <Badge
              variant={tipoReservaLabels[venta.stockReservado.tipoReserva].variant}
              size="lg"
            >
              {tipoReservaLabels[venta.stockReservado.tipoReserva].icon}{' '}
              {tipoReservaLabels[venta.stockReservado.tipoReserva].label}
            </Badge>
          )}
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

      {/* Información de Reserva - Solo si hay reserva activa */}
      {venta.estado === 'reservada' && venta.stockReservado && (
        <div className={`p-4 rounded-lg border-2 ${
          venta.stockReservado.tipoReserva === 'fisica'
            ? 'bg-green-50 border-green-300'
            : 'bg-orange-50 border-orange-300'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              {venta.stockReservado.tipoReserva === 'fisica' ? (
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-orange-600 mr-2" />
              )}
              <h4 className="font-semibold text-gray-900">
                {venta.stockReservado.tipoReserva === 'fisica'
                  ? 'Stock Reservado Físicamente'
                  : 'Reserva Virtual - Requiere Stock'}
              </h4>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="h-4 w-4 mr-1" />
              <span>
                Vigente hasta:{' '}
                {venta.stockReservado.vigenciaHasta?.toDate?.()?.toLocaleString('es-PE', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                }) || '-'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Productos Reservados */}
            <div className="bg-white p-3 rounded-lg">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Productos Reservados</h5>
              <div className="space-y-1">
                {venta.stockReservado.productosReservados.map((prod, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-600">{prod.sku}</span>
                    <span className={`font-medium ${
                      prod.unidadesReservadas.length > 0 ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      {prod.unidadesReservadas.length > 0
                        ? `${prod.unidadesReservadas.length} uds físicas`
                        : `${prod.cantidad} uds virtuales`
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Información del Adelanto */}
            <div className="bg-white p-3 rounded-lg">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Adelanto Recibido</h5>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Monto:</span>
                  <span className="font-bold text-green-600">
                    S/ {venta.stockReservado.montoAdelanto.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Vigencia Original:</span>
                  <span className="font-medium">
                    {venta.stockReservado.horasVigenciaOriginal}h
                  </span>
                </div>
                {venta.stockReservado.extensiones && venta.stockReservado.extensiones.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Extensiones:</span>
                    <span className="font-medium text-blue-600">
                      {venta.stockReservado.extensiones.length} de 3
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Productos con Faltante - Solo para reserva virtual */}
          {venta.stockReservado.tipoReserva === 'virtual' && venta.productosConFaltante && (
            <div className="mt-3 p-3 bg-orange-100 rounded-lg">
              <h5 className="text-sm font-medium text-orange-800 mb-2 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Productos Pendientes de Stock
              </h5>
              <div className="space-y-1">
                {venta.productosConFaltante.map((prod, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-orange-700">{prod.nombre}</span>
                    <span className="font-medium text-orange-800">
                      Disponibles: {prod.disponibles} / Solicitados: {prod.solicitados}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-orange-600">
                Recibirás una notificación cuando llegue el stock necesario.
              </p>
            </div>
          )}
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

      {/* Rentabilidad Neta - Solo si hay datos calculados */}
      {rentabilidadNeta && (
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center mb-3">
            <Calculator className="h-5 w-5 text-orange-600 mr-2" />
            <h4 className="font-semibold text-gray-900">Rentabilidad Neta</h4>
            <span className="ml-2 text-xs text-gray-500">(incluye gastos operativos)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Columna izquierda: Desglose */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Utilidad Bruta:</span>
                <span className={`font-medium ${utilidadCorregida >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  S/ {utilidadCorregida.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Carga Operativa ({rentabilidadNeta.cantidadUnidadesVenta} uds):</span>
                <span className="font-medium text-orange-600">
                  - S/ {rentabilidadNeta.cargaOperativaVenta.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-orange-200 pt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-900">Utilidad Neta:</span>
                  <span className={`text-lg font-bold ${rentabilidadNeta.utilidadNeta >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    S/ {rentabilidadNeta.utilidadNeta.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-gray-600">Margen Neto:</span>
                  <span className={`text-lg font-bold ${rentabilidadNeta.margenNeto >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {rentabilidadNeta.margenNeto.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Columna derecha: Info del período */}
            <div className="bg-white p-3 rounded-lg border border-orange-200">
              <h5 className="text-xs font-medium text-gray-500 mb-2">Datos del Mes</h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Gastos Operativos:</span>
                  <span className="font-medium">S/ {rentabilidadNeta.gastosOperativosMes.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Unidades Vendidas:</span>
                  <span className="font-medium">{rentabilidadNeta.unidadesVendidasMes}</span>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-1">
                  <span className="text-gray-600">Carga por Unidad:</span>
                  <span className="font-medium text-orange-600">
                    S/ {rentabilidadNeta.cargaOperativaPorUnidad.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
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
            {venta.estado === 'cotizacion' && onRegistrarAdelanto && (
              <Button
                variant="ghost"
                onClick={onRegistrarAdelanto}
                className="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
              >
                <Lock className="h-4 w-4 mr-2" />
                Registrar Adelanto
              </Button>
            )}

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

            {venta.estado === 'reservada' && onAsignarInventario && (
              <Button variant="primary" onClick={onAsignarInventario}>
                <Package className="h-4 w-4 mr-2" />
                Asignar Stock Reservado
              </Button>
            )}

            {venta.estado === 'asignada' && onMarcarEnEntrega && (
              <Button variant="primary" onClick={onMarcarEnEntrega}>
                <Truck className="h-4 w-4 mr-2" />
                Marcar en Entrega
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