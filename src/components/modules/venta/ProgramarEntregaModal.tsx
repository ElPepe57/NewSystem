import React, { useState, useEffect } from 'react';
import {
  Truck,
  User,
  MapPin,
  Calendar,
  Clock,
  Package,
  DollarSign,
  CreditCard,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Button, Modal, Input, Badge } from '../../common';
import { useTransportistaStore } from '../../../store/transportistaStore';
import type { Venta, ProductoVenta, MetodoPago } from '../../../types/venta.types';
import type { Transportista } from '../../../types/transportista.types';
import type { ProgramarEntregaData } from '../../../types/entrega.types';

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
  mercado_envios: 'M. Envíos',
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
  const [direccionEntrega, setDireccionEntrega] = useState(venta.direccionEntrega || '');
  const [distrito, setDistrito] = useState('');
  const [referencia, setReferencia] = useState('');
  const [fechaProgramada, setFechaProgramada] = useState('');
  const [horaProgramada, setHoraProgramada] = useState('');
  const [cobroPendiente, setCobroPendiente] = useState(venta.montoPendiente > 0);
  const [montoPorCobrar, setMontoPorCobrar] = useState(venta.montoPendiente || 0);
  const [metodoPagoEsperado, setMetodoPagoEsperado] = useState<MetodoPago>('efectivo');
  const [costoTransportista, setCostoTransportista] = useState(0);
  const [observaciones, setObservaciones] = useState('');

  // Productos a entregar (para entregas parciales)
  const [productosSeleccionados, setProductosSeleccionados] = useState<ProductoSeleccionado[]>([]);

  // Cargar transportistas
  useEffect(() => {
    if (isOpen) {
      fetchActivos();
    }
  }, [isOpen, fetchActivos]);

  // Inicializar productos cuando se abre
  useEffect(() => {
    if (isOpen && venta) {
      const productos = venta.productos.map(p => ({
        productoId: p.productoId,
        cantidad: p.cantidad,
        maxDisponible: p.cantidad, // TODO: restar lo ya entregado en entregas previas
        unidadesAsignadas: p.unidadesAsignadas || [],
        seleccionado: true
      }));
      setProductosSeleccionados(productos);

      // Fecha por defecto: hoy
      const hoy = new Date();
      setFechaProgramada(hoy.toISOString().split('T')[0]);

      // Resetear otros campos
      setTransportistaId('');
      setDireccionEntrega(venta.direccionEntrega || '');
      setDistrito('');
      setReferencia('');
      setHoraProgramada('');
      setCobroPendiente(venta.montoPendiente > 0);
      setMontoPorCobrar(venta.montoPendiente || 0);
      setMetodoPagoEsperado('efectivo');
      setCostoTransportista(0);
      setObservaciones('');
    }
  }, [isOpen, venta]);

  // Actualizar costo cuando cambia el transportista
  useEffect(() => {
    if (transportistaId) {
      const transportista = transportistasActivos.find(t => t.id === transportistaId);
      if (transportista) {
        // Usar costoFijo del transportista como valor inicial
        // El usuario puede modificarlo si es necesario
        setCostoTransportista(transportista.costoFijo ?? 0);
      }
    } else {
      setCostoTransportista(0);
    }
  }, [transportistaId, transportistasActivos]);

  const transportistaSeleccionado = transportistasActivos.find(t => t.id === transportistaId);

  const handleProductoToggle = (productoId: string) => {
    setProductosSeleccionados(prev =>
      prev.map(p =>
        p.productoId === productoId
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

  const productosParaEntregar = productosSeleccionados.filter(p => p.seleccionado);
  const hayProductos = productosParaEntregar.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transportistaId || !direccionEntrega || !fechaProgramada || !hayProductos) {
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
      direccionEntrega,
      distrito: distrito || undefined,
      referencia: referencia || undefined,
      fechaProgramada: new Date(fechaProgramada),
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
          {venta.telefonoCliente && (
            <p className="text-sm text-gray-600 mt-2">
              Tel: {venta.telefonoCliente}
            </p>
          )}
        </div>

        {/* Selección de Transportista */}
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
                    {t.nombre} - S/ {t.costoFijo?.toFixed(2) || '0.00'}
                    {t.tasaExito ? ` (${t.tasaExito.toFixed(0)}% éxito)` : ''}
                  </option>
                ))
              }
            </optgroup>
            <optgroup label="Externos (Couriers)">
              {transportistasActivos
                .filter(t => t.tipo === 'externo')
                .map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} ({courierLabels[t.courierExterno || 'otro']}) - S/ {t.costoFijo?.toFixed(2) || '0.00'}
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
                  {transportistaSeleccionado.tasaExito?.toFixed(0) || 0}% éxito
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

        {/* Dirección */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Dirección de Entrega"
              value={direccionEntrega}
              onChange={(e) => setDireccionEntrega(e.target.value)}
              placeholder="Av. Principal 123, Dpto 401"
              required
              icon={<MapPin className="h-5 w-5 text-gray-400" />}
            />
          </div>
          <Input
            label="Distrito"
            value={distrito}
            onChange={(e) => setDistrito(e.target.value)}
            placeholder="Miraflores"
          />
          <Input
            label="Referencia"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Frente al parque"
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
            min={new Date().toISOString().split('T')[0]}
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
              <option value="08:00-12:00">Mañana (8am - 12pm)</option>
              <option value="12:00-16:00">Mediodía (12pm - 4pm)</option>
              <option value="16:00-20:00">Tarde (4pm - 8pm)</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>
        </div>

        {/* Productos a entregar (para parciales) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Package className="h-4 w-4 inline mr-2" />
            Productos a Entregar
          </label>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-10">
                    <input
                      type="checkbox"
                      checked={productosSeleccionados.every(p => p.seleccionado)}
                      onChange={() => {
                        const allSelected = productosSeleccionados.every(p => p.seleccionado);
                        setProductosSeleccionados(prev =>
                          prev.map(p => ({ ...p, seleccionado: !allSelected }))
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

                  return (
                    <tr key={prod.productoId} className={prod.seleccionado ? 'bg-green-50' : ''}>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={prod.seleccionado}
                          onChange={() => handleProductoToggle(prod.productoId)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-sm font-medium text-gray-900">
                          {productoVenta.marca} {productoVenta.nombreComercial}
                        </div>
                        <div className="text-xs text-gray-500">{productoVenta.sku}</div>
                      </td>
                      <td className="px-4 py-2">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!hayProductos && (
            <p className="mt-2 text-sm text-danger-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              Selecciona al menos un producto para entregar
            </p>
          )}
        </div>

        {/* Cobro pendiente */}
        <div className="bg-amber-50 p-4 rounded-lg">
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
                  Método de Pago Esperado
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

          {cobroPendiente && montoPorCobrar > 0 && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800">
                El PDF incluirá un QR de pago para que el cliente pueda pagar digitalmente.
              </p>
            </div>
          )}
        </div>

        {/* Costo de distribución */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center mb-3">
            <DollarSign className="h-5 w-5 text-blue-600 mr-2" />
            <span className="font-medium text-gray-900">Gasto de Distribución (GD)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Costo del Transportista (S/)"
              type="number"
              value={costoTransportista}
              onChange={(e) => setCostoTransportista(parseFloat(e.target.value) || 0)}
              min={0}
              step={0.50}
              helperText="Se registrará como gasto GD al completar la entrega"
            />
            {transportistaSeleccionado?.comisionPorcentaje && (
              <div className="flex items-center text-sm text-gray-600">
                <span>
                  + {transportistaSeleccionado.comisionPorcentaje}% comisión sobre el valor
                </span>
              </div>
            )}
          </div>
          {costoTransportista === 0 && transportistaId && (
            <div className="mt-3 p-2 bg-amber-100 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800 flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                El costo es S/ 0.00. Ajusta si el transportista cobra por esta entrega.
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
            loading={loading}
            disabled={!transportistaId || !direccionEntrega || !fechaProgramada || !hayProductos}
          >
            <Truck className="h-4 w-4 mr-2" />
            Programar Entrega
          </Button>
        </div>
      </form>
    </Modal>
  );
};
