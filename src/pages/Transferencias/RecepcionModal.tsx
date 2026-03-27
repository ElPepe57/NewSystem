import React, { useState, useMemo } from "react";
import {
  CheckCircle,
  Package,
  Minus,
  Plus,
  ChevronRight,
  ChevronDown,
  ScanLine,
  X as XIcon,
  Calendar,
} from "lucide-react";
import { Modal, Button, Badge } from "../../components/common";
import { BarcodeScanner } from "../../components/common/BarcodeScanner";
import type { Transferencia, RecepcionFormData } from "../../types/transferencia.types";
import type { Producto } from "../../types/producto.types";

interface RecepcionModalProps {
  transferencia: Transferencia;
  productosMap: Map<string, Producto>;
  onClose: () => void;
  onConfirm: (data: RecepcionFormData) => Promise<void>;
}

export const RecepcionModal: React.FC<RecepcionModalProps> = ({
  transferencia,
  productosMap,
  onClose,
  onConfirm,
}) => {
  const unidadesPendientes = transferencia.unidades.filter(
    u => u.estadoTransferencia === 'enviada' || u.estadoTransferencia === 'faltante'
      || u.estadoTransferencia === 'pendiente' || u.estadoTransferencia === 'preparada'
  );
  const recepcionNumero = (transferencia.recepcionesTransferencia?.length || (transferencia.recepcion ? 1 : 0)) + 1;

  const productosAgrupados = useMemo(() => {
    const map = new Map<string, typeof unidadesPendientes>();
    for (const u of unidadesPendientes) {
      const arr = map.get(u.productoId) || [];
      arr.push(u);
      map.set(u.productoId, arr);
    }
    return [...map.entries()].map(([productoId, unids]) => {
      const pSummary = transferencia.productosSummary.find(p => p.productoId === productoId);
      const totalEnvio = pSummary?.cantidad || unids.length;
      const yaRecibido = transferencia.unidades.filter(u => u.productoId === productoId && u.estadoTransferencia === 'recibida').length;
      const costoFleteUnit = unids[0].costoFleteUSD || 0;
      const costoFleteTotal = unids.reduce((s, u) => s + (u.costoFleteUSD || 0), 0);
      const fechasVenc = unids
        .map(u => u.fechaVencimiento?.toDate?.())
        .filter(Boolean) as Date[];
      fechasVenc.sort((a, b) => a.getTime() - b.getTime());
      return {
        productoId,
        nombreFallback: pSummary?.nombre || unids[0].sku,
        sku: unids[0].sku,
        lote: unids[0].lote,
        fechaVencimiento: fechasVenc[0] || null,
        costoFleteUnit,
        costoFleteTotal,
        unidades: unids,
        totalEnvio,
        yaRecibido,
        pendiente: unids.length
      };
    });
  }, [transferencia, unidadesPendientes]);

  const [cantidadRecibir, setCantidadRecibir] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    productosAgrupados.forEach(p => { init[p.productoId] = 0; });
    return init;
  });
  const [fechasVencimiento, setFechasVencimiento] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState('');
  const [costoRecojoPEN, setCostoRecojoPEN] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [showRecepcionScanner, setShowRecepcionScanner] = useState(false);
  const [productosExpandidos, setProductosExpandidos] = useState<Set<string>>(new Set());

  const totalARecibir = Object.values(cantidadRecibir).reduce((s, v) => s + v, 0);
  const totalPendiente = unidadesPendientes.length;

  // Validar fechas de vencimiento obligatorias
  const productosSinFecha = productosAgrupados.filter(
    p => (cantidadRecibir[p.productoId] || 0) > 0 && !fechasVencimiento[p.productoId]
  );
  const faltanFechas = productosSinFecha.length > 0;

  const handleRecibirTodo = (checked: boolean) => {
    const next: Record<string, number> = {};
    productosAgrupados.forEach(p => { next[p.productoId] = checked ? p.pendiente : 0; });
    setCantidadRecibir(next);
  };

  const toggleExpandirProductoRecepcion = (productoId: string) => {
    setProductosExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(productoId)) next.delete(productoId);
      else next.add(productoId);
      return next;
    });
  };

  const handleRecepcionBarcodeScan = (barcode: string) => {
    const prod = productosAgrupados.find(p => {
      const pFull = productosMap.get(p.productoId);
      return p.sku === barcode || (pFull as any)?.codigoBarras === barcode || (pFull as any)?.upc === barcode;
    });
    if (prod) {
      const current = cantidadRecibir[prod.productoId] || 0;
      if (current < prod.pendiente) {
        setCantidadRecibir(prev => ({ ...prev, [prod.productoId]: current + 1 }));
      }
    }
  };

  const handleSubmit = async () => {
    if (totalARecibir === 0) return;
    setSubmitting(true);
    try {
      const unidadesRecibidas: RecepcionFormData['unidadesRecibidas'] = [];
      for (const prod of productosAgrupados) {
        const cant = cantidadRecibir[prod.productoId] || 0;
        prod.unidades.forEach((u, idx) => {
          unidadesRecibidas.push({
            unidadId: u.unidadId,
            recibida: idx < cant,
            danada: false
          });
        });
      }
      // Filter valid dates
      const fechasValidas: Record<string, string> = {};
      for (const [pid, fecha] of Object.entries(fechasVencimiento)) {
        if (fecha) fechasValidas[pid] = fecha;
      }

      await onConfirm({
        transferenciaId: transferencia.id,
        unidadesRecibidas,
        fechasVencimiento: Object.keys(fechasValidas).length > 0 ? fechasValidas : undefined,
        costoRecojoPEN: costoRecojoPEN ? parseFloat(costoRecojoPEN) : undefined,
        observaciones
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Recepcion de Productos - ${transferencia.numeroTransferencia}`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Sticky header */}
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-primary-900">Unidades a recibir</h4>
              <p className="text-sm text-primary-700">
                {totalARecibir} de {totalPendiente} pendientes · Recepcion #{recepcionNumero}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary-700">
                {totalPendiente > 0 ? Math.round((totalARecibir / totalPendiente) * 100) : 0}%
              </div>
              <div className="text-xs text-primary-600">Progreso</div>
            </div>
          </div>

          <div className="w-full bg-primary-200 rounded-full h-2 mt-3">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{ width: `${totalPendiente > 0 ? (totalARecibir / totalPendiente) * 100 : 0}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary-200">
            <button
              type="button"
              onClick={() => setShowRecepcionScanner(!showRecepcionScanner)}
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors ${
                showRecepcionScanner ? 'bg-primary-200 text-primary-800' : 'text-primary-700 hover:text-primary-900 hover:bg-primary-100'
              }`}
            >
              <ScanLine className="h-3.5 w-3.5" />
              Escanear
            </button>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleRecibirTodo(totalARecibir !== totalPendiente)}
                className="text-xs text-primary-700 hover:text-primary-900 font-medium"
              >
                Seleccionar todas ({totalPendiente})
              </button>
              {totalARecibir > 0 && (
                <>
                  <span className="text-primary-300">|</span>
                  <button
                    type="button"
                    onClick={() => handleRecibirTodo(false)}
                    className="text-xs text-primary-700 hover:text-primary-900 font-medium"
                  >
                    Limpiar seleccion
                  </button>
                </>
              )}
            </div>
          </div>

          {showRecepcionScanner && (
            <div className="mt-3 p-3 bg-white border border-primary-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">Escanear producto</span>
                <button type="button" onClick={() => setShowRecepcionScanner(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
              <BarcodeScanner onScan={handleRecepcionBarcodeScan} mode="both" compact />
            </div>
          )}
        </div>

        {/* Lista de productos agrupados */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {productosAgrupados.map((prod) => {
            const cant = cantidadRecibir[prod.productoId] || 0;
            const todoRecibido = cant === prod.pendiente;
            const estaExpandido = productosExpandidos.has(prod.productoId);
            const pFull = productosMap.get(prod.productoId);

            return (
              <div key={prod.productoId} className="border rounded-lg overflow-hidden bg-white">
                <div className="p-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <input
                        type="checkbox"
                        checked={todoRecibido}
                        onChange={() => setCantidadRecibir(prev => ({
                          ...prev,
                          [prod.productoId]: todoRecibido ? 0 : prod.pendiente
                        }))}
                        className="h-4 w-4 text-primary-600 rounded mr-3 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-gray-900 truncate">{pFull?.nombreComercial || prod.nombreFallback}</h4>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                          {pFull?.marca && (
                            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{pFull.marca}</span>
                          )}
                          {pFull?.presentacion && (
                            <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded capitalize">{pFull.presentacion.replace('_', ' ')}</span>
                          )}
                          {pFull?.dosaje && (
                            <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{pFull.dosaje}</span>
                          )}
                          {pFull?.contenido && (
                            <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{pFull.contenido}</span>
                          )}
                          {pFull?.sabor && (
                            <span className="text-xs text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">{pFull.sabor}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {prod.sku}
                        </div>
                        {prod.costoFleteUnit > 0 && (
                          <div className="text-xs text-green-600 font-medium mt-0.5">
                            Flete: ${prod.costoFleteUnit.toFixed(2)}/u · Total flete: ${prod.costoFleteTotal.toFixed(2)}
                          </div>
                        )}
                        {prod.yaRecibido > 0 && (
                          <div className="flex items-center gap-1 text-xs text-green-600 mt-0.5">
                            <CheckCircle className="h-3 w-3" />
                            {prod.yaRecibido} recibidas
                          </div>
                        )}

                        {/* Fecha de vencimiento — prominente */}
                        <div className={`mt-2 p-2 rounded-lg border ${
                          fechasVencimiento[prod.productoId]
                            ? 'bg-green-50 border-green-200'
                            : 'bg-amber-50 border-amber-200'
                        }`}>
                          <label className="flex items-center gap-1.5 text-xs font-medium mb-1" style={{
                            color: fechasVencimiento[prod.productoId] ? '#166534' : '#92400E'
                          }}>
                            <Calendar className="h-3.5 w-3.5" />
                            Fecha de vencimiento
                            {!fechasVencimiento[prod.productoId] && (
                              <span className="text-red-500 text-[10px]">* obligatorio</span>
                            )}
                          </label>
                          <input
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            max={new Date(Date.now() + 5 * 365 * 86400000).toISOString().split('T')[0]}
                            value={fechasVencimiento[prod.productoId] || ''}
                            onChange={(e) => setFechasVencimiento(prev => ({
                              ...prev,
                              [prod.productoId]: e.target.value,
                            }))}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-sm border rounded-md px-2 py-1.5 focus:ring-2 focus:ring-amber-400 bg-white"
                          />
                          {/* Feedback de fecha */}
                          {fechasVencimiento[prod.productoId] && (() => {
                            const dias = Math.ceil((new Date(fechasVencimiento[prod.productoId]).getTime() - Date.now()) / 86400000);
                            return dias < 0
                              ? <p className="text-xs text-red-600 mt-1">Fecha ya vencida — revisa el dato</p>
                              : dias < 90
                              ? <p className="text-xs text-amber-600 mt-1">Vence en {dias} días — vida útil corta</p>
                              : <p className="text-xs text-green-700 mt-1">Vence en {dias} días</p>;
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 ml-3">
                      <div className="flex items-center bg-white border rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newCant = Math.max(0, cant - 1);
                            setCantidadRecibir(prev => ({ ...prev, [prod.productoId]: newCant }));
                          }}
                          className="px-2 py-1 text-gray-500 hover:bg-gray-100 border-r"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          value={cant}
                          onChange={(e) => {
                            const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), prod.pendiente);
                            setCantidadRecibir(prev => ({ ...prev, [prod.productoId]: val }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-12 text-center text-sm py-1 border-0 focus:ring-0"
                          min="0"
                          max={prod.pendiente}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newCant = Math.min(prod.pendiente, cant + 1);
                            setCantidadRecibir(prev => ({ ...prev, [prod.productoId]: newCant }));
                          }}
                          className="px-2 py-1 text-gray-500 hover:bg-gray-100 border-l"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <Badge variant={todoRecibido ? 'success' : cant > 0 ? 'warning' : 'default'}>
                        {cant}/{prod.pendiente}
                      </Badge>

                      <button
                        type="button"
                        onClick={() => toggleExpandirProductoRecepcion(prod.productoId)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        {estaExpandido ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {estaExpandido && (
                  <div className="divide-y max-h-48 overflow-y-auto">
                    {prod.unidades.map((unidad, idx) => (
                      <div
                        key={unidad.unidadId}
                        className={`flex items-center justify-between p-3 ${
                          idx < cant ? 'bg-primary-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center">
                          <div className={`h-2 w-2 rounded-full mr-3 ${idx < cant ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                                #{idx + 1}
                              </span>
                              {unidad.lote && <span className="text-sm text-gray-900">Lote: {unidad.lote}</span>}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                              {unidad.estadoTransferencia === 'faltante' && (
                                <span className="text-amber-600 font-medium">Prev. faltante</span>
                              )}
                              <span>Estado: {unidad.estadoTransferencia}</span>
                            </div>
                          </div>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          idx < cant ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {idx < cant ? 'Se recibira' : 'Pendiente'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* C3: Costo de recojo en Perú */}
        {transferencia.tipo === 'internacional_peru' || transferencia.tipo === 'usa_peru' ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <label className="block text-sm font-medium text-amber-800 mb-1">
              Costo de recojo en Perú (S/) — opcional
            </label>
            <p className="text-xs text-amber-600 mb-2">
              Taxi, mensajero u otro costo para recoger del courier/viajero al almacén.
              Se prorratea entre las {totalARecibir} unidades de esta recepción.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.01"
                min="0"
                value={costoRecojoPEN}
                onChange={(e) => setCostoRecojoPEN(e.target.value)}
                className="w-40 px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                placeholder="Ej: 15.00"
              />
              {costoRecojoPEN && parseFloat(costoRecojoPEN) > 0 && totalARecibir > 0 && (
                <span className="text-xs text-amber-700">
                  = S/ {(parseFloat(costoRecojoPEN) / totalARecibir).toFixed(2)} por unidad
                </span>
              )}
            </div>
          </div>
        ) : null}

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observaciones (opcional)
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Ej: Paquete 2 de 3, tracking TBA12345..."
          />
        </div>

        {/* Botones */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || totalARecibir === 0 || faltanFechas}
          >
            {submitting ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Procesando...
              </span>
            ) : faltanFechas ? (
              <span className="flex items-center text-sm">
                Falta fecha de vencimiento ({productosSinFecha.length})
              </span>
            ) : (
              <span className="flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                Registrar Recepcion #{recepcionNumero}
              </span>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
