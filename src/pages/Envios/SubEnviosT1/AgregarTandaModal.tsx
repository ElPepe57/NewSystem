/**
 * AgregarTandaModal — Modal para agregar una nueva sub-tanda (SubEnvioT1)
 * a un envío T1 existente (casos A/B/D).
 *
 * UI (basada en mockup pixel-perfect docs/mockups/envios-transversal-s43.html
 *     tab "Sub-envios T1 (Amazon)" sección "Modal + Agregar tanda"):
 *  - Campos tracking (opcional) + fecha estimada
 *  - Picker de unidades disponibles (las no asignadas a otras tandas normales)
 *    agrupadas por producto con stepper +/-
 *  - Radio estado inicial: Pendiente (default) / En tránsito
 *  - Resumen al pie + botones Cancelar / Crear tanda
 *
 * Este componente es presentacional puro — recibe unidades disponibles ya
 * filtradas por el padre (el padre debe excluir las que están en otras tandas
 * normales del mismo envío padre).
 */
import React, { useMemo, useState } from 'react';
import { Package, X } from 'lucide-react';
import { Modal, Button } from '../../../components/common';
import { cn } from '../../../design-system';

// ════════════════════════════════════════════════════════════════════════════
// Tipos
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
  /** Título opcional del modal — default "Nueva tanda de despacho del proveedor" */
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
  titulo = 'Nueva tanda de despacho del proveedor',
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

  const handleConfirm = async () => {
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

  if (!isOpen) return null;

  return (
    <Modal isOpen onClose={loading ? () => {} : onClose} title={titulo} size="lg">
      {subtitulo && (
        <p className="text-xs text-slate-500 -mt-2 mb-3">{subtitulo}</p>
      )}

      <div className="space-y-4">
        {/* Info de la tanda */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Tracking del proveedor <span className="text-slate-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Ej. TBA12345ABC"
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
            <div className="text-[10px] text-slate-500 mt-1">
              Lo puedes dejar vacío si aún no te lo envían
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Fecha estimada de entrega <span className="text-slate-400">(opcional)</span>
            </label>
            <input
              type="date"
              value={fechaEstimada}
              onChange={(e) => setFechaEstimada(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
            <div className="text-[10px] text-slate-500 mt-1">
              Según email del proveedor si lo indicó
            </div>
          </div>
        </div>

        {/* Picker de unidades */}
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-2">
            Unidades a incluir en esta tanda <span className="text-red-500">*</span>
          </label>
          <div className="text-xs text-slate-600 mb-2">
            Solo se muestran las unidades sin asignar a otras tandas.
          </div>

          {productosAgrupados.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <Package className="w-6 h-6 text-amber-600 mx-auto mb-2" aria-hidden />
              <div className="text-sm font-medium text-amber-900">
                No hay unidades disponibles
              </div>
              <div className="text-xs text-amber-700 mt-1">
                Todas las unidades del envío ya están asignadas a otras tandas. Elimina o edita
                una tanda pendiente para liberar unidades.
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
              {productosAgrupados.map((grupo) => {
                const cantidad = cantidadPorProducto[grupo.productoId] || 0;
                const disponibles = grupo.unidades.length;
                return (
                  <div key={grupo.productoId} className="bg-slate-50 px-3 py-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {grupo.emoji && <span className="text-lg flex-shrink-0" aria-hidden>{grupo.emoji}</span>}
                      <span className="font-medium text-sm text-slate-900 truncate">
                        {grupo.nombre}
                      </span>
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        · disponibles: {disponibles}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg overflow-hidden flex-shrink-0">
                      <button
                        type="button"
                        disabled={loading || cantidad === 0}
                        onClick={() => setCantidad(grupo.productoId, cantidad - 1)}
                        className="w-7 h-7 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Disminuir cantidad"
                      >
                        −
                      </button>
                      <span className={cn(
                        'w-8 text-center text-sm font-bold tabular-nums',
                        cantidad === 0 && 'text-slate-400'
                      )}>
                        {cantidad}
                      </span>
                      <button
                        type="button"
                        disabled={loading || cantidad >= disponibles}
                        onClick={() => setCantidad(grupo.productoId, cantidad + 1)}
                        className="w-7 h-7 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Aumentar cantidad"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalSeleccionadas > 0 && (
            <div className="text-xs text-slate-600 mt-2">
              <strong>{totalSeleccionadas}</strong> unidad{totalSeleccionadas !== 1 ? 'es' : ''}{' '}
              seleccionada{totalSeleccionadas !== 1 ? 's' : ''} · {totalProductos} producto{totalProductos !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Estado inicial */}
        <div className="p-3 bg-slate-50 rounded border border-slate-200">
          <label className="text-xs font-medium text-slate-700 block mb-2">
            Estado inicial de la tanda
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label
              className={cn(
                'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
                estadoInicial === 'pendiente'
                  ? 'border-2 border-violet-400 bg-violet-50'
                  : 'border border-slate-200 hover:border-slate-300'
              )}
            >
              <input
                type="radio"
                name="estado"
                value="pendiente"
                checked={estadoInicial === 'pendiente'}
                onChange={() => setEstadoInicial('pendiente')}
                disabled={loading}
                className="w-4 h-4"
              />
              <div>
                <div className="text-sm font-medium text-slate-900">⏳ Pendiente</div>
                <div className="text-[10px] text-slate-600">Aún no sale, solo planificación</div>
              </div>
            </label>
            <label
              className={cn(
                'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
                estadoInicial === 'en_transito'
                  ? 'border-2 border-violet-400 bg-violet-50'
                  : 'border border-slate-200 hover:border-slate-300'
              )}
            >
              <input
                type="radio"
                name="estado"
                value="en_transito"
                checked={estadoInicial === 'en_transito'}
                onChange={() => setEstadoInicial('en_transito')}
                disabled={loading}
                className="w-4 h-4"
              />
              <div>
                <div className="text-sm font-medium text-slate-900">🚚 En tránsito</div>
                <div className="text-[10px] text-slate-600">Ya salió (tienes tracking)</div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={!puedeConfirmar}
        >
          {loading ? 'Creando...' : 'Crear tanda'}
        </Button>
      </div>
    </Modal>
  );
};

// Re-export utility icon por si el consumidor lo necesita
export { X };
