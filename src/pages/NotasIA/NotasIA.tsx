import React, { useEffect, useState, useMemo } from 'react';
import { formatFecha as formatDate } from '../../utils/dateFormatters';
import {
  FileText,
  Clock,
  Users,
  Loader2,
  Target,
  CheckCircle2,
  Circle,
  PlayCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Mic,
  Search,
  Filter,
  AlertTriangle,
  ArrowRight,
  Lightbulb,
  MessageSquare,
  Calendar,
  User,
} from 'lucide-react';
import type {
  LlamadaIntel,
  TareaExtraida,
  EstadoTarea,
} from '../../types/llamadaIntel.types';
import type { UserProfile } from '../../types/auth.types';
import { llamadaIntelService } from '../../services/llamadaIntel.service';
import { CallNotesModal } from '../../components/modules/llamadaIntel/CallNotesModal';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../lib/firebase';
import { collection, getDocs, where, query } from 'firebase/firestore';
import { COLLECTIONS } from '../../config/collections';

// ─── Constants ──────────────────────────────────────────────
const SENTIMIENTO_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  positivo: { label: 'Positivo', color: 'text-green-600 bg-green-50', icon: '😊' },
  neutral: { label: 'Neutral', color: 'text-gray-600 bg-gray-50', icon: '😐' },
  tenso: { label: 'Tenso', color: 'text-orange-600 bg-orange-50', icon: '😰' },
  urgente: { label: 'Urgente', color: 'text-red-600 bg-red-50', icon: '🚨' },
};

const ESTADO_TAREA_CONFIG: Record<EstadoTarea, { label: string; color: string; bg: string; icon: React.FC<{ className?: string }> }> = {
  pendiente: { label: 'Pendiente', color: 'text-gray-600', bg: 'bg-gray-100', icon: Circle },
  en_progreso: { label: 'En Progreso', color: 'text-blue-600', bg: 'bg-blue-100', icon: PlayCircle },
  completada: { label: 'Completada', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle2 },
  cancelada: { label: 'Cancelada', color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
};

type TabActivo = 'llamadas' | 'tareas';
type FiltroTareas = 'todas' | 'pendiente' | 'en_progreso' | 'completada' | 'mis_tareas';

// ─── Main Page ──────────────────────────────────────────────
export const NotasIA: React.FC = () => {
  const [historial, setHistorial] = useState<LlamadaIntel[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tabActivo, setTabActivo] = useState<TabActivo>('llamadas');
  const [selectedIntelId, setSelectedIntelId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTareas, setFiltroTareas] = useState<FiltroTareas>('mis_tareas');
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  const currentUser = useAuthStore(s => s.userProfile);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'gerente';

  // Cargar historial de llamadas
  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await llamadaIntelService.listarHistorial(50);
        setHistorial(data);
      } catch (error) {
        console.error('[NotasIA] Error cargando historial:', error);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  // Cargar miembros del equipo para asignar tareas
  useEffect(() => {
    const cargarEquipo = async () => {
      try {
        const q = query(
          collection(db, COLLECTIONS.USERS),
          where('activo', '==', true)
        );
        const snap = await getDocs(q);
        const users = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
        setTeamMembers(users);
      } catch (error) {
        console.error('[NotasIA] Error cargando equipo:', error);
      }
    };
    cargarEquipo();
  }, []);

  // Extraer todas las tareas de todas las llamadas
  const todasLasTareas = useMemo(() => {
    const resultado: { intel: LlamadaIntel; tareaIndex: number; tarea: TareaExtraida }[] = [];
    for (const intel of historial) {
      if (!intel.analisis?.tareas) continue;
      intel.analisis.tareas.forEach((tarea, idx) => {
        resultado.push({ intel, tareaIndex: idx, tarea });
      });
    }
    return resultado;
  }, [historial]);

  // Filtrar tareas
  const tareasFiltradas = useMemo(() => {
    let filtered = todasLasTareas;

    if (filtroTareas === 'mis_tareas') {
      filtered = filtered.filter(t => t.tarea.responsableUid === currentUser?.uid);
    } else if (filtroTareas !== 'todas') {
      filtered = filtered.filter(t => {
        const estado = t.tarea.estado || (t.tarea.completada ? 'completada' : 'pendiente');
        return estado === filtroTareas;
      });
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      filtered = filtered.filter(t =>
        t.tarea.descripcion.toLowerCase().includes(q) ||
        t.tarea.responsable.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [todasLasTareas, filtroTareas, busqueda, currentUser?.uid]);

  // Filtrar llamadas por búsqueda
  const llamadasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return historial;
    const q = busqueda.toLowerCase();
    return historial.filter(intel =>
      intel.participantes.some(p => p.toLowerCase().includes(q)) ||
      intel.analisis?.resumenEjecutivo?.some(r => r.toLowerCase().includes(q)) ||
      intel.analisis?.temasDiscutidos?.some(t => t.toLowerCase().includes(q))
    );
  }, [historial, busqueda]);

  // Filtrar tareas del usuario actual
  const misTareas = useMemo(() => {
    if (!currentUser?.uid) return [];
    return todasLasTareas.filter(t =>
      t.tarea.responsableUid === currentUser.uid
    );
  }, [todasLasTareas, currentUser?.uid]);

  // KPIs basados en contexto del usuario
  const kpis = useMemo(() => {
    const tareasBase = isAdmin ? todasLasTareas : misTareas;
    const total = tareasBase.length;
    const pendientes = tareasBase.filter(t => {
      const e = t.tarea.estado || (t.tarea.completada ? 'completada' : 'pendiente');
      return e === 'pendiente' || e === 'en_progreso';
    }).length;
    const completadas = tareasBase.filter(t => {
      const e = t.tarea.estado || (t.tarea.completada ? 'completada' : 'pendiente');
      return e === 'completada';
    }).length;
    const alta = tareasBase.filter(t => {
      const e = t.tarea.estado || (t.tarea.completada ? 'completada' : 'pendiente');
      return t.tarea.prioridad === 'alta' && e !== 'completada' && e !== 'cancelada';
    }).length;
    return { total, pendientes, completadas, alta };
  }, [todasLasTareas, misTareas, isAdmin]);

  const handleActualizarTarea = async (
    intelId: string,
    tareaIndex: number,
    updates: { estado?: EstadoTarea; responsableUid?: string; responsable?: string }
  ) => {
    try {
      await llamadaIntelService.actualizarTarea(intelId, tareaIndex, updates);
      // Recargar
      const data = await llamadaIntelService.listarHistorial(50);
      setHistorial(data);
    } catch (error) {
      console.error('[NotasIA] Error actualizando tarea:', error);
    }
  };

  const handleActualizarSeguimiento = async (
    intelId: string,
    segIndex: number,
    updates: { completado?: boolean; responsableUid?: string; responsable?: string }
  ) => {
    try {
      await llamadaIntelService.actualizarSeguimiento(intelId, segIndex, updates);
      const data = await llamadaIntelService.listarHistorial(50);
      setHistorial(data);
    } catch (error) {
      console.error('[NotasIA] Error actualizando seguimiento:', error);
    }
  };


  const formatDuration = (seg: number) => {
    const min = Math.floor(seg / 60);
    const s = seg % 60;
    return `${min}:${String(s).padStart(2, '0')}`;
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notas de Llamadas IA</h1>
        <p className="text-sm text-gray-500 mt-1">
          Resúmenes, tareas y decisiones extraídas automáticamente de tus llamadas de equipo
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Llamadas" value={historial.length} icon={Mic} color="primary" />
        <KPICard label={isAdmin ? "Tareas Pendientes" : "Mis Pendientes"} value={kpis.pendientes} icon={Target} color="amber" />
        <KPICard label={isAdmin ? "Completadas" : "Mis Completadas"} value={kpis.completadas} icon={CheckCircle2} color="green" />
        <KPICard label="Prioridad Alta" value={kpis.alta} icon={AlertTriangle} color="red" />
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTabActivo('llamadas')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tabActivo === 'llamadas'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Llamadas
          </button>
          <button
            onClick={() => setTabActivo('tareas')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tabActivo === 'tareas'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Target className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Tareas
            {kpis.pendientes > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                {kpis.pendientes}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 pr-4 py-2 w-full sm:w-64 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {tabActivo === 'tareas' && (
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={filtroTareas}
              onChange={(e) => setFiltroTareas(e.target.value as FiltroTareas)}
              className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white"
            >
              <option value="mis_tareas">Mis Tareas</option>
              <option value="pendiente">Pendientes</option>
              <option value="en_progreso">En Progreso</option>
              <option value="completada">Completadas</option>
              {isAdmin && <option value="todas">Todas (equipo)</option>}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {tabActivo === 'llamadas' ? (
        <LlamadasList
          llamadas={llamadasFiltradas}
          expandedCall={expandedCall}
          onToggleExpand={(id) => setExpandedCall(expandedCall === id ? null : id)}
          onVerNotas={(id) => setSelectedIntelId(id)}
          formatDate={formatDate}
          formatDuration={formatDuration}
          teamMembers={teamMembers}
          onActualizarTarea={handleActualizarTarea}
          onActualizarSeguimiento={handleActualizarSeguimiento}
        />
      ) : (
        <TareasList
          tareas={tareasFiltradas}
          teamMembers={teamMembers}
          onActualizarTarea={handleActualizarTarea}
          formatDate={formatDate}
          canReassign={isAdmin}
        />
      )}

      {/* Modal de notas completas */}
      {selectedIntelId && (
        <CallNotesModal
          intelId={selectedIntelId}
          onClose={() => setSelectedIntelId(null)}
        />
      )}
    </div>
  );
};

// ─── KPI Card ───────────────────────────────────────────────
const KPICard: React.FC<{
  label: string;
  value: number;
  icon: React.FC<{ className?: string }>;
  color: string;
}> = ({ label, value, icon: Icon, color }) => {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

// ─── Llamadas List ──────────────────────────────────────────
const LlamadasList: React.FC<{
  llamadas: LlamadaIntel[];
  expandedCall: string | null;
  onToggleExpand: (id: string) => void;
  onVerNotas: (id: string) => void;
  formatDate: (ts: { toDate?: () => Date }) => string;
  formatDuration: (seg: number) => string;
  teamMembers: UserProfile[];
  onActualizarTarea: (intelId: string, idx: number, updates: { estado?: EstadoTarea; responsableUid?: string; responsable?: string }) => void;
  onActualizarSeguimiento: (intelId: string, idx: number, updates: { completado?: boolean; responsableUid?: string; responsable?: string }) => void;
}> = ({ llamadas, expandedCall, onToggleExpand, onVerNotas, formatDate, formatDuration, teamMembers, onActualizarTarea, onActualizarSeguimiento }) => {
  if (llamadas.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <Mic className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Sin llamadas registradas</p>
        <p className="text-sm text-gray-400 mt-1">
          Las notas aparecerán aquí automáticamente después de cada llamada
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {llamadas.map((intel) => {
        const isExpanded = expandedCall === intel.id;
        const sentConfig = SENTIMIENTO_CONFIG[intel.analisis?.sentimiento] || SENTIMIENTO_CONFIG.neutral;
        const tareasCount = intel.analisis?.tareas?.length || 0;
        const tareasPendientes = intel.analisis?.tareas?.filter(t => {
          const e = t.estado || (t.completada ? 'completada' : 'pendiente');
          return e !== 'completada' && e !== 'cancelada';
        }).length || 0;

        return (
          <div key={intel.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Call Header */}
            <button
              onClick={() => onToggleExpand(intel.id)}
              className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-primary-50 rounded-xl shrink-0">
                  <FileText className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">
                      {intel.participantes.join(', ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sentConfig.color}`}>
                      {sentConfig.icon} {sentConfig.label}
                    </span>
                  </div>
                  {intel.analisis?.resumenEjecutivo?.[0] && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                      {intel.analisis.resumenEjecutivo[0]}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(intel.creadoEn)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(intel.audioDuracionSeg)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {intel.participantes.length} participantes
                    </span>
                    {tareasCount > 0 && (
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                        tareasPendientes > 0 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                      }`}>
                        <Target className="h-3 w-3" />
                        {tareasPendientes > 0 ? `${tareasPendientes} pendiente${tareasPendientes > 1 ? 's' : ''}` : 'Todas completadas'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); onVerNotas(intel.id); }}
                    className="px-3 py-1.5 bg-primary-50 text-primary-600 text-xs font-medium rounded-lg hover:bg-primary-100 transition-colors"
                  >
                    Ver completo
                  </button>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && intel.analisis && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50/50">
                {/* Resumen */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Resumen
                  </h4>
                  <ul className="space-y-1">
                    {intel.analisis.resumenEjecutivo.map((punto, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-primary-500 mt-0.5 shrink-0">•</span>
                        {punto}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tareas con acciones */}
                {intel.analisis.tareas.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Target className="h-3.5 w-3.5" />
                      Tareas ({intel.analisis.tareas.length})
                    </h4>
                    <div className="space-y-2">
                      {intel.analisis.tareas.map((tarea, idx) => (
                        <TareaCard
                          key={idx}
                          tarea={tarea}
                          teamMembers={teamMembers}
                          onUpdateEstado={(estado) => onActualizarTarea(intel.id, idx, { estado })}
                          onAsignar={(uid, nombre) => onActualizarTarea(intel.id, idx, { responsableUid: uid, responsable: nombre })}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Decisiones */}
                {intel.analisis.decisiones.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Lightbulb className="h-3.5 w-3.5" />
                      Decisiones ({intel.analisis.decisiones.length})
                    </h4>
                    <div className="space-y-2">
                      {intel.analisis.decisiones.map((dec, i) => (
                        <div key={i} className="p-3 bg-white rounded-lg border border-amber-100">
                          <p className="text-sm font-medium text-gray-800">{dec.decision}</p>
                          <p className="text-xs text-gray-500 mt-1">{dec.contexto}</p>
                          <div className="flex gap-1.5 mt-1.5">
                            {dec.involucrados.map((p, j) => (
                              <span key={j} className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Seguimientos */}
                {intel.analisis.seguimientos.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <ArrowRight className="h-3.5 w-3.5" />
                      Seguimientos ({intel.analisis.seguimientos.length})
                    </h4>
                    <div className="space-y-2">
                      {intel.analisis.seguimientos.map((seg, idx) => (
                        <SeguimientoCard
                          key={idx}
                          seguimiento={seg}
                          teamMembers={teamMembers}
                          onToggleCompletado={() =>
                            onActualizarSeguimiento(intel.id, idx, { completado: !seg.completado })
                          }
                          onAsignar={(uid, nombre) =>
                            onActualizarSeguimiento(intel.id, idx, { responsableUid: uid, responsable: nombre })
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Alertas */}
                {intel.analisis.alertas && intel.analisis.alertas.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Alertas
                    </h4>
                    <div className="space-y-1.5">
                      {intel.analisis.alertas.map((alerta, i) => (
                        <div key={i} className="flex items-start gap-2 p-2.5 bg-red-50 rounded-lg border border-red-100">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                          <p className="text-sm text-gray-800">{alerta}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Tarea Card ─────────────────────────────────────────────
const TareaCard: React.FC<{
  tarea: TareaExtraida;
  teamMembers: UserProfile[];
  onUpdateEstado: (estado: EstadoTarea) => void;
  onAsignar: (uid: string, nombre: string) => void;
  canReassign?: boolean;
}> = ({ tarea, teamMembers, onUpdateEstado, onAsignar, canReassign = true }) => {
  const [showAsignar, setShowAsignar] = useState(false);
  const estado = tarea.estado || (tarea.completada ? 'completada' : 'pendiente');
  const config = ESTADO_TAREA_CONFIG[estado];
  const EstadoIcon = config.icon;

  const nextEstado = (): EstadoTarea => {
    switch (estado) {
      case 'pendiente': return 'en_progreso';
      case 'en_progreso': return 'completada';
      case 'completada': return 'pendiente';
      case 'cancelada': return 'pendiente';
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
      <button
        onClick={() => onUpdateEstado(nextEstado())}
        className={`mt-0.5 shrink-0 transition-colors ${config.color} hover:opacity-70`}
        title={`Cambiar a ${ESTADO_TAREA_CONFIG[nextEstado()].label}`}
      >
        <EstadoIcon className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${estado === 'completada' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
          {tarea.descripcion}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Responsable */}
          {canReassign ? (
            <button
              onClick={() => setShowAsignar(!showAsignar)}
              className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors"
            >
              <User className="h-3 w-3" />
              {tarea.responsable}
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              <User className="h-3 w-3" />
              {tarea.responsable}
            </span>
          )}

          {/* Prioridad */}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            tarea.prioridad === 'alta'
              ? 'bg-red-100 text-red-700'
              : tarea.prioridad === 'media'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {tarea.prioridad}
          </span>

          {/* Deadline */}
          {tarea.deadline && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Calendar className="h-3 w-3" />
              {tarea.deadline}
            </span>
          )}

          {/* Estado badge */}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.color}`}>
            {config.label}
          </span>
        </div>

        {/* Selector de asignación (solo admin/gerente) */}
        {showAsignar && canReassign && (
          <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-500 mb-1.5">Asignar a:</p>
            <div className="flex flex-wrap gap-1.5">
              {teamMembers.map(member => (
                <button
                  key={member.uid}
                  onClick={() => {
                    onAsignar(member.uid, member.displayName);
                    setShowAsignar(false);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    tarea.responsableUid === member.uid
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {member.displayName}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Seguimiento Card ───────────────────────────────────────
const SeguimientoCard: React.FC<{
  seguimiento: { accion: string; responsable: string; responsableUid?: string; plazo?: string; completado?: boolean };
  teamMembers: UserProfile[];
  onToggleCompletado: () => void;
  onAsignar: (uid: string, nombre: string) => void;
}> = ({ seguimiento, teamMembers, onToggleCompletado, onAsignar }) => {
  const [showAsignar, setShowAsignar] = useState(false);

  return (
    <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-100">
      <button
        onClick={onToggleCompletado}
        className={`mt-0.5 shrink-0 transition-colors ${seguimiento.completado ? 'text-green-500' : 'text-gray-300 hover:text-green-400'}`}
      >
        {seguimiento.completado ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${seguimiento.completado ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
          {seguimiento.accion}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <button
            onClick={() => setShowAsignar(!showAsignar)}
            className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full hover:bg-green-100 transition-colors"
          >
            <User className="h-3 w-3" />
            {seguimiento.responsable}
          </button>
          {seguimiento.plazo && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {seguimiento.plazo}
            </span>
          )}
        </div>

        {showAsignar && (
          <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-500 mb-1.5">Asignar a:</p>
            <div className="flex flex-wrap gap-1.5">
              {teamMembers.map(member => (
                <button
                  key={member.uid}
                  onClick={() => {
                    onAsignar(member.uid, member.displayName);
                    setShowAsignar(false);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    seguimiento.responsableUid === member.uid
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {member.displayName}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tareas List (Vista centralizada de tareas) ─────────────
const TareasList: React.FC<{
  tareas: { intel: LlamadaIntel; tareaIndex: number; tarea: TareaExtraida }[];
  teamMembers: UserProfile[];
  onActualizarTarea: (intelId: string, idx: number, updates: { estado?: EstadoTarea; responsableUid?: string; responsable?: string }) => void;
  formatDate: (ts: { toDate?: () => Date }) => string;
  canReassign?: boolean;
}> = ({ tareas, teamMembers, onActualizarTarea, formatDate, canReassign = true }) => {
  if (tareas.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <Target className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No hay tareas</p>
        <p className="text-sm text-gray-400 mt-1">
          Las tareas se extraen automáticamente de las llamadas
        </p>
      </div>
    );
  }

  // Agrupar por responsable
  const porResponsable = tareas.reduce<Record<string, typeof tareas>>((acc, item) => {
    const key = item.tarea.responsable || 'Sin asignar';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(porResponsable).map(([responsable, tareasGrupo]) => (
        <div key={responsable}>
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-gray-400" />
            {responsable}
            <span className="text-xs text-gray-400 font-normal">
              ({tareasGrupo.length} tarea{tareasGrupo.length > 1 ? 's' : ''})
            </span>
          </h3>
          <div className="space-y-2">
            {tareasGrupo.map(({ intel, tareaIndex, tarea }) => (
              <div key={`${intel.id}-${tareaIndex}`} className="flex items-start gap-3">
                <TareaCard
                  tarea={tarea}
                  teamMembers={teamMembers}
                  onUpdateEstado={(estado) => onActualizarTarea(intel.id, tareaIndex, { estado })}
                  onAsignar={(uid, nombre) => onActualizarTarea(intel.id, tareaIndex, { responsableUid: uid, responsable: nombre })}
                  canReassign={canReassign}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
