import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Layouts - carga inmediata
import { MainLayout } from './components/layout/MainLayout';
import { PageLoader } from './components/common';

// Auth - carga inmediata (necesario para el flujo inicial)
import { Login } from './pages/Auth/Login';
import { useAuthStore } from './store/authStore';
import { AuthService } from './services/auth.service';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PERMISOS } from './types/auth.types';

// Notificaciones
import ToastContainer from './components/common/ToastContainer';

// Lazy loading de páginas
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Productos = lazy(() => import('./pages/Productos/Productos').then(m => ({ default: m.Productos })));
const Inventario = lazy(() => import('./pages/Inventario/Inventario').then(m => ({ default: m.Inventario })));
// Almacenes ahora se gestiona desde Maestros - redirigimos /almacenes a /maestros?tab=almacenes
const Transferencias = lazy(() => import('./pages/Transferencias/Transferencias').then(m => ({ default: m.Transferencias })));
const Unidades = lazy(() => import('./pages/Unidades/Unidades').then(m => ({ default: m.Unidades })));
const TipoCambio = lazy(() => import('./pages/TipoCambio/TipoCambio').then(m => ({ default: m.TipoCambio })));
const OrdenesCompra = lazy(() => import('./pages/OrdenesCompra/OrdenesCompra').then(m => ({ default: m.OrdenesCompra })));
const Ventas = lazy(() => import('./pages/Ventas/Ventas').then(m => ({ default: m.Ventas })));
const Cotizaciones = lazy(() => import('./pages/Cotizaciones/Cotizaciones').then(m => ({ default: m.Cotizaciones })));
const Gastos = lazy(() => import('./pages/Gastos/Gastos').then(m => ({ default: m.Gastos })));
const Reportes = lazy(() => import('./pages/Reportes/Reportes').then(m => ({ default: m.Reportes })));
const CTRUDashboard = lazy(() => import('./pages/CTRU/CTRUDashboard').then(m => ({ default: m.CTRUDashboard })));
const Configuracion = lazy(() => import('./pages/Configuracion/Configuracion').then(m => ({ default: m.Configuracion })));
const Usuarios = lazy(() => import('./pages/Usuarios/Usuarios').then(m => ({ default: m.Usuarios })));
const Auditoria = lazy(() => import('./pages/Auditoria/Auditoria').then(m => ({ default: m.Auditoria })));
const Tesoreria = lazy(() => import('./pages/Tesoreria/Tesoreria').then(m => ({ default: m.Tesoreria })));
const Requerimientos = lazy(() => import('./pages/Requerimientos/Requerimientos').then(m => ({ default: m.Requerimientos })));
const Expectativas = lazy(() => import('./pages/Expectativas/Expectativas').then(m => ({ default: m.Expectativas })));
const Maestros = lazy(() => import('./pages/Maestros/Maestros').then(m => ({ default: m.Maestros })));

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

// Componente wrapper para Suspense con permisos
const LazyRoute: React.FC<{
  component: React.LazyExoticComponent<React.FC>;
  requiredPermiso?: string;
}> = ({ component: Component, requiredPermiso }) => {
  const content = (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );

  if (requiredPermiso) {
    return (
      <ProtectedRoute requiredPermiso={requiredPermiso}>
        {content}
      </ProtectedRoute>
    );
  }

  return content;
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

            {/* Dashboard - Todos los usuarios activos */}
            <Route path="dashboard" element={
              <LazyRoute component={Dashboard} />
            } />

            {/* Inventario - Requiere ver_inventario */}
            <Route path="productos" element={
              <LazyRoute component={Productos} requiredPermiso={PERMISOS.VER_INVENTARIO} />
            } />
            <Route path="inventario" element={
              <LazyRoute component={Inventario} requiredPermiso={PERMISOS.VER_INVENTARIO} />
            } />
            {/* Almacenes redirige a Maestros con tab activa */}
            <Route path="almacenes" element={<Navigate to="/maestros?tab=almacenes" replace />} />

            {/* Gestión de inventario - Requiere gestionar_inventario */}
            <Route path="transferencias" element={
              <LazyRoute component={Transferencias} requiredPermiso={PERMISOS.GESTIONAR_INVENTARIO} />
            } />
            <Route path="unidades" element={
              <LazyRoute component={Unidades} requiredPermiso={PERMISOS.GESTIONAR_INVENTARIO} />
            } />
            <Route path="compras" element={
              <LazyRoute component={OrdenesCompra} requiredPermiso={PERMISOS.GESTIONAR_INVENTARIO} />
            } />

            {/* Ventas - Requiere ver_ventas */}
            <Route path="ventas" element={
              <LazyRoute component={Ventas} requiredPermiso={PERMISOS.VER_VENTAS} />
            } />
            <Route path="cotizaciones" element={
              <LazyRoute component={Cotizaciones} requiredPermiso={PERMISOS.VER_VENTAS} />
            } />

            {/* Finanzas - Requiere ver_finanzas */}
            <Route path="gastos" element={
              <LazyRoute component={Gastos} requiredPermiso={PERMISOS.VER_FINANZAS} />
            } />
            <Route path="tipo-cambio" element={
              <LazyRoute component={TipoCambio} requiredPermiso={PERMISOS.VER_FINANZAS} />
            } />
            <Route path="ctru" element={
              <LazyRoute component={CTRUDashboard} requiredPermiso={PERMISOS.VER_FINANZAS} />
            } />
            <Route path="reportes" element={
              <LazyRoute component={Reportes} requiredPermiso={PERMISOS.VER_FINANZAS} />
            } />
            <Route path="tesoreria" element={
              <LazyRoute component={Tesoreria} requiredPermiso={PERMISOS.VER_FINANZAS} />
            } />
            <Route path="requerimientos" element={
              <LazyRoute component={Requerimientos} requiredPermiso={PERMISOS.GESTIONAR_INVENTARIO} />
            } />
            <Route path="expectativas" element={
              <LazyRoute component={Expectativas} requiredPermiso={PERMISOS.VER_FINANZAS} />
            } />

            {/* Administración - Solo admin */}
            <Route path="usuarios" element={
              <LazyRoute component={Usuarios} requiredPermiso={PERMISOS.ADMIN_TOTAL} />
            } />
            <Route path="configuracion" element={
              <LazyRoute component={Configuracion} requiredPermiso={PERMISOS.ADMIN_TOTAL} />
            } />
            <Route path="auditoria" element={
              <LazyRoute component={Auditoria} requiredPermiso={PERMISOS.ADMIN_TOTAL} />
            } />
            <Route path="maestros" element={
              <LazyRoute component={Maestros} requiredPermiso={PERMISOS.ADMIN_TOTAL} />
            } />
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
