import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Protected Route Component
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
    // Listen to auth state changes
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
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
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

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;