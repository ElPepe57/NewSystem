/**
 * ProductoRowCardMobile · Card apilada vertical para viewport <1024px
 *
 * Mockup canónico: docs/mockups/productos/10m-card-row-mobile.html (6 estados)
 *                  docs/mockups/productos/01m-page-listado-mobile.html (lista completa)
 *
 * F12 · Tabla → Cards apiladas verticales en mobile/tablet (Stripe pattern).
 *
 * 3 zonas verticales claras:
 *   ZONA 1 · Identidad: avatar + nombre + sub-id + chips (línea/estado/alertas)
 *   ZONA 2 · Métricas: 3 cols (Stock · Precio · Margen) en grid compacto
 *   BANNER · contextual condicional (stock_critico · investigacion_vencida)
 *   ZONA 3 · Acción: botón "Ver detalle" full-width (touch target ≥44px)
 *
 * Reusa la lógica de derivación de estado de ProductoRowCard (desktop):
 *   - getEstadoVisual()
 *   - getPrecioVenta() · getMargenPct()
 *   - inferLineaFromProducto()
 */

import React, { useMemo } from 'react';
import { Eye, AlertTriangle, Search, Clock, Check, RotateCcw, Trash2 } from 'lucide-react';
import type { Producto } from '../../../../types/producto.types';
import { ProductoAvatar, inferLineaFromProducto } from '../shared/ProductoAvatar';
import { SparklineMini } from '../shared/SparklineMini';

export type RowEstadoVisualMobile =
  | 'normal'
  | 'stock_critico'
  | 'investigacion_vencida'
  | 'pack'
  | 'archivado';

interface ProductoRowCardMobileProps {
  producto: Producto;
  hermanasGrupo?: Producto[];
  selected: boolean;
  onSelectChange: (id: string, selected: boolean) => void;
  onClick?: (producto: Producto) => void;
  onView?: (producto: Producto) => void;
  onCrearOC?: (producto: Producto) => void;
  onReInvestigar?: (producto: Producto) => void;
  onRestaurar?: (producto: Producto) => void;
  onEliminarDefinitivo?: (producto: Producto) => void;
  fechaArchivado?: string;
}

// ─── Helpers (reusa lógica de ProductoRowCard desktop) ───────────────────────

// Fase H+ · sin ruido cuando no hay actividad real (ver doc en ProductoRowCard.tsx)
// Anti-espejismo: stock_critico requiere 3+ OCs históricas
// (las ventas pueden ser engañosas · 5 uds a 1 cliente NO es demanda diversa)
function getEstadoVisual(producto: Producto): RowEstadoVisualMobile {
  if (producto.estado === 'eliminado' || producto.estado === 'inactivo') return 'archivado';

  const stockTotal = (producto as any).stockDisponible ?? (producto as any).stockTotal ?? 0;
  const stockMinimo = producto.stockMinimo ?? 0;
  const velocidad = (producto as any).metricas?.velocidadVenta ?? 0;
  const tieneVelocidadReal = typeof velocidad === 'number' && velocidad > 0;
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

function diasDesdeInvestigacion(producto: Producto): number | null {
  const inv = producto.investigacion;
  if (!inv) return null;
  const ts = (inv.fechaInvestigacion as any)?.toDate?.()?.getTime?.() ?? 0;
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

// Helpers · usan calcularInvestigacion compartido (Fase H+) · MISMA fórmula
// que TabInvestigacion + ProductoRowCard desktop + sort comparators.
import { calcularInvestigacion } from '../../utils/investigacionCalculos';

function getPrecioVenta(producto: Producto): number {
  return calcularInvestigacion(producto).precioEfectivo;
}

function getMargenPct(producto: Producto): number | null {
  const c = calcularInvestigacion(producto);
  if (!c.esCompleta || c.precioEfectivo <= 0 || c.costoPEN <= 0) return null;
  return Math.round(c.margenPct * 10) / 10;
}

function getMargenColor(pct: number | null): string {
  if (pct === null) return 'text-slate-400';
  if (pct >= 50) return 'text-emerald-600';
  if (pct >= 35) return 'text-amber-600';
  if (pct >= 15) return 'text-orange-600';
  return 'text-rose-600';
}

function getSparklineSerie(producto: Producto): number[] {
  const seedHash = producto.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const random = (n: number) => {
    const x = Math.sin(seedHash + n) * 10000;
    return x - Math.floor(x);
  };
  return Array.from({ length: 5 }, (_, i) => 30 + random(i) * 60);
}

const ESTADO_BORDER_BG: Record<RowEstadoVisualMobile, string> = {
  normal: '',
  stock_critico: 'border-l-4 border-l-rose-500 bg-rose-50/30',
  investigacion_vencida: 'border-l-4 border-l-amber-400 bg-amber-50/30',
  pack: 'border-l-4 border-l-purple-500 bg-purple-50/30',
  archivado: '',
};

// ─── Componente principal ────────────────────────────────────────────────────

export const ProductoRowCardMobile: React.FC<ProductoRowCardMobileProps> = ({
  producto,
  hermanasGrupo = [],
  selected,
  onSelectChange,
  onClick,
  onView,
  onCrearOC,
  onReInvestigar,
  onRestaurar,
  onEliminarDefinitivo,
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
  const margenPct = getMargenPct(producto);
  const sparklineSerie = useMemo(() => getSparklineSerie(producto), [producto.id]);
  const dias = diasDesdeInvestigacion(producto);

  const isPack = estado === 'pack';
  const isArchivado = estado === 'archivado';
  const isCritico = estado === 'stock_critico';
  const isInvVencida = estado === 'investigacion_vencida';
  const isSelected = selected;

  // Stock total del grupo de variantes
  const stockGrupo = useMemo(() => {
    if (hermanasGrupo.length <= 1) return stockTotal;
    return hermanasGrupo.reduce((acc, p: any) => acc + (p.stockDisponible ?? p.stockTotal ?? 0), 0);
  }, [hermanasGrupo, stockTotal]);

  // Estilo del wrapper · prioridad: archivado > seleccionado > estado coloreado
  const wrapperClasses = isSelected
    ? 'bg-white border-2 border-teal-300 ring-2 ring-teal-100 rounded-xl overflow-hidden shadow-sm'
    : isArchivado
    ? 'bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm opacity-70 hover:opacity-100 transition-opacity'
    : 'bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm';

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input,button,a')) return;
    onClick?.(producto);
  };

  return (
    <div className={wrapperClasses}>
      {/* ═══════════ ZONA 1 · IDENTIDAD ═══════════ */}
      <div
        onClick={handleCardClick}
        className={`px-3 py-3 flex items-start gap-2.5 cursor-pointer ${ESTADO_BORDER_BG[estado]} ${isSelected ? 'bg-teal-50/30' : ''}`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={e => onSelectChange(producto.id, e.target.checked)}
          onClick={e => e.stopPropagation()}
          className="mt-1 rounded border-slate-300 text-teal-600 w-4 h-4"
        />

        <div className="relative flex-shrink-0">
          <ProductoAvatar linea={linea} size="md" disabled={isArchivado} />
          {isPack && (producto.componentesPack?.length ?? 0) > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
              {producto.componentesPack!.length}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-semibold text-slate-900 truncate flex items-center gap-1 ${
              isArchivado ? 'line-through' : ''
            }`}
          >
            {producto.nombreComercial}
            {isPack && (
              <span className="px-1 py-0.5 rounded bg-purple-100 text-purple-700 text-[8px] font-bold uppercase tracking-wider flex-shrink-0">
                PACK
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            <span className="font-mono">{producto.sku}</span>
            {producto.marca && (
              <>
                {' · '}
                {producto.marca}
              </>
            )}
          </div>

          {/* Chips de estado/alertas */}
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {producto.lineaNegocioNombre && (
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${chipLineaClasses(linea)}`}>
                {producto.lineaNegocioNombre}
              </span>
            )}
            {!isArchivado && producto.estado === 'activo' && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold">Activo</span>
            )}
            {isCritico && (
              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-2.5 h-2.5" />
                Stock crítico
              </span>
            )}
            {isInvVencida && (
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold flex items-center gap-1">
                <Search className="w-2.5 h-2.5" />
                Re-investigar
              </span>
            )}
            {isArchivado && (
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold flex items-center gap-1">
                Archivado
              </span>
            )}
            {isSelected && (
              <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[9px] font-bold flex items-center gap-1">
                <Check className="w-2.5 h-2.5" />
                Seleccionado
              </span>
            )}
          </div>

          {/* Sub-info contextual · investigación o archivado */}
          {isInvVencida && dias !== null && (
            <div className="text-[10px] text-amber-700 font-medium mt-1 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              Última inv: hace {Math.floor(dias / 30)} {Math.floor(dias / 30) === 1 ? 'mes' : 'meses'}
            </div>
          )}
          {isArchivado && fechaArchivado && (
            <div className="text-[10px] text-slate-400 italic mt-0.5">Archivado el {fechaArchivado}</div>
          )}

          {/* Pack: breakdown de componentes */}
          {isPack && producto.componentesPack && producto.componentesPack.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <span className="text-[9px] text-slate-400">Contiene:</span>
              {producto.componentesPack.slice(0, 3).map((c: any, idx: number) => (
                <span
                  key={idx}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 truncate max-w-[100px]"
                >
                  {c.nombre ?? c.label ?? c.descripcion ?? `Item ${idx + 1}`}
                </span>
              ))}
              {producto.componentesPack.length > 3 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                  +{producto.componentesPack.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ ZONA 2 · MÉTRICAS (3 cols compactas) ═══════════ */}
      {!isArchivado && (
        <div className="grid grid-cols-3 gap-2 px-3 py-2.5 bg-slate-50 border-t border-slate-100">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Stock</div>
            {isCritico ? (
              <>
                <div className="text-sm font-bold text-rose-700 tabular-nums flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {stockTotal}
                </div>
                {stockMinimo > 0 && <div className="text-[9px] text-rose-600 font-bold">de {stockMinimo} mín</div>}
              </>
            ) : isPack ? (
              <>
                <div className="text-sm font-bold text-slate-900 tabular-nums">{stockTotal}</div>
                <div className="text-[9px] text-slate-500">cajas</div>
              </>
            ) : hermanasGrupo.length > 1 ? (
              <>
                <div className="text-sm font-bold text-slate-900 tabular-nums">{stockGrupo}</div>
                <div className="text-[9px] text-slate-500">{hermanasGrupo.length} variantes</div>
              </>
            ) : (
              <>
                <div className="text-sm font-bold text-slate-900 tabular-nums">{stockTotal}</div>
                <div className="text-[9px] text-slate-500">uds</div>
              </>
            )}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Precio</div>
            {precioVenta > 0 ? (
              <>
                <div className="text-sm font-bold text-slate-900 tabular-nums">S/ {Math.round(precioVenta)}</div>
                {isPack && <div className="text-[9px] text-emerald-600 font-bold">15% ahorro</div>}
              </>
            ) : (
              <div className="text-sm text-slate-400 italic">sin precio</div>
            )}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Margen</div>
            {margenPct !== null ? (
              <div className="flex items-center gap-1">
                <span className={`text-sm font-bold tabular-nums ${getMargenColor(margenPct)}`}>{margenPct}%</span>
                <SparklineMini values={sparklineSerie} color={isCritico ? '#f43f5e' : '#10b981'} width={24} height={12} />
              </div>
            ) : (
              <div className="text-sm text-slate-400 italic">sin datos</div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ BANNER CONTEXTUAL (condicional) ═══════════ */}
      {isCritico && onCrearOC && (
        <div className="px-3 py-2 bg-rose-50 border-t border-rose-100 border-l-4 border-l-rose-500 flex items-center justify-between gap-2">
          <div className="text-[10px] text-rose-800 flex items-center gap-1 flex-1 min-w-0">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            <span>
              <strong>Reordenar.</strong> Stock cubre pocos días.
            </span>
          </div>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onCrearOC(producto);
            }}
            className="px-2.5 py-1 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded flex-shrink-0"
          >
            + Crear OC
          </button>
        </div>
      )}
      {isInvVencida && onReInvestigar && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-100 border-l-4 border-l-amber-400 flex items-center justify-between gap-2">
          <div className="text-[10px] text-amber-800 flex items-center gap-1 flex-1 min-w-0">
            <Search className="w-3 h-3 flex-shrink-0" />
            <span>{dias !== null && dias > 0 ? `Datos · ${dias}d sin actualizar` : 'Datos desactualizados'}</span>
          </div>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onReInvestigar(producto);
            }}
            className="px-2.5 py-1 text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded flex-shrink-0"
          >
            Re-investigar
          </button>
        </div>
      )}

      {/* ═══════════ ZONA 3 · ACCIÓN PRIMARIA ═══════════ */}
      <div className="px-3 py-2 border-t border-slate-100 bg-white">
        {isArchivado ? (
          <div className="grid grid-cols-2 gap-2">
            {onRestaurar && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onRestaurar(producto);
                }}
                className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar
              </button>
            )}
            {onEliminarDefinitivo && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onEliminarDefinitivo(producto);
                }}
                className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
            )}
          </div>
        ) : (
          onView && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onView(producto);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg"
            >
              <Eye className="w-3.5 h-3.5" />
              Ver detalle
            </button>
          )
        )}
      </div>
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
