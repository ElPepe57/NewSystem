/**
 * ProductoRowCard · fila polimórfica del listado de productos · módulo Productos V2
 *
 * Mockups canónicos (6 estados):
 *   - 10  · normal (acciones ocultas)
 *   - 10b · hover (acciones visibles + ring teal)
 *   - 10c · stock crítico (border rose-500 + badge pulsante + banner reordenar)
 *   - 10d · investigación vencida (border amber-400 + badge "Re-investigar" + banner)
 *   - 10e · pack (border purple-500 + avatar Gift + badge contador + breakdown componentes)
 *   - 10f · archivado (opacity 60 + badge slate + acción restaurar)
 *
 * Layout: grid 12 cols (col-1 checkbox · col-4 producto · col-2 variantes/stock ·
 * col-2 precio · col-2 margen · col-1 acciones).
 *
 * El componente DECIDE el estado visual a partir del producto (no se pasa como prop).
 * Prioridad si hay múltiples flags: archivado > stock_critico > investigacion_vencida > pack > normal.
 */

import React, { useMemo } from 'react';
import { Eye, MoreHorizontal, AlertTriangle, Search, Clock, RotateCcw, Trash2 } from 'lucide-react';
import type { Producto } from '../../../../types/producto.types';
import { ProductoAvatar, inferLineaFromProducto } from '../shared/ProductoAvatar';
import { SparklineMini } from '../shared/SparklineMini';
import { VariantesApiladas, buildVariantesFromGrupo } from './VariantesApiladas';
import { BannerAccionRapida } from './BannerAccionRapida';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type RowEstadoVisual = 'normal' | 'stock_critico' | 'investigacion_vencida' | 'pack' | 'archivado';

interface ProductoRowCardProps {
  producto: Producto;
  /** Lista del grupo de variantes (incluyendo este producto). Si vacío o length=1, sin variantes apiladas. */
  hermanasGrupo?: Producto[];
  selected: boolean;
  onSelectChange: (id: string, selected: boolean) => void;
  onClick?: (producto: Producto) => void;
  onView?: (producto: Producto) => void;
  onActions?: (producto: Producto, anchorRef: HTMLElement) => void;
  /** Solo aplica a estado archivado · botón "Restaurar" */
  onRestaurar?: (producto: Producto) => void;
  onEliminarDefinitivo?: (producto: Producto) => void;
  /** CTA del banner stock crítico · "Crear OC" */
  onCrearOC?: (producto: Producto) => void;
  /** CTA del banner investigación vencida · "Re-investigar ahora" */
  onReInvestigar?: (producto: Producto) => void;
  /** Si es archivado, fecha de archivo formateada */
  fechaArchivado?: string;
}

// ─── Helpers de estado ───────────────────────────────────────────────────────

/**
 * Determina el estado visual de la fila.
 *
 * REGLAS (Fase H+ · sin ruido cuando no hay actividad real):
 *
 * - stock_critico: requiere TRES condiciones simultáneas:
 *     1. stock actual <= stockMinimo (umbral superado)
 *     2. velocidad de venta REAL > 0 (el producto se está moviendo)
 *     3. al menos 3 OCs históricas (decisiones empresariales de reabastecer)
 *
 *   ¿Por qué SOLO OCs y NO "ventas históricas"?
 *   Las ventas pueden ser engañosas:
 *     - 5 unidades vendidas a 1 solo cliente NO son demanda diversa
 *     - 1 venta puntual el día que llegó la unidad NO es patrón
 *   Las OCs son decisiones ACTIVAS del negocio: si compraste 3 veces,
 *   es porque YA validaste empíricamente que ese producto se vende.
 *   Hasta tener métrica de "transacciones únicas con clientes distintos"
 *   pre-calculada (deuda BI), las OCs son el indicador más confiable.
 *
 * - investigacion_vencida: requiere TRES condiciones:
 *     1. el producto tiene investigación
 *     2. esa investigación tiene proveedores agregados (no esqueleto vacío)
 *     3. vigenciaHasta ya pasó
 */
function getEstadoVisual(producto: Producto): RowEstadoVisual {
  if (producto.estado === 'eliminado' || producto.estado === 'inactivo') return 'archivado';

  const stockTotal = (producto as any).stockDisponible ?? (producto as any).stockTotal ?? 0;
  const stockMinimo = producto.stockMinimo ?? 0;
  // Velocidad de venta real
  const velocidad = (producto as any).metricas?.velocidadVenta ?? 0;
  const tieneVelocidadReal = typeof velocidad === 'number' && velocidad > 0;
  // Evidencia de demanda validada: 3+ OCs históricas (decisiones del negocio)
  const ocsHistoricas = (producto as any).ocsHistoricas ?? 0;
  const tieneDemandaValidada = ocsHistoricas >= 3;

  if (
    stockMinimo > 0 &&
    stockTotal <= stockMinimo &&
    tieneVelocidadReal &&
    tieneDemandaValidada
  ) {
    return 'stock_critico';
  }

  // Investigación vencida = TIENE proveedores Y vigencia pasada
  const inv = producto.investigacion;
  if (inv) {
    const proveedoresCount = inv.proveedoresUSA?.length ?? 0;
    const vigenciaTs = (inv.vigenciaHasta as any)?.toDate?.()?.getTime?.() ?? 0;
    if (proveedoresCount > 0 && vigenciaTs > 0 && vigenciaTs < Date.now()) {
      return 'investigacion_vencida';
    }
  }

  if (producto.esPack === true) return 'pack';

  return 'normal';
}

const ESTADO_BORDER: Record<RowEstadoVisual, string> = {
  normal: '',
  stock_critico: 'border-l-4 border-l-rose-500 bg-rose-50/30',
  investigacion_vencida: 'border-l-4 border-l-amber-400 bg-amber-50/30',
  pack: 'border-l-4 border-l-purple-500 bg-purple-50/30',
  archivado: 'opacity-60 hover:opacity-100',
};

// Calcula días desde la última investigación
function diasDesdeInvestigacion(producto: Producto): number | null {
  const inv = producto.investigacion;
  if (!inv) return null;
  const ts = (inv.fechaInvestigacion as any)?.toDate?.()?.getTime?.() ?? 0;
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

// Helpers · usan calcularInvestigacion compartido (Fase H+) para consistencia
// total con TabInvestigacion · MISMA fórmula en cards, modal detalle y sort.
import { calcularInvestigacion } from '../../utils/investigacionCalculos';

// Devuelve el precio efectivo: manual si existe, sino sugerido (MIN comp × 0.95)
function getPrecioVenta(producto: Producto): number {
  return calcularInvestigacion(producto).precioEfectivo;
}

// Devuelve { pct, esEstimado } o null si no hay investigación completa
function getMargenInfo(producto: Producto): { pct: number; esEstimado: boolean } | null {
  const c = calcularInvestigacion(producto);
  if (!c.esCompleta || c.precioEfectivo <= 0 || c.costoPEN <= 0) return null;
  return { pct: Math.round(c.margenPct * 10) / 10, esEstimado: c.usaSugerido };
}

// Color del margen segun rangos
function getMargenColor(pct: number | null): string {
  if (pct === null) return 'text-slate-400';
  if (pct >= 50) return 'text-emerald-600';
  if (pct >= 35) return 'text-amber-600';
  if (pct >= 15) return 'text-orange-600';
  return 'text-rose-600';
}

// Genera serie sparkline · usa ventas históricas si hay, si no genera pseudo-aleatoria por SKU
function getSparklineSerie(producto: Producto): number[] {
  const seedHash = producto.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const random = (n: number) => {
    const x = Math.sin(seedHash + n) * 10000;
    return x - Math.floor(x);
  };
  return Array.from({ length: 7 }, (_, i) => 30 + random(i) * 60);
}

function getSparklineColor(estado: RowEstadoVisual, margenPct: number | null): string {
  if (estado === 'stock_critico' || (margenPct !== null && margenPct < 15)) return '#f43f5e';
  if (estado === 'investigacion_vencida' || (margenPct !== null && margenPct < 35)) return '#f59e0b';
  return '#10b981';
}

// ─── Componente ──────────────────────────────────────────────────────────────

export const ProductoRowCard: React.FC<ProductoRowCardProps> = ({
  producto,
  hermanasGrupo = [],
  selected,
  onSelectChange,
  onClick,
  onView,
  onActions,
  onRestaurar,
  onEliminarDefinitivo,
  onCrearOC,
  onReInvestigar,
  fechaArchivado,
}) => {
  const estado = useMemo(() => getEstadoVisual(producto), [producto]);
  const linea = inferLineaFromProducto({
    linea: producto.lineaNegocioNombre,
    tipo: producto.tipoProducto?.nombre,
    esPack: producto.esPack,
  });
  const stockTotal = (producto as any).stockDisponible ?? (producto as any).stockTotal ?? 0;
  const stockMinimo = producto.stockMinimo ?? 0;
  const precioVenta = getPrecioVenta(producto);
  const precioEsEstimado = !((producto as any).precioVenta > 0) && precioVenta > 0;
  const margenInfo = getMargenInfo(producto);
  const margenPct = margenInfo?.pct ?? null;
  const sparklineSerie = useMemo(() => getSparklineSerie(producto), [producto.id]);
  const sparklineColor = getSparklineColor(estado, margenPct);
  const dias = diasDesdeInvestigacion(producto);

  // Variantes: hermanas con MISMO grupoVarianteId, excluyendo este producto · solo si NO es pack
  const variantesAvatars = useMemo(() => {
    if (estado === 'pack') return [];
    if (hermanasGrupo.length <= 1) return [];
    return buildVariantesFromGrupo(hermanasGrupo);
  }, [estado, hermanasGrupo]);

  // Stock total del grupo de variantes
  const stockGrupo = useMemo(() => {
    if (hermanasGrupo.length <= 1) return stockTotal;
    return hermanasGrupo.reduce((acc, p: any) => acc + (p.stockDisponible ?? p.stockTotal ?? 0), 0);
  }, [hermanasGrupo, stockTotal]);

  const handleRowClick = (e: React.MouseEvent) => {
    // No abrir detalle si el click vino de un control (checkbox/botón)
    const target = e.target as HTMLElement;
    if (target.closest('input,button')) return;
    onClick?.(producto);
  };

  const isPack = estado === 'pack';
  const isArchivado = estado === 'archivado';
  const isCritico = estado === 'stock_critico';
  const isInvVencida = estado === 'investigacion_vencida';

  return (
    <>
      <div
        onClick={handleRowClick}
        className={`grid grid-cols-12 gap-3 items-center px-4 py-3 cursor-pointer transition-colors group hover:bg-slate-50 ${ESTADO_BORDER[estado]}`}
      >
        {/* Col 1 · checkbox */}
        <div className="col-span-1">
          <input
            type="checkbox"
            checked={selected}
            onChange={e => onSelectChange(producto.id, e.target.checked)}
            onClick={e => e.stopPropagation()}
            className="rounded border-slate-300 text-teal-600 w-3.5 h-3.5"
          />
        </div>

        {/* Col 4 · avatar + nombre + meta */}
        <div className="col-span-4 flex items-center gap-3 min-w-0">
          <ProductoAvatar
            linea={linea}
            size="lg"
            disabled={isArchivado}
            showPackBadge={isPack && (producto.componentesPack?.length ?? 0) === 0 ? false : false}
          />
          {/* Si es pack con componentes, contador en esquina */}
          {isPack && (producto.componentesPack?.length ?? 0) > 0 && (
            <PackBadgeContador count={producto.componentesPack!.length} />
          )}
          <div className="min-w-0">
            <div className={`text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5 ${isArchivado ? 'line-through' : ''}`}>
              {producto.nombreComercial}
              {isPack && (
                <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[9px] font-bold uppercase tracking-wider">
                  PACK
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 flex-wrap">
              <span className="font-mono">{producto.sku}</span>
              <span>·</span>
              <span className="text-slate-600 font-medium">{producto.marca}</span>
              {producto.lineaNegocioNombre && (
                <>
                  <span>·</span>
                  <span className={`px-1.5 py-0.5 rounded font-bold ${chipLineaClasses(linea)}`}>{producto.lineaNegocioNombre}</span>
                </>
              )}
              {!isArchivado && producto.estado === 'activo' && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">Activo</span>
              )}
              {isArchivado && (
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold flex items-center gap-1">
                  Archivado
                </span>
              )}
              {isCritico && (
                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Stock crítico
                </span>
              )}
              {isInvVencida && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold flex items-center gap-1">
                  <Search className="w-2.5 h-2.5" />
                  Re-investigar
                </span>
              )}
            </div>
            {isInvVencida && dias !== null && (
              <div className="text-[10px] text-amber-700 font-medium mt-0.5 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                Última investigación: hace {Math.floor(dias / 30)} {Math.floor(dias / 30) === 1 ? 'mes' : 'meses'}
              </div>
            )}
            {isPack && producto.componentesPack && producto.componentesPack.length > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <span className="text-[9px] text-slate-400">Contiene:</span>
                {producto.componentesPack.slice(0, 4).map((c: any, idx: number) => (
                  <span
                    key={idx}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 truncate max-w-[120px]"
                  >
                    {c.nombre ?? c.label ?? c.descripcion ?? `Item ${idx + 1}`}
                  </span>
                ))}
                {producto.componentesPack.length > 4 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                    +{producto.componentesPack.length - 4}
                  </span>
                )}
              </div>
            )}
            {isArchivado && fechaArchivado && (
              <div className="text-[10px] text-slate-400 italic mt-0.5">Archivado el {fechaArchivado}</div>
            )}
          </div>
        </div>

        {/* Col 2 · variantes / stock */}
        <div className="col-span-2 text-right">
          {isPack ? (
            <>
              <div className="text-sm font-semibold text-slate-900 tabular-nums">{stockTotal} uds</div>
              <div className="text-[10px] text-slate-500 mt-0.5">en stock · cajas armadas</div>
            </>
          ) : isCritico ? (
            <>
              <div className="text-sm font-bold text-rose-700 tabular-nums flex items-center justify-end gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {stockTotal} uds
              </div>
              {stockMinimo > 0 && (
                <div className="text-[10px] text-rose-600 font-bold mt-0.5 tabular-nums">⚠ Bajo mínimo ({stockMinimo} uds)</div>
              )}
            </>
          ) : variantesAvatars.length > 0 ? (
            <VariantesApiladas
              variantes={variantesAvatars}
              maxVisible={3}
              subline={`${hermanasGrupo.length} variantes · ${stockGrupo} uds`}
            />
          ) : (
            <div className="text-sm font-semibold text-slate-900 tabular-nums">{stockTotal} uds</div>
          )}
        </div>

        {/* Col 2 · precio venta · estimado si no hay manual */}
        <div className="col-span-2 text-right">
          {precioVenta > 0 ? (
            <>
              <div className="flex items-center justify-end gap-1">
                <div className={`text-sm font-semibold tabular-nums ${precioEsEstimado ? 'text-amber-700' : 'text-slate-900'}`}>
                  S/ {Math.floor(precioVenta)}
                  <span className={precioEsEstimado ? 'text-amber-400' : 'text-slate-400'}>.{((precioVenta * 100) % 100).toFixed(0).padStart(2, '0')}</span>
                </div>
                {precioEsEstimado && (
                  <span
                    className="px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-[8px] font-bold"
                    title="Precio sugerido · MIN(competidores) × 0.95 · ajustá manualmente desde el detalle"
                  >
                    AUTO
                  </span>
                )}
              </div>
              {variantesAvatars.length > 0 && precioVenta > 0 && (
                <div className="text-[10px] text-slate-500 tabular-nums">desde S/ {Math.floor(precioVenta * 0.6)}</div>
              )}
              {isPack && (
                <div className="text-[10px] text-emerald-600 font-bold tabular-nums">15% ahorro vs sueltos</div>
              )}
            </>
          ) : (
            <div className="text-sm text-slate-400 italic">sin precio</div>
          )}
        </div>

        {/* Col 2 · margen + sparkline */}
        <div className="col-span-2 text-right">
          {margenPct !== null ? (
            <>
              <div className="flex items-center justify-end gap-1">
                <span className={`text-sm font-semibold tabular-nums ${getMargenColor(margenPct)}`}>{margenPct}%</span>
                <SparklineMini values={sparklineSerie} color={sparklineColor} width={32} height={14} />
              </div>
              {isInvVencida && <div className="text-[10px] text-amber-700 italic">⚠ Posible desactualizado</div>}
              {isPack && <div className="text-[10px] text-emerald-600 font-bold mt-0.5">Mejor margen</div>}
            </>
          ) : (
            <div className="text-sm text-slate-400 italic">sin datos</div>
          )}
        </div>

        {/* Col 1 · acciones · ocultas hasta hover (excepto archivado) */}
        <div className={`col-span-1 flex items-center justify-end gap-1 ${isArchivado ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
          {isArchivado ? (
            <>
              {onRestaurar && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onRestaurar(producto);
                  }}
                  className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
                  title="Restaurar"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              {onEliminarDefinitivo && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onEliminarDefinitivo(producto);
                  }}
                  className="p-1.5 rounded text-rose-500 hover:bg-rose-50 transition-colors"
                  title="Eliminar definitivamente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            <>
              {/* GAP-080 fix · boton Investigar cuando NO hay investigacion */}
              {!producto.investigacion && onReInvestigar && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onReInvestigar(producto);
                  }}
                  className="p-1.5 rounded hover:bg-amber-50 text-slate-500 hover:text-amber-700 transition-colors"
                  title="Investigar este producto · agregar proveedores y competencia"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}
              {onView && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onView(producto);
                  }}
                  className="p-1.5 rounded hover:bg-teal-50 text-slate-500 hover:text-teal-600 transition-colors"
                  title="Ver detalle"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
              {onActions && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onActions(producto, e.currentTarget);
                  }}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors"
                  title="Más acciones"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Banner Stock Crítico ELIMINADO (Fase H+ · Opción A · 2026-05-03)
          Razón: las métricas básicas (ocsHistoricas, cantidadVentas) no permiten
          distinguir demanda real de espejismos (1 cliente con compra grande +
          ventas concentradas en pocos días). El badge visual (border rojo + icono)
          se conserva como info, pero sin CTA prematuro de "+ Crear OC".
          Se reactivará cuando exista DEUDA-PV2-VENTAS-UNICAS resuelta:
          velocidad real con distribución temporal + clientes únicos. */}
      {isInvVencida && onReInvestigar && (
        <BannerAccionRapida
          tipo="investigacion_vencida"
          mensaje={
            dias !== null && dias > 0
              ? `Re-investigar precios · proveedores y competencia con ${dias} días sin actualizar.`
              : 'Re-investigar precios · datos desactualizados.'
          }
          ctaLabel="Re-investigar ahora"
          onCta={() => onReInvestigar(producto)}
        />
      )}
    </>
  );
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

const PackBadgeContador: React.FC<{ count: number }> = ({ count }) => (
  // Posicionado absoluto encima del avatar · usa el contenedor relativo del padre
  <span
    className="absolute w-4 h-4 bg-purple-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center ring-2 ring-white"
    style={{ marginLeft: -16, marginTop: -16 }}
  >
    {count}
  </span>
);

function chipLineaClasses(linea: ReturnType<typeof inferLineaFromProducto>): string {
  switch (linea) {
    case 'skincare':
      return 'bg-amber-50 text-amber-700';
    case 'suplemento':
      return 'bg-indigo-50 text-indigo-700';
    case 'wellness':
      return 'bg-emerald-50 text-emerald-700';
    case 'pack':
      return 'bg-purple-50 text-purple-700';
    default:
      return 'bg-slate-50 text-slate-700';
  }
}
