/**
 * RutaVerticalSidebar — Sidebar persistente del Wizard de Envíos Unificado
 *
 * S52 v7 · D-R: visible durante los 4 pasos del wizard. Contiene:
 *   1. Chip de tipo inferido (arriba) — cambia color según tipo (C/J/E/I)
 *   2. 3 bloques verticales: 📦 ORIGEN → ✈️🚢🚚 TRÁNSITO → 🏠 DESTINO
 *   3. Panel de resumen con KPIs en vivo
 *
 * Los 5 refinamientos R1-R5 del diseño v3 aplicados:
 *   - R1: llenado progresivo 2 niveles (categoría → específico)
 *   - R2: 3 estados visuales (pending/current/complete)
 *   - R3: chip de tipo inferido arriba
 *   - R4: click en bloque completo = jump-back al paso
 *   - R5: iconos fijos por rol (📦/🏠) + tránsito dinámico (✈️/🚢/🚚)
 */
import React from 'react';
import type { EnvioWizardState } from '../envioWizardTypes';
import type { EnvioTipoConfig } from '../registry';

interface Props {
  state: EnvioWizardState;
  tipoConfig: EnvioTipoConfig | null;
  totalUnidades: number;
  totalSKUs: number;
  totalPrevendidas: number;
  totalFleteUSD: number;
  onJumpToPaso?: (paso: number) => void;
}

type EstadoBloque = 'pending' | 'current' | 'complete' | 'complete-category';

// ============================================================================
// Helpers
// ============================================================================

function paisBandera(pais: string): string {
  const MAP: Record<string, string> = {
    USA: '🇺🇸',
    Peru: '🇵🇪',
    Perú: '🇵🇪',
    China: '🇨🇳',
    Corea: '🇰🇷',
    Japón: '🇯🇵',
    Japon: '🇯🇵',
  };
  return MAP[pais] || '🌎';
}

function iconoTransito(modo: 'aereo' | 'maritimo' | 'terrestre'): string {
  return modo === 'aereo' ? '✈️' : modo === 'maritimo' ? '🚢' : '🚚';
}

function labelTransito(modo: 'aereo' | 'maritimo' | 'terrestre'): string {
  return modo === 'aereo' ? 'Aéreo' : modo === 'maritimo' ? 'Marítimo' : 'Terrestre';
}

// ============================================================================
// Bloque individual (un nodo de la ruta)
// ============================================================================

interface BloqueProps {
  estado: EstadoBloque;
  icono: string;
  labelRol: string;
  nombre: string;
  metadata?: string;
  pasoRef: number;
  onClick?: () => void;
  badge: number | string;
  extra?: string;
}

const Bloque: React.FC<BloqueProps> = ({
  estado,
  icono,
  labelRol,
  nombre,
  metadata,
  onClick,
  badge,
  extra,
}) => {
  const clases = {
    pending:
      'bg-slate-50 border-slate-200 border-dashed',
    current:
      'bg-blue-50 border-blue-500 shadow-[0_0_0_4px_#dbeafe] animate-pulse',
    complete:
      'bg-green-50 border-green-500 cursor-pointer hover:bg-green-100 hover:border-green-600',
    'complete-category':
      'bg-emerald-50 border-emerald-500 cursor-pointer hover:bg-emerald-100',
  }[estado];

  const nombreClases = {
    pending: 'text-slate-400 italic',
    current: 'text-blue-900 font-semibold',
    complete: 'text-green-800 font-semibold',
    'complete-category': 'text-emerald-700 font-medium',
  }[estado];

  const labelClases = {
    pending: 'text-slate-500',
    current: 'text-blue-700',
    complete: 'text-green-700',
    'complete-category': 'text-emerald-700',
  }[estado];

  const badgeClases = {
    pending: 'bg-slate-200 text-slate-400',
    current: 'bg-blue-500 text-white',
    complete: 'bg-green-500 text-white',
    'complete-category': 'bg-green-500 text-white',
  }[estado];

  const metadataClases = {
    pending: 'text-slate-400',
    current: 'text-blue-700',
    complete: 'text-green-700',
    'complete-category': 'text-emerald-600',
  }[estado];

  return (
    <div
      className={`rounded-xl p-3 border-2 transition-all ${clases}`}
      onClick={estado === 'complete' || estado === 'complete-category' ? onClick : undefined}
      title={
        estado === 'complete' || estado === 'complete-category'
          ? 'Click para editar'
          : undefined
      }
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-base ${estado === 'pending' ? 'opacity-50' : ''}`}>
            {icono}
          </span>
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${labelClases}`}>
            {labelRol}
          </span>
        </div>
        <span
          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${badgeClases}`}
        >
          {badge}
        </span>
      </div>
      <div className={`text-sm ${nombreClases}`}>{nombre}</div>
      {metadata && (
        <div className={`text-[10px] mt-0.5 ${metadataClases}`}>{metadata}</div>
      )}
      {extra && (
        <div className={`text-[10px] mt-1 italic ${metadataClases}`}>{extra}</div>
      )}
    </div>
  );
};

// ============================================================================
// Conector vertical entre bloques
// ============================================================================

const ConectorVertical: React.FC<{ active?: boolean }> = ({ active }) => (
  // S53.15 — h-6 → h-4 para compactar el espaciado vertical entre bloques
  <div
    className={`w-[2px] h-4 mx-auto ${
      active
        ? 'bg-green-500'
        : 'bg-[linear-gradient(to_bottom,#94a3b8_50%,transparent_50%)] bg-[length:2px_6px] bg-repeat-y'
    }`}
  />
);

// ============================================================================
// Componente principal
// ============================================================================

export const RutaVerticalSidebar: React.FC<Props> = ({
  state,
  tipoConfig,
  totalUnidades,
  totalSKUs,
  totalPrevendidas,
  totalFleteUSD,
  onJumpToPaso,
}) => {
  // Determinar estado de cada bloque según el paso actual y los datos
  const origenCompleto = !!state.ubicacionOrigenId;
  const origenCategoriaCompleta = !!state.origenCategoria && !origenCompleto;
  const destinoCompleto = !!state.ubicacionDestinoId;
  const destinoCategoriaCompleta = !!state.destinoCategoria && !destinoCompleto;
  const transitoCompleto = !!state.colaboradorTransporteId;
  const enPaso3 = state.pasoActual === 3;

  // Estado de ORIGEN
  let estadoOrigen: EstadoBloque = 'pending';
  if (origenCompleto) estadoOrigen = 'complete';
  else if (origenCategoriaCompleta) estadoOrigen = 'complete-category';
  else if (state.pasoActual === 1) estadoOrigen = 'current';

  // Estado de TRÁNSITO
  let estadoTransito: EstadoBloque = 'pending';
  if (transitoCompleto) estadoTransito = 'complete';
  else if (enPaso3) estadoTransito = 'current';

  // Estado de DESTINO
  let estadoDestino: EstadoBloque = 'pending';
  if (destinoCompleto) estadoDestino = 'complete';
  else if (destinoCategoriaCompleta) estadoDestino = 'complete-category';
  else if (state.pasoActual === 1 && origenCompleto) estadoDestino = 'current';
  else if (state.pasoActual === 2) estadoDestino = 'current';

  // Metadata del bloque ORIGEN
  const origenBandera = state.ubicacionOrigenPais
    ? paisBandera(state.ubicacionOrigenPais)
    : state.origenCategoria === 'casilla_intl'
    ? '🌎'
    : state.origenCategoria === 'almacen_peru'
    ? '🇵🇪'
    : '';
  const origenNombre = state.ubicacionOrigenNombre
    ? state.ubicacionOrigenNombre
    : state.origenCategoria === 'casilla_intl'
    ? 'Casilla internacional'
    : state.origenCategoria === 'almacen_peru'
    ? 'Almacén Perú'
    : '(por elegir)';
  const origenMetadata = state.ubicacionOrigenId
    ? `${origenBandera} ${state.ubicacionOrigenPais || ''}${
        totalUnidades > 0 ? ` · ${totalUnidades} uds` : ''
      }`
    : origenCategoriaCompleta
    ? `${origenBandera} Por refinar en Paso 1`
    : undefined;

  // Metadata del bloque DESTINO
  const destinoBandera = state.ubicacionDestinoPais
    ? paisBandera(state.ubicacionDestinoPais)
    : state.destinoCategoria === 'casilla_intl'
    ? '🌎'
    : state.destinoCategoria === 'almacen_peru'
    ? '🇵🇪'
    : state.destinoCategoria === 'almacen_tercero'
    ? '🏭'
    : '';
  const destinoNombre = state.ubicacionDestinoNombre
    ? state.ubicacionDestinoNombre
    : state.destinoCategoria === 'casilla_intl'
    ? 'Casilla internacional'
    : state.destinoCategoria === 'almacen_peru'
    ? 'Almacén Perú'
    : state.destinoCategoria === 'almacen_tercero'
    ? 'Almacén tercero'
    : '(por elegir)';
  const destinoMetadata = state.ubicacionDestinoId
    ? `${destinoBandera} ${state.ubicacionDestinoPais || ''}`
    : destinoCategoriaCompleta
    ? `${destinoBandera} Por refinar en Paso 1`
    : undefined;
  const destinoExtra =
    tipoConfig?.tipo === 'I' && state.referenciaTercero
      ? state.referenciaTercero
      : undefined;

  // Metadata del bloque TRÁNSITO (con icono dinámico por modo)
  const tIcon = iconoTransito(state.modoTransporte);
  const tLabelRol = transitoCompleto
    ? `Tránsito · ${labelTransito(state.modoTransporte)}`
    : 'Tránsito';
  const transitoNombre = transitoCompleto
    ? state.colaboradorTransporteNombre
    : '(por elegir)';
  const transitoMetadata = transitoCompleto
    ? `${tIcon} ${
        state.tipoTransportador === 'viajero'
          ? 'Viajero'
          : state.tipoTransportador === 'courier_internacional'
          ? 'Courier'
          : 'Transportista'
      }`
    : 'Se define en Paso 3';
  const transitoExtra =
    transitoCompleto && totalFleteUSD > 0
      ? `Flete: $${totalFleteUSD.toFixed(0)} USD`
      : undefined;

  return (
    <div className="sticky top-24 space-y-2.5">
      {/* Chip de tipo inferido */}
      {tipoConfig ? (
        <div
          className={`rounded-xl px-3 py-2 border ${tipoConfig.chipColor.bg} ${tipoConfig.chipColor.border}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🏷️</span>
            <div className="flex-1 min-w-0">
              <div
                className={`text-[10px] font-semibold uppercase tracking-wider ${tipoConfig.chipColor.textUpper}`}
              >
                Tipo detectado
              </div>
              <div
                className={`text-sm font-bold leading-tight ${tipoConfig.chipColor.textMain}`}
              >
                {tipoConfig.nombre}
              </div>
              <div className={`text-[11px] ${tipoConfig.chipColor.textSub}`}>
                {tipoConfig.subtitulo}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl px-3 py-2 border border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-lg opacity-40">🏷️</span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Tipo detectado
              </div>
              <div className="text-sm font-medium text-slate-500 italic">
                (por elegir)
              </div>
              <div className="text-[11px] text-slate-400">
                Elegí origen y destino
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ruta vertical — 3 bloques */}
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1">
          Ruta del envío
        </div>

        <Bloque
          estado={estadoOrigen}
          icono="📦"
          labelRol="Origen"
          nombre={origenNombre}
          metadata={origenMetadata}
          pasoRef={1}
          badge={estadoOrigen === 'complete' || estadoOrigen === 'complete-category' ? '✓' : '1'}
          onClick={() => onJumpToPaso?.(1)}
        />

        <ConectorVertical active={estadoOrigen === 'complete'} />

        <Bloque
          estado={estadoTransito}
          icono={estadoTransito === 'pending' ? '✈️' : tIcon}
          labelRol={tLabelRol}
          nombre={transitoNombre}
          metadata={transitoMetadata}
          pasoRef={3}
          badge={estadoTransito === 'complete' ? '✓' : estadoTransito === 'current' ? '⟳' : '3'}
          extra={transitoExtra}
          onClick={() => onJumpToPaso?.(3)}
        />

        <ConectorVertical active={estadoTransito === 'complete'} />

        <Bloque
          estado={estadoDestino}
          icono="🏠"
          labelRol="Destino"
          nombre={destinoNombre}
          metadata={destinoMetadata}
          pasoRef={1}
          badge={estadoDestino === 'complete' || estadoDestino === 'complete-category' ? '✓' : state.pasoActual === 2 ? '⟳' : '1'}
          extra={destinoExtra}
          onClick={() => onJumpToPaso?.(1)}
        />
      </div>

      {/* Panel de resumen · KPIs */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Resumen
        </div>
        <div className="space-y-1 text-xs">
          {tipoConfig && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Moneda:</span>
              <span className="font-semibold text-slate-700">
                {tipoConfig.moneda === 'USD' && 'USD · con TC'}
                {tipoConfig.moneda === 'PEN' && 'PEN'}
                {tipoConfig.moneda === 'MIXTA' && 'Multi-moneda'}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Unidades:</span>
            {totalUnidades > 0 ? (
              <span className="font-semibold">{totalUnidades} seleccionadas</span>
            ) : (
              <span className="text-slate-400 italic">Por elegir</span>
            )}
          </div>
          {totalSKUs > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Productos:</span>
              <span>{totalSKUs} SKUs</span>
            </div>
          )}
          {totalPrevendidas > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Pre-vendidas:</span>
              <span className="text-emerald-700 font-semibold">
                {totalPrevendidas}
              </span>
            </div>
          )}
          {totalFleteUSD > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Flete:</span>
              <span className="text-teal-700 font-semibold tabular-nums">
                ${totalFleteUSD.toFixed(0)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Banner de bloqueo de stock (solo tipo I) */}
      {tipoConfig?.bloqueaStock && totalUnidades > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-red-700 mb-1">
            🔒 Stock bloqueado
          </div>
          <div className="text-sm font-bold text-red-900 tabular-nums">
            {totalUnidades} unidades
          </div>
          <div className="text-[11px] text-red-700 mt-0.5">
            Hasta retorno o liquidación
          </div>
        </div>
      )}
    </div>
  );
};
