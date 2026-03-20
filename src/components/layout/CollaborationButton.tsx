import React from 'react';
import { Users, MessageCircle, Phone } from 'lucide-react';
import { useCollaborationStore } from '../../store/collaborationStore';

export const CollaborationButton: React.FC = () => {
  const usuariosOnline = useCollaborationStore(s => s.usuariosOnline);
  const mensajesNoLeidos = useCollaborationStore(s => s.mensajesNoLeidos);
  const panelAbierto = useCollaborationStore(s => s.panelAbierto);
  const togglePanel = useCollaborationStore(s => s.togglePanel);
  const setTab = useCollaborationStore(s => s.setTab);

  const llamadaActiva = useCollaborationStore(s => s.llamadaActiva);

  const totalOnline = usuariosOnline.filter(u => u.estado === 'online').length;

  const handleClickEquipo = () => {
    if (panelAbierto) {
      togglePanel(); // cerrar
    } else {
      setTab('equipo');
      togglePanel(); // abrir
    }
  };

  const handleClickChat = () => {
    if (panelAbierto) {
      const { tabActivo } = useCollaborationStore.getState();
      if (tabActivo === 'chat') {
        togglePanel(); // cerrar si ya está en chat
      } else {
        setTab('chat'); // cambiar a chat
      }
    } else {
      setTab('chat');
      togglePanel(); // abrir en chat
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Botón Equipo */}
      <button
        onClick={handleClickEquipo}
        className={`relative p-2 rounded-lg transition-colors ${
          panelAbierto
            ? 'bg-primary-100 text-primary-600'
            : 'hover:bg-gray-100 text-gray-600'
        }`}
        title="Equipo en línea"
      >
        <Users className="h-5 w-5" />
        {totalOnline > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
            {totalOnline}
          </span>
        )}
      </button>

      {/* Botón Chat */}
      <button
        onClick={handleClickChat}
        className={`relative p-2 rounded-lg transition-colors ${
          panelAbierto
            ? 'bg-primary-100 text-primary-600'
            : 'hover:bg-gray-100 text-gray-600'
        }`}
        title="Chat del equipo"
      >
        <MessageCircle className="h-5 w-5" />
        {mensajesNoLeidos > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
            {mensajesNoLeidos > 9 ? '9+' : mensajesNoLeidos}
          </span>
        )}
      </button>

      {/* Indicador de llamada activa */}
      {llamadaActiva && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-lg">
          <Phone className="h-3.5 w-3.5 text-green-600" />
          <span className="text-xs font-medium text-green-700">En llamada</span>
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        </div>
      )}
    </div>
  );
};
