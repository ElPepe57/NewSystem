import React, { useEffect, useRef } from 'react';
import { X, Users, MessageCircle } from 'lucide-react';
import { useCollaborationStore } from '../../store/collaborationStore';
import { TeamPresence } from './TeamPresence';
import { ActivityFeed } from './ActivityFeed';
import { TeamChat } from './TeamChat';

export const CollaborationPanel: React.FC = () => {
  const panelAbierto = useCollaborationStore(s => s.panelAbierto);
  const tabActivo = useCollaborationStore(s => s.tabActivo);
  const setTab = useCollaborationStore(s => s.setTab);
  const togglePanel = useCollaborationStore(s => s.togglePanel);
  const mensajesNoLeidos = useCollaborationStore(s => s.mensajesNoLeidos);
  const llamadaActiva = useCollaborationStore(s => s.llamadaActiva);
  const panelRef = useRef<HTMLDivElement>(null);

  // Cerrar con Escape
  useEffect(() => {
    if (!panelAbierto) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') togglePanel();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [panelAbierto, togglePanel]);

  // Click outside para cerrar (solo en móvil)
  useEffect(() => {
    if (!panelAbierto) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Solo cerrar en pantallas pequeñas
        if (window.innerWidth < 1024) {
          togglePanel();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelAbierto, togglePanel]);

  return (
    <>
      {/* Overlay para móvil */}
      {panelAbierto && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={togglePanel} />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={`
          fixed right-0 top-0 h-full z-50 w-80 bg-white shadow-2xl border-l border-slate-200
          transform transition-transform duration-300 ease-in-out
          ${panelAbierto ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header del panel */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-1">
            {/* Tabs */}
            <button
              onClick={() => setTab('equipo')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tabActivo === 'equipo'
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Users className="h-4 w-4" />
              Equipo
            </button>
            <button
              onClick={() => setTab('chat')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tabActivo === 'chat'
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              Chat
              {mensajesNoLeidos > 0 && tabActivo !== 'chat' && (
                <span className="w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          </div>

          <button
            onClick={togglePanel}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Banner de llamada activa */}
        {llamadaActiva && (
          <div className="px-4 py-2 bg-green-50 border-b border-green-200 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-green-700">Llamada en curso</span>
          </div>
        )}

        {/* Contenido */}
        <div className={`overflow-hidden ${llamadaActiva ? 'h-[calc(100%-52px-44px)]' : 'h-[calc(100%-52px)]'}`}>
          {tabActivo === 'equipo' ? (
            <div className="h-full overflow-y-auto">
              <TeamPresence />
              <div className="border-t border-slate-100" />
              <ActivityFeed />
            </div>
          ) : (
            <TeamChat />
          )}
        </div>
      </div>
    </>
  );
};

