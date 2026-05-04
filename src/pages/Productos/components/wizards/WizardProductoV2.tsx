/**
 * WizardProductoV2 · S3.2 · DEUDA-IA-001 · 2026-05-03
 *
 * Wizard crear PRODUCTO ÚNICO con la nueva estructura canónica de 6 secciones
 * aprobada en S3.2 (mockup #17 v3 + #40 v3).
 *
 * Estructura · 6 secciones acordeón · una expandida a la vez:
 *   1. Identidad        · Línea + País + Marca + Nombre comercial
 *   2. Atributos        · 8 SKC o 8 SUP (componente compartido)
 *   3. Identificadores  · UPC + Contenido neto cross-línea
 *   4. Clasificación    · Tipo + Categorías + Etiquetas (maestros)
 *   5. Logística        · Peso unitario (lb)
 *   6. Marketing IA     · 3 niveles (tagline + beneficios + descripción) · al final
 *
 * Eliminados respecto al wizard legacy:
 *   - Costo flete intl. (vive en envíos/OC)
 *   - Stock min/max (vive en módulo Stock)
 *   - Sabor/Presentación/Dosaje top-level (movidos a atributos por línea)
 *   - Volumen (atributo SKC) (unificado con Contenido neto)
 *
 * Marketing IA es OPCIONAL para crear: el usuario puede crear el producto
 * sin generar marketing y editarlo después en el editor para generarlo.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Package, Check, Droplets, Pill, Sparkles, Truck } from 'lucide-react';
import type {
  ProductoFormData,
  Presentacion,
  TipoProductoSKC,
  PasoRutinaSKC,
  TexturaSKC,
  PresentacionSUP,
  TomaConComida,
  EdadRecomendada,
  DescripcionMarketing,
  UnidadContenido,
  Producto,
} from '../../../../types/producto.types';
import {
  UNIDADES_SUP,
  UNIDADES_SKC,
  UNIDADES_APPAREL,
  UNIDADES_ALIMENTOS,
  UNIDAD_CONTENIDO_LABELS,
} from '../../../../types/producto.types';
import { SeccionColapsable } from './SeccionColapsable';
import {
  AtributosPorLineaSection,
  type AtributosLineaSKCValue,
  type AtributosLineaSUPValue,
} from '../sections/AtributosPorLineaSection';
import {
  MarketingComercialSection,
  type PrerequisitoChecklist,
} from '../sections/MarketingComercialSection';
import { ChipDuracionEnvase } from '../sections/ChipDuracionEnvase';
import { generarDescripcionMarketing } from '../../../../services/productoMarketingIA.service';
import {
  MaestroSelect,
  MaestroChipsMulti,
  type MaestroChipSelection,
} from '../maestros';
import { useMarcaStore } from '../../../../store/marcaStore';
import { useTipoProductoStore } from '../../../../store/tipoProductoStore';
import { useCategoriaStore } from '../../../../store/categoriaStore';
import { useEtiquetaStore } from '../../../../store/etiquetaStore';
import { useAuthStore } from '../../../../store/authStore';

interface WizardProductoV2Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ProductoFormData>) => Promise<void> | void;
  /** Líneas de negocio disponibles (id + nombre + codigo SKC/SUP/etc.) */
  lineasNegocio?: Array<{ id: string; nombre: string; codigo?: string }>;
  /** Opcional · catálogo existente para futuras detecciones (no usado en MVP) */
  catalogoExistente?: Producto[];
}

type SeccionKey = 'identidad' | 'atributos' | 'identificadores' | 'clasificacion' | 'logistica' | 'marketing';

const PAISES = [
  { value: 'USA', label: 'Estados Unidos', emoji: '🇺🇸' },
  { value: 'KOR', label: 'Corea del Sur', emoji: '🇰🇷' },
  { value: 'CHN', label: 'China', emoji: '🇨🇳' },
  { value: 'FRA', label: 'Francia', emoji: '🇫🇷' },
  { value: 'PER', label: 'Perú', emoji: '🇵🇪' },
];

/**
 * S3.4 (2026-05-04) · Unidades de contenido neto por línea de negocio.
 * Cada línea expone solo las unidades válidas para sus productos.
 * Si no se reconoce la línea, se muestra el universo completo como fallback.
 */
function getUnidadesPorLinea(lineaCodigo: string | undefined): UnidadContenido[] {
  switch (lineaCodigo) {
    case 'SUP':     return [...UNIDADES_SUP];
    case 'SKC':     return [...UNIDADES_SKC];
    case 'APPAREL': return [...UNIDADES_APPAREL];
    case 'ALIM':    return [...UNIDADES_ALIMENTOS];
    default: return [
      'ml','g','oz','fl_oz','kg','lb',
      'capsulas','tabletas','gomitas','sobres','sticks','scoops',
      'unidades','pares',
    ];
  }
}

/**
 * S3.4 · Unidad por defecto al elegir línea de negocio.
 * SKC → ml (cosmética líquida típica)
 * SUP → cápsulas (formato más común de suplementos)
 */
function getUnidadDefault(lineaCodigo: string | undefined): UnidadContenido {
  switch (lineaCodigo) {
    case 'SUP':     return 'capsulas';
    case 'SKC':     return 'ml';
    case 'APPAREL': return 'unidades';
    case 'ALIM':    return 'g';
    default: return 'ml';
  }
}

export const WizardProductoV2: React.FC<WizardProductoV2Props> = ({
  open,
  onClose,
  onSubmit,
  lineasNegocio = [],
}) => {
  const user = useAuthStore(s => s.user);
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

  const [seccionAbierta, setSeccionAbierta] = useState<SeccionKey>('identidad');
  const [submitting, setSubmitting] = useState(false);

  // ─── Estado · Sec.1 Identidad ─────────────────────────────────────────────
  const [lineaNegocioId, setLineaNegocioId] = useState('');
  const [paisOrigen, setPaisOrigen] = useState('USA');
  const [marca, setMarca] = useState('');
  const [marcaId, setMarcaId] = useState<string | undefined>();
  const [nombreComercial, setNombreComercial] = useState('');

  // ─── Estado · Sec.2 Atributos ─────────────────────────────────────────────
  const [skc, setSkc] = useState<AtributosLineaSKCValue>({});
  const [sup, setSup] = useState<AtributosLineaSUPValue>({ servingsDia: '1' });

  // ─── Estado · Sec.3 Identificadores ──────────────────────────────────────
  const [codigoUPC, setCodigoUPC] = useState('');
  const [contenidoValor, setContenidoValor] = useState<string>('');
  const [contenidoUnidad, setContenidoUnidad] = useState<UnidadContenido>('ml');

  // ─── Estado · Sec.4 Clasificación ────────────────────────────────────────
  const [tipoProductoId, setTipoProductoId] = useState<string | undefined>();
  const [tipoProductoNombre, setTipoProductoNombre] = useState<string>('');
  const [categoriasSel, setCategoriasSel] = useState<MaestroChipSelection[]>([]);
  const [etiquetasSel, setEtiquetasSel] = useState<MaestroChipSelection[]>([]);

  // ─── Estado · Sec.5 Logística ────────────────────────────────────────────
  const [pesoLibras, setPesoLibras] = useState<string>('');

  // ─── Estado · Sec.6 Marketing IA ─────────────────────────────────────────
  const [marketing, setMarketing] = useState<DescripcionMarketing | undefined>();

  // ─── Detección de línea SKC/SUP ──────────────────────────────────────────
  const lineaCodigo = useMemo(() => {
    if (!lineaNegocioId) return '' as 'SKC' | 'SUP' | '';
    const linea = lineasNegocio.find(l => l.id === lineaNegocioId);
    const codigo = (linea?.codigo ?? '').toUpperCase();
    if (codigo === 'SKC' || codigo === 'SUP') return codigo;
    return '' as const;
  }, [lineaNegocioId, lineasNegocio]);

  const esSKC = lineaCodigo === 'SKC';
  const esSUP = lineaCodigo === 'SUP';

  // S3.4 (2026-05-04) · Unidades de contenido neto filtradas por línea +
  // auto-default de unidad cuando se elige línea (si el usuario no ha tocado aún).
  const unidadesDisponibles = useMemo(() => getUnidadesPorLinea(lineaCodigo), [lineaCodigo]);
  const [unidadTocada, setUnidadTocada] = useState(false);
  useEffect(() => {
    if (!lineaCodigo) return;
    if (unidadTocada) {
      // Si la unidad actual ya no aplica para la nueva línea, fuerzo default.
      if (!unidadesDisponibles.includes(contenidoUnidad)) {
        setContenidoUnidad(getUnidadDefault(lineaCodigo));
      }
    } else {
      setContenidoUnidad(getUnidadDefault(lineaCodigo));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineaCodigo]);

  // ─── Reset al cerrar ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setSeccionAbierta('identidad');
      setSubmitting(false);
      setLineaNegocioId('');
      setPaisOrigen('USA');
      setMarca('');
      setMarcaId(undefined);
      setNombreComercial('');
      setSkc({});
      setSup({ servingsDia: '1' });
      setCodigoUPC('');
      setContenidoValor('');
      setContenidoUnidad('ml');
      setUnidadTocada(false);
      setTipoProductoId(undefined);
      setTipoProductoNombre('');
      setCategoriasSel([]);
      setEtiquetasSel([]);
      setPesoLibras('');
      setMarketing(undefined);
    }
  }, [open]);

  // ESC para cerrar
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // ─── Validación por sección ──────────────────────────────────────────────
  const sec1OK = !!lineaNegocioId && !!paisOrigen && marca.trim().length > 0 && nombreComercial.trim().length > 0;

  const sec2OK = useMemo(() => {
    if (!esSKC && !esSUP) return true; // sin línea con atributos = N/A
    if (esSKC) return !!skc.tipo;
    // S3.4 (2026-05-04) · Sec.2 SUP ya no tiene Presentación.
    // El criterio mínimo ahora es Servings/día válido (>0) — único campo
    // requerido para que el chip duración pueda calcularse en Sec.3.
    if (esSUP) return !!sup.servingsDia && parseInt(sup.servingsDia) > 0;
    return false;
  }, [esSKC, esSUP, skc.tipo, sup.servingsDia]);

  const sec3OK = !!contenidoValor && parseFloat(contenidoValor) > 0;
  const sec4OK = !!tipoProductoId; // tipo es lo único requerido en clasificación
  // Sec.5 Logística · peso OPCIONAL (se consigna cuando el producto llega al almacén · 2026-05-04)
  // OK si está vacío O si tiene un valor > 0 (no permite ingresar 0 o negativo)
  const sec5OK = !pesoLibras || parseFloat(pesoLibras) > 0;

  const camposRequeridosOK = sec1OK && sec2OK && sec3OK; // sec.4 y sec.5 técnicamente opcionales

  // ─── Pre-requisitos para Marketing IA (Sec.6) ────────────────────────────
  const prerequisitosMarketing: PrerequisitoChecklist[] = useMemo(
    () => [
      {
        id: 'sec1',
        label: 'Sec.1 Identidad',
        ok: sec1OK,
        detalle: !sec1OK ? 'falta línea, marca o nombre' : undefined,
      },
      {
        id: 'sec2',
        label: `Sec.2 Atributos ${esSKC ? '(SKC)' : esSUP ? '(SUP)' : ''}`,
        ok: sec2OK,
        detalle: !sec2OK
          ? esSKC ? 'falta Tipo SKC' : esSUP ? 'falta Servings/día' : 'falta tipo principal'
          : undefined,
      },
      {
        id: 'sec3',
        label: 'Sec.3 Identificadores',
        ok: sec3OK,
        detalle: !sec3OK ? 'falta Contenido neto' : undefined,
      },
      {
        id: 'sec4',
        label: 'Sec.4 Clasificación',
        ok: sec4OK,
        detalle: !sec4OK ? 'falta Tipo de producto' : undefined,
      },
      {
        id: 'sec5',
        label: 'Sec.5 Logística',
        ok: sec5OK,
        detalle: !pesoLibras ? 'peso pendiente · se consigna al recibir' : undefined,
      },
    ],
    [sec1OK, sec2OK, sec3OK, sec4OK, sec5OK, esSKC, esSUP],
  );

  // ─── Generar marketing con IA ────────────────────────────────────────────
  const handleGenerateMarketing = async (): Promise<DescripcionMarketing | null> => {
    if (!user) {
      throw new Error('Sin sesión activa');
    }

    // Construir el producto parcial para enviar a la CF
    const atributosSkincare = esSKC && skc.tipo ? {
      tipoProductoSKC: skc.tipo,
      ingredienteClave: skc.ingredienteClave,
      lineaProducto: skc.lineaProducto,
      tipoPiel: skc.tipoPiel,
      preocupaciones: skc.preocupaciones,
      pasoRutina: skc.pasoRutina,
      textura: skc.textura,
      zonaAplicacion: skc.zona,
      spf: skc.spf ? parseInt(skc.spf) : undefined,
      pa: skc.pa,
    } : undefined;

    const atributosSuplementos = esSUP && sup.presentacion ? {
      presentacion: sup.presentacion,
      momentoDia: sup.momentoDia,
      tomaConComida: sup.tomaConComida,
      edadRecomendada: sup.edad,
      restricciones: sup.restricciones,
      sabor: sup.sabor,
      advertencias: sup.advertencias,
      dosaje: sup.dosaje,
    } : undefined;

    const result = await generarDescripcionMarketing(
      {
        lineaCodigo,
        marca: marca.trim(),
        nombreComercial: nombreComercial.trim(),
        paisOrigen,
        atributosSkincare: atributosSkincare as any,
        atributosSuplementos: atributosSuplementos as any,
        contenidoNeto: contenidoValor
          ? { valor: parseFloat(contenidoValor), unidad: contenidoUnidad }
          : undefined,
        pesoLibras: pesoLibras ? parseFloat(pesoLibras) : undefined,
      },
      user.uid,
      categoriasSel.map(c => c.nombre).filter(Boolean) as string[],
      etiquetasSel.map(e => e.nombre).filter(Boolean) as string[],
    );
    return result;
  };

  // ─── Submit final ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!camposRequeridosOK || submitting) return;
    setSubmitting(true);
    try {
      const categoriaPrincipal = categoriasSel.find(c => c.esPrincipal);

      // Construir atributos por línea
      const atributosSkincare = esSKC && skc.tipo ? {
        tipoProductoSKC: skc.tipo as TipoProductoSKC,
        // S3.2 · volumen + unidadMedida @deprecated · se mantienen para retrocompat
        // pero el dato canónico ahora vive en `contenidoNeto`. Mientras escribimos
        // valores legacy aquí para no romper código que aún los lee.
        volumen: contenidoValor || '',
        unidadMedida: (contenidoUnidad === 'ml' || contenidoUnidad === 'g' || contenidoUnidad === 'oz' || contenidoUnidad === 'unidades')
          ? contenidoUnidad
          : 'unidades',
        ingredienteClave: skc.ingredienteClave?.trim() || undefined,
        lineaProducto: skc.lineaProducto?.trim() || undefined,
        tipoPiel: skc.tipoPiel?.length ? skc.tipoPiel : undefined,
        preocupaciones: skc.preocupaciones?.length ? skc.preocupaciones : undefined,
        pasoRutina: (skc.pasoRutina || undefined) as PasoRutinaSKC | undefined,
        textura: (skc.textura || undefined) as TexturaSKC | undefined,
        zonaAplicacion: skc.zona?.length ? skc.zona : undefined,
        spf: skc.tipo === 'protector_solar' && skc.spf ? parseInt(skc.spf) : undefined,
        pa: skc.tipo === 'protector_solar' && skc.pa ? skc.pa : undefined,
      } : undefined;

      const atributosSuplementos = esSUP && sup.presentacion ? {
        presentacion: sup.presentacion as PresentacionSUP,
        momentoDia: sup.momentoDia?.length ? sup.momentoDia : undefined,
        tomaConComida: (sup.tomaConComida || undefined) as TomaConComida | undefined,
        edadRecomendada: (sup.edad || undefined) as EdadRecomendada | undefined,
        restricciones: sup.restricciones?.length ? sup.restricciones : undefined,
        sabor: sup.sabor?.trim() || undefined,
        advertencias: sup.advertencias?.trim() || undefined,
        dosaje: sup.dosaje?.trim() || undefined,
      } : undefined;

      // S3.4 · Mapear Presentacion legacy DERIVÁNDOLA de la unidad del Contenido neto
      // (porque el campo Presentación ya no existe en Sec.2 SUP del wizard nuevo).
      const presentacionLegacy: Presentacion =
        esSUP ? deriveLegacyFromUnidad(contenidoUnidad) : 'capsulas';

      const data: Partial<ProductoFormData> = {
        marca: marca.trim(),
        marcaId,
        nombreComercial: nombreComercial.trim(),
        // Legacy compat (mantener porque el shape lo requiere)
        presentacion: presentacionLegacy,
        dosaje: sup.dosaje?.trim() || '',
        contenido: contenidoValor ? `${contenidoValor} ${contenidoUnidad}` : '',
        sabor: sup.sabor?.trim() || undefined,
        codigoUPC: codigoUPC.trim(),
        grupo: '',
        subgrupo: '',
        // Origen
        paisOrigen,
        pesoLibras: pesoLibras ? parseFloat(pesoLibras) : undefined,
        lineaNegocioId: lineaNegocioId || undefined,
        // Clasificación
        tipoProductoId,
        categoriaIds: categoriasSel.map(c => c.id),
        categoriaPrincipalId: categoriaPrincipal?.id,
        etiquetaIds: etiquetasSel.map(e => e.id),
        // Atributos por línea
        atributosSkincare,
        atributosSuplementos,
        // Ciclo recompra (auto-calc para SUP)
        servingsPerDay:
          esSUP && sup.servingsDia && parseInt(sup.servingsDia) > 0
            ? parseInt(sup.servingsDia)
            : undefined,
        // Stock — defaults seguros (los nuevos productos arrancan en 0/100, ajusta el módulo Stock después)
        stockMinimo: 0,
        stockMaximo: 100,
        // S3.2 · campos nuevos
        contenidoNeto: contenidoValor
          ? { valor: parseFloat(contenidoValor), unidad: contenidoUnidad }
          : undefined,
        descripcionMarketing: marketing,
      };
      await onSubmit(data);
      // El parent cierra el modal después de éxito
    } catch (err) {
      console.error('[WizardProductoV2] error en submit', err);
      setSubmitting(false);
    }
  };

  if (!open) return null;

  /**
   * S3.4 · Deriva el campo legacy `Presentacion` desde la unidad del Contenido neto.
   * Reemplaza al ex-mapPresentacionSUPaLegacy (que dependía del campo Presentación
   * eliminado en S3.4). La presentación legacy se mantiene en el modelo solo por
   * compat con código que aún la lee (módulo Stock, exportes CSV, etc.).
   */
  function deriveLegacyFromUnidad(unidad: UnidadContenido): Presentacion {
    switch (unidad) {
      case 'capsulas':  return 'capsulas';
      case 'tabletas':  return 'tabletas';
      case 'gomitas':   return 'gomitas';
      case 'g':
      case 'kg':        return 'polvo';
      case 'ml':        return 'liquido';
      default:          return 'capsulas';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        aria-label="Cerrar"
      />
      <div className="relative w-full lg:max-w-3xl bg-white rounded-t-2xl lg:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header gradient F6.1 */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-5 py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                esSKC ? 'bg-amber-100' : esSUP ? 'bg-indigo-100' : 'bg-teal-100'
              }`}>
                {esSKC ? (
                  <Droplets className="w-5 h-5 text-amber-700" />
                ) : esSUP ? (
                  <Pill className="w-5 h-5 text-indigo-700" />
                ) : (
                  <Package className="w-5 h-5 text-teal-700" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900">Crear producto único · v2</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Sin variantes · 1 SKU único · 6 secciones · Marketing IA al final
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 flex-shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-3">
          {/* Sección 1 · Identidad */}
          <SeccionColapsable
            numero={1}
            titulo="Identidad"
            subtitulo="Línea + País + Marca + Nombre comercial · línea/país/marca immutables post-creación"
            expanded={seccionAbierta === 'identidad'}
            onToggle={() => setSeccionAbierta('identidad')}
            estado={seccionAbierta === 'identidad' ? 'active' : sec1OK ? 'complete' : 'inactive'}
          >
            <div className="space-y-3 text-xs">
              <Field label="Línea de negocio" required>
                <select
                  value={lineaNegocioId}
                  onChange={e => setLineaNegocioId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Seleccionar línea...</option>
                  {lineasNegocio.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.nombre} {l.codigo ? `· ${l.codigo}` : ''}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-500 mt-1 italic">
                  Define los atributos de Sec.2 · cambio post-creación requiere duplicar
                </div>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="País origen" required>
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

                <Field label="Marca" required>
                  <MaestroSelect
                    label=""
                    tipo="marca"
                    valueId={marcaId}
                    valueSnapshot={marcaId ? { id: marcaId, nombre: marca } : undefined}
                    items={marcasActivas.map(m => ({
                      id: m.id,
                      codigo: (m as any).codigo,
                      nombre: m.nombre,
                    }))}
                    onSelect={(item) => {
                      setMarcaId(item.id);
                      setMarca(item.nombre);
                    }}
                    onSolicitarCrear={async (queryActual) => {
                      if (!user) return;
                      try {
                        const id = await createMarca({ nombre: queryActual } as any, user.uid);
                        setMarcaId(id);
                        setMarca(queryActual);
                      } catch (err) {
                        console.error('[WizardV2] error al crear marca', err);
                      }
                    }}
                    onClear={() => {
                      setMarcaId(undefined);
                      setMarca('');
                    }}
                  />
                </Field>
              </div>

              <Field label="Nombre comercial" required>
                <input
                  type="text"
                  value={nombreComercial}
                  onChange={e => setNombreComercial(e.target.value)}
                  placeholder="ej. Madeca Cream Time Reverse"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
                <div className="text-[10px] text-slate-500 mt-1 italic">
                  Cómo aparece al cliente · ≤45 caracteres ideal
                </div>
              </Field>
            </div>
          </SeccionColapsable>

          {/* Sección 2 · Atributos por línea */}
          <SeccionColapsable
            numero={2}
            titulo={esSKC ? 'Atributos Skincare' : esSUP ? 'Atributos Suplementos' : 'Atributos por línea'}
            subtitulo={
              esSKC ? 'Vocabulario CERRADO · 8 atributos SKC'
                : esSUP ? '7 atributos SUP · presentación se infiere de la unidad de Sec.3'
                : 'Selecciona primero una línea de negocio (Sec.1)'
            }
            expanded={seccionAbierta === 'atributos'}
            onToggle={() => setSeccionAbierta('atributos')}
            estado={seccionAbierta === 'atributos' ? 'active' : sec2OK && (esSKC || esSUP) ? 'complete' : 'inactive'}
          >
            <AtributosPorLineaSection
              lineaCodigo={lineaCodigo}
              skc={skc}
              sup={sup}
              onChangeSKC={(patch) => setSkc(prev => ({ ...prev, ...patch }))}
              onChangeSUP={(patch) => setSup(prev => ({ ...prev, ...patch }))}
            />
          </SeccionColapsable>

          {/* Sección 3 · Identificadores comerciales · S3.4 con chip duración auto */}
          <SeccionColapsable
            numero={3}
            titulo="Identificadores comerciales"
            subtitulo={esSUP ? 'UPC + Contenido neto + Duración auto' : 'Código UPC + Contenido neto del envase'}
            expanded={seccionAbierta === 'identificadores'}
            onToggle={() => setSeccionAbierta('identificadores')}
            estado={seccionAbierta === 'identificadores' ? 'active' : sec3OK ? 'complete' : 'inactive'}
          >
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Código UPC">
                  <input
                    type="text"
                    value={codigoUPC}
                    onChange={e => setCodigoUPC(e.target.value)}
                    placeholder="ej. 8809390590318"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                  />
                </Field>

                <Field label="Contenido neto del envase" required>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.01"
                      value={contenidoValor}
                      onChange={e => setContenidoValor(e.target.value)}
                      placeholder="50"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                    />
                    <select
                      value={contenidoUnidad}
                      onChange={e => {
                        setContenidoUnidad(e.target.value as UnidadContenido);
                        setUnidadTocada(true);
                      }}
                      className="px-2 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      {unidadesDisponibles.map(u => (
                        <option key={u} value={u}>{UNIDAD_CONTENIDO_LABELS[u]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 italic">
                    {esSUP
                      ? 'Unidades SUP: cápsulas · tabletas · gomitas · sobres · sticks · scoops · g · ml · oz · lb'
                      : esSKC
                      ? 'Unidades SKC: ml · g · oz · fl oz'
                      : 'Cantidad real del envase · cross-línea'}
                  </div>
                </Field>
              </div>

              {/* S3.4 · Chip vivo de duración del envase (solo SUP) */}
              {esSUP && (
                <ChipDuracionEnvase
                  esSuplemento={esSUP}
                  contenidoNeto={
                    contenidoValor && parseFloat(contenidoValor) > 0
                      ? { valor: parseFloat(contenidoValor), unidad: contenidoUnidad }
                      : undefined
                  }
                  servingsPerDay={
                    sup.servingsDia && parseInt(sup.servingsDia) > 0 ? parseInt(sup.servingsDia) : undefined
                  }
                  dosaje={sup.dosaje}
                  onIrASec2={() => setSeccionAbierta('atributos')}
                />
              )}
            </div>
          </SeccionColapsable>

          {/* Sección 4 · Clasificación */}
          <SeccionColapsable
            numero={4}
            titulo="Clasificación"
            subtitulo="Tipo + Categorías + Etiquetas · maestros vinculados"
            expanded={seccionAbierta === 'clasificacion'}
            onToggle={() => setSeccionAbierta('clasificacion')}
            estado={seccionAbierta === 'clasificacion' ? 'active' : sec4OK ? 'complete' : 'inactive'}
          >
            <div className="space-y-4 text-xs">
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
                      { nombre: queryActual, descripcion: '' } as any,
                      user.uid,
                    );
                    setTipoProductoId(nuevo.id);
                    setTipoProductoNombre(nuevo.nombre);
                  } catch (err) {
                    console.error('[WizardV2] error al crear tipo', err);
                  }
                }}
                onClear={() => {
                  setTipoProductoId(undefined);
                  setTipoProductoNombre('');
                }}
                helperText="Agrupa productos equivalentes de distintas marcas"
              />

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
                    const nueva = await createCategoria({ nombre } as any, user.uid);
                    return nueva.id;
                  } catch (err) {
                    console.error('[WizardV2] error al crear categoría', err);
                    return null;
                  }
                }}
                helperText="Áreas de salud · max 5 · click en chip para hacerla principal"
              />

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
                    const nueva = await createEtiqueta({ nombre } as any, user.uid);
                    return nueva.id;
                  } catch (err) {
                    console.error('[WizardV2] error al crear etiqueta', err);
                    return null;
                  }
                }}
                helperText="Tags marketing flexibles · ej: vegano, sin-gluten, best-seller"
              />
            </div>
          </SeccionColapsable>

          {/* Sección 5 · Logística */}
          <SeccionColapsable
            numero={5}
            titulo="Logística"
            subtitulo="Opcional · peso unitario se consigna al recibir · usado por tramos peso (D-11), packing list, despacho"
            expanded={seccionAbierta === 'logistica'}
            onToggle={() => setSeccionAbierta('logistica')}
            estado={seccionAbierta === 'logistica' ? 'active' : pesoLibras ? 'complete' : 'inactive'}
          >
            <div className="space-y-3 text-xs">
              <Field label="Peso unitario (lb)">
                <div className="grid grid-cols-3 gap-2 items-center">
                  <input
                    type="number"
                    step="0.01"
                    value={pesoLibras}
                    onChange={e => setPesoLibras(e.target.value)}
                    placeholder="0.21"
                    className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                  />
                  <div className="text-[10px] text-slate-500 italic flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    {pesoLibras && parseFloat(pesoLibras) > 0
                      ? `≈ ${(parseFloat(pesoLibras) * 0.4536).toFixed(2)} kg`
                      : 'kg auto'}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 italic">
                  Si el colaborador transportista tiene tabla de tramos peso (D-11), este valor decide el tramo aplicado.
                </div>
              </Field>

              <div className="rounded-lg bg-slate-50 border border-dashed border-slate-300 px-3 py-2 flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[10px] text-slate-600">
                  Dimensiones (alto/ancho/profundidad cm) · sub-fase futura · cubicaje volumétrico
                </span>
              </div>
            </div>
          </SeccionColapsable>

          {/* Sección 6 · Marketing comercial · IA */}
          <SeccionColapsable
            numero={6}
            titulo="Marketing comercial"
            subtitulo={
              marketing
                ? 'Generado · 3 niveles editables'
                : 'IA · botón habilitado cuando Sec.1-5 estén completas'
            }
            expanded={seccionAbierta === 'marketing'}
            onToggle={() => setSeccionAbierta('marketing')}
            estado={seccionAbierta === 'marketing' ? 'active' : marketing ? 'complete' : 'inactive'}
          >
            <MarketingComercialSection
              value={marketing}
              onChange={(next) => setMarketing(next)}
              prerequisitos={prerequisitosMarketing}
              onGenerate={handleGenerateMarketing}
              mode="create"
              lineaCodigo={lineaCodigo}
            />
          </SeccionColapsable>

          {/* INFO · campos que NO viven aquí */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3">
            <div className="text-[10px] text-blue-800">
              <strong className="text-blue-900">Stock, precio venta y costo NO se llenan acá.</strong>{' '}
              Requieren info REAL que recién existe DESPUÉS de crear el producto · viven en módulos operativos (Stock · Investigación · OC).
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-2.5 lg:py-3 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500">
            {camposRequeridosOK ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span>Listo para crear · Marketing IA opcional</span>
              </>
            ) : (
              <span>Completa los campos marcados con *</span>
            )}
            {marketing && (
              <span className="ml-2 text-purple-700 italic flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Marketing generado
              </span>
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

const Field: React.FC<{
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ label, required, className = '', children }) => (
  <div className={className}>
    <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
      {label}
      {required && <span className="text-rose-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);
