import React, { useMemo, useState } from 'react';
import {
  X,
  Search,
  Plus,
  Check,
  ChevronRight,
  Truck,
  Info,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../design-system';
import type {
  Colaborador,
  TipoColaborador,
} from '../../types/colaborador.types';
import type { Envio } from '../../types/envio.types';
import type { Producto } from '../../types/producto.types';

// ════════════════════════════════════════════════════════════════════════════
// DespacharEnvioModal — S41 Flujo 4 (Momento 3 — asignación colaborador)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Estructura fiel al mockup `rework-subordenes-s41.html` pane-despachar:
 *
 *   Header: breadcrumb OC-XXX › SUB-XXX › ENV-XXX + "Despachar envío"
 *
 *   Grid 2-col (40/60):
 *     Izquierda: Resumen del envío
 *       - Ruta visual con flags
 *       - Contenido (productos + unidades)
 *       - Info adicional (OC origen, sub-orden, proveedor, valor, peso, recibido)
 *
 *     Derecha: Formulario de despacho
 *       - 3 cards tipo transporte (Viajero / Courier internacional / Courier externo)
 *       - Selector colaborador (filtrado por tipo) con avatares + métricas
 *       - Tracking (opcional para viajero, recomendado para courier)
 *       - Fecha despacho (obligatoria)
 *       - Nota (opcional)
 *       - Preview cambio estado (Confirmado → En Tránsito)
 *
 *   Footer: validación + botón "Despachar envío"
 */

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

  if (!isOpen) return null;

  // ─── Derivados ──────────────────────────────────────────────────────────
  // S42bl — Etiquetas dinámicas según el tipo de envío.
  // Un envío puede ser:
  //   - Tramo 1 (proveedor → casilla USA): "¿Cómo entrega el proveedor?"
  //   - Tramo 2 / casilla → Perú (via viajero/courier): "¿Cómo viaja a Perú?"
  //   - DDP directo (proveedor → Perú): "¿Cómo entrega directo a Perú?"
  //   - Entre casillas (interna_origen): "¿Cómo se mueve entre casillas?"
  const tramoContexto = ((): { pregunta: string; tomaDesde: string } => {
    const esDDP = (envio as any).esDDP === true;
    if (esDDP) {
      return {
        pregunta: '¿Cómo entrega el proveedor directo a Perú?',
        tomaDesde: 'la mercadería del proveedor',
      };
    }
    if (envio.origenTipo === 'proveedor') {
      // Tramo 1: proveedor → casilla destino (normalmente en USA/CN/etc)
      return {
        pregunta: '¿Cómo entrega el proveedor?',
        tomaDesde: 'la mercadería del proveedor',
      };
    }
    // Origen es casilla → puede ser casilla→Perú o entre casillas
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

  // ─── Breadcrumb ─────────────────────────────────────────────────────────
  const breadcrumb: string[] = [];
  if (envio.ordenCompraNumero) breadcrumb.push(envio.ordenCompraNumero);
  if (envio.subOrdenId) breadcrumb.push(envio.subOrdenId);
  breadcrumb.push(envio.numeroEnvio);

  // ═══ Render ════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        {/* ─── Header ─── */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 flex-wrap">
              {breadcrumb.map((item, i) => (
                <React.Fragment key={i}>
                  <span className="font-mono">{item}</span>
                  {i < breadcrumb.length - 1 && (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="text-lg font-semibold text-slate-800">
              Despachar envío
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── Grid 2 columnas ─── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
          {/* ─── Columna izquierda: Resumen del envío ─── */}
          <aside className="md:col-span-2 p-6 bg-slate-50 border-r border-slate-200 space-y-3">
            <div className="text-xs font-semibold text-slate-500 tracking-wide">
              RESUMEN DEL ENVÍO
            </div>

            {/* Ruta */}
            <div className="bg-white rounded-xl p-3 border border-slate-200">
              <div className="text-xs text-slate-500 mb-2">RUTA</div>
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div className="text-2xl">{getFlag(envio.origenCasillaPais)}</div>
                  <div className="text-xs font-semibold mt-1 font-mono">
                    {envio.origenCasillaCodigo || '—'}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {envio.origenCasillaNombre ||
                      envio.origenProveedorNombre ||
                      'Origen'}
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center px-2">
                  <div className="w-full h-0.5 bg-teal-200 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-teal-600 text-white text-xs px-2 py-0.5 rounded">
                      <Truck className="w-3 h-3" />
                    </div>
                  </div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-2xl">{getFlag(envio.destinoCasillaPais)}</div>
                  <div className="text-xs font-semibold mt-1 font-mono">
                    {envio.destinoCasillaCodigo || '—'}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {envio.destinoCasillaNombre || 'Destino'}
                  </div>
                </div>
              </div>
            </div>

            {/* Productos */}
            <div className="bg-white rounded-xl p-3 border border-slate-200">
              <div className="text-xs text-slate-500 mb-2">
                CONTENIDO ({totalSKUs} SKUs · {totalUnidades} unidades)
              </div>
              <div className="space-y-1.5 text-xs">
                {(envio.productosSummary ?? []).slice(0, 5).map((p) => {
                  const prodFull = productosMap?.get(p.productoId);
                  return (
                    <div
                      key={p.productoId}
                      className="flex items-center justify-between"
                    >
                      <span className="text-slate-700 truncate">
                        {prodFull?.nombreComercial ?? p.nombre ?? p.sku}{' '}
                        <span className="text-slate-400">(×{p.cantidad})</span>
                      </span>
                    </div>
                  );
                })}
                {(envio.productosSummary?.length ?? 0) > 5 && (
                  <div className="text-[10px] text-slate-400 italic">
                    + {(envio.productosSummary?.length ?? 0) - 5} productos más
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
            <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
              {envio.ordenCompraNumero && (
                <InfoRow label="OC origen">
                  <span className="font-medium text-teal-600 font-mono">
                    {envio.ordenCompraNumero}
                  </span>
                </InfoRow>
              )}
              {envio.subOrdenId && (
                <InfoRow label="Sub-orden">
                  <span className="font-medium font-mono">{envio.subOrdenId}</span>
                </InfoRow>
              )}
              {envio.origenProveedorNombre && (
                <InfoRow label="Proveedor">
                  <span className="font-medium">{envio.origenProveedorNombre}</span>
                </InfoRow>
              )}
              {envio.pesoTotalLibras !== undefined && envio.pesoTotalLibras > 0 && (
                <InfoRow label="Peso estimado">
                  <span className="font-medium tabular-nums">
                    {envio.pesoTotalLibras.toFixed(2)} lb
                  </span>
                </InfoRow>
              )}
              {envio.fechaCreacion && (
                <InfoRow label="Recibido en casilla">
                  <span className="font-medium">
                    {new Date(
                      (envio.fechaCreacion as any)?.toDate?.() ??
                        envio.fechaCreacion
                    ).toLocaleDateString('es-PE', {
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
            <div className="text-xs font-semibold text-slate-500 tracking-wide">
              DATOS DE DESPACHO
            </div>

            {/* ─── Tipo de transporte ─── */}
            <div>
              <label className="text-xs font-medium text-slate-700 mb-2 block">
                {tramoContexto.pregunta} <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <TipoTransporteCard
                  icon="✈️"
                  titulo="Viajero"
                  subtitulo="Colaborador interno"
                  selected={tipoTransporte === 'viajero'}
                  onClick={() => handleCambiarTipo('viajero')}
                />
                <TipoTransporteCard
                  icon="📦"
                  titulo="Courier internacional"
                  subtitulo="DHL, FedEx, UPS"
                  selected={tipoTransporte === 'courier_internacional'}
                  onClick={() => handleCambiarTipo('courier_internacional')}
                />
                <TipoTransporteCard
                  icon="🏢"
                  titulo="Courier externo"
                  subtitulo="Servicio tercerizado"
                  selected={tipoTransporte === 'courier_externo'}
                  onClick={() => handleCambiarTipo('courier_externo')}
                />
              </div>
            </div>

            {/* ─── Selector colaborador ─── */}
            <div>
              <label className="text-xs font-medium text-slate-700 mb-2 block">
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
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Lista */}
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {/* Header grupo */}
                <div className="bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                  ─── {tipoTransporte === 'viajero' ? 'VIAJEROS INTERNOS' :
                       tipoTransporte === 'courier_internacional' ? 'COURIERS INTERNACIONALES' :
                       'COURIERS EXTERNOS'} ({colaboradoresFiltrados.length}) ───
                </div>

                {colaboradoresFiltrados.length === 0 && !search ? (
                  <div className="p-3 text-center text-xs text-slate-400 italic">
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
                    <div className="text-xs text-slate-500 mb-2">
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
                        'w-full p-2 text-xs font-medium rounded-lg flex items-center justify-center gap-2 border border-dashed',
                        nombreNuevo === search.trim()
                          ? 'bg-teal-50 text-teal-700 border-teal-500'
                          : 'text-teal-700 hover:bg-teal-50 border-teal-300'
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

            {/* ─── Tracking ─── */}
            <div>
              <label className="text-xs font-medium text-slate-700 mb-2 block">
                Número de tracking{' '}
                {trackingObligatorio ? (
                  <span className="text-red-500">*</span>
                ) : (
                  <span className="text-slate-400 font-normal">
                    (opcional para viajeros)
                  </span>
                )}
              </label>
              <input
                type="text"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder={
                  tipoTransporte === 'viajero'
                    ? 'No aplica para viajeros'
                    : 'Ej: 1Z999AA10123456784'
                }
                className={cn(
                  'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-teal-500',
                  tipoTransporte === 'viajero'
                    ? 'border-slate-300 bg-slate-50 text-slate-600'
                    : 'border-slate-300'
                )}
              />
              <div className="text-xs text-slate-400 mt-1 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {tipoTransporte === 'viajero'
                  ? 'Los viajeros normalmente no tienen tracking. Puedes dejarlo vacío.'
                  : 'Obligatorio para courier. Permite seguimiento automático.'}
              </div>
            </div>

            {/* ─── Fecha despacho ─── */}
            <div>
              <label className="text-xs font-medium text-slate-700 mb-2 block">
                Fecha de despacho <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={fechaDespacho}
                onChange={(e) => setFechaDespacho(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-500"
              />
              <div className="text-xs text-slate-500 mt-1">
                Cuando{' '}
                {colaboradorSeleccionado?.nombre || nombreNuevo || 'el courier'}{' '}
                efectivamente toma {tramoContexto.tomaDesde}.
              </div>
            </div>

            {/* ─── Nota ─── */}
            <div>
              <label className="text-xs font-medium text-slate-700 mb-2 block">
                Nota del despacho{' '}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                placeholder="Ej: Viaja con 2 maletas adicionales, verificar peso al recibir..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* ─── Preview cambio de estado ─── */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="text-xs font-semibold text-slate-500 mb-2 tracking-wide">
                EFECTO AL DESPACHAR
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700">
                  Confirmado
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-700">
                  En Tránsito
                </span>
                <span className="text-xs text-slate-500 ml-auto">
                  + notificación a sistema de alertas
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Se actualiza el estado del envío y se activan las alertas operativas
                (aduana, incidencias, etc.)
              </div>
            </div>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <div className="flex items-center gap-3">
            {puedeDespachar ? (
              <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Datos completos, listo para despachar
              </div>
            ) : (
              <div className="text-xs text-amber-700 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Completa los campos obligatorios
              </div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!puedeDespachar}
              className={cn(
                'px-5 py-2 text-sm font-semibold rounded-lg flex items-center gap-2',
                puedeDespachar
                  ? 'bg-teal-600 text-white hover:bg-teal-700'
                  : 'bg-slate-300 text-white cursor-not-allowed'
              )}
            >
              <Truck className="w-4 h-4" />
              {enviando ? 'Despachando...' : 'Despachar envío'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Subcomponentes
// ════════════════════════════════════════════════════════════════════════════

const TipoTransporteCard: React.FC<{
  icon: string;
  titulo: string;
  subtitulo: string;
  selected: boolean;
  onClick: () => void;
}> = ({ icon, titulo, subtitulo, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'p-3 border-2 rounded-xl text-left transition-all',
      selected
        ? 'border-teal-500 bg-teal-50 shadow-sm'
        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
    )}
  >
    <div className="text-2xl mb-1">{icon}</div>
    <div className="text-xs font-semibold text-slate-700">{titulo}</div>
    <div className="text-[11px] text-slate-500 mt-0.5">{subtitulo}</div>
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

  // Color del avatar según tipo
  const avatarColor = (() => {
    if (colaborador.tipo === 'viajero')
      return selected
        ? 'bg-teal-100 text-teal-700'
        : 'bg-slate-100 text-slate-700';
    // Courier — colores por nombre (DHL rojo, FedEx morado, UPS ámbar)
    const nombre = colaborador.nombre.toLowerCase();
    if (nombre.includes('dhl')) return 'bg-red-100 text-red-700';
    if (nombre.includes('fedex')) return 'bg-purple-100 text-purple-700';
    if (nombre.includes('ups')) return 'bg-amber-100 text-amber-700';
    return selected ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-700';
  })();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full p-3 text-left transition-colors',
        selected
          ? 'bg-teal-50 border-l-4 border-l-teal-500'
          : 'hover:bg-slate-50'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0',
              avatarColor
            )}
          >
            {iniciales}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-800 text-sm truncate">
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
            <div className="text-xs text-slate-500 mt-0.5 truncate">
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
          <Check className="w-5 h-5 text-teal-600 flex-shrink-0" />
        )}
      </div>
    </button>
  );
};

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-500">{label}</span>
    {children}
  </div>
);

// ─── Helpers ────────────────────────────────────────────────────────────────

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
