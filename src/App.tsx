import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Layouts y Auth
import { MainLayout } from './components/layout/MainLayout';
import { Login } from './pages/Auth/Login';

// Páginas principales
import { Dashboard } from './pages/Dashboard';
import { Productos } from './pages/Productos/Productos';
import { Inventario } from './pages/Inventario/Inventario';
import { Almacenes } from './pages/Almacenes/Almacenes';
import { Transferencias } from './pages/Transferencias/Transferencias';
import { Unidades } from './pages/Unidades/Unidades';
import { TipoCambio } from './pages/TipoCambio/TipoCambio';
import { OrdenesCompra } from './pages/OrdenesCompra/OrdenesCompra';
import { Ventas } from './pages/Ventas/Ventas';
import { Gastos } from './pages/Gastos/Gastos';
import { Reportes } from './pages/Reportes/Reportes';
import { CTRUDashboard } from './pages/CTRU/CTRUDashboard';
import { Configuracion } from './pages/Configuracion/Configuracion';

// Páginas adicionales
import { Cotizaciones } from './pages/Cotizaciones/Cotizaciones';
import { Requerimientos } from './pages/Requerimientos/Requerimientos';
import { Tesoreria } from './pages/Tesoreria/Tesoreria';
import { Expectativas } from './pages/Expectativas/Expectativas';
import { Maestros } from './pages/Maestros/Maestros';
import { Usuarios } from './pages/Usuarios/Usuarios';
import { Auditoria } from './pages/Auditoria/Auditoria';

// Utilidades
import { MigracionProductos } from './pages/Migracion/MigracionProductos';

// Stores y servicios
import { useAuthStore } from './store/authStore';
import { AuthService } from './services/auth.service';

// Notificaciones
import ToastContainer from './components/common/ToastContainer';

// Configuración de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

// Componente de Ruta Protegida
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
  const fetchUserProfile = useAuthStore(state => state.fetchUserProfile);

  useEffect(() => {
    const unsubscribe = AuthService.onAuthChange(async (user) => {
      setUser(user);
      if (user) {
        await fetchUserProfile(user.uid);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading, fetchUserProfile]);

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

            {/* Inventario */}
            <Route path="productos" element={<Productos />} />
            <Route path="inventario" element={<Inventario />} />
            <Route path="almacenes" element={<Almacenes />} />
            <Route path="transferencias" element={<Transferencias />} />
            <Route path="unidades" element={<Unidades />} />

            {/* Comercial */}
            <Route path="compras" element={<OrdenesCompra />} />
            <Route path="ventas" element={<Ventas />} />
            <Route path="cotizaciones" element={<Cotizaciones />} />
            <Route path="requerimientos" element={<Requerimientos />} />

            {/* Finanzas */}
            <Route path="gastos" element={<Gastos />} />
            <Route path="tesoreria" element={<Tesoreria />} />
            <Route path="tipo-cambio" element={<TipoCambio />} />
            <Route path="ctru" element={<CTRUDashboard />} />
            <Route path="expectativas" element={<Expectativas />} />
            <Route path="reportes" element={<Reportes />} />

            {/* Administración */}
            <Route path="maestros" element={<Maestros />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="auditoria" element={<Auditoria />} />
            <Route path="configuracion" element={<Configuracion />} />

            {/* Utilidades */}
            <Route path="migracion" element={<MigracionProductos />} />
          </Route>

          {/* Ruta Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        <ToastContainer />

      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
