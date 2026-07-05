import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Check,
  ChevronRight,
  Truck,
  Info,
  AlertCircle,
  Plane,
  Luggage,
  Building2,
} from 'lucide-react';
import { FormModalV2 } from '../../design-system';
import { PaisBadge } from './EnvioWizard/shared/PaisBadge';
import { cn } from '../../design-system';
import type {
  Colaborador,
  TipoColaborador,
} from '../../types/colaborador.types';
import type { Envio } from '../../types/envio.types';
import type { Producto } from '../../types/producto.types';
import { toDateOrNow } from '../../utils/dateFormatters';

// ════════════════════════════════════════════════════════════════════════════
// DespacharEnvioModal — FormModalV2 · chrome orange (Inventario/Envíos)
// ════════════════════════════════════════════════════════════════════════════

export type TipoTransporte = 'viajero' | 'courier_internacional' | 'courier_externo';

/** Resultado del modal — compatible con DespacharOCResult del handler existente */
export interface DespacharEnvioResult {
  courierColaboradorId?: string;
  courierNombre: string;
  numeroTracking?: string;
  fechaDespacho: Date;
  notas?: string;
  crearNuevoColaborador?: { nombre: string; tipo: TipoColaborador };
}

interface DespacharEnvioModalProps {
  isOpen: boolean;
  onClose: () => void;
  envio: Envio;
  colaboradores: Colaborador[];
  productosMap?: Map<string, Producto>;
  onConfirm: (result: DespacharEnvioResult) => Promise<void>;
}

// ─── Mapeo tipo transporte → tipo colaborador del sistema ───────────────────
const TIPO_A_COLABORADOR: Record<TipoTransporte, TipoColaborador> = {
  viajero: 'viajero',
  courier_internacional: 'courier_externo', // FedEx/DHL/UPS
  courier_externo: 'courier_externo',
};

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

export const DespacharEnvioModal: React.FC<DespacharEnvioModalProps> = ({
  isOpen,
  onClose,
  envio,
  colaboradores,
  productosMap,
  onConfirm,
}) => {
  const [tipoTransporte, setTipoTransporte] = useState<TipoTransporte>('viajero');
  const [colaboradorId, setColaboradorId] = useState<string>(
    envio.colaboradorId ?? ''
  );
  const [nombreNuevo, setNombreNuevo] = useState<string>('');
  const [search, setSearch] = useState('');
  const [tracking, setTracking] = useState<string>(envio.numeroTracking ?? '');
  const [fechaDespacho, setFechaDespacho] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [notas, setNotas] = useState<string>('');
  const [enviando, setEnviando] = useState(false);

  // ─── Derivados ──────────────────────────────────────────────────────────
  // S42bl — Etiquetas dinámicas según el tipo de envío.
  const tramoContexto = ((): { pregunta: string; tomaDesde: string } => {
    const esDDP = (envio as any).esDDP === true;
    if (esDDP) {
      return {
        pregunta: '¿Cómo entrega el proveedor directo a Perú?',
        tomaDesde: 'la mercadería del proveedor',
      };
    }
    if (envio.origenTipo === 'proveedor') {
      return {
        pregunta: '¿Cómo entrega el proveedor?',
        tomaDesde: 'la mercadería del proveedor',
      };
    }
    if (envio.destinoCasillaPais === 'Perú' || envio.destinoCasillaPais === 'Peru') {
      return {
        pregunta: '¿Cómo viaja a Perú?',
        tomaDesde: 'la mercadería de la casilla',
      };
    }
    return {
      pregunta: '¿Cómo se mueve entre casillas?',
      tomaDesde: 'la mercadería de la casilla origen',
    };
  })();

  const tipoColaboradorFiltro = TIPO_A_COLABORADOR[tipoTransporte];
  const colaboradoresFiltrados = useMemo(() => {
    const base = colaboradores.filter(
      (c) => c.tipo === tipoColaboradorFiltro && c.estado !== 'inactivo'
    );
    if (!search.trim()) return base;
    const q = search.toLowerCase().trim();
    return base.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.telefono?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [colaboradores, tipoColaboradorFiltro, search]);

  const colaboradorSeleccionado = colaboradores.find((c) => c.id === colaboradorId);
  const crearNuevo = !colaboradorId && nombreNuevo.trim().length > 0;
  const trackingObligatorio =
    tipoTransporte === 'courier_internacional' || tipoTransporte === 'courier_externo';
  const trackingValido = !trackingObligatorio || tracking.trim().length > 0;
  const colaboradorValido = !!colaboradorId || crearNuevo;
  const fechaValida = !!fechaDespacho;
  const puedeDespachar =
    colaboradorValido && trackingValido && fechaValida && !enviando;

  const totalSKUs = envio.productosSummary?.length ?? 0;
  const totalUnidades = envio.totalUnidades ?? 0;

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleCambiarTipo = (nuevoTipo: TipoTransporte) => {
    setTipoTransporte(nuevoTipo);
    setColaboradorId('');
    setNombreNuevo('');
    setSearch('');
  };

  const handleSubmit = async () => {
    if (!puedeDespachar) return;
    setEnviando(true);
    try {
      const result: DespacharEnvioResult = {
        courierColaboradorId: colaboradorSeleccionado?.id,
        courierNombre: colaboradorSeleccionado?.nombre ?? nombreNuevo.trim(),
        numeroTracking: tracking.trim() || undefined,
        fechaDespacho: new Date(fechaDespacho),
        notas: notas.trim() || undefined,
        ...(crearNuevo && {
          crearNuevoColaborador: {
            nombre: nombreNuevo.trim(),
            tipo: TIPO_A_COLABORADOR[tipoTransporte],
          },
        }),
      };
      await onConfirm(result);
    } finally {
      setEnviando(false);
    }
  };

  // ─── Subtitle para el header del modal ──────────────────────────────────
  const subtitleParts: string[] = [];
  if (envio.ordenCompraNumero) subtitleParts.push(envio.ordenCompraNumero);
  if (envio.subOrdenId) subtitleParts.push(envio.subOrdenId);
  subtitleParts.push(envio.numeroEnvio);
  const modalSubtitle = subtitleParts.join(' › ') + ' · Confirmado → En tránsito';

  // ─── Footer extras: indicador de validación ──────────────────────────────
  const footerExtras = puedeDespachar ? (
    <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
      <Check className="w-3.5 h-3.5" />
      Listo para despachar
    </span>
  ) : (
    <span className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
      <AlertCircle className="w-3.5 h-3.5" />
      Completa los campos obligatorios
    </span>
  );

  // ═══ Render ════════════════════════════════════════════════════════════
  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Despachar envío"
      subtitle={modalSubtitle}
      icon={Truck}
      iconTone="orange"
      color="orange"
      size="xl"
      submitLabel="Despachar envío"
      submitIcon={Truck}
      loading={enviando}
      disabled={!puedeDespachar}
      footerExtras={footerExtras}
    >
      {/* ─── Grid 2 columnas: resumen (izq) + formulario (der) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-0 -mx-4 -mt-4 -mb-4 sm:-mx-6 sm:-mt-5 sm:-mb-5">

        {/* ─── Columna izquierda: Resumen del envío ─── */}
        <aside className="md:col-span-2 p-6 bg-slate-50 border-r border-slate-200 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Resumen del envío
          </div>

          {/* Ruta */}
          <div className="bg-white rounded-xl p-3 border border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Ruta</div>
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <div className="flex justify-center">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <PaisBadge pais={envio.origenCasillaPais} size="md" />
                  </div>
                </div>
                <div className="text-[11px] font-semibold mt-1 font-mono">
                  {envio.origenCasillaCodigo || '—'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {envio.origenCasillaNombre ||
                    envio.origenProveedorNombre ||
                    'Origen'}
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center px-2">
                <div className="w-full h-0.5 bg-orange-200 relative">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-600 text-white px-2 py-0.5 rounded">
                    <Truck className="w-3 h-3" />
                  </div>
                </div>
              </div>
              <div className="text-center flex-1">
                <div className="flex justify-center">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <PaisBadge pais={envio.destinoCasillaPais} size="md" />
                  </div>
                </div>
                <div className="text-[11px] font-semibold mt-1 font-mono">
                  {envio.destinoCasillaCodigo || '—'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {envio.destinoCasillaNombre || 'Destino'}
                </div>
              </div>
            </div>
          </div>

          {/* Productos */}
          <div className="bg-white rounded-xl p-3 border border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Contenido ({totalSKUs} SKUs · <span className="tabular-nums">{totalUnidades}</span> unidades)
            </div>
            <div className="space-y-1.5">
              {(envio.productosSummary ?? []).slice(0, 5).map((p) => {
                const prodFull = productosMap?.get(p.productoId);
                return (
                  <div
                    key={p.productoId}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[12px] text-slate-700 truncate">
                      {prodFull?.nombreComercial ?? p.nombre ?? p.sku}{' '}
                      <span className="text-slate-400">(×<span className="tabular-nums">{p.cantidad}</span>)</span>
                    </span>
                  </div>
                );
              })}
              {(envio.productosSummary?.length ?? 0) > 5 && (
                <div className="text-[10px] text-slate-400 italic">
                  + <span className="tabular-nums">{(envio.productosSummary?.length ?? 0) - 5}</span> productos más
                </div>
              )}
              {(envio.productosSummary?.length ?? 0) === 0 && (
                <div className="text-[11px] text-slate-400 italic">
                  Sin productos registrados
                </div>
              )}
            </div>
          </div>

          {/* Info adicional */}
          <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-2">
            {envio.ordenCompraNumero && (
              <InfoRow label="OC origen">
                <span className="text-[12px] font-medium text-orange-600 font-mono">
                  {envio.ordenCompraNumero}
                </span>
              </InfoRow>
            )}
            {envio.subOrdenId && (
              <InfoRow label="Sub-orden">
                <span className="text-[12px] font-medium font-mono">{envio.subOrdenId}</span>
              </InfoRow>
            )}
            {envio.origenProveedorNombre && (
              <InfoRow label="Proveedor">
                <span className="text-[12px] font-medium">{envio.origenProveedorNombre}</span>
              </InfoRow>
            )}
            {envio.pesoTotalLibras !== undefined && envio.pesoTotalLibras > 0 && (
              <InfoRow label="Peso estimado">
                <span className="text-[12px] font-medium tabular-nums">
                  {envio.pesoTotalLibras.toFixed(2)} lb
                </span>
              </InfoRow>
            )}
            {envio.fechaCreacion && (
              <InfoRow label="Recibido en casilla">
                <span className="text-[12px] font-medium">
                  {toDateOrNow(envio.fechaCreacion).toLocaleDateString('es-PE', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </InfoRow>
            )}
          </div>
        </aside>

        {/* ─── Columna derecha: Formulario ─── */}
        <div className="md:col-span-3 p-6 space-y-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Datos de despacho
          </div>

          {/* ─── Tipo de transporte ─── */}
          <div>
            <label className="text-[12px] font-medium text-slate-700 mb-2 block">
              {tramoContexto.pregunta} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <TipoTransporteCard
                icon={Luggage}
                titulo="Viajero"
                subtitulo="Colaborador interno"
                selected={tipoTransporte === 'viajero'}
                onClick={() => handleCambiarTipo('viajero')}
              />
              <TipoTransporteCard
                icon={Plane}
                titulo="Courier intl"
                subtitulo="DHL, FedEx, UPS"
                selected={tipoTransporte === 'courier_internacional'}
                onClick={() => handleCambiarTipo('courier_internacional')}
              />
              <TipoTransporteCard
                icon={Building2}
                titulo="Courier ext"
                subtitulo="Servicio tercerizado"
                selected={tipoTransporte === 'courier_externo'}
                onClick={() => handleCambiarTipo('courier_externo')}
              />
            </div>
          </div>

          {/* ─── Selector colaborador ─── */}
          <div>
            <label className="text-[12px] font-medium text-slate-700 mb-2 block">
              {tipoTransporte === 'viajero'
                ? 'Colaborador asignado'
                : 'Courier asignado'}{' '}
              <span className="text-red-500">*</span>
            </label>

            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Buscar ${tipoTransporte === 'viajero' ? 'colaborador' : 'courier'}...`}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Lista */}
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {/* Header grupo */}
              <div className="bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                {tipoTransporte === 'viajero' ? 'VIAJEROS INTERNOS' :
                 tipoTransporte === 'courier_internacional' ? 'COURIERS INTERNACIONALES' :
                 'COURIERS EXTERNOS'}{' '}
                (<span className="tabular-nums">{colaboradoresFiltrados.length}</span>)
              </div>

              {colaboradoresFiltrados.length === 0 && !search ? (
                <div className="p-3 text-center text-[12px] text-slate-400 italic">
                  No hay {tipoTransporte === 'viajero' ? 'viajeros' : 'couriers'}{' '}
                  registrados
                </div>
              ) : (
                colaboradoresFiltrados.map((c) => (
                  <ColaboradorRow
                    key={c.id}
                    colaborador={c}
                    selected={colaboradorId === c.id}
                    onSelect={() => {
                      setColaboradorId(c.id);
                      setNombreNuevo('');
                    }}
                  />
                ))
              )}

              {/* Crear inline */}
              {search.trim() && colaboradoresFiltrados.length === 0 && (
                <div className="p-3 bg-slate-50">
                  <div className="text-[11px] text-slate-500 mb-2">
                    ¿Crear "{search.trim()}" como nuevo{' '}
                    {tipoTransporte === 'viajero' ? 'viajero' : 'courier'}?
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNombreNuevo(search.trim());
                      setColaboradorId('');
                    }}
                    className={cn(
                      'w-full p-2 text-[12px] font-medium rounded-lg flex items-center justify-center gap-2 border border-dashed',
                      nombreNuevo === search.trim()
                        ? 'bg-orange-50 text-orange-700 border-orange-500'
                        : 'text-orange-700 hover:bg-orange-50 border-orange-300'
                    )}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {nombreNuevo === search.trim()
                      ? `✓ Se creará "${nombreNuevo}"`
                      : `Crear "${search.trim()}"`}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ─── Tracking + Fecha (grid 2 col) ─── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                Tracking{' '}
                {trackingObligatorio ? (
                  <span className="text-red-500">*</span>
                ) : (
                  <span className="text-slate-400 normal-case font-normal tracking-normal">
                    (opcional)
                  </span>
                )}
              </label>
              <input
                type="text"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder={
                  tipoTransporte === 'viajero'
                    ? 'No aplica'
                    : 'Ej: 1Z999AA1...'
                }
                className={cn(
                  'w-full px-3 py-2 border rounded-lg text-[13px] tabular-nums focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500',
                  tipoTransporte === 'viajero'
                    ? 'border-slate-200 bg-slate-50 text-slate-500'
                    : 'border-slate-300 bg-white'
                )}
              />
              <div className="text-[11px] text-slate-400 mt-1 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {tipoTransporte === 'viajero'
                  ? 'Viajeros normalmente sin tracking.'
                  : 'Obligatorio para courier.'}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={fechaDespacho}
                onChange={(e) => setFechaDespacho(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-[13px] tabular-nums focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
              />
              <div className="text-[11px] text-slate-500 mt-1">
                Cuando{' '}
                {colaboradorSeleccionado?.nombre || nombreNuevo || 'el courier'}{' '}
                toma {tramoContexto.tomaDesde}.
              </div>
            </div>
          </div>

          {/* ─── Nota ─── */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
              Nota{' '}
              <span className="text-slate-400 normal-case font-normal tracking-normal">(opcional)</span>
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Ej: Viaja con 2 maletas adicionales, verificar peso al recibir..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* ─── Preview cambio de estado ─── */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Efecto al despachar
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700">
                Confirmado
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-700">
                En Tránsito
              </span>
              <span className="text-[11px] text-slate-500 ml-auto">
                + notificación a alertas operativas
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Se actualiza el estado del envío y se activan las alertas operativas
              (aduana, incidencias, etc.)
            </div>
          </div>
        </div>
      </div>
    </FormModalV2>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Subcomponentes
// ════════════════════════════════════════════════════════════════════════════

const TipoTransporteCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  subtitulo: string;
  selected: boolean;
  onClick: () => void;
}> = ({ icon: Icon, titulo, subtitulo, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'text-left rounded-lg border-2 p-2 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/30',
      selected
        ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20'
        : 'border-slate-200 bg-white hover:border-orange-300'
    )}
  >
    <div className="flex items-center justify-between mb-1">
      <Icon className={cn('w-4 h-4', selected ? 'text-orange-600' : 'text-slate-500')} />
      {selected ? (
        <Check className="w-3.5 h-3.5 text-orange-600" />
      ) : (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
      )}
    </div>
    <div className="text-[11px] font-bold text-slate-700">{titulo}</div>
    <div className="text-[10px] text-slate-500 mt-0.5">{subtitulo}</div>
  </button>
);

const ColaboradorRow: React.FC<{
  colaborador: Colaborador;
  selected: boolean;
  onSelect: () => void;
}> = ({ colaborador, selected, onSelect }) => {
  const iniciales = colaborador.nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const enviosPrevios = colaborador.metricas?.enviosCompletados ?? 0;
  const tasaExito = colaborador.metricas?.tasaExito ?? null;

  // Color del avatar según tipo (semántico · no chrome orange)
  const avatarColor = (() => {
    if (colaborador.tipo === 'viajero')
      return selected
        ? 'bg-orange-100 text-orange-700'
        : 'bg-slate-100 text-slate-700';
    const nombre = colaborador.nombre.toLowerCase();
    if (nombre.includes('dhl')) return 'bg-red-100 text-red-700';
    if (nombre.includes('fedex')) return 'bg-purple-100 text-purple-700';
    if (nombre.includes('ups')) return 'bg-amber-100 text-amber-700';
    return selected ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700';
  })();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full p-3 text-left transition-colors focus:outline-none focus:ring-1 focus:ring-inset focus:ring-orange-400',
        selected
          ? 'bg-orange-50 border-l-4 border-l-orange-500'
          : 'hover:bg-slate-50'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0',
              avatarColor
            )}
          >
            {iniciales}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-semibold text-slate-800 truncate">
                {colaborador.nombre}
              </span>
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
                  colaborador.estado === 'activo'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-600'
                )}
              >
                {colaborador.estado === 'activo' ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate tabular-nums">
              {enviosPrevios > 0 ? (
                <>
                  {enviosPrevios} envío{enviosPrevios !== 1 ? 's' : ''} previo
                  {enviosPrevios !== 1 ? 's' : ''}
                  {tasaExito !== null && ` · ${tasaExito.toFixed(0)}% entregas a tiempo`}
                </>
              ) : (
                <>Sin historial de envíos</>
              )}
            </div>
          </div>
        </div>
        {selected && (
          <Check className="w-4 h-4 text-orange-600 flex-shrink-0" />
        )}
      </div>
    </button>
  );
};

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-[11px] text-slate-500">{label}</span>
    {children}
  </div>
);
