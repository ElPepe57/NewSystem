import React from 'react';
import { useCollaborationStore } from '../../store/collaborationStore';
import { ACTIVIDAD_CONFIG } from '../../types/collaboration.types';
import type { ActividadReciente } from '../../types/collaboration.types';

function formatTimeAgo(timestamp: { toMillis: () => number }): string {
  const diff = Date.now() - timestamp.toMillis();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);

  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}

export const ActivityFeed: React.FC = () => {
  const actividades = useCollaborationStore(s => s.actividades);

  // Filtrar login/logout para el feed (solo mostrar acciones de negocio)
  const actividadesNegocio = actividades.filter(
    a => a.tipo !== 'usuario_conectado' && a.tipo !== 'usuario_desconectado'
  );

  if (actividadesNegocio.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-gray-400 italic">Sin actividad reciente</p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Actividad Reciente
      </h4>
      <div className="space-y-0.5">
        {actividadesNegocio.slice(0, 30).map((actividad) => (
          <ActivityItem key={actividad.id} actividad={actividad} />
        ))}
      </div>
    </div>
  );
};

const ActivityItem: React.FC<{ actividad: ActividadReciente }> = ({ actividad }) => {
  const config = ACTIVIDAD_CONFIG[actividad.tipo] || { emoji: '📌', color: 'text-gray-500' };

  return (
    <div className="flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors">
      {/* Emoji */}
      <span className="text-base mt-0.5 flex-shrink-0">{config.emoji}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800">
          <span className="font-medium">{actividad.displayName}</span>
          {' '}
          <span className="text-gray-600">{actividad.mensaje}</span>
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {formatTimeAgo(actividad.timestamp)}
        </p>
      </div>
    </div>
  );
};
