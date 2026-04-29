/**
 * REFERENCIA DE DISEÑO CANÓNICA — CompraCard
 *
 * Este archivo es la FUENTE DE VERDAD del patrón "vista de lista con sub-entidades" del
 * sistema. Cualquier card de listado con sub-órdenes, tandas o líneas anidadas en otro
 * módulo DEBE replicar este patrón visual.
 *
 * NO MODIFICAR este archivo sin autorización explícita del usuario. Cualquier
 * cambio aquí propaga implícitamente al resto del sistema y puede introducir
 * regresiones en módulos ya alineados.
 *
 * Ver:
 *   - CLAUDE.md → "ACTUALIZACIÓN v6.1 — REFERENCIAS DE DISEÑO CANÓNICAS"
 *   - docs/DESIGN_PATTERNS.md → "Referencias de Diseño Canónicas (S54.x)"
 *   - docs/REGISTRO_IMPLEMENTACION.md → "SESIÓN S54.x — DECISIÓN ESTRATÉGICA"
 *
 * Decisión registrada en sesión S54.x (2026-04-25).
 */
import React, { useState } from 'react';
import {
  Eye,
  DollarSign,
  Truck,
  Layers,
  ChevronDown,
  ChevronRight,
  Info,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Ban,
  FileText,
  Check,
} from 'lucide-react';
import { cn, StatusBadge, formatFechaRelativa } from '../../../design-system';
import type {
  OrdenCompra,
  EstadoOrden,
  SubOrdenCompra,
} from '../../../types/ordenCompra.types';
import { calcularEstadoDerivadoOC } from '../../../utils/ordenCompra.helpers';
import type { Envio } from '../../../types/envio.types';

// ════════════════════════════════════════════════════════════════════════════
// CompraCard — card moderna de OC (S41 rework, alineada al mockup de sub-órdenes)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Comportamiento fiel al mockup `rework-subordenes-s41.html` Flujo 1:
 *
 *   OC sin sub-órdenes: card compacta 5-col (Proveedor / Productos / Pipeline dots
 *     4-etapas / Envío / Fecha)
 *
 *   OC con sub-órdenes:
 *     - Header OC con pills (Estado / Pago / Chip X sub-órdenes) + Total USD
 *     - Grid 5-col (Proveedor / Productos / Ruta / Deudor / Fecha)
 *     - Sección "DESGLOSE DEL PROVEEDOR" con sub-órdenes anidadas
 *     - Cada sub-orden como SubOrdenExpandible (colapsada por default)
 *     - Footer con acciones globales + ayuda contextual
 */

interface CompraCardProps {
  orden: OrdenCompra;
  enviosAsociados?: Envio[];
  onView: () => void;
  onRegistrarPago?: () => void;
  onRegistrarPagoSubOrden?: (subOrdenId: string) => void;
  onVerSubOrden?: (subOrdenId: string) => void;
  onVerEnvios?: () => void;
  onVerEnvio?: (envioId: string) => void;
  className?: string;
}

// ─── Main export ────────────────────────────────────────────────────────────

export const CompraCard: React.FC<CompraCardProps> = ({
  orden,
  enviosAsociados = [],
  onView,
  onRegistrarPago,
  onRegistrarPagoSubOrden,
  onVerSubOrden,
  onVerEnvios,
  onVerEnvio,
  className,
}) => {
  const tieneSubOrdenes = (orden.subOrdenes?.length ?? 0) > 0;

  if (!tieneSubOrdenes) {
    return (
      <CompraCardSimple
        orden={orden}
        enviosAsociados={enviosAsociados}
        onView={onView}
        onRegistrarPago={onRegistrarPago}
        onVerEnvios={onVerEnvios}
        onVerEnvio={onVerEnvio}
        className={className}
      />
    );
  }

  return (
    <CompraCardConSubOrdenes
      orden={orden}
      enviosAsociados={enviosAsociados}
      onView={onView}
      onRegistrarPago={onRegistrarPago}
      onRegistrarPagoSubOrden={onRegistrarPagoSubOrden}
      onVerSubOrden={onVerSubOrden}
      onVerEnvio={onVerEnvio}
      className={className}
    />
  );
};

// ════════════════════════════════════════════════════════════════════════════
// CompraCardSimple — OC sin sub-órdenes (mockup: card 5-col con pipeline dots)
// ════════════════════════════════════════════════════════════════════════════

const CompraCardSimple: React.FC<{
  orden: OrdenCompra;
  enviosAsociados: Envio[];
  onView: () => void;
  onRegistrarPago?: () => void;
  onVerEnvios?: () => void;
  onVerEnvio?: (envioId: string) => void;
  className?: string;
}> = ({ orden, enviosAsociados, onView, onRegistrarPago, onVerEnvios, onVerEnvio, className }) => {
  // S42al — Layout alineado al mockup S40 L260-321 (vista /compras cards).
  // Estructura 5-col con dividers verticales + columna "Envíos asociados"
  // dedicada + columna derecha con monto + estadoPago + saldo + botones
  // icono laterales.
  const estadoDerivado = calcularEstadoDerivadoOC(
    orden.subOrdenes ?? [],
    orden.estado
  );
  const estadoPago = orden.estadoPago;
  // S55 Fase 2 — `oc.historialPagos[]` se eliminó. Pagos viven en CC.
  // Para mostrar saldo pendiente sin disparar query async en cada card,
  // usamos `oc.montoPendiente` (denormalizado) y derivamos `totalPagado`
  // de él. Esto mantiene listados rápidos sin hacer fetch por OC.
  const tcAprox = orden.tcReferencial || orden.tcCompra || 1;
  const saldoPendienteUSD = orden.montoPendiente
    ? orden.montoPendiente / tcAprox
    : (estadoPago === 'pagado' ? 0 : orden.totalUSD);
  const totalPagado = Math.max(0, orden.totalUSD - saldoPendienteUSD);
  const saldoPendiente = saldoPendienteUSD;
  const porcentajePagado =
    orden.totalUSD > 0 ? Math.round((totalPagado / orden.totalUSD) * 100) : 0;

  const resumen = resumenProductos(orden);
  const enviosVisibles = enviosAsociados.slice(0, 3);
  const enviosRestantes = enviosAsociados.length - enviosVisibles.length;

  // Primer envío para derivar la casilla intermedia de la mini-ruta
  const envioConCasilla = enviosAsociados.find(
    (e) => e.destinoCasillaNombre || e.destinoCasillaCodigo
  );

  // ─── S54.x — Datos visuales alineados a EnvioCardSimple ───────────────
  // Productos: top 3 con iniciales coloreadas (avatares apilados)
  const productosTop = orden.productos.slice(0, 3).map((p, idx) => {
    const palette = paletteForId(p.productoId || `${idx}`);
    return {
      productoId: p.productoId || `${idx}`,
      nombre: p.nombreComercial,
      inicial: inicial(p.nombreComercial),
      cantidad: p.cantidad,
      ...palette,
    };
  });
  const prodRestantes = Math.max(0, orden.productos.length - 3);
  const totalSKUs = orden.productos.length;
  const totalUnidades = orden.productos.reduce((s, p) => s + (p.cantidad || 0), 0);
  const resumenNombres =
    productosTop.length > 0
      ? productosTop.map((p) => p.nombre.split(' ')[0]).join(' · ') +
        (prodRestantes > 0 ? ` · +${prodRestantes}` : '')
      : 'Sin productos';

  // Estado: ícono + colores
  const estadoCfg = ESTADO_OC_ICON[estadoDerivado] ?? ESTADO_OC_ICON.borrador;
  const EstadoIcon = estadoCfg.icon;

  // Sticker de la fase (espejo del sticker de tipo de ruta en EnvioCardSimple)
  const stickerCls = STICKER_OC_CLS[estadoDerivado] ?? STICKER_OC_DEFAULT;

  // Pago: progreso de monto pagado
  const barraColor =
    estadoPago === 'pagado'
      ? 'bg-emerald-500'
      : estadoPago === 'parcial'
        ? 'bg-amber-500'
        : 'bg-slate-300';

  // Casilla destino (de los envíos asociados o almacén destino de la OC)
  const casillaNombre =
    envioConCasilla?.destinoCasillaCodigo ||
    envioConCasilla?.destinoCasillaNombre ||
    orden.nombreAlmacenDestino ||
    'Casilla';
  const casillaPais =
    envioConCasilla?.destinoCasillaPais || orden.paisOrigen || 'Peru';
  const esDDP = orden.modoEntregaDetallado === 'ddp_directo';
  const destinoNombre = esDDP ? 'Perú' : casillaNombre;
  const destinoPais = esDDP ? 'Peru' : casillaPais;

  // Transportador: tomado del primer envío con courier/colaborador
  const transportador =
    enviosAsociados.find((e) => e.courier || e.colaboradorNombre)?.courier ??
    enviosAsociados.find((e) => e.colaboradorNombre)?.colaboradorNombre ??
    null;

  return (
    <div
      className={cn(
        '@container bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-teal-300 transition-all cursor-pointer',
        estadoPago === 'pagado' && estadoDerivado === 'recibida' && 'opacity-80',
        className
      )}
      onClick={onView}
    >
      {/* ═══════════════════════════════════════════════════════════════
           S54.x — Layout DUAL espejado de EnvioCardSimple:

           NARROW (@container <640px) → stack vertical 3 rows:
             · Row 1: ícono estado + número+fecha · sticker pipeline
             · Row 2: ruta proveedor → casilla en bloque slate
             · Row 3: avatares productos · total + barra pago + acciones

           WIDE (@container ≥640px) → 5 columnas horizontales con dividers:
             · Col 1: ícono estado + número + fecha
             · Col 2: sticker pipeline + ruta proveedor → courier → casilla
             · Col 3: avatares productos + resumen
             · Col 4: total USD + barra pago + saldo / 100%
             · Col 5: acciones (Ver / Pagar / Envíos)
         ═══════════════════════════════════════════════════════════════ */}

      {/* ── NARROW (stack vertical · móvil-app) ─────────────────────────── */}
      <div className="@[640px]:hidden space-y-3">
        {/* Row 1: ícono + número/fecha + sticker pipeline */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                'inline-flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0',
                estadoCfg.bg,
                estadoCfg.text
              )}
              title={estadoCfg.label}
            >
              <EstadoIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-mono font-bold text-slate-900 text-sm truncate">
                {orden.numeroOrden}
              </div>
              <div className="text-[10px] text-slate-400">
                {formatFechaRelativa(orden.fechaCreacion as any)} · {estadoCfg.label}
              </div>
            </div>
          </div>
          <span
            className={cn(
              'text-[10px] font-bold px-2 py-1 rounded-md border whitespace-nowrap flex-shrink-0',
              stickerCls.bg,
              stickerCls.border,
              stickerCls.text
            )}
          >
            {estadoCfg.label}
          </span>
        </div>

        {/* Row 2: ruta proveedor → casilla en bloque */}
        <div className="bg-slate-50 rounded-lg px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <span className="text-sm flex-shrink-0">{getFlag(orden.paisOrigen)}</span>
              <span className="font-medium truncate" title={orden.nombreProveedor}>
                {orden.nombreProveedor}
              </span>
            </div>
            {transportador && (
              <div
                className="text-[10px] italic text-slate-500 flex items-center gap-1 flex-shrink-0"
                title={transportador}
              >
                <span>✈️</span>
                <span className="truncate max-w-[80px]">{transportador}</span>
              </div>
            )}
            <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
              <span className="text-sm flex-shrink-0">{getFlag(destinoPais)}</span>
              <span className="font-medium truncate" title={destinoNombre}>
                {destinoNombre}
              </span>
            </div>
          </div>
        </div>

        {/* Row 3: avatares + monto USD + barra + acciones circulares */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {productosTop.length > 0 ? (
              <>
                <div className="flex -space-x-1.5 flex-shrink-0">
                  {productosTop.map((p) => (
                    <div
                      key={p.productoId}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold',
                        p.bg,
                        p.text
                      )}
                      title={`${p.nombre} ×${p.cantidad}`}
                    >
                      {p.inicial}
                      <sup className="ml-0.5 text-[8px]">{p.cantidad}</sup>
                    </div>
                  ))}
                  {prodRestantes > 0 && (
                    <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                      +{prodRestantes}
                    </div>
                  )}
                </div>
                {totalSKUs > 0 && (
                  <div className="text-[10px] text-slate-500 truncate">
                    {totalSKUs} SKU{totalSKUs !== 1 ? 's' : ''}
                  </div>
                )}
              </>
            ) : (
              <div className="text-[11px] text-slate-400 italic">Sin productos</div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <div className="text-base font-bold text-slate-900 tabular-nums leading-none">
                ${orden.totalUSD.toFixed(2)}
              </div>
              <div
                className={cn(
                  'text-[9px] font-medium mt-0.5 tabular-nums',
                  estadoPago === 'pagado'
                    ? 'text-emerald-700'
                    : estadoPago === 'parcial'
                      ? 'text-amber-700'
                      : 'text-red-600'
                )}
              >
                {estadoPago === 'pagado'
                  ? '100% pagado'
                  : estadoPago === 'parcial'
                    ? `${porcentajePagado}% pagado`
                    : 'Sin pago'}
              </div>
            </div>
            <button
              type="button"
              title="Ver detalle"
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
              className="w-8 h-8 rounded-full bg-teal-50 text-teal-600 hover:bg-teal-100 flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── WIDE (5 cols horizontales premium · ≥640px) ───────────────── */}
      <div className="hidden @[640px]:flex flex-wrap items-start gap-y-3 gap-x-4">
        {/* ─── Col 1: Ícono grande + N° OC + fecha ─── */}
        <div className="flex-shrink-0 text-center">
          <div
            className={cn(
              'inline-flex items-center justify-center w-10 h-10 rounded-xl',
              estadoCfg.bg,
              estadoCfg.text
            )}
            title={estadoCfg.label}
          >
            <EstadoIcon className="w-5 h-5" />
          </div>
          <div className="font-mono font-bold text-slate-900 text-xs mt-1">
            {orden.numeroOrden}
          </div>
          <div className="text-[9px] text-slate-400">
            {formatFechaRelativa(orden.fechaCreacion as any)}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-slate-200 self-stretch hidden @[640px]:block" />

        {/* ─── Col 2: Sticker estado pipeline + ruta proveedor → casilla ─── */}
        <div className="flex-1 min-w-[180px]">
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 border',
              stickerCls.bg,
              stickerCls.border
            )}
          >
            <span
              className={cn(
                'text-[10px] font-bold rounded px-1.5 py-0.5',
                stickerCls.badge
              )}
            >
              OC
            </span>
            <span className={cn('text-[12px] font-semibold', stickerCls.text)}>
              {estadoCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-2 text-[11px] flex-wrap">
            <span className="text-slate-900 font-medium flex items-center gap-1">
              <span className="text-sm">{getFlag(orden.paisOrigen)}</span>
              <span className="truncate max-w-[160px]" title={orden.nombreProveedor}>
                {orden.nombreProveedor}
              </span>
            </span>
            <span className="text-slate-300">—</span>
            {transportador && (
              <>
                <span className="text-slate-500 italic flex items-center gap-1">
                  <span>✈️</span>
                  <span className="truncate max-w-[100px]" title={transportador}>
                    {transportador}
                  </span>
                </span>
                <span className="text-slate-300">—</span>
              </>
            )}
            <span className="text-slate-900 font-medium flex items-center gap-1">
              <span className="text-sm">{getFlag(destinoPais)}</span>
              <span className="truncate max-w-[160px]" title={destinoNombre}>
                {destinoNombre}
              </span>
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-slate-200 self-stretch hidden @[640px]:block" />

        {/* ─── Col 3: Avatares productos + resumen ─── */}
        <div className="shrink min-w-[110px] w-40 max-w-[180px] @[800px]:w-56 @[800px]:max-w-[224px]">
          <div className="hidden @[800px]:block text-[10px] font-semibold text-slate-500 uppercase mb-1.5 tracking-wider">
            Productos{' '}
            {totalSKUs > 0 && (
              <span className="text-slate-400 font-normal">
                ({totalSKUs} SKU{totalSKUs === 1 ? '' : 's'})
              </span>
            )}
          </div>
          {productosTop.length > 0 ? (
            <>
              <div className="flex items-center">
                <div className="flex -space-x-2">
                  {productosTop.map((p) => (
                    <div
                      key={p.productoId}
                      className={cn(
                        'w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold',
                        p.bg,
                        p.text
                      )}
                      title={`${p.nombre} ×${p.cantidad}`}
                    >
                      {p.inicial}
                      <sup className="ml-0.5 text-[9px]">{p.cantidad}</sup>
                    </div>
                  ))}
                  {prodRestantes > 0 && (
                    <div
                      className="w-9 h-9 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600"
                      title={`${prodRestantes} producto${prodRestantes === 1 ? '' : 's'} más`}
                    >
                      +{prodRestantes}
                    </div>
                  )}
                </div>
              </div>
              <div
                className="hidden @[800px]:block text-[10px] text-slate-500 mt-1.5 truncate"
                title={resumenNombres}
              >
                {resumenNombres}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-slate-400 italic">Sin productos</div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px bg-slate-200 self-stretch hidden @[640px]:block" />

        {/* ─── Col 4: Total USD + barra pago + saldo ─── */}
        <div className="shrink min-w-[100px] w-32 max-w-[140px] @[800px]:w-36 @[800px]:max-w-[160px] text-right">
          <div className="text-xl font-bold text-slate-900 tabular-nums leading-none">
            ${orden.totalUSD.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 mb-1">Total USD</div>
          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full transition-all', barraColor)}
              style={{ width: `${porcentajePagado}%` }}
            />
          </div>
          <div
            className={cn(
              'text-[10px] mt-0.5 font-medium tabular-nums',
              estadoPago === 'pagado'
                ? 'text-emerald-700'
                : estadoPago === 'parcial'
                  ? 'text-amber-700'
                  : 'text-red-600'
            )}
          >
            {estadoPago === 'pagado'
              ? '100% pagado'
              : estadoPago === 'parcial'
                ? `${porcentajePagado}% pagado`
                : 'Sin pago'}
          </div>
          {saldoPendiente > 0 && estadoPago !== 'pagado' && (
            <div className="text-[9px] text-slate-400 mt-0.5 tabular-nums">
              ${saldoPendiente.toFixed(2)} saldo
            </div>
          )}
          {totalUnidades > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <div className="text-[10px] text-slate-500 tabular-nums">
                {totalUnidades} und
              </div>
            </div>
          )}
        </div>

        {/* ─── Col 5: Acciones (Ver / Pagar / Envíos) ─── */}
        <div className="flex-shrink-0 flex @md:flex-col gap-1">
          <button
            type="button"
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            type="button"
            title={estadoPago === 'pagado' ? 'Pagado' : 'Registrar pago'}
            onClick={
              estadoPago === 'pagado' || !onRegistrarPago
                ? undefined
                : (e) => {
                    e.stopPropagation();
                    onRegistrarPago();
                  }
            }
            disabled={estadoPago === 'pagado' || !onRegistrarPago}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              estadoPago === 'pagado' || !onRegistrarPago
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-emerald-600 hover:bg-emerald-50'
            )}
          >
            <DollarSign className="w-4 h-4" />
          </button>
          <button
            type="button"
            title={
              enviosAsociados.length > 0
                ? `Ver envíos (${enviosAsociados.length})`
                : 'Sin envíos'
            }
            onClick={
              enviosAsociados.length > 0 && onVerEnvios
                ? (e) => {
                    e.stopPropagation();
                    onVerEnvios();
                  }
                : undefined
            }
            disabled={enviosAsociados.length === 0 || !onVerEnvios}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              enviosAsociados.length === 0 || !onVerEnvios
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-sky-600 hover:bg-sky-50'
            )}
          >
            <Truck className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Helpers internos de CompraCardSimple ───────────────────────────────────

/**
 * Mini-ruta visual con banderas: Proveedor → Casilla → Perú.
 * Si no hay casilla disponible, muestra solo 2 nodos (Proveedor → Perú).
 */
const MiniRuta: React.FC<{
  paisOrigen?: string;
  nombreOrigen: string;
  paisCasilla?: string;
  nombreCasilla?: string;
  /** S42bi — Si es DDP (proveedor entrega directo a Perú), la ruta es
   *  Proveedor → Perú (sin casilla intermedia). Si no, la OC termina en
   *  la casilla (el tramo casilla→Perú es otro envío separado). */
  esDDP?: boolean;
}> = ({ paisOrigen, nombreOrigen, paisCasilla, nombreCasilla, esDDP }) => {
  // S42bj — Sin truncate/slice: nombres completos, wrap natural si no cabe.

  // S42bi — Caso DDP: ruta directa Proveedor → Perú (sin casilla intermedia)
  if (esDDP) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
        <span className="text-sm">{getFlag(paisOrigen)}</span>
        <span>{nombreOrigen}</span>
        <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
        <span className="text-sm">🇵🇪</span>
        <span>Perú</span>
      </div>
    );
  }

  // S42bi — Caso default: la OC termina en la casilla. El tramo casilla→Perú
  // es otro envío independiente que se gestiona desde /envios.
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
      <span className="text-sm">{getFlag(paisOrigen)}</span>
      <span>{nombreOrigen}</span>
      <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
      <span className="text-sm">{getFlag(paisCasilla || paisOrigen)}</span>
      <span className="font-mono">{nombreCasilla || 'Casilla'}</span>
    </div>
  );
};

/**
 * Mini-card de envío clickeable — fondo según estado del envío.
 */
const MiniEnvioCard: React.FC<{
  envio: Envio;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ envio, onClick }) => {
  const estadoConf = ESTADO_ENVIO_MINI_CONF[envio.estado] ?? {
    bg: 'bg-slate-50 border-slate-200 hover:border-slate-400',
    label: envio.estado,
    badgeVariant: 'neutral' as const,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex items-center justify-between text-xs p-1.5 rounded border w-full transition-colors',
        estadoConf.bg,
        onClick ? 'cursor-pointer' : 'cursor-default'
      )}
    >
      <span className="font-mono text-slate-700 truncate">
        {envio.numeroEnvio}
      </span>
      <StatusBadge variant={estadoConf.badgeVariant} size="sm">
        {estadoConf.label}
      </StatusBadge>
    </button>
  );
};

const ESTADO_ENVIO_MINI_CONF: Record<
  string,
  {
    bg: string;
    label: string;
    badgeVariant: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
  }
> = {
  borrador: {
    bg: 'bg-slate-50 border-slate-200 hover:border-slate-400',
    label: 'Borrador',
    badgeVariant: 'neutral',
  },
  confirmado: {
    bg: 'bg-sky-50 border-sky-200 hover:border-sky-400',
    label: 'Confirmado',
    badgeVariant: 'info',
  },
  en_transito: {
    bg: 'bg-sky-50 border-sky-200 hover:border-sky-400',
    label: 'En tránsito',
    badgeVariant: 'info',
  },
  recibida_parcial: {
    bg: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    label: 'Parcial',
    badgeVariant: 'warning',
  },
  recibida_completa: {
    bg: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
    label: 'Completo',
    badgeVariant: 'success',
  },
  retenida_aduana: {
    bg: 'bg-red-50 border-red-200 hover:border-red-400',
    label: 'Aduana',
    badgeVariant: 'danger',
  },
  perdida_total: {
    bg: 'bg-red-50 border-red-200 hover:border-red-400',
    label: 'Perdida',
    badgeVariant: 'danger',
  },
  cancelada: {
    bg: 'bg-slate-50 border-slate-200',
    label: 'Cancelada',
    badgeVariant: 'danger',
  },
};

/**
 * Badge de estado de pago con porcentaje cuando es parcial.
 * Refleja el mockup: "Pago parcial 50%" vs "Pagado" vs "Sin pago".
 */
const EstadoPagoPillConPorcentaje: React.FC<{
  estado: string;
  porcentaje: number;
}> = ({ estado, porcentaje }) => {
  if (estado === 'pagado') {
    return (
      <StatusBadge variant="success" size="sm">
        Pagado
      </StatusBadge>
    );
  }
  if (estado === 'parcial') {
    return (
      <StatusBadge variant="warning" size="sm">
        Pago parcial {porcentaje}%
      </StatusBadge>
    );
  }
  return (
    <StatusBadge variant="danger" size="sm">
      Sin pago
    </StatusBadge>
  );
};

/**
 * Botón icono pequeño para la columna 5 de acciones.
 * Tonos (teal / emerald / sky) alineados al mockup L315-319.
 */
const IconAction: React.FC<{
  title: string;
  onClick?: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
  tone: 'teal' | 'emerald' | 'sky';
  disabled?: boolean;
}> = ({ title, onClick, icon, tone, disabled }) => {
  const toneHover = {
    teal: 'hover:text-teal-600 hover:bg-teal-50',
    emerald: 'hover:text-emerald-600 hover:bg-emerald-50',
    sky: 'hover:text-sky-600 hover:bg-sky-50',
  }[tone];

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-1.5 rounded text-slate-400 transition-colors',
        !disabled && toneHover,
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {icon}
    </button>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// CompraCardConSubOrdenes — OC con sub-órdenes anidadas (mockup S41 Flujo 1)
// ════════════════════════════════════════════════════════════════════════════

const CompraCardConSubOrdenes: React.FC<{
  orden: OrdenCompra;
  enviosAsociados: Envio[];
  onView: () => void;
  onRegistrarPago?: () => void;
  onRegistrarPagoSubOrden?: (subOrdenId: string) => void;
  onVerSubOrden?: (subOrdenId: string) => void;
  onVerEnvio?: (envioId: string) => void;
  className?: string;
}> = ({
  orden,
  enviosAsociados,
  onView,
  onRegistrarPago,
  onRegistrarPagoSubOrden,
  onVerSubOrden,
  onVerEnvio,
  className,
}) => {
  const subOrdenes = orden.subOrdenes ?? [];
  const estadoDerivado = calcularEstadoDerivadoOC(subOrdenes, orden.estado);
  const estadoPago = orden.estadoPago;
  const deudorNombre =
    orden.deudorTipo === 'colaborador' && orden.deudorNombre
      ? `${orden.deudorNombre} (colaborador)`
      : orden.nombreProveedor;

  // Mapa envioId → envío para lookup en sub-órdenes
  const envioPorId = new Map<string, Envio>();
  enviosAsociados.forEach((e) => envioPorId.set(e.id, e));

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-slate-200 shadow-sm',
        className
      )}
    >
      {/* ═══ Header OC padre ═══ */}
      <div className="p-5 border-b border-slate-100 cursor-pointer hover:bg-slate-50/40 transition-colors" onClick={onView}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-lg font-semibold text-slate-800 font-mono">
              {orden.numeroOrden}
            </span>
            <EstadoOCPill estado={estadoDerivado} />
            <EstadoPagoPill estado={estadoPago} />
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5">
              <Layers className="w-2.5 h-2.5" />
              {subOrdenes.length} sub-órdenes
            </span>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-slate-400">Total USD</div>
            <div className="text-lg font-semibold text-slate-800 tabular-nums">
              ${orden.totalUSD.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Grid 5-col con Ruta + Deudor */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <div className="text-slate-400 mb-1">Proveedor</div>
            <div className="font-medium text-slate-700 flex items-center gap-1">
              <span>{getFlag(orden.paisOrigen)}</span>
              <span className="truncate">{orden.nombreProveedor}</span>
            </div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Productos</div>
            <div className="font-medium text-slate-700 truncate">
              {resumenProductos(orden)}
            </div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Ruta</div>
            {/* S42bi — Ruta correcta según tipo de entrega:
                DDP → Proveedor → Perú (sin casilla intermedia)
                Resto → Proveedor → Casilla (la OC termina ahí)
                S42bj — Sin slice: nombre completo, wrap natural. */}
            <div className="font-medium text-slate-700 text-[11px] flex items-center gap-1 flex-wrap">
              {orden.modoEntregaDetallado === 'ddp_directo' ? (
                <>
                  <span>{getFlag(orden.paisOrigen)}</span>
                  <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span>🇵🇪</span>
                </>
              ) : (
                <>
                  <span>{getFlag(orden.paisOrigen)}</span>
                  <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span className="font-mono">
                    {orden.nombreAlmacenDestino || 'Casilla'}
                  </span>
                </>
              )}
            </div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Deudor</div>
            <div
              className={cn(
                'font-medium truncate',
                orden.deudorTipo === 'colaborador'
                  ? 'text-amber-700'
                  : 'text-slate-700'
              )}
            >
              {deudorNombre}
            </div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Fecha</div>
            <div className="font-medium text-slate-700">
              {formatFechaRelativa(orden.fechaCreacion as any)}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Sección DESGLOSE DEL PROVEEDOR ═══ */}
      <div className="px-5 py-4 bg-slate-50">
        <div className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-2 tracking-wide">
          <Layers className="w-3 h-3" />
          DESGLOSE DEL PROVEEDOR ({subOrdenes.length}{' '}
          SUB-{subOrdenes.length === 1 ? 'ORDEN' : 'ÓRDENES'})
        </div>

        <div className="space-y-2">
          {subOrdenes.map((sub, idx) => (
            <SubOrdenExpandible
              key={sub.id || `sub-${idx}`}
              subOrden={sub}
              envio={sub.envioId ? envioPorId.get(sub.envioId) : undefined}
              onRegistrarPago={
                onRegistrarPagoSubOrden
                  ? () => onRegistrarPagoSubOrden(sub.id)
                  : undefined
              }
              onVerEnvio={
                onVerEnvio && sub.envioId ? () => onVerEnvio(sub.envioId!) : undefined
              }
              onVerDetalle={
                onVerSubOrden ? () => onVerSubOrden(sub.id) : undefined
              }
            />
          ))}
        </div>
      </div>

      {/* ═══ Footer OC con acciones globales ═══ */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 rounded-b-2xl">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <Info className="w-3 h-3" />
          Cada sub-orden tiene su ciclo de vida independiente. La OC padre refleja el
          agregado.
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Ver detalle completo
          </button>
          {onRegistrarPago && estadoPago !== 'pagado' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRegistrarPago();
              }}
              className="px-3 py-1.5 text-xs font-medium text-teal-700 border border-teal-300 rounded-lg hover:bg-teal-50"
            >
              Registrar pago OC completa
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SubOrdenExpandible — cada sub-orden como card colapsable (mockup Flujo 1)
// ════════════════════════════════════════════════════════════════════════════

const SubOrdenExpandible: React.FC<{
  subOrden: SubOrdenCompra;
  envio?: Envio;
  onRegistrarPago?: () => void;
  onVerEnvio?: () => void;
  onVerDetalle?: () => void;
}> = ({ subOrden, envio, onRegistrarPago, onVerEnvio, onVerDetalle }) => {
  const [expandido, setExpandido] = useState(false);
  const estado = subOrden.estado ?? 'borrador';
  const estadoPago = subOrden.estadoPago ?? 'pendiente';
  const productosResumen = subOrden.productos
    .map((p) => `${p.nombreComercial} (x${p.cantidad})`)
    .join(' · ');
  const totalCargos =
    (subOrden.shippingUSD ?? 0) +
    (subOrden.impuestoUSD ?? 0) -
    (subOrden.descuentoUSD ?? 0);

  return (
    <div
      className={cn(
        'bg-white rounded-xl border transition-all',
        expandido
          ? 'border-teal-300 shadow-sm'
          : 'border-slate-200 hover:shadow-sm hover:border-teal-300'
      )}
    >
      {/* Header sub-orden (siempre visible) */}
      <button
        type="button"
        onClick={() => setExpandido(!expandido)}
        className="w-full p-3 flex items-center justify-between text-left gap-3"
      >
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          {expandido ? (
            <ChevronDown className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-slate-700 font-mono">
            {subOrden.id}
          </span>
          {subOrden.envioNumero && (
            <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
              → {subOrden.envioNumero}
            </span>
          )}

          {/* Mini-pipeline 3 dots */}
          <PipelineDots3 estado={estado} className="ml-2" />

          <EstadoSubOrdenPill estado={estado} />
          <EstadoPagoSubPill estado={estadoPago} />
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right hidden @md:block">
            <div className="text-[10px] text-slate-400">Productos</div>
            <div className="text-xs font-medium text-slate-600 truncate max-w-[14rem]">
              {productosResumen || '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400">Total</div>
            <div className="text-sm font-semibold text-slate-800 tabular-nums">
              ${subOrden.totalUSD.toFixed(2)}
            </div>
          </div>
        </div>
      </button>

      {/* Contenido expandido */}
      {expandido && (
        <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-3">
          {/* Grid 2-col: Productos + Cargos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Productos */}
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 mb-2 tracking-wide">
                PRODUCTOS
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {subOrden.productos.map((p, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-1.5 truncate">{p.nombreComercial}</td>
                      <td className="py-1.5 text-right text-slate-500 tabular-nums">
                        ×{p.cantidad}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        ${(p.costoUnitario || 0).toFixed(2)}
                      </td>
                      <td className="py-1.5 text-right font-medium tabular-nums">
                        ${((p.cantidad || 0) * (p.costoUnitario || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200">
                    <td colSpan={3} className="py-1.5 text-xs text-slate-500">
                      Subtotal productos
                    </td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">
                      ${(subOrden.subtotalProductosUSD ?? subOrden.totalUSD - totalCargos).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Cargos del proveedor */}
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 mb-2 tracking-wide">
                CARGOS DEL PROVEEDOR{' '}
                <span className="font-normal text-slate-400">
                  (asignados al confirmar)
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                {(subOrden.shippingUSD ?? 0) > 0 && (
                  <CargoRow
                    label="+ Shipping"
                    value={`$${(subOrden.shippingUSD ?? 0).toFixed(2)}`}
                  />
                )}
                {(subOrden.descuentoUSD ?? 0) > 0 && (
                  <CargoRow
                    label="− Descuento"
                    value={`-$${(subOrden.descuentoUSD ?? 0).toFixed(2)}`}
                    accent="success"
                  />
                )}
                {(subOrden.impuestoUSD ?? 0) > 0 && (
                  <CargoRow
                    label="+ Impuestos"
                    value={`$${(subOrden.impuestoUSD ?? 0).toFixed(2)}`}
                  />
                )}
                {totalCargos === 0 && (
                  <div className="text-slate-400 italic text-center py-2">
                    Sin cargos adicionales
                  </div>
                )}
                {totalCargos !== 0 && (
                  <div className="flex items-center justify-between py-2 border-t-2 border-slate-200 mt-2">
                    <span className="font-semibold">Cargos netos</span>
                    <span className="font-semibold tabular-nums">
                      ${totalCargos.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Total + acciones */}
          <div className="flex items-center justify-between bg-teal-50 rounded-lg p-3 flex-wrap gap-2">
            <div>
              <div className="text-xs text-teal-700 font-medium">
                Total sub-orden:{' '}
                <span className="text-slate-800 tabular-nums">
                  ${subOrden.totalUSD.toFixed(2)}
                </span>
              </div>
              {subOrden.referenciaProveedor && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Referencia proveedor: {subOrden.referenciaProveedor}
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {onVerDetalle && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerDetalle();
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"
                >
                  Ver detalle completo
                </button>
              )}
              {onVerEnvio && subOrden.envioId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerEnvio();
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-teal-700 border border-teal-300 rounded-lg hover:bg-teal-50 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  Ver envío
                </button>
              )}
              {onRegistrarPago && estadoPago !== 'pagado' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRegistrarPago();
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                >
                  Registrar pago
                </button>
              )}
            </div>
          </div>

          {/* Tracking del envío (si existe) */}
          {envio && (
            <div className="flex items-center gap-4 bg-white rounded-lg p-2.5 border border-slate-200 text-xs flex-wrap">
              {envio.courier && (
                <div className="flex items-center gap-1.5">
                  <Truck className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-500">Courier:</span>
                  <span className="font-medium text-slate-700">{envio.courier}</span>
                </div>
              )}
              {envio.numeroTracking && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Tracking:</span>
                  <span className="font-mono text-teal-700">{envio.numeroTracking}</span>
                </div>
              )}
              {envio.fechaSalida && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-slate-500">Despachado:</span>
                  <span className="font-medium text-slate-700">
                    {formatFechaRelativa(envio.fechaSalida as any)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Sub-components de presentación
// ════════════════════════════════════════════════════════════════════════════

const EstadoOCPill: React.FC<{ estado: EstadoOrden | string }> = ({ estado }) => {
  const conf: Record<string, { variant: 'neutral' | 'info' | 'warning' | 'success' | 'danger'; label: string }> = {
    borrador: { variant: 'neutral', label: 'Borrador' },
    enviada: { variant: 'info', label: 'Confirmada' },
    pagada: { variant: 'info', label: 'Confirmada' },
    en_transito: { variant: 'warning', label: 'En Despacho' },
    recibida_parcial: { variant: 'warning', label: 'En Despacho' },
    en_proceso: { variant: 'warning', label: 'En Despacho' },
    despachada: { variant: 'warning', label: 'En Despacho' },
    recibida: { variant: 'success', label: 'Completada' },
    completada: { variant: 'success', label: 'Completada' },
    cancelada: { variant: 'danger', label: 'Cancelada' },
  };
  const c = conf[estado] ?? { variant: 'neutral' as const, label: estado };
  return (
    <StatusBadge variant={c.variant} size="sm" dot>
      {c.label}
    </StatusBadge>
  );
};

const EstadoPagoPill: React.FC<{ estado: string }> = ({ estado }) => {
  if (estado === 'pagado')
    return <StatusBadge variant="success" size="sm">Pagado</StatusBadge>;
  if (estado === 'parcial')
    return <StatusBadge variant="info" size="sm">Pago Parcial</StatusBadge>;
  return <StatusBadge variant="warning" size="sm">Pendiente</StatusBadge>;
};

const EstadoSubOrdenPill: React.FC<{ estado: string }> = ({ estado }) => {
  const conf: Record<string, { variant: 'neutral' | 'info' | 'success'; label: string }> = {
    borrador: { variant: 'neutral', label: 'Confirmada' }, // S41: borrador se muestra como confirmada (decisión D-127)
    en_transito: { variant: 'info', label: 'En Tránsito' },
    recibida: { variant: 'success', label: 'Recibida' },
  };
  const c = conf[estado] ?? { variant: 'neutral' as const, label: estado };
  return (
    <StatusBadge variant={c.variant} size="sm">
      {c.label}
    </StatusBadge>
  );
};

const EstadoPagoSubPill: React.FC<{ estado: string }> = ({ estado }) => {
  if (estado === 'pagado')
    return <StatusBadge variant="success" size="sm">Pagada</StatusBadge>;
  if (estado === 'parcial')
    return <StatusBadge variant="info" size="sm">Pago parcial</StatusBadge>;
  return <StatusBadge variant="warning" size="sm">Pago pendiente</StatusBadge>;
};

/** Pipeline visual de 4 dots: Borrador → Confirmada → En Tránsito → Completada */
const PipelineDots4: React.FC<{ estado: string }> = ({ estado }) => {
  const stage = (() => {
    if (estado === 'borrador') return 0;
    if (['enviada', 'pagada', 'confirmada'].includes(estado)) return 1;
    if (
      ['en_transito', 'en_proceso', 'despachada', 'recibida_parcial'].includes(estado)
    )
      return 2;
    if (['recibida', 'completada'].includes(estado)) return 3;
    return 0;
  })();

  return (
    <div className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3].map((i) => {
        const done = i <= stage;
        const active = i === stage;
        return (
          <React.Fragment key={i}>
            <span
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                done && !active && 'bg-emerald-500',
                active && 'bg-teal-600 ring-2 ring-teal-100',
                !done && 'bg-slate-200'
              )}
            />
            {i < 3 && (
              <span
                className={cn(
                  'w-3 h-0.5',
                  i < stage ? 'bg-emerald-500' : 'bg-slate-200'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Pipeline visual de 3 dots para sub-orden: Confirmada → En Tránsito → Recibida */
const PipelineDots3: React.FC<{ estado: string; className?: string }> = ({
  estado,
  className,
}) => {
  const stage = (() => {
    if (estado === 'borrador') return 0;
    if (estado === 'en_transito') return 1;
    if (estado === 'recibida') return 2;
    return 0;
  })();

  return (
    <div className={cn('inline-flex items-center gap-0.5', className)}>
      {[0, 1, 2].map((i) => {
        const done = i < stage;
        const active = i === stage;
        return (
          <React.Fragment key={i}>
            <span
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                done && 'bg-emerald-500',
                active && stage === 2 && 'bg-emerald-500',
                active && stage !== 2 && 'bg-teal-600 ring-2 ring-teal-100',
                !done && !active && 'bg-slate-200'
              )}
            />
            {i < 2 && (
              <span
                className={cn(
                  'w-3 h-0.5',
                  i < stage ? 'bg-emerald-500' : 'bg-slate-200'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const CargoRow: React.FC<{
  label: string;
  value: string;
  accent?: 'success';
}> = ({ label, value, accent }) => (
  <div className="flex items-center justify-between py-1 border-b border-slate-100 last:border-b-0">
    <span className="text-slate-600">{label}</span>
    <span
      className={cn(
        'font-medium tabular-nums',
        accent === 'success' ? 'text-emerald-600' : 'text-slate-700'
      )}
    >
      {value}
    </span>
  </div>
);

const ActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant: 'teal' | 'emerald' | 'sky';
}> = ({ icon, label, onClick, variant }) => {
  const classes = {
    teal: 'text-teal-700 border-teal-300 hover:bg-teal-50',
    emerald: 'text-emerald-700 border-emerald-300 hover:bg-emerald-50',
    sky: 'text-sky-700 border-sky-300 hover:bg-sky-50',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors',
        classes
      )}
    >
      {icon}
      {label}
    </button>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

// S54.x — Avatares de productos: paleta consistente por productoId (espejo
// del helper en EnvioCardSimple).
const AVATAR_PALETTES = [
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-pink-100', text: 'text-pink-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
];

function paletteForId(id: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function inicial(nombre: string): string {
  const limpio = (nombre || '').trim();
  return limpio ? limpio[0].toUpperCase() : '?';
}

// S54.x — Ícono + colores por estado derivado de OC (espejo de
// ESTADO_ICON en EnvioCardSimple).
const ESTADO_OC_ICON: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; bg: string; text: string; label: string }
> = {
  borrador: { icon: FileText, bg: 'bg-slate-100', text: 'text-slate-500', label: 'Borrador' },
  enviada: { icon: Check, bg: 'bg-sky-50', text: 'text-sky-600', label: 'Confirmada' },
  pagada: { icon: Check, bg: 'bg-sky-50', text: 'text-sky-600', label: 'Confirmada' },
  confirmada: { icon: Check, bg: 'bg-sky-50', text: 'text-sky-600', label: 'Confirmada' },
  en_transito: { icon: Truck, bg: 'bg-amber-50', text: 'text-amber-600', label: 'En Despacho' },
  en_proceso: { icon: Truck, bg: 'bg-amber-50', text: 'text-amber-600', label: 'En Despacho' },
  despachada: { icon: Truck, bg: 'bg-amber-50', text: 'text-amber-600', label: 'En Despacho' },
  recibida_parcial: { icon: AlertCircle, bg: 'bg-amber-50', text: 'text-amber-600', label: 'En Despacho' },
  recibida: { icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Completada' },
  completada: { icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Completada' },
  cancelada: { icon: Ban, bg: 'bg-red-50', text: 'text-red-600', label: 'Cancelada' },
};

// S54.x — Colores del sticker de fase pipeline (espejo de TIPO_RUTA_STICKER
// en EnvioCardSimple). Cada estado pipeline tiene su tono propio.
const STICKER_OC_CLS: Record<
  string,
  { bg: string; border: string; badge: string; text: string }
> = {
  borrador: { bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-200 text-slate-700', text: 'text-slate-700' },
  enviada: { bg: 'bg-sky-50', border: 'border-sky-200', badge: 'bg-sky-200 text-sky-900', text: 'text-sky-900' },
  pagada: { bg: 'bg-sky-50', border: 'border-sky-200', badge: 'bg-sky-200 text-sky-900', text: 'text-sky-900' },
  confirmada: { bg: 'bg-sky-50', border: 'border-sky-200', badge: 'bg-sky-200 text-sky-900', text: 'text-sky-900' },
  en_transito: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-200 text-amber-900', text: 'text-amber-900' },
  en_proceso: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-200 text-amber-900', text: 'text-amber-900' },
  despachada: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-200 text-amber-900', text: 'text-amber-900' },
  recibida_parcial: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-200 text-amber-900', text: 'text-amber-900' },
  recibida: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-200 text-emerald-900', text: 'text-emerald-900' },
  completada: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-200 text-emerald-900', text: 'text-emerald-900' },
  cancelada: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-200 text-red-900', text: 'text-red-900' },
};
const STICKER_OC_DEFAULT = STICKER_OC_CLS.borrador;

function getFlag(pais?: string): string {
  if (!pais) return '🌐';
  const flags: Record<string, string> = {
    USA: '🇺🇸',
    'Estados Unidos': '🇺🇸',
    CHINA: '🇨🇳',
    China: '🇨🇳',
    COREA: '🇰🇷',
    Corea: '🇰🇷',
    'Corea del Sur': '🇰🇷',
    JAPÓN: '🇯🇵',
    Japón: '🇯🇵',
    MÉXICO: '🇲🇽',
    México: '🇲🇽',
    PERÚ: '🇵🇪',
    Perú: '🇵🇪',
    Peru: '🇵🇪',
  };
  return flags[pais] ?? '🌐';
}

function resumenProductos(orden: OrdenCompra): string {
  const items = orden.productos.slice(0, 3);
  const resumen = items
    .map((p) => `${p.nombreComercial} (x${p.cantidad})`)
    .join(' · ');
  const restantes = orden.productos.length - items.length;
  return restantes > 0 ? `${resumen} · +${restantes} más` : resumen;
}
