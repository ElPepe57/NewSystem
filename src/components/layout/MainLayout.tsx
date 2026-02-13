import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useNotificacionesAutoInit } from '../../hooks';

export const MainLayout: React.FC = () => {
  // Inicializar sistema de notificaciones automáticas
  useNotificacionesAutoInit();

  // Estado para controlar sidebar en móvil
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Cerrar sidebar cuando cambia la ruta (navegación en móvil)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Cerrar sidebar con Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Overlay para móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - responsive */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header con botón hamburguesa */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
