/**
 * EnvioCardSimple — Card estándar de envío alineada con el patrón visual
 * de `CompraCard` (vista /compras).
 *
 * Layout 5 columnas horizontales con dividers verticales:
 *   1. N° envío + estado + fecha
 *   2. Origen + destino + tipo de ruta
 *   3. Productos (resumen)
 *   4. Unidades / Progreso / Valor
 *   5. Acciones icono verticales
 *
 * S53.29 — Pensada para consistencia entre /compras y /envios. El
 * EnvioCard anterior (más detallado, 755 líneas) queda disponible
 * para el modal de detalle; esta versión liviana es la que se ve en
 * el listado principal.
 */
import React from 'react';
import { cn } from '../../design-system';
import { Eye, ChevronRight, Truck, Plane, Package, ArrowRightLeft } from 'lucide-react';
import type { Envio, EstadoEnvio } from '../../types/envio.types';
import type { Producto } from '../../types/producto.types';
import {
  deriveTipoRutaLogistica,
  INFO_TIPO_RUTA,
  badgeClassForTipoRuta,
} from '../../utils/envio.tipoRuta.helpers';

// ────────────────────────────────────────────────────────────────────────────
// Helpers locales
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

// Estilo de píldora por estado de envío
const ESTADO_PILL: Record<EstadoEnvio, { label: string; cls: string }> = {
  borrador: { label: 'Borrador', cls: 'bg-slate-100 text-slate-700' },
  confirmado: { label: 'Confirmado', cls: 'bg-amber-100 text-amber-800' },
  en_transito: { label: 'En tránsito', cls: 'bg-sky-100 text-sky-800' },
  recibida_parcial: { label: 'Recepción parcial', cls: 'bg-indigo-100 text-indigo-800' },
  recibida_completa: { label: 'Recibido completo', cls: 'bg-emerald-100 text-emerald-800' },
  devuelto_pendiente_revision: { label: 'Devuelto · revisión', cls: 'bg-orange-100 text-orange-800' },
  cancelado: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
} as any;

// ────────────────────────────────────────────────────────────────────────────
// Mini-ruta (origen → destino con transportador opcional)
// ────────────────────────────────────────────────────────────────────────────

const MiniRutaEnvio: React.FC<{
  origenPais?: string;
  origenNombre: string;
  destinoPais?: string;
  destinoNombre: string;
  transportador?: string | null;
  modoTransporte?: string;
}> = ({ origenPais, origenNombre, destinoPais, destinoNombre, transportador, modoTransporte }) => {
  const TransIcon =
    modoTransporte === 'aereo' ? Plane : modoTransporte === 'maritimo' ? Package : Truck;
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
      <span className="text-sm">{getFlag(origenPais)}</span>
      <span className="truncate max-w-[140px]" title={origenNombre}>
        {origenNombre}
      </span>
      <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
      {transportador && (
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-1.5 py-0.5">
          <TransIcon className="w-2.5 h-2.5" />
          <span className="truncate max-w-[80px]" title={transportador}>
            {transportador}
          </span>
        </span>
      )}
      {transportador && (
        <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
      )}
      <span className="text-sm">{getFlag(destinoPais)}</span>
      <span className="truncate max-w-[140px]" title={destinoNombre}>
        {destinoNombre}
      </span>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Acción icono (mismo patrón que CompraCard)
// ────────────────────────────────────────────────────────────────────────────

const IconAction: React.FC<{
  title: string;
  onClick?: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
  tone?: 'teal' | 'sky' | 'amber';
  disabled?: boolean;
}> = ({ title, onClick, icon, tone = 'teal', disabled }) => {
  const toneCls = {
    teal: 'text-teal-600 hover:bg-teal-50',
    sky: 'text-sky-600 hover:bg-sky-50',
    amber: 'text-amber-600 hover:bg-amber-50',
  }[tone];
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-1.5 rounded-lg border border-transparent transition-colors',
        !disabled && toneCls,
        disabled && 'text-slate-300 cursor-not-allowed'
      )}
    >
      {icon}
    </button>
  );
};

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
  // Origen
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

  // Destino
  const esDestinoCliente = (envio as any).destinoTipo === 'cliente';
  const destinoNombre = esDestinoCliente
    ? (envio as any).destinoClienteNombre ?? 'Cliente'
    : envio.destinoCasillaNombre ?? 'Destino';
  const destinoPais = esDestinoCliente ? 'Peru' : envio.destinoCasillaPais;

  // Transportador
  const transportador = envio.courier ?? envio.colaboradorNombre ?? null;

  // Tipo de ruta
  const tipoRuta = deriveTipoRutaLogistica(envio);
  const infoTipo = tipoRuta ? INFO_TIPO_RUTA[tipoRuta] : null;

  // Totales
  const totalUnidades = envio.totalUnidades ?? envio.unidades?.length ?? 0;
  const recibidas =
    envio.totalUnidadesRecibidas ??
    (envio.unidades ?? []).filter((u) => u.estadoEnvio === 'recibida').length;
  const progreso = totalUnidades > 0 ? Math.round((recibidas / totalUnidades) * 100) : 0;
  const valorLandedUSD = (envio.productosSummary ?? []).reduce(
    (sum, p) => sum + ((p as { costoTotalUSD?: number }).costoTotalUSD ?? 0),
    0
  );

  // Resumen productos: primeros 2 + "más"
  const productosResumen = (envio.productosSummary ?? [])
    .slice(0, 2)
    .map((p) => {
      const prod = productosMap.get(p.productoId);
      const nombre = prod?.nombreComercial ?? p.nombre ?? 'Producto';
      return `${nombre} (x${p.cantidad})`;
    });
  const prodRestantes = Math.max(0, (envio.productosSummary?.length ?? 0) - 2);
  const productosText =
    productosResumen.length > 0
      ? productosResumen.join(' · ') + (prodRestantes > 0 ? ` · +${prodRestantes} más` : '')
      : 'Sin productos';

  const estadoCfg = ESTADO_PILL[envio.estado] ?? {
    label: envio.estado,
    cls: 'bg-slate-100 text-slate-700',
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-teal-300 transition-all cursor-pointer',
        className
      )}
      onClick={() => onSelect(envio)}
    >
      <div className="flex items-start gap-4">
        {/* ─── Columna 1: Número + estado + fecha ─── */}
        <div className="flex-shrink-0">
          <div className="font-mono font-bold text-slate-900 text-sm">
            {envio.numeroEnvio}
          </div>
          <div className="mt-1">
            <span
              className={cn(
                'inline-block text-[10px] font-medium px-2 py-0.5 rounded-full',
                estadoCfg.cls
              )}
            >
              {estadoCfg.label}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {formatFechaRelativa((envio as any).fechaCreacion)}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-slate-200 self-stretch hidden md:block" />

        {/* ─── Columna 2: Ruta (origen → destino) + tipo de ruta ─── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {infoTipo && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded',
                  badgeClassForTipoRuta(tipoRuta!)
                )}
                title={infoTipo.nombreLargo}
              >
                <span>{infoTipo.icono}</span>
                <span>{infoTipo.nombreCorto}</span>
              </span>
            )}
            <span className="text-[10px] text-slate-400 font-mono">
              · {tipoRuta ?? '?'}
            </span>
          </div>
          <MiniRutaEnvio
            origenPais={origenPais}
            origenNombre={origenNombre}
            destinoPais={destinoPais}
            destinoNombre={destinoNombre}
            transportador={transportador}
            modoTransporte={(envio as any).modoTransporte}
          />
        </div>

        {/* Divider */}
        <div className="w-px bg-slate-200 self-stretch hidden md:block" />

        {/* ─── Columna 3: Productos ─── */}
        <div className="flex-shrink-0 w-full md:w-56">
          <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
            Productos
          </div>
          <div className="text-[11px] text-slate-600 line-clamp-2" title={productosText}>
            {productosText}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-slate-200 self-stretch hidden md:block" />

        {/* ─── Columna 4: Unidades + progreso + valor ─── */}
        <div className="flex-shrink-0 w-full md:w-32 text-right">
          <div className="text-lg font-bold text-slate-900 tabular-nums">
            {recibidas}/{totalUnidades}
          </div>
          <div className="text-[10px] text-slate-500 mb-1">unidades</div>
          {totalUnidades > 0 && (
            <>
              <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all',
                    progreso === 100
                      ? 'bg-emerald-500'
                      : progreso > 0
                        ? 'bg-sky-500'
                        : 'bg-slate-300'
                  )}
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                {progreso}% recibido
              </div>
            </>
          )}
          {valorLandedUSD > 0 && (
            <div className="text-[10px] text-slate-600 mt-1 tabular-nums">
              $ {valorLandedUSD.toFixed(2)} USD
            </div>
          )}
        </div>

        {/* ─── Columna 5: Acción icono ─── */}
        <div className="flex-shrink-0 flex md:flex-col gap-1">
          <IconAction
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(envio);
            }}
            icon={<Eye className="w-4 h-4" />}
            tone="teal"
          />
          <IconAction
            title="Ver ruta"
            icon={<ArrowRightLeft className="w-4 h-4" />}
            tone="sky"
            disabled
          />
        </div>
      </div>
    </div>
  );
};
