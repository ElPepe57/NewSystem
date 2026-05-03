/**
 * ProductoDetailModal · Modal de detalle producto · F6(A) + F12 Responsive
 *
 * Mockup canónico desktop: docs/mockups/productos/11-modal-detalle-info.html
 * Mockup canónico mobile:  docs/mockups/productos/11m-modal-detalle-mobile.html
 *
 * Layout:
 *   DESKTOP (≥lg): Modal centrado max-w-6xl con backdrop oscuro · max-h 90vh
 *   MOBILE  (<lg): Bottom sheet 90vh con drag handle · drag-to-close (futuro)
 *
 * Cierre: X · ESC · click backdrop
 *
 * Tabs (Fase 4 · 3 visibles · resto disabled hasta Fase 5+):
 *   - Resumen (default · #11 · activo · Fase 4)
 *   - Variantes (#12 · activo · Fase 4)
 *   - Stock (#15 · activo · Fase 4)
 *   - Investigación (#13 · disabled hasta Fase 5)
 *   - Histórico (#15b · disabled hasta Fase 5)
 *   - Pipeline (#15c · disabled hasta Fase 5)
 *   - Componentes (#14 · disabled hasta Fase 6 · solo si esPack)
 *
 * Header gradient sutil canónico (F6.1) + acciones (Editar + dropdown "...")
 * KPI row con 4 KPIs (Precio · Margen · Stock · Ventas mes)
 * Tabs sticky con scroll horizontal en mobile + chevron + edge fade (F12)
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  X,
  Edit2,
  MoreHorizontal,
  LayoutGrid,
  GitBranch,
  Search,
  Warehouse,
  GitCommit,
  Package2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import type { Producto, InvestigacionFormData } from '../../../../types/producto.types';
import { ProductoAvatar, inferLineaFromProducto } from '../shared/ProductoAvatar';
import { SparklineMini } from '../shared/SparklineMini';
import { TabResumen } from './TabResumen';
import { TabVariantes } from './TabVariantes';
import { TabStock } from './TabStock';
import { TabInvestigacion } from './TabInvestigacion';
import { TabHistorico } from './TabHistorico';
import { TabPipeline } from './TabPipeline';
import { TabComponentes } from './TabComponentes';
import { ProveedorFormModal, type ProveedorInvestigacionFormValue } from '../modals/investigacion/ProveedorFormModal';
import { CompetidorFormModal, type CompetidorInvestigacionFormValue } from '../modals/investigacion/CompetidorFormModal';
import { AjustarPrecioModal } from '../modals/AjustarPrecioModal';
import { useTipoCambio } from '../../../../hooks/useTipoCambio';
import { useAuthStore } from '../../../../store/authStore';
import { useToastStore } from '../../../../store/toastStore';
import { ProductoService } from '../../../../services/producto.service';
import { useProductoStore } from '../../../../store/productoStore';

interface ProductoDetailModalProps {
  open: boolean;
  producto: Producto | null;
  hermanasGrupo?: Producto[];
  onClose: () => void;
  onEdit?: (producto: Producto) => void;
  onArchivar?: (producto: Producto) => void;
  onDuplicar?: (producto: Producto) => void;
  onAgregarVariante?: (producto: Producto) => void;
  /** GAP-021 fix · permite que TabInvestigacion abra el modal #24 */
  onAbrirInvestigacion?: (producto: Producto) => void;
}

/**
 * Hook · resuelve siempre la versión MÁS FRESCA del producto desde el store
 * para evitar stale state cuando se actualizan datos (ej. agregar proveedor
 * desde TabInvestigacion sin tener que cerrar/reabrir el modal).
 */
function useProductoFresco(productoOriginal: Producto | null): Producto | null {
  // Suscripción reactiva a la lista del store · re-renderiza cuando cambia
  const productosLista = useProductoStore(s => s.productos);
  if (!productoOriginal) return null;
  const fresco = productosLista.find(p => p.id === productoOriginal.id);
  return fresco ?? productoOriginal;
}

type TabKey = 'resumen' | 'variantes' | 'investigacion' | 'stock' | 'historico' | 'pipeline' | 'componentes';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: typeof LayoutGrid;
  enabled: boolean;
  badge?: { text: string; variant: 'amber' | 'slate' };
  visible?: (p: Producto) => boolean;
}

function getTabsConfig(producto: Producto): TabConfig[] {
  const variantesCount = (producto as any).variantesCount ?? 0;
  const investigacionNuevos = producto.investigacion?.proveedoresUSA?.length ?? 0;
  return [
    { key: 'resumen', label: 'Resumen', icon: LayoutGrid, enabled: true },
    {
      key: 'variantes',
      label: 'Variantes',
      icon: GitBranch,
      enabled: true,
      badge: variantesCount > 0 ? { text: `${variantesCount}`, variant: 'slate' } : undefined,
    },
    {
      key: 'investigacion',
      label: 'Investigación',
      icon: Search,
      enabled: true, // Fase 5
      badge: investigacionNuevos > 0 ? { text: `${investigacionNuevos}`, variant: 'amber' } : undefined,
    },
    { key: 'stock', label: 'Stock', icon: Warehouse, enabled: true },
    { key: 'historico', label: 'Histórico', icon: GitCommit, enabled: true }, // Fase 5
    { key: 'pipeline', label: 'Pipeline', icon: TrendingUp, enabled: true }, // Fase 5
    {
      key: 'componentes',
      label: 'Componentes',
      icon: Package2,
      enabled: true, // Fase 6
      visible: (p: Producto) => p.esPack === true,
    },
  ];
}

function getPrecioVenta(p: Producto): number {
  return (p as any).precioVenta ?? p.investigacion?.precioSugeridoCalculado ?? 0;
}

function getMargenPct(p: Producto): number | null {
  const precio = getPrecioVenta(p);
  const ctru = p.investigacion?.ctruEstimado ?? p.ctruPromedio ?? 0;
  if (precio <= 0 || ctru <= 0) return null;
  return Math.round(((precio - ctru) / precio) * 100);
}

function getStock(p: Producto): number {
  return (p as any).stockDisponible ?? (p as any).stockTotal ?? 0;
}

export const ProductoDetailModal: React.FC<ProductoDetailModalProps> = ({
  open,
  producto: productoProp,
  hermanasGrupo = [],
  onClose,
  onEdit,
  onArchivar,
  onDuplicar,
  onAgregarVariante,
  onAbrirInvestigacion,
}) => {
  // Resolver siempre la versión más fresca del producto desde el store
  // para reflejar cambios sin tener que cerrar/reabrir el modal (ej. agregar
  // proveedor/competidor, ajustar precio, marcar revisada, auto-save flete).
  const producto = useProductoFresco(productoProp);

  const [activeTab, setActiveTab] = useState<TabKey>('resumen');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Reset tab cuando cambia el producto
  useEffect(() => {
    if (open) setActiveTab('resumen');
  }, [open, producto?.id]);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Cerrar menu "..." con outside click
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoreMenu]);

  // Hooks SIEMPRE antes del early return · Rules of Hooks
  // Sparkline data (placeholder · Fase 5 traerá real)
  const sparkline = useMemo(() => {
    if (!producto) return [];
    const seedHash = producto.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return Array.from({ length: 7 }, (_, i) => 30 + ((Math.sin(seedHash + i) + 1) / 2) * 50);
  }, [producto?.id]);

  // ─── Fase F · Investigación V2 · sub-modales + auto-save ───────────────────
  const user = useAuthStore(s => s.user);
  const toast = useToastStore();
  const { tc, loading: tcLoading } = useTipoCambio();
  const { fetchProductos } = useProductoStore();

  // Estado sub-modales investigación
  const [provModalOpen, setProvModalOpen] = useState(false);
  const [provModalValor, setProvModalValor] = useState<ProveedorInvestigacionFormValue | null>(null);
  const [compModalOpen, setCompModalOpen] = useState(false);
  const [compModalValor, setCompModalValor] = useState<CompetidorInvestigacionFormValue | null>(null);
  const [precioModalOpen, setPrecioModalOpen] = useState(false);
  const [precioModalCtx, setPrecioModalCtx] = useState({
    costoUnitarioPEN: 0,
    precioSugeridoPEN: 0,
    rangoCompetencia: { min: 0, max: 0, total: 0 },
  });

  // Helper · construye snapshot completo de investigación a partir del producto + cambios
  const buildInvestigacionData = (producto: Producto): InvestigacionFormData => {
    const inv = producto.investigacion;
    return {
      proveedoresUSA: (inv?.proveedoresUSA ?? []).map(p => ({
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        impuesto: p.impuesto,
        url: p.url,
        disponibilidad: p.disponibilidad,
        envioEstimado: p.envioEstimado,
        notas: p.notas,
      })),
      competidoresPeru: (inv?.competidoresPeru ?? []).map(c => ({
        id: c.id,
        competidorId: (c as any).competidorId,
        nombre: c.nombre,
        plataforma: c.plataforma,
        precio: c.precio,
        url: c.url,
        ventas: c.ventas,
        reputacion: c.reputacion,
        esLiderCategoria: c.esLiderCategoria,
        notas: c.notas,
      })),
      presenciaML: inv?.presenciaML ?? false,
      nivelCompetencia: inv?.nivelCompetencia ?? 'media',
      ventajasCompetitivas: inv?.ventajasCompetitivas,
      logisticaEstimada: inv?.logisticaEstimada,
      demandaEstimada: inv?.demandaEstimada ?? 'media',
      tendencia: inv?.tendencia ?? 'estable',
      volumenMercadoEstimado: inv?.volumenMercadoEstimado,
      recomendacion: inv?.recomendacion ?? 'investigar_mas',
      razonamiento: inv?.razonamiento,
      notas: inv?.notas,
    };
  };

  // ─── Handlers · CRUD Proveedor ────────────────────────────────────────────
  const handleAgregarProveedor = () => {
    setProvModalValor(null);
    setProvModalOpen(true);
  };
  const handleEditarProveedor = (valor: ProveedorInvestigacionFormValue) => {
    setProvModalValor(valor);
    setProvModalOpen(true);
  };
  const handleGuardarProveedor = async (valor: ProveedorInvestigacionFormValue) => {
    if (!producto || !user) return;
    try {
      const data = buildInvestigacionData(producto);
      const nuevoProv = {
        id: valor.id,
        nombre: valor.proveedorNombre || 'Sin nombre',
        precio: valor.costoUnitarioUSD,
        impuesto: valor.taxValor,
        url: valor.url,
        notas: valor.notas,
      };
      const idx = data.proveedoresUSA.findIndex(p => p.id === valor.id);
      if (idx >= 0) data.proveedoresUSA[idx] = { ...data.proveedoresUSA[idx], ...nuevoProv };
      else data.proveedoresUSA.push(nuevoProv);

      // Orden correcto: persistir → refrescar store → cerrar modal → toast
      // Si falla cualquier paso, propagamos el error para que el modal hijo
      // restaure su botón "Guardar" y el usuario pueda reintentar.
      await ProductoService.guardarInvestigacion(producto.id, data, user.uid, tc?.venta);
      await fetchProductos();
      setProvModalOpen(false);
      toast.success('Proveedor guardado · investigación actualizada');
    } catch (err: any) {
      toast.error(`Error al guardar proveedor: ${err?.message ?? 'desconocido'}`);
      throw err; // restaura el botón en el modal hijo
    }
  };

  // ─── Handlers · CRUD Competidor ───────────────────────────────────────────
  const handleAgregarCompetidor = () => {
    setCompModalValor(null);
    setCompModalOpen(true);
  };
  const handleEditarCompetidor = (valor: CompetidorInvestigacionFormValue) => {
    setCompModalValor(valor);
    setCompModalOpen(true);
  };
  const handleGuardarCompetidor = async (valor: CompetidorInvestigacionFormValue) => {
    if (!producto || !user) return;
    try {
      const data = buildInvestigacionData(producto);
      const nuevoComp = {
        id: valor.id,
        competidorId: valor.competidorId,
        nombre: valor.competidorNombre || 'Sin nombre',
        plataforma: (valor.plataformaSeleccionada as any) ?? 'web_propia',
        precio: valor.precioPEN,
        url: valor.url,
        notas: valor.notas,
      };
      const idx = data.competidoresPeru.findIndex(c => c.id === valor.id);
      if (idx >= 0) data.competidoresPeru[idx] = { ...data.competidoresPeru[idx], ...nuevoComp };
      else data.competidoresPeru.push(nuevoComp);

      // Mismo orden y propagación de error que en handleGuardarProveedor
      await ProductoService.guardarInvestigacion(producto.id, data, user.uid, tc?.venta);
      await fetchProductos();
      setCompModalOpen(false);
      toast.success('Competidor guardado · investigación actualizada');
    } catch (err: any) {
      toast.error(`Error al guardar competidor: ${err?.message ?? 'desconocido'}`);
      throw err; // restaura el botón en el modal hijo
    }
  };

  // ─── Handlers · Auto-save flete + notas ───────────────────────────────────
  const handleActualizarFlete = async (fleteUSD: number) => {
    if (!producto) return;
    try {
      await ProductoService.update(producto.id, { costoFleteInternacional: fleteUSD } as any);
      await fetchProductos();
    } catch (err: any) {
      toast.error(`Error al guardar flete: ${err?.message ?? 'desconocido'}`);
      throw err;
    }
  };
  const handleActualizarNotas = async (notas: string) => {
    if (!producto || !user) return;
    try {
      const data = buildInvestigacionData(producto);
      data.notas = notas;
      await ProductoService.guardarInvestigacion(producto.id, data, user.uid, tc?.venta);
      await fetchProductos();
    } catch (err: any) {
      console.error('[ProductoDetailModal] error guardando notas', err);
    }
  };

  // ─── Handlers · Acciones del footer ───────────────────────────────────────
  const handleMarcarRevisada = async () => {
    if (!producto || !user) return;
    try {
      const data = buildInvestigacionData(producto);
      // guardarInvestigacion ya actualiza fechaInvestigacion + vigenciaHasta a +60d
      await ProductoService.guardarInvestigacion(producto.id, data, user.uid, tc?.venta);
      toast.success('Investigación marcada como revisada · vigencia renovada');
      await fetchProductos();
    } catch (err: any) {
      toast.error(`Error al marcar revisada: ${err?.message ?? 'desconocido'}`);
    }
  };
  const handleAbrirAjustarPrecio = (ctx: typeof precioModalCtx) => {
    setPrecioModalCtx(ctx);
    setPrecioModalOpen(true);
  };
  const handleGuardarPrecio = async (precio: number, _motivo?: string) => {
    if (!producto) return;
    try {
      // El campo precioVenta no es nativo de ProductoFormData · va por any
      await ProductoService.update(producto.id, { precioVenta: precio } as any);
      toast.success(`Precio actualizado: S/ ${precio.toFixed(2)}`);
      setPrecioModalOpen(false);
      await fetchProductos();
      // TODO: registrar motivo en historial cuando exista módulo de auditoría de precios
    } catch (err: any) {
      toast.error(`Error al actualizar precio: ${err?.message ?? 'desconocido'}`);
      throw err;
    }
  };

  if (!open || !producto) return null;

  const tabsConfig = getTabsConfig(producto).filter(t => !t.visible || t.visible(producto));
  const linea = inferLineaFromProducto({
    linea: producto.lineaNegocioNombre,
    tipo: producto.tipoProducto?.nombre,
    esPack: producto.esPack,
  });
  const precioVenta = getPrecioVenta(producto);
  const margenPct = getMargenPct(producto);
  const stockTotal = getStock(producto);
  const stockTransito = (producto as any).stockTransito ?? 0;
  const ventasMes = (producto as any).ventasMes ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        aria-label="Cerrar modal"
      />

      {/* Modal · centered desktop / bottom sheet mobile */}
      <div className="relative w-full lg:w-auto lg:max-w-6xl lg:mx-auto bg-white lg:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] lg:max-h-[90vh]">
        {/* Drag handle (solo mobile) */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* ═══════ HEADER · gradient sutil F6.1 ═══════ */}
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-4 lg:px-6 py-3 lg:py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 lg:gap-3 min-w-0 flex-1">
              <ProductoAvatar linea={linea} size="lg" />
              <div className="min-w-0">
                <div className="text-[10px] lg:text-[11px] text-slate-500 flex items-center gap-1.5 lg:gap-2 mb-0.5 flex-wrap">
                  <span className="font-mono">{producto.sku}</span>
                  <span>·</span>
                  <span className="truncate">{producto.marca}</span>
                  {producto.estado === 'activo' && (
                    <>
                      <span className="hidden sm:inline">·</span>
                      <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                        Activo
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-base lg:text-xl font-bold text-slate-900 leading-tight">
                  {producto.nombreComercial}
                </h2>
                {producto.tipoProducto?.nombre && (
                  <p className="text-[10px] lg:text-xs text-slate-500 mt-0.5 truncate">
                    {producto.tipoProducto.nombre}
                  </p>
                )}
              </div>
            </div>

            {/* Acciones header */}
            <div className="flex items-center gap-1 lg:gap-1.5 flex-shrink-0">
              {/* Desktop: Editar + ... + X | Mobile: Editar full + ... + X */}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(producto)}
                  className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar
                </button>
              )}
              <div ref={moreMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowMoreMenu(v => !v)}
                  className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
                  title="Más acciones"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[200px] z-30">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          onEdit(producto);
                          setShowMoreMenu(false);
                        }}
                        className="lg:hidden w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Editar
                      </button>
                    )}
                    {onAgregarVariante && (
                      <button
                        type="button"
                        onClick={() => {
                          onAgregarVariante(producto);
                          setShowMoreMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-2"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        Nueva variante
                      </button>
                    )}
                    {onDuplicar && (
                      <button
                        type="button"
                        onClick={() => {
                          onDuplicar(producto);
                          setShowMoreMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        Duplicar producto
                      </button>
                    )}
                    {onArchivar && (
                      <>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          type="button"
                          onClick={() => {
                            onArchivar(producto);
                            setShowMoreMenu(false);
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                        >
                          Archivar producto
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ═══════ KPI ROW · 4 KPIs (oculto si no hay datos) ═══════ */}
        {(precioVenta > 0 || stockTotal > 0 || ventasMes > 0) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-slate-200 lg:divide-x divide-slate-200 flex-shrink-0">
            <div className="p-3 lg:p-4 border-r border-b lg:border-b-0 border-slate-200 lg:border-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Precio venta</div>
              {precioVenta > 0 ? (
                <>
                  <div className="text-lg lg:text-xl font-bold text-slate-900 tabular-nums tracking-tight">
                    S/ {Math.floor(precioVenta)}
                    <span className="text-sm lg:text-base text-slate-400 font-normal">
                      .{((precioVenta * 100) % 100).toFixed(0).padStart(2, '0')}
                    </span>
                  </div>
                  {hermanasGrupo.length > 1 && (
                    <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                      desde S/ {Math.floor(precioVenta * 0.5)}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-slate-400 italic">sin precio</div>
              )}
            </div>
            <div className="p-3 lg:p-4 border-b lg:border-b-0 border-slate-200">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Margen</div>
              {margenPct !== null ? (
                <div className="flex items-end justify-between">
                  <div className="text-lg lg:text-xl font-bold text-emerald-600 tabular-nums tracking-tight">
                    {margenPct}
                    <span className="text-sm lg:text-base text-emerald-300 font-normal">%</span>
                  </div>
                  <SparklineMini values={sparkline} color="#10b981" width={40} height={18} />
                </div>
              ) : (
                <div className="text-sm text-slate-400 italic">sin datos</div>
              )}
            </div>
            <div className="p-3 lg:p-4 border-r lg:border-0 border-slate-200">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Stock total</div>
              <div className="text-lg lg:text-xl font-bold text-slate-900 tabular-nums tracking-tight">
                {stockTotal} uds
              </div>
              {stockTransito > 0 && (
                <div className="text-[11px] text-amber-600 tabular-nums mt-0.5">{stockTransito} en tránsito</div>
              )}
            </div>
            <div className="p-3 lg:p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Ventas mes</div>
              <div className="text-lg lg:text-xl font-bold text-slate-900 tabular-nums tracking-tight">{ventasMes} uds</div>
            </div>
          </div>
        )}

        {/* ═══════ TABS · scroll horizontal mobile con chevron + edge fade ═══════ */}
        <div className="border-b border-slate-200 bg-slate-50/30 flex-shrink-0 relative">
          <div className="overflow-x-auto scrollbar-hide fade-x-edges">
            <div className="flex items-center gap-0 px-2 lg:px-4 min-w-max">
              {tabsConfig.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => tab.enabled && setActiveTab(tab.key)}
                    disabled={!tab.enabled}
                    className={`px-3 lg:px-4 py-2.5 lg:py-3 text-xs lg:text-sm font-medium border-b-2 flex items-center gap-1.5 lg:gap-2 whitespace-nowrap transition-colors ${
                      isActive
                        ? 'border-teal-600 text-teal-700 font-bold'
                        : tab.enabled
                        ? 'border-transparent text-slate-500 hover:text-slate-700'
                        : 'border-transparent text-slate-300 cursor-not-allowed'
                    }`}
                    title={tab.enabled ? '' : 'Disponible próximamente'}
                  >
                    <Icon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                    {tab.label}
                    {tab.badge && (
                      <span
                        className={`text-[9px] lg:text-[10px] tabular-nums px-1 lg:px-1.5 py-0.5 rounded-full font-bold ${
                          tab.badge.variant === 'amber'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {tab.badge.text}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Chevron derecho · solo mobile (lg:hidden) */}
          <div className="lg:hidden absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center w-6 h-6 bg-gradient-to-l from-slate-50 via-slate-50/80 to-transparent">
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* ═══════ CONTENIDO TAB · scrolleable ═══════ */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30">
          {activeTab === 'resumen' && <TabResumen producto={producto} />}
          {activeTab === 'variantes' && (
            <TabVariantes
              producto={producto}
              hermanasGrupo={hermanasGrupo}
              onAgregarVariante={onAgregarVariante ? () => onAgregarVariante(producto) : undefined}
            />
          )}
          {activeTab === 'investigacion' && (
            <TabInvestigacion
              producto={producto}
              tcVenta={tc?.venta}
              tcLoading={tcLoading}
              onAgregarProveedor={handleAgregarProveedor}
              onEditarProveedor={handleEditarProveedor}
              onAgregarCompetidor={handleAgregarCompetidor}
              onEditarCompetidor={handleEditarCompetidor}
              onActualizarFlete={handleActualizarFlete}
              onActualizarNotas={handleActualizarNotas}
              onMarcarRevisada={handleMarcarRevisada}
              onAbrirAjustarPrecio={handleAbrirAjustarPrecio}
              onIniciarInvestigacion={onAbrirInvestigacion ? () => onAbrirInvestigacion(producto) : handleAgregarProveedor}
            />
          )}
          {activeTab === 'stock' && <TabStock producto={producto} hermanasGrupo={hermanasGrupo} />}
          {activeTab === 'historico' && <TabHistorico producto={producto} />}
          {activeTab === 'pipeline' && <TabPipeline producto={producto} />}
          {activeTab === 'componentes' && <TabComponentes producto={producto} />}
        </div>

        {/* ═══════ FOOTER ═══════ */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 lg:px-6 py-2.5 lg:py-3 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* ─── Sub-modales · Fase F · Investigación V2 ─────────────────────── */}
      <ProveedorFormModal
        open={provModalOpen}
        valor={provModalValor}
        productoSku={producto.sku}
        productoNombre={producto.nombreComercial}
        productoPaisOrigen={producto.paisOrigen}
        productoLineaNegocioId={producto.lineaNegocioId}
        productoLineaNegocioNombre={producto.lineaNegocioNombre}
        modo={provModalValor ? 'editar' : 'crear'}
        onClose={() => setProvModalOpen(false)}
        onGuardar={handleGuardarProveedor}
      />
      <CompetidorFormModal
        open={compModalOpen}
        valor={compModalValor}
        productoSku={producto.sku}
        productoNombre={producto.nombreComercial}
        productoLineaNegocioId={producto.lineaNegocioId}
        productoLineaNegocioNombre={producto.lineaNegocioNombre}
        tuPrecioPEN={getPrecioVenta(producto)}
        modo={compModalValor ? 'editar' : 'crear'}
        onClose={() => setCompModalOpen(false)}
        onGuardar={handleGuardarCompetidor}
      />
      <AjustarPrecioModal
        open={precioModalOpen}
        producto={producto}
        costoUnitarioPEN={precioModalCtx.costoUnitarioPEN}
        precioSugeridoPEN={precioModalCtx.precioSugeridoPEN}
        rangoCompetencia={precioModalCtx.rangoCompetencia}
        onClose={() => setPrecioModalOpen(false)}
        onSave={handleGuardarPrecio}
      />
    </div>
  );
};

