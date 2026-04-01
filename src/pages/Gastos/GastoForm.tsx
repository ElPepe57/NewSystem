import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Info, Search, Link, Calendar, DollarSign, CreditCard, Banknote, AlertCircle, CheckCircle } from 'lucide-react';
import { PagoUnificadoForm } from '../../components/modules/pagos/PagoUnificadoForm';
import type { PagoUnificadoResult } from '../../components/modules/pagos/PagoUnificadoForm';
import { Button, Input, Select, AutocompleteInput } from '../../components/common';
import { Modal } from '../../components/common/Modal';
import { useGastoStore } from '../../store/gastoStore';
import { useAuthStore } from '../../store/authStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useToastStore } from '../../store/toastStore';
import { tesoreriaService } from '../../services/tesoreria.service';
import { VentaService } from '../../services/venta.service';
import { CATEGORIAS_GASTO, type Gasto, type GastoFormData, type CategoriaGasto, type MonedaGasto, type EstadoGasto } from '../../types/gasto.types';
import type { CuentaCaja, MetodoTesoreria } from '../../types/tesoreria.types';
import type { Venta } from '../../types/venta.types';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';

interface GastoFormProps {
  onClose: () => void;
  gastoEditar?: Gasto | null;
}

export const GastoForm: React.FC<GastoFormProps> = ({ onClose, gastoEditar }) => {
  const isEditing = !!gastoEditar;
  const { user } = useAuthStore();
  const { crearGasto, actualizarGasto, gastos } = useGastoStore();
  const { getTCDelDia } = useTipoCambioStore();
  const toast = useToastStore();
  const { lineasActivas, fetchLineasActivas } = useLineaNegocioStore();
  const [tipoCambio, setTipoCambio] = React.useState<number>(0);
  const [lineaNegocioId, setLineaNegocioId] = useState<string | null>(
    gastoEditar?.lineaNegocioId ?? null
  );

  // Cargar líneas de negocio
  useEffect(() => {
    fetchLineasActivas();
  }, [fetchLineasActivas]);

  // Modal registration ahora lo maneja el componente Modal

  const [formData, setFormData] = useState<GastoFormData>(() => {
    if (gastoEditar) {
      return {
        tipo: gastoEditar.tipo || 'otros',
        categoria: gastoEditar.categoria || 'GO',
        descripcion: gastoEditar.descripcion || '',
        moneda: gastoEditar.moneda || 'PEN',
        montoOriginal: gastoEditar.montoOriginal || 0,
        tipoCambio: gastoEditar.tipoCambio || tipoCambio || 0,
        esProrrateable: gastoEditar.esProrrateable || false,
        prorrateoTipo: gastoEditar.prorrateoTipo || 'unidad',
        fecha: gastoEditar.fecha?.toDate?.() || new Date(),
        frecuencia: gastoEditar.frecuencia || 'unico',
        estado: gastoEditar.estado || 'pendiente',
        impactaCTRU: gastoEditar.impactaCTRU || false,
        ventaId: gastoEditar.ventaId,
        proveedor: gastoEditar.proveedor,
        numeroComprobante: gastoEditar.numeroComprobante,
        notas: gastoEditar.notas,
      };
    }
    return {
      tipo: 'otros',
      categoria: 'GO',
      descripcion: '',
      moneda: 'PEN',
      montoOriginal: 0,
      tipoCambio: tipoCambio || 0,
      esProrrateable: false,
      prorrateoTipo: 'unidad',
      fecha: new Date(),
      frecuencia: 'unico',
      estado: 'pendiente',
      impactaCTRU: false
    };
  });

  // Cargar tipo de cambio al montar
  React.useEffect(() => {
    const loadTC = async () => {
      const tc = await getTCDelDia();
      if (tc) {
        setTipoCambio(tc.compra);
        // Solo setear TC si no estamos editando (o si el gasto no tenía TC)
        if (!gastoEditar?.tipoCambio) {
          setFormData(prev => ({ ...prev, tipoCambio: tc.compra }));
        }
      }
    };
    loadTC();
  }, [getTCDelDia]);

  const [loading, setLoading] = useState(false);

  // Estado para cuentas de tesorería (de dónde sale el dinero)
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [cuentaOrigenId, setCuentaOrigenId] = useState<string>('');
  const [loadingCuentas, setLoadingCuentas] = useState(true);
  const [metodoPago, setMetodoPago] = useState<MetodoTesoreria>('efectivo');
  const [referenciaPago, setReferenciaPago] = useState<string>('');
  const [pagoConfirmado, setPagoConfirmado] = useState(false);

  // Estado para ventas (para asociar gastos GV/GD)
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null);
  const [busquedaVenta, setBusquedaVenta] = useState('');

  // Cargar ventas recientes cuando se selecciona GV o GD
  useEffect(() => {
    const cargarVentas = async () => {
      if (formData.categoria !== 'GV' && formData.categoria !== 'GD') {
        setVentas([]);
        setVentaSeleccionada(null);
        return;
      }

      try {
        setLoadingVentas(true);
        const ventasRecientes = await VentaService.getVentasRecientes(30);
        setVentas(ventasRecientes);

        // Si estamos editando y el gasto tiene ventaId, buscar la venta asociada
        if (gastoEditar?.ventaId && !ventaSeleccionada) {
          const ventaAsociada = ventasRecientes.find(v => v.id === gastoEditar.ventaId);
          if (ventaAsociada) {
            setVentaSeleccionada(ventaAsociada);
          } else {
            // La venta vinculada no está en las recientes (puede ser más antigua), buscarla directamente
            const ventaDirecta = await VentaService.getById(gastoEditar.ventaId);
            if (ventaDirecta) {
              setVentaSeleccionada(ventaDirecta);
            }
          }
        }
      } catch (error) {
        console.error('Error al cargar ventas:', error);
      } finally {
        setLoadingVentas(false);
      }
    };

    cargarVentas();
  }, [formData.categoria]);

  // Filtrar ventas por búsqueda (con validación segura)
  const ventasFiltradas = useMemo(() => {
    const ventasArr = Array.isArray(ventas) ? ventas : [];
    if (!busquedaVenta.trim()) return ventasArr.slice(0, 10);
    const termino = busquedaVenta.toLowerCase();
    return ventasArr
      .filter(v => {
        const numeroVenta = (v.numeroVenta ?? '').toLowerCase();
        const nombreCliente = (v.nombreCliente ?? '').toLowerCase();
        return numeroVenta.includes(termino) || nombreCliente.includes(termino);
      })
      .slice(0, 10);
  }, [ventas, busquedaVenta]);

  // Obtener tipos de gasto existentes para sugerencias (por categoría)
  const tiposSugeridos = useMemo(() => {
    const tiposPorCategoria: Record<CategoriaGasto, string[]> = {
      GV: [],
      GD: [],
      GA: [],
      GO: []
    };

    // Agregar tipos existentes de los gastos
    gastos.forEach(g => {
      if (g.categoria && g.tipo && !tiposPorCategoria[g.categoria]?.includes(g.tipo)) {
        tiposPorCategoria[g.categoria]?.push(g.tipo);
      }
    });

    // Agregar ejemplos predefinidos de cada categoría
    Object.entries(CATEGORIAS_GASTO).forEach(([cat, info]) => {
      info.ejemplos.forEach(ejemplo => {
        if (!tiposPorCategoria[cat as CategoriaGasto].includes(ejemplo)) {
          tiposPorCategoria[cat as CategoriaGasto].push(ejemplo);
        }
      });
    });

    return tiposPorCategoria;
  }, [gastos]);

  // Sugerencias actuales según categoría seleccionada
  const sugerenciasActuales = useMemo(() => {
    return tiposSugeridos[formData.categoria] || [];
  }, [tiposSugeridos, formData.categoria]);

  // Cargar cuentas disponibles
  useEffect(() => {
    const cargarCuentas = async () => {
      try {
        setLoadingCuentas(true);
        const todasCuentas = await tesoreriaService.getCuentas();
        const cuentasActivas = todasCuentas.filter(c => c.activa);
        setCuentas(cuentasActivas);

        const cuentaPEN = cuentasActivas.find(c =>
          (c.moneda === 'PEN' || c.esBiMoneda) &&
          c.esCuentaPorDefecto &&
          c.metodoPagoAsociado === 'efectivo'
        );

        if (cuentaPEN) {
          setCuentaOrigenId(cuentaPEN.id);
        } else if (cuentasActivas.length > 0) {
          setCuentaOrigenId(cuentasActivas[0].id);
        }
      } catch (error) {
        console.error('Error al cargar cuentas:', error);
      } finally {
        setLoadingCuentas(false);
      }
    };

    cargarCuentas();
  }, []);

  // Pre-poblar campos de pago cuando se edita un gasto pagado
  useEffect(() => {
    if (!loadingCuentas && cuentas.length > 0 && gastoEditar && gastoEditar.estado === 'pagado') {
      const pagoExistente = gastoEditar.pagos?.[0];
      if (pagoExistente) {
        // Pre-poblar desde pagos[0]
        if (pagoExistente.cuentaOrigenId) setCuentaOrigenId(pagoExistente.cuentaOrigenId);
        if (pagoExistente.metodoPago) setMetodoPago(pagoExistente.metodoPago as MetodoTesoreria);
        if (pagoExistente.referencia) setReferenciaPago(pagoExistente.referencia);
      } else {
        // Legacy: pre-poblar desde campos del gasto
        if ((gastoEditar as any).cuentaOrigenId) setCuentaOrigenId((gastoEditar as any).cuentaOrigenId);
        if (gastoEditar.metodoPago) setMetodoPago(gastoEditar.metodoPago as MetodoTesoreria);
      }
      return; // No aplicar lógica de cuenta por defecto
    }
  }, [gastoEditar, loadingCuentas, cuentas]);

  // Actualizar cuenta por defecto cuando cambia la moneda (solo para gastos nuevos o no pagados)
  useEffect(() => {
    if (!loadingCuentas && cuentas.length > 0 && !(gastoEditar && gastoEditar.estado === 'pagado')) {
      const cuentaMoneda = cuentas.find(c =>
        (c.esBiMoneda || c.moneda === formData.moneda) &&
        c.activa
      );
      if (cuentaMoneda) {
        setCuentaOrigenId(cuentaMoneda.id);
      }
    }
  }, [formData.moneda, loadingCuentas, cuentas, gastoEditar]);

  const cuentaSeleccionada = cuentas.find(c => c.id === cuentaOrigenId);

  // Info de la categoría seleccionada
  const categoriaInfo = CATEGORIAS_GASTO[formData.categoria];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.warning('Debe iniciar sesión');
      return;
    }

    if (!formData.tipo.trim()) {
      toast.warning('Debe ingresar un tipo de gasto');
      return;
    }

    if (!formData.descripcion.trim()) {
      toast.warning('Debe ingresar una descripción');
      return;
    }

    if (formData.montoOriginal <= 0) {
      toast.warning('El monto debe ser mayor a 0');
      return;
    }

    if (formData.moneda === 'USD' && !formData.tipoCambio) {
      toast.warning('Debe especificar el tipo de cambio para gastos en USD');
      return;
    }

    // Validar que GV y GD tengan venta asociada
    if ((formData.categoria === 'GV' || formData.categoria === 'GD') && !ventaSeleccionada) {
      toast.warning('Los gastos de Venta y Distribución deben asociarse a una venta');
      return;
    }

    setLoading(true);

    try {
      const lineaSeleccionada = lineasActivas.find(l => l.id === lineaNegocioId);
      const gastoData = {
        ...formData,
        cuentaOrigenId: cuentaOrigenId || undefined,
        metodoPago: metodoPago || undefined,
        referenciaPago: referenciaPago || undefined,
        lineaNegocioId: lineaNegocioId || null,
        lineaNegocioNombre: lineaSeleccionada?.nombre || null
      };

      if (isEditing && gastoEditar) {
        await actualizarGasto(gastoEditar.id, gastoData, user.uid);
        toast.success('Gasto actualizado exitosamente');
      } else {
        await crearGasto(gastoData, user.uid);
        toast.success('Gasto registrado exitosamente');
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message, isEditing ? 'Error al actualizar gasto' : 'Error al crear gasto');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof GastoFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Si cambia la categoría, actualizar impactaCTRU según la configuración por defecto
    if (field === 'categoria') {
      const catInfo = CATEGORIAS_GASTO[value as CategoriaGasto];
      setFormData(prev => ({
        ...prev,
        categoria: value,
        esProrrateable: catInfo.impactaCTRU,
        impactaCTRU: catInfo.impactaCTRU,
        tipo: 'otros' // Resetear tipo al cambiar categoría
      }));
    }

    // Ajustar impactaCTRU automáticamente si esProrrateable cambia
    if (field === 'esProrrateable') {
      setFormData(prev => ({
        ...prev,
        impactaCTRU: value
      }));
    }
  };

  // Colores según categoría
  const getCategoriaColor = (cat: CategoriaGasto) => {
    const colors: Record<CategoriaGasto, string> = {
      GV: 'bg-purple-50 border-purple-200 text-purple-800',
      GD: 'bg-blue-50 border-blue-200 text-blue-800',
      GA: 'bg-amber-50 border-amber-200 text-amber-800',
      GO: 'bg-green-50 border-green-200 text-green-800'
    };
    return colors[cat];
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? 'Editar Gasto' : 'Nuevo Gasto'}
      size="xl"
      contentPadding="none"
    >

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* Banner informativo para gastos pagados */}
          {isEditing && gastoEditar?.estado === 'pagado' && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>Este gasto está pagado. Cambiar el monto, cuenta o método actualizará el movimiento en tesorería. Cambiar a "Pendiente" anulará el movimiento.</span>
            </div>
          )}

          {/* Sección 1: Categoría */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Categoría del Gasto</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {(Object.keys(CATEGORIAS_GASTO) as CategoriaGasto[]).map((cat) => {
                const info = CATEGORIAS_GASTO[cat];
                const isSelected = formData.categoria === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleChange('categoria', cat)}
                    className={`p-2 sm:p-3 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? getCategoriaColor(cat) + ' ring-2 ring-offset-1 ring-gray-400'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-xs sm:text-sm">{info.codigo}</div>
                    <div className="text-[10px] sm:text-xs mt-0.5 opacity-80">{info.nombre}</div>
                  </button>
                );
              })}
            </div>

            {/* Info de categoría seleccionada */}
            <div className={`p-3 rounded-lg border ${getCategoriaColor(formData.categoria)}`}>
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm">{categoriaInfo.nombre}</div>
                  <div className="text-xs mt-1 opacity-80">{categoriaInfo.descripcion}</div>
                  <div className="text-xs mt-2">
                    <span className="font-medium">Ejemplos: </span>
                    {categoriaInfo.ejemplos.slice(0, 3).join(', ')}
                  </div>
                  <div className="text-xs mt-1">
                    {categoriaInfo.impactaCTRU
                      ? '✅ Por defecto se prorratea en CTRU'
                      : '❌ No impacta CTRU (se descuenta de utilidad de venta)'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sección: Línea de Negocio */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Línea de Negocio</h3>
            <div>
              <select
                value={lineaNegocioId || ''}
                onChange={(e) => setLineaNegocioId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Compartido (todas las líneas)</option>
                {lineasActivas.map((linea) => (
                  <option key={linea.id} value={linea.id}>
                    {linea.nombre}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Dejar como "Compartido" para gastos que aplican a todas las líneas de negocio
              </p>
            </div>
          </div>

          {/* Sección 2: Asociar a Venta (solo para GV y GD) */}
          {(formData.categoria === 'GV' || formData.categoria === 'GD') && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Link className="h-5 w-5" />
                Asociar a Venta
              </h3>

              {ventaSeleccionada ? (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-purple-900">
                        {ventaSeleccionada.numeroVenta}
                      </div>
                      <div className="text-sm text-purple-700">
                        {ventaSeleccionada.nombreCliente || 'Sin cliente'}
                      </div>
                      <div className="text-xs text-purple-600 mt-1">
                        Total: S/ {ventaSeleccionada.totalPEN?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVentaSeleccionada(null);
                        handleChange('ventaId', undefined);
                      }}
                    >
                      Cambiar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={busquedaVenta}
                      onChange={(e) => setBusquedaVenta(e.target.value)}
                      placeholder="Buscar por número de venta o cliente..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  {loadingVentas ? (
                    <div className="text-sm text-gray-500 text-center py-4">
                      Cargando ventas...
                    </div>
                  ) : ventasFiltradas.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                      No se encontraron ventas recientes
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                      {ventasFiltradas.map((venta) => (
                        <button
                          key={venta.id}
                          type="button"
                          onClick={() => {
                            setVentaSeleccionada(venta);
                            handleChange('ventaId', venta.id);
                            setBusquedaVenta('');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium text-gray-900">{venta.numeroVenta}</div>
                            <div className="text-sm text-gray-500">
                              {venta.nombreCliente || 'Sin cliente'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-gray-900">
                              S/ {venta.totalPEN?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {venta.fechaCreacion?.toDate?.()?.toLocaleDateString('es-PE') || ''}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Los gastos GV/GD deben asociarse a una venta para trazabilidad
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sección 3: Tipo y Descripción */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Detalle del Gasto</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <AutocompleteInput
                label="Tipo de Gasto"
                value={formData.tipo}
                onChange={(value) => handleChange('tipo', value)}
                suggestions={sugerenciasActuales}
                placeholder="Escribe o selecciona..."
                allowCreate={true}
                createLabel="Crear"
                required
              />

              <Input
                label="Descripción"
                type="text"
                required
                value={formData.descripcion}
                onChange={(e) => handleChange('descripcion', e.target.value)}
                placeholder="Detalle específico del gasto"
              />
            </div>
          </div>

          {/* Sección 3: Monto y Moneda */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
              Monto del Gasto
            </h3>

            {/* Selector de Moneda Visual */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Moneda *</label>
              <div className="flex gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => handleChange('moneda', 'PEN')}
                  className={`flex-1 py-2 sm:py-3 px-3 sm:px-4 rounded-lg border-2 text-sm sm:text-base font-medium transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                    formData.moneda === 'PEN'
                      ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-200'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Banknote className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="sm:hidden">S/ PEN</span>
                  <span className="hidden sm:inline">S/ Soles (PEN)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('moneda', 'USD')}
                  className={`flex-1 py-2 sm:py-3 px-3 sm:px-4 rounded-lg border-2 text-sm sm:text-base font-medium transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                    formData.moneda === 'USD'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="sm:hidden">$ USD</span>
                  <span className="hidden sm:inline">$ Dólares (USD)</span>
                </button>
              </div>
            </div>

            {/* Monto y Tipo de Cambio */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label htmlFor="gasto-monto" className="block text-sm font-medium text-gray-700 mb-1">
                  Monto {formData.moneda === 'USD' ? '($)' : '(S/)'} *
                </label>
                <input
                  id="gasto-monto"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.montoOriginal || ''}
                  onChange={(e) => handleChange('montoOriginal', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-lg font-medium"
                />
              </div>
              <div>
                <label htmlFor="gasto-tipocambio" className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Cambio *
                </label>
                <input
                  id="gasto-tipocambio"
                  type="number"
                  required
                  min="0"
                  step="0.001"
                  value={formData.tipoCambio || ''}
                  onChange={(e) => handleChange('tipoCambio', parseFloat(e.target.value) || 0)}
                  placeholder="3.700"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">TC del día para equivalencias</p>
              </div>
            </div>

            {/* Preview de equivalencias */}
            {formData.montoOriginal > 0 && (formData.tipoCambio ?? 0) > 0 && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-3 sm:p-4 rounded-lg border border-gray-200">
                <div className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Equivalencias:</div>
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <div className={`p-2 sm:p-3 rounded-lg ${formData.moneda === 'PEN' ? 'bg-green-100 ring-2 ring-green-300' : 'bg-white'}`}>
                    <div className="text-[10px] sm:text-xs text-gray-500">En Soles</div>
                    <div className="text-sm sm:text-lg font-bold text-green-700">
                      S/ {formData.moneda === 'PEN'
                        ? formData.montoOriginal.toFixed(2)
                        : (formData.montoOriginal * (formData.tipoCambio ?? 1)).toFixed(2)}
                    </div>
                  </div>
                  <div className={`p-2 sm:p-3 rounded-lg ${formData.moneda === 'USD' ? 'bg-blue-100 ring-2 ring-blue-300' : 'bg-white'}`}>
                    <div className="text-[10px] sm:text-xs text-gray-500">En Dólares</div>
                    <div className="text-sm sm:text-lg font-bold text-blue-700">
                      $ {formData.moneda === 'USD'
                        ? formData.montoOriginal.toFixed(2)
                        : (formData.montoOriginal / (formData.tipoCambio ?? 1)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sección 4: CTRU y Prorrateo - Solo para GA y GO */}
          {(formData.categoria === 'GA' || formData.categoria === 'GO') && (
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Impacto en CTRU</h3>

              <div className="space-y-3">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.esProrrateable}
                    onChange={(e) => handleChange('esProrrateable', e.target.checked)}
                    className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Gasto Prorrateable
                    </div>
                    <div className="text-xs text-gray-500">
                      Este gasto se distribuirá entre todas las unidades disponibles y afectará el CTRU dinámico
                    </div>
                  </div>
                </label>

                {formData.esProrrateable && (
                  <Select
                    label="Tipo de Prorrateo"
                    value={formData.prorrateoTipo}
                    onChange={(e) => handleChange('prorrateoTipo', e.target.value)}
                    options={[
                      { value: 'unidad', label: 'Por Unidad (todas las unidades disponibles)' },
                      { value: 'oc', label: 'Por Orden de Compra' },
                      { value: 'manual', label: 'Manual' }
                    ]}
                  />
                )}
              </div>
            </div>
          )}

          {/* Info para GV y GD */}
          {(formData.categoria === 'GV' || formData.categoria === 'GD') && (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Nota:</span> Los gastos de Venta y Distribución no afectan el CTRU.
                  Se descuentan directamente de la utilidad de cada venta cuando se asocian desde el módulo de Ventas.
                </div>
              </div>
            </div>
          )}

          {/* Sección 5: Estado y Fecha */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
              Estado y Fecha
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label htmlFor="gasto-fecha" className="block text-sm font-medium text-gray-700 mb-1">Fecha del Gasto *</label>
                <input
                  id="gasto-fecha"
                  type="date"
                  required
                  value={formData.fecha.toISOString().split('T')[0]}
                  onChange={(e) => handleChange('fecha', new Date(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange('estado', 'pendiente')}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.estado === 'pendiente'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Pendiente
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('estado', 'pagado')}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.estado === 'pagado'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Pagado
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sección 6: Información de Pago - Solo si está pagado */}
          {formData.estado === 'pagado' && (
            <div className="bg-green-50 rounded-lg border border-green-200 overflow-hidden">
              {pagoConfirmado ? (
                <div className="p-4 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-800">Pago configurado</div>
                    <div className="text-sm text-green-600">
                      {metodoPago} — {formData.moneda === 'USD' ? '$' : 'S/'} {formData.montoOriginal.toFixed(2)}
                    </div>
                  </div>
                  <button type="button" onClick={() => setPagoConfirmado(false)}
                    className="ml-auto text-xs text-green-600 underline">Modificar</button>
                </div>
              ) : (
                <div className="p-4">
                  <PagoUnificadoForm
                    origen="gasto"
                    titulo="Pago del gasto"
                    montoTotal={formData.montoOriginal || formData.montoPEN}
                    montoPendiente={formData.montoOriginal || formData.montoPEN}
                    monedaOriginal={formData.moneda as 'PEN' | 'USD'}
                    tcDocumento={formData.tipoCambio}
                    onSubmit={(datos: PagoUnificadoResult) => {
                      setMetodoPago(datos.metodoPago as MetodoTesoreria);
                      setCuentaOrigenId(datos.cuentaOrigenId);
                      setReferenciaPago(datos.referencia || '');
                      if (datos.tipoCambio > 0) {
                        setTipoCambio(datos.tipoCambio);
                        setFormData(prev => ({ ...prev, tipoCambio: datos.tipoCambio }));
                      }
                      setPagoConfirmado(true);
                    }}
                    onCancel={() => {
                      // Cambiar estado a pendiente si cancela el pago
                      setFormData(prev => ({ ...prev, estado: 'pendiente' }));
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Sección 7: Información Adicional */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Información Adicional</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Input
                label="Proveedor (Opcional)"
                type="text"
                value={formData.proveedor || ''}
                onChange={(e) => handleChange('proveedor', e.target.value)}
                placeholder="Nombre del proveedor"
              />

              <Input
                label="Nº Comprobante (Opcional)"
                type="text"
                value={formData.numeroComprobante || ''}
                onChange={(e) => handleChange('numeroComprobante', e.target.value)}
                placeholder="Factura, boleta, etc."
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="gasto-notas" className="block text-sm font-medium text-gray-700">
                Notas (Opcional)
              </label>
              <textarea
                id="gasto-notas"
                value={formData.notas || ''}
                onChange={(e) => handleChange('notas', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Observaciones adicionales..."
              />
            </div>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? 'Guardando...' : isEditing ? 'Actualizar Gasto' : 'Guardar Gasto'}
            </Button>
          </div>
        </form>
    </Modal>
  );
};
