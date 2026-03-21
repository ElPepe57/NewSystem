import React, { useState, useMemo } from "react";
import {
  ArrowRightLeft,
  Plane,
  Calculator,
  DollarSign,
  Minus,
  Plus,
  Package,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  ScanLine,
  X as XIcon,
} from "lucide-react";
import { Modal, Button, Select, Badge } from "../../components/common";
import { BarcodeScanner } from "../../components/common/BarcodeScanner";
import type { Almacen } from "../../types/almacen.types";
import type { Unidad } from "../../types/unidad.types";
import type { Producto } from "../../types/producto.types";
import type { TransferenciaFormData, TipoTransferencia } from "../../types/transferencia.types";
import { unidadService } from "../../services/unidad.service";
import {
  esTipoTransferenciaInterna,
  esTipoTransferenciaInternacional,
  getLabelTipoTransferencia,
} from "../../utils/multiOrigen.helpers";

interface CreateTransferenciaModalProps {
  isOpen: boolean;
  loading: boolean;
  almacenesOrigen: Almacen[];
  almacenesDestinoPeru: Almacen[];
  viajeros: Almacen[];
  productosMap: Map<string, Producto>;
  onClose: () => void;
  onSubmit: (data: TransferenciaFormData) => Promise<void>;
}

export const CreateTransferenciaModal: React.FC<CreateTransferenciaModalProps> = ({
  isOpen,
  loading,
  almacenesOrigen,
  almacenesDestinoPeru,
  viajeros,
  productosMap,
  onClose,
  onSubmit,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState<Partial<TransferenciaFormData>>({
    tipo: 'internacional_peru',
    unidadesIds: []
  });
  const [unidadesDisponibles, setUnidadesDisponibles] = useState<Unidad[]>([]);
  const [unidadesSeleccionadas, setUnidadesSeleccionadas] = useState<string[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [costoFleteUnitarioPorProducto, setCostoFleteUnitarioPorProducto] = useState<Record<string, number>>({});
  const [agregarFleteAhora, setAgregarFleteAhora] = useState(false);
  const [productosExpandidos, setProductosExpandidos] = useState<Set<string>>(new Set());
  const [cantidadRapida, setCantidadRapida] = useState<Record<string, number>>({});
  const [showScanner, setShowScanner] = useState(false);

  const handleClose = () => {
    onClose();
    setStep(1);
    setFormData({ tipo: 'internacional_peru', unidadesIds: [] });
    setUnidadesSeleccionadas([]);
    setCostoFleteUnitarioPorProducto({});
    setAgregarFleteAhora(false);
    setProductosExpandidos(new Set());
    setCantidadRapida({});
  };

  const handleSelectOrigen = async (almacenId: string) => {
    setFormData({ ...formData, almacenOrigenId: almacenId, unidadesIds: [] });
    setUnidadesSeleccionadas([]);

    if (almacenId) {
      setLoadingUnidades(true);
      try {
        const unidades = await unidadService.getDisponiblesPorAlmacen(almacenId);
        setUnidadesDisponibles(unidades);
      } catch (error) {
        console.error('Error cargando unidades:', error);
        setUnidadesDisponibles([]);
      } finally {
        setLoadingUnidades(false);
      }
    } else {
      setUnidadesDisponibles([]);
    }
  };

  const toggleUnidad = (unidadId: string) => {
    setUnidadesSeleccionadas(prev =>
      prev.includes(unidadId)
        ? prev.filter(id => id !== unidadId)
        : [...prev, unidadId]
    );
  };

  const toggleProducto = (productoId: string) => {
    const unidadesDelProducto = unidadesDisponibles.filter(u => u.productoId === productoId);
    const idsDelProducto = unidadesDelProducto.map(u => u.id);
    const todasSeleccionadas = idsDelProducto.every(id => unidadesSeleccionadas.includes(id));

    if (todasSeleccionadas) {
      setUnidadesSeleccionadas(prev => prev.filter(id => !idsDelProducto.includes(id)));
    } else {
      setUnidadesSeleccionadas(prev => [...new Set([...prev, ...idsDelProducto])]);
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    setShowScanner(false);
    let productoId = Object.keys(unidadesAgrupadas).find(pid =>
      unidadesAgrupadas[pid].sku === barcode
    );
    if (!productoId) {
      try {
        const { ProductoService } = await import('../../services/producto.service');
        const producto = await ProductoService.getByCodigoUPC(barcode);
        if (producto && unidadesAgrupadas[producto.id]) {
          productoId = producto.id;
        }
      } catch { /* silent */ }
    }
    if (productoId) {
      toggleProducto(productoId);
    } else {
      alert(`Codigo ${barcode} no encontrado en unidades disponibles`);
    }
  };

  const seleccionarCantidad = (productoId: string, cantidad: number) => {
    const unidadesDelProducto = unidadesDisponibles
      .filter(u => u.productoId === productoId)
      .sort((a, b) => {
        const fechaA = a.fechaVencimiento?.toDate?.()?.getTime() || 0;
        const fechaB = b.fechaVencimiento?.toDate?.()?.getTime() || 0;
        return fechaA - fechaB;
      });

    const sinProducto = unidadesSeleccionadas.filter(
      id => !unidadesDelProducto.map(u => u.id).includes(id)
    );

    const idsASeleccionar = unidadesDelProducto.slice(0, cantidad).map(u => u.id);
    setUnidadesSeleccionadas([...sinProducto, ...idsASeleccionar]);
  };

  const toggleExpandirProducto = (productoId: string) => {
    setProductosExpandidos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productoId)) {
        newSet.delete(productoId);
      } else {
        newSet.add(productoId);
      }
      return newSet;
    });
  };

  const seleccionarTodas = () => {
    setUnidadesSeleccionadas(unidadesDisponibles.map(u => u.id));
  };

  const deseleccionarTodas = () => {
    setUnidadesSeleccionadas([]);
  };

  const unidadesAgrupadas = useMemo(() => {
    const grupos: { [productoId: string]: { nombre: string; sku: string; unidades: Unidad[] } } = {};
    unidadesDisponibles.forEach(u => {
      if (!grupos[u.productoId]) {
        grupos[u.productoId] = { nombre: u.productoNombre, sku: u.productoSKU, unidades: [] };
      }
      grupos[u.productoId].unidades.push(u);
    });
    return grupos;
  }, [unidadesDisponibles]);

  const productosConUnidadesSeleccionadas = useMemo(() => {
    const resultado: { productoId: string; nombre: string; sku: string; unidades: number; costoMercancia: number }[] = [];

    Object.entries(unidadesAgrupadas).forEach(([productoId, grupo]) => {
      const unidadesSelec = grupo.unidades.filter(u => unidadesSeleccionadas.includes(u.id));
      if (unidadesSelec.length > 0) {
        resultado.push({
          productoId,
          nombre: grupo.nombre,
          sku: grupo.sku,
          unidades: unidadesSelec.length,
          costoMercancia: unidadesSelec.reduce((sum, u) => sum + u.costoUnitarioUSD, 0)
        });
      }
    });

    return resultado;
  }, [unidadesAgrupadas, unidadesSeleccionadas]);

  const costoFleteTotalPorProducto = useMemo(() => {
    const resultado: Record<string, number> = {};
    productosConUnidadesSeleccionadas.forEach(prod => {
      const costoUnitario = costoFleteUnitarioPorProducto[prod.productoId] || 0;
      resultado[prod.productoId] = costoUnitario * prod.unidades;
    });
    return resultado;
  }, [productosConUnidadesSeleccionadas, costoFleteUnitarioPorProducto]);

  const costoFleteTotal = useMemo(() => {
    return Object.values(costoFleteTotalPorProducto).reduce((sum, costo) => sum + (costo || 0), 0);
  }, [costoFleteTotalPorProducto]);

  const resumenSeleccion = useMemo(() => {
    const seleccionadas = unidadesDisponibles.filter(u => unidadesSeleccionadas.includes(u.id));
    const costoTotal = seleccionadas.reduce((sum, u) => sum + u.costoUnitarioUSD, 0);
    const productosUnicos = new Set(seleccionadas.map(u => u.productoId)).size;
    return { cantidad: seleccionadas.length, costoTotal, productosUnicos };
  }, [unidadesDisponibles, unidadesSeleccionadas]);

  const handleSubmit = async () => {
    if (!formData.almacenOrigenId || !formData.almacenDestinoId) return;
    if (unidadesSeleccionadas.length === 0) {
      alert('Debes seleccionar al menos una unidad');
      return;
    }

    try {
      const dataFinal: TransferenciaFormData = {
        ...formData as TransferenciaFormData,
        unidadesIds: unidadesSeleccionadas,
        costoFletePorProducto: agregarFleteAhora ? costoFleteTotalPorProducto : {}
      };
      await onSubmit(dataFinal);
      handleClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert("Error: " + message);
    }
  };

  const almacenesOrigenModal = almacenesOrigen;
  const almacenesDestinoModal = esTipoTransferenciaInternacional(formData.tipo as TipoTransferencia)
    ? almacenesDestinoPeru
    : almacenesOrigen.filter(a => a.id !== formData.almacenOrigenId);

  const canProceedToStep2 = formData.almacenOrigenId && formData.almacenDestinoId;
  const canProceedToStep3 = unidadesSeleccionadas.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Nueva Transferencia - Paso ${step} de 3`}
      size="xl"
    >
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 1 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'}`}>1</div>
          <div className={`w-24 h-1 mx-2 ${step >= 2 ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 2 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'}`}>2</div>
          <div className={`w-24 h-1 mx-2 ${step >= 3 ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 3 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'}`}>3</div>
        </div>
      </div>

      {/* Step 1: Configuracion basica */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Transferencia
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, tipo: 'internacional_peru', almacenDestinoId: undefined })}
                className={`p-4 rounded-lg border-2 text-center transition-all ${
                  esTipoTransferenciaInternacional(formData.tipo as TipoTransferencia)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Plane className="h-8 w-8 mx-auto mb-2" />
                <span className="block font-medium">Origen → Peru</span>
                <span className="text-xs">Envio internacional</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, tipo: 'interna_origen', almacenDestinoId: undefined })}
                className={`p-4 rounded-lg border-2 text-center transition-all ${
                  esTipoTransferenciaInterna(formData.tipo as TipoTransferencia)
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <ArrowRightLeft className="h-8 w-8 mx-auto mb-2" />
                <span className="block font-medium">Interna Origen</span>
                <span className="text-xs">Entre viajeros/almacenes</span>
              </button>
            </div>
          </div>

          <Select
            label="Almacen/Viajero Origen"
            value={formData.almacenOrigenId || ''}
            onChange={(e) => handleSelectOrigen(e.target.value)}
            options={[
              { value: '', label: 'Seleccionar origen...' },
              ...almacenesOrigenModal.map(a => ({
                value: a.id,
                label: `${a.nombre} (${a.codigo}) [${a.pais}] - ${a.unidadesActuales || 0} uds`
              }))
            ]}
            required
          />

          <Select
            label={esTipoTransferenciaInternacional(formData.tipo as TipoTransferencia) ? 'Almacen Destino (Peru)' : 'Viajero/Almacen Destino'}
            value={formData.almacenDestinoId || ''}
            onChange={(e) => setFormData({ ...formData, almacenDestinoId: e.target.value })}
            options={[
              { value: '', label: 'Seleccionar destino...' },
              ...almacenesDestinoModal.map(a => ({
                value: a.id,
                label: `${a.nombre} (${a.codigo}) [${a.pais}]`
              }))
            ]}
            required
            disabled={!formData.almacenOrigenId}
          />

          {esTipoTransferenciaInternacional(formData.tipo as TipoTransferencia) && (
            <Select
              label="Viajero que transporta"
              value={formData.viajeroId || ''}
              onChange={(e) => setFormData({ ...formData, viajeroId: e.target.value })}
              options={[
                { value: '', label: 'Seleccionar viajero...' },
                ...viajeros.map(v => ({
                  value: v.id,
                  label: `${v.nombre} - ${v.frecuenciaViaje || 'Sin frecuencia definida'}`
                }))
              ]}
            />
          )}

          {esTipoTransferenciaInterna(formData.tipo as TipoTransferencia) && (
            <Select
              label="Motivo de la transferencia"
              value={formData.motivo || ''}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value as TransferenciaFormData['motivo'] })}
              options={[
                { value: '', label: 'Seleccionar motivo...' },
                { value: 'consolidacion', label: 'Consolidacion de inventario' },
                { value: 'capacidad', label: 'Falta de capacidad' },
                { value: 'viaje_proximo', label: 'Mover a viajero con viaje proximo' },
                { value: 'costo_menor', label: 'Viajero con menor costo de flete' },
                { value: 'otro', label: 'Otro' }
              ]}
            />
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => setStep(2)}
              disabled={!canProceedToStep2}
            >
              Siguiente: Seleccionar Unidades
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Seleccion de unidades */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Resumen de seleccion - Sticky */}
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-primary-900">Unidades seleccionadas</h4>
                <p className="text-sm text-primary-700">
                  {resumenSeleccion.cantidad} unidades de {resumenSeleccion.productosUnicos} productos
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary-700">${resumenSeleccion.costoTotal.toFixed(2)}</div>
                <div className="text-xs text-primary-600">Valor total</div>
              </div>
            </div>

            {unidadesDisponibles.length > 0 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary-200">
                <button
                  type="button"
                  onClick={() => setShowScanner(!showScanner)}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors ${
                    showScanner ? 'bg-primary-200 text-primary-800' : 'text-primary-700 hover:text-primary-900 hover:bg-primary-100'
                  }`}
                >
                  <ScanLine className="h-3.5 w-3.5" />
                  Escanear
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={seleccionarTodas}
                    className="text-xs text-primary-700 hover:text-primary-900 font-medium"
                  >
                    Seleccionar todas ({unidadesDisponibles.length})
                  </button>
                  {unidadesSeleccionadas.length > 0 && (
                    <>
                      <span className="text-primary-300">|</span>
                      <button
                        type="button"
                        onClick={deseleccionarTodas}
                        className="text-xs text-primary-700 hover:text-primary-900 font-medium"
                      >
                        Limpiar seleccion
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {showScanner && (
              <div className="mt-3 p-3 bg-white border border-primary-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700">Escanear producto</span>
                  <button type="button" onClick={() => setShowScanner(false)} className="text-gray-400 hover:text-gray-600">
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
                <BarcodeScanner onScan={handleBarcodeScan} mode="both" compact />
              </div>
            )}
          </div>

          {/* Lista de unidades agrupadas por producto */}
          {loadingUnidades ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : Object.keys(unidadesAgrupadas).length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No hay unidades disponibles en este almacen</p>
              <p className="text-sm text-gray-500 mt-1">Primero debes recibir una orden de compra</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {Object.entries(unidadesAgrupadas).map(([productoId, grupo]) => {
                const unidadesProductoSeleccionadas = grupo.unidades.filter(u => unidadesSeleccionadas.includes(u.id)).length;
                const todasSeleccionadas = unidadesProductoSeleccionadas === grupo.unidades.length;
                const estaExpandido = productosExpandidos.has(productoId);
                const cantidadInput = cantidadRapida[productoId] ?? unidadesProductoSeleccionadas;

                return (
                  <div key={productoId} className="border rounded-lg overflow-hidden bg-white">
                    <div className="p-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center flex-1">
                          <input
                            type="checkbox"
                            checked={todasSeleccionadas}
                            onChange={() => toggleProducto(productoId)}
                            className="h-4 w-4 text-primary-600 rounded mr-3 flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-gray-900 truncate">{grupo.nombre}</h4>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              <span className="text-xs text-gray-500">{grupo.sku}</span>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs text-green-600 font-medium">
                                ${grupo.unidades[0]?.costoUnitarioUSD.toFixed(2)}/u
                              </span>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs text-gray-500">
                                Total: ${grupo.unidades.reduce((s, u) => s + u.costoUnitarioUSD, 0).toFixed(2)}
                              </span>
                              {(() => {
                                const fechas = grupo.unidades
                                  .map(u => u.fechaVencimiento?.toDate?.())
                                  .filter(Boolean)
                                  .sort((a, b) => a!.getTime() - b!.getTime());
                                if (fechas.length === 0) return null;
                                const proximaVencer = fechas[0]!;
                                const diasRestantes = Math.ceil((proximaVencer.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                return (
                                  <>
                                    <span className="text-xs text-gray-300">·</span>
                                    <span className={`text-xs ${diasRestantes < 90 ? 'text-red-600 font-medium' : diasRestantes < 180 ? 'text-amber-600' : 'text-gray-500'}`}>
                                      Vence: {proximaVencer.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      {diasRestantes < 180 && ` (${diasRestantes}d)`}
                                    </span>
                                  </>
                                );
                              })()}
                              {grupo.unidades[0]?.ordenCompraNumero && (
                                <>
                                  <span className="text-xs text-gray-300">·</span>
                                  <span className="text-xs text-blue-600">{grupo.unidades[0].ordenCompraNumero}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 ml-3">
                          <div className="flex items-center bg-white border rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newCant = Math.max(0, cantidadInput - 1);
                                setCantidadRapida({ ...cantidadRapida, [productoId]: newCant });
                                seleccionarCantidad(productoId, newCant);
                              }}
                              className="px-2 py-1 text-gray-500 hover:bg-gray-100 border-r"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              value={cantidadInput}
                              onChange={(e) => {
                                const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), grupo.unidades.length);
                                setCantidadRapida({ ...cantidadRapida, [productoId]: val });
                              }}
                              onBlur={() => {
                                seleccionarCantidad(productoId, cantidadInput);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  seleccionarCantidad(productoId, cantidadInput);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-12 text-center text-sm py-1 border-0 focus:ring-0"
                              min="0"
                              max={grupo.unidades.length}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newCant = Math.min(grupo.unidades.length, cantidadInput + 1);
                                setCantidadRapida({ ...cantidadRapida, [productoId]: newCant });
                                seleccionarCantidad(productoId, newCant);
                              }}
                              className="px-2 py-1 text-gray-500 hover:bg-gray-100 border-l"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <Badge variant={todasSeleccionadas ? 'success' : unidadesProductoSeleccionadas > 0 ? 'warning' : 'default'}>
                            {unidadesProductoSeleccionadas}/{grupo.unidades.length}
                          </Badge>

                          <button
                            type="button"
                            onClick={() => toggleExpandirProducto(productoId)}
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

                      {!estaExpandido && unidadesProductoSeleccionadas > 0 && (
                        <div className="mt-2 text-xs text-gray-500 ml-7">
                          Seleccion FEFO: primeras {unidadesProductoSeleccionadas} unidades por vencer
                        </div>
                      )}
                    </div>

                    {estaExpandido && (
                      <div className="divide-y max-h-48 overflow-y-auto">
                        {grupo.unidades
                          .sort((a, b) => {
                            const fechaA = a.fechaVencimiento?.toDate?.()?.getTime() || 0;
                            const fechaB = b.fechaVencimiento?.toDate?.()?.getTime() || 0;
                            return fechaA - fechaB;
                          })
                          .map((unidad, idx) => (
                          <div
                            key={unidad.id}
                            className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                              unidadesSeleccionadas.includes(unidad.id) ? 'bg-primary-50' : 'hover:bg-gray-50'
                            }`}
                            onClick={() => toggleUnidad(unidad.id)}
                          >
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={unidadesSeleccionadas.includes(unidad.id)}
                                onChange={() => toggleUnidad(unidad.id)}
                                className="h-4 w-4 text-primary-600 rounded mr-3"
                              />
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                                    #{idx + 1}
                                  </span>
                                  <span className="text-sm text-gray-900">Lote: {unidad.lote}</span>
                                  {unidad.ordenCompraNumero && (
                                    <span className="text-xs text-blue-600">{unidad.ordenCompraNumero}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>
                                    Vence: {unidad.fechaVencimiento?.toDate?.().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) || 'N/A'}
                                  </span>
                                  {(() => {
                                    const fecha = unidad.fechaVencimiento?.toDate?.();
                                    if (!fecha) return null;
                                    const dias = Math.ceil((fecha.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                    if (dias < 90) return <span className="text-red-600 font-medium">({dias}d)</span>;
                                    if (dias < 180) return <span className="text-amber-600">({dias}d)</span>;
                                    return null;
                                  })()}
                                  <span className="text-gray-300">·</span>
                                  <span>Recibida: {unidad.fechaRecepcion?.toDate?.().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                            <span className="text-sm font-medium text-gray-900">${unidad.costoUnitarioUSD.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>
              Anterior
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => setStep(3)}
              disabled={!canProceedToStep3}
            >
              Siguiente: Confirmar
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmacion (flete opcional) */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Resumen de Transferencia</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Tipo:</span>
                <span className="ml-2 font-medium">{getLabelTipoTransferencia(formData.tipo as TipoTransferencia)}</span>
              </div>
              <div>
                <span className="text-gray-500">Unidades:</span>
                <span className="ml-2 font-medium">{resumenSeleccion.cantidad}</span>
              </div>
              <div>
                <span className="text-gray-500">Productos:</span>
                <span className="ml-2 font-medium">{resumenSeleccion.productosUnicos}</span>
              </div>
              <div>
                <span className="text-gray-500">Valor mercancia:</span>
                <span className="ml-2 font-medium">${resumenSeleccion.costoTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {esTipoTransferenciaInternacional(formData.tipo as TipoTransferencia) && (
            <div>
              <label className="flex items-center gap-3 cursor-pointer select-none mb-3">
                <input
                  type="checkbox"
                  checked={agregarFleteAhora}
                  onChange={(e) => {
                    setAgregarFleteAhora(e.target.checked);
                    if (!e.target.checked) {
                      setCostoFleteUnitarioPorProducto({});
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Agregar costo de flete ahora</span>
                  <p className="text-xs text-gray-500">Puedes agregar o editar el flete despues desde el detalle de la transferencia</p>
                </div>
              </label>

              {agregarFleteAhora && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <Calculator className="h-5 w-5 text-blue-600 mr-2" />
                      <h4 className="font-medium text-blue-900">Costo de Flete por Producto</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-700">${costoFleteTotal.toFixed(2)}</div>
                      <div className="text-xs text-blue-600">Total Flete</div>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {productosConUnidadesSeleccionadas.map((producto) => {
                      const pFull = productosMap.get(producto.productoId);
                      return (
                        <div key={producto.productoId} className="bg-white rounded-lg p-3 border border-blue-100">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-gray-900 truncate">{pFull?.nombreComercial || producto.nombre}</h5>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                {pFull?.marca && <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1 py-0 rounded">{pFull.marca}</span>}
                                {pFull?.presentacion && <span className="text-[10px] text-gray-600 bg-gray-100 px-1 py-0 rounded capitalize">{pFull.presentacion.replace('_', ' ')}</span>}
                                {pFull?.dosaje && <span className="text-[10px] text-gray-600 bg-gray-100 px-1 py-0 rounded">{pFull.dosaje}</span>}
                                {pFull?.contenido && <span className="text-[10px] text-gray-600 bg-gray-100 px-1 py-0 rounded">{pFull.contenido}</span>}
                                {pFull?.sabor && <span className="text-[10px] text-purple-700 bg-purple-50 px-1 py-0 rounded">{pFull.sabor}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                                <span>{producto.sku}</span>
                                <span>•</span>
                                <span>{producto.unidades} unidades</span>
                                <span>•</span>
                                <span>Mercancia: ${producto.costoMercancia.toFixed(2)}</span>
                              </div>
                            </div>

                            <div className="flex-shrink-0 w-40">
                              <label className="block text-xs text-gray-500 mb-1">Flete por unidad (USD)</label>
                              <div className="relative">
                                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                                <input
                                  type="number"
                                  value={costoFleteUnitarioPorProducto[producto.productoId] || ''}
                                  onChange={(e) => {
                                    const valor = parseFloat(e.target.value) || 0;
                                    setCostoFleteUnitarioPorProducto(prev => ({
                                      ...prev,
                                      [producto.productoId]: valor
                                    }));
                                  }}
                                  className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                                  placeholder="0.00"
                                  step="0.01"
                                  min="0"
                                />
                              </div>
                              {(costoFleteUnitarioPorProducto[producto.productoId] || 0) > 0 && (
                                <div className="text-xs text-blue-600 mt-1 text-right">
                                  Total: ${costoFleteTotalPorProducto[producto.productoId]?.toFixed(2) || '0.00'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {costoFleteTotal > 0 && (
                    <div className="mt-4 pt-3 border-t border-blue-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Total mercancia:</span>
                        <span className="font-medium">${resumenSeleccion.costoTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-gray-600">Total flete:</span>
                        <span className="font-medium">${costoFleteTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-base mt-2 pt-2 border-t border-blue-200">
                        <span className="font-medium text-gray-900">Costo total transferencia:</span>
                        <span className="font-bold text-blue-700">${(resumenSeleccion.costoTotal + costoFleteTotal).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!agregarFleteAhora && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      La transferencia se creara sin costo de flete. Podras agregarlo en cualquier momento desde el detalle de la transferencia.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {esTipoTransferenciaInterna(formData.tipo as TipoTransferencia) && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center">
                <ArrowRightLeft className="h-5 w-5 text-purple-600 mr-2" />
                <span className="text-sm text-purple-700">
                  Las transferencias internas en USA no generan costo de flete.
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea
              value={formData.notas || ''}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Notas adicionales..."
            />
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setStep(2)}>
              Anterior
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Creando...' : 'Crear Transferencia'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
