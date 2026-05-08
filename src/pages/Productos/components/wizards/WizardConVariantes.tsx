/**
 * WizardConVariantes · Wizard PRODUCTO CON VARIANTES · F5(A) sidebar 4 pasos
 *
 * Mockup canónico: docs/mockups/productos/18-wizard-crear-con-variantes.html
 *
 * 4 pasos:
 *   1. Datos comunes · marca + nombre + línea + presentación + atributos base
 *   2. Configurar variantes · eje (volumen/contenido/sabor/otro) + lista a crear
 *   3. Stock por variante · cantidades iniciales (placeholder · usa stockMin/Max default)
 *   4. Confirmar · revisión + crear batch (mín 2 variantes · usa createConVariantes)
 *
 * Output: ProductoService.createConVariantes(datosComunes, variantes[], userId)
 *
 * Layout responsive:
 *   DESKTOP: sidebar izq con stepper vertical + contenido derecho
 *   MOBILE:  stepper top horizontal + contenido fullscreen
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  GitBranch,
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  Package,
  CheckCircle2,
  Droplets,
  Pill,
  Sun,
} from 'lucide-react';
import type {
  Presentacion,
  AtributosSkincare,
  AtributosSuplementos,
  TipoProductoSKC,
  PasoRutinaSKC,
  TexturaSKC,
  PresentacionSUP,
  TomaConComida,
  EdadRecomendada,
} from '../../../../types/producto.types';
import {
  TIPO_PRODUCTO_SKC_LABELS,
  PASO_RUTINA_LABELS,
  TEXTURA_LABELS,
  TIPO_PIEL_OPTIONS,
  PREOCUPACIONES_OPTIONS,
  ZONA_APLICACION_OPTIONS,
  PRESENTACION_SUP_LABELS,
  MOMENTO_DIA_OPTIONS,
  TOMA_CON_COMIDA_LABELS,
  EDAD_RECOMENDADA_LABELS,
  RESTRICCIONES_SUGERIDAS,
} from '../../../../types/producto.types';
import { StepperVerticalWizard, type StepConfig } from './StepperVerticalWizard';
import {
  MaestroSelect,
  MaestroChipsMulti,
  ChipsCerrados,
  type MaestroChipSelection,
  type ChipCerradoOption,
} from '../../../../design-system';
import { useMarcaStore } from '../../../../store/marcaStore';
import { useTipoProductoStore } from '../../../../store/tipoProductoStore';
import { useCategoriaStore } from '../../../../store/categoriaStore';
import { useEtiquetaStore } from '../../../../store/etiquetaStore';
import { useAuthStore } from '../../../../store/authStore';

interface WizardConVariantesProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (datosComunes: DatosComunes, variantes: VarianteEntry[]) => Promise<void>;
  lineasNegocio?: Array<{ id: string; nombre: string; codigo?: string }>;
}

export interface DatosComunes {
  marca: string;
  marcaId?: string;
  nombreComercial: string;
  presentacion: Presentacion;
  paisOrigen: string;
  lineaNegocioId: string;
  costoFleteInternacional?: number;
  pesoLibras?: number;
  stockMinimo: number;
  stockMaximo: number;
  // Fase E3 · Maestros + atributos compartidos por todas las variantes
  tipoProductoId?: string;
  categoriaIds?: string[];
  categoriaPrincipalId?: string;
  etiquetaIds?: string[];
  atributosSkincare?: AtributosSkincare;
  atributosSuplementos?: AtributosSuplementos;
}

export interface VarianteEntry {
  cantidad: string; // "30"
  unidad: string; // "ml" | "caps" | "g"
  etiqueta: string; // "Original" · "Travel" · "Mini"
  varianteLabel: string; // calculado · "30 ml · Original"
  contenido: string; // calculado · "30 ml"
  precioVenta?: number; // opcional · paso 3
  stockInicial?: number; // opcional · paso 3
}

type EjeVariacion = 'volumen' | 'contenido' | 'sabor' | 'otro';
type StepKey = 'datos' | 'config' | 'stock' | 'confirmar';

const PRESENTACIONES: { value: Presentacion; label: string }[] = [
  { value: 'capsulas', label: 'Cápsulas' },
  { value: 'capsulas_blandas', label: 'Cápsulas blandas' },
  { value: 'tabletas', label: 'Tabletas' },
  { value: 'gomitas', label: 'Gomitas' },
  { value: 'polvo', label: 'Polvo' },
  { value: 'liquido', label: 'Líquido' },
];

// GAP-143 fix · paisOrigen como CODIGO de 3 letras
const PAISES = [
  { value: 'USA', label: 'Estados Unidos', emoji: '🇺🇸' },
  { value: 'KOR', label: 'Corea del Sur', emoji: '🇰🇷' },
  { value: 'CHN', label: 'China', emoji: '🇨🇳' },
  { value: 'FRA', label: 'Francia', emoji: '🇫🇷' },
  { value: 'PER', label: 'Perú', emoji: '🇵🇪' },
];

const EJES: { key: EjeVariacion; label: string; unidadDefault: string }[] = [
  { key: 'volumen', label: 'Volumen (ml)', unidadDefault: 'ml' },
  { key: 'contenido', label: 'Contenido (caps)', unidadDefault: 'caps' },
  { key: 'sabor', label: 'Sabor', unidadDefault: '' },
  { key: 'otro', label: 'Otro', unidadDefault: '' },
];

const PALETTE = ['#0d9488', '#f59e0b', '#8b5cf6', '#a855f7', '#0ea5e9', '#f43f5e'];

const STEPS: StepConfig[] = [
  { key: 'datos', label: 'Datos comunes', subtitulo: 'Marca, línea, atributos base' },
  { key: 'config', label: 'Configurar variantes', subtitulo: 'Eje + lista de variantes' },
  { key: 'stock', label: 'Stock por variante', subtitulo: 'Cantidades iniciales' },
  { key: 'confirmar', label: 'Confirmar', subtitulo: 'Revisar y crear batch' },
];

export const WizardConVariantes: React.FC<WizardConVariantesProps> = ({ open, onClose, onSubmit, lineasNegocio = [] }) => {
  const [step, setStep] = useState<StepKey>('datos');
  const [submitting, setSubmitting] = useState(false);
  const user = useAuthStore(s => s.user);

  // Stores de maestros (Fase E3)
  const { marcasActivas, fetchMarcasActivas, createMarca } = useMarcaStore();
  const { tiposActivos, fetchTiposActivos, create: createTipo } = useTipoProductoStore();
  const { categoriasActivas, fetchCategoriasActivas, create: createCategoria } = useCategoriaStore();
  const { etiquetasActivas, fetchEtiquetasActivas, create: createEtiqueta } = useEtiquetaStore();

  useEffect(() => {
    if (!open) return;
    fetchMarcasActivas();
    fetchTiposActivos();
    fetchCategoriasActivas();
    fetchEtiquetasActivas();
  }, [open, fetchMarcasActivas, fetchTiposActivos, fetchCategoriasActivas, fetchEtiquetasActivas]);

  // Paso 1 · Datos comunes (con maestros vinculados · Fase E3)
  const [marca, setMarca] = useState('');
  const [marcaId, setMarcaId] = useState<string | undefined>();
  const [nombreComercial, setNombreComercial] = useState('');
  const [presentacion, setPresentacion] = useState<Presentacion>('liquido');
  const [paisOrigen, setPaisOrigen] = useState('USA');
  const [lineaNegocioId, setLineaNegocioId] = useState('');
  const [costoFlete, setCostoFlete] = useState('');
  const [pesoLibras, setPesoLibras] = useState('');
  const [stockMinimo, setStockMinimo] = useState('5');
  const [stockMaximo, setStockMaximo] = useState('100');

  // Maestros vinculados (compartidos por todas las variantes)
  const [tipoProductoId, setTipoProductoId] = useState<string | undefined>();
  const [tipoProductoNombre, setTipoProductoNombre] = useState<string>('');
  const [categoriasSel, setCategoriasSel] = useState<MaestroChipSelection[]>([]);
  const [etiquetasSel, setEtiquetasSel] = useState<MaestroChipSelection[]>([]);

  // Atributos cerrados SKC (Fase E3 · compartidos)
  const [skcTipo, setSkcTipo] = useState<TipoProductoSKC | ''>('');
  const [skcVolumen, setSkcVolumen] = useState<string>('');
  const [skcUnidad, setSkcUnidad] = useState<'ml' | 'g' | 'oz' | 'unidades'>('ml');
  const [skcIngredienteClave, setSkcIngredienteClave] = useState<string>('');
  const [skcLineaProducto, setSkcLineaProducto] = useState<string>('');
  const [skcTipoPiel, setSkcTipoPiel] = useState<string[]>([]);
  const [skcPreocupaciones, setSkcPreocupaciones] = useState<string[]>([]);
  const [skcPasoRutina, setSkcPasoRutina] = useState<PasoRutinaSKC | ''>('');
  const [skcTextura, setSkcTextura] = useState<TexturaSKC | ''>('');
  const [skcZona, setSkcZona] = useState<string[]>([]);
  const [skcSpf, setSkcSpf] = useState<string>('');
  const [skcPa, setSkcPa] = useState<string>('');

  // Atributos cerrados SUP (Fase E3 · compartidos)
  const [supPresentacion, setSupPresentacion] = useState<PresentacionSUP | ''>('');
  const [supRestricciones, setSupRestricciones] = useState<string[]>([]);
  const [supMomentoDia, setSupMomentoDia] = useState<string[]>([]);
  const [supTomaConComida, setSupTomaConComida] = useState<TomaConComida | ''>('');
  const [supEdad, setSupEdad] = useState<EdadRecomendada | ''>('');
  const [supAdvertencias, setSupAdvertencias] = useState<string>('');

  // Detección SKC/SUP
  const lineaCodigo = useMemo(() => {
    if (!lineaNegocioId) return '';
    const linea = lineasNegocio.find(l => l.id === lineaNegocioId);
    return (linea?.codigo ?? '').toUpperCase();
  }, [lineaNegocioId, lineasNegocio]);
  const esSKC = lineaCodigo === 'SKC';
  const esSUP = lineaCodigo === 'SUP';
  const esProtectorSolar = skcTipo === 'protector_solar';

  // Paso 2 · Configurar variantes
  const [ejeVariacion, setEjeVariacion] = useState<EjeVariacion>('volumen');
  const [variantes, setVariantes] = useState<VarianteEntry[]>([
    { cantidad: '30', unidad: 'ml', etiqueta: 'Original', varianteLabel: '30 ml · Original', contenido: '30 ml' },
    { cantidad: '15', unidad: 'ml', etiqueta: 'Travel', varianteLabel: '15 ml · Travel', contenido: '15 ml' },
  ]);

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setStep('datos');
      setSubmitting(false);
      setMarca('');
      setMarcaId(undefined);
      setTipoProductoId(undefined);
      setTipoProductoNombre('');
      setCategoriasSel([]);
      setEtiquetasSel([]);
      // Reset SKC
      setSkcTipo(''); setSkcVolumen(''); setSkcUnidad('ml'); setSkcIngredienteClave('');
      setSkcLineaProducto(''); setSkcTipoPiel([]); setSkcPreocupaciones([]);
      setSkcPasoRutina(''); setSkcTextura(''); setSkcZona([]); setSkcSpf(''); setSkcPa('');
      // Reset SUP
      setSupPresentacion(''); setSupRestricciones([]); setSupMomentoDia([]);
      setSupTomaConComida(''); setSupEdad(''); setSupAdvertencias('');
    }
  }, [open]);

  // ESC
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  // Validación por paso
  const atributosOK = !esSKC && !esSUP
    ? true
    : esSKC ? Boolean(skcTipo)
    : esSUP ? Boolean(supPresentacion)
    : true;
  const datosOK = marca.trim().length > 0 && nombreComercial.trim().length > 0 && lineaNegocioId.length > 0 && atributosOK;
  const configOK = variantes.length >= 2 && variantes.every(v => v.cantidad.trim() && v.unidad.trim());

  const completedSteps = useMemo(() => {
    const list: string[] = [];
    if (datosOK && step !== 'datos') list.push('datos');
    if (datosOK && configOK && (step === 'stock' || step === 'confirmar')) list.push('config');
    if (datosOK && configOK && step === 'confirmar') list.push('stock');
    return list;
  }, [datosOK, configOK, step]);

  // Resumen acumulado
  const lineaNombre = useMemo(
    () => lineasNegocio.find(l => l.id === lineaNegocioId)?.nombre ?? '—',
    [lineaNegocioId, lineasNegocio]
  );

  const resumen = useMemo(() => {
    const items = [];
    if (marca) items.push({ label: 'Marca', value: marca });
    if (lineaNombre !== '—') items.push({ label: 'Línea', value: lineaNombre });
    if (variantes.length > 0) items.push({ label: 'Variantes', value: <span className="text-sky-700 font-bold">{variantes.length}</span> });
    return items;
  }, [marca, lineaNombre, variantes.length]);

  // Handlers variantes
  const updateVariante = (idx: number, patch: Partial<VarianteEntry>) => {
    setVariantes(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      // Recalcular labels
      const v = next[idx];
      const cant = v.cantidad.trim();
      const uni = v.unidad.trim();
      const eti = v.etiqueta.trim();
      next[idx].contenido = cant && uni ? `${cant} ${uni}`.trim() : cant || '—';
      next[idx].varianteLabel = eti ? `${next[idx].contenido} · ${eti}` : next[idx].contenido;
      return next;
    });
  };

  const addVariante = () => {
    const ejeConfig = EJES.find(e => e.key === ejeVariacion);
    setVariantes(prev => [
      ...prev,
      {
        cantidad: '',
        unidad: ejeConfig?.unidadDefault ?? '',
        etiqueta: '',
        varianteLabel: '',
        contenido: '',
      },
    ]);
  };

  const removeVariante = (idx: number) => {
    if (variantes.length <= 2) return; // mínimo 2
    setVariantes(prev => prev.filter((_, i) => i !== idx));
  };

  const goToStep = (target: StepKey) => {
    if (target === step) return;
    if (target === 'datos') return setStep('datos');
    if (target === 'config' && datosOK) return setStep('config');
    if (target === 'stock' && datosOK && configOK) return setStep('stock');
    if (target === 'confirmar' && datosOK && configOK) return setStep('confirmar');
  };

  const stepIdx = STEPS.findIndex(s => s.key === step);
  const goNext = () => {
    if (step === 'datos' && datosOK) setStep('config');
    else if (step === 'config' && configOK) setStep('stock');
    else if (step === 'stock') setStep('confirmar');
  };
  const goBack = () => {
    if (step === 'config') setStep('datos');
    else if (step === 'stock') setStep('config');
    else if (step === 'confirmar') setStep('stock');
  };

  const handleSubmit = async () => {
    if (!datosOK || !configOK || submitting) return;
    setSubmitting(true);
    try {
      // Fase E3 · construir atributos según línea
      const categoriaPrincipal = categoriasSel.find(c => c.esPrincipal);

      const atributosSkincare: AtributosSkincare | undefined = esSKC && skcTipo ? {
        tipoProductoSKC: skcTipo,
        volumen: skcVolumen.trim(),
        unidadMedida: skcUnidad,
        ingredienteClave: skcIngredienteClave.trim() || undefined,
        lineaProducto: skcLineaProducto.trim() || undefined,
        tipoPiel: skcTipoPiel.length ? skcTipoPiel : undefined,
        preocupaciones: skcPreocupaciones.length ? skcPreocupaciones : undefined,
        pasoRutina: skcPasoRutina || undefined,
        textura: skcTextura || undefined,
        zonaAplicacion: skcZona.length ? skcZona : undefined,
        spf: esProtectorSolar && skcSpf ? parseInt(skcSpf) : undefined,
        pa: esProtectorSolar && skcPa ? skcPa : undefined,
      } : undefined;

      const atributosSuplementos: AtributosSuplementos | undefined = esSUP && supPresentacion ? {
        presentacion: supPresentacion,
        momentoDia: supMomentoDia.length ? supMomentoDia : undefined,
        tomaConComida: supTomaConComida || undefined,
        edadRecomendada: supEdad || undefined,
        restricciones: supRestricciones.length ? supRestricciones : undefined,
        advertencias: supAdvertencias.trim() || undefined,
      } : undefined;

      const datosComunes: DatosComunes = {
        marca: marca.trim(),
        marcaId,
        nombreComercial: nombreComercial.trim(),
        presentacion,
        paisOrigen,
        lineaNegocioId,
        costoFleteInternacional: costoFlete ? parseFloat(costoFlete) : undefined,
        pesoLibras: pesoLibras ? parseFloat(pesoLibras) : undefined,
        stockMinimo: parseInt(stockMinimo) || 0,
        stockMaximo: parseInt(stockMaximo) || 100,
        // Maestros vinculados (compartidos)
        tipoProductoId,
        categoriaIds: categoriasSel.map(c => c.id),
        categoriaPrincipalId: categoriaPrincipal?.id,
        etiquetaIds: etiquetasSel.map(e => e.id),
        // Atributos cerrados (compartidos por todas las variantes)
        atributosSkincare,
        atributosSuplementos,
      };
      await onSubmit(datosComunes, variantes);
    } catch (err) {
      console.error('[WizardConVariantes] error', err);
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        aria-label="Cerrar"
      />

      <div
        className="relative w-full lg:w-auto lg:max-w-6xl lg:mx-auto bg-white lg:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col lg:flex-row max-h-[95vh] lg:max-h-[90vh]"
        style={{ minHeight: '500px' }}
      >
        {/* Drag handle mobile */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Sidebar/Stepper */}
        <StepperVerticalWizard
          steps={STEPS}
          activeStep={step}
          completedSteps={completedSteps}
          tone="sky"
          headerIcon={GitBranch}
          headerTitle="Producto con variantes"
          headerSubtitle="Múltiples SKUs hijos"
          resumen={resumen}
          onStepClick={k => goToStep(k as StepKey)}
        />

        {/* Contenido */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header del paso */}
          <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-4 lg:px-6 py-3 lg:py-4 flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  Paso {stepIdx + 1} de {STEPS.length}
                </div>
                <h2 className="text-base lg:text-lg font-bold text-slate-900">{STEPS[stepIdx].label}</h2>
                <p className="text-[11px] lg:text-xs text-slate-500 mt-0.5">{getDescripcionPaso(step)}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 p-4 lg:p-5 overflow-y-auto">
            {step === 'datos' && (
              <PasoDatos
                marca={marca}
                setMarca={setMarca}
                marcaId={marcaId}
                setMarcaId={setMarcaId}
                marcasActivas={marcasActivas}
                createMarca={createMarca}
                user={user}
                nombreComercial={nombreComercial}
                setNombreComercial={setNombreComercial}
                presentacion={presentacion}
                setPresentacion={setPresentacion}
                paisOrigen={paisOrigen}
                setPaisOrigen={setPaisOrigen}
                lineaNegocioId={lineaNegocioId}
                setLineaNegocioId={setLineaNegocioId}
                lineasNegocio={lineasNegocio}
                costoFlete={costoFlete}
                setCostoFlete={setCostoFlete}
                pesoLibras={pesoLibras}
                setPesoLibras={setPesoLibras}
                stockMinimo={stockMinimo}
                setStockMinimo={setStockMinimo}
                stockMaximo={stockMaximo}
                setStockMaximo={setStockMaximo}
                // Maestros
                tipoProductoId={tipoProductoId}
                setTipoProductoId={setTipoProductoId}
                tipoProductoNombre={tipoProductoNombre}
                setTipoProductoNombre={setTipoProductoNombre}
                tiposActivos={tiposActivos}
                createTipo={createTipo}
                categoriasSel={categoriasSel}
                setCategoriasSel={setCategoriasSel}
                categoriasActivas={categoriasActivas}
                createCategoria={createCategoria}
                etiquetasSel={etiquetasSel}
                setEtiquetasSel={setEtiquetasSel}
                etiquetasActivas={etiquetasActivas}
                createEtiqueta={createEtiqueta}
                // Detección
                esSKC={esSKC}
                esSUP={esSUP}
                esProtectorSolar={esProtectorSolar}
                // SKC
                skcTipo={skcTipo} setSkcTipo={setSkcTipo}
                skcVolumen={skcVolumen} setSkcVolumen={setSkcVolumen}
                skcUnidad={skcUnidad} setSkcUnidad={setSkcUnidad}
                skcIngredienteClave={skcIngredienteClave} setSkcIngredienteClave={setSkcIngredienteClave}
                skcLineaProducto={skcLineaProducto} setSkcLineaProducto={setSkcLineaProducto}
                skcTipoPiel={skcTipoPiel} setSkcTipoPiel={setSkcTipoPiel}
                skcPreocupaciones={skcPreocupaciones} setSkcPreocupaciones={setSkcPreocupaciones}
                skcPasoRutina={skcPasoRutina} setSkcPasoRutina={setSkcPasoRutina}
                skcTextura={skcTextura} setSkcTextura={setSkcTextura}
                skcZona={skcZona} setSkcZona={setSkcZona}
                skcSpf={skcSpf} setSkcSpf={setSkcSpf}
                skcPa={skcPa} setSkcPa={setSkcPa}
                // SUP
                supPresentacion={supPresentacion} setSupPresentacion={setSupPresentacion}
                supRestricciones={supRestricciones} setSupRestricciones={setSupRestricciones}
                supMomentoDia={supMomentoDia} setSupMomentoDia={setSupMomentoDia}
                supTomaConComida={supTomaConComida} setSupTomaConComida={setSupTomaConComida}
                supEdad={supEdad} setSupEdad={setSupEdad}
                supAdvertencias={supAdvertencias} setSupAdvertencias={setSupAdvertencias}
              />
            )}
            {step === 'config' && (
              <PasoConfig
                ejeVariacion={ejeVariacion}
                setEjeVariacion={setEjeVariacion}
                variantes={variantes}
                updateVariante={updateVariante}
                addVariante={addVariante}
                removeVariante={removeVariante}
                nombreBase={nombreComercial}
              />
            )}
            {step === 'stock' && (
              <PasoStock variantes={variantes} updateVariante={updateVariante} />
            )}
            {step === 'confirmar' && (
              <PasoConfirmar
                marca={marca}
                nombreComercial={nombreComercial}
                lineaNombre={lineaNombre}
                variantes={variantes}
              />
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-5 py-2.5 lg:py-3 flex items-center justify-between gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 'datos'}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Atrás</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
              >
                Cancelar
              </button>
              {step !== 'confirmar' ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={(step === 'datos' && !datosOK) || (step === 'config' && !configOK)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  Siguiente
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!datosOK || !configOK || submitting}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  {submitting ? 'Creando...' : `Crear ${variantes.length} variantes`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-componentes de pasos ────────────────────────────────────────────────

function getDescripcionPaso(step: StepKey): string {
  switch (step) {
    case 'datos':
      return 'Datos compartidos por todas las variantes del grupo';
    case 'config':
      return 'Define las presentaciones (tamaños/contenidos) que tendrá este producto';
    case 'stock':
      return 'Stock inicial y precio de venta por variante (opcional · se puede definir después)';
    case 'confirmar':
      return 'Revisa los datos antes de crear el batch de variantes';
  }
}

const PasoDatos: React.FC<any> = (props) => {
  const {
    marca, setMarca, marcaId, setMarcaId, marcasActivas, createMarca, user,
    nombreComercial, setNombreComercial, presentacion, setPresentacion,
    paisOrigen, setPaisOrigen, lineaNegocioId, setLineaNegocioId, lineasNegocio,
    costoFlete, setCostoFlete, pesoLibras, setPesoLibras,
    stockMinimo, setStockMinimo, stockMaximo, setStockMaximo,
    tipoProductoId, setTipoProductoId, tipoProductoNombre, setTipoProductoNombre,
    tiposActivos, createTipo,
    categoriasSel, setCategoriasSel, categoriasActivas, createCategoria,
    etiquetasSel, setEtiquetasSel, etiquetasActivas, createEtiqueta,
    esSKC, esSUP, esProtectorSolar,
    skcTipo, setSkcTipo, skcVolumen, setSkcVolumen, skcUnidad, setSkcUnidad,
    skcIngredienteClave, setSkcIngredienteClave, skcLineaProducto, setSkcLineaProducto,
    skcTipoPiel, setSkcTipoPiel, skcPreocupaciones, setSkcPreocupaciones,
    skcPasoRutina, setSkcPasoRutina, skcTextura, setSkcTextura,
    skcZona, setSkcZona, skcSpf, setSkcSpf, skcPa, setSkcPa,
    supPresentacion, setSupPresentacion, supRestricciones, setSupRestricciones,
    supMomentoDia, setSupMomentoDia, supTomaConComida, setSupTomaConComida,
    supEdad, setSupEdad, supAdvertencias, setSupAdvertencias,
  } = props;

  const tieneAtributos = esSKC || esSUP;

  // Opciones para chips cerrados (memoizadas)
  const opcionesTipoSKC: ChipCerradoOption[] = useMemo(
    () => Object.entries(TIPO_PRODUCTO_SKC_LABELS).map(([value, label]) => ({ value, label: label as string })), [],
  );
  const opcionesTipoPiel: ChipCerradoOption[] = useMemo(
    () => TIPO_PIEL_OPTIONS.map(o => ({ value: o, label: o, destacado: o === 'Todo tipo' })), [],
  );
  const opcionesPreocupaciones: ChipCerradoOption[] = useMemo(
    () => PREOCUPACIONES_OPTIONS.map(o => ({ value: o, label: o })), [],
  );
  const opcionesPasoRutina: ChipCerradoOption[] = useMemo(
    () => Object.entries(PASO_RUTINA_LABELS).map(([value, label]) => ({ value, label: label as string })), [],
  );
  const opcionesTextura: ChipCerradoOption[] = useMemo(
    () => Object.entries(TEXTURA_LABELS).map(([value, label]) => ({ value, label: label as string })), [],
  );
  const opcionesZona: ChipCerradoOption[] = useMemo(
    () => ZONA_APLICACION_OPTIONS.map(o => ({ value: o, label: o })), [],
  );
  const opcionesPresentacionSUP: ChipCerradoOption[] = useMemo(
    () => Object.entries(PRESENTACION_SUP_LABELS).map(([value, label]) => ({ value, label: label as string })), [],
  );
  const opcionesMomentoDia: ChipCerradoOption[] = useMemo(
    () => MOMENTO_DIA_OPTIONS.map(o => ({ value: o, label: o })), [],
  );
  const opcionesTomaConComida: ChipCerradoOption[] = useMemo(
    () => Object.entries(TOMA_CON_COMIDA_LABELS).map(([value, label]) => ({ value, label: label as string })), [],
  );
  const opcionesEdad: ChipCerradoOption[] = useMemo(
    () => Object.entries(EDAD_RECOMENDADA_LABELS).map(([value, label]) => ({ value, label: label as string })), [],
  );

  return (
    <div className="space-y-4">
      <Section titulo="Identidad">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <Field label="Nombre comercial *" className="sm:col-span-2">
            <input
              type="text"
              value={nombreComercial}
              onChange={(e: any) => setNombreComercial(e.target.value)}
              placeholder="ej. Vitamin C Brightening Serum"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </Field>
          <div className="text-xs">
            <MaestroSelect
              label="Marca"
              required
              tipo="marca"
              valueId={marcaId}
              valueSnapshot={marcaId ? { id: marcaId, nombre: marca } : undefined}
              items={(marcasActivas ?? []).map((m: any) => ({
                id: m.id, codigo: m.codigo, nombre: m.nombre, meta1: m.tipoMarca,
              }))}
              onSelect={(item) => { setMarca(item.nombre); setMarcaId(item.id); }}
              onSolicitarCrear={async (q) => {
                if (!user) return;
                try {
                  const id = await createMarca(
                    { nombre: q, tipoMarca: 'otro', lineaNegocioIds: lineaNegocioId ? [lineaNegocioId] : undefined } as any,
                    user.uid,
                  );
                  setMarca(q); setMarcaId(id);
                } catch (err) { console.error('[WizardConVariantes] crear marca', err); }
              }}
              onClear={() => { setMarca(''); setMarcaId(undefined); }}
              helperText="Compartida por todas las variantes · vinculada al Gestor Maestro"
            />
          </div>
          <Field label="Presentación">
            <select
              value={presentacion}
              onChange={(e: any) => setPresentacion(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              {PRESENTACIONES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Línea de negocio *">
            <select
              value={lineaNegocioId}
              onChange={(e: any) => setLineaNegocioId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="">Seleccionar línea</option>
              {lineasNegocio.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.nombre} {l.codigo ? `· ${l.codigo}` : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section titulo="Origen">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <Field label="País origen *">
            <select
              value={paisOrigen}
              onChange={(e: any) => setPaisOrigen(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              {PAISES.map(p => (
                <option key={p.value} value={p.value}>{p.emoji} {p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Costo flete intl. (USD)">
            <input type="number" step="0.01" value={costoFlete}
              onChange={(e: any) => setCostoFlete(e.target.value)} placeholder="0.00"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums" />
          </Field>
          <Field label="Peso unitario (lb)">
            <input type="number" step="0.01" value={pesoLibras}
              onChange={(e: any) => setPesoLibras(e.target.value)} placeholder="0.00"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums" />
          </Field>
        </div>
      </Section>

      {/* Atributos cerrados por línea (Fase E3) ─────────────────────────── */}
      {tieneAtributos && (
        <Section titulo={esSKC ? 'Atributos Skincare (compartidos)' : 'Atributos Suplementos (compartidos)'}>
          {esSKC && (
            <div className="space-y-4 border-l-2 border-amber-300 pl-3 text-xs">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-[11px]">
                <Droplets className="w-3.5 h-3.5" />
                Línea Skincare · todos los hijos del grupo heredan estos atributos
              </div>
              <ChipsCerrados label="Tipo SKC" required modo="single" variante="rect" tema="amber"
                options={opcionesTipoSKC} value={skcTipo}
                onChange={(v: string) => setSkcTipo(v as TipoProductoSKC)} />

              <div className="grid grid-cols-3 gap-3">
                <Field label="Volumen base">
                  <div className="flex items-stretch border border-slate-300 rounded-lg overflow-hidden">
                    <input type="number" value={skcVolumen} onChange={(e: any) => setSkcVolumen(e.target.value)}
                      placeholder="30" className="flex-1 px-2 py-1.5 text-sm tabular-nums border-0 min-w-0" />
                    <select value={skcUnidad} onChange={(e: any) => setSkcUnidad(e.target.value)}
                      className="px-1.5 py-1 text-xs font-bold bg-white border-l border-slate-200">
                      <option value="ml">ml</option><option value="g">g</option>
                      <option value="oz">oz</option><option value="unidades">uds</option>
                    </select>
                  </div>
                </Field>
                <Field label="Ingrediente clave">
                  <input type="text" value={skcIngredienteClave}
                    onChange={(e: any) => setSkcIngredienteClave(e.target.value)} placeholder="ej. Vitamina C 15%"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </Field>
                <Field label="Línea de marca">
                  <input type="text" value={skcLineaProducto}
                    onChange={(e: any) => setSkcLineaProducto(e.target.value)} placeholder="ej. C E Ferulic"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </Field>
              </div>

              <ChipsCerrados label="Tipo de piel" modo="multi" variante="pill" tema="amber"
                options={opcionesTipoPiel} value={skcTipoPiel} onChange={setSkcTipoPiel} />

              <ChipsCerrados label="Preocupaciones que aborda" modo="multi" variante="pill" tema="amber"
                options={opcionesPreocupaciones} value={skcPreocupaciones} onChange={setSkcPreocupaciones} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ChipsCerrados label="Paso de rutina" modo="single" variante="rect" tema="amber"
                  options={opcionesPasoRutina} value={skcPasoRutina}
                  onChange={(v: string) => setSkcPasoRutina(v as PasoRutinaSKC)} />
                <ChipsCerrados label="Textura" modo="single" variante="rect" tema="amber"
                  options={opcionesTextura} value={skcTextura}
                  onChange={(v: string) => setSkcTextura(v as TexturaSKC)} />
              </div>

              <ChipsCerrados label="Zona de aplicación" modo="multi" variante="pill" tema="amber"
                options={opcionesZona} value={skcZona} onChange={setSkcZona} />

              {esProtectorSolar && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2 text-amber-800 font-bold text-[11px]">
                    <Sun className="w-3.5 h-3.5" /> Campos de Protección Solar
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="SPF">
                      <input type="number" value={skcSpf} onChange={(e: any) => setSkcSpf(e.target.value)}
                        placeholder="50" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums" />
                    </Field>
                    <Field label="PA">
                      <input type="text" value={skcPa} onChange={(e: any) => setSkcPa(e.target.value)}
                        placeholder="PA++++" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </Field>
                  </div>
                </div>
              )}
            </div>
          )}

          {esSUP && (
            <div className="space-y-4 border-l-2 border-indigo-300 pl-3 text-xs">
              <div className="flex items-center gap-2 text-indigo-800 font-bold text-[11px]">
                <Pill className="w-3.5 h-3.5" />
                Línea Suplementos · sabor/dosaje varían por variante
              </div>
              <ChipsCerrados label="Presentación" required modo="single" variante="rect" tema="indigo"
                options={opcionesPresentacionSUP} value={supPresentacion}
                onChange={(v: string) => setSupPresentacion(v as PresentacionSUP)} />

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
                  Restricciones / certificaciones
                </label>
                <div className="border border-amber-300 rounded-lg p-2 bg-white">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {supRestricciones.map((r: string) => (
                      <span key={r} className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                        ✓ {r}
                        <button type="button" onClick={() => setSupRestricciones(supRestricciones.filter((x: string) => x !== r))} className="hover:text-amber-900">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-1 items-center">
                  <span className="text-[9px] text-slate-500 italic">Más usadas:</span>
                  {RESTRICCIONES_SUGERIDAS.filter(r => !supRestricciones.includes(r)).slice(0, 7).map(r => (
                    <button key={r} type="button" onClick={() => setSupRestricciones([...supRestricciones, r])}
                      className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] border border-amber-200">
                      + {r}
                    </button>
                  ))}
                </div>
              </div>

              <ChipsCerrados label="Momento del día" modo="multi" variante="pill" tema="indigo"
                options={opcionesMomentoDia} value={supMomentoDia} onChange={setSupMomentoDia} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ChipsCerrados label="Toma con/sin comida" modo="single" variante="pill" tema="indigo"
                  options={opcionesTomaConComida} value={supTomaConComida}
                  onChange={(v: string) => setSupTomaConComida(v as TomaConComida)} />
                <ChipsCerrados label="Edad recomendada" modo="single" variante="pill" tema="indigo"
                  options={opcionesEdad} value={supEdad}
                  onChange={(v: string) => setSupEdad(v as EdadRecomendada)} />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  Advertencias
                </label>
                <textarea rows={2} value={supAdvertencias}
                  onChange={(e: any) => setSupAdvertencias(e.target.value)}
                  placeholder="ej: no en embarazo · contraindicado con anticoagulantes..."
                  className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Clasificación con maestros vinculados (Fase E3) ────────────────── */}
      <Section titulo="Clasificación (compartida)">
        <div className="space-y-4 text-xs">
          <MaestroSelect
            label="Tipo de producto"
            tipo="tipo-producto"
            valueId={tipoProductoId}
            valueSnapshot={tipoProductoId ? { id: tipoProductoId, nombre: tipoProductoNombre } : undefined}
            items={(tiposActivos ?? []).map((t: any) => ({
              id: t.id, codigo: t.codigo, nombre: t.nombre, meta1: t.principioActivo,
            }))}
            onSelect={(item) => { setTipoProductoId(item.id); setTipoProductoNombre(item.nombre); }}
            onSolicitarCrear={async (q) => {
              if (!user) return;
              try {
                const nuevo = await createTipo({ nombre: q, descripcion: '' } as any, user.uid);
                setTipoProductoId(nuevo.id); setTipoProductoNombre(nuevo.nombre);
              } catch (err) { console.error('[WizardConVariantes] crear tipo', err); }
            }}
            onClear={() => { setTipoProductoId(undefined); setTipoProductoNombre(''); }}
            helperText="Compartido · agrupa equivalentes (ej: 'Vitamina D3 + K2')"
          />
          <MaestroChipsMulti
            label="Categorías" permitePrincipal maximo={5} tema="emerald"
            selecciones={categoriasSel}
            items={(categoriasActivas ?? []).map((c: any) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre }))}
            onChange={setCategoriasSel}
            onCrearNuevo={async (n) => {
              if (!user) return null;
              try { const nueva = await createCategoria({ nombre: n } as any, user.uid); return nueva.id; }
              catch (err) { console.error('[WizardConVariantes] crear cat', err); return null; }
            }}
            helperText="Áreas de salud · click para principal"
          />
          <MaestroChipsMulti
            label="Etiquetas" tema="amber"
            selecciones={etiquetasSel}
            items={(etiquetasActivas ?? []).map((e: any) => ({ id: e.id, codigo: e.codigo, nombre: e.nombre }))}
            onChange={setEtiquetasSel}
            onCrearNuevo={async (n) => {
              if (!user) return null;
              try { const nueva = await createEtiqueta({ nombre: n } as any, user.uid); return nueva.id; }
              catch (err) { console.error('[WizardConVariantes] crear etq', err); return null; }
            }}
            helperText="Tags marketing flexibles"
          />
        </div>
      </Section>

      <Section titulo="Inventario base">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Field label="Stock mínimo">
            <input type="number" min="0" value={stockMinimo} onChange={(e: any) => setStockMinimo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums" />
          </Field>
          <Field label="Stock máximo">
            <input type="number" min="1" value={stockMaximo} onChange={(e: any) => setStockMaximo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums" />
          </Field>
        </div>
      </Section>
    </div>
  );
};

const PasoConfig: React.FC<{
  ejeVariacion: EjeVariacion;
  setEjeVariacion: (e: EjeVariacion) => void;
  variantes: VarianteEntry[];
  updateVariante: (idx: number, patch: Partial<VarianteEntry>) => void;
  addVariante: () => void;
  removeVariante: (idx: number) => void;
  nombreBase: string;
}> = ({ ejeVariacion, setEjeVariacion, variantes, updateVariante, addVariante, removeVariante, nombreBase }) => {
  const skuPrefix = nombreBase ? nombreBase.slice(0, 4).toUpperCase().replace(/\s/g, '') : 'XXX';
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-bold mb-2">Eje de variación</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {EJES.map(eje => {
            const active = ejeVariacion === eje.key;
            return (
              <button
                key={eje.key}
                type="button"
                onClick={() => setEjeVariacion(eje.key)}
                className={`px-3 py-2 text-xs font-bold rounded-lg border-2 transition-all ${
                  active
                    ? 'border-sky-400 bg-sky-50 text-sky-700 ring-2 ring-sky-100'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {eje.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-bold mb-2">
          Variantes a crear ({variantes.length})
        </label>
        <div className="space-y-2">
          {variantes.map((v, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <div
                className="w-9 h-9 rounded-full text-white flex items-center justify-center text-xs font-bold tabular-nums flex-shrink-0"
                style={{ background: PALETTE[idx % PALETTE.length] }}
              >
                {v.cantidad || '?'}
              </div>
              <div className="flex-1 grid grid-cols-3 gap-2 min-w-0">
                <input
                  type="text"
                  value={v.cantidad}
                  onChange={e => updateVariante(idx, { cantidad: e.target.value })}
                  placeholder="Cantidad"
                  className="px-2 py-1.5 text-sm border border-slate-200 rounded tabular-nums"
                />
                <input
                  type="text"
                  value={v.unidad}
                  onChange={e => updateVariante(idx, { unidad: e.target.value })}
                  placeholder="Unidad"
                  className="px-2 py-1.5 text-sm border border-slate-200 rounded"
                />
                <input
                  type="text"
                  value={v.etiqueta}
                  onChange={e => updateVariante(idx, { etiqueta: e.target.value })}
                  placeholder="Etiqueta"
                  className="px-2 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>
              <div className="text-[10px] text-slate-500 font-mono whitespace-nowrap hidden md:block">
                SKU-{skuPrefix}-{v.cantidad || 'XX'}
              </div>
              <button
                type="button"
                onClick={() => removeVariante(idx)}
                disabled={variantes.length <= 2}
                className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addVariante}
          className="mt-3 px-3 py-2 text-xs font-bold text-sky-700 border-2 border-dashed border-sky-300 rounded-lg w-full hover:bg-sky-50 flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar otra variante
        </button>
      </div>

      {variantes.length < 2 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
          <strong>Mínimo 2 variantes</strong> · si solo necesitas una presentación, usa "Producto único".
        </div>
      )}
    </div>
  );
};

const PasoStock: React.FC<{
  variantes: VarianteEntry[];
  updateVariante: (idx: number, patch: Partial<VarianteEntry>) => void;
}> = ({ variantes, updateVariante }) => (
  <div className="space-y-3">
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
      Define stock inicial y precio de venta por cada variante. Los campos son opcionales · podés ajustar después
      desde el detalle del producto.
    </div>
    {variantes.map((v, idx) => (
      <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <div
          className="w-9 h-9 rounded-full text-white flex items-center justify-center text-xs font-bold tabular-nums flex-shrink-0"
          style={{ background: PALETTE[idx % PALETTE.length] }}
        >
          {v.cantidad || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{v.varianteLabel || 'Variante sin nombre'}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Field label="Stock" inline>
            <input
              type="number"
              min="0"
              value={v.stockInicial ?? ''}
              onChange={e => updateVariante(idx, { stockInicial: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="0"
              className="w-20 px-2 py-1.5 text-sm border border-slate-200 rounded tabular-nums"
            />
          </Field>
          <Field label="Precio (S/)" inline>
            <input
              type="number"
              step="0.01"
              min="0"
              value={v.precioVenta ?? ''}
              onChange={e => updateVariante(idx, { precioVenta: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="0.00"
              className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded tabular-nums"
            />
          </Field>
        </div>
      </div>
    ))}
  </div>
);

const PasoConfirmar: React.FC<{
  marca: string;
  nombreComercial: string;
  lineaNombre: string;
  variantes: VarianteEntry[];
}> = ({ marca, nombreComercial, lineaNombre, variantes }) => (
  <div className="space-y-4">
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
      </div>
      <div>
        <div className="text-sm font-bold text-emerald-900">Listo para crear · {variantes.length} variantes</div>
        <div className="text-xs text-emerald-800 mt-0.5">
          Revisa los datos · al confirmar se crearán <strong>{variantes.length} SKUs</strong> compartiendo el mismo grupo.
        </div>
      </div>
    </div>

    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Package className="w-3.5 h-3.5 text-slate-500" />
        Producto base
      </h4>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <SummaryItem label="Marca" value={marca} />
        <SummaryItem label="Línea de negocio" value={lineaNombre} />
        <SummaryItem label="Nombre comercial" value={nombreComercial} className="col-span-2" />
      </div>
    </div>

    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Variantes a crear ({variantes.length})</h4>
      </div>
      <div className="divide-y divide-slate-100">
        {variantes.map((v, idx) => (
          <div key={idx} className="px-4 py-2.5 flex items-center gap-3 text-sm">
            <div
              className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold tabular-nums flex-shrink-0"
              style={{ background: PALETTE[idx % PALETTE.length] }}
            >
              {v.cantidad}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900 truncate">{v.varianteLabel}</div>
              <div className="text-[10px] text-slate-500">{v.contenido}</div>
            </div>
            <div className="flex items-center gap-3 text-[11px] flex-shrink-0">
              {v.stockInicial !== undefined && (
                <span className="text-slate-700 tabular-nums">{v.stockInicial} uds</span>
              )}
              {v.precioVenta !== undefined && (
                <span className="text-emerald-700 font-bold tabular-nums">S/ {v.precioVenta.toFixed(2)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const Section: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4">
    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">{titulo}</h4>
    {children}
  </div>
);

const Field: React.FC<{ label: string; className?: string; inline?: boolean; children: React.ReactNode }> = ({
  label,
  className = '',
  inline,
  children,
}) => (
  <div className={className}>
    <label className={`block text-[10px] uppercase tracking-wider text-slate-500 font-bold ${inline ? 'mb-0.5' : 'mb-1'}`}>{label}</label>
    {children}
  </div>
);

const SummaryItem: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className = '' }) => (
  <div className={className}>
    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</div>
    <div className="text-slate-900 font-medium">{value || '—'}</div>
  </div>
);
