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

// Definicion de tabs del formulario
const FORM_TABS: Tab[] = [
  { id: 'basico', label: 'Informacion Basica', icon: <Tag className="h-4 w-4" /> },
  { id: 'clasificacion', label: 'Clasificacion', icon: <Layers className="h-4 w-4" /> },
  { id: 'comercial', label: 'Datos Comerciales', icon: <DollarSign className="h-4 w-4" /> },
  { id: 'inventario', label: 'Inventario', icon: <Package className="h-4 w-4" /> },
  { id: 'marketplace', label: 'Mercado Libre', icon: <ShoppingBag className="h-4 w-4" /> }
];

export const ProductoForm: React.FC<ProductoFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
  productosExistentes = []
}) => {
  const { user } = useAuthStore();
  const { activeTab, setActiveTab } = useTabs('basico');

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
    enlaceProveedor: initialData?.enlaceProveedor || '',
    codigoUPC: initialData?.codigoUPC || '',
    precioSugerido: initialData?.precioSugerido || 0,
    margenMinimo: initialData?.margenMinimo || 20,
    margenObjetivo: initialData?.margenObjetivo || 35,
    stockMinimo: initialData?.stockMinimo || 10,
    stockMaximo: initialData?.stockMaximo || 100,
    habilitadoML: initialData?.habilitadoML || false,
    restriccionML: initialData?.restriccionML || '',
    costoFleteUSAPeru: initialData?.costoFleteUSAPeru || 0,
    // Ciclo de recompra
    servingsPerDay: initialData?.servingsPerDay,
    cicloRecompraDias: initialData?.cicloRecompraDias
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

    // Calcular precio sugerido
    let precioSugerido = formData.precioSugerido;
    let razonPrecio = '';
    if (inv) {
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
      alert(`Error al crear marca: ${error.message}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (['precioSugerido', 'margenMinimo', 'margenObjetivo', 'stockMinimo', 'stockMaximo', 'costoFleteUSAPeru', 'cicloRecompraDias', 'servingsPerDay'].includes(name)) {
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
          {/* TAB 1: INFORMACION BASICA */}
          <TabPanel tabId="basico" className="mt-6 space-y-4">
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

            {/* Seccion Ciclo de Recompra */}
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

              {/* Calculo automatico del ciclo de recompra */}
              {(() => {
                const contenidoNumero = formData.contenido ? parseInt(formData.contenido.replace(/\D/g, '')) : 0;
                const mostrar = contenidoNumero > 0 && formData.servingsPerDay && formData.servingsPerDay > 0;
                if (!mostrar) return null;
                const ciclo = Math.round(contenidoNumero / formData.servingsPerDay);
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
          </TabPanel>

          {/* TAB 2: CLASIFICACION */}
          <TabPanel tabId="clasificacion" className="mt-6 space-y-6">
            {/* Tipo de Producto */}
            <TipoProductoSelector
              value={formData.tipoProductoId}
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

          {/* TAB 3: DATOS COMERCIALES */}
          <TabPanel tabId="comercial" className="mt-6 space-y-4">
            {sugerenciasInteligentes && (
              <div className="flex items-center justify-end">
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
              </div>
            )}

            {sugerenciasInteligentes && usarSugerenciasInteligentes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Sugerencias basadas en investigacion</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
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

            <Input
              label="Costo Flete USA-Peru (USD/unidad)"
              name="costoFleteUSAPeru"
              type="number"
              step="0.01"
              value={formData.costoFleteUSAPeru}
              onChange={handleChange}
              helperText="Costo fijo que cobra el viajero por traer este producto"
            />

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
          </TabPanel>

          {/* TAB 4: INVENTARIO */}
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
          <TabPanel tabId="marketplace" className="mt-6 space-y-4">
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

            {investigacionSeleccionada && investigacionSeleccionada.presenciaML && investigacionSeleccionada.nivelCompetencia === 'alta' && (
              <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-2 rounded">
                <AlertTriangle className="h-4 w-4" />
                Competencia alta en ML ({investigacionSeleccionada.numeroCompetidores} competidores detectados)
              </div>
            )}

            {!formData.habilitadoML && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <ShoppingBag className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Este producto no sera publicado en Mercado Libre.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Activa la opcion de arriba para habilitar la publicacion.
                </p>
              </div>
            )}
          </TabPanel>
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
