/**
 * ProductoEditModalV2 · S3.2 · DEUDA-IA-001 · 2026-05-03
 *
 * Modal Editar producto con la estructura canónica de 6 secciones aprobada
 * en S3.2 (mockup #40 v3). Reemplaza al ProductoEditModal legacy cuando el
 * flag `WIZARD_PRODUCTO_V2` está activo.
 *
 * Estructura · 6 secciones acordeón:
 *   1. Origen           · read-only (línea + país inmutables)
 *   2. Información      · marca + nombre + UPC + Contenido neto
 *   3. Atributos        · 8 SKC o 8 SUP (componente compartido) editables
 *   4. Clasificación    · Tipo + Categorías + Etiquetas (placeholder simple)
 *   5. Logística        · Peso unitario editable
 *   6. Marketing IA     · 3 niveles · regenerable si datos cambiaron
 *
 * Diferencias vs ProductoEditModal legacy:
 *   - 6 secciones completas (vs 4 con atributos limitados)
 *   - Marketing IA con auditoría + banner regenerar
 *   - Atributos por línea COMPLETOS editables (vs solo 2)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Edit2,
  Lock,
  Info,
  Check,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type {
  Producto,
  ProductoFormData,
  TipoProductoSKC,
  PasoRutinaSKC,
  TexturaSKC,
  PresentacionSUP,
  TomaConComida,
  EdadRecomendada,
  DescripcionMarketing,
  UnidadContenido,
} from '../../../../types/producto.types';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import { ProductoService } from '../../../../services/producto.service';
import { useProductoStore } from '../../../../store/productoStore';
import { SeccionColapsable } from '../wizards/SeccionColapsable';
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
import {
  UNIDADES_SUP,
  UNIDADES_SKC,
  UNIDADES_APPAREL,
  UNIDADES_ALIMENTOS,
  UNIDAD_CONTENIDO_LABELS,
} from '../../../../types/producto.types';
import { generarDescripcionMarketing } from '../../../../services/productoMarketingIA.service';
import {
  MaestroSelect,
  MaestroChipsMulti,
  type MaestroChipSelection,
} from '../../../../design-system';
import { useMarcaStore } from '../../../../store/marcaStore';
import { useTipoProductoStore } from '../../../../store/tipoProductoStore';
import { useCategoriaStore } from '../../../../store/categoriaStore';
import { useEtiquetaStore } from '../../../../store/etiquetaStore';

interface ProductoEditModalV2Props {
  open: boolean;
  producto: Producto | null;
  onClose: () => void;
}

type SeccionKey = 'origen' | 'basico' | 'atributos' | 'clasificacion' | 'logistica' | 'marketing';

/**
 * S3.4 (2026-05-04) · Unidades del select dependen de la línea del producto.
 * Espejo de la lógica del WizardProductoV2.
 */
function getUnidadesPorLinea(lineaCodigo: 'SKC' | 'SUP' | ''): UnidadContenido[] {
  switch (lineaCodigo) {
    case 'SUP': return [...UNIDADES_SUP];
    case 'SKC': return [...UNIDADES_SKC];
    default: return [
      ...UNIDADES_SKC, ...UNIDADES_SUP, ...UNIDADES_APPAREL, ...UNIDADES_ALIMENTOS,
    ].filter((u, i, arr) => arr.indexOf(u) === i);
  }
}

// Detecta línea SKC/SUP del producto
function getLineaCodigo(p: Producto | null): 'SKC' | 'SUP' | '' {
  if (!p) return '';
  const linea = (p.lineaNegocioNombre ?? '').toLowerCase();
  if (linea.includes('skin')) return 'SKC';
  if (linea.includes('suplem') || linea.includes('vitam')) return 'SUP';
  return '';
}

export const ProductoEditModalV2: React.FC<ProductoEditModalV2Props> = ({
  open,
  producto,
  onClose,
}) => {
  const toast = useToastStore();
  const user = useAuthStore(s => s.user);
  const { fetchProductos } = useProductoStore();
  const { marcasActivas, fetchMarcasActivas, createMarca } = useMarcaStore();
  const { tiposActivos, fetchTiposActivos, create: createTipo } = useTipoProductoStore();
  const { categoriasActivas, fetchCategoriasActivas, create: createCategoria } = useCategoriaStore();
  const { etiquetasActivas, fetchEtiquetasActivas, create: createEtiqueta } = useEtiquetaStore();

  const [seccionAbierta, setSeccionAbierta] = useState<SeccionKey>('basico');
  const [submitting, setSubmitting] = useState(false);

  // ─── Estado del form (pre-cargado desde el producto) ──────────────────────
  // Sec.2 Información básica
  const [marca, setMarca] = useState('');
  const [marcaId, setMarcaId] = useState<string | undefined>();
  const [nombreComercial, setNombreComercial] = useState('');
  const [codigoUPC, setCodigoUPC] = useState('');
  const [contenidoValor, setContenidoValor] = useState<string>('');
  const [contenidoUnidad, setContenidoUnidad] = useState<UnidadContenido>('ml');

  // Sec.3 Atributos
  const [skc, setSkc] = useState<AtributosLineaSKCValue>({});
  const [sup, setSup] = useState<AtributosLineaSUPValue>({ servingsDia: '1' });

  // Sec.4 Clasificación · S3.5 (2026-05-07) editable · DEUDA-S3.3-002 cerrada
  const [tipoProductoId, setTipoProductoId] = useState<string | undefined>();
  const [tipoProductoNombre, setTipoProductoNombre] = useState<string>('');
  const [categoriasSel, setCategoriasSel] = useState<MaestroChipSelection[]>([]);
  const [etiquetasSel, setEtiquetasSel] = useState<MaestroChipSelection[]>([]);

  // Sec.5 Logística
  const [pesoLibras, setPesoLibras] = useState<string>('');

  // Sec.6 Marketing IA
  const [marketing, setMarketing] = useState<DescripcionMarketing | undefined>();

  const lineaCodigo = useMemo(() => getLineaCodigo(producto), [producto]);
  const esSKC = lineaCodigo === 'SKC';
  const esSUP = lineaCodigo === 'SUP';

  // ─── Cargar maestros al abrir ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    fetchMarcasActivas();
    fetchTiposActivos();
    fetchCategoriasActivas();
    fetchEtiquetasActivas();
  }, [open, fetchMarcasActivas, fetchTiposActivos, fetchCategoriasActivas, fetchEtiquetasActivas]);

  // ─── Cargar datos al abrir ────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !producto) return;

    setMarca(producto.marca ?? '');
    setMarcaId(producto.marcaId);
    setNombreComercial((producto as any).nombreComercial ?? '');
    setCodigoUPC(producto.codigoUPC ?? '');

    // Contenido neto: leer de producto.contenidoNeto (S3.2) si existe, sino fallback a producto.contenido (legacy string)
    if (producto.contenidoNeto) {
      setContenidoValor(String(producto.contenidoNeto.valor));
      setContenidoUnidad(producto.contenidoNeto.unidad);
    } else if (producto.contenido) {
      // Lazy migration: parsear string "50 ml"
      const match = producto.contenido.match(/^([\d.]+)\s*(\w+)/);
      if (match) {
        setContenidoValor(match[1]);
        const u = match[2].toLowerCase();
        // S3.4 · matching simple contra labels e ids del UNIDAD_CONTENIDO_LABELS
        const matchByLabel = (Object.entries(UNIDAD_CONTENIDO_LABELS) as Array<[UnidadContenido, string]>)
          .find(([id, label]) => id === u || label === u);
        setContenidoUnidad(matchByLabel?.[0] ?? 'ml');
      } else {
        setContenidoValor('');
        setContenidoUnidad('ml');
      }
    } else {
      setContenidoValor('');
      setContenidoUnidad('ml');
    }

    // Atributos SKC
    const a = producto.atributosSkincare;
    if (esSKC && a) {
      setSkc({
        tipo: a.tipoProductoSKC,
        ingredienteClave: a.ingredienteClave,
        lineaProducto: a.lineaProducto,
        tipoPiel: a.tipoPiel,
        preocupaciones: a.preocupaciones,
        pasoRutina: a.pasoRutina,
        textura: a.textura,
        zona: a.zonaAplicacion,
        spf: a.spf ? String(a.spf) : '',
        pa: a.pa,
      });
    } else {
      setSkc({});
    }

    // Atributos SUP
    const s = producto.atributosSuplementos;
    if (esSUP && s) {
      setSup({
        presentacion: s.presentacion,
        servingsDia: producto.servingsPerDay ? String(producto.servingsPerDay) : '1',
        sabor: s.sabor,
        restricciones: s.restricciones,
        momentoDia: s.momentoDia,
        tomaConComida: s.tomaConComida,
        edad: s.edadRecomendada,
        advertencias: s.advertencias,
        dosaje: s.dosaje ?? producto.dosaje,
      });
    } else {
      setSup({ servingsDia: '1' });
    }

    // Sec.4 Clasificación · pre-poblar desde snapshots del producto
    setTipoProductoId(producto.tipoProductoId);
    setTipoProductoNombre(producto.tipoProducto?.nombre ?? '');

    const categoriasIniciales: MaestroChipSelection[] = (producto.categorias ?? []).map(c => ({
      id: c.categoriaId,
      nombre: c.nombre,
      esPrincipal: c.categoriaId === producto.categoriaPrincipalId,
    }));
    setCategoriasSel(categoriasIniciales);

    const etiquetasIniciales: MaestroChipSelection[] = (producto.etiquetasData ?? []).map(e => ({
      id: e.etiquetaId,
      nombre: e.nombre,
    }));
    setEtiquetasSel(etiquetasIniciales);

    setPesoLibras(producto.pesoLibras ? String(producto.pesoLibras) : '');
    setMarketing(producto.descripcionMarketing);
    setSeccionAbierta('basico');
  }, [open, producto, esSKC, esSUP]);

  // ESC para cerrar
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // ─── Pre-requisitos para Marketing IA ────────────────────────────────────
  const sec1OK = true; // origen es read-only · siempre OK al editar
  const sec2OK = marca.trim().length > 0 && nombreComercial.trim().length > 0 && !!contenidoValor && parseFloat(contenidoValor) > 0;
  const sec3OK = useMemo(() => {
    if (!esSKC && !esSUP) return true;
    if (esSKC) return !!skc.tipo;
    // S3.4 (2026-05-04) · Sec.3 SUP en editor: criterio mínimo Servings/día.
    if (esSUP) return !!sup.servingsDia && parseInt(sup.servingsDia) > 0;
    return false;
  }, [esSKC, esSUP, skc.tipo, sup.servingsDia]);
  // S3.4 (2026-05-04) · Peso unitario OPCIONAL · se consigna cuando el producto
  // llega al almacén (mismo criterio que WizardProductoV2). OK si está vacío
  // O si tiene valor > 0 (no permite negativos ni 0).
  const sec5OK = !pesoLibras || parseFloat(pesoLibras) > 0;

  const prerequisitosMarketing: PrerequisitoChecklist[] = useMemo(
    () => [
      { id: 'sec1', label: 'Origen (línea + país)', ok: sec1OK },
      {
        id: 'sec2',
        label: 'Información (marca + nombre + contenido neto)',
        ok: sec2OK,
        detalle: !sec2OK ? 'falta algún campo' : undefined,
      },
      {
        id: 'sec3',
        label: `Atributos ${esSKC ? '(SKC)' : esSUP ? '(SUP)' : ''}`,
        ok: sec3OK,
        detalle: !sec3OK ? 'falta tipo principal' : undefined,
      },
      {
        id: 'sec5',
        // S3.4 · Peso es opcional · marcamos la sección como "(opcional)" para que
        // el usuario no piense que falta info crítica.
        label: 'Logística (peso opcional)',
        ok: sec5OK,
        detalle: !sec5OK ? 'peso debe ser > 0' : undefined,
      },
    ],
    [sec1OK, sec2OK, sec3OK, sec5OK, esSKC, esSUP],
  );

  // Detectar si datos cambiaron desde la última generación de marketing
  const datosCambiaronDesdeGeneracion = useMemo(() => {
    if (!marketing?.tagline.generadoEn) return false;
    // Si los atributos críticos cambiaron desde la generación, mostrar banner regenerar
    // Heurística simple: si el producto original tenía marketing y los campos ahora son distintos
    if (!producto?.descripcionMarketing) return false;
    // Comparar marca + nombre + algunos atributos clave
    const cambios =
      marca !== (producto.marca ?? '') ||
      nombreComercial !== ((producto as any).nombreComercial ?? '') ||
      (esSKC && skc.tipo !== producto.atributosSkincare?.tipoProductoSKC) ||
      // S3.4 · proxy de la presentación SUP = unidad del Contenido neto
      (esSUP && contenidoUnidad !== producto.contenidoNeto?.unidad);
    return cambios;
  }, [marketing, producto, marca, nombreComercial, skc.tipo, contenidoUnidad, esSKC, esSUP]);

  // ─── Generar / Regenerar marketing con IA ────────────────────────────────
  const handleGenerateMarketing = async (): Promise<DescripcionMarketing | null> => {
    if (!user) throw new Error('Sin sesión activa');

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

    // S3.4 · ya no requiere presentacion (eliminada del modelo wizard);
    // la presentación efectiva la dice la unidad de contenidoNeto.
    const atributosSuplementos = esSUP ? {
      // presentacion legacy se preserva si el producto original la traía
      presentacion: producto?.atributosSuplementos?.presentacion,
      momentoDia: sup.momentoDia,
      tomaConComida: sup.tomaConComida,
      edadRecomendada: sup.edad,
      restricciones: sup.restricciones,
      sabor: sup.sabor,
      advertencias: sup.advertencias,
      dosaje: sup.dosaje,
    } : undefined;

    return generarDescripcionMarketing(
      {
        lineaCodigo,
        marca: marca.trim(),
        nombreComercial: nombreComercial.trim(),
        paisOrigen: producto?.paisOrigen,
        atributosSkincare: atributosSkincare as any,
        atributosSuplementos: atributosSuplementos as any,
        contenidoNeto: contenidoValor
          ? { valor: parseFloat(contenidoValor), unidad: contenidoUnidad }
          : undefined,
        pesoLibras: pesoLibras ? parseFloat(pesoLibras) : undefined,
      },
      user.uid,
    );
  };

  // ─── Submit ──────────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!producto || !user) return;
    if (!sec2OK) {
      toast.warning('Faltan campos requeridos en Información');
      return;
    }
    setSubmitting(true);
    try {
      const atributosSkincare = esSKC && skc.tipo ? {
        tipoProductoSKC: skc.tipo as TipoProductoSKC,
        volumen: contenidoValor || '',
        unidadMedida:
          contenidoUnidad === 'ml' || contenidoUnidad === 'g' || contenidoUnidad === 'oz' || contenidoUnidad === 'unidades'
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
      } : producto.atributosSkincare;

      // S3.4 · ya no se requiere presentacion para guardar SUP.
      // La presentación legacy se mantiene del producto original (compat lectura).
      const atributosSuplementos = esSUP ? {
        presentacion: producto.atributosSuplementos?.presentacion as PresentacionSUP | undefined,
        momentoDia: sup.momentoDia?.length ? sup.momentoDia : undefined,
        tomaConComida: (sup.tomaConComida || undefined) as TomaConComida | undefined,
        edadRecomendada: (sup.edad || undefined) as EdadRecomendada | undefined,
        restricciones: sup.restricciones?.length ? sup.restricciones : undefined,
        sabor: sup.sabor?.trim() || undefined,
        advertencias: sup.advertencias?.trim() || undefined,
        dosaje: sup.dosaje?.trim() || undefined,
      } : producto.atributosSuplementos;

      const categoriaPrincipal = categoriasSel.find(c => c.esPrincipal);

      const data: Partial<ProductoFormData> = {
        marca: marca.trim(),
        marcaId,
        nombreComercial: nombreComercial.trim(),
        codigoUPC: codigoUPC.trim(),
        contenido: contenidoValor ? `${contenidoValor} ${contenidoUnidad}` : '',
        contenidoNeto: contenidoValor
          ? { valor: parseFloat(contenidoValor), unidad: contenidoUnidad }
          : undefined,
        atributosSkincare,
        atributosSuplementos,
        pesoLibras: pesoLibras ? parseFloat(pesoLibras) : undefined,
        servingsPerDay:
          esSUP && sup.servingsDia && parseInt(sup.servingsDia) > 0
            ? parseInt(sup.servingsDia)
            : producto.servingsPerDay,
        // Sec.4 Clasificación · S3.5 (2026-05-07) editable
        tipoProductoId,
        categoriaIds: categoriasSel.map(c => c.id),
        categoriaPrincipalId: categoriaPrincipal?.id,
        etiquetaIds: etiquetasSel.map(e => e.id),
        descripcionMarketing: marketing,
      };

      await ProductoService.update(producto.id, data);
      toast.success(`"${nombreComercial}" actualizado`);
      await fetchProductos();
      onClose();
    } catch (err: any) {
      toast.error(`Error al guardar: ${err?.message ?? 'desconocido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !producto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-teal-50 to-white border-b border-slate-200 px-5 py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Edit2 className="w-5 h-5 text-teal-700" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 mb-0.5">
                  {producto.lineaNegocioNombre ?? 'Línea'} · Editar producto · v2 (6 secciones)
                </div>
                <h2 className="text-base font-bold text-slate-900 truncate">
                  {(producto as any).nombreComercial ?? 'Producto'}
                </h2>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  <span className="font-mono">{producto.sku}</span>
                </div>
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

        {/* Banner read-only fields */}
        <div className="bg-purple-50 border-b border-purple-200 px-5 py-2.5 flex-shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-purple-900">
            <Lock className="w-3.5 h-3.5 text-purple-700 flex-shrink-0" />
            <span>
              <strong>SKU, Línea de negocio y País de origen</strong> son inmutables · cambian
              referencias en OCs/Stock — para modificarlos hay que duplicar el producto.
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-3">
          {/* Sección 1 · Origen READ-ONLY */}
          <div className="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 flex items-center gap-2.5">
            <span className="w-[22px] h-[22px] rounded-full bg-slate-100 text-slate-600 inline-flex items-center justify-center">
              <Lock className="w-3 h-3" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Origen
                <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] font-bold">
                  READ-ONLY
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Línea: <strong>{producto.lineaNegocioNombre ?? '—'}</strong>
                {producto.paisOrigen && <> · País: <strong>{producto.paisOrigen}</strong></>}
              </div>
            </div>
          </div>

          {/* Sección 2 · Información básica */}
          <SeccionColapsable
            numero={2}
            titulo="Información básica"
            subtitulo="Marca + nombre + UPC + Contenido neto"
            expanded={seccionAbierta === 'basico'}
            onToggle={() => setSeccionAbierta('basico')}
            estado={seccionAbierta === 'basico' ? 'active' : sec2OK ? 'complete' : 'inactive'}
          >
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        console.error('[EditModalV2] error al crear marca', err);
                      }
                    }}
                    onClear={() => {
                      setMarcaId(undefined);
                      setMarca('');
                    }}
                  />
                </Field>
                <Field label="Código UPC">
                  <input
                    type="text"
                    value={codigoUPC}
                    onChange={e => setCodigoUPC(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </Field>
              </div>
              <Field label="Nombre comercial" required>
                <input
                  type="text"
                  value={nombreComercial}
                  onChange={e => setNombreComercial(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
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
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
                  />
                  <select
                    value={contenidoUnidad}
                    onChange={e => setContenidoUnidad(e.target.value as UnidadContenido)}
                    className="px-2 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    {getUnidadesPorLinea(lineaCodigo).map(u => (
                      <option key={u} value={u}>{UNIDAD_CONTENIDO_LABELS[u]}</option>
                    ))}
                  </select>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 italic">
                  {esSUP
                    ? 'Unidades SUP: cápsulas · tabletas · gomitas · sobres · sticks · scoops · g · ml · oz · lb'
                    : esSKC
                    ? 'Unidades SKC: ml · g · oz · fl oz'
                    : 'Cross-línea · ml/g para SKC · cápsulas/tabletas para SUP'}
                </div>
              </Field>

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

          {/* Sección 3 · Atributos por línea */}
          <SeccionColapsable
            numero={3}
            titulo={esSKC ? 'Atributos Skincare' : esSUP ? 'Atributos Suplementos' : 'Atributos por línea'}
            subtitulo={esSKC ? '8 atributos SKC editables' : esSUP ? '7 atributos SUP · presentación en Sec.2 (unidad de Contenido)' : 'sin línea con atributos'}
            expanded={seccionAbierta === 'atributos'}
            onToggle={() => setSeccionAbierta('atributos')}
            estado={seccionAbierta === 'atributos' ? 'active' : sec3OK && (esSKC || esSUP) ? 'complete' : 'inactive'}
          >
            <AtributosPorLineaSection
              lineaCodigo={lineaCodigo}
              skc={skc}
              sup={sup}
              onChangeSKC={(patch) => setSkc(prev => ({ ...prev, ...patch }))}
              onChangeSUP={(patch) => setSup(prev => ({ ...prev, ...patch }))}
            />
          </SeccionColapsable>

          {/* Sección 4 · Clasificación · S3.5 editable · DEUDA-S3.3-002 cerrada
              · Patrón canónico replicado del WizardProductoV2 (mockup #17 v3) */}
          <SeccionColapsable
            numero={4}
            titulo="Clasificación"
            subtitulo="Tipo · Categorías · Etiquetas"
            expanded={seccionAbierta === 'clasificacion'}
            onToggle={() => setSeccionAbierta('clasificacion')}
            estado={seccionAbierta === 'clasificacion' ? 'active' : tipoProductoId ? 'complete' : 'inactive'}
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
                    console.error('[EditModalV2] error al crear tipo', err);
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
                    console.error('[EditModalV2] error al crear categoría', err);
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
                    console.error('[EditModalV2] error al crear etiqueta', err);
                    return null;
                  }
                }}
                helperText="Tags marketing flexibles · ej: vegano, sin-gluten, best-seller"
              />
            </div>
          </SeccionColapsable>

          {/* Sección 5 · Logística · S3.4 peso OPCIONAL */}
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
                    className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
                  />
                  <div className="text-[10px] text-slate-500 italic">
                    {pesoLibras && parseFloat(pesoLibras) > 0
                      ? `≈ ${(parseFloat(pesoLibras) * 0.4536).toFixed(2)} kg`
                      : '— kg'}
                  </div>
                </div>
              </Field>
            </div>
          </SeccionColapsable>

          {/* Sección 6 · Marketing comercial · IA */}
          <SeccionColapsable
            numero={6}
            titulo="Marketing comercial"
            subtitulo={
              marketing
                ? 'Editable · regenerable si modificás atributos'
                : 'IA · botón habilitado cuando Sec.2-5 estén completas'
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
              mode="edit"
              datosCambiaronDesdeGeneracion={datosCambiaronDesdeGeneracion}
              lineaCodigo={lineaCodigo}
            />
          </SeccionColapsable>

          {/* INFO · campos que NO viven aquí */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
              <div className="text-[10px] text-blue-800 flex-1">
                <strong className="text-blue-900">Stock + Precio + CTRU NO se editan acá.</strong>{' '}
                Stock min/max → módulo Stock · Precio venta → Investigación · CTRU → derivado de OC.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500">
            {marketing && (
              <span className="text-purple-700 italic flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Marketing {marketing.tagline.fuente}
              </span>
            )}
            {datosCambiaronDesdeGeneracion && (
              <span className="ml-2 text-amber-700 italic flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Datos cambiaron · regenerar marketing
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
              onClick={handleGuardar}
              disabled={!sec2OK || submitting}
              className="px-4 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              {submitting ? 'Guardando...' : 'Guardar cambios'}
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
