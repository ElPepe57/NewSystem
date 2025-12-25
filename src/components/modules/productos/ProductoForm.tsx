import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Info,
  Package,
  DollarSign,
  Target,
  BarChart3,
  Calculator,
  ShoppingCart,
  FileText,
  Sparkles,
  Tag
} from 'lucide-react';
import { Button, Input, AutocompleteInput } from '../../common';
import { MarcaAutocomplete } from '../entidades/MarcaAutocomplete';
import { ProductoService } from '../../../services/producto.service';
import { marcaService } from '../../../services/marca.service';
import { useAuthStore } from '../../../store/authStore';
import type { ProductoFormData, Producto, InvestigacionMercado } from '../../../types/producto.types';
import type { MarcaSnapshot, MarcaFormData } from '../../../types/entidadesMaestras.types';

interface ProductoFormProps {
  initialData?: Partial<ProductoFormData>;
  onSubmit: (data: ProductoFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  /** Lista de productos existentes para buscar investigaciones */
  productosExistentes?: Producto[];
}

interface SugerenciasProducto {
  marcas: string[];
  nombresComerciales: string[];
  grupos: string[];
  subgrupos: string[];
  presentaciones: string[];
  dosajes: string[];
  contenidos: string[];
}

interface DemandaDetectada {
  cotizaciones: number;
  unidadesSolicitadas: number;
  requerimientos: number;
  ventasMensualesPromedio: number;
  tendencia: 'subiendo' | 'bajando' | 'estable';
}

interface SugerenciasInteligentes {
  precioSugerido: number;
  margenMinimo: number;
  margenObjetivo: number;
  stockMinimo: number;
  stockMaximo: number;
  razonamientos: {
    precio?: string;
    margen?: string;
    stock?: string;
  };
}

export const ProductoForm: React.FC<ProductoFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
  productosExistentes = []
}) => {
  const { user } = useAuthStore();

  // Marca inteligente del maestro
  const [marcaSeleccionada, setMarcaSeleccionada] = useState<MarcaSnapshot | null>(null);
  const [marcaMetricas, setMarcaMetricas] = useState<{
    productosActivos: number;
    unidadesVendidas: number;
    margenPromedio: number;
  } | null>(null);

  const [formData, setFormData] = useState<ProductoFormData>({
    marca: initialData?.marca || '',
    nombreComercial: initialData?.nombreComercial || '',
    presentacion: initialData?.presentacion || 'capsulas',
    dosaje: initialData?.dosaje || '',
    contenido: initialData?.contenido || '',
    grupo: initialData?.grupo || '',
    subgrupo: initialData?.subgrupo || '',
    enlaceProveedor: initialData?.enlaceProveedor || '',
    codigoUPC: initialData?.codigoUPC || '',
    precioSugerido: initialData?.precioSugerido || 0,
    margenMinimo: initialData?.margenMinimo || 20,
    margenObjetivo: initialData?.margenObjetivo || 35,
    stockMinimo: initialData?.stockMinimo || 10,
    stockMaximo: initialData?.stockMaximo || 100,
    habilitadoML: initialData?.habilitadoML || false,
    restriccionML: initialData?.restriccionML || '',
    costoFleteUSAPeru: initialData?.costoFleteUSAPeru || 0
  });

  const [proximoSKU, setProximoSKU] = useState<string>('');
  const [loadingSKU, setLoadingSKU] = useState(false);

  const [sugerencias, setSugerencias] = useState<SugerenciasProducto>({
    marcas: [],
    nombresComerciales: [],
    grupos: [],
    subgrupos: [],
    presentaciones: [],
    dosajes: [],
    contenidos: []
  });

  // === NUEVOS ESTADOS PARA INTELIGENCIA ===
  const [investigacionSeleccionada, setInvestigacionSeleccionada] = useState<InvestigacionMercado | null>(null);
  const [productoInvestigacionId, setProductoInvestigacionId] = useState<string | null>(null);
  const [busquedaInvestigacion, setBusquedaInvestigacion] = useState('');
  const [mostrarSelectorInvestigacion, setMostrarSelectorInvestigacion] = useState(false);
  const [usarSugerenciasInteligentes, setUsarSugerenciasInteligentes] = useState(true);

  // Demanda detectada (simulada por ahora, se conectara a ventas/requerimientos reales)
  const [demandaDetectada, setDemandaDetectada] = useState<DemandaDetectada | null>(null);

  // Cargar el proximo SKU al montar el componente (solo en modo creacion)
  useEffect(() => {
    if (!initialData) {
      setLoadingSKU(true);
      ProductoService.getProximoSKU()
        .then(sku => setProximoSKU(sku))
        .catch(err => console.error('Error al obtener SKU:', err))
        .finally(() => setLoadingSKU(false));
    }
  }, [initialData]);

  // Inicializar marca seleccionada cuando se edita un producto existente
  useEffect(() => {
    const inicializarMarca = async () => {
      if (initialData?.marca && !marcaSeleccionada) {
        // Buscar la marca en el maestro por nombre
        try {
          const marcas = await marcaService.getAll();
          const marcaEncontrada = marcas.find(
            m => m.nombre.toLowerCase() === initialData.marca?.toLowerCase()
          );

          if (marcaEncontrada) {
            const snapshot: MarcaSnapshot = {
              marcaId: marcaEncontrada.id,
              nombre: marcaEncontrada.nombre
            };
            setMarcaSeleccionada(snapshot);
            setMarcaMetricas({
              productosActivos: marcaEncontrada.metricas.productosActivos,
              unidadesVendidas: marcaEncontrada.metricas.unidadesVendidas,
              margenPromedio: marcaEncontrada.metricas.margenPromedio
            });
          } else {
            // Si no existe en el maestro, crear un snapshot simple solo con el nombre
            setMarcaSeleccionada({
              marcaId: '',
              nombre: initialData.marca
            });
          }
        } catch (error) {
          console.error('Error al buscar marca en maestro:', error);
          // Fallback: usar el nombre de la marca sin ID
          setMarcaSeleccionada({
            marcaId: '',
            nombre: initialData.marca
          });
        }
      }
    };

    inicializarMarca();
  }, [initialData?.marca]);

  // Cargar sugerencias para autocompletado
  useEffect(() => {
    const loadSugerencias = async () => {
      try {
        const data = await ProductoService.getAllUniqueValues();
        setSugerencias({
          marcas: data.marcas,
          nombresComerciales: data.nombresComerciales,
          grupos: data.grupos,
          subgrupos: data.subgrupos,
          presentaciones: data.presentaciones,
          dosajes: data.dosajes,
          contenidos: data.contenidos
        });
      } catch (error) {
        console.error('Error cargando sugerencias:', error);
      }
    };

    loadSugerencias();
  }, []);

  // Filtrar productos con investigacion para el selector
  const productosConInvestigacion = useMemo(() => {
    return productosExistentes.filter(p => p.investigacion && p.investigacion.estaVigente);
  }, [productosExistentes]);

  // Filtrar productos segun busqueda
  const productosFiltrados = useMemo(() => {
    if (!busquedaInvestigacion.trim()) return productosConInvestigacion;
    const term = busquedaInvestigacion.toLowerCase();
    return productosConInvestigacion.filter(p =>
      p.marca.toLowerCase().includes(term) ||
      p.nombreComercial.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term)
    );
  }, [productosConInvestigacion, busquedaInvestigacion]);

  // Calcular sugerencias inteligentes basadas en investigacion y demanda
  const sugerenciasInteligentes = useMemo((): SugerenciasInteligentes | null => {
    if (!investigacionSeleccionada && !demandaDetectada) return null;

    const inv = investigacionSeleccionada;
    const demanda = demandaDetectada;

    // Calcular precio sugerido
    let precioSugerido = formData.precioSugerido;
    let razonPrecio = '';
    if (inv) {
      // Usar precio de entrada competitivo si existe
      if (inv.precioEntrada && inv.precioEntrada > 0) {
        precioSugerido = inv.precioEntrada;
        razonPrecio = `Precio entrada competitivo (-5% del minimo ${inv.precioPERUMin?.toFixed(2)})`;
      } else if (inv.precioSugeridoCalculado > 0) {
        precioSugerido = inv.precioSugeridoCalculado;
        razonPrecio = `Basado en CTRU S/${inv.ctruEstimado?.toFixed(2)} + margen objetivo`;
      }
    }

    // Calcular margenes sugeridos
    let margenMinimo = 20;
    let margenObjetivo = 35;
    let razonMargen = 'Margenes estandar conservadores';

    if (inv) {
      const margenEstimado = inv.margenEstimado || 0;
      if (margenEstimado >= 40) {
        margenMinimo = 25;
        margenObjetivo = 40;
        razonMargen = `Margen alto detectado (${margenEstimado.toFixed(1)}%), margenes optimistas`;
      } else if (margenEstimado >= 25) {
        margenMinimo = 20;
        margenObjetivo = 30;
        razonMargen = `Margen moderado (${margenEstimado.toFixed(1)}%), margenes balanceados`;
      } else if (margenEstimado >= 15) {
        margenMinimo = 15;
        margenObjetivo = 25;
        razonMargen = `Margen ajustado (${margenEstimado.toFixed(1)}%), margenes conservadores`;
      } else {
        margenMinimo = 10;
        margenObjetivo = 20;
        razonMargen = `Margen bajo (${margenEstimado.toFixed(1)}%), revisar viabilidad`;
      }
    }

    // Calcular stocks basados en demanda
    let stockMinimo = 10;
    let stockMaximo = 100;
    let razonStock = 'Stocks estandar sin datos de demanda';

    if (demanda && demanda.ventasMensualesPromedio > 0) {
      // Stock minimo: 1.5 meses de demanda
      stockMinimo = Math.ceil(demanda.ventasMensualesPromedio * 1.5);
      // Stock maximo: 4 meses de demanda
      stockMaximo = Math.ceil(demanda.ventasMensualesPromedio * 4);
      razonStock = `Basado en ${demanda.ventasMensualesPromedio} ventas/mes (min: 1.5 meses, max: 4 meses)`;
    } else if (inv) {
      // Estimar basado en demanda de investigacion
      const ventasEstimadas = inv.demandaEstimada === 'alta' ? 30 :
        inv.demandaEstimada === 'media' ? 20 : 10;
      stockMinimo = Math.ceil(ventasEstimadas * 1.5);
      stockMaximo = Math.ceil(ventasEstimadas * 4);
      razonStock = `Estimado por demanda "${inv.demandaEstimada}" (~${ventasEstimadas} ventas/mes)`;
    }

    return {
      precioSugerido,
      margenMinimo,
      margenObjetivo,
      stockMinimo,
      stockMaximo,
      razonamientos: {
        precio: razonPrecio,
        margen: razonMargen,
        stock: razonStock
      }
    };
  }, [investigacionSeleccionada, demandaDetectada, formData.precioSugerido]);

  // Aplicar datos de investigacion seleccionada
  const aplicarInvestigacion = (producto: Producto) => {
    if (!producto.investigacion) return;

    const inv = producto.investigacion;
    setInvestigacionSeleccionada(inv);
    setProductoInvestigacionId(producto.id);

    // Autocompletar datos basicos del producto
    setFormData(prev => ({
      ...prev,
      marca: producto.marca,
      nombreComercial: producto.nombreComercial,
      presentacion: producto.presentacion,
      dosaje: producto.dosaje,
      contenido: producto.contenido,
      grupo: producto.grupo,
      subgrupo: producto.subgrupo,
      enlaceProveedor: producto.enlaceProveedor || '',
      codigoUPC: producto.codigoUPC || ''
    }));

    setMostrarSelectorInvestigacion(false);
    setBusquedaInvestigacion('');
  };

  // Aplicar sugerencias inteligentes al formulario
  const aplicarSugerencias = () => {
    if (!sugerenciasInteligentes) return;

    setFormData(prev => ({
      ...prev,
      precioSugerido: sugerenciasInteligentes.precioSugerido,
      margenMinimo: sugerenciasInteligentes.margenMinimo,
      margenObjetivo: sugerenciasInteligentes.margenObjetivo,
      stockMinimo: sugerenciasInteligentes.stockMinimo,
      stockMaximo: sugerenciasInteligentes.stockMaximo
    }));
  };

  // Limpiar investigacion seleccionada
  const limpiarInvestigacion = () => {
    setInvestigacionSeleccionada(null);
    setProductoInvestigacionId(null);
    setDemandaDetectada(null);
  };

  // Handler para selección de marca desde el autocomplete
  const handleMarcaChange = async (marca: MarcaSnapshot | null) => {
    setMarcaSeleccionada(marca);

    if (marca) {
      // Actualizar el campo de marca en el formulario
      setFormData(prev => ({ ...prev, marca: marca.nombre }));

      // Cargar métricas de la marca
      if (marca.marcaId) {
        try {
          const marcaCompleta = await marcaService.getById(marca.marcaId);
          if (marcaCompleta) {
            setMarcaMetricas({
              productosActivos: marcaCompleta.metricas.productosActivos,
              unidadesVendidas: marcaCompleta.metricas.unidadesVendidas,
              margenPromedio: marcaCompleta.metricas.margenPromedio
            });
          }
        } catch (error) {
          console.error('Error al cargar métricas de marca:', error);
        }
      }
    } else {
      setFormData(prev => ({ ...prev, marca: '' }));
      setMarcaMetricas(null);
    }
  };

  // Handler para crear nueva marca desde el autocomplete
  const handleCreateMarcaInline = async (data: Partial<MarcaFormData>) => {
    if (!user || !data.nombre) return;

    try {
      const marcaData: MarcaFormData = {
        nombre: data.nombre,
        tipoMarca: data.tipoMarca || 'suplementos',
        descripcion: data.descripcion,
        paisOrigen: data.paisOrigen
      };

      const marcaId = await marcaService.create(marcaData, user.uid);

      // Seleccionar la marca recién creada
      const nuevaMarca: MarcaSnapshot = {
        marcaId,
        nombre: data.nombre
      };
      handleMarcaChange(nuevaMarca);
    } catch (error: any) {
      console.error('Error al crear marca:', error);
      alert(`Error al crear marca: ${error.message}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (['precioSugerido', 'margenMinimo', 'margenObjetivo', 'stockMinimo', 'stockMaximo', 'costoFleteUSAPeru'].includes(name)) {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAutocompleteChange = (field: keyof ProductoFormData) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Icono de tendencia
  const TendenciaIcon = demandaDetectada?.tendencia === 'subiendo' ? TrendingUp :
    demandaDetectada?.tendencia === 'bajando' ? TrendingDown : Minus;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* === SECCION 0: PRE-INVESTIGACION RAPIDA (NUEVO) === */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Pre-Investigacion Inteligente
          </h3>
          {investigacionSeleccionada && (
            <button
              type="button"
              onClick={limpiarInvestigacion}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Limpiar
            </button>
          )}
        </div>

        {!investigacionSeleccionada ? (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800 mb-3">
              Carga datos desde una investigacion de mercado existente para autocompletar precios, margenes y stocks sugeridos.
            </p>

            {/* Boton para mostrar selector */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setMostrarSelectorInvestigacion(!mostrarSelectorInvestigacion)}
              className="w-full justify-center"
            >
              <Search className="h-4 w-4 mr-2" />
              {mostrarSelectorInvestigacion ? 'Ocultar selector' : 'Buscar investigacion existente'}
              {productosConInvestigacion.length > 0 && (
                <span className="ml-2 bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs">
                  {productosConInvestigacion.length} disponibles
                </span>
              )}
            </Button>

            {/* Selector de investigacion */}
            {mostrarSelectorInvestigacion && (
              <div className="mt-4 space-y-3">
                <Input
                  label=""
                  name="busquedaInvestigacion"
                  value={busquedaInvestigacion}
                  onChange={(e) => setBusquedaInvestigacion(e.target.value)}
                  placeholder="Buscar por marca, nombre o SKU..."
                />

                <div className="max-h-48 overflow-y-auto space-y-2">
                  {productosFiltrados.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      {productosConInvestigacion.length === 0
                        ? 'No hay productos con investigacion vigente'
                        : 'No se encontraron coincidencias'}
                    </p>
                  ) : (
                    productosFiltrados.map(producto => {
                      const inv = producto.investigacion!;
                      return (
                        <button
                          key={producto.id}
                          type="button"
                          onClick={() => aplicarInvestigacion(producto)}
                          className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">
                                {producto.marca} - {producto.nombreComercial}
                              </p>
                              <p className="text-xs text-gray-500">
                                {producto.sku} | {producto.presentacion} {producto.dosaje} {producto.contenido}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-green-600">
                                {inv.margenEstimado?.toFixed(1)}% margen
                              </p>
                              <p className="text-xs text-gray-500">
                                CTRU: S/{inv.ctruEstimado?.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Investigacion seleccionada - mostrar resumen */
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Investigacion cargada</p>
                  <p className="text-sm text-green-700">
                    {formData.marca} - {formData.nombreComercial}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-700">
                  {investigacionSeleccionada.margenEstimado?.toFixed(1)}%
                </p>
                <p className="text-xs text-green-600">margen estimado</p>
              </div>
            </div>

            {/* Metricas de la investigacion */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="bg-white/50 rounded p-2 text-center">
                <p className="text-xs text-gray-600">Precio USA</p>
                <p className="font-semibold text-gray-900">
                  ${investigacionSeleccionada.precioUSAMin?.toFixed(2)}
                </p>
              </div>
              <div className="bg-white/50 rounded p-2 text-center">
                <p className="text-xs text-gray-600">CTRU</p>
                <p className="font-semibold text-gray-900">
                  S/{investigacionSeleccionada.ctruEstimado?.toFixed(2)}
                </p>
              </div>
              <div className="bg-white/50 rounded p-2 text-center">
                <p className="text-xs text-gray-600">Precio Peru</p>
                <p className="font-semibold text-gray-900">
                  S/{investigacionSeleccionada.precioPERUMin?.toFixed(2)}
                </p>
              </div>
              <div className="bg-white/50 rounded p-2 text-center">
                <p className="text-xs text-gray-600">Demanda</p>
                <p className="font-semibold text-gray-900 capitalize">
                  {investigacionSeleccionada.demandaEstimada}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Demanda detectada (si existe) */}
        {demandaDetectada && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h4 className="font-medium text-blue-800">Demanda detectada en el sistema</h4>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white/50 rounded p-2 text-center">
                <p className="text-xs text-gray-600">Cotizaciones</p>
                <p className="font-semibold text-gray-900">{demandaDetectada.cotizaciones}</p>
              </div>
              <div className="bg-white/50 rounded p-2 text-center">
                <p className="text-xs text-gray-600">Unidades</p>
                <p className="font-semibold text-gray-900">{demandaDetectada.unidadesSolicitadas}</p>
              </div>
              <div className="bg-white/50 rounded p-2 text-center">
                <p className="text-xs text-gray-600">Ventas/Mes</p>
                <p className="font-semibold text-gray-900">{demandaDetectada.ventasMensualesPromedio}</p>
              </div>
              <div className="bg-white/50 rounded p-2 text-center flex items-center justify-center gap-1">
                <TendenciaIcon className={`h-4 w-4 ${
                  demandaDetectada.tendencia === 'subiendo' ? 'text-green-600' :
                  demandaDetectada.tendencia === 'bajando' ? 'text-red-600' : 'text-gray-600'
                }`} />
                <p className="font-semibold capitalize">{demandaDetectada.tendencia}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Seccion 1: Informacion Basica */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Informacion Basica</h3>

        {/* SKU Automatico - Solo mostrar en modo creacion */}
        {!initialData && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-sm text-primary-700 font-medium">SKU que se asignara:</span>
              <span className="ml-2 font-mono text-primary-900 font-bold">
                {loadingSKU ? 'Generando...' : proximoSKU}
              </span>
            </div>
            <span className="text-xs text-primary-600 bg-primary-100 px-2 py-1 rounded">Automatico</span>
          </div>
        )}

        {/* Marca Inteligente con Autocomplete del Maestro */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1">
                <Tag className="h-4 w-4" />
                Marca
              </span>
            </label>
            <MarcaAutocomplete
              value={marcaSeleccionada}
              onChange={handleMarcaChange}
              onCreateNew={handleCreateMarcaInline}
              placeholder="Buscar o crear marca..."
              required
              allowCreate
              defaultTipoMarca="suplementos"
            />
          </div>

          {/* Métricas de la Marca seleccionada */}
          {marcaSeleccionada && marcaMetricas && marcaMetricas.productosActivos > 0 && (
            <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-purple-800">
                  Estadísticas de {marcaSeleccionada.nombre}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-700">{marcaMetricas.productosActivos}</div>
                  <p className="text-xs text-gray-600">Productos</p>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{marcaMetricas.unidadesVendidas}</div>
                  <p className="text-xs text-gray-600">Vendidos</p>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{marcaMetricas.margenPromedio.toFixed(1)}%</div>
                  <p className="text-xs text-gray-600">Margen prom.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Campo de marca oculto o de respaldo si no se usa el autocomplete */}
          {!marcaSeleccionada && (
            <AutocompleteInput
              label="Marca (manual)"
              value={formData.marca}
              onChange={handleAutocompleteChange('marca')}
              suggestions={sugerencias.marcas}
              required
              placeholder="ej: Nordic Naturals"
              allowCreate
              createLabel="Crear marca"
            />
          )}

          <AutocompleteInput
            label="Nombre Comercial"
            value={formData.nombreComercial}
            onChange={handleAutocompleteChange('nombreComercial')}
            suggestions={sugerencias.nombresComerciales}
            required
            placeholder="ej: Ultimate Omega"
            allowCreate
            createLabel="Crear nombre"
            className={marcaSeleccionada ? 'md:col-span-2' : ''}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AutocompleteInput
            label="Presentacion"
            value={formData.presentacion}
            onChange={handleAutocompleteChange('presentacion')}
            suggestions={['Tabletas', 'Gomitas', 'Capsulas', 'Capsulas Blandas', 'Polvo', 'Liquido', ...sugerencias.presentaciones]}
            required
            placeholder="ej: Capsulas"
            allowCreate
            createLabel="Crear presentacion"
          />

          <AutocompleteInput
            label="Dosaje"
            value={formData.dosaje}
            onChange={handleAutocompleteChange('dosaje')}
            suggestions={sugerencias.dosajes}
            placeholder="ej: 1000mg"
            allowCreate
            createLabel="Crear dosaje"
          />

          <AutocompleteInput
            label="Contenido"
            value={formData.contenido}
            onChange={handleAutocompleteChange('contenido')}
            suggestions={sugerencias.contenidos}
            placeholder="ej: 60 softgels"
            allowCreate
            createLabel="Crear contenido"
          />
        </div>

        <Input
          label="Codigo UPC/EAN (opcional)"
          name="codigoUPC"
          value={formData.codigoUPC}
          onChange={handleChange}
          placeholder="ej: 768990014307"
        />
      </div>

      {/* Seccion 2: Clasificacion */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Clasificacion</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AutocompleteInput
            label="Grupo"
            value={formData.grupo}
            onChange={handleAutocompleteChange('grupo')}
            suggestions={sugerencias.grupos}
            required
            placeholder="ej: Suplementos"
            allowCreate
            createLabel="Crear grupo"
          />

          <AutocompleteInput
            label="Subgrupo"
            value={formData.subgrupo}
            onChange={handleAutocompleteChange('subgrupo')}
            suggestions={sugerencias.subgrupos}
            placeholder="ej: Omega 3"
            allowCreate
            createLabel="Crear subgrupo"
          />
        </div>
      </div>

      {/* === SECCION 3: DATOS COMERCIALES (MEJORADO) === */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Datos Comerciales
          </h3>
          {sugerenciasInteligentes && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={aplicarSugerencias}
              className="text-amber-600 hover:text-amber-800"
            >
              <Lightbulb className="h-4 w-4 mr-1" />
              Aplicar sugerencias
            </Button>
          )}
        </div>

        {/* Sugerencias inteligentes */}
        {sugerenciasInteligentes && usarSugerenciasInteligentes && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Sugerencias basadas en investigacion</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {sugerenciasInteligentes.razonamientos.precio && (
                <div className="bg-white/50 rounded p-2">
                  <p className="text-xs text-gray-500">Precio</p>
                  <p className="font-medium">S/{sugerenciasInteligentes.precioSugerido.toFixed(2)}</p>
                  <p className="text-xs text-amber-600 mt-1">{sugerenciasInteligentes.razonamientos.precio}</p>
                </div>
              )}
              {sugerenciasInteligentes.razonamientos.margen && (
                <div className="bg-white/50 rounded p-2">
                  <p className="text-xs text-gray-500">Margenes</p>
                  <p className="font-medium">{sugerenciasInteligentes.margenMinimo}% - {sugerenciasInteligentes.margenObjetivo}%</p>
                  <p className="text-xs text-amber-600 mt-1">{sugerenciasInteligentes.razonamientos.margen}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <Input
          label="Enlace Proveedor"
          name="enlaceProveedor"
          value={formData.enlaceProveedor}
          onChange={handleChange}
          placeholder="https://..."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Input
              label="Precio Sugerido (S/)"
              name="precioSugerido"
              type="number"
              step="0.01"
              value={formData.precioSugerido}
              onChange={handleChange}
            />
            {investigacionSeleccionada && investigacionSeleccionada.precioEntrada && (
              <p className="text-xs text-green-600 mt-1">
                Precio entrada: S/{investigacionSeleccionada.precioEntrada.toFixed(2)}
              </p>
            )}
          </div>

          <div className="relative">
            <Input
              label="Margen Minimo (%)"
              name="margenMinimo"
              type="number"
              step="1"
              value={formData.margenMinimo}
              onChange={handleChange}
              required
            />
            {investigacionSeleccionada && (
              <p className={`text-xs mt-1 ${
                formData.margenMinimo > (investigacionSeleccionada.margenEstimado || 0)
                  ? 'text-red-600' : 'text-green-600'
              }`}>
                Margen inv: {investigacionSeleccionada.margenEstimado?.toFixed(1)}%
              </p>
            )}
          </div>

          <div className="relative">
            <Input
              label="Margen Objetivo (%)"
              name="margenObjetivo"
              type="number"
              step="1"
              value={formData.margenObjetivo}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {/* Costo de flete */}
        <Input
          label="Costo Flete USA-Peru (USD/unidad)"
          name="costoFleteUSAPeru"
          type="number"
          step="0.01"
          value={formData.costoFleteUSAPeru}
          onChange={handleChange}
          helperText="Costo fijo que cobra el viajero por traer este producto"
        />

        {/* CTRU Estimado si hay investigacion */}
        {investigacionSeleccionada && investigacionSeleccionada.ctruEstimado > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">CTRU Estimado (de investigacion)</span>
              </div>
              <span className="text-lg font-bold text-blue-700">
                S/{investigacionSeleccionada.ctruEstimado.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* === SECCION 4: CONTROL DE INVENTARIO (MEJORADO) === */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          Control de Inventario
        </h3>

        {/* Sugerencias de stock */}
        {sugerenciasInteligentes && sugerenciasInteligentes.razonamientos.stock && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Sugerencia de stocks</span>
            </div>
            <p className="text-sm text-blue-700">{sugerenciasInteligentes.razonamientos.stock}</p>
            <div className="flex gap-4 mt-2">
              <span className="text-sm">
                Min sugerido: <strong>{sugerenciasInteligentes.stockMinimo}</strong>
              </span>
              <span className="text-sm">
                Max sugerido: <strong>{sugerenciasInteligentes.stockMaximo}</strong>
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Input
              label="Stock Minimo"
              name="stockMinimo"
              type="number"
              value={formData.stockMinimo}
              onChange={handleChange}
            />
            {sugerenciasInteligentes && formData.stockMinimo !== sugerenciasInteligentes.stockMinimo && (
              <p className="text-xs text-amber-600 mt-1">
                Sugerido: {sugerenciasInteligentes.stockMinimo} unidades
              </p>
            )}
          </div>

          <div className="relative">
            <Input
              label="Stock Maximo"
              name="stockMaximo"
              type="number"
              value={formData.stockMaximo}
              onChange={handleChange}
            />
            {sugerenciasInteligentes && formData.stockMaximo !== sugerenciasInteligentes.stockMaximo && (
              <p className="text-xs text-amber-600 mt-1">
                Sugerido: {sugerenciasInteligentes.stockMaximo} unidades
              </p>
            )}
          </div>
        </div>

        {/* Advertencia si stock minimo es muy bajo */}
        {formData.stockMinimo < 5 && (
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Stock minimo muy bajo. Considera aumentarlo para evitar quiebres.
          </div>
        )}
      </div>

      {/* Seccion 5: Mercado Libre */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Mercado Libre</h3>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="habilitadoML"
            name="habilitadoML"
            checked={formData.habilitadoML}
            onChange={handleChange}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="habilitadoML" className="text-sm text-gray-700">
            Habilitado para publicar en Mercado Libre
          </label>
        </div>

        {formData.habilitadoML && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Restriccion o Nota para ML (opcional)
            </label>
            <textarea
              name="restriccionML"
              value={formData.restriccionML}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="ej: No publicar en color azul"
            />
          </div>
        )}

        {/* Advertencia si hay competencia alta en ML */}
        {investigacionSeleccionada && investigacionSeleccionada.presenciaML && investigacionSeleccionada.nivelCompetencia === 'alta' && (
          <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-2 rounded">
            <AlertTriangle className="h-4 w-4" />
            Competencia alta en ML ({investigacionSeleccionada.numeroCompetidores} competidores detectados)
          </div>
        )}
      </div>

      {/* Botones de Accion */}
      <div className="flex items-center justify-end space-x-3 pt-6 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
        >
          {initialData ? 'Actualizar' : 'Crear'} Producto
        </Button>
      </div>
    </form>
  );
};
