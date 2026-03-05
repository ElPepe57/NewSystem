import React, { useState, useEffect } from 'react';
import {
  Truck,
  Calendar,
  Package,
  DollarSign,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { Button, Modal, Input, Badge } from '../../common';
import { GoogleMapsAddressInput, type AddressData } from '../../common/GoogleMapsAddressInput';
import { useTransportistaStore } from '../../../store/transportistaStore';
import { entregaService } from '../../../services/entrega.service';
import type { Venta, ProductoVenta, MetodoPago } from '../../../types/venta.types';
import type { Transportista } from '../../../types/transportista.types';
import type { ProgramarEntregaData, Entrega } from '../../../types/entrega.types';

interface ProgramarEntregaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProgramarEntregaData) => Promise<void>;
  venta: Venta;
  loading?: boolean;
}

interface ProductoSeleccionado {
  productoId: string;
  cantidad: number;
  maxDisponible: number;
  unidadesAsignadas: string[];
  seleccionado: boolean;
}

const metodoPagoOptions: Array<{ value: MetodoPago; label: string }> = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'transferencia', label: 'Transferencia' }
];

const courierLabels: Record<string, string> = {
  olva: 'Olva',
  mercado_envios: 'M. Envios',
  urbano: 'Urbano',
  shalom: 'Shalom',
  otro: 'Otro'
};

export const ProgramarEntregaModal: React.FC<ProgramarEntregaModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  venta,
  loading = false
}) => {
  const { transportistasActivos, fetchActivos } = useTransportistaStore();

  // Estado del formulario
  const [transportistaId, setTransportistaId] = useState('');
  const [addressData, setAddressData] = useState<AddressData>({
    direccion: venta.direccionEntrega || '',
    distrito: venta.distrito || '',
    provincia: venta.provincia || '',
    codigoPostal: venta.codigoPostal || '',
    referencia: venta.referencia || '',
    coordenadas: venta.coordenadas || null,
  });
  const [fechaProgramada, setFechaProgramada] = useState('');
  const [horaProgramada, setHoraProgramada] = useState('');
  const [cobroPendiente, setCobroPendiente] = useState(false);
  const [montoPorCobrar, setMontoPorCobrar] = useState(0);
  const [metodoPagoEsperado, setMetodoPagoEsperado] = useState<MetodoPago>('efectivo');
  const [costoTransportista, setCostoTransportista] = useState(0);
  const [observaciones, setObservaciones] = useState('');

  // Productos a entregar (para entregas parciales)
  const [productosSeleccionados, setProductosSeleccionados] = useState<ProductoSeleccionado[]>([]);

  // Entregas previas (para tracking parcial e inteligencia de cobro)
  const [entregasPrevias, setEntregasPrevias] = useState<Entrega[]>([]);
  const [loadingEntregas, setLoadingEntregas] = useState(false);

  // Cobros ya programados en entregas previas
  const [cobroYaProgramado, setCobroYaProgramado] = useState(0);

  // Cargar transportistas
  useEffect(() => {
    if (isOpen) {
      fetchActivos();
    }
  }, [isOpen, fetchActivos]);

  // Inicializar productos y cobro inteligente cuando se abre
  useEffect(() => {
    if (isOpen && venta) {
      const inicializar = async () => {
        setLoadingEntregas(true);
        try {
          // =============================================
          // ISSUE 1: Fetch entregas previas para calcular
          // cantidades realmente disponibles
          // =============================================
          const previas = await entregaService.getByVenta(venta.id);
          const noCancel = previas.filter(e => e.estado !== 'cancelada');
          setEntregasPrevias(noCancel);

          // Construir mapa: productoId -> { cantidadAsignada, unidadesUsadas }
          const asignadoMap: Record<string, { cantidad: number; unidades: Set<string> }> = {};
          for (const ent of noCancel) {
            for (const prod of ent.productos) {
              if (!asignadoMap[prod.productoId]) {
                asignadoMap[prod.productoId] = { cantidad: 0, unidades: new Set() };
              }
              asignadoMap[prod.productoId].cantidad += prod.cantidad;
              (prod.unidadesAsignadas || []).forEach(uid =>
                asignadoMap[prod.productoId].unidades.add(uid)
              );
            }
          }

          // Calcular productos con disponibilidad real
          const productos = venta.productos.map(p => {
            const previo = asignadoMap[p.productoId];
            const cantidadYaAsignada = previo?.cantidad || 0;
            const unidadesYaAsignadas = previo?.unidades || new Set<string>();
            const maxDisponible = Math.max(0, p.cantidad - cantidadYaAsignada);
            const unidadesRestantes = (p.unidadesAsignadas || []).filter(
              uid => !unidadesYaAsignadas.has(uid)
            );

            return {
              productoId: p.productoId,
              cantidad: Math.min(maxDisponible, maxDisponible), // default = max disponible
              maxDisponible,
              unidadesAsignadas: unidadesRestantes,
              seleccionado: maxDisponible > 0,
            };
          });

          setProductosSeleccionados(productos);

          // =============================================
          // ISSUE 4: Cobro en destino inteligente
          // =============================================
          const totalCobroYaProgramado = noCancel
            .filter(e => e.cobroPendiente && e.estado !== 'fallida')
            .reduce((sum, e) => sum + (e.montoPorCobrar || 0), 0);
          setCobroYaProgramado(totalCobroYaProgramado);

          if (venta.estadoPago === 'pagado') {
            // Cliente ya pago todo - no cobrar en destino
            setCobroPendiente(false);
            setMontoPorCobrar(0);
          } else {
            // Restar cobros ya programados para no cobrar doble
            const pendienteReal = Math.max(0, (venta.montoPendiente || 0) - totalCobroYaProgramado);
            setCobroPendiente(pendienteReal > 0);
            setMontoPorCobrar(pendienteReal);
          }
        } catch (error) {
          console.error('Error cargando entregas previas:', error);
          // Fallback: usar cantidades originales (comportamiento anterior)
          const productos = venta.productos.map(p => ({
            productoId: p.productoId,
            cantidad: p.cantidad,
            maxDisponible: p.cantidad,
            unidadesAsignadas: p.unidadesAsignadas || [],
            seleccionado: true,
          }));
          setProductosSeleccionados(productos);
          setEntregasPrevias([]);
          setCobroYaProgramado(0);
          setCobroPendiente(venta.montoPendiente > 0);
          setMontoPorCobrar(venta.montoPendiente || 0);
        } finally {
          setLoadingEntregas(false);
        }
      };

      inicializar();

      // Resetear campos del formulario
      const hoy = new Date();
      setFechaProgramada(hoy.toISOString().split('T')[0]);
      setTransportistaId('');
      setAddressData({
        direccion: venta.direccionEntrega || '',
        distrito: venta.distrito || '',
        provincia: venta.provincia || '',
        codigoPostal: venta.codigoPostal || '',
        referencia: venta.referencia || '',
        coordenadas: venta.coordenadas || null,
      });
      setHoraProgramada('');
      setMetodoPagoEsperado('efectivo');
      setCostoTransportista(0);
      setObservaciones('');
    }
  }, [isOpen, venta]);

  // =============================================
  // ISSUE 6: Actualizar costo con fallback inteligente
  // =============================================
  useEffect(() => {
    if (transportistaId) {
      const transportista = transportistasActivos.find(t => t.id === transportistaId);
      if (transportista) {
        const costo = transportista.costoFijo
          ?? transportista.costoPromedioPorEntrega
          ?? 0;
        setCostoTransportista(costo);
      }
    } else {
      setCostoTransportista(0);
    }
  }, [transportistaId, transportistasActivos]);

  const transportistaSeleccionado = transportistasActivos.find(t => t.id === transportistaId);

  const handleProductoToggle = (productoId: string) => {
    setProductosSeleccionados(prev =>
      prev.map(p =>
        p.productoId === productoId && p.maxDisponible > 0
          ? { ...p, seleccionado: !p.seleccionado }
          : p
      )
    );
  };

  const handleProductoCantidadChange = (productoId: string, cantidad: number) => {
    setProductosSeleccionados(prev =>
      prev.map(p =>
        p.productoId === productoId
          ? { ...p, cantidad: Math.min(Math.max(1, cantidad), p.maxDisponible) }
          : p
      )
    );
  };

  const productosParaEntregar = productosSeleccionados.filter(p => p.seleccionado && p.maxDisponible > 0);
  const hayProductos = productosParaEntregar.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transportistaId || !addressData.direccion || !fechaProgramada || !hayProductos) {
      return;
    }

    const data: ProgramarEntregaData = {
      ventaId: venta.id,
      transportistaId,
      productos: productosParaEntregar.map(p => ({
        productoId: p.productoId,
        cantidad: p.cantidad,
        unidadesAsignadas: p.unidadesAsignadas.slice(0, p.cantidad)
      })),
      direccionEntrega: addressData.direccion,
      distrito: addressData.distrito || undefined,
      provincia: addressData.provincia || undefined,
      codigoPostal: addressData.codigoPostal || undefined,
      referencia: addressData.referencia || undefined,
      coordenadas: addressData.coordenadas || undefined,
      fechaProgramada: (() => {
        const [y, m, d] = fechaProgramada.split('-').map(Number);
        return new Date(y, m - 1, d, 8, 0);
      })(),
      horaProgramada: horaProgramada || undefined,
      cobroPendiente,
      montoPorCobrar: cobroPendiente ? montoPorCobrar : undefined,
      metodoPagoEsperado: cobroPendiente ? metodoPagoEsperado : undefined,
      costoTransportista,
      observaciones: observaciones || undefined
    };

    await onSubmit(data);
  };

  // Obtener info del producto de la venta
  const getProductoVenta = (productoId: string): ProductoVenta | undefined => {
    return venta.productos.find(p => p.productoId === productoId);
  };

  // Calcular si todos los productos ya fueron entregados
  const todosEntregados = productosSeleccionados.every(p => p.maxDisponible <= 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Programar Entrega"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info de la venta */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Venta</p>
              <p className="font-semibold text-gray-900">{venta.numeroVenta}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Cliente</p>
              <p className="font-semibold text-gray-900">{venta.nombreCliente}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            {venta.telefonoCliente && (
              <p className="text-sm text-gray-600">
                Tel: {venta.telefonoCliente}
              </p>
            )}
            {/* Badge de estado de pago */}
            <Badge variant={
              venta.estadoPago === 'pagado' ? 'success' :
              venta.estadoPago === 'parcial' ? 'warning' : 'danger'
            }>
              {venta.estadoPago === 'pagado' ? 'Pagado' :
               venta.estadoPago === 'parcial' ? `Parcial (S/ ${(venta.montoPagado || 0).toFixed(2)})` :
               'Pendiente de pago'}
            </Badge>
          </div>
        </div>

        {/* Seleccion de Transportista */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Truck className="h-4 w-4 inline mr-2" />
            Transportista *
          </label>
          <select
            value={transportistaId}
            onChange={(e) => setTransportistaId(e.target.value)}
            required
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Seleccionar transportista...</option>
            <optgroup label="Internos (Lima)">
              {transportistasActivos
                .filter(t => t.tipo === 'interno')
                .map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} - S/ {(t.costoFijo ?? t.costoPromedioPorEntrega)?.toFixed(2) || '0.00'}
                    {t.tasaExito ? ` (${t.tasaExito.toFixed(0)}% exito)` : ''}
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

          {transportistaSeleccionado && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={transportistaSeleccionado.tipo === 'interno' ? 'info' : 'warning'}>
                {transportistaSeleccionado.tipo === 'interno' ? 'Interno' : 'Courier'}
              </Badge>
              {transportistaSeleccionado.totalEntregas && transportistaSeleccionado.totalEntregas > 0 && (
                <Badge variant={
                  (transportistaSeleccionado.tasaExito || 0) >= 90 ? 'success' :
                  (transportistaSeleccionado.tasaExito || 0) >= 70 ? 'warning' : 'danger'
                }>
                  {transportistaSeleccionado.tasaExito?.toFixed(0) || 0}% exito
                </Badge>
              )}
              {transportistaSeleccionado.telefono && (
                <span className="text-sm text-gray-500">
                  Tel: {transportistaSeleccionado.telefono}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Dirección con Google Maps */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <GoogleMapsAddressInput
            value={addressData}
            onChange={setAddressData}
            initialAddress={venta.direccionEntrega}
          />
        </div>

        {/* Fecha y hora */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Fecha de Entrega"
            type="date"
            value={fechaProgramada}
            onChange={(e) => setFechaProgramada(e.target.value)}
            required
            icon={<Calendar className="h-5 w-5 text-gray-400" />}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rango Horario
            </label>
            <select
              value={horaProgramada}
              onChange={(e) => setHoraProgramada(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Sin especificar</option>
              <option value="flexible">Flexible</option>
              <option value="09:00-13:00">Mañana (9am - 1pm)</option>
              <option value="14:00-20:00">Tarde (2pm - 8pm)</option>
            </select>
          </div>
        </div>

        {/* Productos a entregar (para parciales) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Package className="h-4 w-4 inline mr-2" />
            Productos a Entregar
          </label>

          {loadingEntregas ? (
            <div className="flex items-center justify-center py-4 text-gray-500">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600 mr-2"></div>
              Calculando disponibilidad...
            </div>
          ) : todosEntregados ? (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800 flex items-center font-medium">
                <CheckCircle className="h-4 w-4 mr-2" />
                Todos los productos ya tienen entregas programadas o completadas.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-10">
                        <input
                          type="checkbox"
                          checked={productosSeleccionados.filter(p => p.maxDisponible > 0).every(p => p.seleccionado)}
                          onChange={() => {
                            const disponibles = productosSeleccionados.filter(p => p.maxDisponible > 0);
                            const allSelected = disponibles.every(p => p.seleccionado);
                            setProductosSeleccionados(prev =>
                              prev.map(p => p.maxDisponible > 0
                                ? { ...p, seleccionado: !allSelected }
                                : p
                              )
                            );
                          }}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {productosSeleccionados.map((prod) => {
                      const productoVenta = getProductoVenta(prod.productoId);
                      if (!productoVenta) return null;

                      const yaEntregado = prod.maxDisponible <= 0;

                      return (
                        <tr
                          key={prod.productoId}
                          className={
                            yaEntregado ? 'bg-gray-50 opacity-60' :
                            prod.seleccionado ? 'bg-green-50' : ''
                          }
                        >
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={prod.seleccionado}
                              onChange={() => handleProductoToggle(prod.productoId)}
                              disabled={yaEntregado}
                              className="rounded border-gray-300 disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <div className="text-sm font-medium text-gray-900">
                              {productoVenta.marca} {productoVenta.nombreComercial}
                            </div>
                            <div className="text-xs text-gray-500">
                              {productoVenta.sku}
                              {yaEntregado && (
                                <Badge variant="success" className="ml-2 text-[10px]">
                                  Ya entregado
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            {yaEntregado ? (
                              <div className="text-center text-xs text-gray-400">
                                {productoVenta.cantidad}/{productoVenta.cantidad}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                <input
                                  type="number"
                                  value={prod.cantidad}
                                  onChange={(e) => handleProductoCantidadChange(prod.productoId, parseInt(e.target.value) || 1)}
                                  min={1}
                                  max={prod.maxDisponible}
                                  disabled={!prod.seleccionado}
                                  className="w-16 text-center rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
                                />
                                <span className="text-xs text-gray-500">/ {prod.maxDisponible}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Info de entregas previas */}
              {entregasPrevias.length > 0 && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 flex items-center">
                    <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                    {entregasPrevias.length} entrega(s) previa(s) programada(s). Cantidades restantes mostradas.
                  </p>
                </div>
              )}

              {!hayProductos && !todosEntregados && (
                <p className="mt-2 text-sm text-danger-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Selecciona al menos un producto para entregar
                </p>
              )}
            </>
          )}
        </div>

        {/* Cobro pendiente */}
        <div className="bg-amber-50 p-4 rounded-lg">
          {/* ISSUE 4: Badges de estado de pago */}
          {venta.estadoPago === 'pagado' && (
            <div className="flex items-center p-2 bg-green-100 rounded-lg border border-green-200 mb-3">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
              <span className="text-sm font-medium text-green-800">
                Pagado completo - no requiere cobro en destino
              </span>
            </div>
          )}
          {venta.estadoPago === 'parcial' && (
            <div className="flex items-center p-2 bg-amber-100 rounded-lg border border-amber-200 mb-3">
              <AlertCircle className="h-4 w-4 text-amber-600 mr-2 flex-shrink-0" />
              <span className="text-sm text-amber-800">
                Pago parcial: S/ {(venta.montoPagado || 0).toFixed(2)} pagado de S/ {(venta.totalPEN || 0).toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <CreditCard className="h-5 w-5 text-amber-600 mr-2" />
              <span className="font-medium text-gray-900">Cobro en Destino</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={cobroPendiente}
                onChange={(e) => setCobroPendiente(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {cobroPendiente && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Monto a Cobrar (S/)"
                type="number"
                value={montoPorCobrar}
                onChange={(e) => setMontoPorCobrar(parseFloat(e.target.value) || 0)}
                min={0}
                step={0.01}
                icon={<DollarSign className="h-5 w-5 text-gray-400" />}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Metodo de Pago Esperado
                </label>
                <select
                  value={metodoPagoEsperado}
                  onChange={(e) => setMetodoPagoEsperado(e.target.value as MetodoPago)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {metodoPagoOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Info de cobros ya programados en entregas previas */}
          {cobroYaProgramado > 0 && (
            <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800 flex items-center">
                <Info className="h-3 w-3 mr-1 flex-shrink-0" />
                Ya hay cobros programados en entregas anteriores por S/ {cobroYaProgramado.toFixed(2)}
              </p>
            </div>
          )}

          {cobroPendiente && montoPorCobrar > 0 && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800">
                El PDF incluira un QR de pago para que el cliente pueda pagar digitalmente.
              </p>
            </div>
          )}
        </div>

        {/* Costo de distribucion */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center mb-3">
            <DollarSign className="h-5 w-5 text-blue-600 mr-2" />
            <span className="font-medium text-gray-900">Gasto de Distribucion (GD)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Costo del Transportista (S/)"
              type="number"
              value={costoTransportista}
              onChange={(e) => setCostoTransportista(parseFloat(e.target.value) || 0)}
              min={0}
              step="any"
              helperText="Se registrara como gasto GD al completar la entrega"
            />
            {transportistaSeleccionado?.comisionPorcentaje && (
              <div className="flex items-center text-sm text-gray-600">
                <span>
                  + {transportistaSeleccionado.comisionPorcentaje}% comision sobre el valor
                </span>
              </div>
            )}
          </div>
          {/* ISSUE 6: Warning mejorado para costo 0 */}
          {costoTransportista === 0 && transportistaId && (
            <div className={`mt-3 p-2 rounded-lg border ${
              transportistaSeleccionado?.costoFijo
                ? 'bg-amber-100 border-amber-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-sm flex items-center ${
                transportistaSeleccionado?.costoFijo
                  ? 'text-amber-800'
                  : 'text-red-800 font-medium'
              }`}>
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                {transportistaSeleccionado?.costoFijo
                  ? 'El costo es S/ 0.00. Ajusta si el transportista cobra por esta entrega.'
                  : `${transportistaSeleccionado?.nombre || 'Transportista'} no tiene costo fijo configurado. Ingresa el costo manualmente.`
                }
              </p>
            </div>
          )}
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observaciones para el Transportista
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            placeholder="Instrucciones especiales, llamar antes de llegar, etc."
          />
        </div>

        {/* Resumen */}
        <div className="bg-gray-100 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Resumen de la Entrega</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Productos</span>
              <p className="font-semibold">
                {productosParaEntregar.reduce((sum, p) => sum + p.cantidad, 0)} items
              </p>
            </div>
            <div>
              <span className="text-gray-500">Transportista</span>
              <p className="font-semibold">{transportistaSeleccionado?.nombre || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">Costo GD</span>
              <p className="font-semibold">S/ {costoTransportista.toFixed(2)}</p>
            </div>
            {cobroPendiente && (
              <div>
                <span className="text-gray-500">A Cobrar</span>
                <p className="font-semibold text-amber-600">S/ {montoPorCobrar.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading || loadingEntregas}
            disabled={!transportistaId || !addressData.direccion || !fechaProgramada || !hayProductos || loadingEntregas}
          >
            <Truck className="h-4 w-4 mr-2" />
            Programar Entrega
          </Button>
        </div>
      </form>
    </Modal>
  );
};
