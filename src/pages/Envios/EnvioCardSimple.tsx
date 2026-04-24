/**
 * EnvioCardSimple — Card estándar de envío (S53.30 · layout híbrido final).
 *
 * Layout aprobado por el usuario — combinación de opciones del mockup
 * `docs/mockups/envio-card-v2-propuestas.html`:
 *
 *   1. Ícono check + N° envío + fecha        (patrón "sticker" de C)
 *   2. Sticker de tipo de ruta + ruta corta  (patrón "sticker" de C)
 *   3. Productos como avatares apilados      (patrón "avatares" de B)
 *   4. 20/20 + barra progreso + $ LANDED     (patrón métricas de A/B)
 *   5. Acción icono: Ver detalle
 *
 * Estilo visual consistente con CompraCard (/compras) — hover/shadow/rounded.
 */
import React from 'react';
import { cn } from '../../design-system';
import { Eye, CheckCircle2, Clock, AlertCircle, Ban } from 'lucide-react';
import type { Envio, EstadoEnvio } from '../../types/envio.types';
import type { Producto } from '../../types/producto.types';
import {
  deriveTipoRutaLogistica,
  INFO_TIPO_RUTA,
} from '../../utils/envio.tipoRuta.helpers';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const FLAG_MAP: Record<string, string> = {
  USA: '🇺🇸',
  'Estados Unidos': '🇺🇸',
  US: '🇺🇸',
  China: '🇨🇳',
  CHINA: '🇨🇳',
  Corea: '🇰🇷',
  COREA: '🇰🇷',
  'Corea del Sur': '🇰🇷',
  Japón: '🇯🇵',
  México: '🇲🇽',
  Perú: '🇵🇪',
  PERÚ: '🇵🇪',
  Peru: '🇵🇪',
  Peru_local: '🇵🇪',
  PE: '🇵🇪',
};

function getFlag(pais?: string): string {
  if (!pais) return '🌐';
  const raw = pais.trim();
  return (
    FLAG_MAP[raw] ||
    FLAG_MAP[raw.toUpperCase()] ||
    FLAG_MAP[raw.toLowerCase()] ||
    '🌐'
  );
}

function formatFechaRelativa(fecha: any): string {
  if (!fecha) return '';
  const d = fecha?.toDate ? fecha.toDate() : new Date(fecha);
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `hace ${dias} d`;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

// Ícono grande + color del estado (col 1)
const ESTADO_ICON: Record<
  EstadoEnvio,
  { icon: React.ComponentType<{ className?: string }>; bg: string; text: string; label: string }
> = {
  borrador: { icon: Clock, bg: 'bg-slate-100', text: 'text-slate-500', label: 'Borrador' },
  confirmado: { icon: Clock, bg: 'bg-amber-50', text: 'text-amber-600', label: 'Confirmado' },
  en_transito: { icon: Clock, bg: 'bg-sky-50', text: 'text-sky-600', label: 'En tránsito' },
  recibida_parcial: { icon: AlertCircle, bg: 'bg-indigo-50', text: 'text-indigo-600', label: 'Parcial' },
  recibida_completa: { icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Recibido' },
  devuelto_pendiente_revision: { icon: AlertCircle, bg: 'bg-orange-50', text: 'text-orange-600', label: 'Revisión' },
  cancelado: { icon: Ban, bg: 'bg-red-50', text: 'text-red-600', label: 'Cancelado' },
} as any;

// Paleta de colores para avatares de producto (hash por ID para consistencia)
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
  const limpio = nombre.trim();
  return limpio ? limpio[0].toUpperCase() : '?';
}

// Colores del sticker de tipo de ruta
const TIPO_RUTA_STICKER: Record<string, { bg: string; border: string; badge: string; text: string }> = {
  A: { bg: 'bg-sky-50', border: 'border-sky-200', badge: 'bg-sky-200 text-sky-900', text: 'text-sky-900' },
  B: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-200 text-amber-900', text: 'text-amber-900' },
  C: { bg: 'bg-teal-50', border: 'border-teal-200', badge: 'bg-teal-200 text-teal-900', text: 'text-teal-900' },
  D: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-200 text-purple-900', text: 'text-purple-900' },
  E: { bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'bg-indigo-200 text-indigo-900', text: 'text-indigo-900' },
  F: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-200 text-emerald-900', text: 'text-emerald-900' },
  G: { bg: 'bg-rose-50', border: 'border-rose-200', badge: 'bg-rose-200 text-rose-900', text: 'text-rose-900' },
  I: { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', badge: 'bg-fuchsia-200 text-fuchsia-900', text: 'text-fuchsia-900' },
  J: { bg: 'bg-cyan-50', border: 'border-cyan-200', badge: 'bg-cyan-200 text-cyan-900', text: 'text-cyan-900' },
};
const TIPO_RUTA_DEFAULT = { bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-200 text-slate-700', text: 'text-slate-700' };

// ────────────────────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────────────────────

interface EnvioCardSimpleProps {
  envio: Envio;
  productosMap: Map<string, Producto>;
  onSelect: (envio: Envio) => void;
  className?: string;
}

export const EnvioCardSimple: React.FC<EnvioCardSimpleProps> = ({
  envio,
  productosMap,
  onSelect,
  className,
}) => {
  // ─── Origen / destino ────────────────────────────────────────────────────
  const origenNombre =
    envio.origenTipo === 'proveedor'
      ? envio.origenProveedorNombre ?? 'Proveedor'
      : envio.origenTipo === 'cliente'
        ? envio.origenClienteNombre ?? 'Cliente'
        : envio.origenCasillaNombre ?? 'Casilla origen';
  const origenPais =
    envio.origenTipo === 'proveedor'
      ? envio.origenProveedorPais
      : envio.origenTipo === 'cliente'
        ? 'Peru'
        : envio.origenCasillaPais;

  const esDestinoCliente = (envio as any).destinoTipo === 'cliente';
  const destinoNombre = esDestinoCliente
    ? (envio as any).destinoClienteNombre ?? 'Cliente'
    : envio.destinoCasillaNombre ?? 'Destino';
  const destinoPais = esDestinoCliente ? 'Peru' : envio.destinoCasillaPais;

  const transportador = envio.courier ?? envio.colaboradorNombre ?? null;

  // ─── Tipo de ruta ────────────────────────────────────────────────────────
  const tipoRuta = deriveTipoRutaLogistica(envio);
  const infoTipo = tipoRuta ? INFO_TIPO_RUTA[tipoRuta] : null;
  const stickerCls = (tipoRuta && TIPO_RUTA_STICKER[tipoRuta]) || TIPO_RUTA_DEFAULT;

  // ─── Métricas ────────────────────────────────────────────────────────────
  const totalUnidades = envio.totalUnidades ?? envio.unidades?.length ?? 0;
  const recibidas =
    envio.totalUnidadesRecibidas ??
    (envio.unidades ?? []).filter((u) => u.estadoEnvio === 'recibida').length;
  const progreso = totalUnidades > 0 ? Math.round((recibidas / totalUnidades) * 100) : 0;
  const valorLandedUSD = (envio.productosSummary ?? []).reduce(
    (sum, p) => sum + ((p as { costoTotalUSD?: number }).costoTotalUSD ?? 0),
    0
  );
  const barraColor =
    progreso === 100 ? 'bg-emerald-500' : progreso > 0 ? 'bg-sky-500' : 'bg-slate-300';

  // ─── Productos: avatares apilados (top 3) + resumen ──────────────────────
  const productosArr = envio.productosSummary ?? [];
  const productosTop = productosArr.slice(0, 3).map((p) => {
    const prod = productosMap.get(p.productoId);
    const nombre = prod?.nombreComercial ?? p.nombre ?? 'Producto';
    const palette = paletteForId(p.productoId || nombre);
    return {
      productoId: p.productoId,
      nombre,
      inicial: inicial(nombre),
      cantidad: p.cantidad ?? 0,
      ...palette,
    };
  });
  const prodRestantes = Math.max(0, productosArr.length - 3);
  const resumenNombres =
    productosTop.length > 0
      ? productosTop.map((p) => p.nombre.split(' ')[0]).join(' · ') +
        (prodRestantes > 0 ? ` · +${prodRestantes}` : '')
      : 'Sin productos';
  const totalSKUs = productosArr.length;

  // ─── Estado ──────────────────────────────────────────────────────────────
  const estadoCfg = ESTADO_ICON[envio.estado] ?? {
    icon: Clock,
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    label: envio.estado,
  };
  const EstadoIcon = estadoCfg.icon;

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-teal-300 transition-all cursor-pointer',
        className
      )}
      onClick={() => onSelect(envio)}
    >
      <div className="flex items-start gap-4">
        {/* ─── Col 1: Ícono grande + N° envío + fecha (estilo sticker C) ─── */}
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
            {envio.numeroEnvio}
          </div>
          <div className="text-[9px] text-slate-400">
            {formatFechaRelativa((envio as any).fechaCreacion)}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-slate-200 self-stretch hidden md:block" />

        {/* ─── Col 2: Sticker de tipo de ruta + ruta corta en 1 línea ─── */}
        <div className="flex-1 min-w-0">
          {infoTipo && tipoRuta && (
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
                {tipoRuta}
              </span>
              <span className={cn('text-[12px] font-semibold', stickerCls.text)}>
                {infoTipo.nombreCorto}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1 mt-2 text-[11px] flex-wrap">
            <span className="text-slate-900 font-medium flex items-center gap-1">
              <span className="text-sm">{getFlag(origenPais)}</span>
              <span className="truncate max-w-[160px]" title={origenNombre}>
                {origenNombre}
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
        <div className="w-px bg-slate-200 self-stretch hidden md:block" />

        {/* ─── Col 3: Avatares apilados (estilo B) + resumen ─── */}
        <div className="flex-shrink-0 w-56">
          <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5">
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
              <div className="text-[10px] text-slate-500 mt-1.5 truncate" title={resumenNombres}>
                {resumenNombres}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-slate-400 italic">Sin productos</div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px bg-slate-200 self-stretch hidden md:block" />

        {/* ─── Col 4: 20/20 + barra + $ LANDED (estilo A/B) ─── */}
        <div className="flex-shrink-0 w-32 text-right">
          <div className="text-xl font-bold text-slate-900 tabular-nums leading-none">
            {recibidas}
            <span className="text-slate-400">/{totalUnidades}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 mb-1">unidades</div>
          {totalUnidades > 0 && (
            <>
              <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full transition-all', barraColor)}
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <div
                className={cn(
                  'text-[10px] mt-0.5 font-medium tabular-nums',
                  progreso === 100 ? 'text-emerald-700' : 'text-slate-500'
                )}
              >
                {progreso}% recibido
              </div>
            </>
          )}
          {valorLandedUSD > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <div className="text-sm font-bold text-slate-900 tabular-nums leading-none">
                ${Math.floor(valorLandedUSD)}
                <span className="text-[11px] text-slate-400">
                  .{String(Math.round((valorLandedUSD % 1) * 100)).padStart(2, '0')}
                </span>
              </div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wide mt-0.5">
                Landed
              </div>
            </div>
          )}
        </div>

        {/* ─── Col 5: Acción icono ─── */}
        <div className="flex-shrink-0 flex md:flex-col gap-1">
          <button
            type="button"
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(envio);
            }}
            className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
