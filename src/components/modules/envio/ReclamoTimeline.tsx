/**
 * ReclamoTimeline — S54.x (D-REC-4)
 *
 * Timeline visual de los eventos procedurales de un reclamo. Renderiza el
 * array `reclamo.historial[]` como secuencia de eventos con icono, color,
 * descripción y meta.
 *
 * Sirve como insumo para auditoría y para que el usuario entienda en qué
 * fase del ciclo está el reclamo y qué pasó en cada transición.
 *
 * Compatible con reclamos legacy (sin historial[]): si el campo está vacío,
 * reconstruye un timeline básico desde los timestamps del reclamo
 * (fechaCreacion, fechaEnvio, fechaRespuesta, fechaCobro, fechaCierre).
 */
import React from 'react';
import {
  Check,
  Send,
  ShieldAlert,
  Handshake,
  Truck,
  DollarSign,
  Ban,
  Clock,
  Hourglass,
} from 'lucide-react';
import type {
  Reclamo,
  ReclamoEvento,
  TipoEventoReclamo,
} from '../../../types/reclamo.types';

interface ReclamoTimelineProps {
  reclamo: Reclamo;
}

/** Configuración visual por tipo de evento. */
const EVENTO_CONFIG: Record<
  TipoEventoReclamo,
  {
    icon: React.ComponentType<{ className?: string }>;
    bg: string;       // bg-{color}-{shade}
    text: string;     // text-{color}-{shade}
    label: string;
  }
> = {
  creado: {
    icon: Check,
    bg: 'bg-emerald-500',
    text: 'text-white',
    label: 'Creado',
  },
  editado: {
    icon: Check,
    bg: 'bg-slate-400',
    text: 'text-white',
    label: 'Editado',
  },
  enviado: {
    icon: Send,
    bg: 'bg-sky-500',
    text: 'text-white',
    label: 'Enviado',
  },
  marcado_en_disputa: {
    icon: ShieldAlert,
    bg: 'bg-amber-500',
    text: 'text-white',
    label: 'En disputa',
  },
  aceptado: {
    icon: Handshake,
    bg: 'bg-amber-600',
    text: 'text-white',
    label: 'Aceptado',
  },
  resuelto_con_reemplazo: {
    icon: Truck,
    bg: 'bg-sky-600',
    text: 'text-white',
    label: 'Reemplazo aceptado',
  },
  reemplazo_recibido: {
    icon: Check,
    bg: 'bg-emerald-600',
    text: 'text-white',
    label: 'Reemplazo recibido',
  },
  cobrado: {
    icon: DollarSign,
    bg: 'bg-emerald-600',
    text: 'text-white',
    label: 'Cobrado',
  },
  rechazado: {
    icon: Ban,
    bg: 'bg-red-500',
    text: 'text-white',
    label: 'Rechazado',
  },
  cerrado_sin_cobrar: {
    icon: Clock,
    bg: 'bg-red-500',
    text: 'text-white',
    label: 'Cerrado sin cobrar',
  },
};

/**
 * Para reclamos legacy creados antes de S54.x (sin campo historial[]),
 * reconstruye un timeline básico a partir de los timestamps del reclamo.
 */
function reconstruirHistorialLegacy(reclamo: Reclamo): ReclamoEvento[] {
  const eventos: ReclamoEvento[] = [];

  if (reclamo.fechaCreacion) {
    eventos.push({
      id: 'legacy-creado',
      tipo: 'creado',
      fecha: reclamo.fechaCreacion,
      usuarioId: reclamo.creadoPor,
      descripcion: `Reclamo creado · monto S/ ${reclamo.montoReclamadoPEN.toFixed(2)}`,
    });
  }

  if (reclamo.fechaEnvio) {
    eventos.push({
      id: 'legacy-enviado',
      tipo: 'enviado',
      fecha: reclamo.fechaEnvio,
      usuarioId: reclamo.actualizadoPor || reclamo.creadoPor,
      descripcion: `Enviado a ${reclamo.destinatarioNombre}`,
    });
  }

  if (reclamo.fechaRespuesta && reclamo.estado === 'en_disputa') {
    eventos.push({
      id: 'legacy-disputa',
      tipo: 'marcado_en_disputa',
      fecha: reclamo.fechaRespuesta,
      usuarioId: reclamo.actualizadoPor || reclamo.creadoPor,
      descripcion: reclamo.motivoDisputa
        ? `Marcado en disputa: ${reclamo.motivoDisputa}`
        : 'Marcado en disputa',
    });
  }

  if (reclamo.montoAcordadoPEN && reclamo.estado !== 'rechazado' && reclamo.estado !== 'cerrado_sin_cobrar') {
    eventos.push({
      id: 'legacy-aceptado',
      tipo: reclamo.tipoResolucion === 'reemplazo' ? 'resuelto_con_reemplazo' : 'aceptado',
      fecha: reclamo.fechaResolucion || reclamo.fechaRespuesta || reclamo.fechaCreacion,
      usuarioId: reclamo.actualizadoPor || reclamo.creadoPor,
      descripcion:
        reclamo.tipoResolucion === 'reemplazo'
          ? `Aceptado con reemplazo físico`
          : `Aceptado por S/ ${reclamo.montoAcordadoPEN.toFixed(2)}`,
    });
  }

  if (reclamo.fechaCobro && reclamo.estado === 'cobrado') {
    eventos.push({
      id: 'legacy-cobrado',
      tipo: reclamo.tipoResolucion === 'reemplazo' ? 'reemplazo_recibido' : 'cobrado',
      fecha: reclamo.fechaCobro,
      usuarioId: reclamo.cerradoPor || reclamo.actualizadoPor || reclamo.creadoPor,
      descripcion:
        reclamo.tipoResolucion === 'reemplazo'
          ? 'Reemplazo recibido · cerrado sin movimiento financiero'
          : `Cobrado S/ ${(reclamo.montoCobradoPEN || 0).toFixed(2)}`,
    });
  }

  if (reclamo.fechaCierre && (reclamo.estado === 'rechazado' || reclamo.estado === 'cerrado_sin_cobrar')) {
    eventos.push({
      id: 'legacy-cerrado',
      tipo: reclamo.estado === 'cerrado_sin_cobrar' ? 'cerrado_sin_cobrar' : 'rechazado',
      fecha: reclamo.fechaCierre,
      usuarioId: reclamo.cerradoPor || reclamo.actualizadoPor || reclamo.creadoPor,
      descripcion: reclamo.motivoRechazo
        ? `${reclamo.estado === 'cerrado_sin_cobrar' ? 'Cerrado sin cobrar' : 'Rechazado'}: ${reclamo.motivoRechazo}`
        : reclamo.estado === 'cerrado_sin_cobrar'
          ? 'Cerrado sin cobrar'
          : 'Rechazado',
    });
  }

  return eventos;
}

const ESTADOS_PENDIENTES_DE_ACCION: Reclamo['estado'][] = [
  'borrador',
  'enviado',
  'en_disputa',
  'aceptado',
];

export const ReclamoTimeline: React.FC<ReclamoTimelineProps> = ({ reclamo }) => {
  // Usa historial[] si existe; si no, reconstruye desde timestamps legacy.
  const historial =
    reclamo.historial && reclamo.historial.length > 0
      ? [...reclamo.historial].sort((a, b) => a.fecha.toMillis() - b.fecha.toMillis())
      : reconstruirHistorialLegacy(reclamo);

  if (historial.length === 0) {
    return (
      <div className="text-xs text-slate-400 italic px-3 py-2">
        Sin historial registrado.
      </div>
    );
  }

  const enEspera = ESTADOS_PENDIENTES_DE_ACCION.includes(reclamo.estado);

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase text-slate-500 mb-3">
        Historial procedural
      </div>
      <div className="relative pl-8 space-y-3">
        {/* Línea vertical de fondo */}
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200" aria-hidden="true" />

        {historial.map((evento) => {
          const config = EVENTO_CONFIG[evento.tipo];
          const Icon = config.icon;
          return (
            <div key={evento.id} className="relative">
              <div
                className={`absolute -left-[28px] top-0 w-6 h-6 rounded-full ${config.bg} ${config.text} flex items-center justify-center ring-4 ring-white`}
              >
                <Icon className="w-3 h-3" />
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {config.label}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {evento.fecha.toDate().toLocaleString('es-PE', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div className="text-[12px] text-slate-700 mt-1">{evento.descripcion}</div>
                {evento.meta?.cuentaId && (
                  <div className="text-[10px] text-slate-500 mt-1 font-mono">
                    Cuenta: {evento.meta.cuentaId.slice(0, 12)}…
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Placeholder "esperando próximo evento" cuando el reclamo NO está cerrado */}
        {enEspera && (
          <div className="relative">
            <div className="absolute -left-[28px] top-0 w-6 h-6 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 text-slate-400 flex items-center justify-center ring-4 ring-white">
              <Hourglass className="w-3 h-3" />
            </div>
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-3">
              <div className="text-sm font-medium text-slate-500">
                {reclamo.estado === 'borrador' && 'Pendiente: enviar reclamo'}
                {reclamo.estado === 'enviado' && 'Esperando respuesta del destinatario'}
                {reclamo.estado === 'en_disputa' && 'Esperando acuerdo final'}
                {reclamo.estado === 'aceptado' && 'Esperando cobro efectivo'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Acción del usuario requerida
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
