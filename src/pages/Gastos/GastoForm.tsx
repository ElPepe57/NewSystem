import React, { useState, useEffect, useMemo } from 'react';
import { X, Wallet, Info, Search, Link } from 'lucide-react';
import { Button, Input, Select, AutocompleteInput } from '../../components/common';
import { useGastoStore } from '../../store/gastoStore';
import { useAuthStore } from '../../store/authStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { tesoreriaService } from '../../services/tesoreria.service';
import { VentaService } from '../../services/venta.service';
import { CATEGORIAS_GASTO, type GastoFormData, type CategoriaGasto, type MonedaGasto, type EstadoGasto } from '../../types/gasto.types';
import type { CuentaCaja } from '../../types/tesoreria.types';
import type { Venta } from '../../types/venta.types';

interface GastoFormProps {
  onClose: () => void;
}

export const GastoForm: React.FC<GastoFormProps> = ({ onClose }) => {
  const { user } = useAuthStore();
  const { crearGasto, gastos } = useGastoStore();
  const { getTCDelDia } = useTipoCambioStore();
  const [tipoCambio, setTipoCambio] = React.useState<number>(0);

  const [formData, setFormData] = useState<GastoFormData>({
    tipo: '',
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
  });

  // Cargar tipo de cambio al montar
  React.useEffect(() => {
    const loadTC = async () => {
      const tc = await getTCDelDia();
      if (tc) {
        setTipoCambio(tc.compra);
        setFormData(prev => ({ ...prev, tipoCambio: tc.compra }));
      }
    };
    loadTC();
  }, [getTCDelDia]);

  const [loading, setLoading] = useState(false);

  // Estado para cuentas de tesorería (de dónde sale el dinero)
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [cuentaOrigenId, setCuentaOrigenId] = useState<string>('');
  const [loadingCuentas, setLoadingCuentas] = useState(true);

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
        // Obtener ventas de los últimos 30 días
        const ventasRecientes = await VentaService.getVentasRecientes(30);
        setVentas(ventasRecientes);
      } catch (error) {
        console.error('Error al cargar ventas:', error);
      } finally {
        setLoadingVentas(false);
      }
    };

    cargarVentas();
  }, [formData.categoria]);

  // Filtrar ventas por búsqueda
  const ventasFiltradas = useMemo(() => {
    if (!busquedaVenta.trim()) return ventas.slice(0, 10);
    const termino = busquedaVenta.toLowerCase();
    return ventas
      .filter(v =>
        v.numeroVenta.toLowerCase().includes(termino) ||
        v.clienteNombre?.toLowerCase().includes(termino)
      )
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

  // Actualizar cuenta por defecto cuando cambia la moneda
  useEffect(() => {
    if (!loadingCuentas && cuentas.length > 0) {
      const cuentaMoneda = cuentas.find(c =>
        (c.esBiMoneda || c.moneda === formData.moneda) &&
        c.activa
      );
      if (cuentaMoneda) {
        setCuentaOrigenId(cuentaMoneda.id);
      }
    }
  }, [formData.moneda, loadingCuentas, cuentas]);

  const cuentaSeleccionada = cuentas.find(c => c.id === cuentaOrigenId);

  // Info de la categoría seleccionada
  const categoriaInfo = CATEGORIAS_GASTO[formData.categoria];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert('Debe iniciar sesión');
      return;
    }

    if (!formData.tipo.trim()) {
      alert('Debe ingresar un tipo de gasto');
      return;
    }

    if (!formData.descripcion.trim()) {
      alert('Debe ingresar una descripción');
      return;
    }

    if (formData.montoOriginal <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }

    if (formData.moneda === 'USD' && !formData.tipoCambio) {
      alert('Debe especificar el tipo de cambio para gastos en USD');
      return;
    }

    // Validar que GV y GD tengan venta asociada
    if ((formData.categoria === 'GV' || formData.categoria === 'GD') && !ventaSeleccionada) {
      alert('Los gastos de Venta y Distribución deben asociarse a una venta');
      return;
    }

    setLoading(true);

    try {
      const gastoData = {
        ...formData,
        cuentaOrigenId: cuentaOrigenId || undefined
      };

      await crearGasto(gastoData, user.uid);
      alert('✅ Gasto registrado exitosamente');
      onClose();
    } catch (error: any) {
      alert(`❌ Error al crear gasto: ${error.message}`);
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
        tipo: '' // Limpiar tipo al cambiar categoría
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Nuevo Gasto</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Sección 1: Categoría */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Categoría del Gasto</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.keys(CATEGORIAS_GASTO) as CategoriaGasto[]).map((cat) => {
                const info = CATEGORIAS_GASTO[cat];
                const isSelected = formData.categoria === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleChange('categoria', cat)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? getCategoriaColor(cat) + ' ring-2 ring-offset-1 ring-gray-400'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-sm">{info.codigo}</div>
                    <div className="text-xs mt-0.5 opacity-80">{info.nombre}</div>
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
                        {ventaSeleccionada.clienteNombre || 'Sin cliente'}
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
                        handleChange('ventaNumero', undefined);
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
                            handleChange('ventaNumero', venta.numeroVenta);
                            setBusquedaVenta('');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium text-gray-900">{venta.numeroVenta}</div>
                            <div className="text-sm text-gray-500">
                              {venta.clienteNombre || 'Sin cliente'}
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
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Detalle del Gasto</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          {/* Sección 3: Monto */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Monto</h3>

            <div className="grid grid-cols-3 gap-4">
              <Select
                label="Moneda"
                required
                value={formData.moneda}
                onChange={(e) => handleChange('moneda', e.target.value as MonedaGasto)}
                options={[
                  { value: 'PEN', label: 'Soles (PEN)' },
                  { value: 'USD', label: 'Dólares (USD)' }
                ]}
              />

              <Input
                label="Monto"
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.montoOriginal}
                onChange={(e) => handleChange('montoOriginal', parseFloat(e.target.value) || 0)}
              />

              {formData.moneda === 'USD' && (
                <Input
                  label="Tipo de Cambio"
                  type="number"
                  required
                  min="0"
                  step="0.001"
                  value={formData.tipoCambio || ''}
                  onChange={(e) => handleChange('tipoCambio', parseFloat(e.target.value) || 0)}
                  placeholder="TC para conversión"
                />
              )}
            </div>

            {formData.moneda === 'USD' && formData.tipoCambio && formData.montoOriginal > 0 && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm text-blue-900">
                  Equivalente en PEN: <span className="font-semibold">
                    S/ {(formData.montoOriginal * formData.tipoCambio).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Sección 4: CTRU y Prorrateo - Solo para GA y GO */}
          {(formData.categoria === 'GA' || formData.categoria === 'GO') && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Impacto en CTRU</h3>

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

          {/* Sección 5: Detalles Adicionales */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Detalles Adicionales</h3>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fecha del Gasto"
                type="date"
                required
                value={formData.fecha.toISOString().split('T')[0]}
                onChange={(e) => handleChange('fecha', new Date(e.target.value))}
              />

              <Select
                label="Estado"
                required
                value={formData.estado}
                onChange={(e) => handleChange('estado', e.target.value as EstadoGasto)}
                options={[
                  { value: 'pendiente', label: 'Pendiente de Pago' },
                  { value: 'pagado', label: 'Pagado' },
                  { value: 'cancelado', label: 'Cancelado' }
                ]}
              />
            </div>

            {/* Cuenta Origen - Solo mostrar si el gasto está pagado */}
            {formData.estado === 'pagado' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Cuenta de Origen (de dónde salió el dinero)
                  </div>
                </label>
                {loadingCuentas ? (
                  <div className="text-sm text-gray-500">Cargando cuentas...</div>
                ) : cuentas.length === 0 ? (
                  <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                    No hay cuentas configuradas. El gasto se registrará sin asociar a una cuenta.
                  </div>
                ) : (
                  <select
                    value={cuentaOrigenId}
                    onChange={(e) => setCuentaOrigenId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
                  >
                    <option value="">Sin cuenta específica</option>
                    {cuentas
                      .filter(c => c.esBiMoneda || c.moneda === formData.moneda)
                      .map((cuenta) => {
                        const saldoMostrar = cuenta.esBiMoneda
                          ? (formData.moneda === 'USD' ? (cuenta.saldoUSD || 0) : (cuenta.saldoPEN || 0))
                          : cuenta.saldoActual;
                        const simbolo = formData.moneda === 'USD' ? '$' : 'S/';
                        const etiquetaBiMoneda = cuenta.esBiMoneda ? ' [BI-MONEDA]' : '';
                        return (
                          <option key={cuenta.id} value={cuenta.id}>
                            {cuenta.nombre}{etiquetaBiMoneda} {cuenta.banco ? `(${cuenta.banco})` : ''} - Saldo {formData.moneda}: {simbolo} {saldoMostrar.toFixed(2)}
                          </option>
                        );
                      })}
                  </select>
                )}
                {cuentaSeleccionada && (
                  <div className="text-xs text-gray-500">
                    Se descontará de "{cuentaSeleccionada.nombre}"
                    {cuentaSeleccionada.esBiMoneda
                      ? ` [BI-MONEDA - saldo ${formData.moneda}]`
                      : ` (${cuentaSeleccionada.moneda})`}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-gray-700">
                Notas (Opcional)
              </label>
              <textarea
                value={formData.notas || ''}
                onChange={(e) => handleChange('notas', e.target.value)}
                rows={3}
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
              {loading ? 'Guardando...' : 'Guardar Gasto'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
