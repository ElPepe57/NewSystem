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
  Trash2,
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

// ---- Helpers ----
const MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

const currentYear = new Date().getFullYear();
const ANIOS = Array.from({ length: 6 }, (_, i) => currentYear + i);

/** Último día del mes (ej: mes=3, anio=2027 → 31) */
function ultimoDiaMes(mes: number, anio: number): number {
  return new Date(anio, mes, 0).getDate();
}

/** Convierte mes/año a YYYY-MM-DD (último día del mes) */
function mesAnioToDateStr(mes: number, anio: number): string {
  const dia = ultimoDiaMes(mes, anio);
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Calcula días hasta vencimiento desde mes/año */
function diasHastaVencimiento(mes: number, anio: number): number {
  const fecha = new Date(anio, mes - 1, ultimoDiaMes(mes, anio));
  return Math.ceil((fecha.getTime() - Date.now()) / 86400000);
}

// ---- Grupo de vencimiento para la UI ----
interface LoteInput {
  mes: number;   // 1-12
  anio: number;
  cantidad: number;
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
      return {
        productoId,
        nombreFallback: pSummary?.nombre || unids[0].sku,
        sku: unids[0].sku,
        costoFleteUnit,
        costoFleteTotal,
        unidades: unids,
        totalEnvio,
        yaRecibido,
        pendiente: unids.length
      };
    });
  }, [transferencia, unidadesPendientes]);

  // ---- Estado: cantidad a recibir por producto ----
  const [cantidadRecibir, setCantidadRecibir] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    productosAgrupados.forEach(p => { init[p.productoId] = 0; });
    return init;
  });

  // ---- Estado: lotes por producto (multi-lote con mes/año) ----
  const [lotesPorProducto, setLotesPorProducto] = useState<Record<string, LoteInput[]>>(() => {
    const init: Record<string, LoteInput[]> = {};
    const mesActual = new Date().getMonth() + 1;
    productosAgrupados.forEach(p => {
      init[p.productoId] = [{
        mes: mesActual,
        anio: currentYear + 1,
        cantidad: 0
      }];
    });
    return init;
  });

  const [observaciones, setObservaciones] = useState('');
  const [costoRecojoPEN, setCostoRecojoPEN] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [showRecepcionScanner, setShowRecepcionScanner] = useState(false);
  const [productosExpandidos, setProductosExpandidos] = useState<Set<string>>(new Set());

  const totalARecibir = Object.values(cantidadRecibir).reduce((s, v) => s + v, 0);
  const totalPendiente = unidadesPendientes.length;

  // Validar: cada producto con cantidad > 0 debe tener lotes que sumen = cantidad
  const productosConErrorLotes = productosAgrupados.filter(p => {
    const cant = cantidadRecibir[p.productoId] || 0;
    if (cant === 0) return false;
    const lotes = lotesPorProducto[p.productoId] || [];
    const sumaLotes = lotes.reduce((s, l) => s + l.cantidad, 0);
    return sumaLotes !== cant || lotes.some(l => !l.mes || !l.anio);
  });
  const hayErrorLotes = productosConErrorLotes.length > 0;

  // ---- Handlers ----
  const handleRecibirTodo = (checked: boolean) => {
    const next: Record<string, number> = {};
    productosAgrupados.forEach(p => {
      next[p.productoId] = checked ? p.pendiente : 0;
    });
    setCantidadRecibir(next);

    // Auto-asignar cantidad al primer lote
    if (checked) {
      setLotesPorProducto(prev => {
        const updated = { ...prev };
        productosAgrupados.forEach(p => {
          const lotes = updated[p.productoId] || [];
          if (lotes.length > 0) {
            const sumaOtros = lotes.slice(1).reduce((s, l) => s + l.cantidad, 0);
            updated[p.productoId] = [
              { ...lotes[0], cantidad: p.pendiente - sumaOtros },
              ...lotes.slice(1)
            ];
          }
        });
        return updated;
      });
    }
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
      return p.sku === barcode || (pFull as any)?.codigoBarras === barcode || (pFull as any)?.upc === barcode || (pFull as any)?.codigoUPC === barcode;
    });
    if (prod) {
      const current = cantidadRecibir[prod.productoId] || 0;
      if (current < prod.pendiente) {
        const newCant = current + 1;
        setCantidadRecibir(prev => ({ ...prev, [prod.productoId]: newCant }));
        // Auto-asignar al primer lote
        setLotesPorProducto(prev => {
          const lotes = prev[prod.productoId] || [];
          if (lotes.length > 0) {
            const sumaOtros = lotes.slice(1).reduce((s, l) => s + l.cantidad, 0);
            return {
              ...prev,
              [prod.productoId]: [
                { ...lotes[0], cantidad: newCant - sumaOtros },
                ...lotes.slice(1)
              ]
            };
          }
          return prev;
        });
      }
    }
  };

  const handleCantidadChange = (productoId: string, nuevaCant: number) => {
    setCantidadRecibir(prev => ({ ...prev, [productoId]: nuevaCant }));
    // Ajustar primer lote
    setLotesPorProducto(prev => {
      const lotes = prev[productoId] || [];
      if (lotes.length > 0) {
        const sumaOtros = lotes.slice(1).reduce((s, l) => s + l.cantidad, 0);
        return {
          ...prev,
          [productoId]: [
            { ...lotes[0], cantidad: Math.max(0, nuevaCant - sumaOtros) },
            ...lotes.slice(1)
          ]
        };
      }
      return prev;
    });
  };

  const handleAgregarLote = (productoId: string) => {
    setLotesPorProducto(prev => ({
      ...prev,
      [productoId]: [
        ...(prev[productoId] || []),
        { mes: new Date().getMonth() + 1, anio: currentYear + 1, cantidad: 0 }
      ]
    }));
  };

  const handleEliminarLote = (productoId: string, idx: number) => {
    setLotesPorProducto(prev => {
      const lotes = [...(prev[productoId] || [])];
      const removed = lotes.splice(idx, 1)[0];
      // Re-asignar cantidad del lote eliminado al primero
      if (lotes.length > 0) {
        lotes[0] = { ...lotes[0], cantidad: lotes[0].cantidad + removed.cantidad };
      }
      return { ...prev, [productoId]: lotes };
    });
  };

  const handleLoteFieldChange = (productoId: string, idx: number, field: keyof LoteInput, value: number | string) => {
    setLotesPorProducto(prev => {
      const lotes = [...(prev[productoId] || [])];
      lotes[idx] = { ...lotes[idx], [field]: value };
      return { ...prev, [productoId]: lotes };
    });
  };

  // ---- Submit ----
  const handleSubmit = async () => {
    if (totalARecibir === 0) return;
    setSubmitting(true);
    try {
      const unidadesRecibidas: RecepcionFormData['unidadesRecibidas'] = [];
      const fechasVencimiento: Record<string, string> = {};

      for (const prod of productosAgrupados) {
        const cant = cantidadRecibir[prod.productoId] || 0;
        const lotes = lotesPorProducto[prod.productoId] || [];

        // Asignar unidades a lotes en orden
        let unidadIdx = 0;
        for (const lote of lotes) {
          for (let i = 0; i < lote.cantidad && unidadIdx < prod.unidades.length; i++) {
            const u = prod.unidades[unidadIdx];
            unidadesRecibidas.push({ unidadId: u.unidadId, recibida: true, danada: false });
            fechasVencimiento[u.unidadId] = mesAnioToDateStr(lote.mes, lote.anio);
            unidadIdx++;
          }
        }
        // Unidades no recibidas
        for (; unidadIdx < prod.unidades.length; unidadIdx++) {
          unidadesRecibidas.push({
            unidadId: prod.unidades[unidadIdx].unidadId,
            recibida: false,
            danada: false
          });
        }
      }

      await onConfirm({
        transferenciaId: transferencia.id,
        unidadesRecibidas,
        fechasVencimiento: Object.keys(fechasVencimiento).length > 0 ? fechasVencimiento : undefined,
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
            const lotes = lotesPorProducto[prod.productoId] || [];
            const sumaLotes = lotes.reduce((s, l) => s + l.cantidad, 0);
            const lotesValidos = cant > 0 && sumaLotes === cant;

            return (
              <div key={prod.productoId} className="border rounded-lg overflow-hidden bg-white">
                <div className="p-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <input
                        type="checkbox"
                        checked={todoRecibido}
                        onChange={() => handleCantidadChange(prod.productoId, todoRecibido ? 0 : prod.pendiente)}
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
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{prod.sku}</div>
                        {prod.costoFleteUnit > 0 && (
                          <div className="text-xs text-green-600 font-medium mt-0.5">
                            Flete: ${prod.costoFleteUnit.toFixed(2)}/u
                          </div>
                        )}
                        {prod.yaRecibido > 0 && (
                          <div className="flex items-center gap-1 text-xs text-green-600 mt-0.5">
                            <CheckCircle className="h-3 w-3" />
                            {prod.yaRecibido} ya recibidas
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 ml-3">
                      <div className="flex items-center bg-white border rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCantidadChange(prod.productoId, Math.max(0, cant - 1));
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
                            handleCantidadChange(prod.productoId, val);
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
                            handleCantidadChange(prod.productoId, Math.min(prod.pendiente, cant + 1));
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
                        {estaExpandido ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Sección de lotes con mes/año — visible cuando hay cantidad > 0 */}
                  {cant > 0 && (
                    <div className={`mt-3 p-3 rounded-lg border ${lotesValidos ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-1.5 text-xs font-medium" style={{
                          color: lotesValidos ? '#166534' : '#92400E'
                        }}>
                          <Calendar className="h-3.5 w-3.5" />
                          Vencimiento {lotes.length > 1 ? `(${lotes.length} fechas)` : ''}
                        </label>
                        {!lotesValidos && (
                          <span className="text-xs text-red-500">
                            {sumaLotes}/{cant} unidades asignadas
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {lotes.map((lote, idx) => {
                          const dias = lote.mes && lote.anio ? diasHastaVencimiento(lote.mes, lote.anio) : null;
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              {/* Mes */}
                              <select
                                value={lote.mes}
                                onChange={(e) => handleLoteFieldChange(prod.productoId, idx, 'mes', parseInt(e.target.value))}
                                className="text-sm border rounded px-2 py-1.5 bg-white focus:ring-1 focus:ring-primary-500 w-20"
                              >
                                {MESES.map((m, i) => (
                                  <option key={i} value={i + 1}>{m}</option>
                                ))}
                              </select>
                              {/* Año */}
                              <select
                                value={lote.anio}
                                onChange={(e) => handleLoteFieldChange(prod.productoId, idx, 'anio', parseInt(e.target.value))}
                                className="text-sm border rounded px-2 py-1.5 bg-white focus:ring-1 focus:ring-primary-500 w-20"
                              >
                                {ANIOS.map(a => (
                                  <option key={a} value={a}>{a}</option>
                                ))}
                              </select>
                              {/* Cantidad */}
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={lote.cantidad || ''}
                                  onChange={(e) => handleLoteFieldChange(prod.productoId, idx, 'cantidad', Math.max(0, parseInt(e.target.value) || 0))}
                                  className="text-sm border rounded px-2 py-1.5 bg-white focus:ring-1 focus:ring-primary-500 w-14 text-center"
                                  min="0"
                                  placeholder="0"
                                />
                                <span className="text-xs text-gray-400">uds</span>
                              </div>
                              {/* Eliminar lote (solo si hay más de 1) */}
                              {lotes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleEliminarLote(prod.productoId, idx)}
                                  className="p-1 text-gray-400 hover:text-red-500"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {/* Indicador de días */}
                              {dias !== null && (
                                <span className={`text-[10px] whitespace-nowrap ${
                                  dias < 0 ? 'text-red-600' : dias < 90 ? 'text-amber-600' : 'text-green-600'
                                }`}>
                                  {dias < 0 ? 'Vencido' : `${dias}d`}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Agregar lote */}
                      <button
                        type="button"
                        onClick={() => handleAgregarLote(prod.productoId)}
                        className="mt-2 text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Otra fecha de vencimiento
                      </button>
                    </div>
                  )}
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

        {/* C3: Costo de recojo en Peru */}
        {transferencia.tipo === 'internacional_peru' || transferencia.tipo === 'usa_peru' ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <label className="block text-sm font-medium text-amber-800 mb-1">
              Costo de recojo en Peru (S/) — opcional
            </label>
            <p className="text-xs text-amber-600 mb-2">
              Taxi, mensajero u otro costo para recoger del courier/viajero al almacen.
              Se prorratea entre las {totalARecibir} unidades de esta recepcion.
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
            disabled={submitting || totalARecibir === 0 || hayErrorLotes}
          >
            {submitting ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Procesando...
              </span>
            ) : hayErrorLotes ? (
              <span className="flex items-center text-sm">
                Asignar unidades por vencimiento ({productosConErrorLotes.length})
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
