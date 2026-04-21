/**
 * EnvioCard — Tarjeta compacta de envío alineada pixel-perfect al mockup
 * `docs/mockups/envios-transversal-s43.html` → tab "Vista /envios".
 *
 * Estructura (3 filas):
 *   1. Header: N° envío + badges (tipo ruta A-J + estado + sub-envíos + pre-vendidas
 *      + incidencia destacada) .. spacer .. valor landed / OC vinculada / responsable.
 *   2. Ruta horizontal: bandera+nombre origen · dotted · transporte · dotted · bandera+nombre destino.
 *   3. Footer: resumen corto de contenido .. spacer .. fecha relevante.
 *
 * NO hay: ícono grande a la izquierda del header, banner de estado colorido
 * ocupando toda una fila, lista de productos, botones de acción. Todo eso
 * vive ahora en el EnvioDetailModal al abrir la card.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Envio, EstadoEnvio } from '../../types/envio.types';
import { cn } from '../../design-system';
// S47 — Clasificación tipo de ruta A-J (Modelo Envíos Transversal)
import {
  deriveTipoRutaLogistica,
  INFO_TIPO_RUTA,
  badgeClassForTipoRuta,
} from '../../utils/envio.tipoRuta.helpers';

// Lucide icons: solo los necesarios después del rediseño
import { Plane, Truck, Package, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import type { Producto } from '../../types/producto.types';

// Props (retrocompat — los handlers on* ya no se usan aquí, pero mantenemos la
// firma para no romper el call-site que los pasa. Se ignoran silenciosamente).
interface EnvioCardProps {
  envio: Envio;
  productosMap: Map<string, Producto>;
  onSelect: (envio: Envio) => void;
  onConfirmar?: (id: string) => void;
  onEnviar?: (id: string) => void;
  onCancelar?: (id: string) => void;
  onIniciarRecepcion?: (envio: Envio) => void;
}

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

const COUNTRY_CODE: Record<string, string> = {
  USA: 'US',
  'Estados Unidos': 'US',
  US: 'US',
  China: 'CN',
  CHINA: 'CN',
  Corea: 'KR',
  COREA: 'KR',
  'Corea del Sur': 'KR',
  Japón: 'JP',
  México: 'MX',
  Perú: 'PE',
  PERÚ: 'PE',
  Peru: 'PE',
  Peru_local: 'PE',
  PE: 'PE',
};

const flagDe = (pais?: string): string => (pais ? FLAG_MAP[pais] ?? '🌐' : '🌐');
const codDe = (pais?: string): string => (pais ? COUNTRY_CODE[pais] ?? '??' : '??');

// Estado badge (pastel, sin dot) matching mockup colors
const ESTADO_STYLE: Record<EstadoEnvio, { label: string; className: string }> = {
  borrador: { label: 'Borrador', className: 'bg-slate-100 text-slate-700' },
  confirmado: { label: 'Confirmado', className: 'bg-amber-100 text-amber-800' },
  en_transito: { label: 'En tránsito', className: 'bg-sky-100 text-sky-800' },
  retenida_aduana: { label: 'Retenido aduana', className: 'bg-orange-100 text-orange-800' },
  recibida_parcial: { label: 'Recibido parcial', className: 'bg-purple-100 text-purple-800' },
  recibida_completa: { label: 'Recibido completo', className: 'bg-emerald-100 text-emerald-800' },
  perdida_total: { label: 'Perdido', className: 'bg-red-100 text-red-800' },
  cancelada: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
};

// Fechas legibles es-PE
const fechaCorta = (ts: { toDate?: () => Date } | null | undefined): string => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : (ts as unknown as Date);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }).replace('.', '');
  } catch {
    return '—';
  }
};

// ────────────────────────────────────────────────────────────────────────────
// Sub-componente: Ruta horizontal pixel-perfect al mockup
// ────────────────────────────────────────────────────────────────────────────

interface RutaMockupProps {
  origenCod: string;
  origenFlag: string;
  origenNombre: string;
  origenSubtexto?: string;
  destinoCod: string;
  destinoFlag: string;
  destinoNombre: string;
  destinoSubtexto?: string;
  transporteLabel?: string;
  transporteIcon?: string;
}

const RutaMockup: React.FC<RutaMockupProps> = ({
  origenCod,
  origenFlag,
  origenNombre,
  origenSubtexto,
  destinoCod,
  destinoFlag,
  destinoNombre,
  destinoSubtexto,
  transporteLabel,
  transporteIcon,
}) => (
  <div className="flex items-center gap-3">
    {/* Origen */}
    <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
      <span className="text-xs text-slate-400 font-semibold tracking-wider w-5 text-center">
        {origenCod}
      </span>
      <span className="text-lg leading-none" aria-hidden>
        {origenFlag}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900 truncate">{origenNombre}</div>
        {origenSubtexto && (
          <div className="text-[11px] text-slate-500 truncate">{origenSubtexto}</div>
        )}
      </div>
    </div>

    {/* Línea punteada + transporte */}
    <div className="flex-1 flex items-center gap-2 min-w-0 px-1">
      <div className="flex-1 border-t-2 border-dotted border-slate-300 min-w-[20px]" />
      {(transporteLabel || transporteIcon) && (
        <div className="flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap">
          {transporteIcon && <span aria-hidden>{transporteIcon}</span>}
          {transporteLabel && <span>{transporteLabel}</span>}
        </div>
      )}
      <div className="flex-1 border-t-2 border-dotted border-slate-300 min-w-[20px]" />
    </div>

    {/* Destino */}
    <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
      <span className="text-xs text-slate-400 font-semibold tracking-wider w-5 text-center">
        {destinoCod}
      </span>
      <span className="text-lg leading-none" aria-hidden>
        {destinoFlag}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900 truncate">{destinoNombre}</div>
        {destinoSubtexto && (
          <div className="text-[11px] text-slate-500 truncate">{destinoSubtexto}</div>
        )}
      </div>
    </div>
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// EnvioCard principal
// ────────────────────────────────────────────────────────────────────────────

export const EnvioCard: React.FC<EnvioCardProps> = ({ envio, onSelect }) => {
  const navigate = useNavigate();

  // ─── Derivados ──────────────────────────────────────────────────────────
  const tipoRuta = deriveTipoRutaLogistica(envio);
  const infoRuta = tipoRuta ? INFO_TIPO_RUTA[tipoRuta] : null;

  // Valor landed USD (suma costoTotalUSD de productosSummary)
  const valorLandedUSD = (envio.productosSummary ?? []).reduce(
    (sum, p) => sum + ((p as { costoTotalUSD?: number }).costoTotalUSD || 0),
    0
  );

  // Sub-envíos (S45)
  const numSubEnvios = Array.isArray((envio as any).subEnvios)
    ? ((envio as any).subEnvios as unknown[]).length
    : 0;

  // Pre-vendidas
  const numPreVendidas = (envio.unidades ?? []).filter(
    (u) => !!(u as any).reservadaPara
  ).length;

  // Incidencias
  const danadas = envio.totalUnidadesDanadas || 0;
  const faltantes = envio.totalUnidadesFaltantes || 0;
  const incidenciasAbiertas = (envio.incidencias || []).filter((i) => !i.resuelta).length;
  const retenida = envio.estado === 'retenida_aduana';
  const hayIncidencia = danadas + faltantes + incidenciasAbiertas > 0 || retenida;
  const incidenciasResumen: string[] = [];
  if (retenida) incidenciasResumen.push('Retenido aduana');
  if (danadas > 0) incidenciasResumen.push(`${danadas} dañada${danadas !== 1 ? 's' : ''}`);
  if (faltantes > 0) incidenciasResumen.push(`${faltantes} faltante${faltantes !== 1 ? 's' : ''}`);
  if (incidenciasAbiertas > 0)
    incidenciasResumen.push(
      `${incidenciasAbiertas} incidencia${incidenciasAbiertas !== 1 ? 's' : ''}`
    );

  // Origen / destino con bandera + código + subtítulo
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
  const origenSubtexto =
    envio.origenTipo === 'proveedor'
      ? origenPais
        ? `Proveedor · ${origenPais}`
        : 'Proveedor'
      : envio.origenTipo === 'cliente'
        ? 'Devolución · cliente'
        : envio.origenCasillaCodigo ?? origenPais;

  const esDestinoCliente = (envio as any).destinoTipo === 'cliente';
  const destinoNombre = esDestinoCliente
    ? (envio as any).destinoClienteNombre ?? 'Cliente'
    : envio.destinoCasillaNombre ?? 'Destino';
  const destinoPais = esDestinoCliente ? 'Peru' : envio.destinoCasillaPais;
  const destinoSubtexto = esDestinoCliente
    ? (envio as any).destinoClienteDistrito ?? 'Cliente final'
    : envio.destinoCasillaCodigo ?? destinoPais;

  // Transporte
  const courierLabel = envio.courier ?? envio.colaboradorNombre ?? null;
  const transporteIcon =
    envio.tipo === 'internacional_peru' ? '✈️' : envio.origenTipo === 'cliente' ? '🔄' : '🚚';

  // Footer info
  const totalUnidades = envio.totalUnidades ?? envio.unidades?.length ?? 0;
  const numProductos = envio.productosSummary?.length ?? 0;
  const totalRecibidas =
    envio.totalUnidadesRecibidas ??
    (envio.unidades ?? []).filter((u) => u.estadoEnvio === 'recibida').length;

  // OC vinculada
  const ocNumero = envio.ordenCompraNumero;
  const ventaNumero = (envio as any).ventaNumero;
  const devolucionNumero = (envio as any).devolucionNumero;

  // Fecha footer contextual
  const fechaFooter = (() => {
    if (envio.estado === 'recibida_completa' || envio.estado === 'recibida_parcial') {
      const f = (envio.recepciones || [])[envio.recepciones?.length ? envio.recepciones.length - 1 : 0]?.fechaRecepcion;
      return f ? { label: 'Último recibo', valor: fechaCorta(f) } : null;
    }
    if (envio.estado === 'en_transito' && envio.fechaLlegadaEstimada) {
      return { label: 'Recep. estimada', valor: fechaCorta(envio.fechaLlegadaEstimada) };
    }
    if (envio.fechaCreacion) {
      return { label: 'Creado', valor: fechaCorta(envio.fechaCreacion) };
    }
    return null;
  })();

  const estadoCfg = ESTADO_STYLE[envio.estado] ?? {
    label: envio.estado,
    className: 'bg-slate-100 text-slate-700',
  };

  // Borde destacado si hay incidencia o está en tránsito
  const borderClass =
    hayIncidencia
      ? 'border-red-200 ring-1 ring-red-100'
      : envio.estado === 'en_transito'
        ? 'border-teal-200'
        : 'border-slate-200';

  return (
    <button
      type="button"
      onClick={() => onSelect(envio)}
      className={cn(
        'w-full text-left bg-white border rounded-xl px-4 py-3 transition-all hover:shadow-md hover:border-teal-300 group',
        borderClass
      )}
    >
      {/* ─── Fila 1: Header ─── */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          <span className="text-base font-bold text-slate-900 font-mono whitespace-nowrap">
            {envio.numeroEnvio}
          </span>
          {/* Badge tipo ruta A-J */}
          {infoRuta && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full',
                badgeClassForTipoRuta(tipoRuta!)
              )}
              title={infoRuta.nombreLargo}
            >
              <span>{infoRuta.icono}</span>
              <span>{infoRuta.nombreCorto}</span>
              <span className="font-mono text-[9px] opacity-70">· {infoRuta.codigo}</span>
            </span>
          )}
          {/* Badge estado */}
          <span
            className={cn(
              'inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full',
              estadoCfg.className
            )}
          >
            {estadoCfg.label}
          </span>
          {/* Badge sub-envíos */}
          {numSubEnvios > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800"
              title="Envío fraccionado en tandas de despacho"
            >
              {numSubEnvios} sub-envío{numSubEnvios !== 1 ? 's' : ''}
            </span>
          )}
          {/* Badge pre-vendidas */}
          {numPreVendidas > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800"
              title="Unidades reservadas para ventas pendientes"
            >
              🎯 {numPreVendidas} pre-vendida{numPreVendidas !== 1 ? 's' : ''}
            </span>
          )}
          {/* Incidencia (solo si NO es retenida_aduana, que ya está como estado) */}
          {hayIncidencia && !retenida && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800"
              title={incidenciasResumen.join(' · ')}
            >
              <AlertTriangle className="w-3 h-3" />
              {incidenciasResumen[0]}
            </span>
          )}
        </div>

        {/* Columna derecha del header */}
        <div className="text-right flex-shrink-0">
          {hayIncidencia ? (
            <>
              <div className="text-[10px] text-red-600 uppercase tracking-wider font-semibold">
                Responsable reclamo
              </div>
              <div className="text-xs font-semibold text-red-700">
                {courierLabel ?? 'Sin asignar'}
              </div>
            </>
          ) : valorLandedUSD > 0 ? (
            <>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                Valor landed
              </div>
              <div className="text-base font-bold text-slate-900 tabular-nums">
                $
                {valorLandedUSD.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </div>
            </>
          ) : ocNumero ? (
            <>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                OC vinculada
              </div>
              <div className="text-xs font-mono font-semibold text-teal-700">{ocNumero}</div>
            </>
          ) : ventaNumero ? (
            <>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                Venta vinculada
              </div>
              <div className="text-xs font-mono font-semibold text-teal-700">{ventaNumero}</div>
            </>
          ) : devolucionNumero ? (
            <>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                Devolución
              </div>
              <div className="text-xs font-mono font-semibold text-amber-700">
                {devolucionNumero}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ─── Fila 2: Ruta horizontal ─── */}
      <RutaMockup
        origenCod={codDe(origenPais)}
        origenFlag={flagDe(origenPais)}
        origenNombre={origenNombre}
        origenSubtexto={origenSubtexto}
        destinoCod={codDe(destinoPais)}
        destinoFlag={flagDe(destinoPais)}
        destinoNombre={destinoNombre}
        destinoSubtexto={destinoSubtexto}
        transporteLabel={courierLabel ?? undefined}
        transporteIcon={transporteIcon}
      />

      {/* ─── Fila 3: Footer ─── */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 gap-3">
        <div className="truncate">
          {/* Resumen de contenido adaptativo al estado */}
          {envio.estado === 'recibida_completa' || envio.estado === 'recibida_parcial' ? (
            <>
              <b className="text-slate-900 tabular-nums">
                {totalRecibidas}/{totalUnidades}
              </b>{' '}
              unidades recibidas
              {numSubEnvios > 0 && (
                <>
                  {' · '}
                  <span>
                    {numSubEnvios} tanda{numSubEnvios !== 1 ? 's' : ''} de despacho
                  </span>
                </>
              )}
              {numProductos > 0 && (
                <>
                  {' · '}
                  {numProductos} producto{numProductos !== 1 ? 's' : ''}
                </>
              )}
            </>
          ) : (
            <>
              <b className="text-slate-900 tabular-nums">{totalUnidades}</b> unidades
              {numProductos > 0 && (
                <>
                  {' · '}
                  {numProductos} producto{numProductos !== 1 ? 's' : ''}
                </>
              )}
              {numSubEnvios > 0 && (
                <>
                  {' · '}
                  {numSubEnvios} sub-envío{numSubEnvios !== 1 ? 's' : ''}
                </>
              )}
            </>
          )}
        </div>
        {fechaFooter && (
          <div className="flex-shrink-0">
            <span className="text-slate-500">{fechaFooter.label}:</span>{' '}
            <span className="text-slate-700 font-medium">{fechaFooter.valor}</span>
          </div>
        )}
      </div>
    </button>
  );
};

// Helper para silenciar TS unused warnings (los íconos pueden usarse si se extiende)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unusedIcons = { Plane, Truck, Package, ArrowRightLeft };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unusedNavigate = () => useNavigate();
