/**
 * WizardSimple · Wizard crear PRODUCTO ÚNICO · F5(D) Modal 1 paso
 *
 * Mockup canónico: docs/mockups/productos/17-wizard-crear-simple.html
 *
 * Estructura:
 *   - Modal centrado max-w-3xl con header gradient F6.1
 *   - 4 secciones colapsables (acordeón):
 *     1. Origen · País + método envío + flete + peso
 *     2. Básico · Nombre + marca + presentación + dosaje + contenido + UPC
 *     3. Clasificación · Línea negocio + tipo + categorías + etiquetas (placeholder)
 *     4. Inventario · Stock mínimo + stock máximo
 *   - Solo 1 expandida a la vez (acordeón) · numeración + estado visual
 *   - Footer: cancelar / "Crear producto" disabled si campos requeridos vacíos
 *
 * Output: llama onSubmit(data) con ProductoFormData mínimo · el padre maneja
 *         la persistencia (productoStore.createProducto).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Package, Check, Lightbulb, Droplets, Pill, Sun } from 'lucide-react';
import type {
  ProductoFormData,
  Presentacion,
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
  SABORES_SUGERIDOS,
} from '../../../../types/producto.types';
import { SeccionColapsable } from './SeccionColapsable';
import { DuplicadosBanner, detectarDuplicados, type CandidatoSimilar } from './DuplicadosBanner';
import {
  MaestroSelect,
  MaestroChipsMulti,
  ChipsCerrados,
  type MaestroChipSelection,
  type ChipCerradoOption,
} from '../maestros';
import { useMarcaStore } from '../../../../store/marcaStore';
import { useTipoProductoStore } from '../../../../store/tipoProductoStore';
import { useCategoriaStore } from '../../../../store/categoriaStore';
import { useEtiquetaStore } from '../../../../store/etiquetaStore';
import { useAuthStore } from '../../../../store/authStore';

interface WizardSimpleProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ProductoFormData>) => Promise<void> | void;
  /** Lista de líneas de negocio disponibles (id + nombre + codigo SKC/SUP) */
  lineasNegocio?: Array<{ id: string; nombre: string; codigo?: string }>;
  /** Catálogo completo · usado para detección de duplicados (Fase H · #45) */
  catalogoExistente?: import('../../../../types/producto.types').Producto[];
  /** Callback al click "Es variante de este" · padre redirige al WizardVarianteExistente */
  onConvertirAVariante?: (productoBase: import('../../../../types/producto.types').Producto) => void;
  /** Callback al click "Ver detalle" · padre abre ProductoDetailModal */
  onVerDetalle?: (producto: import('../../../../types/producto.types').Producto) => void;
}

type SeccionKey = 'origen' | 'basico' | 'atributos' | 'clasificacion' | 'inventario';

const PRESENTACIONES: { value: Presentacion; label: string }[] = [
  { value: 'capsulas', label: 'Cápsulas' },
  { value: 'capsulas_blandas', label: 'Cápsulas blandas' },
  { value: 'tabletas', label: 'Tabletas' },
  { value: 'gomitas', label: 'Gomitas' },
  { value: 'polvo', label: 'Polvo' },
  { value: 'liquido', label: 'Líquido' },
];

// GAP-143 fix · paisOrigen ahora se guarda como CODIGO ('USA', 'KOR', etc.)
// para coherencia con productos legacy y filtros · label es solo display
const PAISES = [
  { value: 'USA', label: 'Estados Unidos', emoji: '🇺🇸' },
  { value: 'KOR', label: 'Corea del Sur', emoji: '🇰🇷' },
  { value: 'CHN', label: 'China', emoji: '🇨🇳' },
  { value: 'FRA', label: 'Francia', emoji: '🇫🇷' },
  { value: 'PER', label: 'Perú', emoji: '🇵🇪' },
];

export const WizardSimple: React.FC<WizardSimpleProps> = ({
  open,
  onClose,
  onSubmit,
  lineasNegocio = [],
  catalogoExistente = [],
  onConvertirAVariante,
  onVerDetalle,
}) => {
  const [seccionAbierta, setSeccionAbierta] = useState<SeccionKey>('origen');
  const [submitting, setSubmitting] = useState(false);
  const user = useAuthStore(s => s.user);

  // GAP-040 fix · Stores de maestros
  const { marcasActivas, fetchMarcasActivas, createMarca } = useMarcaStore();
  const { tiposActivos, fetchTiposActivos, create: createTipo } = useTipoProductoStore();
  const { categoriasActivas, fetchCategoriasActivas, create: createCategoria } = useCategoriaStore();
  const { etiquetasActivas, fetchEtiquetasActivas, create: createEtiqueta } = useEtiquetaStore();

  // Cargar maestros al abrir
  useEffect(() => {
    if (!open) return;
    fetchMarcasActivas();
    fetchTiposActivos();
    fetchCategoriasActivas();
    fetchEtiquetasActivas();
  }, [open, fetchMarcasActivas, fetchTiposActivos, fetchCategoriasActivas, fetchEtiquetasActivas]);

  // Estado del form
  const [paisOrigen, setPaisOrigen] = useState('USA');
  const [costoFlete, setCostoFlete] = useState<string>('');
  const [pesoLibras, setPesoLibras] = useState<string>('');

  const [nombreComercial, setNombreComercial] = useState('');
  // GAP-040 · marca ahora vincula al Gestor Maestro
  const [marca, setMarca] = useState('');
  const [marcaId, setMarcaId] = useState<string | undefined>();
  const [presentacion, setPresentacion] = useState<Presentacion>('capsulas');
  const [dosaje, setDosaje] = useState('');
  const [contenido, setContenido] = useState('');
  const [codigoUPC, setCodigoUPC] = useState('');
  const [sabor, setSabor] = useState('');

  const [lineaNegocioId, setLineaNegocioId] = useState('');
  // GAP-040 · vínculos a maestros (Clasificación)
  const [tipoProductoId, setTipoProductoId] = useState<string | undefined>();
  const [tipoProductoNombre, setTipoProductoNombre] = useState<string>('');
  const [categoriasSel, setCategoriasSel] = useState<MaestroChipSelection[]>([]);
  const [etiquetasSel, setEtiquetasSel] = useState<MaestroChipSelection[]>([]);

  // ─── Fase E2 · Atributos cerrados SKC ───────────────────────────────────────
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

  // ─── Fase E2 · Atributos cerrados SUP ───────────────────────────────────────
  const [supPresentacion, setSupPresentacion] = useState<PresentacionSUP | ''>('');
  const [supServingsDia, setSupServingsDia] = useState<string>('1');
  const [supSabor, setSupSabor] = useState<string>('');
  const [supRestricciones, setSupRestricciones] = useState<string[]>([]);
  const [supMomentoDia, setSupMomentoDia] = useState<string[]>([]);
  const [supTomaConComida, setSupTomaConComida] = useState<TomaConComida | ''>('');
  const [supEdad, setSupEdad] = useState<EdadRecomendada | ''>('');
  const [supAdvertencias, setSupAdvertencias] = useState<string>('');

  const [stockMinimo, setStockMinimo] = useState<string>('5');
  const [stockMaximo, setStockMaximo] = useState<string>('100');

  // ─── Detección de línea SKC/SUP ─────────────────────────────────────────────
  const lineaCodigo = useMemo(() => {
    if (!lineaNegocioId) return '';
    const linea = lineasNegocio.find(l => l.id === lineaNegocioId);
    return (linea?.codigo ?? '').toUpperCase();
  }, [lineaNegocioId, lineasNegocio]);

  const esSKC = lineaCodigo === 'SKC';
  const esSUP = lineaCodigo === 'SUP';
  const tieneAtributos = esSKC || esSUP;

  // ─── Opciones para ChipsCerrados (memorizadas) ──────────────────────────────
  const opcionesTipoSKC: ChipCerradoOption[] = useMemo(
    () => Object.entries(TIPO_PRODUCTO_SKC_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );
  const opcionesTipoPiel: ChipCerradoOption[] = useMemo(
    () => TIPO_PIEL_OPTIONS.map(o => ({
      value: o,
      label: o,
      destacado: o === 'Todo tipo',
    })),
    [],
  );
  const opcionesPreocupaciones: ChipCerradoOption[] = useMemo(
    () => PREOCUPACIONES_OPTIONS.map(o => ({ value: o, label: o })),
    [],
  );
  const opcionesPasoRutina: ChipCerradoOption[] = useMemo(
    () => Object.entries(PASO_RUTINA_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );
  const opcionesTextura: ChipCerradoOption[] = useMemo(
    () => Object.entries(TEXTURA_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );
  const opcionesZona: ChipCerradoOption[] = useMemo(
    () => ZONA_APLICACION_OPTIONS.map(o => ({ value: o, label: o })),
    [],
  );
  const opcionesPresentacionSUP: ChipCerradoOption[] = useMemo(
    () => Object.entries(PRESENTACION_SUP_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );
  const opcionesMomentoDia: ChipCerradoOption[] = useMemo(
    () => MOMENTO_DIA_OPTIONS.map(o => ({ value: o, label: o })),
    [],
  );
  const opcionesTomaConComida: ChipCerradoOption[] = useMemo(
    () => Object.entries(TOMA_CON_COMIDA_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );
  const opcionesEdad: ChipCerradoOption[] = useMemo(
    () => Object.entries(EDAD_RECOMENDADA_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );

  // Es protector solar · activa SPF/PA
  const esProtectorSolar = skcTipo === 'protector_solar';

  // ─── Fase H · Detección de duplicados con debounce 500ms ──────────────────
  const [duplicadosCandidatos, setDuplicadosCandidatos] = useState<CandidatoSimilar[]>([]);
  useEffect(() => {
    if (!open || nombreComercial.trim().length < 4 || catalogoExistente.length === 0) {
      setDuplicadosCandidatos([]);
      return;
    }
    const timer = setTimeout(() => {
      const candidatos = detectarDuplicados(
        {
          nombre: nombreComercial,
          marca,
          presentacion,
          dosaje,
        },
        catalogoExistente,
      );
      setDuplicadosCandidatos(candidatos);
    }, 500);
    return () => clearTimeout(timer);
  }, [nombreComercial, marca, presentacion, dosaje, catalogoExistente, open]);

  // Cálculo de ciclo recompra automático para SUP
  const cicloRecompraDias = useMemo(() => {
    const servings = parseInt(supServingsDia);
    if (!servings || servings <= 0) return 0;
    // Extrae el primer número del campo "contenido" (ej: "60 cápsulas" → 60)
    const match = contenido.match(/(\d+)/);
    if (!match) return 0;
    return Math.floor(parseInt(match[1]) / servings);
  }, [contenido, supServingsDia]);

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setSeccionAbierta('origen');
      setSubmitting(false);
      // Reset maestros para evitar arrastre entre productos
      setMarca('');
      setMarcaId(undefined);
      setTipoProductoId(undefined);
      setTipoProductoNombre('');
      setCategoriasSel([]);
      setEtiquetasSel([]);
      // Reset atributos SKC
      setSkcTipo('');
      setSkcVolumen('');
      setSkcUnidad('ml');
      setSkcIngredienteClave('');
      setSkcLineaProducto('');
      setSkcTipoPiel([]);
      setSkcPreocupaciones([]);
      setSkcPasoRutina('');
      setSkcTextura('');
      setSkcZona([]);
      setSkcSpf('');
      setSkcPa('');
      // Reset atributos SUP
      setSupPresentacion('');
      setSupServingsDia('1');
      setSupSabor('');
      setSupRestricciones([]);
      setSupMomentoDia([]);
      setSupTomaConComida('');
      setSupEdad('');
      setSupAdvertencias('');
    }
  }, [open]);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Validación de cada sección
  const seccionesEstado = useMemo(() => ({
    origen: paisOrigen.length > 0,
    basico: nombreComercial.trim().length > 0 && marca.trim().length > 0,
    atributos: esSKC
      ? Boolean(skcTipo) && skcVolumen.trim().length > 0
      : esSUP
        ? Boolean(supPresentacion)
        : true, // sin línea SKC/SUP · opcional
    clasificacion: true, // opcional
    inventario: parseInt(stockMinimo) >= 0 && parseInt(stockMaximo) > 0,
  }), [paisOrigen, nombreComercial, marca, stockMinimo, stockMaximo, esSKC, esSUP, skcTipo, skcVolumen, supPresentacion]);

  const camposRequeridosOK =
    seccionesEstado.basico &&
    seccionesEstado.origen &&
    seccionesEstado.inventario &&
    (!tieneAtributos || seccionesEstado.atributos);

  const toggleSeccion = (s: SeccionKey) => {
    setSeccionAbierta(prev => (prev === s ? prev : s));
  };

  const handleSubmit = async () => {
    if (!camposRequeridosOK || submitting) return;
    setSubmitting(true);
    try {
      // GAP-040 · vínculos a maestros incluidos
      const categoriaPrincipal = categoriasSel.find(c => c.esPrincipal);

      // Fase E2 · si línea SUP, la presentación canónica viene de los chips cerrados
      const presentacionFinal: Presentacion = (esSUP && supPresentacion)
        ? (mapPresentacionSUPaLegacy(supPresentacion) ?? presentacion)
        : presentacion;

      // Fase E2 · sabor: en SUP viene de su chip-creable propio
      const saborFinal = (esSUP ? supSabor : sabor).trim() || undefined;

      // Fase E2 · construir atributos según línea
      const atributosSkincare = esSKC && skcTipo ? {
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

      const atributosSuplementos = esSUP && supPresentacion ? {
        presentacion: supPresentacion,
        momentoDia: supMomentoDia.length ? supMomentoDia : undefined,
        tomaConComida: supTomaConComida || undefined,
        edadRecomendada: supEdad || undefined,
        restricciones: supRestricciones.length ? supRestricciones : undefined,
        sabor: supSabor.trim() || undefined,
        advertencias: supAdvertencias.trim() || undefined,
      } : undefined;

      const data: Partial<ProductoFormData> = {
        marca: marca.trim(),
        marcaId,
        nombreComercial: nombreComercial.trim(),
        presentacion: presentacionFinal,
        dosaje: dosaje.trim(),
        contenido: contenido.trim(),
        sabor: saborFinal,
        codigoUPC: codigoUPC.trim(),
        // Legacy compat (deprecated pero requeridos por el shape)
        grupo: '',
        subgrupo: '',
        // Origen
        paisOrigen,
        costoFleteInternacional: costoFlete ? parseFloat(costoFlete) : undefined,
        pesoLibras: pesoLibras ? parseFloat(pesoLibras) : undefined,
        // Clasificación con maestros
        lineaNegocioId: lineaNegocioId || undefined,
        tipoProductoId,
        categoriaIds: categoriasSel.map(c => c.id),
        categoriaPrincipalId: categoriaPrincipal?.id,
        etiquetaIds: etiquetasSel.map(e => e.id),
        // Atributos por línea (Fase E2)
        atributosSkincare,
        atributosSuplementos,
        // Ciclo recompra (auto-calculado para SUP)
        servingsPerDay: esSUP && parseInt(supServingsDia) > 0 ? parseInt(supServingsDia) : undefined,
        cicloRecompraDias: esSUP && cicloRecompraDias > 0 ? cicloRecompraDias : undefined,
        // Stock
        stockMinimo: parseInt(stockMinimo) || 0,
        stockMaximo: parseInt(stockMaximo) || 100,
      };
      await onSubmit(data);
      // El parent cierra el modal después de éxito
    } catch (err) {
      console.error('[WizardSimple] error en submit', err);
      setSubmitting(false);
    }
  };

  /** Mapea PresentacionSUP a Presentacion legacy para mantener compat
   *  Si la presentación SUP no existe en legacy, devuelve undefined y el caller
   *  decide qué hacer (típicamente: usar el valor del select de Básico). */
  function mapPresentacionSUPaLegacy(sup: PresentacionSUP): Presentacion | undefined {
    const map: Partial<Record<PresentacionSUP, Presentacion>> = {
      capsulas: 'capsulas',
      capsulas_blandas: 'capsulas_blandas',
      tabletas: 'tabletas',
      gomitas: 'gomitas',
      polvo: 'polvo',
      liquido: 'liquido',
      // Las nuevas (sublingual, spray_oral, etc.) no tienen equivalente legacy
    };
    return map[sup];
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        aria-label="Cerrar wizard"
      />

      <div className="relative w-full lg:w-auto lg:max-w-3xl lg:mx-auto bg-white lg:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Drag handle mobile */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-4 lg:px-6 py-3 lg:py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 lg:gap-3 min-w-0">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 lg:w-5 lg:h-5 text-teal-700" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base lg:text-lg font-bold text-slate-900">Crear producto único</h2>
                <p className="text-[11px] lg:text-xs text-slate-500 mt-0.5">Sin variantes · 1 SKU único en el catálogo</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 flex-shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body · 4 secciones acordeón */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-5 space-y-3">
          {/* Sección 1 · Origen */}
          <SeccionColapsable
            numero={1}
            titulo="Origen"
            subtitulo="País + método de envío"
            expanded={seccionAbierta === 'origen'}
            onToggle={() => toggleSeccion('origen')}
            estado={seccionAbierta === 'origen' ? 'active' : seccionesEstado.origen ? 'complete' : 'inactive'}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Field label="País origen *" required>
                <select
                  value={paisOrigen}
                  onChange={e => setPaisOrigen(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  {PAISES.map(p => (
                    <option key={p.value} value={p.value}>
                      {p.emoji} {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Costo flete intl. (USD)">
                <input
                  type="number"
                  step="0.01"
                  value={costoFlete}
                  onChange={e => setCostoFlete(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                />
              </Field>
              <Field label="Peso unitario (lb)">
                <input
                  type="number"
                  step="0.01"
                  value={pesoLibras}
                  onChange={e => setPesoLibras(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                />
              </Field>
            </div>
          </SeccionColapsable>

          {/* Sección 2 · Básico */}
          <SeccionColapsable
            numero={2}
            titulo="Básico"
            subtitulo="Nombre, marca, presentación"
            expanded={seccionAbierta === 'basico'}
            onToggle={() => toggleSeccion('basico')}
            estado={seccionAbierta === 'basico' ? 'active' : seccionesEstado.basico ? 'complete' : 'inactive'}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Field label="Nombre comercial *" required className="sm:col-span-2">
                <input
                  type="text"
                  value={nombreComercial}
                  onChange={e => setNombreComercial(e.target.value)}
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
                  items={marcasActivas.map(m => ({
                    id: m.id,
                    codigo: m.codigo,
                    nombre: m.nombre,
                    meta1: (m as any).tipoMarca,
                  }))}
                  onSelect={(item) => {
                    setMarca(item.nombre);
                    setMarcaId(item.id);
                  }}
                  onSolicitarCrear={async (queryActual) => {
                    if (!user) return;
                    try {
                      const id = await createMarca(
                        {
                          nombre: queryActual,
                          tipoMarca: 'otro',
                          lineaNegocioIds: lineaNegocioId ? [lineaNegocioId] : undefined,
                        } as any,
                        user.uid,
                      );
                      setMarca(queryActual);
                      setMarcaId(id);
                    } catch (err) {
                      console.error('[WizardSimple] error al crear marca', err);
                    }
                  }}
                  onClear={() => {
                    setMarca('');
                    setMarcaId(undefined);
                  }}
                  helperText="Vinculado al Gestor Maestro · podés crear nuevas inline"
                />
              </div>
              <Field label="Presentación *" required>
                <select
                  value={presentacion}
                  onChange={e => setPresentacion(e.target.value as Presentacion)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  {PRESENTACIONES.map(p => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Dosaje">
                <input
                  type="text"
                  value={dosaje}
                  onChange={e => setDosaje(e.target.value)}
                  placeholder="ej. 1000mg"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Contenido">
                <input
                  type="text"
                  value={contenido}
                  onChange={e => setContenido(e.target.value)}
                  placeholder="ej. 60 cápsulas / 30 ml"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Sabor (opcional)">
                <input
                  type="text"
                  value={sabor}
                  onChange={e => setSabor(e.target.value)}
                  placeholder="ej. Limón"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Código UPC (opcional)">
                <input
                  type="text"
                  value={codigoUPC}
                  onChange={e => setCodigoUPC(e.target.value)}
                  placeholder="ej. 7501234567890"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                />
              </Field>
            </div>
          </SeccionColapsable>

          {/* Sección 3 · Atributos por línea (Fase E2) ─────────────────────── */}
          <SeccionColapsable
            numero={3}
            titulo={esSKC ? 'Atributos Skincare' : esSUP ? 'Atributos Suplementos' : 'Atributos por línea'}
            subtitulo={
              esSKC ? 'Vocabulario CERRADO de la industria SKC moderna'
                : esSUP ? 'Vocabulario CERRADO · 8 atributos de toma + perfil'
                : 'Selecciona primero una línea (SKC o SUP) para ver atributos cerrados'
            }
            expanded={seccionAbierta === 'atributos'}
            onToggle={() => toggleSeccion('atributos')}
            estado={
              seccionAbierta === 'atributos'
                ? 'active'
                : tieneAtributos && seccionesEstado.atributos
                  ? 'complete'
                  : 'inactive'
            }
          >
            <div className="space-y-4 text-xs">
              {/* Línea de negocio · entrada del flujo (define qué chips aparecen) */}
              <Field label="Línea de negocio (define los atributos disponibles)">
                <select
                  value={lineaNegocioId}
                  onChange={e => setLineaNegocioId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Sin línea (sin atributos cerrados)</option>
                  {lineasNegocio.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.nombre} {l.codigo ? `· ${l.codigo}` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              {/* ═══════ SKC ═══════ */}
              {esSKC && (
                <div className="space-y-4 border-l-2 border-amber-300 pl-3">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-[11px]">
                    <Droplets className="w-3.5 h-3.5" />
                    Línea Skincare detectada · 6 atributos cerrados disponibles
                  </div>

                  {/* Tipo SKC · single rect */}
                  <ChipsCerrados
                    label="Tipo SKC"
                    required
                    modo="single"
                    variante="rect"
                    tema="amber"
                    options={opcionesTipoSKC}
                    value={skcTipo}
                    onChange={(v) => setSkcTipo(v as TipoProductoSKC)}
                  />

                  {/* Volumen + Ingrediente clave + Línea de marca */}
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Volumen *" required>
                      <div className="flex items-stretch border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-amber-400">
                        <input
                          type="number"
                          value={skcVolumen}
                          onChange={e => setSkcVolumen(e.target.value)}
                          placeholder="30"
                          className="flex-1 px-2 py-1.5 text-sm tabular-nums focus:outline-none border-0 min-w-0"
                        />
                        <select
                          value={skcUnidad}
                          onChange={e => setSkcUnidad(e.target.value as any)}
                          className="px-1.5 py-1 text-xs font-bold bg-white border-l border-slate-200 focus:outline-none"
                        >
                          <option value="ml">ml</option>
                          <option value="g">g</option>
                          <option value="oz">oz</option>
                          <option value="unidades">uds</option>
                        </select>
                      </div>
                    </Field>
                    <Field label="Ingrediente clave">
                      <input
                        type="text"
                        value={skcIngredienteClave}
                        onChange={e => setSkcIngredienteClave(e.target.value)}
                        placeholder="ej. Vitamina C 15%"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </Field>
                    <Field label="Línea de marca">
                      <input
                        type="text"
                        value={skcLineaProducto}
                        onChange={e => setSkcLineaProducto(e.target.value)}
                        placeholder="ej. C E Ferulic"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </Field>
                  </div>

                  {/* Tipo de piel · multi pill */}
                  <ChipsCerrados
                    label="Tipo de piel"
                    modo="multi"
                    variante="pill"
                    tema="amber"
                    options={opcionesTipoPiel}
                    value={skcTipoPiel}
                    onChange={setSkcTipoPiel}
                  />

                  {/* Preocupaciones · multi pill */}
                  <ChipsCerrados
                    label="Preocupaciones que aborda"
                    modo="multi"
                    variante="pill"
                    tema="amber"
                    options={opcionesPreocupaciones}
                    value={skcPreocupaciones}
                    onChange={setSkcPreocupaciones}
                    helperText="Beneficios principales · sirve para matchear con preocupaciones del cliente"
                  />

                  {/* Paso rutina + Textura · grid 2 cols */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ChipsCerrados
                      label="Paso de rutina"
                      modo="single"
                      variante="rect"
                      tema="amber"
                      options={opcionesPasoRutina}
                      value={skcPasoRutina}
                      onChange={(v) => setSkcPasoRutina(v as PasoRutinaSKC)}
                      helperText="Sin orden numérico · etapa flexible"
                    />
                    <ChipsCerrados
                      label="Textura"
                      modo="single"
                      variante="rect"
                      tema="amber"
                      options={opcionesTextura}
                      value={skcTextura}
                      onChange={(v) => setSkcTextura(v as TexturaSKC)}
                    />
                  </div>

                  {/* Zona aplicación · multi pill */}
                  <ChipsCerrados
                    label="Zona de aplicación"
                    modo="multi"
                    variante="pill"
                    tema="amber"
                    options={opcionesZona}
                    value={skcZona}
                    onChange={setSkcZona}
                  />

                  {/* SPF + PA · solo si Tipo = Protector Solar */}
                  {esProtectorSolar && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2 text-amber-800 font-bold text-[11px]">
                        <Sun className="w-3.5 h-3.5" />
                        Campos de Protección Solar
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="SPF">
                          <input
                            type="number"
                            value={skcSpf}
                            onChange={e => setSkcSpf(e.target.value)}
                            placeholder="50"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                          />
                        </Field>
                        <Field label="PA">
                          <input
                            type="text"
                            value={skcPa}
                            onChange={e => setSkcPa(e.target.value)}
                            placeholder="PA++++"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                          />
                        </Field>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════ SUP ═══════ */}
              {esSUP && (
                <div className="space-y-4 border-l-2 border-indigo-300 pl-3">
                  <div className="flex items-center gap-2 text-indigo-800 font-bold text-[11px]">
                    <Pill className="w-3.5 h-3.5" />
                    Línea Suplementos detectada · 8 atributos cerrados disponibles
                  </div>

                  {/* Presentación SUP · single rect */}
                  <ChipsCerrados
                    label="Presentación"
                    required
                    modo="single"
                    variante="rect"
                    tema="indigo"
                    options={opcionesPresentacionSUP}
                    value={supPresentacion}
                    onChange={(v) => setSupPresentacion(v as PresentacionSUP)}
                  />

                  {/* Servings/día + Ciclo recompra calculado */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Servings/día">
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          value={supServingsDia}
                          onChange={e => setSupServingsDia(e.target.value)}
                          className="w-full pl-3 pr-12 py-2 border border-slate-300 rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">/día</span>
                      </div>
                    </Field>
                    {cicloRecompraDias > 0 && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center gap-2">
                        <span className="text-[11px] text-emerald-900">
                          <strong>Ciclo recompra:</strong> {cicloRecompraDias} días
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Sabor · texto rápido + sugerencias */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                      Sabor
                    </label>
                    <input
                      type="text"
                      value={supSabor}
                      onChange={e => setSupSabor(e.target.value)}
                      placeholder="ej. Limón · sin sabor"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <div className="mt-1 flex flex-wrap gap-1 items-center">
                      <span className="text-[9px] text-slate-500 italic">Más usados:</span>
                      {SABORES_SUGERIDOS.slice(0, 5).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSupSabor(s)}
                          className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] border border-amber-200"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Restricciones · chips creables (textbox simple) */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
                      Restricciones / certificaciones
                    </label>
                    <div className="border border-amber-300 rounded-lg p-2 bg-white">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {supRestricciones.map(r => (
                          <span
                            key={r}
                            className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1"
                          >
                            ✓ {r}
                            <button
                              type="button"
                              onClick={() => setSupRestricciones(supRestricciones.filter(x => x !== r))}
                              className="hover:text-amber-900"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 items-center">
                      <span className="text-[9px] text-slate-500 italic">Más usadas:</span>
                      {RESTRICCIONES_SUGERIDAS.filter(r => !supRestricciones.includes(r)).slice(0, 7).map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setSupRestricciones([...supRestricciones, r])}
                          className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] border border-amber-200"
                        >
                          + {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Momento del día · multi pill */}
                  <ChipsCerrados
                    label="Momento del día"
                    modo="multi"
                    variante="pill"
                    tema="indigo"
                    options={opcionesMomentoDia}
                    value={supMomentoDia}
                    onChange={setSupMomentoDia}
                    helperText="ej: Mañana + Noche · multi-select"
                  />

                  {/* Toma con/sin comida + Edad · grid 2 cols */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ChipsCerrados
                      label="Toma con/sin comida"
                      modo="single"
                      variante="pill"
                      tema="indigo"
                      options={opcionesTomaConComida}
                      value={supTomaConComida}
                      onChange={(v) => setSupTomaConComida(v as TomaConComida)}
                    />
                    <ChipsCerrados
                      label="Edad recomendada"
                      modo="single"
                      variante="pill"
                      tema="indigo"
                      options={opcionesEdad}
                      value={supEdad}
                      onChange={(v) => setSupEdad(v as EdadRecomendada)}
                    />
                  </div>

                  {/* Advertencias · textarea + sugerencias */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                      Advertencias
                    </label>
                    <textarea
                      rows={2}
                      value={supAdvertencias}
                      onChange={e => setSupAdvertencias(e.target.value)}
                      placeholder="ej: no recomendado en embarazo · contraindicado con anticoagulantes..."
                      className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    />
                    <div className="mt-1 flex flex-wrap gap-1 items-center">
                      <span className="text-[9px] text-slate-500 italic">Sugerencias:</span>
                      {[
                        'no en embarazo',
                        'no en lactancia',
                        'puede causar somnolencia',
                        'consultar con médico',
                      ].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSupAdvertencias(prev => prev ? `${prev} · ${s}` : s)}
                          className="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] border border-rose-200"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                    <div className="text-[9px] text-slate-500 mt-1 italic">
                      Aparece en la card del producto · investigación · etiqueta de salida
                    </div>
                  </div>
                </div>
              )}

              {/* Sin línea SKC/SUP · informativo */}
              {!tieneAtributos && lineaNegocioId && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 italic">
                  Esta línea de negocio no tiene atributos cerrados configurados. Sigue al siguiente paso para clasificar.
                </div>
              )}

              {!lineaNegocioId && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800 flex items-start gap-2">
                  <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Sin línea seleccionada.</strong> Si tu producto es Skincare o Suplemento, elegí la línea
                    arriba para desbloquear los atributos cerrados específicos (Tipo SKC, Tipo de piel, Presentación SUP, etc.).
                  </div>
                </div>
              )}
            </div>
          </SeccionColapsable>

          {/* Sección 4 · Clasificación */}
          <SeccionColapsable
            numero={4}
            titulo="Clasificación"
            subtitulo="Tipo + Categorías + Etiquetas · maestros vinculados"
            expanded={seccionAbierta === 'clasificacion'}
            onToggle={() => toggleSeccion('clasificacion')}
            estado={seccionAbierta === 'clasificacion' ? 'active' : 'inactive'}
          >
            <div className="space-y-4 text-xs">
              {/* GAP-040 · Tipo de producto · MaestroSelect */}
              <MaestroSelect
                label="Tipo de producto"
                tipo="tipo-producto"
                valueId={tipoProductoId}
                valueSnapshot={tipoProductoId ? { id: tipoProductoId, nombre: tipoProductoNombre } : undefined}
                items={tiposActivos.map(t => ({
                  id: t.id,
                  codigo: (t as any).codigo,
                  nombre: t.nombre,
                  meta1: (t as any).principioActivo,
                }))}
                onSelect={(item) => {
                  setTipoProductoId(item.id);
                  setTipoProductoNombre(item.nombre);
                }}
                onSolicitarCrear={async (queryActual) => {
                  if (!user) return;
                  try {
                    const nuevo = await createTipo(
                      {
                        nombre: queryActual,
                        descripcion: '',
                      } as any,
                      user.uid,
                    );
                    setTipoProductoId(nuevo.id);
                    setTipoProductoNombre(nuevo.nombre);
                  } catch (err) {
                    console.error('[WizardSimple] error al crear tipo', err);
                  }
                }}
                onClear={() => {
                  setTipoProductoId(undefined);
                  setTipoProductoNombre('');
                }}
                helperText="Agrupa productos equivalentes de distintas marcas (ej: 'Vitamina D3 + K2')"
              />

              {/* GAP-040 · Categorías · MaestroChipsMulti */}
              <MaestroChipsMulti
                label="Categorías"
                permitePrincipal
                maximo={5}
                tema="emerald"
                selecciones={categoriasSel}
                items={categoriasActivas.map(c => ({
                  id: c.id,
                  codigo: (c as any).codigo,
                  nombre: c.nombre,
                }))}
                onChange={setCategoriasSel}
                onCrearNuevo={async (nombre) => {
                  if (!user) return null;
                  try {
                    const nueva = await createCategoria(
                      {
                        nombre,
                      } as any,
                      user.uid,
                    );
                    return nueva.id;
                  } catch (err) {
                    console.error('[WizardSimple] error al crear categoría', err);
                    return null;
                  }
                }}
                helperText="Áreas de salud · max 5 · click en chip para hacerla principal"
              />

              {/* GAP-040 · Etiquetas · MaestroChipsMulti tema amber */}
              <MaestroChipsMulti
                label="Etiquetas"
                tema="amber"
                selecciones={etiquetasSel}
                items={etiquetasActivas.map(e => ({
                  id: e.id,
                  codigo: (e as any).codigo,
                  nombre: e.nombre,
                }))}
                onChange={setEtiquetasSel}
                onCrearNuevo={async (nombre) => {
                  if (!user) return null;
                  try {
                    const nueva = await createEtiqueta(
                      {
                        nombre,
                      } as any,
                      user.uid,
                    );
                    return nueva.id;
                  } catch (err) {
                    console.error('[WizardSimple] error al crear etiqueta', err);
                    return null;
                  }
                }}
                helperText="Tags marketing flexibles · ej: vegano, sin-gluten, best-seller"
              />
            </div>
          </SeccionColapsable>

          {/* Sección 5 · Inventario */}
          <SeccionColapsable
            numero={5}
            titulo="Inventario"
            subtitulo="Stock mínimo + máximo"
            expanded={seccionAbierta === 'inventario'}
            onToggle={() => toggleSeccion('inventario')}
            estado={seccionAbierta === 'inventario' ? 'active' : seccionesEstado.inventario ? 'complete' : 'inactive'}
          >
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Stock mínimo *" required>
                <input
                  type="number"
                  min="0"
                  value={stockMinimo}
                  onChange={e => setStockMinimo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                />
              </Field>
              <Field label="Stock máximo *" required>
                <input
                  type="number"
                  min="1"
                  value={stockMaximo}
                  onChange={e => setStockMaximo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                />
              </Field>
            </div>
            <div className="text-[11px] text-slate-500 italic mt-2">
              El stock mínimo dispara la alerta "Stock crítico" en el listado.
            </div>
          </SeccionColapsable>

          {/* Fase H · Banner duplicados (mockup #45) · detección automática debounced */}
          <DuplicadosBanner
            candidatos={duplicadosCandidatos}
            onConvertirAVariante={onConvertirAVariante}
            onVerDetalle={onVerDetalle}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-2.5 lg:py-3 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500">
            {camposRequeridosOK ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span>Listo para crear</span>
              </>
            ) : (
              <span>Completa los campos marcados con *</span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!camposRequeridosOK || submitting}
              className="px-4 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              {submitting ? 'Creando...' : 'Crear producto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Field helper ────────────────────────────────────────────────────────────

const Field: React.FC<{ label: string; required?: boolean; className?: string; children: React.ReactNode }> = ({
  label,
  required,
  className = '',
  children,
}) => (
  <div className={className}>
    <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
      {label}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);
