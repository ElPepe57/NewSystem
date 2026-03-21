import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// Layouts y Auth (carga inmediata — necesarios para el primer render)
import { MainLayout } from './components/layout/MainLayout';
import { Login } from './pages/Auth/Login';
import { Register } from './pages/Auth/Register';
import { PendingApproval } from './pages/Auth/PendingApproval';

// Páginas lazy-loaded (se cargan bajo demanda al navegar)
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Productos = React.lazy(() => import('./pages/Productos/Productos').then(m => ({ default: m.Productos })));
const Inventario = React.lazy(() => import('./pages/Inventario/Inventario').then(m => ({ default: m.Inventario })));
const Almacenes = React.lazy(() => import('./pages/Almacenes/Almacenes').then(m => ({ default: m.Almacenes })));
const Transferencias = React.lazy(() => import('./pages/Transferencias/Transferencias').then(m => ({ default: m.Transferencias })));
const Unidades = React.lazy(() => import('./pages/Unidades/Unidades').then(m => ({ default: m.Unidades })));
const TipoCambio = React.lazy(() => import('./pages/TipoCambio/TipoCambio').then(m => ({ default: m.TipoCambio })));
const OrdenesCompra = React.lazy(() => import('./pages/OrdenesCompra/OrdenesCompra').then(m => ({ default: m.OrdenesCompra })));
const Ventas = React.lazy(() => import('./pages/Ventas/Ventas').then(m => ({ default: m.Ventas })));
const Gastos = React.lazy(() => import('./pages/Gastos/Gastos').then(m => ({ default: m.Gastos })));
const Reportes = React.lazy(() => import('./pages/Reportes/Reportes').then(m => ({ default: m.Reportes })));
const CTRUDashboard = React.lazy(() => import('./pages/CTRU/CTRUDashboard').then(m => ({ default: m.CTRUDashboard })));
const Configuracion = React.lazy(() => import('./pages/Configuracion/Configuracion').then(m => ({ default: m.Configuracion })));
const Cotizaciones = React.lazy(() => import('./pages/Cotizaciones/Cotizaciones').then(m => ({ default: m.Cotizaciones })));
const Requerimientos = React.lazy(() => import('./pages/Requerimientos/Requerimientos').then(m => ({ default: m.Requerimientos })));
const Tesoreria = React.lazy(() => import('./pages/Tesoreria/Tesoreria').then(m => ({ default: m.Tesoreria })));
const RendimientoCambiario = React.lazy(() => import('./pages/RendimientoCambiario/RendimientoCambiario').then(m => ({ default: m.RendimientoCambiario })));
const Maestros = React.lazy(() => import('./pages/Maestros/Maestros').then(m => ({ default: m.Maestros })));
const Usuarios = React.lazy(() => import('./pages/Usuarios/Usuarios').then(m => ({ default: m.Usuarios })));
const Auditoria = React.lazy(() => import('./pages/Auditoria/Auditoria').then(m => ({ default: m.Auditoria })));
const Contabilidad = React.lazy(() => import('./pages/Contabilidad/Contabilidad').then(m => ({ default: m.Contabilidad })));
const ProductosIntel = React.lazy(() => import('./pages/ProductosIntel/ProductosIntel').then(m => ({ default: m.ProductosIntel })));
const MiPerfil = React.lazy(() => import('./pages/Perfil/MiPerfil').then(m => ({ default: m.MiPerfil })));
// TestPDF removed — dev utility no longer needed in production
const Escaner = React.lazy(() => import('./pages/Escaner/Escaner').then(m => ({ default: m.Escaner })));
const MercadoLibre = React.lazy(() => import('./pages/MercadoLibre/MercadoLibre').then(m => ({ default: m.MercadoLibre })));
const NotasIA = React.lazy(() => import('./pages/NotasIA/NotasIA').then(m => ({ default: m.NotasIA })));
const LineaNegocio = React.lazy(() => import('./pages/LineaNegocio/LineaNegocio').then(m => ({ default: m.LineaNegocio })));
// MigracionProductos removed — one-time migration tool no longer needed

// Stores y servicios
import { useAuthStore } from './store/authStore';
import { useLineaNegocioStore } from './store/lineaNegocioStore';
import { AuthService } from './services/auth.service';

// Notificaciones
import ToastContainer from './components/common/ToastContainer';

// Error boundary global
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Spinner de carga para Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
);

// Componente de Ruta Protegida
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore(state => state.user);
  const userProfile = useAuthStore(state => state.userProfile);
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

  // Si el perfil aún no carga, mostrar spinner
  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Si el usuario no está activo, redirigir a pantalla de espera
  if (!userProfile.activo) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
};

function App() {
  const setUser = useAuthStore(state => state.setUser);
  const setLoading = useAuthStore(state => state.setLoading);
  const fetchUserProfile = useAuthStore(state => state.fetchUserProfile);
  const fetchLineasActivas = useLineaNegocioStore(state => state.fetchLineasActivas);

  useEffect(() => {
    const unsubscribe = AuthService.onAuthChange(async (user) => {
      setUser(user);
      if (user) {
        await fetchUserProfile(user.uid);
        // Cargar líneas de negocio activas para el selector global
        fetchLineasActivas();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading, fetchUserProfile]);

  return (
    <ErrorBoundary fallbackMessage="La aplicación encontró un error crítico. Por favor recarga la página.">
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
            {/* Rutas Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/pending-approval" element={<PendingApproval />} />

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
              <Route path="productos-intel" element={<ProductosIntel />} />
              <Route path="inventario" element={<Inventario />} />
              <Route path="almacenes" element={<Almacenes />} />
              <Route path="transferencias" element={<Transferencias />} />
              <Route path="unidades" element={<Unidades />} />
              <Route path="escaner" element={<Escaner />} />

              {/* Comercial */}
              <Route path="compras" element={<OrdenesCompra />} />
              <Route path="ventas" element={<Ventas />} />
              <Route path="cotizaciones" element={<Cotizaciones />} />
              <Route path="requerimientos" element={<Requerimientos />} />

              {/* Finanzas */}
              <Route path="gastos" element={<Gastos />} />
              <Route path="tesoreria" element={<Tesoreria />} />
              <Route path="contabilidad" element={<Contabilidad />} />
              <Route path="tipo-cambio" element={<TipoCambio />} />
              <Route path="ctru" element={<CTRUDashboard />} />
              <Route path="rendimiento-cambiario" element={<RendimientoCambiario />} />
              <Route path="reportes" element={<Reportes />} />

              {/* Administración */}
              <Route path="lineas-negocio" element={<LineaNegocio />} />
              <Route path="maestros" element={<Maestros />} />
              <Route path="usuarios" element={<Usuarios />} />
              <Route path="auditoria" element={<Auditoria />} />
              <Route path="configuracion" element={<Configuracion />} />

              {/* Mercado Libre */}
              <Route path="mercado-libre" element={<MercadoLibre />} />

              {/* Equipo */}
              <Route path="notas-ia" element={<NotasIA />} />

              {/* Perfil */}
              <Route path="perfil" element={<MiPerfil />} />

              {/* Utilidades removed — dev tools no longer in production */}
            </Route>

            {/* Ruta Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>

      <ToastContainer />

    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
