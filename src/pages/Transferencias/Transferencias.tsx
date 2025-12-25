import React, { useEffect, useState, useMemo } from "react";
import {
  ArrowRightLeft,
  Plane,
  Package,
  Clock,
  AlertTriangle,
  Plus,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  XCircle,
  Truck,
  Search,
  Calculator,
  DollarSign,
  Minus
} from "lucide-react";
import { Button, Card, Badge, Modal, Select, Input } from "../../components/common";
import { useTransferenciaStore } from "../../store/transferenciaStore";
import { useAlmacenStore } from "../../store/almacenStore";
import { useAuthStore } from "../../store/authStore";
import { unidadService } from "../../services/unidad.service";
import type {
  Transferencia,
  TipoTransferencia,
  EstadoTransferencia,
  TransferenciaFormData,
  RecepcionFormData
} from "../../types/transferencia.types";
import type { Unidad } from "../../types/unidad.types";

export const Transferencias: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const {
    transferencias,
    transferenciasEnTransito,
    transferenciasPendientes,
    resumen,
    loading,
    fetchTransferencias,
    fetchEnTransito,
    fetchPendientesRecepcion,
    fetchResumen,
    crearTransferencia,
    confirmarTransferencia,
    enviarTransferencia,
    registrarRecepcion,
    cancelarTransferencia
  } = useTransferenciaStore();

  const {
    almacenesUSA,
    almacenesPeru,
    viajeros,
    fetchAlmacenesUSA,
    fetchAlmacenesPeru,
    fetchViajeros
  } = useAlmacenStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRecepcionModal, setShowRecepcionModal] = useState(false);
  const [transferenciaParaRecepcion, setTransferenciaParaRecepcion] = useState<Transferencia | null>(null);
  const [selectedTransferencia, setSelectedTransferencia] = useState<Transferencia | null>(null);
  const [activeTab, setActiveTab] = useState<'todas' | 'en_transito' | 'pendientes'>('todas');
  const [filtroTipo, setFiltroTipo] = useState<TipoTransferencia | 'todas'>('todas');
  const [filtroEstado, setFiltroEstado] = useState<EstadoTransferencia | 'todas'>('todas');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    fetchTransferencias();
    fetchEnTransito();
    fetchPendientesRecepcion();
    fetchResumen();
    fetchAlmacenesUSA();
    fetchAlmacenesPeru();
    fetchViajeros();
  }, [fetchTransferencias, fetchEnTransito, fetchPendientesRecepcion, fetchResumen, fetchAlmacenesUSA, fetchAlmacenesPeru, fetchViajeros]);

  // Filtrar transferencias
  const getTransferenciasFiltradas = () => {
    let lista = activeTab === 'en_transito'
      ? transferenciasEnTransito
      : activeTab === 'pendientes'
        ? transferenciasPendientes
        : transferencias;

    if (filtroTipo !== 'todas') {
      lista = lista.filter(t => t.tipo === filtroTipo);
    }

    if (filtroEstado !== 'todas') {
      lista = lista.filter(t => t.estado === filtroEstado);
    }

    if (busqueda) {
      const term = busqueda.toLowerCase();
      lista = lista.filter(t =>
        t.numeroTransferencia.toLowerCase().includes(term) ||
        t.almacenOrigenNombre.toLowerCase().includes(term) ||
        t.almacenDestinoNombre.toLowerCase().includes(term)
      );
    }

    return lista;
  };

  const handleConfirmar = async (id: string) => {
    if (!user) return;
    if (confirm("¿Confirmar esta transferencia para preparación?")) {
      await confirmarTransferencia(id, user.uid);
    }
  };

  const handleEnviar = async (id: string) => {
    if (!user) return;
    if (confirm("¿Marcar esta transferencia como enviada?")) {
      await enviarTransferencia(id, { fechaSalida: new Date() }, user.uid);
    }
  };

  const handleCancelar = async (id: string) => {
    if (!user) return;
    const motivo = prompt("Ingrese el motivo de cancelación:");
    if (motivo) {
      await cancelarTransferencia(id, motivo, user.uid);
    }
  };

  const handleIniciarRecepcion = (transferencia: Transferencia) => {
    setTransferenciaParaRecepcion(transferencia);
    setSelectedTransferencia(null);
    setShowRecepcionModal(true);
  };

  // Formatear estado
  const getEstadoBadge = (estado: EstadoTransferencia) => {
    const config: Record<EstadoTransferencia, { variant: "default" | "warning" | "success" | "danger" | "info"; label: string }> = {
      borrador: { variant: "default", label: "Borrador" },
      preparando: { variant: "warning", label: "Preparando" },
      en_transito: { variant: "info", label: "En Tránsito" },
      recibida_parcial: { variant: "warning", label: "Parcial" },
      recibida_completa: { variant: "success", label: "Completada" },
      cancelada: { variant: "danger", label: "Cancelada" }
    };
    const { variant, label } = config[estado];
    return <Badge variant={variant}>{label}</Badge>;
  };

  // Formatear tipo
  const getTipoBadge = (tipo: TipoTransferencia) => {
    return tipo === 'interna_usa'
      ? <Badge variant="default">Interna USA</Badge>
      : <Badge variant="info">USA → Perú</Badge>;
  };

  // Card de transferencia
  const TransferenciaCard = ({ transferencia }: { transferencia: Transferencia }) => {
    const fechaCreacion = transferencia.fechaCreacion.toDate();
    const fechaSalida = transferencia.fechaSalida?.toDate();

    return (
      <Card
        padding="md"
        className="hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => setSelectedTransferencia(transferencia)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
              transferencia.tipo === 'usa_peru' ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              {transferencia.tipo === 'usa_peru'
                ? <Plane className="h-6 w-6 text-blue-600" />
                : <ArrowRightLeft className="h-6 w-6 text-gray-600" />
              }
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{transferencia.numeroTransferencia}</h3>
              <div className="flex items-center space-x-2 mt-1">
                {getTipoBadge(transferencia.tipo)}
                {getEstadoBadge(transferencia.estado)}
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500">
            {fechaCreacion.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>

        {/* Ruta */}
        <div className="flex items-center space-x-2 mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <div className="text-xs text-gray-500">Origen</div>
            <div className="font-medium text-gray-900">{transferencia.almacenOrigenNombre}</div>
            <div className="text-xs text-gray-500">{transferencia.almacenOrigenCodigo}</div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <div className="flex-1 text-right">
            <div className="text-xs text-gray-500">Destino</div>
            <div className="font-medium text-gray-900">{transferencia.almacenDestinoNombre}</div>
            <div className="text-xs text-gray-500">{transferencia.almacenDestinoCodigo}</div>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{transferencia.totalUnidades}</div>
            <div className="text-xs text-gray-500">Unidades</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{transferencia.productosSummary.length}</div>
            <div className="text-xs text-gray-500">Productos</div>
          </div>
          {transferencia.costoFleteTotal && (
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                ${transferencia.costoFleteTotal.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">Flete</div>
            </div>
          )}
        </div>

        {/* Estado específico */}
        {transferencia.estado === 'en_transito' && fechaSalida && (
          <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg text-sm">
            <div className="flex items-center text-blue-700">
              <Truck className="h-4 w-4 mr-2" />
              En camino desde {fechaSalida.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
            </div>
            {transferencia.diasEnTransito && (
              <span className="text-blue-600 font-medium">{transferencia.diasEnTransito} días</span>
            )}
          </div>
        )}

        {/* Tracking */}
        {transferencia.numeroTracking && (
          <div className="mt-3 flex items-center text-sm text-gray-600">
            <Package className="h-4 w-4 mr-2 text-gray-400" />
            Tracking: {transferencia.numeroTracking}
          </div>
        )}

        {/* Acciones rápidas */}
        {(transferencia.estado === 'borrador' || transferencia.estado === 'preparando') && (
          <div className="mt-4 pt-4 border-t flex justify-end space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleCancelar(transferencia.id); }}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            {transferencia.estado === 'borrador' && (
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleConfirmar(transferencia.id); }}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Confirmar
              </Button>
            )}
            {transferencia.estado === 'preparando' && (
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleEnviar(transferencia.id); }}
              >
                <Truck className="h-4 w-4 mr-1" />
                Enviar
              </Button>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      </Card>
    );
  };

  // Formulario de creación con selector de unidades
  const CreateTransferenciaModal = () => {
    const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Config, 2: Unidades, 3: Flete
    const [formData, setFormData] = useState<Partial<TransferenciaFormData>>({
      tipo: 'usa_peru',
      unidadesIds: []
    });
    const [unidadesDisponibles, setUnidadesDisponibles] = useState<Unidad[]>([]);
    const [unidadesSeleccionadas, setUnidadesSeleccionadas] = useState<string[]>([]);
    const [loadingUnidades, setLoadingUnidades] = useState(false);
    // Costo de flete POR UNIDAD por producto: { [productoId]: costoFleteUnitario }
    const [costoFleteUnitarioPorProducto, setCostoFleteUnitarioPorProducto] = useState<Record<string, number>>({});
    // Estado para controlar qué productos están expandidos
    const [productosExpandidos, setProductosExpandidos] = useState<Set<string>>(new Set());
    // Cantidad rápida a seleccionar por producto
    const [cantidadRapida, setCantidadRapida] = useState<Record<string, number>>({});

    // Cargar unidades cuando se selecciona almacén origen
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

    // Toggle selección de unidad
    const toggleUnidad = (unidadId: string) => {
      setUnidadesSeleccionadas(prev =>
        prev.includes(unidadId)
          ? prev.filter(id => id !== unidadId)
          : [...prev, unidadId]
      );
    };

    // Seleccionar todas las unidades de un producto
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

    // Seleccionar cantidad específica de unidades (FEFO - primero los que vencen primero)
    const seleccionarCantidad = (productoId: string, cantidad: number) => {
      const unidadesDelProducto = unidadesDisponibles
        .filter(u => u.productoId === productoId)
        // Ordenar por fecha de vencimiento (FEFO)
        .sort((a, b) => {
          const fechaA = a.fechaVencimiento?.toDate?.()?.getTime() || 0;
          const fechaB = b.fechaVencimiento?.toDate?.()?.getTime() || 0;
          return fechaA - fechaB;
        });

      // Quitar todas las unidades del producto primero
      const sinProducto = unidadesSeleccionadas.filter(
        id => !unidadesDelProducto.map(u => u.id).includes(id)
      );

      // Agregar la cantidad especificada
      const idsASeleccionar = unidadesDelProducto.slice(0, cantidad).map(u => u.id);
      setUnidadesSeleccionadas([...sinProducto, ...idsASeleccionar]);
    };

    // Toggle expandir/colapsar producto
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

    // Seleccionar todas las unidades disponibles
    const seleccionarTodas = () => {
      setUnidadesSeleccionadas(unidadesDisponibles.map(u => u.id));
    };

    // Deseleccionar todas
    const deseleccionarTodas = () => {
      setUnidadesSeleccionadas([]);
    };

    // Agrupar unidades por producto
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

    // Calcular productos seleccionados con sus unidades
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

    // Calcular costo total de flete por producto (costoUnitario × cantidad)
    const costoFleteTotalPorProducto = useMemo(() => {
      const resultado: Record<string, number> = {};

      productosConUnidadesSeleccionadas.forEach(prod => {
        const costoUnitario = costoFleteUnitarioPorProducto[prod.productoId] || 0;
        resultado[prod.productoId] = costoUnitario * prod.unidades;
      });

      return resultado;
    }, [productosConUnidadesSeleccionadas, costoFleteUnitarioPorProducto]);

    // Calcular costo total de flete (suma de todos los productos)
    const costoFleteTotal = useMemo(() => {
      return Object.values(costoFleteTotalPorProducto).reduce((sum, costo) => sum + (costo || 0), 0);
    }, [costoFleteTotalPorProducto]);

    // Resumen de selección
    const resumenSeleccion = useMemo(() => {
      const seleccionadas = unidadesDisponibles.filter(u => unidadesSeleccionadas.includes(u.id));
      const costoTotal = seleccionadas.reduce((sum, u) => sum + u.costoUnitarioUSD, 0);
      const productosUnicos = new Set(seleccionadas.map(u => u.productoId)).size;
      return { cantidad: seleccionadas.length, costoTotal, productosUnicos };
    }, [unidadesDisponibles, unidadesSeleccionadas]);

    const handleSubmit = async () => {
      if (!user || !formData.almacenOrigenId || !formData.almacenDestinoId) return;
      if (unidadesSeleccionadas.length === 0) {
        alert('Debes seleccionar al menos una unidad');
        return;
      }

      try {
        const dataFinal: TransferenciaFormData = {
          ...formData as TransferenciaFormData,
          unidadesIds: unidadesSeleccionadas,
          // Pasar el costo TOTAL por producto (unitario × cantidad)
          costoFletePorProducto: costoFleteTotalPorProducto
        };
        await crearTransferencia(dataFinal, user.uid);
        setShowCreateModal(false);
        setStep(1);
        setFormData({ tipo: 'usa_peru', unidadesIds: [] });
        setUnidadesSeleccionadas([]);
        setCostoFleteUnitarioPorProducto({});
        setProductosExpandidos(new Set());
        setCantidadRapida({});
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        alert("Error: " + message);
      }
    };

    const almacenesOrigen = formData.tipo === 'usa_peru' ? almacenesUSA : almacenesUSA;
    const almacenesDestino = formData.tipo === 'usa_peru' ? almacenesPeru : almacenesUSA.filter(a => a.id !== formData.almacenOrigenId);

    const canProceedToStep2 = formData.almacenOrigenId && formData.almacenDestinoId;
    const canProceedToStep3 = unidadesSeleccionadas.length > 0;

    return (
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setStep(1); }}
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

        {/* Step 1: Configuración básica */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Tipo de transferencia */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Transferencia
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: 'usa_peru', almacenDestinoId: undefined })}
                  className={`p-4 rounded-lg border-2 text-center transition-all ${
                    formData.tipo === 'usa_peru'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <Plane className="h-8 w-8 mx-auto mb-2" />
                  <span className="block font-medium">USA → Perú</span>
                  <span className="text-xs">Envío internacional</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: 'interna_usa', almacenDestinoId: undefined })}
                  className={`p-4 rounded-lg border-2 text-center transition-all ${
                    formData.tipo === 'interna_usa'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <ArrowRightLeft className="h-8 w-8 mx-auto mb-2" />
                  <span className="block font-medium">Interna USA</span>
                  <span className="text-xs">Entre viajeros/almacenes</span>
                </button>
              </div>
            </div>

            {/* Origen */}
            <Select
              label="Almacén/Viajero Origen"
              value={formData.almacenOrigenId || ''}
              onChange={(e) => handleSelectOrigen(e.target.value)}
              options={[
                { value: '', label: 'Seleccionar origen...' },
                ...almacenesOrigen.map(a => ({
                  value: a.id,
                  label: `${a.nombre} (${a.codigo}) - ${a.unidadesActuales || 0} unidades`
                }))
              ]}
              required
            />

            {/* Destino */}
            <Select
              label={formData.tipo === 'usa_peru' ? 'Almacén Destino (Perú)' : 'Viajero/Almacén Destino'}
              value={formData.almacenDestinoId || ''}
              onChange={(e) => setFormData({ ...formData, almacenDestinoId: e.target.value })}
              options={[
                { value: '', label: 'Seleccionar destino...' },
                ...almacenesDestino.map(a => ({
                  value: a.id,
                  label: `${a.nombre} (${a.codigo})`
                }))
              ]}
              required
              disabled={!formData.almacenOrigenId}
            />

            {/* Viajero (solo para USA → Perú) */}
            {formData.tipo === 'usa_peru' && (
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

            {/* Motivo (solo para interna USA) */}
            {formData.tipo === 'interna_usa' && (
              <Select
                label="Motivo de la transferencia"
                value={formData.motivo || ''}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value as TransferenciaFormData['motivo'] })}
                options={[
                  { value: '', label: 'Seleccionar motivo...' },
                  { value: 'consolidacion', label: 'Consolidación de inventario' },
                  { value: 'capacidad', label: 'Falta de capacidad' },
                  { value: 'viaje_proximo', label: 'Mover a viajero con viaje próximo' },
                  { value: 'costo_menor', label: 'Viajero con menor costo de flete' },
                  { value: 'otro', label: 'Otro' }
                ]}
              />
            )}

            {/* Botones */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
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

        {/* Step 2: Selección de unidades */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Resumen de selección - Sticky */}
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

              {/* Acciones rápidas globales */}
              {unidadesDisponibles.length > 0 && (
                <div className="flex items-center justify-end space-x-2 mt-3 pt-3 border-t border-primary-200">
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
                        Limpiar selección
                      </button>
                    </>
                  )}
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
                <p className="text-gray-600">No hay unidades disponibles en este almacén</p>
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
                      {/* Header del producto - Siempre visible */}
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
                              <p className="text-xs text-gray-500">{grupo.sku}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3 ml-3">
                            {/* Selector de cantidad rápida */}
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

                            {/* Botón expandir/colapsar */}
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

                        {/* Info FEFO */}
                        {!estaExpandido && unidadesProductoSeleccionadas > 0 && (
                          <div className="mt-2 text-xs text-gray-500 ml-7">
                            Selección FEFO: primeras {unidadesProductoSeleccionadas} unidades por vencer
                          </div>
                        )}
                      </div>

                      {/* Lista de unidades del producto - Colapsable */}
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
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    Vence: {unidad.fechaVencimiento?.toDate?.().toLocaleDateString('es-PE') || 'N/A'}
                                  </p>
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

            {/* Botones */}
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
                Siguiente: Costo de Flete
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Costo de flete y confirmación */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Resumen de la transferencia */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Resumen de Transferencia</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Tipo:</span>
                  <span className="ml-2 font-medium">{formData.tipo === 'usa_peru' ? 'USA → Perú' : 'Interna USA'}</span>
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
                  <span className="text-gray-500">Valor mercancía:</span>
                  <span className="ml-2 font-medium">${resumenSeleccion.costoTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Costo de flete por producto (solo para USA → Perú) */}
            {formData.tipo === 'usa_peru' && (
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

                {/* Lista de productos con input de flete */}
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {productosConUnidadesSeleccionadas.map((producto) => (
                    <div key={producto.productoId} className="bg-white rounded-lg p-3 border border-blue-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-gray-900 truncate">{producto.nombre}</h5>
                          <p className="text-xs text-gray-500">{producto.sku}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                            <span>{producto.unidades} unidades</span>
                            <span>•</span>
                            <span>Mercancía: ${producto.costoMercancia.toFixed(2)}</span>
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
                  ))}
                </div>

                {/* Resumen de costos */}
                {costoFleteTotal > 0 && (
                  <div className="mt-4 pt-3 border-t border-blue-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Total mercancía:</span>
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

            {/* Info para transferencias internas */}
            {formData.tipo === 'interna_usa' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center">
                  <ArrowRightLeft className="h-5 w-5 text-purple-600 mr-2" />
                  <span className="text-sm text-purple-700">
                    Las transferencias internas en USA no generan costo de flete.
                  </span>
                </div>
              </div>
            )}

            {/* Notas */}
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

            {/* Botones */}
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

  // Modal de Recepción de Transferencia
  const RecepcionModal = ({
    transferencia,
    onClose,
    onConfirm
  }: {
    transferencia: Transferencia;
    onClose: () => void;
    onConfirm: (data: RecepcionFormData) => Promise<void>;
  }) => {
    const [unidadesRecepcion, setUnidadesRecepcion] = useState<{
      unidadId: string;
      recibida: boolean;
      danada: boolean;
      incidencia?: string;
    }[]>(
      transferencia.unidades.map(u => ({
        unidadId: u.unidadId,
        recibida: true,
        danada: false,
        incidencia: ''
      }))
    );
    const [observaciones, setObservaciones] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const toggleRecibida = (unidadId: string) => {
      setUnidadesRecepcion(prev =>
        prev.map(u =>
          u.unidadId === unidadId
            ? { ...u, recibida: !u.recibida, danada: false }
            : u
        )
      );
    };

    const toggleDanada = (unidadId: string) => {
      setUnidadesRecepcion(prev =>
        prev.map(u =>
          u.unidadId === unidadId
            ? { ...u, danada: !u.danada, recibida: true }
            : u
        )
      );
    };

    const setIncidencia = (unidadId: string, incidencia: string) => {
      setUnidadesRecepcion(prev =>
        prev.map(u =>
          u.unidadId === unidadId ? { ...u, incidencia } : u
        )
      );
    };

    const handleSubmit = async () => {
      setSubmitting(true);
      try {
        await onConfirm({
          transferenciaId: transferencia.id,
          unidadesRecibidas: unidadesRecepcion,
          observaciones
        });
      } finally {
        setSubmitting(false);
      }
    };

    const resumen = {
      total: transferencia.unidades.length,
      recibidas: unidadesRecepcion.filter(u => u.recibida && !u.danada).length,
      danadas: unidadesRecepcion.filter(u => u.danada).length,
      faltantes: unidadesRecepcion.filter(u => !u.recibida).length
    };

    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        title={`Recepción: ${transferencia.numeroTransferencia}`}
        size="lg"
      >
        <div className="space-y-6">
          {/* Info de la transferencia */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Origen</div>
                <div className="font-medium">{transferencia.almacenOrigenNombre}</div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
              <div className="text-right">
                <div className="text-sm text-gray-500">Destino</div>
                <div className="font-medium">{transferencia.almacenDestinoNombre}</div>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{resumen.total}</div>
              <div className="text-xs text-blue-600">Esperadas</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{resumen.recibidas}</div>
              <div className="text-xs text-green-600">Recibidas OK</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-700">{resumen.danadas}</div>
              <div className="text-xs text-yellow-600">Dañadas</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-700">{resumen.faltantes}</div>
              <div className="text-xs text-red-600">Faltantes</div>
            </div>
          </div>

          {/* Lista de unidades */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Verificar Unidades</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {transferencia.unidades.map((unidad) => {
                const recepcion = unidadesRecepcion.find(u => u.unidadId === unidad.unidadId);
                if (!recepcion) return null;

                return (
                  <div
                    key={unidad.unidadId}
                    className={`border rounded-lg p-3 ${
                      !recepcion.recibida
                        ? 'border-red-300 bg-red-50'
                        : recepcion.danada
                        ? 'border-yellow-300 bg-yellow-50'
                        : 'border-green-300 bg-green-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{unidad.sku}</div>
                        <div className="text-xs text-gray-500">
                          Lote: {unidad.lote || 'N/A'} • {unidad.codigoUnidad}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => toggleRecibida(unidad.unidadId)}
                          className={`px-3 py-1 rounded text-sm font-medium ${
                            recepcion.recibida
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {recepcion.recibida ? (
                            <span className="flex items-center">
                              <CheckCircle className="h-4 w-4 mr-1" /> Recibida
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <XCircle className="h-4 w-4 mr-1" /> Faltante
                            </span>
                          )}
                        </button>
                        {recepcion.recibida && (
                          <button
                            type="button"
                            onClick={() => toggleDanada(unidad.unidadId)}
                            className={`px-3 py-1 rounded text-sm font-medium ${
                              recepcion.danada
                                ? 'bg-yellow-600 text-white'
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {recepcion.danada ? 'Dañada' : '¿Dañada?'}
                          </button>
                        )}
                      </div>
                    </div>
                    {(recepcion.danada || !recepcion.recibida) && (
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="Describir incidencia..."
                          value={recepcion.incidencia || ''}
                          onChange={(e) => setIncidencia(unidad.unidadId, e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Observaciones generales */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones generales (opcional)
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Agregar comentarios sobre la recepción..."
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Procesando...
                </span>
              ) : (
                <span className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Recepción
                </span>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    );
  };

  const transferenciasFiltradas = getTransferenciasFiltradas();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transferencias</h1>
          <p className="text-gray-600 mt-1">
            Gestiona el movimiento de productos entre almacenes
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-5 w-5 mr-2" />
          Nueva Transferencia
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">En Tránsito</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {resumen?.enTransito || 0}
              </div>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Pendientes Recepción</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {resumen?.pendientesRecepcion || 0}
              </div>
            </div>
            <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Completadas (Mes)</div>
              <div className="text-2xl font-bold text-green-600 mt-1">
                {resumen?.completadasMes || 0}
              </div>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Con Incidencias</div>
              <div className="text-2xl font-bold text-red-600 mt-1">
                {resumen?.transferenciasConIncidencias || 0}
              </div>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs y Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('todas')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'todas'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Todas ({transferencias.length})
            </button>
            <button
              onClick={() => setActiveTab('en_transito')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'en_transito'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              En Tránsito ({transferenciasEnTransito.length})
            </button>
            <button
              onClick={() => setActiveTab('pendientes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pendientes'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pendientes ({transferenciasPendientes.length})
            </button>
          </nav>
        </div>

        {/* Filtros */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
            />
          </div>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as TipoTransferencia | 'todas')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="todas">Todos los tipos</option>
            <option value="usa_peru">USA → Perú</option>
            <option value="interna_usa">Interna USA</option>
          </select>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoTransferencia | 'todas')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="todas">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="preparando">Preparando</option>
            <option value="en_transito">En Tránsito</option>
            <option value="recibida_parcial">Recibida Parcial</option>
            <option value="recibida_completa">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>

      {/* Lista de transferencias */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : transferenciasFiltradas.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-12">
            <ArrowRightLeft className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay transferencias
            </h3>
            <p className="text-gray-600 mb-6">
              {activeTab === 'en_transito'
                ? 'No hay transferencias en tránsito'
                : activeTab === 'pendientes'
                  ? 'No hay transferencias pendientes de recepción'
                  : 'Crea tu primera transferencia para mover productos entre almacenes'
              }
            </p>
            {activeTab === 'todas' && (
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-5 w-5 mr-2" />
                Nueva Transferencia
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {transferenciasFiltradas.map(transferencia => (
            <TransferenciaCard key={transferencia.id} transferencia={transferencia} />
          ))}
        </div>
      )}

      {/* Modal crear transferencia */}
      <CreateTransferenciaModal />

      {/* Modal detalle transferencia */}
      {selectedTransferencia && (
        <Modal
          isOpen={!!selectedTransferencia}
          onClose={() => setSelectedTransferencia(null)}
          title={`Transferencia ${selectedTransferencia.numeroTransferencia}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Estado y tipo */}
            <div className="flex items-center space-x-3">
              {getTipoBadge(selectedTransferencia.tipo)}
              {getEstadoBadge(selectedTransferencia.estado)}
            </div>

            {/* Ruta */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="text-xs text-gray-500 uppercase mb-1">Origen</div>
                  <div className="font-semibold text-gray-900">{selectedTransferencia.almacenOrigenNombre}</div>
                  <div className="text-sm text-gray-500">{selectedTransferencia.almacenOrigenCodigo}</div>
                </div>
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <ChevronRight className="h-5 w-5 text-primary-600" />
                  </div>
                </div>
                <div className="flex-1 text-right">
                  <div className="text-xs text-gray-500 uppercase mb-1">Destino</div>
                  <div className="font-semibold text-gray-900">{selectedTransferencia.almacenDestinoNombre}</div>
                  <div className="text-sm text-gray-500">{selectedTransferencia.almacenDestinoCodigo}</div>
                </div>
              </div>
            </div>

            {/* Resumen de productos */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Productos ({selectedTransferencia.totalUnidades} unidades)</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedTransferencia.productosSummary.map(producto => (
                  <div key={producto.productoId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium text-gray-900">{producto.nombre}</div>
                      <div className="text-xs text-gray-500">{producto.sku}</div>
                    </div>
                    <div className="text-lg font-semibold text-gray-900">{producto.cantidad}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Fecha Creación</div>
                <div className="text-gray-900">
                  {selectedTransferencia.fechaCreacion.toDate().toLocaleDateString('es-PE', {
                    day: '2-digit', month: 'long', year: 'numeric'
                  })}
                </div>
              </div>
              {selectedTransferencia.fechaSalida && (
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Fecha Salida</div>
                  <div className="text-gray-900">
                    {selectedTransferencia.fechaSalida.toDate().toLocaleDateString('es-PE', {
                      day: '2-digit', month: 'long', year: 'numeric'
                    })}
                  </div>
                </div>
              )}
              {selectedTransferencia.fechaLlegadaReal && (
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Fecha Llegada</div>
                  <div className="text-gray-900">
                    {selectedTransferencia.fechaLlegadaReal.toDate().toLocaleDateString('es-PE', {
                      day: '2-digit', month: 'long', year: 'numeric'
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Tracking */}
            {selectedTransferencia.numeroTracking && (
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Número de Tracking</div>
                <div className="font-medium text-gray-900">{selectedTransferencia.numeroTracking}</div>
              </div>
            )}

            {/* Notas */}
            {selectedTransferencia.notas && (
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Notas</div>
                <div className="text-gray-900">{selectedTransferencia.notas}</div>
              </div>
            )}

            {/* Acciones */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setSelectedTransferencia(null)}>
                Cerrar
              </Button>
              {selectedTransferencia.estado === 'borrador' && (
                <Button variant="primary" onClick={() => { handleConfirmar(selectedTransferencia.id); setSelectedTransferencia(null); }}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar
                </Button>
              )}
              {selectedTransferencia.estado === 'preparando' && (
                <Button variant="primary" onClick={() => { handleEnviar(selectedTransferencia.id); setSelectedTransferencia(null); }}>
                  <Truck className="h-4 w-4 mr-2" />
                  Marcar como Enviada
                </Button>
              )}
              {selectedTransferencia.estado === 'en_transito' && (
                <Button variant="primary" onClick={() => handleIniciarRecepcion(selectedTransferencia)}>
                  <Package className="h-4 w-4 mr-2" />
                  Registrar Recepción
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Recepción */}
      {showRecepcionModal && transferenciaParaRecepcion && (
        <RecepcionModal
          transferencia={transferenciaParaRecepcion}
          onClose={() => {
            setShowRecepcionModal(false);
            setTransferenciaParaRecepcion(null);
          }}
          onConfirm={async (data: RecepcionFormData) => {
            if (!user) return;
            try {
              await registrarRecepcion(data, user.uid);
              setShowRecepcionModal(false);
              setTransferenciaParaRecepcion(null);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Error desconocido';
              alert('Error: ' + message);
            }
          }}
        />
      )}
    </div>
  );
};
