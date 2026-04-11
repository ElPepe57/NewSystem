import React, { useEffect, useState } from 'react';
import {
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  Target,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import type { LlamadaIntel } from '../../../types/llamadaIntel.types';
import { llamadaIntelService } from '../../../services/llamadaIntel.service';

interface CallNotesModalProps {
  intelId: string;
  onClose: () => void;
}

const SENTIMIENTO_CONFIG = {
  positivo: { label: 'Positivo', color: 'text-green-600 bg-green-50', icon: '😊' },
  neutral: { label: 'Neutral', color: 'text-slate-600 bg-slate-50', icon: '😐' },
  tenso: { label: 'Tenso', color: 'text-orange-600 bg-orange-50', icon: '😰' },
  urgente: { label: 'Urgente', color: 'text-red-600 bg-red-50', icon: '🚨' },
};

export const CallNotesModal: React.FC<CallNotesModalProps> = ({ intelId, onClose }) => {
  const [intel, setIntel] = useState<LlamadaIntel | null>(null);
  const [cargando, setCargando] = useState(true);
  const [tabActivo, setTabActivo] = useState<'resumen' | 'transcripcion'>('resumen');
  const [seccionesAbiertas, setSeccionesAbiertas] = useState({
    tareas: true,
    decisiones: true,
    seguimientos: true,
    alertas: true,
  });

  useEffect(() => {
    // Suscripción en tiempo real para ver progreso de procesamiento
    const unsub = llamadaIntelService.suscribir(intelId, (data) => {
      setIntel(data);
      if (data?.estado === 'completado' || data?.estado === 'error') {
        setCargando(false);
      }
    });
    return () => unsub();
  }, [intelId]);

  const toggleSeccion = (seccion: keyof typeof seccionesAbiertas) => {
    setSeccionesAbiertas(prev => ({ ...prev, [seccion]: !prev[seccion] }));
  };

  const formatDuration = (seg: number) => {
    const min = Math.floor(seg / 60);
    const s = seg % 60;
    return `${min}:${String(s).padStart(2, '0')}`;
  };

  // Loading/processing state
  if (!intel || intel.estado === 'procesando' || intel.estado === 'subiendo') {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8 text-center">
          <Loader2 className="h-12 w-12 text-teal-600 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Procesando llamada...
          </h3>
          <p className="text-sm text-slate-500">
            {intel?.estado === 'subiendo'
              ? 'Subiendo audio...'
              : 'Transcribiendo y analizando con IA. Esto puede tomar 1-2 minutos.'}
          </p>
          <button
            onClick={onClose}
            className="mt-6 px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cerrar (se procesará en segundo plano)
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (intel.estado === 'error') {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Error al procesar
          </h3>
          <p className="text-sm text-slate-500 mb-2">{intel.error || 'Error desconocido'}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const { analisis } = intel;
  const sentConfig = SENTIMIENTO_CONFIG[analisis.sentimiento] || SENTIMIENTO_CONFIG.neutral;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-600" />
              Notas de Llamada
            </h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {intel.participantes.join(', ')}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(intel.audioDuracionSeg)}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sentConfig.color}`}>
                {sentConfig.icon} {sentConfig.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-3 gap-1 border-b border-slate-100">
          <button
            onClick={() => setTabActivo('resumen')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tabActivo === 'resumen'
                ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Resumen IA
          </button>
          <button
            onClick={() => setTabActivo('transcripcion')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tabActivo === 'transcripcion'
                ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Transcripción
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {tabActivo === 'resumen' ? (
            <>
              {/* Resumen Ejecutivo */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-teal-500" />
                  Resumen Ejecutivo
                </h3>
                <ul className="space-y-1.5">
                  {analisis.resumenEjecutivo.map((punto, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="text-teal-500 mt-0.5 shrink-0">•</span>
                      {punto}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Temas Discutidos */}
              {analisis.temasDiscutidos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {analisis.temasDiscutidos.map((tema, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-full"
                    >
                      {tema}
                    </span>
                  ))}
                </div>
              )}

              {/* Tareas */}
              {analisis.tareas.length > 0 && (
                <CollapsibleSection
                  titulo="Tareas Asignadas"
                  icon={<Target className="h-4 w-4 text-blue-500" />}
                  count={analisis.tareas.length}
                  abierta={seccionesAbiertas.tareas}
                  onToggle={() => toggleSeccion('tareas')}
                >
                  <div className="space-y-2">
                    {analisis.tareas.map((tarea, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100"
                      >
                        <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800">{tarea.descripcion}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span className="font-medium text-blue-600">
                              {tarea.responsable}
                            </span>
                            {tarea.deadline && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {tarea.deadline}
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              tarea.prioridad === 'alta'
                                ? 'bg-red-100 text-red-700'
                                : tarea.prioridad === 'media'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {tarea.prioridad}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Decisiones */}
              {analisis.decisiones.length > 0 && (
                <CollapsibleSection
                  titulo="Decisiones Tomadas"
                  icon={<Lightbulb className="h-4 w-4 text-amber-500" />}
                  count={analisis.decisiones.length}
                  abierta={seccionesAbiertas.decisiones}
                  onToggle={() => toggleSeccion('decisiones')}
                >
                  <div className="space-y-2">
                    {analisis.decisiones.map((dec, i) => (
                      <div key={i} className="p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                        <p className="text-sm font-medium text-slate-800">{dec.decision}</p>
                        <p className="text-xs text-slate-500 mt-1">{dec.contexto}</p>
                        <div className="flex gap-1.5 mt-1.5">
                          {dec.involucrados.map((p, j) => (
                            <span key={j} className="text-xs text-amber-600 font-medium">
                              {p}{j < dec.involucrados.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Seguimientos */}
              {analisis.seguimientos.length > 0 && (
                <CollapsibleSection
                  titulo="Seguimientos"
                  icon={<ArrowRight className="h-4 w-4 text-green-500" />}
                  count={analisis.seguimientos.length}
                  abierta={seccionesAbiertas.seguimientos}
                  onToggle={() => toggleSeccion('seguimientos')}
                >
                  <div className="space-y-2">
                    {analisis.seguimientos.map((seg, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-2.5 bg-green-50/50 rounded-lg border border-green-100"
                      >
                        <ArrowRight className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-slate-800">{seg.accion}</p>
                          <span className="text-xs text-green-600 font-medium">
                            {seg.responsable}
                            {seg.plazo ? ` — ${seg.plazo}` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Alertas */}
              {analisis.alertas && analisis.alertas.length > 0 && (
                <CollapsibleSection
                  titulo="Alertas"
                  icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                  count={analisis.alertas.length}
                  abierta={seccionesAbiertas.alertas}
                  onToggle={() => toggleSeccion('alertas')}
                >
                  <div className="space-y-1.5">
                    {analisis.alertas.map((alerta, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2.5 bg-red-50/50 rounded-lg border border-red-100"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-800">{alerta}</p>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}
            </>
          ) : (
            /* Transcripción */
            <div className="space-y-3">
              {intel.transcripcion.length > 0 ? (
                intel.transcripcion.map((seg, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-xs text-slate-400 font-mono w-16 shrink-0 pt-0.5">
                      {seg.timestamp}
                    </span>
                    <div className="flex-1">
                      <span className="text-xs font-semibold text-teal-600">
                        {seg.hablante}
                      </span>
                      <p className="text-sm text-slate-700 mt-0.5">{seg.texto}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">
                  {intel.transcripcionTexto || 'Sin transcripción disponible'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Collapsible Section Component ─────────────────────────

interface CollapsibleSectionProps {
  titulo: string;
  icon: React.ReactNode;
  count: number;
  abierta: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  titulo,
  icon,
  count,
  abierta,
  onToggle,
  children,
}) => (
  <div>
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 w-full text-left group"
    >
      {icon}
      <span className="text-sm font-semibold text-slate-700">{titulo}</span>
      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
        {count}
      </span>
      <div className="flex-1" />
      {abierta ? (
        <ChevronUp className="h-4 w-4 text-slate-400" />
      ) : (
        <ChevronDown className="h-4 w-4 text-slate-400" />
      )}
    </button>
    {abierta && <div className="mt-2">{children}</div>}
  </div>
);
