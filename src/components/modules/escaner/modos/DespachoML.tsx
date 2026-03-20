import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import { ShoppingBag, CheckCircle2, AlertTriangle, Clock, Package, Truck, Loader2, DollarSign, CreditCard, Send } from 'lucide-react';
import { ProductoService } from '../../../../services/producto.service';
import { VentaService } from '../../../../services/venta.service';
import { entregaService } from '../../../../services/entrega.service';
import { transportistaService } from '../../../../services/transportista.service';
import { useMercadoLibreStore } from '../../../../store/mercadoLibreStore';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import type { MLOrderSync } from '../../../../types/mercadoLibre.types';
import type { Venta } from '../../../../types/venta.types';
import type { Transportista } from '../../../../types/transportista.types';
import type { MetodoPago } from '../../../../types/venta.types';
import type { ProgramarEntregaData, Entrega } from '../../../../types/entrega.types';

export interface DespachoMLHandle {
  handleScan: (barcode: string, format?: string) => void;
}

interface ProductoDespacho {
  productoId: string;
  sku: string;
  nombre: string;
  mlTitle: string;
  esperado: number;
  escaneado: number;
}

type Mode = 'preparar' | 'despachar';
type Step = 'scan' | 'entrega_form';

export const DespachoML = forwardRef<DespachoMLHandle>((_props, ref) => {
  const toast = useToastStore();
  const { user } = useAuthStore();
  const { orderSyncs, initialize, initialized } = useMercadoLibreStore();

  // Mode toggle
  const [mode, setMode] = useState<Mode>('preparar');

  // === PREPARAR state ===
  const [selectedOrder, setSelectedOrder] = useState<MLOrderSync | null>(null);
  const [productos, setProductos] = useState<ProductoDespacho[]>([]);
  const [isValidated, setIsValidated] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [ventaEstados, setVentaEstados] = useState<Map<string, string>>(new Map());
  const [loadingVentas, setLoadingVentas] = useState(false);

  // Entrega form state
  const [step, setStep] = useState<Step>('scan');
  const [ventaActual, setVentaActual] = useState<Venta | null>(null);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [loadingTransportistas, setLoadingTransportistas] = useState(false);
  const [transportistaId, setTransportistaId] = useState('');
  const [costoTransportista, setCostoTransportista] = useState(0);
  const [cobroPendiente, setCobroPendiente] = useState(false);
  const [montoPorCobrar, setMontoPorCobrar] = useState(0);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');

  // === DESPACHAR state ===
  const [entregasProgramadas, setEntregasProgramadas] = useState<Entrega[]>([]);
  const [loadingEntregas, setLoadingEntregas] = useState(false);
  const [despachando, setDespachando] = useState<string | null>(null);

  // Inicializar store de ML si no está listo
  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  // Filtrar órdenes procesadas con ventaId
  const ordersProcessed = useMemo(() =>
    orderSyncs.filter(o =>
      o.estado === 'procesada' &&
      o.ventaId !== null &&
      o.productos?.every(p => p.vinculado) !== false
    ),
    [orderSyncs]
  );

  // Cargar estados de ventas para filtrar solo las despachables
  useEffect(() => {
    if (ordersProcessed.length === 0) return;

    let cancelled = false;
    setLoadingVentas(true);

    const loadEstados = async () => {
      const estados = new Map<string, string>();
      const ventaIds = ordersProcessed
        .map(o => o.ventaId!)
        .filter((v, i, arr) => arr.indexOf(v) === i);

      for (let i = 0; i < ventaIds.length; i += 10) {
        const batch = ventaIds.slice(i, i + 10);
        const results = await Promise.all(
          batch.map(id => VentaService.getById(id).catch(() => null))
        );
        results.forEach((venta, idx) => {
          if (venta) estados.set(batch[idx], venta.estado);
        });
      }

      if (!cancelled) {
        setVentaEstados(estados);
        setLoadingVentas(false);
      }
    };

    loadEstados();
    return () => { cancelled = true; };
  }, [ordersProcessed]);

  // Solo mostrar órdenes cuya venta está en estado despachable (para Preparar)
  const ordersReady = useMemo(() =>
    ordersProcessed.filter(o => {
      const ventaEstado = ventaEstados.get(o.ventaId!);
      return ventaEstado === 'asignada' || ventaEstado === 'en_entrega';
    }),
    [ordersProcessed, ventaEstados]
  );

  // Cargar entregas programadas cuando se cambia a modo Despachar
  useEffect(() => {
    if (mode !== 'despachar') return;
    let cancelled = false;
    setLoadingEntregas(true);

    const loadEntregas = async () => {
      try {
        const entregas = await entregaService.getProgramadas();
        if (!cancelled) setEntregasProgramadas(entregas);
      } catch {
        if (!cancelled) setEntregasProgramadas([]);
      } finally {
        if (!cancelled) setLoadingEntregas(false);
      }
    };

    loadEntregas();
    return () => { cancelled = true; };
  }, [mode]);

  // Build product list when order is selected
  useEffect(() => {
    if (!selectedOrder?.productos) {
      setProductos([]);
      setIsValidated(false);
      return;
    }

    const prods: ProductoDespacho[] = selectedOrder.productos
      .filter(p => p.productoId)
      .map(p => ({
        productoId: p.productoId!,
        sku: p.productoSku || '',
        nombre: p.productoNombre || p.mlTitle,
        mlTitle: p.mlTitle,
        esperado: p.cantidad,
        escaneado: 0,
      }));

    const merged = new Map<string, ProductoDespacho>();
    for (const p of prods) {
      const existing = merged.get(p.productoId);
      if (existing) {
        existing.esperado += p.esperado;
      } else {
        merged.set(p.productoId, { ...p });
      }
    }

    setProductos([...merged.values()]);
    setIsValidated(false);
  }, [selectedOrder]);

  // Check if all validated
  useEffect(() => {
    if (productos.length > 0 && productos.every(p => p.escaneado >= p.esperado)) {
      setIsValidated(true);
    } else {
      setIsValidated(false);
    }
  }, [productos]);

  const handleScan = useCallback(async (barcode: string) => {
    if (mode === 'preparar') {
      if (!selectedOrder) {
        toast.warning('Selecciona una orden ML primero');
        return;
      }

      let prodIdx = productos.findIndex(p => p.sku === barcode);
      if (prodIdx === -1) {
        try {
          const producto = await ProductoService.getByCodigoUPC(barcode);
          if (producto) {
            prodIdx = productos.findIndex(p => p.productoId === producto.id);
          }
        } catch { /* silent */ }
      }

      if (prodIdx === -1) {
        toast.warning(`Codigo ${barcode} no encontrado en esta orden`);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        return;
      }

      const prod = productos[prodIdx];
      if (prod.escaneado >= prod.esperado) {
        toast.warning(`${prod.nombre}: ya alcanzaste la cantidad esperada (${prod.esperado})`);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        return;
      }

      setProductos(prev => prev.map((p, i) =>
        i === prodIdx ? { ...p, escaneado: p.escaneado + 1 } : p
      ));
      if (navigator.vibrate) navigator.vibrate(100);
      toast.success(`${prod.nombre}`, `${prod.escaneado + 1}/${prod.esperado}`);
    } else {
      // Modo Despachar: buscar entrega por código o SKU de producto
      const entrega = entregasProgramadas.find(e =>
        e.codigo === barcode ||
        e.numeroVenta === barcode ||
        e.productos.some(p => p.sku === barcode)
      );
      if (entrega) {
        handleDespacharEntrega(entrega);
      } else {
        // Intentar buscar por UPC
        try {
          const producto = await ProductoService.getByCodigoUPC(barcode);
          if (producto) {
            const match = entregasProgramadas.find(e =>
              e.productos.some(p => p.productoId === producto.id)
            );
            if (match) {
              handleDespacharEntrega(match);
              return;
            }
          }
        } catch { /* silent */ }
        toast.warning(`No se encontró entrega para: ${barcode}`);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
    }
  }, [mode, selectedOrder, productos, toast, entregasProgramadas]);

  // Transition to entrega form after scanning
  const handleProcederEntrega = useCallback(async () => {
    if (!selectedOrder?.ventaId) return;
    setIsDispatching(true);
    try {
      const venta = await VentaService.getById(selectedOrder.ventaId);
      if (!venta) {
        toast.error('Venta no encontrada');
        return;
      }
      if (venta.estado !== 'asignada' && venta.estado !== 'en_entrega') {
        toast.warning(`La venta esta en estado "${venta.estado}" — no se puede despachar`);
        return;
      }
      setVentaActual(venta);

      setLoadingTransportistas(true);
      const transp = await transportistaService.getActivos();
      setTransportistas(transp);
      setLoadingTransportistas(false);

      if (venta.estadoPago === 'pagado') {
        setCobroPendiente(false);
        setMontoPorCobrar(0);
      } else {
        const pagado = venta.pagos?.reduce((s, p) => s + p.monto, 0) || 0;
        const pendiente = venta.totalPEN - pagado;
        setCobroPendiente(pendiente > 0);
        setMontoPorCobrar(pendiente > 0 ? pendiente : 0);
        if (venta.canal === 'mercado_libre') setMetodoPago('mercado_pago');
      }

      setStep('entrega_form');
    } catch (error: any) {
      toast.error(error?.message || 'Error al cargar datos');
    } finally {
      setIsDispatching(false);
    }
  }, [selectedOrder, toast]);

  const handleTransportistaChange = useCallback((id: string) => {
    setTransportistaId(id);
    const t = transportistas.find(tr => tr.id === id);
    if (t) {
      setCostoTransportista(t.costoFijo || t.costoPromedioPorEntrega || 0);
    }
  }, [transportistas]);

  // Submit entrega creation (Preparar → programar)
  const handleConfirmarDespacho = useCallback(async () => {
    if (!selectedOrder?.ventaId || !ventaActual || !user?.uid) return;
    if (!transportistaId) {
      toast.warning('Selecciona un transportista');
      return;
    }

    setIsDispatching(true);
    try {
      const productosEntrega = ventaActual.productos.map(p => ({
        productoId: p.productoId,
        cantidad: p.cantidad,
        unidadesAsignadas: p.unidadesAsignadas?.slice(0, p.cantidad) || [],
      }));

      const data: ProgramarEntregaData = {
        ventaId: selectedOrder.ventaId,
        transportistaId,
        productos: productosEntrega,
        direccionEntrega: ventaActual.direccionEntrega || selectedOrder.direccionEntrega || '',
        distrito: ventaActual.distrito || selectedOrder.distrito || undefined,
        provincia: ventaActual.provincia || undefined,
        fechaProgramada: new Date(),
        cobroPendiente,
        montoPorCobrar: cobroPendiente ? montoPorCobrar : undefined,
        metodoPagoEsperado: cobroPendiente ? metodoPago : undefined,
        costoTransportista,
      };

      await entregaService.programar(data, ventaActual, user.uid);
      toast.success('Entrega programada', `${selectedOrder.numeroVenta || ventaActual.numeroVenta} lista para despacho`);

      // Reset
      setSelectedOrder(null);
      setProductos([]);
      setIsValidated(false);
      setStep('scan');
      setVentaActual(null);
      setTransportistaId('');
      setCostoTransportista(0);
      setCobroPendiente(false);
      setMontoPorCobrar(0);
    } catch (error: any) {
      toast.error(error?.message || 'Error al programar entrega');
    } finally {
      setIsDispatching(false);
    }
  }, [selectedOrder, ventaActual, user, transportistaId, cobroPendiente, montoPorCobrar, metodoPago, costoTransportista, toast]);

  // Despachar entrega (marcar En Camino)
  const handleDespacharEntrega = useCallback(async (entrega: Entrega) => {
    if (!user?.uid) return;
    setDespachando(entrega.id);
    try {
      await entregaService.marcarEnCamino(entrega.id, user.uid);
      setEntregasProgramadas(prev => prev.filter(e => e.id !== entrega.id));
      if (navigator.vibrate) navigator.vibrate([100, 30, 100, 30, 100]);
      toast.success(`${entrega.numeroVenta} despachada`, `${entrega.nombreTransportista} — en camino`);
    } catch (error: any) {
      toast.error(error?.message || 'Error al despachar');
    } finally {
      setDespachando(null);
    }
  }, [user, toast]);

  useImperativeHandle(ref, () => ({ handleScan }), [handleScan]);

  const totalEsperado = productos.reduce((s, p) => s + p.esperado, 0);
  const totalEscaneado = productos.reduce((s, p) => s + p.escaneado, 0);
  const progreso = totalEsperado > 0 ? (totalEscaneado / totalEsperado) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
        <button
          onClick={() => setMode('preparar')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'preparar'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Package className="h-4 w-4" />
          Preparar
        </button>
        <button
          onClick={() => setMode('despachar')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'despachar'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Send className="h-4 w-4" />
          Despachar
          {entregasProgramadas.length > 0 && mode !== 'despachar' && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full">
              {entregasProgramadas.length}
            </span>
          )}
        </button>
      </div>

      {/* ============ MODO PREPARAR ============ */}
      {mode === 'preparar' && (
        <>
          {/* Order selector */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <ShoppingBag className="h-4 w-4 text-yellow-500" />
              Orden MercadoLibre
            </label>
            {!initialized || loadingVentas ? (
              <p className="text-sm text-gray-500 py-2 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando ordenes...
              </p>
            ) : ordersReady.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">No hay ordenes ML listas para preparar</p>
            ) : (
              <select
                value={selectedOrder?.id || ''}
                onChange={(e) => {
                  const o = ordersReady.find(or => or.id === e.target.value) || null;
                  setSelectedOrder(o);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Selecciona una orden</option>
                {ordersReady.map(o => {
                  const vEstado = ventaEstados.get(o.ventaId!);
                  return (
                    <option key={o.id} value={o.id}>
                      {o.numeroVenta || `#${o.mlOrderId}`} — {o.mlBuyerName || o.mlBuyerNickname || 'Comprador'} — S/ {o.totalML.toFixed(2)}
                      {o.packId ? ' [Pack]' : ''}
                      {vEstado ? ` (${vEstado})` : ''}
                    </option>
                  );
                })}
              </select>
            )}

            {/* Order summary */}
            {selectedOrder && (
              <div className="mt-3 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <p><span className="text-yellow-700 font-medium">Comprador:</span> {selectedOrder.mlBuyerName || selectedOrder.mlBuyerNickname}</p>
                  {selectedOrder.numeroVenta && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                      {selectedOrder.numeroVenta}
                    </span>
                  )}
                </div>
                <p><span className="text-yellow-700 font-medium">Total:</span> S/ {selectedOrder.totalML.toFixed(2)}</p>
                {selectedOrder.metodoEnvio && (
                  <p><span className="text-yellow-700 font-medium">Envio:</span> {selectedOrder.metodoEnvio === 'flex' ? 'Mercado Envios Flex' : 'Mercado Envios'}</p>
                )}
                {selectedOrder.direccionEntrega && (
                  <p><span className="text-yellow-700 font-medium">Direccion:</span> {selectedOrder.direccionEntrega}</p>
                )}
              </div>
            )}
          </div>

          {/* Products validation list */}
          {selectedOrder && productos.length > 0 && (
            <>
              <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Validacion: {totalEscaneado}/{totalEsperado}
                  </span>
                  {isValidated && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Completo
                    </span>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      progreso >= 100 ? 'bg-green-500' : progreso > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                    }`}
                    style={{ width: `${Math.min(progreso, 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {productos.map(prod => {
                  const completo = prod.escaneado >= prod.esperado;
                  const parcial = prod.escaneado > 0 && !completo;

                  return (
                    <div
                      key={prod.productoId}
                      className={`bg-white border rounded-lg p-3 transition-all ${
                        completo
                          ? 'border-green-300 bg-green-50/30'
                          : parcial
                            ? 'border-amber-300 bg-amber-50/20'
                            : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {completo ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            ) : parcial ? (
                              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            ) : (
                              <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                            )}
                            <p className="text-sm font-medium text-gray-900 truncate">{prod.nombre}</p>
                          </div>
                          <p className="text-xs text-gray-500 ml-6 truncate">
                            {prod.sku} · {prod.mlTitle}
                          </p>
                        </div>
                        <div className="text-center min-w-[3rem] shrink-0">
                          <span className={`text-sm font-bold tabular-nums ${
                            completo ? 'text-green-600' : parcial ? 'text-amber-600' : 'text-gray-900'
                          }`}>
                            {prod.escaneado}
                          </span>
                          <span className="text-xs text-gray-400">/{prod.esperado}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Validated — proceed to entrega form */}
              {isValidated && step === 'scan' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-700">Todos los productos validados</p>
                  <p className="text-xs text-green-600 mt-1 mb-3">Continua para programar la entrega</p>
                  <button
                    type="button"
                    onClick={handleProcederEntrega}
                    disabled={isDispatching}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <Truck className="h-4 w-4" />
                    {isDispatching ? 'Cargando...' : 'Programar Entrega'}
                  </button>
                </div>
              )}

              {/* Entrega creation form */}
              {step === 'entrega_form' && ventaActual && (
                <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-600" />
                    Programar Entrega
                  </h3>

                  {/* Transportista */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Transportista</label>
                    {loadingTransportistas ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-gray-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando...
                      </div>
                    ) : (
                      <select
                        value={transportistaId}
                        onChange={(e) => handleTransportistaChange(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Selecciona transportista</option>
                        {transportistas.filter(t => t.tipo === 'interno').length > 0 && (
                          <optgroup label="Internos (Lima)">
                            {transportistas.filter(t => t.tipo === 'interno').map(t => (
                              <option key={t.id} value={t.id}>
                                {t.nombre} {t.costoFijo ? `— S/ ${t.costoFijo.toFixed(2)}` : ''}
                                {t.tasaExito ? ` (${t.tasaExito.toFixed(0)}%)` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {transportistas.filter(t => t.tipo === 'externo').length > 0 && (
                          <optgroup label="Externos (Couriers)">
                            {transportistas.filter(t => t.tipo === 'externo').map(t => (
                              <option key={t.id} value={t.id}>
                                {t.nombre} {t.costoFijo ? `— S/ ${t.costoFijo.toFixed(2)}` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    )}
                  </div>

                  {/* Costo transportista */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      <DollarSign className="inline h-3.5 w-3.5 mr-1" />
                      Costo de envio (GD)
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-400">S/</span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={costoTransportista || ''}
                        onChange={(e) => setCostoTransportista(parseFloat(e.target.value) || 0)}
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Cobro pendiente */}
                  {ventaActual.estadoPago === 'pagado' ? (
                    <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-xs font-medium text-green-700">Venta pagada — sin cobro pendiente</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cobroPendiente}
                          onChange={(e) => setCobroPendiente(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-medium text-gray-700">
                          <CreditCard className="inline h-3.5 w-3.5 mr-1" />
                          Cobrar al entregar
                        </span>
                      </label>
                      {cobroPendiente && (
                        <div className="flex gap-2 ml-6">
                          <div className="flex-1">
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-400">S/</span>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={montoPorCobrar || ''}
                                onChange={(e) => setMontoPorCobrar(parseFloat(e.target.value) || 0)}
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                placeholder="Monto"
                              />
                            </div>
                          </div>
                          <select
                            value={metodoPago}
                            onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
                            className="px-2 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transfer.</option>
                            <option value="yape">Yape</option>
                            <option value="plin">Plin</option>
                            <option value="mercado_pago">MercadoPago</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Direccion */}
                  {(ventaActual.direccionEntrega || selectedOrder?.direccionEntrega) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Direccion</label>
                      <p className="text-xs text-gray-700 bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                        {ventaActual.direccionEntrega || selectedOrder?.direccionEntrega}
                        {(ventaActual.distrito || selectedOrder?.distrito) && (
                          <span className="text-gray-500"> — {ventaActual.distrito || selectedOrder?.distrito}</span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Submit / Back buttons */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setStep('scan')}
                      className="flex-1 px-3 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Volver
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmarDespacho}
                      disabled={isDispatching || !transportistaId}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <Truck className="h-4 w-4" />
                      {isDispatching ? 'Programando...' : 'Confirmar Entrega'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {selectedOrder && productos.length === 0 && (
            <div className="text-center py-8">
              <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Esta orden no tiene productos vinculados</p>
            </div>
          )}
        </>
      )}

      {/* ============ MODO DESPACHAR ============ */}
      {mode === 'despachar' && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
            <Send className="inline h-3.5 w-3.5 mr-1" />
            Escanea un producto o toca <strong>Despachar</strong> para marcar la entrega como En Camino
          </div>

          {loadingEntregas ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando entregas...
            </div>
          ) : entregasProgramadas.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No hay entregas pendientes de despacho</p>
              <p className="text-xs text-gray-400 mt-1">Programa entregas desde la tab Preparar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entregasProgramadas.map(entrega => (
                <div
                  key={entrega.id}
                  className="bg-white border border-gray-200 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-primary-600 font-semibold">{entrega.numeroVenta}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                          {entrega.estado === 'reprogramada' ? 'Reprogramada' : 'Programada'}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate mt-0.5">{entrega.nombreCliente}</p>
                      <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                        <p><Truck className="inline h-3 w-3 mr-0.5" />{entrega.nombreTransportista}</p>
                        {entrega.direccionEntrega && (
                          <p className="truncate">{entrega.direccionEntrega}{entrega.distrito ? ` — ${entrega.distrito}` : ''}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs text-gray-500">{entrega.cantidadItems} item{entrega.cantidadItems !== 1 ? 's' : ''}</p>
                      <button
                        onClick={() => handleDespacharEntrega(entrega)}
                        disabled={despachando === entrega.id}
                        className="mt-1.5 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {despachando === entrega.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        Despachar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
});

DespachoML.displayName = 'DespachoML';
