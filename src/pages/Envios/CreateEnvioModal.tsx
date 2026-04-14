import React, { useState, useMemo } from "react";
import { useToastStore } from "../../store/toastStore";
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
import type { EnvioFormData, TipoEnvio, MotivoEnvioInterno } from "../../types/envio.types";
import { getDescripcionProducto } from "../../utils/producto.helpers";
import { unidadService } from "../../services/unidad.service";

interface CreateEnvioModalProps {
  isOpen: boolean;
  loading: boolean;
  almacenesOrigen: Almacen[];
  almacenesDestinoPeru: Almacen[];
  viajeros: Almacen[];
  productosMap: Map<string, Producto>;
  onClose: () => void;
  onSubmit: (data: EnvioFormData) => Promise<void>;
}

const esInternacional = (tipo?: TipoEnvio): boolean => tipo === 'internacional_peru';
const esInterno = (tipo?: TipoEnvio): boolean => tipo === 'interna_origen';

export const CreateEnvioModal: React.FC<CreateEnvioModalProps> = ({
  isOpen,
  loading,
  almacenesOrigen,
  almacenesDestinoPeru,
  viajeros,
  productosMap,
  onClose,
  onSubmit,
}) => {
  const toast = useToastStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState<Partial<EnvioFormData>>({
    tipo: 'internacional_peru',
    origenTipo: 'casilla',
    unidadesIds: [],
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
    setFormData({ tipo: 'internacional_peru', origenTipo: 'casilla', unidadesIds: [] });
    setUnidadesSeleccionadas([]);
    setCostoFleteUnitarioPorProducto({});
    setAgregarFleteAhora(false);
    setProductosExpandidos(new Set());
    setCantidadRapida({});
  };

  const handleSelectOrigen = async (almacenId: string) => {
    setFormData({ ...formData, origenCasillaId: almacenId, unidadesIds: [] });
    setUnidadesSeleccionadas([]);
    if (almacenId) {
      setLoadingUnidades(true);
      try {
        const unidades = await unidadService.getDisponiblesPorAlmacen(almacenId);
        setUnidadesDisponibles(unidades);
      } catch {
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
      prev.includes(unidadId) ? prev.filter(id => id !== unidadId) : [...prev, unidadId]
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
        if (producto && unidadesAgrupadas[producto.id]) productoId = producto.id;
      } catch { /* silent */ }
    }
    if (productoId) {
      toggleProducto(productoId);
    } else {
      toast.warning(`Codigo ${barcode} no encontrado en unidades disponibles`);
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
      if (newSet.has(productoId)) newSet.delete(productoId);
      else newSet.add(productoId);
      return newSet;
    });
  };

  const unidadesAgrupadas = useMemo(() => {
    const grupos: { [productoId: string]: { nombre: string; sku: string; unidades: Unidad[] } } = {};
    unidadesDisponibles.forEach(u => {
      if (!grupos[u.productoId]) grupos[u.productoId] = { nombre: u.productoNombre, sku: u.productoSKU, unidades: [] };
      grupos[u.productoId].unidades.push(u);
    });
    return grupos;
  }, [unidadesDisponibles]);

  const productosConUnidadesSeleccionadas = useMemo(() => {
    return Object.entries(unidadesAgrupadas)
      .map(([productoId, grupo]) => {
        const unidadesSelec = grupo.unidades.filter(u => unidadesSeleccionadas.includes(u.id));
        if (unidadesSelec.length === 0) return null;
        return {
          productoId,
          nombre: grupo.nombre,
          sku: grupo.sku,
          unidades: unidadesSelec.length,
          costoMercancia: unidadesSelec.reduce((sum, u) => sum + u.costoUnitarioUSD, 0),
        };
      })
      .filter(Boolean) as { productoId: string; nombre: string; sku: string; unidades: number; costoMercancia: number }[];
  }, [unidadesAgrupadas, unidadesSeleccionadas]);

  const costoFleteTotalPorProducto = useMemo(() => {
    const resultado: Record<string, number> = {};
    productosConUnidadesSeleccionadas.forEach(prod => {
      const costoUnitario = costoFleteUnitarioPorProducto[prod.productoId] || 0;
      resultado[prod.productoId] = costoUnitario * prod.unidades;
    });
    return resultado;
  }, [productosConUnidadesSeleccionadas, costoFleteUnitarioPorProducto]);

  const costoFleteTotal = useMemo(
    () => Object.values(costoFleteTotalPorProducto).reduce((sum, c) => sum + (c || 0), 0),
    [costoFleteTotalPorProducto]
  );

  const resumenSeleccion = useMemo(() => {
    const seleccionadas = unidadesDisponibles.filter(u => unidadesSeleccionadas.includes(u.id));
    return {
      cantidad: seleccionadas.length,
      costoTotal: seleccionadas.reduce((sum, u) => sum + u.costoUnitarioUSD, 0),
      productosUnicos: new Set(seleccionadas.map(u => u.productoId)).size,
    };
  }, [unidadesDisponibles, unidadesSeleccionadas]);

  const handleSubmit = async () => {
    if (!formData.origenCasillaId || !formData.destinoCasillaId) return;
    if (unidadesSeleccionadas.length === 0) {
      toast.warning('Debes seleccionar al menos una unidad');
      return;
    }
    try {
      const dataFinal: EnvioFormData = {
        ...(formData as EnvioFormData),
        origenTipo: 'casilla',
        unidadesIds: unidadesSeleccionadas,
        costoFletePorProducto: agregarFleteAhora ? costoFleteTotalPorProducto : {},
      };
      await onSubmit(dataFinal);
      handleClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast.error('Error: ' + message);
    }
  };

  const almacenesDestinoModal = esInternacional(formData.tipo)
    ? almacenesDestinoPeru
    : almacenesOrigen.filter(a => a.id !== formData.origenCasillaId);

  const canProceedToStep2 = formData.origenCasillaId && formData.destinoCasillaId;
  const canProceedToStep3 = unidadesSeleccionadas.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Nuevo Envio - Paso ${step} de 3`}
      size="xl"
    >
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center">
          {[1, 2, 3].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= s ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{s}</div>
              {i < 2 && <div className={`w-24 h-1 mx-2 ${step > s ? 'bg-teal-600' : 'bg-slate-200'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step 1: Configuracion */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Envio</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, tipo: 'internacional_peru', destinoCasillaId: undefined })}
                className={`p-4 rounded-lg border-2 text-center transition-all ${
                  esInternacional(formData.tipo) ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <Plane className="h-8 w-8 mx-auto mb-2" />
                <span className="block font-medium">Origen → Peru</span>
                <span className="text-xs">Envio internacional</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, tipo: 'interna_origen', destinoCasillaId: undefined })}
                className={`p-4 rounded-lg border-2 text-center transition-all ${
                  esInterno(formData.tipo) ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <ArrowRightLeft className="h-8 w-8 mx-auto mb-2" />
                <span className="block font-medium">Interna Origen</span>
                <span className="text-xs">Entre casillas/viajeros</span>
              </button>
            </div>
          </div>

          <Select
            label="Casilla/Viajero Origen"
            value={formData.origenCasillaId || ''}
            onChange={(e) => handleSelectOrigen(e.target.value)}
            options={[
              { value: '', label: 'Seleccionar origen...' },
              ...almacenesOrigen.map(a => ({
                value: a.id,
                label: `${a.nombre} (${a.codigo}) [${a.pais}] - ${a.unidadesActuales || 0} uds`,
              })),
            ]}
            required
          />

          <Select
            label={esInternacional(formData.tipo) ? 'Casilla Destino (Peru)' : 'Casilla/Viajero Destino'}
            value={formData.destinoCasillaId || ''}
            onChange={(e) => setFormData({ ...formData, destinoCasillaId: e.target.value })}
            options={[
              { value: '', label: 'Seleccionar destino...' },
              ...almacenesDestinoModal.map(a => ({
                value: a.id,
                label: `${a.nombre} (${a.codigo}) [${a.pais}]`,
              })),
            ]}
            required
            disabled={!formData.origenCasillaId}
          />

          {esInternacional(formData.tipo) && (
            <Select
              label="Viajero que transporta (opcional)"
              value={formData.viajeroId || ''}
              onChange={(e) => setFormData({ ...formData, viajeroId: e.target.value, colaboradorId: e.target.value || undefined })}
              options={[
                { value: '', label: 'Seleccionar viajero...' },
                ...viajeros.map(v => ({
                  value: v.id,
                  label: `${v.nombre}`,
                })),
              ]}
            />
          )}

          {esInterno(formData.tipo) && (
            <Select
              label="Motivo de la transferencia"
              value={formData.motivo || ''}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value as MotivoEnvioInterno })}
              options={[
                { value: '', label: 'Seleccionar motivo...' },
                { value: 'consolidacion', label: 'Consolidacion de inventario' },
                { value: 'capacidad', label: 'Falta de capacidad' },
                { value: 'viaje_proximo', label: 'Mover a viajero con viaje proximo' },
                { value: 'costo_menor', label: 'Viajero con menor costo de flete' },
                { value: 'otro', label: 'Otro' },
              ]}
            />
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button type="button" variant="primary" onClick={() => setStep(2)} disabled={!canProceedToStep2}>
              Siguiente: Seleccionar Unidades
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Seleccion de unidades */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Resumen sticky */}
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-teal-900">Unidades seleccionadas</h4>
                <p className="text-sm text-teal-700">
                  {resumenSeleccion.cantidad} unidades de {resumenSeleccion.productosUnicos} productos
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-teal-700">${resumenSeleccion.costoTotal.toFixed(2)}</div>
                <div className="text-xs text-teal-600">Valor total</div>
              </div>
            </div>
            {unidadesDisponibles.length > 0 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-teal-200">
                <button
                  type="button"
                  onClick={() => setShowScanner(!showScanner)}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors ${
                    showScanner ? 'bg-teal-200 text-teal-800' : 'text-teal-700 hover:text-teal-900 hover:bg-teal-100'
                  }`}
                >
                  <ScanLine className="h-3.5 w-3.5" />
                  Escanear
                </button>
                <div className="flex items-center space-x-2">
                  <button type="button" onClick={() => setUnidadesSeleccionadas(unidadesDisponibles.map(u => u.id))} className="text-xs text-teal-700 hover:text-teal-900 font-medium">
                    Seleccionar todas ({unidadesDisponibles.length})
                  </button>
                  {unidadesSeleccionadas.length > 0 && (
                    <>
                      <span className="text-teal-300">|</span>
                      <button type="button" onClick={() => setUnidadesSeleccionadas([])} className="text-xs text-teal-700 hover:text-teal-900 font-medium">
                        Limpiar seleccion
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
            {showScanner && (
              <div className="mt-3 p-3 bg-white border border-teal-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-700">Escanear producto</span>
                  <button type="button" onClick={() => setShowScanner(false)} className="text-slate-400 hover:text-slate-600">
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
                <BarcodeScanner onScan={handleBarcodeScan} mode="both" compact />
              </div>
            )}
          </div>

          {/* Lista de unidades */}
          {loadingUnidades ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
            </div>
          ) : Object.keys(unidadesAgrupadas).length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <Package className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600">No hay unidades disponibles en esta casilla</p>
              <p className="text-sm text-slate-500 mt-1">Primero debes recibir una orden de compra</p>
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
                    <div className="p-3 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center flex-1">
                          <input
                            type="checkbox"
                            checked={todasSeleccionadas}
                            onChange={() => toggleProducto(productoId)}
                            className="h-4 w-4 text-teal-600 rounded mr-3 flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-slate-900 truncate">{grupo.nombre}</h4>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              <span className="text-xs text-slate-500">{grupo.sku}</span>
                              <span className="text-xs text-slate-300">·</span>
                              <span className="text-xs text-emerald-600 font-medium">${grupo.unidades[0]?.costoUnitarioUSD.toFixed(2)}/u</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 ml-3">
                          <div className="flex items-center bg-white border rounded-lg overflow-hidden">
                            <button type="button" onClick={(e) => { e.stopPropagation(); const n = Math.max(0, cantidadInput - 1); setCantidadRapida({ ...cantidadRapida, [productoId]: n }); seleccionarCantidad(productoId, n); }} className="px-2 py-1 text-slate-500 hover:bg-slate-100 border-r">
                              <Minus className="h-3 w-3" />
                            </button>
                            <input type="number" value={cantidadInput} onChange={(e) => { const v = Math.min(Math.max(0, parseInt(e.target.value) || 0), grupo.unidades.length); setCantidadRapida({ ...cantidadRapida, [productoId]: v }); }} onBlur={() => seleccionarCantidad(productoId, cantidadInput)} onKeyDown={(e) => { if (e.key === 'Enter') seleccionarCantidad(productoId, cantidadInput); }} onClick={(e) => e.stopPropagation()} className="w-12 text-center text-sm py-1 border-0 focus:ring-0" min="0" max={grupo.unidades.length} />
                            <button type="button" onClick={(e) => { e.stopPropagation(); const n = Math.min(grupo.unidades.length, cantidadInput + 1); setCantidadRapida({ ...cantidadRapida, [productoId]: n }); seleccionarCantidad(productoId, n); }} className="px-2 py-1 text-slate-500 hover:bg-slate-100 border-l">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <Badge variant={todasSeleccionadas ? 'success' : unidadesProductoSeleccionadas > 0 ? 'warning' : 'default'}>
                            {unidadesProductoSeleccionadas}/{grupo.unidades.length}
                          </Badge>
                          <button type="button" onClick={() => toggleExpandirProducto(productoId)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                            {estaExpandido ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    {estaExpandido && (
                      <div className="divide-y max-h-48 overflow-y-auto">
                        {grupo.unidades.sort((a, b) => (a.fechaVencimiento?.toDate?.()?.getTime() || 0) - (b.fechaVencimiento?.toDate?.()?.getTime() || 0)).map((unidad, idx) => (
                          <div key={unidad.id} className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${unidadesSeleccionadas.includes(unidad.id) ? 'bg-teal-50' : 'hover:bg-slate-50'}`} onClick={() => toggleUnidad(unidad.id)}>
                            <div className="flex items-center">
                              <input type="checkbox" checked={unidadesSeleccionadas.includes(unidad.id)} onChange={() => toggleUnidad(unidad.id)} className="h-4 w-4 text-teal-600 rounded mr-3" />
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">#{idx + 1}</span>
                                  <span className="text-sm text-slate-900">Lote: {unidad.lote}</span>
                                </div>
                                <div className="text-xs text-slate-500">Vence: {unidad.fechaVencimiento?.toDate?.().toLocaleDateString('es-PE') || 'N/A'}</div>
                              </div>
                            </div>
                            <span className="text-sm font-medium text-slate-900">${unidad.costoUnitarioUSD.toFixed(2)}</span>
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
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>Anterior</Button>
            <Button type="button" variant="primary" onClick={() => setStep(3)} disabled={!canProceedToStep3}>
              Siguiente: Confirmar
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmacion */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="font-medium text-slate-900 mb-3">Resumen de Envio</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500">Tipo:</span><span className="ml-2 font-medium">{esInternacional(formData.tipo) ? 'Internacional → Perú' : 'Interna Origen'}</span></div>
              <div><span className="text-slate-500">Unidades:</span><span className="ml-2 font-medium">{resumenSeleccion.cantidad}</span></div>
              <div><span className="text-slate-500">Productos:</span><span className="ml-2 font-medium">{resumenSeleccion.productosUnicos}</span></div>
              <div><span className="text-slate-500">Valor mercancia:</span><span className="ml-2 font-medium">${resumenSeleccion.costoTotal.toFixed(2)}</span></div>
            </div>
          </div>

          {esInternacional(formData.tipo) && (
            <div>
              <label className="flex items-center gap-3 cursor-pointer select-none mb-3">
                <input type="checkbox" checked={agregarFleteAhora} onChange={(e) => { setAgregarFleteAhora(e.target.checked); if (!e.target.checked) setCostoFleteUnitarioPorProducto({}); }} className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                <div>
                  <span className="text-sm font-medium text-slate-900">Agregar costo de flete ahora</span>
                  <p className="text-xs text-slate-500">Puedes agregarlo despues desde el detalle del envio</p>
                </div>
              </label>

              {agregarFleteAhora && (
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <Calculator className="h-5 w-5 text-sky-600 mr-2" />
                      <h4 className="font-medium text-sky-900">Costo de Flete por Producto</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-sky-700">${costoFleteTotal.toFixed(2)}</div>
                      <div className="text-xs text-sky-600">Total Flete</div>
                    </div>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {productosConUnidadesSeleccionadas.map((producto) => {
                      const pFull = productosMap.get(producto.productoId);
                      return (
                        <div key={producto.productoId} className="bg-white rounded-lg p-3 border border-sky-100">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-slate-900 truncate">{pFull?.nombreComercial || producto.nombre}</h5>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                {pFull?.marca && <span className="text-[10px] font-medium text-sky-700 bg-sky-50 px-1 py-0 rounded">{pFull.marca}</span>}
                                {pFull && getDescripcionProducto(pFull) && <span className="text-[10px] text-slate-600 bg-slate-100 px-1 py-0 rounded">{getDescripcionProducto(pFull)}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                                <span>{producto.sku}</span>
                                <span>•</span>
                                <span>{producto.unidades} unidades</span>
                                <span>•</span>
                                <span>Mercancia: ${producto.costoMercancia.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 w-40">
                              <label className="block text-xs text-slate-500 mb-1">Flete por unidad (USD)</label>
                              <div className="relative">
                                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                                <input type="number" value={costoFleteUnitarioPorProducto[producto.productoId] || ''} onChange={(e) => { const valor = parseFloat(e.target.value) || 0; setCostoFleteUnitarioPorProducto(prev => ({ ...prev, [producto.productoId]: valor })); }} className="w-full pl-6 pr-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500" placeholder="0.00" step="0.01" min="0" />
                              </div>
                              {(costoFleteUnitarioPorProducto[producto.productoId] || 0) > 0 && (
                                <div className="text-xs text-sky-600 mt-1 text-right">Total: ${costoFleteTotalPorProducto[producto.productoId]?.toFixed(2) || '0.00'}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!agregarFleteAhora && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">El envio se creara sin costo de flete. Podras agregarlo desde el detalle.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {esInterno(formData.tipo) && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center">
                <ArrowRightLeft className="h-5 w-5 text-purple-600 mr-2" />
                <span className="text-sm text-purple-700">Los envios internos en origen no generan costo de flete.</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas (opcional)</label>
            <textarea value={formData.notas || ''} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="Notas adicionales..." />
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setStep(2)}>Anterior</Button>
            <Button type="button" variant="primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Creando...' : 'Crear Envio'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
