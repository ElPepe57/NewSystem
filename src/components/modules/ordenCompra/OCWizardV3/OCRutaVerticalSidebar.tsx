/**
 * OCRutaVerticalSidebar — Sidebar vertical de ruta para OCWizardV3.
 *
 * Adapta el patrón `RutaVerticalSidebar` del Wizard de Envíos Unificado al contexto
 * de Compras. 3 bloques verticales: Proveedor -> Tránsito -> Destino.
 *
 *   - Chip de tipo de ruta arriba (via_casilla / ddp_directo / ya_en_peru)
 *   - Estados por bloque: pending | current | complete
 *   - Iconos lucide por rol + tránsito dinámico según colaborador (canon F8 · sin emojis)
 *
 * Reemplaza la mini-RouteVisual horizontal del OCWizardPreview previo.
 */
import React from 'react';
import { Package, Plane, MapPin, Hand, Home, Tag, Truck, Coins, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { OCWizardState } from './ocWizardTypes';
import type { ConfigLogistica } from './configLogistica';

interface Props {
  state: OCWizardState;
  currentStep: number; // 0=Ruta, 1=Productos, 2=Cargos, 3=Confirmar
}

type EstadoBloque = 'pending' | 'current' | 'complete';

// ============================================================================
// Helpers
// ============================================================================

interface TipoRutaInfo {
  nombre: string;
  subtitulo: string;
  chipBg: string;
  chipBorder: string;
  chipTextUpper: string;
  chipTextMain: string;
  chipTextSub: string;
}

function getTipoRutaInfo(cfg: ConfigLogistica): TipoRutaInfo | null {
  if (!cfg.proveedorId) return null;
  if (cfg.llegadaPeru === 'ddp_directo') {
    return {
      nombre: 'Entrega directa',
      subtitulo: 'Proveedor → Perú',
      chipBg: 'bg-amber-50',
      chipBorder: 'border-amber-200',
      chipTextUpper: 'text-amber-700',
      chipTextMain: 'text-amber-900',
      chipTextSub: 'text-amber-700',
    };
  }
  if (cfg.llegadaPeru === 'ya_en_peru') {
    return {
      nombre: 'Ya en Perú',
      subtitulo: 'Mercadería local',
      chipBg: 'bg-teal-50',
      chipBorder: 'border-teal-200',
      chipTextUpper: 'text-teal-700',
      chipTextMain: 'text-teal-900',
      chipTextSub: 'text-teal-700',
    };
  }
  // via_casilla (default)
  return {
    nombre: 'Vía casilla',
    subtitulo: 'Proveedor → Casilla → Perú',
    chipBg: 'bg-sky-50',
    chipBorder: 'border-sky-200',
    chipTextUpper: 'text-sky-700',
    chipTextMain: 'text-sky-900',
    chipTextSub: 'text-sky-700',
  };
}

// ============================================================================
// Bloque individual
// ============================================================================

interface BloqueProps {
  estado: EstadoBloque;
  icono: LucideIcon;
  labelRol: string;
  nombre: string;
  numero: number;
  metadata?: string;
  extra?: React.ReactNode;
}

const Bloque: React.FC<BloqueProps> = ({
  estado,
  icono: Icono,
  labelRol,
  nombre,
  numero,
  metadata,
  extra,
}) => {
  const clases = {
    pending: 'bg-slate-50 border-slate-200 border-dashed',
    current: 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/25',
    complete: 'bg-blue-50 border-blue-300',
  }[estado];

  const nombreClases = {
    pending: 'text-slate-400 italic',
    current: 'text-blue-900 font-semibold',
    complete: 'text-blue-900 font-semibold',
  }[estado];

  const labelClases = {
    pending: 'text-slate-500',
    current: 'text-blue-700',
    complete: 'text-blue-700',
  }[estado];

  const iconClases = {
    pending: 'text-slate-400 opacity-60',
    current: 'text-blue-600',
    complete: 'text-blue-600',
  }[estado];

  const badgeClases = {
    pending: 'bg-slate-200 text-slate-400',
    current: 'bg-blue-500 text-white',
    complete: 'bg-blue-500 text-white',
  }[estado];

  const metadataClases = {
    pending: 'text-slate-400',
    current: 'text-blue-700',
    complete: 'text-blue-700',
  }[estado];

  return (
    <div className={`rounded-xl p-3 border-2 transition-all ${clases}`}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icono className={`w-4 h-4 ${iconClases}`} />
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider ${labelClases}`}
          >
            {labelRol}
          </span>
        </div>
        <span
          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold tabular-nums ${badgeClases}`}
        >
          {estado === 'complete' ? <Check className="w-3 h-3" /> : numero}
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
// Componente principal
// ============================================================================

export const OCRutaVerticalSidebar: React.FC<Props> = ({ state, currentStep }) => {
  const cfg = state.configLogistica;
  const tipoInfo = getTipoRutaInfo(cfg);
  const enPasoRuta = currentStep === 0;

  // Determinar estados de los 3 bloques
  const proveedorCompleto = !!cfg.proveedorId;
  const destinoCompleto =
    cfg.llegadaPeru === 'ddp_directo' || cfg.llegadaPeru === 'ya_en_peru'
      ? true // para estos tipos el destino es implícito (Perú)
      : !!cfg.casillaDestinoId;
  const transitoCompleto =
    cfg.llegadaPeru === 'ddp_directo' || cfg.llegadaPeru === 'ya_en_peru'
      ? true // no hay tránsito explícito en estos tipos
      : !!cfg.salidaProveedor;

  // PROVEEDOR
  let estadoProveedor: EstadoBloque = 'pending';
  if (proveedorCompleto) estadoProveedor = 'complete';
  else if (enPasoRuta) estadoProveedor = 'current';

  // TRÁNSITO
  let estadoTransito: EstadoBloque = 'pending';
  if (transitoCompleto && proveedorCompleto) estadoTransito = 'complete';
  else if (enPasoRuta && proveedorCompleto) estadoTransito = 'current';

  // DESTINO
  let estadoDestino: EstadoBloque = 'pending';
  if (destinoCompleto && proveedorCompleto) estadoDestino = 'complete';
  else if (enPasoRuta && proveedorCompleto) estadoDestino = 'current';

  // Contenido de los bloques (país como texto · sin emoji de bandera · canon F8)
  const proveedorNombre = cfg.proveedorNombre || '(por elegir)';
  const proveedorMetadata = cfg.proveedorId ? cfg.paisOrigen || undefined : undefined;

  // Tránsito depende de salidaProveedor y colaborador
  const transitoIcono: LucideIcon =
    cfg.llegadaPeru === 'ddp_directo'
      ? Plane
      : cfg.llegadaPeru === 'ya_en_peru'
      ? MapPin
      : cfg.salidaProveedor === 'recojo_en_origen'
      ? Hand
      : Package;
  const transitoLabelRol = cfg.llegadaPeru === 'ddp_directo' ? 'Tránsito · DDP' : 'Tránsito';
  const transitoNombre = (() => {
    if (cfg.llegadaPeru === 'ddp_directo') return 'Vuelo directo a Perú';
    if (cfg.llegadaPeru === 'ya_en_peru') return 'Sin tránsito';
    if (!cfg.salidaProveedor) return '(por elegir)';
    return cfg.salidaProveedor === 'proveedor_envia'
      ? 'Proveedor envía'
      : 'Recojo en origen';
  })();
  const transitoMetadata = (() => {
    if (cfg.llegadaPeru === 'ddp_directo') return 'El proveedor despacha directo';
    if (cfg.llegadaPeru === 'ya_en_peru') return 'Mercadería ya en almacén';
    if (!cfg.salidaProveedor) return 'Se define en Paso 1';
    return cfg.salidaProveedor === 'proveedor_envia'
      ? 'El proveedor despacha a la casilla'
      : 'Colaborador recoge del proveedor';
  })();
  const transitoExtra = cfg.colaboradorNombre ? (
    <span className="inline-flex items-center gap-1">
      <Truck className="w-3 h-3" /> {cfg.colaboradorNombre}
    </span>
  ) : undefined;

  // Destino
  const destinoIcono: LucideIcon = cfg.llegadaPeru === 'ddp_directo' ? MapPin : Home;
  const destinoLabelRol = cfg.llegadaPeru === 'ddp_directo' ? 'Destino · PE' : 'Destino';
  const destinoNombre = (() => {
    if (cfg.llegadaPeru === 'ddp_directo') return 'Almacén Perú';
    if (cfg.llegadaPeru === 'ya_en_peru') return 'Almacén local';
    if (!cfg.casillaDestinoId) return '(por elegir)';
    return cfg.casillaDestinoNombre || 'Casilla';
  })();
  const destinoMetadata = (() => {
    if (cfg.llegadaPeru === 'ddp_directo') return 'Perú';
    if (cfg.llegadaPeru === 'ya_en_peru') return 'Stock local';
    if (!cfg.casillaDestinoId) return undefined;
    const partes = [cfg.casillaDestinoPais || '', cfg.casillaDestinoCodigo || '']
      .filter(Boolean)
      .join(' · ');
    return partes || undefined;
  })();

  return (
    <div className="space-y-3">
      {/* Chip de tipo de ruta */}
      {tipoInfo ? (
        <div
          className={`rounded-xl px-3 py-2 border ${tipoInfo.chipBg} ${tipoInfo.chipBorder}`}
        >
          <div className="flex items-center gap-2">
            <Tag className={`w-5 h-5 flex-shrink-0 ${tipoInfo.chipTextUpper}`} />
            <div className="flex-1 min-w-0">
              <div
                className={`text-[10px] font-semibold uppercase tracking-wider ${tipoInfo.chipTextUpper}`}
              >
                Tipo de ruta
              </div>
              <div
                className={`text-sm font-bold leading-tight ${tipoInfo.chipTextMain}`}
              >
                {tipoInfo.nombre}
              </div>
              <div className={`text-[11px] ${tipoInfo.chipTextSub}`}>
                {tipoInfo.subtitulo}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl px-3 py-2 border border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 flex-shrink-0 text-slate-400" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Tipo de ruta
              </div>
              <div className="text-sm font-medium text-slate-500 italic">
                (por definir)
              </div>
              <div className="text-[11px] text-slate-400">
                Elegí proveedor y ruta
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ruta vertical · 3 bloques (S53.17: sin conector, estilo minimalista) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1">
          Ruta de la OC
        </div>

        <div className="space-y-2">
          <Bloque
            estado={estadoProveedor}
            icono={Package}
            labelRol="Proveedor"
            nombre={proveedorNombre}
            metadata={proveedorMetadata}
            numero={1}
          />

          <Bloque
            estado={estadoTransito}
            icono={transitoIcono}
            labelRol={transitoLabelRol}
            nombre={transitoNombre}
            metadata={transitoMetadata}
            extra={transitoExtra}
            numero={2}
          />

          <Bloque
            estado={estadoDestino}
            icono={destinoIcono}
            labelRol={destinoLabelRol}
            nombre={destinoNombre}
            metadata={destinoMetadata}
            numero={3}
          />
        </div>
      </div>

      {/* Deudor alternativo (si aplica) */}
      {cfg.deudorTipo === 'colaborador' && cfg.deudorNombre && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-1 flex items-center gap-1">
            <Coins className="w-3 h-3" /> Deudor alternativo
          </div>
          <div className="text-sm font-semibold text-amber-900">
            {cfg.deudorNombre}
          </div>
          <div className="text-[11px] text-amber-700 mt-0.5">
            Colaborador adelantó el pago
          </div>
        </div>
      )}
    </div>
  );
};
