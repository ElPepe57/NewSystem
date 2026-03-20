import React, { useEffect, useState } from 'react';
import { formatFecha as formatDate } from '../../../utils/dateFormatters';
import {
  FileText,
  Clock,
  Users,
  Loader2,
  ChevronRight,
  Mic,
} from 'lucide-react';
import type { LlamadaIntel } from '../../../types/llamadaIntel.types';
import { llamadaIntelService } from '../../../services/llamadaIntel.service';
import { CallNotesModal } from './CallNotesModal';

const SENTIMIENTO_EMOJI: Record<string, string> = {
  positivo: '😊',
  neutral: '😐',
  tenso: '😰',
  urgente: '🚨',
};

export const CallHistoryList: React.FC = () => {
  const [historial, setHistorial] = useState<LlamadaIntel[]>([]);
  const [cargando, setCargando] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await llamadaIntelService.listarHistorial(20);
        setHistorial(data);
      } catch (error) {
        console.error('[CallHistory] Error cargando historial:', error);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);


  const formatDuration = (seg: number) => {
    const min = Math.floor(seg / 60);
    return `${min} min`;
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (historial.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <Mic className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500 font-medium">Sin grabaciones</p>
        <p className="text-xs text-gray-400 mt-1">
          Presiona el botón de micrófono durante una llamada para grabar y obtener notas de IA.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-gray-100">
        {historial.map((intel) => (
          <button
            key={intel.id}
            onClick={() => setSelectedId(intel.id)}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-50 rounded-lg shrink-0">
                <FileText className="h-4 w-4 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {intel.participantes.join(', ')}
                  </span>
                  {intel.analisis?.sentimiento && (
                    <span className="text-xs">
                      {SENTIMIENTO_EMOJI[intel.analisis.sentimiento] || ''}
                    </span>
                  )}
                </div>
                {intel.analisis?.resumenEjecutivo?.[0] && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {intel.analisis.resumenEjecutivo[0]}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(intel.audioDuracionSeg)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {intel.participantes.length}
                  </span>
                  <span>{formatDate(intel.creadoEn)}</span>
                </div>
                {intel.analisis?.tareas && intel.analisis.tareas.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                      {intel.analisis.tareas.length} tarea{intel.analisis.tareas.length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 mt-1 shrink-0" />
            </div>
          </button>
        ))}
      </div>

      {selectedId && (
        <CallNotesModal
          intelId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
};
