import React from 'react';
import type { Requerimiento, EstadoRequerimiento } from '../../types/expectativa.types';
import { KanbanCard } from './KanbanCard';
import { KANBAN_COLUMN_DEFS } from './requerimientos.types';

interface KanbanBoardProps {
  requerimientosPorEstado: Record<EstadoRequerimiento, Requerimiento[]>;
  loading: boolean;
  selectionMode: boolean;
  selectedReqIds: Set<string>;
  onToggleSelection: (reqId: string) => void;
  onOpenDetail: (req: Requerimiento) => void;
  onAprobar: (req: Requerimiento) => void;
  onCancelar: (req: Requerimiento) => void;
  onGenerarOC: (req: Requerimiento) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  requerimientosPorEstado,
  loading,
  selectionMode,
  selectedReqIds,
  onToggleSelection,
  onOpenDetail,
  onAprobar,
  onCancelar,
  onGenerarOC
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {KANBAN_COLUMN_DEFS.map(column => (
        <div key={column.id} className="bg-gray-50 rounded-lg p-4">
          {/* Header de columna */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${column.color} mr-2`} />
              <span className="font-semibold text-gray-900">{column.label}</span>
            </div>
            <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
              {requerimientosPorEstado[column.id]?.length || 0}
            </span>
          </div>

          {/* Tarjetas */}
          <div className="space-y-3 min-h-[200px]">
            {loading ? (
              <div className="text-center text-gray-500 text-sm py-8">Cargando...</div>
            ) : requerimientosPorEstado[column.id]?.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">
                Sin requerimientos
              </div>
            ) : (
              requerimientosPorEstado[column.id]?.map(req => {
                const isSelected = selectedReqIds.has(req.id!);
                const isSelectable = selectionMode && (req.estado === 'aprobado' || req.estado === 'pendiente');
                return (
                  <KanbanCard
                    key={req.id}
                    req={req}
                    isSelected={isSelected}
                    isSelectable={isSelectable}
                    onSelect={onToggleSelection}
                    onOpenDetail={onOpenDetail}
                    onAprobar={onAprobar}
                    onCancelar={onCancelar}
                    onGenerarOC={onGenerarOC}
                  />
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
