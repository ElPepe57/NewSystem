import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import { BarcodeScanner } from '../../common/BarcodeScanner';
import { Package, CheckCircle2, AlertTriangle, Box, Truck, ScanLine, Keyboard } from 'lucide-react';
import type { OrdenCompra, SubOrdenCompra } from '../../../types/ordenCompra.types';

interface RecepcionParcialModalProps {
  isOpen: boolean;
  onClose: () => void;
  orden: OrdenCompra;
  subOrden?: SubOrdenCompra;
  onSubmit: (
    productosRecibidos: Array<{ productoId: string; cantidadRecibida: number; cantidadDanada?: number; cantidadPerdida?: number }>,
    observaciones?: string
  ) => Promise<void>;
}

export const RecepcionParcialModal: React.FC<RecepcionParcialModalProps> = ({
  isOpen,
  onClose,
  orden,
  subOrden,
  onSubmit
}) => {
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [danados, setDanados] = useState<Record<string, number>>({});
  const [perdidos, setPerdidos] = useState<Record<string, number>>({});
  const [recibirTodo, setRecibirTodo] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const [modoEscaner, setModoEscaner] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ productoId: string; timestamp: number } | null>(null);
  const [scanError, setScanError] = useState('');
  const [resultado, setResultado] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Productos fuente: sub-orden si existe, o toda la OC
  const productosBase = subOrden ? subOrden.productos : orden.productos;

  // Calcular pendientes por producto
  const productosConPendiente = useMemo(() => {
    return productosBase.map(p => {
      const recibido = p.cantidadRecibida || 0;
      const pendiente = p.cantidad - recibido;
      return {
        ...p,
        recibido,
        pendiente,
        completo: pendiente <= 0
      };
    });
  }, [productosBase]);

  const hayPendientes = productosConPendiente.some(p => !p.completo);

  // Número de recepción
  const numeroRecepcion = (orden.recepcionesParciales?.length || 0) + 1;

  // Handler de escaneo para recepción
  const handleBarcodeScan = useCallback((barcode: string) => {
    setScanError('');

    // Buscar producto por codigoUPC o SKU
    const producto = productosBase.find(
      p => p.codigoUPC === barcode || p.sku === barcode
    );

    if (!producto) {
      setScanError(`Codigo "${barcode}" no corresponde a ningun producto de esta orden`);
      setTimeout(() => setScanError(''), 4000);
      return;
    }

    // Verificar si el producto ya está completo
    const productoConPendiente = productosConPendiente.find(p => p.productoId === producto.productoId);
    if (!productoConPendiente || productoConPendiente.completo) {
      setScanError(`${producto.nombreComercial} ya fue recibido completamente`);
      setTimeout(() => setScanError(''), 3000);
      return;
    }

    // Verificar que no exceda el pendiente
    const cantidadActual = cantidades[producto.productoId] || 0;
    if (cantidadActual >= productoConPendiente.pendiente) {
      setScanError(`${producto.nombreComercial} ya alcanzó la cantidad pendiente (${productoConPendiente.pendiente})`);
      setTimeout(() => setScanError(''), 3000);
      return;
    }

    // Incrementar cantidad
    setCantidades(prev => ({
      ...prev,
      [producto.productoId]: (prev[producto.productoId] || 0) + 1
    }));

    // Visual feedback
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setScanFeedback({ productoId: producto.productoId, timestamp: Date.now() });
    feedbackTimeoutRef.current = setTimeout(() => setScanFeedback(null), 1200);

    if (recibirTodo) setRecibirTodo(false);
  }, [productosBase, productosConPendiente, cantidades, recibirTodo]);

  // Manejar cambio de checkbox "Recibir todo"
  const handleRecibirTodo = (checked: boolean) => {
    setRecibirTodo(checked);
    if (checked) {
      const nuevasCantidades: Record<string, number> = {};
      productosConPendiente.forEach(p => {
        if (!p.completo) {
          nuevasCantidades[p.productoId] = p.pendiente;
        }
      });
      setCantidades(nuevasCantidades);
    } else {
      setCantidades({});
    }
  };

  // Manejar cambio de cantidad individual
  const handleCantidadChange = (productoId: string, valor: number, max: number) => {
    const cantidadFinal = Math.max(0, Math.min(valor, max));
    setCantidades(prev => ({
      ...prev,
      [productoId]: cantidadFinal
    }));
    // Si cambiaron manualmente, desmarcar "recibir todo"
    if (recibirTodo) setRecibirTodo(false);
  };

  // Toggle producto individual
  const toggleProducto = (productoId: string, pendiente: number) => {
    setCantidades(prev => {
      const current = prev[productoId] || 0;
      if (current > 0) {
        const { [productoId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productoId]: pendiente };
    });
    if (recibirTodo) setRecibirTodo(false);
  };

  // Calcular resumen
  const resumen = useMemo(() => {
    const productosSeleccionados = Object.entries(cantidades)
      .filter(([, cant]) => cant > 0);
    const totalUnidades = productosSeleccionados.reduce((sum, [, cant]) => sum + cant, 0);

    // Calcular costo de esta entrega
    const totalUnidadesOrden = productosBase.reduce((sum, p) => sum + p.cantidad, 0);
    const costosAdicionales = (orden.impuestoCompraUSD ?? 0) + (orden.costoEnvioProveedorUSD ?? 0) + (orden.otrosGastosCompraUSD ?? 0);
    const costoAdicionalPorUnidad = totalUnidadesOrden > 0 ? costosAdicionales / totalUnidadesOrden : 0;

    let costoRecepcionUSD = 0;
    for (const [productoId, cant] of productosSeleccionados) {
      const producto = productosBase.find(p => p.productoId === productoId);
      if (producto) {
        costoRecepcionUSD += cant * (producto.costoUnitario + costoAdicionalPorUnidad);
      }
    }

    // Totales de daños
    const totalDanados = Object.values(danados).reduce((s, v) => s + v, 0);
    const totalPerdidos = Object.values(perdidos).reduce((s, v) => s + v, 0);

    // Verificar si esta recepción completa la orden (recibidos + dañados + perdidos = pendiente)
    const esRecepcionFinal = productosConPendiente.every(p => {
      const recibir = cantidades[p.productoId] || 0;
      const danar = danados[p.productoId] || 0;
      const perder = perdidos[p.productoId] || 0;
      return (p.recibido + recibir + danar + perder) >= p.cantidad;
    });

    return {
      productosCount: productosSeleccionados.length,
      totalUnidades,
      totalDanados,
      totalPerdidos,
      costoRecepcionUSD,
      esRecepcionFinal
    };
  }, [cantidades, danados, perdidos, orden, productosConPendiente]);

  const handleSubmit = async () => {
    // Reunir todos los productos con actividad (recibidos, dañados o perdidos)
    const productoIds = new Set<string>();
    Object.entries(cantidades).forEach(([id, v]) => { if (v > 0) productoIds.add(id); });
    Object.entries(danados).forEach(([id, v]) => { if (v > 0) productoIds.add(id); });
    Object.entries(perdidos).forEach(([id, v]) => { if (v > 0) productoIds.add(id); });

    const productosRecibidos = Array.from(productoIds).map(productoId => ({
      productoId,
      cantidadRecibida: cantidades[productoId] || 0,
      cantidadDanada: danados[productoId] || 0,
      cantidadPerdida: perdidos[productoId] || 0,
    }));

    if (productosRecibidos.length === 0) return;

    setLoading(true);
    setResultado(null);

    try {
      await onSubmit(productosRecibidos, observaciones || undefined);
      const extras = [];
      if (resumen.totalDanados > 0) extras.push(`${resumen.totalDanados} dañadas`);
      if (resumen.totalPerdidos > 0) extras.push(`${resumen.totalPerdidos} perdidas`);
      const extrasMsg = extras.length > 0 ? ` (${extras.join(', ')})` : '';

      setResultado({
        success: true,
        message: resumen.esRecepcionFinal
          ? `Recepcion final completada. ${resumen.totalUnidades} unidades recibidas${extrasMsg}. La orden está completa.`
          : `Recepcion #${numeroRecepcion} registrada. ${resumen.totalUnidades} unidades recibidas${extrasMsg}.`
      });
    } catch (error: any) {
      setResultado({
        success: false,
        error: error.message || 'Error al registrar recepción'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCantidades({});
    setRecibirTodo(false);
    setObservaciones('');
    setResultado(null);
    setModoEscaner(false);
    setScanError('');
    setScanFeedback(null);
    onClose();
  };

  // Progreso global de la OC
  const totalOrdenado = productosBase.reduce((sum, p) => sum + p.cantidad, 0);
  const totalRecibido = productosBase.reduce((sum, p) => sum + (p.cantidadRecibida || 0), 0);
  const porcentajeGlobal = totalOrdenado > 0 ? (totalRecibido / totalOrdenado) * 100 : 0;

  // Check if any product has UPC codes for scanner mode
  const tieneCodigosUPC = productosBase.some(p => p.codigoUPC);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={subOrden
        ? `Recepción — Sub-orden ${subOrden.referenciaProveedor || subOrden.id}`
        : `Recepción de Productos - ${orden.numeroOrden}`}
      subtitle={`${orden.nombreProveedor} · Recepción #${numeroRecepcion}`}
      size="lg"
    >
      <div className="space-y-4 sm:space-y-5">
        {/* Progreso global */}
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Truck className="h-4 w-4 text-sky-600" />
              <span className="text-xs sm:text-sm font-medium text-sky-900">Progreso</span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-sky-900">{totalRecibido}/{totalOrdenado} ({porcentajeGlobal.toFixed(0)}%)</span>
          </div>
          <div className="w-full bg-sky-200 rounded-full h-2.5">
            <div
              className="bg-sky-600 h-2.5 rounded-full transition-all"
              style={{ width: `${porcentajeGlobal}%` }}
            />
          </div>
          {orden.recepcionesParciales && orden.recepcionesParciales.length > 0 && (
            <div className="mt-2 text-xs text-sky-700">
              {orden.recepcionesParciales.length} recepción(es) previas registradas
            </div>
          )}
        </div>

        {/* Resultado */}
        {resultado?.success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="font-semibold text-emerald-900">Recepción registrada</span>
            </div>
            <p className="text-sm text-emerald-800">{resultado.message}</p>
            <Button variant="primary" className="mt-3" onClick={handleClose}>
              Cerrar
            </Button>
          </div>
        )}

        {resultado?.success === false && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-red-900">{resultado.error}</span>
            </div>
          </div>
        )}

        {/* Formulario de recepción */}
        {!resultado?.success && (
          <>
            {/* Mode toggle: Manual vs Scanner */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setModoEscaner(false)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  !modoEscaner
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Keyboard className="h-4 w-4" />
                <span className="hidden sm:inline">Recepcion Manual</span>
                <span className="sm:hidden">Manual</span>
              </button>
              <button
                type="button"
                onClick={() => setModoEscaner(true)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  modoEscaner
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ScanLine className="h-4 w-4" />
                Escaner
              </button>
            </div>

            {/* Scanner section */}
            {modoEscaner && (
              <div className="space-y-3">
                {tieneCodigosUPC ? (
                  <BarcodeScanner
                    onScan={handleBarcodeScan}
                    mode="both"
                    compact
                    placeholder="Escanear codigo de barras del producto..."
                  />
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                    <p className="text-sm text-amber-800 font-medium">
                      Los productos de esta orden no tienen codigos UPC registrados
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      Registra los codigos UPC en los productos para usar el escaner. Puedes usar el SKU como alternativa.
                    </p>
                  </div>
                )}

                {/* Scan error feedback */}
                {scanError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span className="text-sm text-red-700">{scanError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Checkbox recibir todo (solo en modo manual) */}
            {!modoEscaner && hayPendientes && (
              <label className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors">
                <input
                  type="checkbox"
                  checked={recibirTodo}
                  onChange={(e) => handleRecibirTodo(e.target.checked)}
                  className="h-4 w-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-amber-900">Recibir TODO lo pendiente (recepción completa)</span>
              </label>
            )}

            {/* Lista de productos — card por producto */}
            <div className="space-y-2">
              {productosConPendiente.map(p => {
                const isFlashing = scanFeedback?.productoId === p.productoId;
                const cantRecibir = cantidades[p.productoId] || 0;
                const cantDanar = danados[p.productoId] || 0;
                const cantPerder = perdidos[p.productoId] || 0;
                const maxRecibir = p.pendiente - cantDanar - cantPerder;
                const maxDanar = p.pendiente - cantRecibir - cantPerder;
                const maxPerder = p.pendiente - cantRecibir - cantDanar;

                return (
                  <div
                    key={p.productoId}
                    className={`rounded-lg border p-3 transition-all duration-200 ${
                      isFlashing ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400' :
                      p.completo ? 'bg-emerald-50/50 border-emerald-200 opacity-70' :
                      'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Producto header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {p.completo ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <input
                            type="checkbox"
                            checked={cantRecibir > 0}
                            onChange={() => toggleProducto(p.productoId, p.pendiente)}
                            className="h-4 w-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{p.nombreComercial}</div>
                          <div className="text-[10px] text-slate-500">{p.marca} · {p.sku}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <div className="text-center">
                          <div className="text-[10px] text-slate-400 uppercase">Pedido</div>
                          <div className="font-semibold text-slate-900">{p.cantidad}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-slate-400 uppercase">Previo</div>
                          <div className={p.recibido > 0 ? 'font-semibold text-emerald-600' : 'text-slate-300'}>{p.recibido}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-slate-400 uppercase">Pendiente</div>
                          {p.completo ? (
                            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">OK</span>
                          ) : (
                            <div className="font-semibold text-amber-600">{p.pendiente}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Inputs — solo si no completo */}
                    {!p.completo && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                        {/* Recibir */}
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-500 block mb-0.5">Recibir</label>
                          {modoEscaner ? (
                            <div className={`text-center text-lg font-bold ${cantRecibir > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                              {cantRecibir}
                            </div>
                          ) : (
                            <input
                              type="number" min={0} max={maxRecibir}
                              value={cantRecibir}
                              onChange={(e) => handleCantidadChange(p.productoId, parseInt(e.target.value) || 0, maxRecibir)}
                              className="w-full text-center text-sm font-medium border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            />
                          )}
                        </div>
                        {/* Dañados */}
                        <div className="w-16">
                          <label className="text-[10px] text-red-500 block mb-0.5">Dañados</label>
                          <input
                            type="number" min={0} max={maxDanar}
                            value={cantDanar}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(parseInt(e.target.value) || 0, maxDanar));
                              setDanados(prev => ({ ...prev, [p.productoId]: val }));
                            }}
                            className="w-full text-center text-sm font-medium border border-red-200 rounded-lg px-1 py-1.5 focus:ring-2 focus:ring-red-400 focus:border-red-400 text-red-600 bg-red-50/50"
                          />
                        </div>
                        {/* Perdidos */}
                        <div className="w-16">
                          <label className="text-[10px] text-slate-500 block mb-0.5">Perdidos</label>
                          <input
                            type="number" min={0} max={maxPerder}
                            value={cantPerder}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(parseInt(e.target.value) || 0, maxPerder));
                              setPerdidos(prev => ({ ...prev, [p.productoId]: val }));
                            }}
                            className="w-full text-center text-sm font-medium border border-slate-200 rounded-lg px-1 py-1.5 focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Observaciones */}
            <div>
              <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">
                Observaciones (opcional)
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej: Paquete 2 de 3, tracking TBA12345..."
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder:text-slate-300"
              />
            </div>

            {/* Resumen */}
            {(resumen.totalUnidades > 0 || resumen.totalDanados > 0 || resumen.totalPerdidos > 0) && (
              <div className={`rounded-lg border p-4 ${resumen.esRecepcionFinal ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-slate-600" />
                  <span className="text-sm font-semibold text-slate-900">
                    Resumen #{numeroRecepcion}
                  </span>
                  {resumen.esRecepcionFinal && (
                    <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      FINAL
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white rounded-lg p-2.5 border border-slate-100 text-center">
                    <div className="text-[10px] text-slate-400 uppercase">Productos</div>
                    <div className="text-lg font-bold text-slate-900">{resumen.productosCount}</div>
                  </div>
                  <div className="bg-white rounded-lg p-2.5 border border-emerald-100 text-center">
                    <div className="text-[10px] text-emerald-600 uppercase">Recibidas</div>
                    <div className="text-lg font-bold text-emerald-700">{resumen.totalUnidades}</div>
                  </div>
                  {resumen.totalDanados > 0 && (
                    <div className="bg-red-50 rounded-lg p-2.5 border border-red-100 text-center">
                      <div className="text-[10px] text-red-500 uppercase">Dañadas</div>
                      <div className="text-lg font-bold text-red-600">{resumen.totalDanados}</div>
                    </div>
                  )}
                  {resumen.totalPerdidos > 0 && (
                    <div className="bg-slate-100 rounded-lg p-2.5 border border-slate-200 text-center">
                      <div className="text-[10px] text-slate-500 uppercase">Perdidas</div>
                      <div className="text-lg font-bold text-slate-700">{resumen.totalPerdidos}</div>
                    </div>
                  )}
                  <div className="bg-white rounded-lg p-2.5 border border-slate-100 text-center">
                    <div className="text-[10px] text-slate-400 uppercase">Valor USD</div>
                    <div className="text-lg font-bold text-slate-900">${resumen.costoRecepcionUSD.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2">
              <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={resumen.totalUnidades === 0}
                className="w-full sm:w-auto"
              >
                <Box className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">
                  {resumen.esRecepcionFinal ? 'Recibir y Completar Orden' : `Registrar Recepción #${numeroRecepcion}`}
                </span>
                <span className="sm:hidden">
                  {resumen.esRecepcionFinal ? 'Completar Orden' : `Recepción #${numeroRecepcion}`}
                </span>
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
