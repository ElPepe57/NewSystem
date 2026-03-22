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
  BarChart3,
  Calculator,
  Sparkles,
  Tag,
  Layers,
  ShoppingBag
} from 'lucide-react';
import { Button, Input, AutocompleteInput, Tabs, TabsProvider, TabPanel, useTabs } from '../../common';
import type { Tab } from '../../common/Tabs';
import { MarcaAutocomplete } from '../entidades/MarcaAutocomplete';
import { TipoProductoSelector, CategoriaSelector, EtiquetaSelector } from '../clasificacion';
import { ProductoService } from '../../../services/producto.service';
import { marcaService } from '../../../services/marca.service';
import { tipoProductoService } from '../../../services/tipoProducto.service';
import { categoriaService } from '../../../services/categoria.service';
import { etiquetaService } from '../../../services/etiqueta.service';
import { useAuthStore } from '../../../store/authStore';
import { useToastStore } from '../../../store/toastStore';
import { useLineaNegocioStore } from '../../../store/lineaNegocioStore';
import { usePaisOrigenStore } from '../../../store/paisOrigenStore';
import { METODO_ENVIO_LABELS } from '../../../types/paisOrigen.types';
import type { MetodoEnvio } from '../../../types/paisOrigen.types';
import { Globe, Building2, Plus, MapPin, Truck } from 'lucide-react';
import type { ProductoFormData, Producto, InvestigacionMercado } from '../../../types/producto.types';
import type { MarcaSnapshot, MarcaFormData } from '../../../types/entidadesMaestras.types';
import type { TipoProductoSnapshot } from '../../../types/tipoProducto.types';
import type { CategoriaSnapshot } from '../../../types/categoria.types';
import type { EtiquetaSnapshot } from '../../../types/etiqueta.types';

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
  stockMinimo: number;
  stockMaximo: number;
  razonamientos: {
    stock?: string;
  };
}

// Definicion de tabs del formulario
const FORM_TABS: Tab[] = [
  { id: 'origen', label: 'Linea y Origen', icon: <Globe className="h-4 w-4" /> },
  { id: 'basico', label: 'Informacion Basica', icon: <Tag className="h-4 w-4" /> },
  { id: 'clasificacion', label: 'Clasificacion', icon: <Layers className="h-4 w-4" /> },
  { id: 'inventario', label: 'Inventario', icon: <Package className="h-4 w-4" /> },
];

export const ProductoForm: React.FC<ProductoFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
  productosExistentes = []
}) => {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const { activeTab, setActiveTab } = useTabs('origen');
  const { lineasActivas, fetchLineasActivas } = useLineaNegocioStore();
  const { paisesActivos, fetchPaisesActivos, createPais } = usePaisOrigenStore();

  // Cargar líneas de negocio y países activos
  useEffect(() => {
    fetchLineasActivas();
    fetchPaisesActivos();
  }, [fetchLineasActivas, fetchPaisesActivos]);

  // Estado para crear nuevo país inline
  const [mostrarNuevoPais, setMostrarNuevoPais] = useState(false);
  const [nuevoPaisNombre, setNuevoPaisNombre] = useState('');
  const [nuevoPaisCodigo, setNuevoPaisCodigo] = useState('');
  const [nuevoPaisTarifaFlete, setNuevoPaisTarifaFlete] = useState('');
  const [nuevoPaisMetodoEnvio, setNuevoPaisMetodoEnvio] = useState('');
  const [nuevoPaisTiempoTransito, setNuevoPaisTiempoTransito] = useState('');
  const [creandoPais, setCreandoPais] = useState(false);

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
    sabor: initialData?.sabor || '',
    grupo: initialData?.grupo || '',
    subgrupo: initialData?.subgrupo || '',
    // Nueva clasificacion
    tipoProductoId: initialData?.tipoProductoId,
    categoriaIds: initialData?.categoriaIds || [],
    categoriaPrincipalId: initialData?.categoriaPrincipalId,
    etiquetaIds: initialData?.etiquetaIds || [],
    codigoUPC: initialData?.codigoUPC || '',
    stockMinimo: initialData?.stockMinimo || 10,
    stockMaximo: initialData?.stockMaximo || 100,
    costoFleteInternacional: initialData?.costoFleteInternacional ?? 0,
    // Ciclo de recompra
    servingsPerDay: initialData?.servingsPerDay,
    cicloRecompraDias: initialData?.cicloRecompraDias,
    // Línea de negocio y origen
    lineaNegocioId: initialData?.lineaNegocioId || '',
    paisOrigen: initialData?.paisOrigen || 'USA',
  });

  // Estados para snapshots de clasificacion (para guardar datos desnormalizados)
  const [tipoProductoSnapshot, setTipoProductoSnapshot] = useState<TipoProductoSnapshot | undefined>();
  const [categoriasSnapshots, setCategoriasSnapshots] = useState<CategoriaSnapshot[]>([]);
  const [etiquetasSnapshots, setEtiquetasSnapshots] = useState<EtiquetaSnapshot[]>([]);

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

  // === ESTADOS PARA INTELIGENCIA ===
  const [investigacionSeleccionada, setInvestigacionSeleccionada] = useState<InvestigacionMercado | null>(null);
  const [productoInvestigacionId, setProductoInvestigacionId] = useState<string | null>(null);
  const [busquedaInvestigacion, setBusquedaInvestigacion] = useState('');
  const [mostrarSelectorInvestigacion, setMostrarSelectorInvestigacion] = useState(false);
  const [usarSugerenciasInteligentes, setUsarSugerenciasInteligentes] = useState(true);

  // Demanda detectada (simulada por ahora, se conectara a ventas/requerimientos reales)
  const [demandaDetectada, setDemandaDetectada] = useState<DemandaDetectada | null>(null);

  // Resolver código de línea seleccionada para generar SKU
  const lineaSeleccionadaCodigo = useMemo(() => {
    const linea = lineasActivas.find(l => l.id === formData.lineaNegocioId);
    return linea?.codigo || 'BMN';
  }, [formData.lineaNegocioId, lineasActivas]);

  // Cargar el proximo SKU — reactivo a la línea seleccionada
  useEffect(() => {
    if (!initialData) {
      setLoadingSKU(true);
      ProductoService.getProximoSKU(lineaSeleccionadaCodigo)
        .then(sku => setProximoSKU(sku))
        .catch(err => console.error('Error al obtener SKU:', err))
        .finally(() => setLoadingSKU(false));
    }
  }, [initialData, lineaSeleccionadaCodigo]);

  // Determinar si la línea seleccionada es de suplementos (para campos condicionales)
  const esSuplemento = useMemo(() => {
    const linea = lineasActivas.find(l => l.id === formData.lineaNegocioId);
    if (!linea) return true; // Default: suplementos (comportamiento legacy)
    return linea.codigo === 'SUP';
  }, [formData.lineaNegocioId, lineasActivas]);

  // Inicializar clasificacion cuando se edita un producto existente
  useEffect(() => {
    const inicializarClasificacion = async () => {
      // Solo si estamos editando un producto existente con datos de clasificacion
      if (!initialData) return;

      // Cargar snapshot de tipo de producto
      if (initialData.tipoProductoId) {
        try {
          const tipoSnapshot = await tipoProductoService.getSnapshot(initialData.tipoProductoId);
          if (tipoSnapshot) {
            setTipoProductoSnapshot(tipoSnapshot);
          }
        } catch (error) {
          console.error('Error cargando tipo de producto:', error);
        }
      }

      // Cargar snapshots de categorias
      if (initialData.categoriaIds && initialData.categoriaIds.length > 0) {
        try {
          const snapshots: CategoriaSnapshot[] = [];
          for (const catId of initialData.categoriaIds) {
            const snapshot = await categoriaService.getSnapshot(catId);
            if (snapshot) {
              snapshots.push(snapshot);
            }
          }
          setCategoriasSnapshots(snapshots);
        } catch (error) {
          console.error('Error cargando categorias:', error);
        }
      }

      // Cargar snapshots de etiquetas
      if (initialData.etiquetaIds && initialData.etiquetaIds.length > 0) {
        try {
          const snapshots: EtiquetaSnapshot[] = [];
          for (const etqId of initialData.etiquetaIds) {
            const snapshot = await etiquetaService.getSnapshot(etqId);
            if (snapshot) {
              snapshots.push(snapshot);
            }
          }
          setEtiquetasSnapshots(snapshots);
        } catch (error) {
          console.error('Error cargando etiquetas:', error);
        }
      }
    };

    inicializarClasificacion();
  }, [initialData]);

  // Inicializar marca seleccionada cuando se edita un producto existente
  useEffect(() => {
    const inicializarMarca = async () => {
      if (initialData?.marca && !marcaSeleccionada) {
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
            setMarcaSeleccionada({
              marcaId: '',
              nombre: initialData.marca
            });
          }
        } catch (error) {
          console.error('Error al buscar marca en maestro:', error);
          setMarcaSeleccionada({
            marcaId: '',
            nombre: initialData.marca
          });
        }
      }
    };

    inicializarMarca();
  }, [initialData?.marca]);

  // Calcular ciclo de recompra automaticamente cuando cambian contenido y servingsPerDay
  useEffect(() => {
    const { contenido, servingsPerDay } = formData;
    // Extraer numero del contenido (ej: "60 softgels" -> 60, "300" -> 300)
    const contenidoNumero = contenido ? parseInt(contenido.replace(/\D/g, '')) : 0;
    if (contenidoNumero > 0 && servingsPerDay && servingsPerDay > 0) {
      const cicloCalculado = Math.round(contenidoNumero / servingsPerDay);
      if (cicloCalculado !== formData.cicloRecompraDias) {
        setFormData(prev => ({ ...prev, cicloRecompraDias: cicloCalculado }));
      }
    }
  }, [formData.contenido, formData.servingsPerDay]);

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

  // Filtrar productos segun busqueda (con validación segura)
  const productosFiltrados = useMemo(() => {
    const productosArr = Array.isArray(productosConInvestigacion) ? productosConInvestigacion : [];
    if (!busquedaInvestigacion.trim()) return productosArr;
    const term = busquedaInvestigacion.toLowerCase();
    return productosArr.filter(p => {
      const marca = (p.marca ?? '').toLowerCase();
      const nombreComercial = (p.nombreComercial ?? '').toLowerCase();
      const sku = (p.sku ?? '').toLowerCase();
      return marca.includes(term) || nombreComercial.includes(term) || sku.includes(term);
    });
  }, [productosConInvestigacion, busquedaInvestigacion]);

  // Calcular sugerencias inteligentes basadas en investigacion y demanda
  const sugerenciasInteligentes = useMemo((): SugerenciasInteligentes | null => {
    if (!investigacionSeleccionada && !demandaDetectada) return null;

    const inv = investigacionSeleccionada;
    const demanda = demandaDetectada;

    // Calcular stocks basados en demanda
    let stockMinimo = 10;
    let stockMaximo = 100;
    let razonStock = 'Stocks estandar sin datos de demanda';

    if (demanda && demanda.ventasMensualesPromedio > 0) {
      stockMinimo = Math.ceil(demanda.ventasMensualesPromedio * 1.5);
      stockMaximo = Math.ceil(demanda.ventasMensualesPromedio * 4);
      razonStock = `Basado en ${demanda.ventasMensualesPromedio} ventas/mes (min: 1.5 meses, max: 4 meses)`;
    } else if (inv) {
      const ventasEstimadas = inv.demandaEstimada === 'alta' ? 30 :
        inv.demandaEstimada === 'media' ? 20 : 10;
      stockMinimo = Math.ceil(ventasEstimadas * 1.5);
      stockMaximo = Math.ceil(ventasEstimadas * 4);
      razonStock = `Estimado por demanda "${inv.demandaEstimada}" (~${ventasEstimadas} ventas/mes)`;
    }

    return {
      stockMinimo,
      stockMaximo,
      razonamientos: {
        stock: razonStock
      }
    };
  }, [investigacionSeleccionada, demandaDetectada]);

  // Aplicar datos de investigacion seleccionada
  const aplicarInvestigacion = (producto: Producto) => {
    if (!producto.investigacion) return;

    const inv = producto.investigacion;
    setInvestigacionSeleccionada(inv);
    setProductoInvestigacionId(producto.id);

    setFormData(prev => ({
      ...prev,
      marca: producto.marca,
      nombreComercial: producto.nombreComercial,
      presentacion: producto.presentacion,
      dosaje: producto.dosaje,
      contenido: producto.contenido,
      grupo: producto.grupo,
      subgrupo: producto.subgrupo,
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

  // Handler para seleccion de marca desde el autocomplete
  const handleMarcaChange = async (marca: MarcaSnapshot | null) => {
    setMarcaSeleccionada(marca);

    if (marca) {
      setFormData(prev => ({ ...prev, marca: marca.nombre }));

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
          console.error('Error al cargar metricas de marca:', error);
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

      const nuevaMarca: MarcaSnapshot = {
        marcaId,
        nombre: data.nombre
      };
      handleMarcaChange(nuevaMarca);
    } catch (error: any) {
      console.error('Error al crear marca:', error);
      toast.error(`Error al crear marca: ${error.message}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (['stockMinimo', 'stockMaximo', 'costoFleteInternacional', 'cicloRecompraDias', 'servingsPerDay'].includes(name)) {
      setFormData(prev => ({ ...prev, [name]: value ? parseFloat(value) : undefined }));
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

  // Navegacion entre tabs
  const goToNextTab = () => {
    const currentIndex = FORM_TABS.findIndex(t => t.id === activeTab);
    if (currentIndex < FORM_TABS.length - 1) {
      setActiveTab(FORM_TABS[currentIndex + 1].id);
    }
  };

  const goToPrevTab = () => {
    const currentIndex = FORM_TABS.findIndex(t => t.id === activeTab);
    if (currentIndex > 0) {
      setActiveTab(FORM_TABS[currentIndex - 1].id);
    }
  };

  const isFirstTab = activeTab === FORM_TABS[0].id;
  const isLastTab = activeTab === FORM_TABS[FORM_TABS.length - 1].id;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* === SECCION PRE-INVESTIGACION (siempre visible) === */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
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

      {/* === TABS DE NAVEGACION === */}
      <div className="border-t pt-6">
        <Tabs
          tabs={FORM_TABS}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="pills"
          size="sm"
          fullWidth
        />

        <TabsProvider activeTab={activeTab}>
          {/* TAB 0: LÍNEA DE NEGOCIO Y ORIGEN */}
          <TabPanel tabId="origen" className="mt-6 space-y-6">
            {/* Línea de Negocio */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-600" />
                Línea de Negocio <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lineasActivas.map(linea => (
                  <button
                    key={linea.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, lineaNegocioId: linea.id }))}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                      formData.lineaNegocioId === linea.id
                        ? 'border-indigo-500 bg-indigo-50 shadow-md ring-2 ring-indigo-200'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <span className="text-2xl">{linea.icono || '📦'}</span>
                    <div className="text-left">
                      <p className={`font-semibold ${formData.lineaNegocioId === linea.id ? 'text-indigo-900' : 'text-gray-900'}`}>
                        {linea.nombre}
                      </p>
                      <p className="text-xs text-gray-500">Código: {linea.codigo}</p>
                    </div>
                  </button>
                ))}
              </div>
              {!formData.lineaNegocioId && (
                <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                  <span>⚠</span> Selecciona una línea de negocio para continuar
                </p>
              )}
            </div>

            {/* País de Origen */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-600" />
                País de Origen
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {paisesActivos.map(pais => (
                  <button
                    key={pais.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, paisOrigen: pais.codigo }))}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      formData.paisOrigen === pais.codigo
                        ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <MapPin className={`h-5 w-5 ${formData.paisOrigen === pais.codigo ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div className="text-center">
                      <p className={`text-sm font-medium ${formData.paisOrigen === pais.codigo ? 'text-blue-900' : 'text-gray-900'}`}>
                        {pais.nombre}
                      </p>
                      <p className="text-xs text-gray-500">{pais.codigo}</p>
                      {pais.tiempoTransitoEstimadoDias != null && pais.tiempoTransitoEstimadoDias > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">~{pais.tiempoTransitoEstimadoDias}d tránsito</p>
                      )}
                    </div>
                  </button>
                ))}

                {/* Botón Agregar País */}
                <button
                  type="button"
                  onClick={() => setMostrarNuevoPais(!mostrarNuevoPais)}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all"
                >
                  <Plus className="h-5 w-5" />
                  <p className="text-xs font-medium">Nuevo país</p>
                </button>
              </div>

              {/* Formulario inline para crear nuevo país */}
              {mostrarNuevoPais && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3 space-y-3">
                  <h5 className="text-sm font-medium text-blue-800">Agregar nuevo país de origen</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Nombre del país</label>
                      <input
                        type="text"
                        value={nuevoPaisNombre}
                        onChange={(e) => setNuevoPaisNombre(e.target.value)}
                        placeholder="ej: Japón"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Código (3 letras)</label>
                      <input
                        type="text"
                        value={nuevoPaisCodigo}
                        onChange={(e) => setNuevoPaisCodigo(e.target.value.toUpperCase().slice(0, 3))}
                        placeholder="ej: JPN"
                        maxLength={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Freight / shipping fields */}
                  <div className="border-t border-blue-200 pt-3 mt-2">
                    <h6 className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
                      <Truck className="h-3.5 w-3.5" /> Tarifa de flete estimada (ruta hacia Perú)
                    </h6>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Flete USD/unidad</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={nuevoPaisTarifaFlete}
                          onChange={(e) => setNuevoPaisTarifaFlete(e.target.value)}
                          placeholder="ej: 3.50"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Método de envío</label>
                        <select
                          value={nuevoPaisMetodoEnvio}
                          onChange={(e) => setNuevoPaisMetodoEnvio(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          <option value="">-- Seleccionar --</option>
                          {Object.entries(METODO_ENVIO_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Tránsito (días)</label>
                        <input
                          type="number"
                          min="0"
                          value={nuevoPaisTiempoTransito}
                          onChange={(e) => setNuevoPaisTiempoTransito(e.target.value)}
                          placeholder="ej: 5"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!nuevoPaisNombre || !nuevoPaisCodigo || creandoPais}
                      onClick={async () => {
                        if (!user || !nuevoPaisNombre || !nuevoPaisCodigo) return;
                        setCreandoPais(true);
                        try {
                          await createPais({
                            nombre: nuevoPaisNombre,
                            codigo: nuevoPaisCodigo,
                            activo: true,
                            tarifaFleteEstimadaUSD: nuevoPaisTarifaFlete ? parseFloat(nuevoPaisTarifaFlete) : undefined,
                            metodoEnvio: (nuevoPaisMetodoEnvio || undefined) as MetodoEnvio | undefined,
                            tiempoTransitoDias: nuevoPaisTiempoTransito ? parseInt(nuevoPaisTiempoTransito) : undefined,
                          }, user.uid);
                          await fetchPaisesActivos();
                          setFormData(prev => ({ ...prev, paisOrigen: nuevoPaisCodigo }));
                          setNuevoPaisNombre('');
                          setNuevoPaisCodigo('');
                          setNuevoPaisTarifaFlete('');
                          setNuevoPaisMetodoEnvio('');
                          setNuevoPaisTiempoTransito('');
                          setMostrarNuevoPais(false);
                        } catch (err: any) {
                          toast.error(err.message || 'Error al crear pais');
                        } finally {
                          setCreandoPais(false);
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creandoPais ? 'Creando...' : 'Crear país'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarNuevoPais(false);
                        setNuevoPaisNombre('');
                        setNuevoPaisCodigo('');
                        setNuevoPaisTarifaFlete('');
                        setNuevoPaisMetodoEnvio('');
                        setNuevoPaisTiempoTransito('');
                      }}
                      className="px-4 py-2 text-gray-600 text-sm rounded-lg hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Freight info for selected country */}
              {(() => {
                const paisSel = paisesActivos.find(p => p.codigo === formData.paisOrigen);
                if (!paisSel || (!paisSel.tarifaFleteEstimadaUSD && !paisSel.metodoEnvio && !paisSel.tiempoTransitoDias)) return null;
                return (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <Truck className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <span>
                      Flete estimado:{' '}
                      {paisSel.tarifaFleteEstimadaUSD != null ? `$${paisSel.tarifaFleteEstimadaUSD.toFixed(2)}/unidad` : 'N/D'}
                      {paisSel.metodoEnvio && ` | ${METODO_ENVIO_LABELS[paisSel.metodoEnvio as MetodoEnvio] || paisSel.metodoEnvio}`}
                      {paisSel.tiempoTransitoDias != null && paisSel.tiempoTransitoDias > 0 && ` | ~${paisSel.tiempoTransitoDias} días`}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* SKU Preview */}
            {!initialData && formData.lineaNegocioId && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-green-700 font-medium">SKU que se asignará:</span>
                    <span className="ml-2 font-mono text-green-900 font-bold text-lg">
                      {loadingSKU ? 'Generando...' : proximoSKU}
                    </span>
                  </div>
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Automático</span>
                </div>
              </div>
            )}
          </TabPanel>

          {/* TAB 1: INFORMACION BASICA */}
          <TabPanel tabId="basico" className="mt-6 space-y-4">
            {/* Marca — Compartida entre todas las líneas */}
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
                  defaultTipoMarca={esSuplemento ? 'suplementos' : 'skincare'}
                />
              </div>

              {marcaSeleccionada && marcaMetricas && marcaMetricas.productosActivos > 0 && (
                <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-purple-800">
                      Estadisticas de {marcaSeleccionada.nombre}
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
              {!marcaSeleccionada && (
                <AutocompleteInput
                  label="Marca (manual)"
                  value={formData.marca}
                  onChange={handleAutocompleteChange('marca')}
                  suggestions={sugerencias.marcas}
                  required
                  placeholder={esSuplemento ? 'ej: Nordic Naturals' : 'ej: COSRX'}
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
                placeholder={esSuplemento ? 'ej: Ultimate Omega' : 'ej: Advanced Snail Mucin'}
                allowCreate
                createLabel="Crear nombre"
                className={marcaSeleccionada ? 'md:col-span-2' : ''}
              />
            </div>

            {/* === CAMPOS ESPECÍFICOS POR LÍNEA DE NEGOCIO === */}
            {esSuplemento ? (
              <>
                {/* SUPLEMENTOS: Presentación, Dosaje, Contenido, Sabor */}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Sabor (opcional)"
                    name="sabor"
                    value={formData.sabor}
                    onChange={handleChange}
                    placeholder="ej: Limon, Fresa, Natural, Sin sabor"
                  />

                  <Input
                    label="Codigo UPC/EAN (opcional)"
                    name="codigoUPC"
                    value={formData.codigoUPC}
                    onChange={handleChange}
                    placeholder="ej: 768990014307"
                  />
                </div>

                {/* Ciclo de Recompra — solo suplementos */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary-600" />
                    Ciclo de Recompra
                  </h4>
                  <p className="text-xs text-gray-500 mb-4">
                    El contenido (arriba) representa el total de porciones. Indica cuantas porciones al dia para calcular la duracion.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Contenido (Total Porciones)</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formData.contenido || 'Sin especificar'}
                      </p>
                    </div>

                    <Input
                      label="Porciones/Dia"
                      name="servingsPerDay"
                      type="number"
                      min="1"
                      step="1"
                      value={formData.servingsPerDay || ''}
                      onChange={handleChange}
                      placeholder="ej: 2"
                      helperText="Consumo diario recomendado"
                    />
                  </div>

                  {(() => {
                    const contenidoNumero = formData.contenido ? parseInt(formData.contenido.replace(/\D/g, '')) : 0;
                    const mostrar = contenidoNumero > 0 && formData.servingsPerDay && formData.servingsPerDay > 0;
                    if (!mostrar) return null;
                    const ciclo = Math.round(contenidoNumero / (formData.servingsPerDay || 1));
                    return (
                      <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-medium text-green-800">
                              Ciclo de Recompra Calculado
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-green-700">
                              {ciclo} dias
                            </span>
                            <p className="text-xs text-green-600">
                              {contenidoNumero} porciones / {formData.servingsPerDay} al dia
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            ) : (
              <>
                {/* SKINCARE / OTRAS LÍNEAS: Tipo, Volumen, Ingredientes, Tipo Piel */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <AutocompleteInput
                    label="Tipo de Producto"
                    value={formData.presentacion}
                    onChange={handleAutocompleteChange('presentacion')}
                    suggestions={['Serum', 'Crema', 'Tonico', 'Limpiador', 'Mascarilla', 'Protector Solar', 'Exfoliante', 'Aceite', 'Esencia', 'Parches', 'Contorno de Ojos', 'Bruma Facial']}
                    required
                    placeholder="ej: Serum"
                    allowCreate
                    createLabel="Crear tipo"
                  />

                  <AutocompleteInput
                    label="Volumen / Peso"
                    value={formData.contenido}
                    onChange={handleAutocompleteChange('contenido')}
                    suggestions={['30ml', '50ml', '100ml', '150ml', '200ml', '250ml', '300ml', '50g', '100g', '150g']}
                    placeholder="ej: 50ml"
                    allowCreate
                    createLabel="Crear volumen"
                  />

                  <AutocompleteInput
                    label="Ingrediente Clave"
                    value={formData.dosaje}
                    onChange={handleAutocompleteChange('dosaje')}
                    suggestions={['Niacinamida', 'Acido Hialuronico', 'Retinol', 'Vitamina C', 'AHA/BHA', 'Centella Asiatica', 'Snail Mucin', 'Ceramidas', 'Peptidos', 'Acido Salicilico', 'Tea Tree', 'Collageno']}
                    placeholder="ej: Niacinamida"
                    allowCreate
                    createLabel="Crear ingrediente"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AutocompleteInput
                    label="Tipo de Piel (opcional)"
                    value={formData.sabor || ''}
                    onChange={handleAutocompleteChange('sabor')}
                    suggestions={['Todo tipo de piel', 'Piel grasa', 'Piel seca', 'Piel mixta', 'Piel sensible', 'Piel madura', 'Piel con acne']}
                    placeholder="ej: Piel mixta"
                    allowCreate
                    createLabel="Crear tipo de piel"
                  />

                  <Input
                    label="Codigo UPC/EAN (opcional)"
                    name="codigoUPC"
                    value={formData.codigoUPC}
                    onChange={handleChange}
                    placeholder="ej: 768990014307"
                  />
                </div>
              </>
            )}

          </TabPanel>

          {/* TAB 2: CLASIFICACION */}
          <TabPanel tabId="clasificacion" className="mt-6 space-y-6">
            {/* Tipo de Producto */}
            <TipoProductoSelector
              value={formData.tipoProductoId}
              lineaNegocioId={formData.lineaNegocioId}
              onChange={(tipoId, snapshot) => {
                setFormData(prev => ({ ...prev, tipoProductoId: tipoId }));
                setTipoProductoSnapshot(snapshot);
                // Sincronizar con subgrupo legacy para compatibilidad
                if (snapshot) {
                  setFormData(prev => ({ ...prev, subgrupo: snapshot.nombre }));
                }
              }}
            />

            {/* Categorias */}
            <CategoriaSelector
              value={formData.categoriaIds || []}
              lineaNegocioId={formData.lineaNegocioId}
              onChange={(categoriaIds, snapshots) => {
                setFormData(prev => ({ ...prev, categoriaIds }));
                setCategoriasSnapshots(snapshots);
                // Sincronizar con grupo legacy (usar categoria principal)
                if (snapshots.length > 0) {
                  const principal = snapshots.find(s => s.categoriaId === formData.categoriaPrincipalId) || snapshots[0];
                  setFormData(prev => ({ ...prev, grupo: principal.nombre }));
                }
              }}
              categoriaPrincipalId={formData.categoriaPrincipalId}
              onCategoriaPrincipalChange={(categoriaId) => {
                setFormData(prev => ({ ...prev, categoriaPrincipalId: categoriaId }));
                // Actualizar grupo legacy
                if (categoriaId) {
                  const cat = categoriasSnapshots.find(s => s.categoriaId === categoriaId);
                  if (cat) {
                    setFormData(prev => ({ ...prev, grupo: cat.nombre }));
                  }
                }
              }}
              maxCategorias={5}
            />

            {/* Etiquetas */}
            <EtiquetaSelector
              value={formData.etiquetaIds || []}
              lineaNegocioId={formData.lineaNegocioId}
              onChange={(etiquetaIds, snapshots) => {
                setFormData(prev => ({ ...prev, etiquetaIds }));
                setEtiquetasSnapshots(snapshots);
              }}
              tiposPermitidos={['atributo', 'marketing', 'origen']}
            />

            {/* Vista previa completa */}
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Vista previa de clasificacion</h4>

              <div className="space-y-3">
                {/* Tipo de Producto */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-24">Tipo:</span>
                  {tipoProductoSnapshot ? (
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm font-medium">
                      {tipoProductoSnapshot.nombre}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">Sin tipo seleccionado</span>
                  )}
                </div>

                {/* Categorias */}
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 w-24 pt-1">Categorias:</span>
                  {categoriasSnapshots.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {categoriasSnapshots.map((cat, idx) => (
                        <span
                          key={cat.categoriaId}
                          className={`px-2 py-1 rounded text-sm ${
                            cat.categoriaId === formData.categoriaPrincipalId
                              ? 'bg-primary-100 text-primary-700 font-medium'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {cat.nivel === 2 && cat.categoriaPadreNombre
                            ? `${cat.categoriaPadreNombre} > `
                            : ''
                          }
                          {cat.nombre}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">Sin categorias</span>
                  )}
                </div>

                {/* Etiquetas */}
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 w-24 pt-1">Etiquetas:</span>
                  {etiquetasSnapshots.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {etiquetasSnapshots.map((etq) => (
                        <span
                          key={etq.etiquetaId}
                          className="px-2 py-0.5 rounded-full text-xs"
                          style={{
                            backgroundColor: etq.colorFondo || '#F3F4F6',
                            color: etq.colorTexto || '#4B5563'
                          }}
                        >
                          {etq.icono && <span className="mr-1">{etq.icono}</span>}
                          {etq.nombre}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">Sin etiquetas</span>
                  )}
                </div>
              </div>

              {/* Campos legacy (colapsados para referencia) */}
              <details className="mt-4 pt-3 border-t border-gray-200">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                  Ver campos legacy (grupo/subgrupo)
                </summary>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {formData.grupo || 'Sin grupo'}
                  </span>
                  <span className="text-gray-400">/</span>
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {formData.subgrupo || 'Sin subgrupo'}
                  </span>
                </div>
              </details>
            </div>
          </TabPanel>

          {/* TAB 3: INVENTARIO */}
          <TabPanel tabId="inventario" className="mt-6 space-y-4">
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

            {/* Ciclo de Recompra - Solo lectura, calculado desde Contenido */}
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Ciclo de Recompra
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Calculado automaticamente: Contenido / Porciones por dia
                  </p>
                </div>
                <div className="text-right">
                  {formData.cicloRecompraDias ? (
                    <>
                      <span className="text-2xl font-bold text-primary-700">
                        {formData.cicloRecompraDias}
                      </span>
                      <span className="text-sm text-gray-600 ml-1">dias</span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">
                      Completa Contenido y Porciones/Dia
                    </span>
                  )}
                </div>
              </div>
            </div>

            {formData.stockMinimo < 5 && (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                Stock minimo muy bajo. Considera aumentarlo para evitar quiebres.
              </div>
            )}
          </TabPanel>

          {/* TAB 5: MERCADO LIBRE */}
        </TabsProvider>
      </div>

      {/* NAVEGACION ENTRE TABS Y BOTONES DE ACCION */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="flex items-center gap-2">
          {!isFirstTab && (
            <Button
              type="button"
              variant="ghost"
              onClick={goToPrevTab}
            >
              Anterior
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </Button>

          {!isLastTab ? (
            <Button
              type="button"
              variant="primary"
              onClick={goToNextTab}
            >
              Siguiente
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              loading={loading}
            >
              {initialData ? 'Actualizar' : 'Crear'} Producto
            </Button>
          )}
        </div>
      </div>
    </form>
  );
};
