import React, { useEffect, useState } from 'react';
import { 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  DollarSign,
  AlertTriangle,
  Activity,
  Warehouse,
  ArrowRight
} from 'lucide-react';
import { Card } from '../components/common';
import { useProductoStore } from '../store/productoStore';
import { useInventarioStore } from '../store/inventarioStore';
import { useVentaStore } from '../store/ventaStore';
import { useOrdenCompraStore } from '../store/ordenCompraStore';
import { useTipoCambioStore } from '../store/tipoCambioStore';
import { useReporteStore } from '../store/reporteStore';
import { Link } from 'react-router-dom';
import { TendenciaChart } from '../components/modules/reporte/TendenciaChart';

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  
  const { productos, fetchProductos } = useProductoStore();
  const { resumen: resumenByProducto, fetchResumen } = useInventarioStore();
  const { stats: ventasStats, fetchStats: fetchVentasStats } = useVentaStore();
  const { stats: ordenesStats, fetchStats: fetchOrdenesStats } = useOrdenCompraStore();
  const { stats: tcStats, fetchStats: fetchTCStats } = useTipoCambioStore();
  const { 
    resumenEjecutivo, 
    tendenciaVentas,
    alertasInventario,
    fetchResumenEjecutivo,
    fetchTendenciaVentas,
    fetchAlertasInventario
  } = useReporteStore();

  // Cargar todos los datos al montar
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        console.log('🔄 Iniciando carga del Dashboard...');
        
        console.log('📦 Cargando productos...');
        await fetchProductos();
        
        console.log('📊 Cargando resumen de inventario...');
        await fetchResumen();
        
        console.log('💰 Cargando stats de ventas...');
        await fetchVentasStats();
        
        console.log('🛒 Cargando stats de órdenes...');
        await fetchOrdenesStats();
        
        console.log('💱 Cargando stats de TC...');
        await fetchTCStats();
        
        console.log('📈 Cargando resumen ejecutivo...');
        await fetchResumenEjecutivo();
        
        console.log('📉 Cargando tendencia de ventas...');
        await fetchTendenciaVentas(30);
        
        console.log('⚠️ Cargando alertas...');
        await fetchAlertasInventario();
        
        console.log('✅ Dashboard cargado completamente');
        setLoading(false);
      } catch (error) {
        console.error('❌ Error loading dashboard:', error);
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Debug: Mostrar datos en consola
  useEffect(() => {
    console.log('📊 DATOS DEL DASHBOARD:', {
      productos: productos?.length,
      resumenByProducto: resumenByProducto?.length,
      ventasStats,
      ordenesStats,
      tcStats,
      resumenEjecutivo,
      tendenciaVentas: tendenciaVentas?.length,
      alertasInventario: alertasInventario?.length
    });
  }, [productos, resumenByProducto, ventasStats, ordenesStats, tcStats, resumenEjecutivo, tendenciaVentas, alertasInventario]);

  // Calcular totales de inventario con validación
  const stockPeru = resumenByProducto && Array.isArray(resumenByProducto) 
    ? resumenByProducto.reduce((sum, r) => {
        const peru = (r.disponiblesPeru || 0) + (r.asignadasPeru || 0);
        return sum + peru;
      }, 0)
    : 0;
    
  const stockUSA = resumenByProducto && Array.isArray(resumenByProducto)
    ? resumenByProducto.reduce((sum, r) => {
        const usa = (r.miami1 || 0) + (r.miami2 || 0) + (r.utah || 0);
        return sum + usa;
      }, 0)
    : 0;

  // Productos activos con validación
  const productosActivos = productos && Array.isArray(productos)
    ? productos.filter(p => p.estado === 'activo').length
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Bienvenido a BusinessMN 2.0</p>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link to="/inventario">
          <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Stock Perú</div>
                <div className="text-3xl font-bold text-success-600 mt-1">
                  {stockPeru}
                </div>
                <div className="text-xs text-gray-500 mt-1">unidades</div>
              </div>
              <Package className="h-12 w-12 text-success-400" />
            </div>
          </Card>
        </Link>

        <Link to="/inventario">
          <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Stock USA</div>
                <div className="text-3xl font-bold text-warning-600 mt-1">
                  {stockUSA}
                </div>
                <div className="text-xs text-gray-500 mt-1">unidades</div>
              </div>
              <Warehouse className="h-12 w-12 text-warning-400" />
            </div>
          </Card>
        </Link>

        <Link to="/ventas">
          <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Ventas Mes</div>
                <div className="text-3xl font-bold text-primary-600 mt-1">
                  S/ {resumenEjecutivo?.ventasMes?.toFixed(0) || '0'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {ventasStats?.entregadas || 0} entregadas
                </div>
              </div>
              <ShoppingCart className="h-12 w-12 text-primary-400" />
            </div>
          </Card>
        </Link>

        <Link to="/reportes">
          <Card padding="md" className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Margen Prom.</div>
                <div className="text-3xl font-bold text-success-600 mt-1">
                  {resumenEjecutivo?.margenPromedio?.toFixed(1) || '0'}%
                </div>
                <div className="text-xs text-gray-500 mt-1">margen neto</div>
              </div>
              <TrendingUp className="h-12 w-12 text-success-400" />
            </div>
          </Card>
        </Link>
      </div>

      {/* KPIs Secundarios */}
      {resumenEjecutivo && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card padding="md">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Valor Inventario</div>
              <DollarSign className="h-5 w-5 text-warning-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              S/ {resumenEjecutivo.valorInventarioPEN?.toLocaleString('es-PE', { maximumFractionDigits: 0 }) || '0'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {resumenEjecutivo.unidadesTotales || 0} unidades totales
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Utilidad Total</div>
              <TrendingUp className="h-5 w-5 text-success-500" />
            </div>
            <div className="text-2xl font-bold text-success-600">
              S/ {resumenEjecutivo.utilidadTotalPEN?.toLocaleString('es-PE', { maximumFractionDigits: 0 }) || '0'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              de todas las ventas
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">TC Actual</div>
              <Activity className="h-5 w-5 text-primary-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {resumenEjecutivo.tcActual?.toFixed(3) || '0.000'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Promedio: {resumenEjecutivo.tcPromedio?.toFixed(3) || '0.000'}
            </div>
          </Card>
        </div>
      )}

      {/* Alertas de Inventario */}
      {alertasInventario && alertasInventario.length > 0 && (
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-warning-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">
                Alertas ({alertasInventario.length})
              </h2>
            </div>
            <Link to="/reportes">
              <button className="text-sm text-primary-600 hover:text-primary-900 flex items-center">
                Ver todas
                <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            </Link>
          </div>
          <div className="space-y-2">
            {alertasInventario.slice(0, 3).map((alerta, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-warning-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {alerta.marca} {alerta.nombreComercial}
                  </p>
                  <p className="text-xs text-gray-600">{alerta.mensaje}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  alerta.prioridad === 'alta' 
                    ? 'bg-danger-100 text-danger-800' 
                    : 'bg-warning-100 text-warning-800'
                }`}>
                  {alerta.prioridad.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tendencia de Ventas */}
      {tendenciaVentas && tendenciaVentas.length > 0 && (
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Tendencia de Ventas (30 días)
            </h2>
            <Link to="/reportes">
              <button className="text-sm text-primary-600 hover:text-primary-900 flex items-center">
                Ver reportes
                <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            </Link>
          </div>
          <TendenciaChart data={tendenciaVentas} />
        </Card>
      )}

      {/* Estado del Sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card padding="md">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado del Sistema</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Productos registrados</span>
              <span className="text-lg font-semibold text-gray-900">{productosActivos}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Órdenes de compra activas</span>
              <span className="text-lg font-semibold text-warning-600">
                {(ordenesStats?.enviadas || 0) + (ordenesStats?.pagadas || 0) + (ordenesStats?.enTransito || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Ventas del día</span>
              <span className="text-lg font-semibold text-gray-900">
                S/ {resumenEjecutivo?.ventasHoy?.toFixed(0) || '0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Cotizaciones pendientes</span>
              <span className="text-lg font-semibold text-gray-900">
                {ventasStats?.cotizaciones || 0}
              </span>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Accesos Rápidos</h3>
          <div className="space-y-2">
            <Link to="/productos" className="block">
              <button className="w-full text-left px-4 py-3 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Nuevo Producto</span>
                  <ArrowRight className="h-4 w-4 text-primary-600" />
                </div>
              </button>
            </Link>
            <Link to="/compras" className="block">
              <button className="w-full text-left px-4 py-3 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Nueva Orden de Compra</span>
                  <ArrowRight className="h-4 w-4 text-primary-600" />
                </div>
              </button>
            </Link>
            <Link to="/ventas" className="block">
              <button className="w-full text-left px-4 py-3 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Nueva Venta</span>
                  <ArrowRight className="h-4 w-4 text-primary-600" />
                </div>
              </button>
            </Link>
            <Link to="/reportes" className="block">
              <button className="w-full text-left px-4 py-3 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Ver Reportes Completos</span>
                  <ArrowRight className="h-4 w-4 text-primary-600" />
                </div>
              </button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};