/**
 * AgregarTandaModal — Modal para agregar una nueva sub-tanda (SubEnvioT1)
 * a un envío T1 existente (casos A/B/D).
 *
 * Migrado a FormModalV2 con chrome orange (Inventario).
 * Layout basado en Acto 11 · modal 10 del mockup envios-master-v1.html.
 *
 * Este componente es presentacional puro — recibe unidades disponibles ya
 * filtradas por el padre (el padre debe excluir las que están en otras tandas
 * normales del mismo envío padre).
 */
import React, { useMemo, useState } from 'react';
import { PackagePlus, Clock, Truck, Package } from 'lucide-react';
import { FormModalV2 } from '../../../design-system';
import { cn } from '../../../design-system';

// ════════════════════════════════════════════════════════════════════════════
// Tipos (interfaz pública sin cambios — no rompe padres)
// ════════════════════════════════════════════════════════════════════════════

export interface AgregarTandaModalUnidad {
  unidadId: string;
  productoId: string;
  productoNombre: string;
  productoEmoji?: string;
  codigoUnidad: string;
}

export interface AgregarTandaModalResult {
  unidadesIds: string[];
  numeroTrackingProveedor?: string;
  fechaEstimadaEntrega?: Date;
  estadoInicial: 'pendiente' | 'en_transito';
}

export interface AgregarTandaModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Unidades disponibles (el padre ya filtró las asignadas a otras tandas) */
  unidadesDisponibles: AgregarTandaModalUnidad[];
  /** Título opcional del modal — default "Agregar tanda" */
  titulo?: string;
  /** Subtítulo contextual opcional (ej: "Envío ENV-2026-123") */
  subtitulo?: string;
  /** Callback al confirmar — recibe los datos para crear la tanda */
  onConfirm: (result: AgregarTandaModalResult) => void | Promise<void>;
  /** Loading externo (durante la llamada al servicio) */
  loading?: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// Componente
// ════════════════════════════════════════════════════════════════════════════

export const AgregarTandaModal: React.FC<AgregarTandaModalProps> = ({
  isOpen,
  onClose,
  unidadesDisponibles,
  titulo = 'Agregar tanda',
  subtitulo,
  onConfirm,
  loading: loadingExt = false,
}) => {
  // Estado local del formulario
  const [tracking, setTracking] = useState('');
  const [fechaEstimada, setFechaEstimada] = useState<string>('');
  const [estadoInicial, setEstadoInicial] = useState<'pendiente' | 'en_transito'>('pendiente');
  const [cantidadPorProducto, setCantidadPorProducto] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const loading = loadingExt || submitting;

  // Agrupar unidades por producto
  const productosAgrupados = useMemo(() => {
    const groups = new Map<
      string,
      { productoId: string; nombre: string; emoji?: string; unidades: AgregarTandaModalUnidad[] }
    >();
    for (const u of unidadesDisponibles) {
      const existing = groups.get(u.productoId);
      if (existing) {
        existing.unidades.push(u);
      } else {
        groups.set(u.productoId, {
          productoId: u.productoId,
          nombre: u.productoNombre,
          emoji: u.productoEmoji,
          unidades: [u],
        });
      }
    }
    return Array.from(groups.values());
  }, [unidadesDisponibles]);

  // Derivar IDs de unidades seleccionadas (FIFO: primeras N del producto)
  const unidadesSeleccionadas = useMemo(() => {
    const ids: string[] = [];
    for (const grupo of productosAgrupados) {
      const cant = cantidadPorProducto[grupo.productoId] || 0;
      ids.push(...grupo.unidades.slice(0, cant).map((u) => u.unidadId));
    }
    return ids;
  }, [productosAgrupados, cantidadPorProducto]);

  const totalSeleccionadas = unidadesSeleccionadas.length;
  const totalProductos = Object.values(cantidadPorProducto).filter((c) => c > 0).length;
  const puedeConfirmar = totalSeleccionadas > 0 && !loading;

  // Handlers
  const setCantidad = (productoId: string, cantidad: number) => {
    setCantidadPorProducto((prev) => ({
      ...prev,
      [productoId]: Math.max(0, cantidad),
    }));
  };

  const handleSubmit = async () => {
    if (!puedeConfirmar) return;
    setSubmitting(true);
    try {
      await onConfirm({
        unidadesIds: unidadesSeleccionadas,
        numeroTrackingProveedor: tracking.trim() || undefined,
        fechaEstimadaEntrega: fechaEstimada ? new Date(fechaEstimada) : undefined,
        estadoInicial,
      });
      // Reset al cerrar (el padre se encarga de onClose tras onConfirm OK)
      setTracking('');
      setFechaEstimada('');
      setEstadoInicial('pendiente');
      setCantidadPorProducto({});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      onSubmit={handleSubmit}
      title={titulo}
      subtitle={subtitulo}
      icon={PackagePlus}
      iconTone="orange"
      color="orange"
      size="lg"
      submitLabel="Crear tanda"
      submitIcon={PackagePlus}
      loading={loading}
      disabled={!puedeConfirmar}
    >
      <div className="space-y-3">
        {/* Tracking + fecha estimada */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Tracking proveedor
            </span>
            <input
              type="text"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="TRK-…"
              disabled={loading}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-60"
            />
            <div className="text-[10px] text-slate-500 mt-1">
              Opcional — puedes dejarlo vacío si aún no te lo envían
            </div>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Fecha estimada
            </span>
            <input
              type="date"
              value={fechaEstimada}
              onChange={(e) => setFechaEstimada(e.target.value)}
              disabled={loading}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-700 bg-white tabular-nums focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-60"
            />
            <div className="text-[10px] text-slate-500 mt-1">
              Según email del proveedor si lo indicó
            </div>
          </div>
        </div>

        {/* Picker de unidades */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Unidades sin asignar
          </span>

          {productosAgrupados.length === 0 ? (
            <div className="mt-1 p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <Package className="w-6 h-6 text-amber-600 mx-auto mb-2" aria-hidden />
              <div className="text-[12px] font-medium text-amber-900">
                No hay unidades disponibles
              </div>
              <div className="text-[11px] text-amber-700 mt-1">
                Todas las unidades del envío ya están asignadas a otras tandas. Elimina o edita
                una tanda pendiente para liberar unidades.
              </div>
            </div>
          ) : (
            <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
              {productosAgrupados.map((grupo) => {
                const cantidad = cantidadPorProducto[grupo.productoId] || 0;
                const disponibles = grupo.unidades.length;
                return (
                  <div
                    key={grupo.productoId}
                    className="flex items-center justify-between px-3 py-2 bg-white"
                  >
                    <span className="text-[12px] text-slate-700 truncate flex-1 min-w-0">
                      {grupo.emoji && <span className="mr-1 select-none" aria-hidden>{grupo.emoji}</span>}
                      {grupo.nombre}
                      <span className="text-slate-400"> · disponibles: {disponibles}</span>
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        disabled={loading || cantidad === 0}
                        onClick={() => setCantidad(grupo.productoId, cantidad - 1)}
                        className="w-6 h-6 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Disminuir cantidad"
                      >
                        <span className="text-[13px] leading-none">−</span>
                      </button>
                      <span
                        className={cn(
                          'text-[13px] font-bold tabular-nums text-slate-900 w-6 text-center',
                          cantidad === 0 && 'text-slate-400',
                        )}
                      >
                        {cantidad}
                      </span>
                      <button
                        type="button"
                        disabled={loading || cantidad >= disponibles}
                        onClick={() => setCantidad(grupo.productoId, cantidad + 1)}
                        className="w-6 h-6 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Aumentar cantidad"
                      >
                        <span className="text-[13px] leading-none">+</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumen · semántico slate (neutro · conteo operativo) */}
        <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
          <span className="text-[11px] text-slate-500 font-medium">Resumen</span>
          <span className="text-[12px] font-semibold tabular-nums text-slate-700">
            {totalSeleccionadas > 0
              ? `${totalSeleccionadas} ud${totalSeleccionadas !== 1 ? 's' : ''} · ${totalProductos} producto${totalProductos !== 1 ? 's' : ''}`
              : 'Sin unidades seleccionadas'}
          </span>
        </div>

        {/* Estado inicial · toggle card-style · chrome orange */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Estado inicial
          </span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => setEstadoInicial('pendiente')}
              className={cn(
                'text-left rounded-lg border-2 p-2.5 transition-colors',
                estadoInicial === 'pendiente'
                  ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20'
                  : 'border-slate-200 bg-white hover:border-orange-300',
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <Clock
                  className={cn(
                    'w-4 h-4',
                    estadoInicial === 'pendiente' ? 'text-orange-600' : 'text-slate-500',
                  )}
                  aria-hidden
                />
                {estadoInicial === 'pendiente' ? (
                  <svg className="w-3.5 h-3.5 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
                )}
              </div>
              <div
                className={cn(
                  'text-[12px]',
                  estadoInicial === 'pendiente'
                    ? 'font-bold text-slate-900'
                    : 'font-medium text-slate-600',
                )}
              >
                Pendiente
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Aún no sale, solo planificación</div>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => setEstadoInicial('en_transito')}
              className={cn(
                'text-left rounded-lg border-2 p-2.5 transition-colors',
                estadoInicial === 'en_transito'
                  ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20'
                  : 'border-slate-200 bg-white hover:border-orange-300',
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <Truck
                  className={cn(
                    'w-4 h-4',
                    estadoInicial === 'en_transito' ? 'text-orange-600' : 'text-slate-500',
                  )}
                  aria-hidden
                />
                {estadoInicial === 'en_transito' ? (
                  <svg className="w-3.5 h-3.5 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
                )}
              </div>
              <div
                className={cn(
                  'text-[12px]',
                  estadoInicial === 'en_transito'
                    ? 'font-bold text-slate-900'
                    : 'font-medium text-slate-600',
                )}
              >
                En tránsito
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Ya salió (tienes tracking)</div>
            </button>
          </div>
        </div>
      </div>
    </FormModalV2>
  );
};
