import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ✅ 1. Tus imports originales (Se mantienen IGUAL)
import { MainLayout } from './components/layout/MainLayout';
import { Login } from './pages/Auth/Login';
import { Dashboard } from './pages/Dashboard';
import { Productos } from './pages/Productos/Productos';
import { Inventario } from './pages/Inventario/Inventario';
import { TipoCambio } from './pages/TipoCambio/TipoCambio';
import { OrdenesCompra } from './pages/OrdenesCompra/OrdenesCompra';
import { Ventas } from './pages/Ventas/Ventas';
import { Reportes } from './pages/Reportes/Reportes';
import { Configuracion } from './pages/Configuracion/Configuracion';
import { useAuthStore } from './store/authStore';
import { AuthService } from './services/auth.service';

// ✅ 2. ÚNICO CAMBIO: Importar el contenedor de notificaciones
import ToastContainer from './components/common/ToastContainer';

// Configuración de React Query (Tu configuración original)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

// Componente de Ruta Protegida (Tu lógica original)
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  const setUser = useAuthStore(state => state.setUser);
  const setLoading = useAuthStore(state => state.setLoading);

  useEffect(() => {
    const unsubscribe = AuthService.onAuthChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/login" element={<Login />} />

          {/* Rutas Protegidas */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="productos" element={<Productos />} />
            <Route path="inventario" element={<Inventario />} />
            <Route path="tipo-cambio" element={<TipoCambio />} />
            <Route path="compras" element={<OrdenesCompra />} />
            <Route path="ventas" element={<Ventas />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="configuracion" element={<Configuracion />} />
          </Route>

          {/* Ruta Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        {/* ✅ 3. ÚNICO CAMBIO: El componente visual de notificaciones */}
        {/* Se coloca aquí para que flote sobre todo, pero dentro del Router */}
        <ToastContainer />
        
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;