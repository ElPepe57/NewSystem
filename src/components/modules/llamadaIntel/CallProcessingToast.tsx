import React, { useEffect, useState } from 'react';
import { FileText, Loader2, CheckCircle2, X, AlertTriangle } from 'lucide-react';
import type { LlamadaIntel } from '../../../types/llamadaIntel.types';
import { llamadaIntelService } from '../../../services/llamadaIntel.service';
import { CallNotesModal } from './CallNotesModal';

interface CallProcessingToastProps {
  intelId: string;
  onDismiss: () => void;
}

export const CallProcessingToast: React.FC<CallProcessingToastProps> = ({ intelId, onDismiss }) => {
  const [intel, setIntel] = useState<LlamadaIntel | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const unsub = llamadaIntelService.suscribir(intelId, (data) => {
      setIntel(data);
    });
    return () => unsub();
  }, [intelId]);

  if (!intel) return null;

  const isProcessing = intel.estado === 'procesando' || intel.estado === 'subiendo' || intel.estado === 'grabando';
  const isComplete = intel.estado === 'completado';
  const isError = intel.estado === 'error';

  return (
    <>
      <div className="fixed bottom-20 right-4 z-[55] animate-in slide-in-from-right">
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
          isComplete
            ? 'bg-green-50 border-green-200'
            : isError
            ? 'bg-red-50 border-red-200'
            : 'bg-white border-gray-200'
        }`}>
          {isProcessing && (
            <>
              <Loader2 className="h-5 w-5 text-primary-500 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">Procesando llamada...</p>
                <p className="text-xs text-gray-500">Transcribiendo con IA</p>
              </div>
            </>
          )}

          {isComplete && (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">Notas listas</p>
                <p className="text-xs text-green-600">
                  {intel.analisis?.tareas?.length || 0} tareas extraídas
                </p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="ml-2 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
              >
                <FileText className="h-3 w-3" />
                Ver
              </button>
            </>
          )}

          {isError && (
            <>
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Error al procesar</p>
                <p className="text-xs text-red-500 truncate max-w-[200px]">{intel.error}</p>
              </div>
            </>
          )}

          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showModal && (
        <CallNotesModal
          intelId={intelId}
          onClose={() => {
            setShowModal(false);
            if (isComplete) onDismiss();
          }}
        />
      )}
    </>
  );
};
