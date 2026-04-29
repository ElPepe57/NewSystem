import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  updateDoc,
  arrayUnion,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { incidenciaOCService } from '../../../services/incidenciaOC.service';
import type { OrdenCompra } from '../../../types/ordenCompra.types';
import type { IncidenciaOC } from '../../../types/incidenciaOC.types';
import { formatFecha } from '../../../utils/dateFormatters';
import { useAuthStore } from '../../../store/authStore';
import { MessageSquare } from 'lucide-react';
import { Button } from '../../common';
import { cn } from '../../../design-system';
import { UserName } from '../../../pages/Envios/UserName';
// S55 Fase 2 — pagos viven en CC; hook reactivo lee desde movimientosCC
import { usePagosOC } from '../../../hooks/usePagosOC';

/**
 * S54 · Tanda 3 — Panel Timeline / Auditoría.
 *
 * Registra cronológicamente todo lo que pasó en la OC:
 *   · Creación / cambios de estado / pagos
 *   · Incidencias abiertas / resueltas
 *   · Comentarios internos (persisten en orden.comentariosInternos[])
 */

interface TimelineOCPanelProps {
  orden: OrdenCompra;
}

type EventoColor = 'emerald' | 'sky' | 'amber' | 'red' | 'purple' | 'slate';

interface EventoTimeline {
  id: string;
  fecha: Timestamp | Date;
  titulo: string;
  descripcion?: string;
  usuario?: string;
  color: EventoColor;
}

// Comentario interno (vive como array en el doc de la OC).
interface ComentarioInterno {
  id: string;
  texto: string;
  autor: string;
  autorNombre?: string;
  fecha: Timestamp;
}

// ─────────────────────────────────────────────────────────────────────────────

export const TimelineOCPanel: React.FC<TimelineOCPanelProps> = ({ orden }) => {
  const { user } = useAuthStore();
  const [incidencias, setIncidencias] = useState<IncidenciaOC[]>([]);
  const [comentarios, setComentarios] = useState<ComentarioInterno[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [guardando, setGuardando] = useState(false);

  // ─── Suscripción a incidencias del OC ──────────────────────────────────
  useEffect(() => {
    const unsub = incidenciaOCService.subscribeByOC(orden.id, setIncidencias);
    return unsub;
  }, [orden.id]);

  // ─── Suscripción al doc de la OC para leer comentarios ─────────────────
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'ordenesCompra', orden.id), (snap) => {
      const data = snap.data();
      const lista: ComentarioInterno[] = Array.isArray(data?.comentariosInternos)
        ? data!.comentariosInternos
        : [];
      setComentarios(lista);
    });
    return unsub;
  }, [orden.id]);

  // S55 Fase 2 — Pagos vienen del hook reactivo (CC).
  const { pagos: pagosCC } = usePagosOC(orden.id);

  // ─── Eventos derivados ─────────────────────────────────────────────────
  const eventos: EventoTimeline[] = useMemo(() => {
    const list: EventoTimeline[] = [];

    // OC creada
    if (orden.fechaCreacion) {
      list.push({
        id: 'creacion',
        fecha: orden.fechaCreacion,
        titulo: 'OC creada',
        descripcion: `${orden.productos.length} SKUs · $${orden.totalUSD.toFixed(2)} · ${orden.nombreProveedor}`,
        usuario: orden.creadoPor,
        color: 'slate',
      });
    }

    // OC confirmada
    if (orden.fechaEnviada) {
      list.push({
        id: 'confirmacion',
        fecha: orden.fechaEnviada,
        titulo: 'OC confirmada',
        descripcion: orden.recojoEnOrigen
          ? `Recojo en origen · colaborador: ${orden.colaboradorTransporteNombre || '—'}`
          : `Modalidad: ${orden.modoEntregaDetallado || 'estándar'}`,
        color: 'emerald',
      });
    }

    // En tránsito
    if (orden.fechaEnTransito) {
      list.push({
        id: 'transito',
        fecha: orden.fechaEnTransito,
        titulo: 'En tránsito',
        descripcion: orden.courier ? `Courier: ${orden.courier}` : undefined,
        color: 'sky',
      });
    }

    // Recibida
    if (orden.fechaRecibida) {
      list.push({
        id: 'recibida',
        fecha: orden.fechaRecibida,
        titulo: 'OC recibida / completada',
        color: 'emerald',
      });
    }

    // Pagos — S55 Fase 2: leídos desde CC vía hook
    for (const pago of pagosCC) {
      list.push({
        id: `pago-${pago.id}`,
        fecha: pago.fecha,
        titulo: `Pago registrado · $${pago.montoUSD.toFixed(2)}`,
        descripcion: pago.metodoPago
          ? `Método: ${pago.metodoPago}${pago.referencia ? ` · Ref: ${pago.referencia}` : ''}`
          : pago.referencia
            ? `Ref: ${pago.referencia}`
            : undefined,
        color: 'emerald',
      });
    }

    // Incidencias
    for (const inc of incidencias) {
      list.push({
        id: `inc-open-${inc.id}`,
        fecha: inc.fechaCreacion,
        titulo: `Incidencia abierta · ${inc.numero}`,
        descripcion: inc.titulo,
        usuario: inc.creadoPorNombre || inc.creadoPor,
        color: 'amber',
      });
      if (inc.fechaResolucion) {
        list.push({
          id: `inc-close-${inc.id}`,
          fecha: inc.fechaResolucion,
          titulo: `Incidencia resuelta · ${inc.numero}`,
          descripcion: inc.resolucion,
          usuario: inc.resolvidoPorNombre || inc.resolvidoPor,
          color: 'emerald',
        });
      }
    }

    // Comentarios internos
    for (const c of comentarios) {
      list.push({
        id: `com-${c.id}`,
        fecha: c.fecha,
        titulo: 'Comentario interno',
        descripcion: c.texto,
        usuario: c.autorNombre || c.autor,
        color: 'purple',
      });
    }

    // Orden: más nuevo arriba
    return list.sort((a, b) => getMs(b.fecha) - getMs(a.fecha));
  }, [
    orden.fechaCreacion,
    orden.fechaEnviada,
    orden.fechaEnTransito,
    orden.fechaRecibida,
    orden.creadoPor,
    orden.productos.length,
    orden.totalUSD,
    orden.nombreProveedor,
    orden.recojoEnOrigen,
    orden.colaboradorTransporteNombre,
    orden.modoEntregaDetallado,
    orden.courier,
    pagosCC,
    incidencias,
    comentarios,
  ]);

  // ─── Agregar comentario ────────────────────────────────────────────────
  const agregarComentario = async () => {
    if (!user || !nuevoComentario.trim()) return;
    setGuardando(true);
    try {
      const comentario: ComentarioInterno = {
        id: `COM-${Date.now()}`,
        texto: nuevoComentario.trim(),
        autor: user.uid,
        autorNombre: user.displayName || user.email || undefined,
        fecha: Timestamp.now(),
      };
      await updateDoc(doc(db, 'ordenesCompra', orden.id), {
        comentariosInternos: arrayUnion(comentario),
      });
      setNuevoComentario('');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Timeline vertical */}
      {eventos.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500 italic">
          Aún no hay eventos registrados.
        </div>
      ) : (
        <div className="relative space-y-3 pl-6">
          <div className="absolute left-[11px] top-1 bottom-1 w-0.5 bg-slate-200" />
          {eventos.map((e) => (
            <div key={e.id} className="relative">
              <div
                className={cn(
                  'absolute -left-6 w-4 h-4 rounded-full ring-2 ring-white',
                  COLORS[e.color].dot
                )}
              />
              <div className="text-xs">
                <div className="font-semibold text-slate-900">{e.titulo}</div>
                {e.descripcion && (
                  <div className="text-slate-600 mt-0.5">{e.descripcion}</div>
                )}
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {e.usuario && (
                    <>
                      <UserName userId={e.usuario} /> ·{' '}
                    </>
                  )}
                  {formatFecha(e.fecha)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agregar comentario */}
      <div className="pt-3 border-t border-slate-100">
        <div className="text-[10px] uppercase font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
          <MessageSquare className="w-3 h-3" />
          Agregar comentario interno
        </div>
        <textarea
          value={nuevoComentario}
          onChange={(e) => setNuevoComentario(e.target.value)}
          placeholder="Ej: Ya hablé con proveedor, enviarán reemplazo en próxima OC"
          rows={2}
          className="w-full text-xs border border-slate-200 rounded p-2 focus:border-teal-400 focus:outline-none"
        />
        <div className="flex justify-end mt-2">
          <Button
            variant="primary"
            onClick={agregarComentario}
            disabled={!nuevoComentario.trim() || guardando || !user}
          >
            {guardando ? 'Guardando…' : 'Agregar'}
          </Button>
        </div>
      </div>

      {/* Observaciones estáticas de la OC (si las hay) */}
      {orden.observaciones && (
        <div className="bg-slate-50 p-3 rounded-lg">
          <h4 className="font-semibold text-slate-900 mb-1 text-xs uppercase tracking-wide">
            Observaciones de la OC
          </h4>
          <p className="text-sm text-slate-700">{orden.observaciones}</p>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

const COLORS: Record<EventoColor, { dot: string }> = {
  emerald: { dot: 'bg-emerald-500' },
  sky: { dot: 'bg-sky-500' },
  amber: { dot: 'bg-amber-500' },
  red: { dot: 'bg-red-500' },
  purple: { dot: 'bg-purple-500' },
  slate: { dot: 'bg-slate-400' },
};

function getMs(f: Timestamp | Date): number {
  if (f instanceof Date) return f.getTime();
  if (typeof (f as Timestamp)?.toMillis === 'function') return (f as Timestamp).toMillis();
  return 0;
}
