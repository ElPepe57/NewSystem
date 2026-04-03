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
  ShoppingBag,
  Sun,
  GitBranch,
  Droplets,
  Palette
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
import { useDetectarVarianteCandidatos } from '../../../hooks/useDetectarVarianteCandidatos';
import { SugerenciaVarianteBanner } from './SugerenciaVarianteBanner';
import { VariantesTable, type VarianteRow } from './VariantesTable';
import { useLineaNegocioStore } from '../../../store/lineaNegocioStore';
import { usePaisOrigenStore } from '../../../store/paisOrigenStore';
import { METODO_ENVIO_LABELS } from '../../../types/paisOrigen.types';
import type { MetodoEnvio } from '../../../types/paisOrigen.types';
import { Globe, Building2, Plus, MapPin, Truck, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { ProductoFormData, Producto, InvestigacionMercado, AtributosSkincare, TipoProductoSKC, PasoRutinaSKC, TexturaSKC } from '../../../types/producto.types';
import { TIPO_PRODUCTO_SKC_LABELS, PASO_RUTINA_LABELS, TEXTURA_LABELS, TIPO_PIEL_OPTIONS, PREOCUPACIONES_OPTIONS, ZONA_APLICACION_OPTIONS } from '../../../types/producto.types';
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
  /** true = modo "Producto con variantes" — muestra tab Variantes */
  modoVariantes?: boolean;
  /** Handler para crear grupo con variantes (batch) */
  onSubmitConVariantes?: (
    datosComunes: any,
    variantes: { contenido: string; sabor?: string; dosaje?: string; volumen?: string; varianteLabel: string }[]
  ) => Promise<void>;
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

interface SugerenciasInteligentes {
  stockMinimo: number;
  stockMaximo: number;
  razonamientos: {
    stock?: string;
  };
}

// Definicion de tabs del formulario
const FORM_TABS: Tab[] = [
  { id: 'origen', label: 'Origen', icon: <Globe className="h-4 w-4" /> },
  { id: 'basico', label: 'Básico', icon: <Tag className="h-4 w-4" /> },
  { id: 'clasificacion', label: 'Clasificación', icon: <Layers className="h-4 w-4" /> },
  { id: 'inventario', label: 'Inventario', icon: <Package className="h-4 w-4" /> },
];

export const ProductoForm: React.FC<ProductoFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
  productosExistentes = [],
  modoVariantes = false,
  onSubmitConVariantes
}) => {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const { activeTab, setActiveTab } = useTabs('origen');
  const { lineasActivas, fetchLineasActivas } = useLineaNegocioStore();
  const { paisesActivos, fetchPaisesActivos, createPais, updatePais, deletePais, countProductosByPais } = usePaisOrigenStore();

  // Cargar líneas de negocio y países activos
  useEffect(() => {
    fetchLineasActivas();
    fetchPaisesActivos();
  }, [fetchLineasActivas, fetchPaisesActivos]);

  // Detección de variantes candidatas
  const [bannerVarianteDescartado, setBannerVarianteDescartado] = useState(false);

  // Estado de variantes para modo "con_variantes"
  const [variantesRows, setVariantesRows] = useState<VarianteRow[]>([
    { id: 'v1', presentacion: '', contenido: '', dosaje: '', sabor: '', codigoUPC: '', servingsPerDay: 0, varianteLabel: '', esPrincipal: true },
    { id: 'v2', presentacion: '', contenido: '', dosaje: '', sabor: '', codigoUPC: '', servingsPerDay: 0, varianteLabel: '', esPrincipal: false },
  ]);

  // Estado para crear/editar país inline
  const [mostrarNuevoPais, setMostrarNuevoPais] = useState(false);
  const [nuevoPaisNombre, setNuevoPaisNombre] = useState('');
  const [nuevoPaisCodigo, setNuevoPaisCodigo] = useState('');
  const [busquedaPais, setBusquedaPais] = useState('');
  const [creandoPais, setCreandoPais] = useState(false);
  const [editandoPais, setEditandoPais] = useState<{ id: string; codigo: string } | null>(null);
  const [eliminandoPais, setEliminandoPais] = useState<{ id: string; codigo: string; nombre: string; count: number } | null>(null);

  // Marca inteligente del maestro
  const [marcaSeleccionada, setMarcaSeleccionada] = useState<MarcaSnapshot | null>(null);
  const [marcaMetricas, setMarcaMetricas] = useState<{
    productosActivos: number;
    unidadesVendidas: number;
    margenPromedio: number;
  } | null>(null);

  const [formData, setFormData] = useState<ProductoFormData>({
    marca: initialData?.marca || '',
    marcaId: initialData?.marcaId || undefined,
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
    // Atributos Skincare
    atributosSkincare: initialData?.atributosSkincare || undefined,
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
  // demandaDetectada eliminada (DEAD-003) - era código muerto, nunca se seteaba

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
      if (!marcaSeleccionada && (initialData?.marcaId || initialData?.marca)) {
        try {
          // Priorizar marcaId si existe (más confiable que nombre)
          if (initialData.marcaId) {
            const marcaCompleta = await marcaService.getById(initialData.marcaId);
            if (marcaCompleta) {
              setMarcaSeleccionada({ marcaId: marcaCompleta.id, nombre: marcaCompleta.nombre });
              setFormData(prev => ({ ...prev, marcaId: marcaCompleta.id, marca: marcaCompleta.nombre }));
              if (marcaCompleta.metricas) {
                setMarcaMetricas({
                  productosActivos: marcaCompleta.metricas.productosActivos ?? 0,
                  unidadesVendidas: marcaCompleta.metricas.unidadesVendidas ?? 0,
                  margenPromedio: marcaCompleta.metricas.margenPromedio ?? 0
                });
              }
              return;
            }
          }

          // Fallback: buscar por nombre si no hay marcaId o no se encontró
          if (initialData.marca) {
            const marcas = await marcaService.getAll();
            const marcaEncontrada = marcas.find(
              m => m.nombre.toLowerCase() === initialData.marca?.toLowerCase()
            );

            if (marcaEncontrada) {
              setMarcaSeleccionada({ marcaId: marcaEncontrada.id, nombre: marcaEncontrada.nombre });
              setFormData(prev => ({ ...prev, marcaId: marcaEncontrada.id, marca: marcaEncontrada.nombre }));
              if (marcaEncontrada.metricas) {
                setMarcaMetricas({
                  productosActivos: marcaEncontrada.metricas.productosActivos ?? 0,
                  unidadesVendidas: marcaEncontrada.metricas.unidadesVendidas ?? 0,
                  margenPromedio: marcaEncontrada.metricas.margenPromedio ?? 0
                });
              }
            } else {
              setMarcaSeleccionada({ marcaId: '', nombre: initialData.marca });
            }
          }
        } catch (error) {
          console.error('Error al buscar marca en maestro:', error);
          if (initialData.marca) {
            setMarcaSeleccionada({ marcaId: '', nombre: initialData.marca });
          }
        }
      }
    };

    inicializarMarca();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.marca]);

  // Calcular ciclo de recompra automaticamente cuando cambian contenido y servingsPerDay
  useEffect(() => {
    const { contenido, servingsPerDay } = formData;
    const contenidoNumero = contenido ? parseInt(contenido.replace(/\D/g, '')) : 0;
    if (contenidoNumero > 0 && servingsPerDay && servingsPerDay > 0) {
      setFormData(prev => {
        const cicloCalculado = Math.round(contenidoNumero / servingsPerDay);
        return cicloCalculado !== prev.cicloRecompraDias
          ? { ...prev, cicloRecompraDias: cicloCalculado }
          : prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Detectar variantes candidatas (solo en modo creación)
  const candidatosVariante = useDetectarVarianteCandidatos(
    !initialData ? productosExistentes : [],
    formData.marca,
    formData.nombreComercial,
    formData.contenido,
    formData.dosaje,
    formData.sabor,
  );

  const handleAgregarComoVariante = (grupoProducto: Producto) => {
    setFormData(prev => ({
      ...prev,
      parentId: grupoProducto.id,
      esVariante: true,
      marca: grupoProducto.marca,
      nombreComercial: grupoProducto.nombreComercial,
      lineaNegocioId: grupoProducto.lineaNegocioId || prev.lineaNegocioId,
      paisOrigen: grupoProducto.paisOrigen || prev.paisOrigen,
      varianteLabel: prev.contenido || '',
    }));
    setBannerVarianteDescartado(true);
  };

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
    if (!investigacionSeleccionada) return null;

    const inv = investigacionSeleccionada;
    const demanda = null; // demandaDetectada eliminada (DEAD-003)

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
  }, [investigacionSeleccionada]);

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
  };

  // Handler para seleccion de marca desde el autocomplete
  const handleMarcaChange = async (marca: MarcaSnapshot | null) => {
    setMarcaSeleccionada(marca);

    if (marca) {
      setFormData(prev => ({ ...prev, marca: marca.nombre, marcaId: marca.marcaId || undefined }));

      if (marca.marcaId) {
        try {
          const marcaCompleta = await marcaService.getById(marca.marcaId);
          if (marcaCompleta?.metricas) {
            setMarcaMetricas({
              productosActivos: marcaCompleta.metricas.productosActivos ?? 0,
              unidadesVendidas: marcaCompleta.metricas.unidadesVendidas ?? 0,
              margenPromedio: marcaCompleta.metricas.margenPromedio ?? 0
            });
          }
        } catch (error) {
          console.error('Error al cargar metricas de marca:', error);
        }
      }
    } else {
      setFormData(prev => ({ ...prev, marca: '', marcaId: undefined }));
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

  // Helper para actualizar atributos skincare
  const updateSKC = (updates: Partial<AtributosSkincare>) => {
    setFormData(prev => ({
      ...prev,
      atributosSkincare: {
        tipoProductoSKC: 'otro',
        volumen: '',
        ...(prev.atributosSkincare || {}),
        ...updates,
      } as AtributosSkincare,
    }));
  };

  // Toggle chip para arrays de skincare
  const toggleSKCChip = (field: 'tipoPiel' | 'preocupaciones' | 'zonaAplicacion', value: string) => {
    const current = formData.atributosSkincare?.[field] || [];
    const updated = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value];
    updateSKC({ [field]: updated });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Icono de tendencia
  // TendenciaIcon eliminado (DEAD-003) — era código muerto

  // Navegacion entre tabs
  const goToNextTab = () => {
    const currentIndex = activeTabs.findIndex(t => t.id === activeTab);
    if (currentIndex < activeTabs.length - 1) {
      setActiveTab(activeTabs[currentIndex + 1].id);
    }
  };

  const goToPrevTab = () => {
    const currentIndex = activeTabs.findIndex(t => t.id === activeTab);
    if (currentIndex > 0) {
      setActiveTab(activeTabs[currentIndex - 1].id);
    }
  };

  // Dynamic tabs: add "Variantes" tab when in modoVariantes
  const activeTabs = useMemo(() => {
    if (modoVariantes) {
      return [
        ...FORM_TABS,
        { id: 'variantes', label: 'Variantes', icon: <GitBranch className="h-4 w-4" /> },
      ];
    }
    return FORM_TABS;
  }, [modoVariantes]);

  const isFirstTab = activeTab === activeTabs[0].id;
  const isLastTab = activeTab === activeTabs[activeTabs.length - 1].id;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* === TABS DE NAVEGACION === */}
      <div className="border-t pt-6">
        <Tabs
          tabs={activeTabs}
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
              {paisesActivos.length > 4 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={busquedaPais}
                    onChange={(e) => setBusquedaPais(e.target.value)}
                    placeholder="Buscar país por nombre o código..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {paisesActivos.filter(p => {
                  if (!busquedaPais) return true;
                  const q = busquedaPais.toLowerCase();
                  return p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
                }).map(pais => (
                  <div key={pais.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, paisOrigen: pais.codigo }))}
                      className={`w-full flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
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
                      </div>
                    </button>
                    {/* Acciones: editar / eliminar */}
                    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditandoPais({ id: pais.id, codigo: pais.codigo });
                          setNuevoPaisNombre(pais.nombre);
                          setNuevoPaisCodigo(pais.codigo);
                          setMostrarNuevoPais(true);
                        }}
                        className="p-1 rounded bg-white/80 hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Editar país"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const count = await countProductosByPais(pais.codigo);
                          setEliminandoPais({ id: pais.id, codigo: pais.codigo, nombre: pais.nombre, count });
                        }}
                        className="p-1 rounded bg-white/80 hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                        title="Eliminar país"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Botón Agregar País */}
                <button
                  type="button"
                  onClick={() => {
                    setEditandoPais(null);
                    setNuevoPaisNombre('');
                    setNuevoPaisCodigo('');
                    setMostrarNuevoPais(!mostrarNuevoPais);
                  }}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all"
                >
                  <Plus className="h-5 w-5" />
                  <p className="text-xs font-medium">Nuevo país</p>
                </button>
              </div>

              {/* Diálogo de confirmación para eliminar */}
              {eliminandoPais && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-3 space-y-3">
                  <h5 className="text-sm font-medium text-red-800">Eliminar "{eliminandoPais.nombre}" ({eliminandoPais.codigo})</h5>
                  {eliminandoPais.count > 0 ? (
                    <p className="text-xs text-red-700">
                      Este país está asociado a <strong>{eliminandoPais.count} producto{eliminandoPais.count > 1 ? 's' : ''}</strong>. Se limpiará el campo de origen de esos productos.
                    </p>
                  ) : (
                    <p className="text-xs text-red-700">Este país no tiene productos asociados.</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const result = await deletePais(eliminandoPais.id, eliminandoPais.codigo);
                          if (formData.paisOrigen === eliminandoPais.codigo) {
                            setFormData(prev => ({ ...prev, paisOrigen: '' }));
                          }
                          toast.success(`País "${eliminandoPais.nombre}" eliminado${result.productosLimpiados > 0 ? ` (${result.productosLimpiados} productos actualizados)` : ''}`);
                          setEliminandoPais(null);
                        } catch (err: any) {
                          toast.error(err.message || 'Error al eliminar país');
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                    >
                      Confirmar eliminación
                    </button>
                    <button
                      type="button"
                      onClick={() => setEliminandoPais(null)}
                      className="px-4 py-2 text-gray-600 text-sm rounded-lg hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Formulario inline para crear/editar país */}
              {mostrarNuevoPais && (
                <div className={`${editandoPais ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4 mt-3 space-y-3`}>
                  <h5 className={`text-sm font-medium ${editandoPais ? 'text-amber-800' : 'text-blue-800'}`}>
                    {editandoPais ? 'Editar país de origen' : 'Agregar nuevo país de origen'}
                  </h5>
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

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!nuevoPaisNombre || !nuevoPaisCodigo || creandoPais}
                      onClick={async () => {
                        if (!user || !nuevoPaisNombre || !nuevoPaisCodigo) return;
                        setCreandoPais(true);
                        try {
                          if (editandoPais) {
                            await updatePais(editandoPais.id, {
                              nombre: nuevoPaisNombre,
                              codigo: nuevoPaisCodigo,
                            }, user.uid);
                            if (formData.paisOrigen === editandoPais.codigo && nuevoPaisCodigo !== editandoPais.codigo) {
                              setFormData(prev => ({ ...prev, paisOrigen: nuevoPaisCodigo }));
                            }
                            toast.success('País actualizado');
                          } else {
                            await createPais({
                              nombre: nuevoPaisNombre,
                              codigo: nuevoPaisCodigo,
                              activo: true,
                            }, user.uid);
                            setFormData(prev => ({ ...prev, paisOrigen: nuevoPaisCodigo }));
                          }
                          await fetchPaisesActivos();
                          setNuevoPaisNombre('');
                          setNuevoPaisCodigo('');
                          setEditandoPais(null);
                          setMostrarNuevoPais(false);
                        } catch (err: any) {
                          toast.error(err.message || `Error al ${editandoPais ? 'actualizar' : 'crear'} país`);
                        } finally {
                          setCreandoPais(false);
                        }
                      }}
                      className={`px-4 py-2 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                        editandoPais ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {creandoPais ? (editandoPais ? 'Guardando...' : 'Creando...') : (editandoPais ? 'Guardar cambios' : 'Crear país')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarNuevoPais(false);
                        setEditandoPais(null);
                        setNuevoPaisNombre('');
                        setNuevoPaisCodigo('');
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
            {/* Sugerencia de variante — solo en modo creación */}
            {!initialData && !bannerVarianteDescartado && candidatosVariante.length > 0 && !formData.parentId && (
              <SugerenciaVarianteBanner
                candidatos={candidatosVariante}
                onAgregarComoVariante={handleAgregarComoVariante}
                onCrearIndependiente={() => setBannerVarianteDescartado(true)}
                onDescartar={() => setBannerVarianteDescartado(true)}
              />
            )}

            {/* Variante Label — solo si es variante */}
            {formData.parentId && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <p className="text-xs text-blue-700 font-medium">Creando variante — solo modifica lo que cambia</p>
                <Input
                  label="¿Qué diferencia esta variante?"
                  name="varianteLabel"
                  value={formData.varianteLabel || ''}
                  onChange={handleChange}
                  placeholder="ej: 120 caps, 200ml, Sabor Limón..."
                  required
                />
              </div>
            )}
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

            <AutocompleteInput
              label="Nombre Comercial"
              value={formData.nombreComercial}
              onChange={handleAutocompleteChange('nombreComercial')}
              suggestions={sugerencias.nombresComerciales}
              required
              placeholder={esSuplemento ? 'ej: Ultimate Omega' : 'ej: Advanced Snail Mucin'}
              allowCreate
              createLabel="Crear nombre"
            />

            {/* === CAMPOS ESPECÍFICOS POR LÍNEA DE NEGOCIO === */}
            {esSuplemento ? (
              <>
                {/* SUPLEMENTOS: en modo variantes, todo va en tab Variantes */}
                {modoVariantes ? (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <GitBranch className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Producto con variantes:</strong> Presentación, Dosaje, Contenido y Sabor se definen por cada variante en el tab{' '}
                      <button type="button" className="underline font-medium" onClick={() => setActiveTab('variantes')}>
                        Variantes
                      </button>.
                    </span>
                  </div>
                ) : (
                  <>
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
                  </>
                )}

                {/* Ciclo de Recompra — solo suplementos, solo modo simple */}
                {!modoVariantes && (
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
                )}
              </>
            ) : (
              <>
                {/* SKINCARE — en modo variantes todo va en tab Variantes */}
                {modoVariantes ? (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <GitBranch className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Producto con variantes:</strong> Tipo, Volumen, Ingrediente y demás campos se definen por cada variante en el tab{' '}
                      <button type="button" className="underline font-medium" onClick={() => setActiveTab('variantes')}>
                        Variantes
                      </button>.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <AutocompleteInput
                        label="Tipo de Producto"
                        value={formData.atributosSkincare?.tipoProductoSKC || ''}
                        onChange={(v) => updateSKC({ tipoProductoSKC: v as TipoProductoSKC })}
                        suggestions={Object.values(TIPO_PRODUCTO_SKC_LABELS)}
                        placeholder="ej: Serum, Crema, Protector Solar..."
                        allowCreate
                        createLabel="Usar"
                      />
                      <AutocompleteInput
                        label="Volumen / Peso"
                        value={formData.atributosSkincare?.volumen || ''}
                        onChange={(v) => updateSKC({ volumen: v })}
                        suggestions={[]}
                        placeholder="ej: 50ml, 27g, 200ml..."
                        allowCreate
                        createLabel="Usar"
                      />
                      <AutocompleteInput
                        label="Ingrediente Clave"
                        value={formData.atributosSkincare?.ingredienteClave || ''}
                        onChange={(v) => updateSKC({ ingredienteClave: v })}
                        suggestions={[]}
                        placeholder="ej: Centella, Niacinamida..."
                        allowCreate
                        createLabel="Usar"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <AutocompleteInput
                        label="Línea del Producto"
                        value={formData.atributosSkincare?.lineaProducto || ''}
                        onChange={(v) => updateSKC({ lineaProducto: v })}
                        suggestions={[]}
                        placeholder="ej: Madagascar Centella..."
                        allowCreate
                        createLabel="Usar"
                      />
                      <AutocompleteInput
                        label="Tipo de Piel"
                        value={(formData.atributosSkincare?.tipoPiel || []).join(', ')}
                        onChange={(v) => updateSKC({ tipoPiel: v ? v.split(',').map(s => s.trim()).filter(Boolean) : [] })}
                        suggestions={TIPO_PIEL_OPTIONS}
                        placeholder="ej: Grasa, Mixta, Sensible..."
                        allowCreate
                        createLabel="Usar"
                      />
                      <AutocompleteInput
                        label="Preocupaciones"
                        value={(formData.atributosSkincare?.preocupaciones || []).join(', ')}
                        onChange={(v) => updateSKC({ preocupaciones: v ? v.split(',').map(s => s.trim()).filter(Boolean) : [] })}
                        suggestions={PREOCUPACIONES_OPTIONS}
                        placeholder="ej: Acné, Poros, Manchas..."
                        allowCreate
                        createLabel="Usar"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input
                        label="SPF"
                        name="spf"
                        type="number"
                        value={formData.atributosSkincare?.spf || ''}
                        onChange={(e) => updateSKC({ spf: parseInt(e.target.value) || undefined })}
                        placeholder="ej: 50 (solo protectores)"
                      />
                      <Input
                        label="PA"
                        name="pa"
                        value={formData.atributosSkincare?.pa || ''}
                        onChange={(e) => updateSKC({ pa: e.target.value || undefined })}
                        placeholder="ej: PA++++"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="PAO (meses post-apertura)"
                        name="pao"
                        type="number"
                        value={formData.atributosSkincare?.pao || ''}
                        onChange={(e) => updateSKC({ pao: parseInt(e.target.value) || undefined })}
                        placeholder="ej: 12"
                      />
                      <Input
                        label="Código UPC/EAN"
                        name="codigoUPC"
                        value={formData.codigoUPC}
                        onChange={handleChange}
                        placeholder="ej: 768990014307"
                      />
                    </div>
                  </>
                )}
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

          {/* TAB 5: VARIANTES (solo en modo con_variantes) */}
          {modoVariantes && (
            <TabPanel tabId="variantes" className="mt-6">
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Producto con variantes</p>
                      <p className="text-xs text-blue-600">
                        Los campos de los tabs anteriores (marca, nombre, categorías) se comparten entre todas las variantes.
                        Aquí defines lo que cambia en cada una.
                      </p>
                    </div>
                  </div>
                </div>

                <VariantesTable
                  variantes={variantesRows}
                  onChange={setVariantesRows}
                  skuPrefix={lineasActivas.find(l => l.id === formData.lineaNegocioId)?.codigo || 'BMN'}
                  esSkincare={!esSuplemento}
                  sugerencias={{
                    presentaciones: sugerencias.presentaciones,
                    dosajes: sugerencias.dosajes,
                    contenidos: sugerencias.contenidos,
                  }}
                />
              </div>
            </TabPanel>
          )}

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
          ) : modoVariantes && onSubmitConVariantes ? (
            <Button
              type="button"
              variant="primary"
              loading={loading}
              disabled={variantesRows.length < 2 || variantesRows.some(v => !v.contenido.trim())}
              onClick={() => {
                const datosComunes = {
                  marca: formData.marca,
                  marcaId: formData.marcaId,
                  nombreComercial: formData.nombreComercial,
                  presentacion: formData.presentacion,
                  dosaje: formData.dosaje,
                  grupo: formData.grupo,
                  subgrupo: formData.subgrupo,
                  paisOrigen: formData.paisOrigen,
                  lineaNegocioId: formData.lineaNegocioId,
                  tipoProductoId: formData.tipoProductoId,
                  categoriaIds: formData.categoriaIds,
                  categoriaPrincipalId: formData.categoriaPrincipalId,
                  etiquetaIds: formData.etiquetaIds,
                  stockMinimo: formData.stockMinimo,
                  stockMaximo: formData.stockMaximo,
                };
                const variantes = variantesRows.map(v => ({
                  contenido: v.contenido,
                  sabor: v.sabor || undefined,
                  dosaje: v.dosaje || formData.dosaje || undefined,
                  varianteLabel: v.varianteLabel || v.contenido,
                }));
                onSubmitConVariantes(datosComunes, variantes);
              }}
            >
              <GitBranch className="h-4 w-4 mr-1" />
              Crear grupo ({variantesRows.length} variantes)
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
