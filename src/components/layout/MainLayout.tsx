import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CollaborationPanel } from './CollaborationPanel';
const DailyCallModal = lazy(() => import('./DailyCallModal').then(m => ({ default: m.DailyCallModal })));
const IncomingCallModal = lazy(() => import('./IncomingCallModal').then(m => ({ default: m.IncomingCallModal })));
import { ErrorBoundary } from '../common/ErrorBoundary';
import { TCFreshnessBanner } from '../common/TCFreshnessBanner';
import { useNotificacionesAutoInit } from '../../hooks';
import { useCollaborationInit } from '../../hooks/useCollaborationInit';
import { useAuthStore } from '../../store/authStore';
import { AuthService } from '../../services/auth.service';
import { useToastStore } from '../../store/toastStore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const MainLayout: React.FC = () => {
  // Inicializar sistema de notificaciones automáticas
  useNotificacionesAutoInit();

  // Inicializar sistema de colaboración (presencia, actividad, chat)
  useCollaborationInit();

  // Estado para controlar sidebar en móvil y desktop
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore(state => state.logout);
  const userProfile = useAuthStore(state => state.userProfile);
  const toast = useToastStore();
  const lastForceLogout = useRef<number | null>(null);

  // Listener para desconexión forzada
  useEffect(() => {
    if (!userProfile?.uid) return;

    const userRef = doc(db, 'users', userProfile.uid);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      const data = snapshot.data();
      if (!data?.forceLogoutAt) return;

      const forceLogoutTime = data.forceLogoutAt?.toMillis?.() || 0;

      // Solo actuar si es un nuevo forceLogout (posterior al login)
      if (lastForceLogout.current === null) {
        // Primera vez que leemos, guardar referencia
        lastForceLogout.current = forceLogoutTime;
        return;
      }

      if (forceLogoutTime > lastForceLogout.current) {
        // Desconexión forzada detectada
        lastForceLogout.current = forceLogoutTime;
        toast.warning('Tu sesión ha sido terminada por un administrador.');
        logout();
        AuthService.logout();
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [userProfile?.uid]);

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
          fixed inset-y-0 left-0 z-50 w-64 h-full transform transition-transform duration-300 ease-in-out lg:relative
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${sidebarCollapsed ? 'lg:-translate-x-full lg:w-0 lg:overflow-hidden' : 'lg:translate-x-0'}
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header con botón hamburguesa */}
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed(prev => !prev)}
          sidebarCollapsed={sidebarCollapsed}
        />

        {/* Banner de estado del TC */}
        <TCFreshnessBanner />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
          <ErrorBoundary fallbackMessage="Ocurrió un error en esta página">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Panel de Colaboración (derecha) */}
      <CollaborationPanel />

      {/* Modal de videollamada Daily.co (lazy loaded ~500KB) */}
      <Suspense fallback={null}>
        <DailyCallModal />
      </Suspense>

      {/* Modal de llamada entrante (lazy loaded) */}
      <Suspense fallback={null}>
        <IncomingCallModal />
      </Suspense>
    </div>
  );
};
