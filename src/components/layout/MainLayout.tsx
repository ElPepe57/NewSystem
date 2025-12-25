import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { QuickActions } from '../common';
import { useNotificacionesAutoInit } from '../../hooks';

export const MainLayout: React.FC = () => {
  // Inicializar sistema de notificaciones automáticas
  useNotificacionesAutoInit();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <Outlet />
        </main>
      </div>

      {/* Quick Actions FAB */}
      <QuickActions />
    </div>
  );
};
