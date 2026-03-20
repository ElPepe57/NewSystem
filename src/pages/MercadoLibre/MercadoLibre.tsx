/**
 * Página de Mercado Libre - Centro de control de la integración
 *
 * Tabs:
 * - Resumen: KPIs, estado de conexión, actividad reciente
 * - Productos: Mapeo de items ML ↔ Productos ERP
 * - Órdenes: Ventas de ML sincronizadas
 * - Preguntas: Q&A de compradores
 * - Configuración: Conexión, auto-sync, comisiones
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  Link2,
  LinkIcon,
  Unlink,
  RefreshCw,
  ExternalLink,
  Package,
  ShoppingCart,
  MessageCircle,
  Settings,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Search,
  Send,
  Wifi,
  WifiOff,
  BarChart3,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Check,
  X,
  Edit3,
  Play,
  RotateCw,
  Loader2,
  AlertTriangle,
  Eye,
  Download,
  History,
  Truck,
  Zap,
  Type,
  Trophy,
  DollarSign,
} from 'lucide-react';
import { useMercadoLibreStore, groupProductMaps } from '../../store/mercadoLibreStore';
import { useAuthStore } from '../../store/authStore';
import { useProductoStore } from '../../store/productoStore';
import { Modal } from '../../components/common/Modal';
import type { MLTabType, MLProductMap, MLProductGroup, MLOrderSync } from '../../types/mercadoLibre.types';
import type { Producto } from '../../types/producto.types';
import { PricingIntelPanel } from '../../components/modules/mercadoLibre/PricingIntelPanel';

const TABS: { id: MLTabType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'resumen', label: 'Resumen', icon: BarChart3 },
  { id: 'productos', label: 'Productos', icon: Package },
  { id: 'ordenes', label: 'Órdenes', icon: ShoppingCart },
  { id: 'preguntas', label: 'Preguntas', icon: MessageCircle },
  { id: 'config', label: 'Configuración', icon: Settings },
];

export const MercadoLibre: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [oauthMessage, setOauthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const {
    config,
    productMaps,
    orderSyncs,
    questions,
    questionsTotal,
    activeTab,
    loading,
    syncing,
    syncingStock,
    error,
    initialize,
    cleanup,
    setActiveTab,
    getAuthUrl,
    syncItems,
    syncStock,
    syncBuyBox,
    syncingBuyBox,
    fetchQuestions,
    clearError,
  } = useMercadoLibreStore();

  // Manejar callback de OAuth (params en URL después de redirigir desde ML)
  useEffect(() => {
    const mlStatus = searchParams.get('ml_status');
    if (mlStatus) {
      if (mlStatus === 'success') {
        const mlUser = searchParams.get('ml_user') || '';
        setOauthMessage({ type: 'success', text: `Conexión exitosa con Mercado Libre${mlUser ? ` (${mlUser})` : ''}` });
      } else {
        const mlError = searchParams.get('ml_error') || 'desconocido';
        setOauthMessage({ type: 'error', text: `Error al conectar: ${mlError}` });
      }
      // Limpiar params de la URL
      setSearchParams({}, { replace: true });
      // Re-inicializar para cargar config actualizada
      initialize();
      // Auto-cerrar mensaje después de 8 segundos
      setTimeout(() => setOauthMessage(null), 8000);
    }
  }, [searchParams, setSearchParams, initialize]);

  useEffect(() => {
    initialize();
    return () => cleanup();
  }, [initialize, cleanup]);

  // Cargar preguntas cuando se va a esa tab
  useEffect(() => {
    if (activeTab === 'preguntas' && config?.connected) {
      fetchQuestions();
    }
  }, [activeTab, config?.connected, fetchQuestions]);

  const handleConnect = async () => {
    try {
      const url = await getAuthUrl();
      // Redirigir en la misma ventana — el callback de ML nos traerá de vuelta
      window.location.href = url;
    } catch (err) {
      // Error ya manejado en el store
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncItems();
      alert(`Sincronización completada: ${result.total} items (${result.nuevos} nuevos, ${result.actualizados} actualizados)`);
    } catch (err) {
      // Error ya manejado en el store
    }
  };

  const handleSyncStock = async () => {
    try {
      const result = await syncStock();
      alert(`Stock sincronizado: ${result.synced} publicaciones actualizadas${result.errors > 0 ? `, ${result.errors} con error` : ''}`);
    } catch (err) {
      // Error ya manejado en el store
    }
  };

  const handleSyncBuyBox = async () => {
    try {
      const result = await syncBuyBox();
      alert(`Competencia actualizada: ${result.checked} revisadas — ${result.winning} ganando, ${result.competing} perdiendo, ${result.sharing} compartiendo, ${result.listed} sin competir${result.errors > 0 ? `, ${result.errors} errores` : ''}`);
    } catch (err) {
      // Error ya manejado en el store
    }
  };

  // Agrupar publicaciones ML por SKU (productos unicos, no publicaciones duplicadas)
  const productGroups = useMemo(() => groupProductMaps(productMaps), [productMaps]);
  const vinculados = productGroups.filter((g) => g.vinculado).length;
  const sinVincular = productGroups.filter((g) => !g.vinculado).length;
  const ordenesPendientes = orderSyncs.filter((o) => o.estado === 'pendiente').length;
  const ordenesProcesadas = orderSyncs.filter((o) => o.estado === 'procesada').length;
  const preguntasSinResponder = questions.filter((q) => q.status === 'UNANSWERED').length;

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
        <span className="ml-2 text-gray-600">Cargando Mercado Libre...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* OAuth callback message */}
      {oauthMessage && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
          oauthMessage.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {oauthMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{oauthMessage.text}</span>
          <button onClick={() => setOauthMessage(null)} className="ml-auto text-gray-400 hover:text-gray-600">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-6 h-6 text-yellow-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Mercado Libre</h1>
              {config?.connected && (
                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">
                  <Wifi className="w-3 h-3" />
                  <span className="hidden sm:inline">Conectado</span>
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate">
              {config?.connected
                ? `${config.nickname || 'VitaSkin'}`
                : 'No conectado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {config?.connected ? (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm font-medium w-full sm:w-auto justify-center"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          ) : (
            <button
              onClick={handleConnect}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-medium w-full sm:w-auto justify-center"
            >
              <Link2 className="w-4 h-4" />
              Conectar Mercado Libre
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
          <button onClick={clearError} className="text-red-400 hover:text-red-600">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs — icon-only on mobile, icon+label on sm+ */}
      <div className="border-b border-gray-200">
        <nav className="flex justify-between sm:justify-start sm:space-x-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badge =
              (tab.id === 'ordenes' && ordenesPendientes > 0) ? ordenesPendientes :
              (tab.id === 'preguntas' && preguntasSinResponder > 0) ? preguntasSinResponder :
              (tab.id === 'productos' && sinVincular > 0) ? sinVincular : null;
            const badgeColor =
              tab.id === 'ordenes' ? 'bg-amber-100 text-amber-700' :
              tab.id === 'preguntas' ? 'bg-red-100 text-red-700' :
              'bg-orange-100 text-orange-700';
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 py-2 sm:py-3 px-1 sm:px-1 border-b-2 text-xs sm:text-sm font-medium transition-colors flex-1 sm:flex-initial ${
                  isActive
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="relative">
                  <Icon className="w-5 h-5 sm:w-4 sm:h-4" />
                  {badge !== null && (
                    <span className={`absolute -top-1.5 -right-2.5 sm:hidden ${badgeColor} text-[9px] min-w-[1rem] h-4 flex items-center justify-center px-0.5 rounded-full`}>
                      {badge}
                    </span>
                  )}
                </span>
                <span className="sm:hidden text-[10px] leading-tight">{tab.label.replace('ó', 'o').replace('Configuración', 'Config')}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {badge !== null && (
                  <span className={`hidden sm:flex ${badgeColor} text-xs min-w-[1.25rem] h-5 items-center justify-center px-1 rounded-full`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      {!config?.connected && activeTab !== 'config' ? (
        <NoConnectionCard onConnect={handleConnect} />
      ) : (
        <>
          {activeTab === 'resumen' && (
            <ResumenTab
              config={config}
              productMaps={productMaps}
              orderSyncs={orderSyncs}
              vinculados={vinculados}
              sinVincular={sinVincular}
              ordenesPendientes={ordenesPendientes}
              ordenesProcesadas={ordenesProcesadas}
              preguntasSinResponder={preguntasSinResponder}
              onNavigate={setActiveTab}
            />
          )}
          {activeTab === 'productos' && (
            <ProductosTab
              productMaps={productMaps}
              productGroups={productGroups}
              syncing={syncing}
              syncingStock={syncingStock}
              syncingBuyBox={syncingBuyBox}
              onSync={handleSync}
              onSyncStock={handleSyncStock}
              onSyncBuyBox={handleSyncBuyBox}
            />
          )}
          {activeTab === 'ordenes' && <OrdenesTab orderSyncs={orderSyncs} />}
          {activeTab === 'preguntas' && <PreguntasTab questions={questions} />}
          {activeTab === 'config' && <ConfigTab config={config} onConnect={handleConnect} />}
        </>
      )}
    </div>
  );
};

// ============================================================
// COMPONENTES INTERNOS
// ============================================================

const NoConnectionCard: React.FC<{ onConnect: () => void }> = ({ onConnect }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
    <WifiOff className="w-16 h-16 text-gray-300 mx-auto mb-4" />
    <h2 className="text-xl font-semibold text-gray-700 mb-2">Mercado Libre no está conectado</h2>
    <p className="text-gray-500 mb-6 max-w-md mx-auto">
      Conecta tu cuenta de Mercado Libre para sincronizar productos, recibir órdenes automáticamente y responder preguntas desde tu ERP.
    </p>
    <button
      onClick={onConnect}
      className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
    >
      <Link2 className="w-5 h-5" />
      Conectar Mercado Libre
    </button>
  </div>
);

// ---- RESUMEN TAB ----
const ResumenTab: React.FC<{
  config: any;
  productMaps: MLProductMap[];
  orderSyncs: MLOrderSync[];
  vinculados: number;
  sinVincular: number;
  ordenesPendientes: number;
  ordenesProcesadas: number;
  preguntasSinResponder: number;
  onNavigate: (tab: MLTabType) => void;
}> = ({ vinculados, sinVincular, ordenesPendientes, ordenesProcesadas, preguntasSinResponder, orderSyncs, onNavigate }) => {
  const totalVentasML = orderSyncs
    .filter((o) => o.estado === 'procesada')
    .reduce((sum, o) => sum + o.totalML, 0);
  const totalComisiones = orderSyncs
    .filter((o) => o.estado === 'procesada')
    .reduce((sum, o) => sum + o.comisionML, 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Productos Vinculados"
          value={`${vinculados}/${vinculados + sinVincular}`}
          icon={LinkIcon}
          color="blue"
          onClick={() => onNavigate('productos')}
        />
        <KPICard
          label="Órdenes Pendientes"
          value={ordenesPendientes}
          icon={Clock}
          color={ordenesPendientes > 0 ? 'amber' : 'green'}
          onClick={() => onNavigate('ordenes')}
        />
        <KPICard
          label="Ventas ML (mes)"
          value={`S/ ${totalVentasML.toFixed(0)}`}
          icon={ShoppingCart}
          color="green"
        />
        <KPICard
          label="Preguntas"
          value={preguntasSinResponder}
          icon={MessageCircle}
          color={preguntasSinResponder > 0 ? 'red' : 'gray'}
          onClick={() => onNavigate('preguntas')}
        />
      </div>

      {/* Actividad reciente */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Órdenes Recientes</h3>
        {orderSyncs.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No hay órdenes sincronizadas aún</p>
        ) : (
          <div className="space-y-2">
            {orderSyncs.slice(0, 5).map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
            {orderSyncs.length > 5 && (
              <button
                onClick={() => onNavigate('ordenes')}
                className="w-full text-center text-sm text-amber-600 hover:text-amber-700 py-2 font-medium"
              >
                Ver todas las órdenes ({orderSyncs.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Alertas */}
      {sinVincular > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <div>
              <p className="font-medium text-orange-800">
                {sinVincular} producto{sinVincular > 1 ? 's' : ''} sin vincular
              </p>
              <p className="text-sm text-orange-600">
                Vincula tus productos de ML con los del ERP para procesar órdenes automáticamente.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('productos')}
            className="flex items-center gap-1 text-sm font-medium text-orange-700 hover:text-orange-800"
          >
            Vincular <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// ---- PRODUCTOS TAB ----
const ProductosTab: React.FC<{
  productMaps: MLProductMap[];
  productGroups: MLProductGroup[];
  syncing: boolean;
  syncingStock: boolean;
  syncingBuyBox: boolean;
  onSync: () => void;
  onSyncStock: () => void;
  onSyncBuyBox: () => void;
}> = ({ productMaps, productGroups, syncing, syncingStock, syncingBuyBox, onSync, onSyncStock, onSyncBuyBox }) => {
  const [view, setView] = useState<'productos' | 'precios'>('productos');
  const [filter, setFilter] = useState<'todos' | 'vinculados' | 'sin_vincular'>('todos');
  const [search, setSearch] = useState('');
  const [vinculandoPM, setVinculandoPM] = useState<MLProductMap | null>(null);
  const { vincularProducto, desvincularProducto } = useMercadoLibreStore();
  const { productos, fetchProductos } = useProductoStore();

  useEffect(() => {
    if (productos.length === 0) fetchProductos();
  }, [productos.length, fetchProductos]);

  // Mapa de productoId → stock efectivo para ML (disponible - pendientes no procesadas)
  // stockEfectivoML = stockDisponiblePeru - stockPendienteML
  // Refleja lo que ML realmente debería tener como available_quantity
  const stockERPMap = useMemo(() => {
    const map = new Map<string, number>();
    productos.forEach(p => {
      const stock = p.stockEfectivoML ?? p.stockDisponiblePeru ?? p.stockDisponible ?? 0;
      map.set(p.id, stock);
    });
    return map;
  }, [productos]);

  const filteredGroups = useMemo(() => {
    return productGroups.filter((g) => {
      if (filter === 'vinculados' && !g.vinculado) return false;
      if (filter === 'sin_vincular' && g.vinculado) return false;
      if (search) {
        const s = search.toLowerCase();
        return g.listings.some(
          (p) =>
            p.mlTitle.toLowerCase().includes(s) ||
            p.mlSku?.toLowerCase().includes(s) ||
            p.productoNombre?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [productGroups, filter, search]);

  const handleVincular = (pm: MLProductMap) => {
    setVinculandoPM(pm);
  };

  const handleDesvincular = async (pm: MLProductMap) => {
    const siblings = productMaps.filter((p) => p.mlSku && p.mlSku === pm.mlSku && p.id !== pm.id);
    const msg = siblings.length > 0
      ? `¿Desvincular "${pm.mlTitle}" y ${siblings.length} publicacion(es) hermana(s) del producto ERP?`
      : `¿Desvincular "${pm.mlTitle}" del producto ERP?`;
    if (!confirm(msg)) return;
    try {
      await desvincularProducto(pm.id);
    } catch {
      // error handled in store
    }
  };

  const handleSelectProducto = async (producto: Producto) => {
    if (!vinculandoPM) return;
    try {
      await vincularProducto(
        vinculandoPM.id,
        producto.id,
        producto.sku,
        `${producto.marca} ${producto.nombreComercial}`
      );
      setVinculandoPM(null);
    } catch {
      // error handled in store
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar — responsive */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
            {(['todos', 'vinculados', 'sin_vincular'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filter === f
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="sm:hidden">{f === 'todos' ? 'Todos' : f === 'vinculados' ? 'Vinc.' : 'Pend.'}</span>
                <span className="hidden sm:inline">{f === 'todos' ? 'Todos' : f === 'vinculados' ? 'Vinculados' : 'Sin vincular'}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSyncBuyBox}
            disabled={syncingBuyBox}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg disabled:opacity-50"
            title="Consultar estado de competencia (Buy Box) en ML"
          >
            <Trophy className={`w-3.5 h-3.5 ${syncingBuyBox ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{syncingBuyBox ? 'Consultando...' : 'Buy Box'}</span>
          </button>
          <button
            onClick={onSyncStock}
            disabled={syncingStock}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg disabled:opacity-50"
            title="Sincronizar stock del ERP hacia ML"
          >
            <ArrowUpDown className={`w-3.5 h-3.5 ${syncingStock ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{syncingStock ? 'Sincronizando...' : 'Sync Stock'}</span>
          </button>
          <button
            onClick={onSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>
          <div className="w-px h-6 bg-gray-200" />
          <button
            onClick={() => setView(view === 'productos' ? 'precios' : 'productos')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              view === 'precios'
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={view === 'precios' ? 'Ver productos' : 'Ver pricing inteligente'}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{view === 'precios' ? 'Productos' : 'Precios'}</span>
          </button>
        </div>
      </div>

      {/* Pricing Intel view */}
      {view === 'precios' ? (
        <PricingIntelPanel productMaps={productMaps} />
      ) : (
      <div className="space-y-4">
      {/* Product list */}
      {productMaps.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No hay productos sincronizados</p>
          <button
            onClick={onSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar ahora
          </button>
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 px-2 py-3"></th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Producto ML</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">SKU ML</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Precio</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Stock ML</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Stock ERP</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Producto ERP</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Competencia</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Estado</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredGroups.map((group) => (
                  <ProductGroupRow
                    key={group.groupKey}
                    group={group}
                    stockERP={group.productoId ? stockERPMap.get(group.productoId) : undefined}
                    onVincular={handleVincular}
                    onDesvincular={handleDesvincular}
                  />
                ))}
              </tbody>
            </table>
            {filteredGroups.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">No se encontraron productos</p>
            )}
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {filteredGroups.map((group) => (
              <ProductGroupCard
                key={group.groupKey}
                group={group}
                stockERP={group.productoId ? stockERPMap.get(group.productoId) : undefined}
                onVincular={handleVincular}
                onDesvincular={handleDesvincular}
              />
            ))}
            {filteredGroups.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">No se encontraron productos</p>
            )}
          </div>
        </>
      )}

      {/* Modal de vinculación */}
      <VincularProductoModal
        isOpen={!!vinculandoPM}
        onClose={() => setVinculandoPM(null)}
        mlProduct={vinculandoPM}
        onSelect={handleSelectProducto}
      />
      </div>
      )}
    </div>
  );
};

// ---- BUY BOX BADGE (competencia de catálogo) ----
const BuyBoxBadge: React.FC<{ listing: MLProductMap }> = ({ listing }) => {
  if (listing.mlListingType !== 'catalogo' || !listing.buyBoxStatus) {
    return <span className="text-gray-300 text-xs">—</span>;
  }

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    winning: { label: 'GANANDO', bg: 'bg-green-50', text: 'text-green-700' },
    competing: { label: 'PERDIENDO', bg: 'bg-red-50', text: 'text-red-700' },
    sharing_first_place: { label: 'COMPARTIENDO', bg: 'bg-yellow-50', text: 'text-yellow-700' },
    listed: { label: 'SIN COMPETIR', bg: 'bg-gray-100', text: 'text-gray-500' },
  };

  const cfg = statusConfig[listing.buyBoxStatus] || statusConfig.listed;

  return (
    <div className="space-y-0.5">
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
        {cfg.label}
      </span>
      {listing.buyBoxStatus === 'competing' && listing.buyBoxPriceToWin != null && (
        <p className="text-[10px] text-red-500">
          Precio p/ganar: S/ {listing.buyBoxPriceToWin.toFixed(2)}
        </p>
      )}
      {listing.buyBoxStatus === 'competing' && listing.buyBoxWinnerPrice != null && (
        <p className="text-[10px] text-gray-400">
          Ganador: S/ {listing.buyBoxWinnerPrice.toFixed(2)}
        </p>
      )}
    </div>
  );
};

// ---- MOBILE: PRODUCT GROUP CARD ----
const ProductGroupCard: React.FC<{
  group: MLProductGroup;
  stockERP?: number;
  onVincular: (pm: MLProductMap) => void;
  onDesvincular: (pm: MLProductMap) => void;
}> = ({ group, stockERP, onVincular, onDesvincular }) => {
  const [expanded, setExpanded] = useState(false);
  const hasMultiple = group.listings.length > 1;
  const primaryListing = group.listings[0];

  const prices = group.listings.map((l) => l.mlPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceDisplay = minPrice === maxPrice
    ? `S/ ${minPrice.toFixed(2)}`
    : `S/ ${minPrice.toFixed(2)} – ${maxPrice.toFixed(2)}`;

  const stockMismatch = group.vinculado && stockERP !== undefined && stockERP !== group.stockML;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header: imagen + titulo + badge */}
      <div className="flex items-start gap-3 p-3">
        {primaryListing.mlThumbnail && (
          <img src={primaryListing.mlThumbnail} alt="" className="w-14 h-14 rounded-lg object-cover bg-gray-100 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">{primaryListing.mlTitle}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <p className="text-[10px] text-gray-400">{primaryListing.mlItemId}</p>
            {hasMultiple && (
              <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                {group.listings.length} pub.
              </span>
            )}
            {group.vinculado ? (
              <span className="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">Vinculado</span>
            ) : (
              <span className="text-[10px] font-medium text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-full">Pendiente</span>
            )}
          </div>
        </div>
        {/* Acciones */}
        <div className="flex items-center gap-0.5 shrink-0">
          {group.vinculado ? (
            <button
              onClick={() => onDesvincular(primaryListing)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
              title="Desvincular"
            >
              <Unlink className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => onVincular(primaryListing)}
              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
              title="Vincular"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
          )}
          <a
            href={primaryListing.mlPermalink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Datos: grid compacto */}
      <div className="grid grid-cols-3 gap-px bg-gray-100 border-t border-gray-100">
        <div className="bg-white px-3 py-2">
          <p className="text-[10px] text-gray-400 uppercase">Precio</p>
          <p className="text-sm font-semibold text-gray-900">{priceDisplay}</p>
        </div>
        <div className="bg-white px-3 py-2">
          <p className="text-[10px] text-gray-400 uppercase">Stock ML</p>
          <p className="text-sm font-semibold text-gray-900">{group.stockML}</p>
        </div>
        <div className="bg-white px-3 py-2">
          <p className="text-[10px] text-gray-400 uppercase">Stock ERP</p>
          {group.vinculado ? (
            <p className={`text-sm font-semibold ${stockMismatch ? 'text-orange-600' : 'text-gray-900'}`}>
              {stockERP ?? '—'} {stockMismatch && <AlertTriangle className="w-3 h-3 inline" />}
            </p>
          ) : (
            <p className="text-sm text-gray-300">—</p>
          )}
        </div>
      </div>

      {/* SKU + Producto ERP + Competencia */}
      <div className="border-t border-gray-100 px-3 py-2 space-y-1.5">
        {group.mlSku && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">SKU</span>
            <span className="text-xs text-gray-600 font-mono">{group.mlSku}</span>
          </div>
        )}
        {group.vinculado && group.productoNombre && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-gray-400 shrink-0">ERP</span>
            <span className="text-xs text-gray-700 font-medium truncate">{group.productoNombre}</span>
          </div>
        )}
        {!group.vinculado && (
          <button
            onClick={() => onVincular(primaryListing)}
            className="w-full text-xs text-amber-600 hover:text-amber-700 font-medium py-1 text-center"
          >
            Vincular producto
          </button>
        )}
        {/* Buy Box badge inline */}
        {primaryListing.mlListingType === 'catalogo' && primaryListing.buyBoxStatus && (
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-gray-400">Competencia</span>
            <BuyBoxBadge listing={primaryListing} />
          </div>
        )}
      </div>

      {/* Expand sub-listings */}
      {hasMultiple && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1 py-2 border-t border-gray-100 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {expanded ? 'Ocultar publicaciones' : `Ver ${group.listings.length} publicaciones`}
          </button>
          {expanded && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {group.listings.map((listing) => (
                <MobileListingItem key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ---- MOBILE: LISTING SUB-ITEM (publicacion individual dentro de card) ----
const MobileListingItem: React.FC<{ listing: MLProductMap }> = ({ listing }) => {
  const listingType = listing.mlListingType || (listing.mlCatalogProductId ? 'catalogo' : 'clasica');

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/50">
      <span className="w-1 h-8 bg-gray-200 rounded-full shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
            listingType === 'catalogo' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {listingType === 'catalogo' ? 'Catálogo' : 'Clásica'}
          </span>
          <span className="text-xs font-medium text-gray-700">S/ {listing.mlPrice?.toFixed(2)}</span>
          {listing.buyBoxStatus && listingType === 'catalogo' && (
            <BuyBoxBadge listing={listing} />
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5">{listing.mlItemId}</p>
      </div>
      <a
        href={listing.mlPermalink}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1 text-gray-400 hover:text-amber-600 rounded-lg shrink-0"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
};

// ---- PRODUCT GROUP ROW (agrupado por SKU) ----
const ProductGroupRow: React.FC<{
  group: MLProductGroup;
  stockERP?: number;
  onVincular: (pm: MLProductMap) => void;
  onDesvincular: (pm: MLProductMap) => void;
}> = ({ group, stockERP, onVincular, onDesvincular }) => {
  const [expanded, setExpanded] = useState(false);
  const hasMultiple = group.listings.length > 1;
  const primaryListing = group.listings[0];

  // Rango de precios del grupo
  const prices = group.listings.map((l) => l.mlPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceDisplay = minPrice === maxPrice
    ? `S/ ${minPrice.toFixed(2)}`
    : `S/ ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}`;

  return (
    <>
      {/* Fila principal del grupo */}
      <tr className="hover:bg-gray-50">
        <td className="px-2 py-3">
          {hasMultiple ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-0.5 text-gray-400 hover:text-gray-600 rounded"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-4 h-4 block" />
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {primaryListing.mlThumbnail && (
              <img src={primaryListing.mlThumbnail} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{primaryListing.mlTitle}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-gray-400">{primaryListing.mlItemId}</p>
                {hasMultiple && (
                  <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                    {group.listings.length} publicaciones
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{group.mlSku || '—'}</td>
        <td className="px-4 py-3 text-sm font-medium">{priceDisplay}</td>
        <td className="px-4 py-3 text-sm">{group.stockML}</td>
        <td className="px-4 py-3 text-sm">
          {group.vinculado ? (
            stockERP !== undefined && stockERP !== group.stockML ? (
              <span className="inline-flex items-center gap-1 text-orange-700 font-medium">
                {stockERP}
                <AlertTriangle className="w-3 h-3" />
              </span>
            ) : (
              <span className="text-gray-600">{stockERP ?? '—'}</span>
            )
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          {group.vinculado ? (
            <div>
              <p className="text-sm font-medium text-gray-900">{group.productoNombre}</p>
              <p className="text-xs text-gray-400">{group.productoSku}</p>
            </div>
          ) : (
            <button
              onClick={() => onVincular(primaryListing)}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium hover:underline"
            >
              Vincular producto
            </button>
          )}
        </td>
        <td className="px-4 py-3">
          <BuyBoxBadge listing={primaryListing} />
        </td>
        <td className="px-4 py-3">
          {group.vinculado ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Vinculado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-full">
              <AlertCircle className="w-3 h-3" /> Pendiente
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            {group.vinculado ? (
              <button
                onClick={() => onDesvincular(primaryListing)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Desvincular grupo"
              >
                <Unlink className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => onVincular(primaryListing)}
                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                title="Vincular"
              >
                <LinkIcon className="w-4 h-4" />
              </button>
            )}
            <a
              href={primaryListing.mlPermalink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              title="Ver en ML"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </td>
      </tr>

      {/* Sub-filas expandidas: publicaciones individuales */}
      {expanded && hasMultiple && group.listings.map((listing) => (
        <ListingSubRow key={listing.id} listing={listing} />
      ))}
    </>
  );
};

// ---- LISTING SUB-ROW (publicacion individual dentro de un grupo) ----
const ListingSubRow: React.FC<{ listing: MLProductMap }> = ({ listing }) => {
  const { updatePrice } = useMercadoLibreStore();
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceValue, setPriceValue] = useState(String(listing.mlPrice));
  const [savingPrice, setSavingPrice] = useState(false);

  const listingType = listing.mlListingType || (listing.mlCatalogProductId ? 'catalogo' : 'clasica');

  const handleSavePrice = async () => {
    const newPrice = parseFloat(priceValue);
    if (isNaN(newPrice) || newPrice <= 0 || newPrice === listing.mlPrice) {
      setEditingPrice(false);
      return;
    }
    setSavingPrice(true);
    try {
      await updatePrice(listing.id, newPrice);
      setEditingPrice(false);
    } catch {
      // error in store
    } finally {
      setSavingPrice(false);
    }
  };

  return (
    <tr className="bg-gray-50/50 hover:bg-gray-100/50">
      <td className="px-2 py-2"></td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2 pl-4">
          <span className="w-1 h-6 bg-gray-200 rounded-full" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                listingType === 'catalogo'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {listingType === 'catalogo' ? 'Catálogo' : 'Clásica'}
              </span>
              <p className="text-xs text-gray-500 truncate max-w-[160px]">{listing.mlTitle}</p>
            </div>
            <p className="text-[10px] text-gray-400">{listing.mlItemId}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-2 text-xs text-gray-500">{listing.mlSku || '—'}</td>
      <td className="px-4 py-2">
        {editingPrice ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">S/</span>
            <input
              type="number"
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePrice();
                if (e.key === 'Escape') setEditingPrice(false);
              }}
              className="w-20 px-1.5 py-0.5 border border-amber-300 rounded text-xs focus:ring-amber-500 focus:border-amber-500"
              autoFocus
              step="0.01"
              min="0.01"
            />
            {savingPrice ? (
              <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
            ) : (
              <>
                <button onClick={handleSavePrice} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
                  <Check className="w-3 h-3" />
                </button>
                <button onClick={() => setEditingPrice(false)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                  <X className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => { setPriceValue(String(listing.mlPrice)); setEditingPrice(true); }}
            className="group flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-amber-600"
            title="Editar precio en ML"
          >
            S/ {listing.mlPrice?.toFixed(2)}
            <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </td>
      <td className="px-4 py-2 text-xs text-gray-500">{listing.mlAvailableQuantity}</td>
      <td className="px-4 py-2" colSpan={2}></td>
      <td className="px-4 py-2">
        <BuyBoxBadge listing={listing} />
      </td>
      <td className="px-4 py-2"></td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-end">
          <a
            href={listing.mlPermalink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            title="Ver en ML"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </td>
    </tr>
  );
};

// ---- MODAL VINCULAR PRODUCTO ----
const VincularProductoModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  mlProduct: MLProductMap | null;
  onSelect: (producto: Producto) => Promise<void>;
}> = ({ isOpen, onClose, mlProduct, onSelect }) => {
  const { productos, fetchProductos } = useProductoStore();
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && productos.length === 0) {
      fetchProductos();
    }
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen, productos.length, fetchProductos]);

  const filtered = useMemo(() => {
    if (!search) return productos.filter((p) => p.estado === 'activo');
    const s = search.toLowerCase();
    return productos.filter(
      (p) =>
        p.estado === 'activo' &&
        (p.nombreComercial.toLowerCase().includes(s) ||
          p.sku.toLowerCase().includes(s) ||
          p.marca.toLowerCase().includes(s))
    );
  }, [productos, search]);

  const handleSelect = async (producto: Producto) => {
    setSaving(true);
    try {
      await onSelect(producto);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Vincular con Producto ERP"
      subtitle={mlProduct?.mlTitle || ''}
      size="md"
    >
      <div className="space-y-4">
        {/* Info del producto ML */}
        {mlProduct && (
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            {mlProduct.mlThumbnail && (
              <img src={mlProduct.mlThumbnail} alt="" className="w-12 h-12 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{mlProduct.mlTitle}</p>
              <p className="text-xs text-gray-500">
                {mlProduct.mlItemId} · SKU: {mlProduct.mlSku || '—'} · S/ {mlProduct.mlPrice?.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Buscador */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
            autoFocus
          />
        </div>

        {/* Lista de productos */}
        <div className="max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">
              {search ? 'No se encontraron productos' : 'Cargando productos...'}
            </p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p)}
                disabled={saving}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 transition-colors text-left disabled:opacity-50"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {p.marca} {p.nombreComercial}
                  </p>
                  <p className="text-xs text-gray-500">
                    SKU: {p.sku} · {p.presentacion} {p.contenido} · Stock: {p.stockDisponible ?? 0}
                  </p>
                </div>
                <LinkIcon className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            ))
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          {filtered.length} producto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>
    </Modal>
  );
};

// ---- ÓRDENES TAB ----
const OrdenesTab: React.FC<{ orderSyncs: MLOrderSync[] }> = ({ orderSyncs }) => {
  const [filter, setFilter] = useState<string>('todos');
  const { procesarPendientes, importHistoricalOrders, procesando, importingOrders, reenrichBuyers, reenrichingBuyers, patchEnvio, repararVentasUrbano, repararNombresDni, consolidatePackOrders, consolidatingPacks, diagnosticoSistema, runningDiagnostic } = useMercadoLibreStore();
  const [batchResult, setBatchResult] = useState<{ procesadas: number; errores: number } | null>(null);
  const [importResult, setImportResult] = useState<{
    importadas: number;
    omitidas: number;
    errores: number;
    totalEnML: number;
  } | null>(null);
  const [reenrichResult, setReenrichResult] = useState<{
    actualizadas: number;
    clientesActualizados: number;
    errores: number;
    total: number;
  } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  const filtered = filter === 'todos'
    ? orderSyncs
    : orderSyncs.filter((o) => o.estado === filter);

  const pendientesProcesables = orderSyncs.filter(
    (o) => (o.estado === 'pendiente' || o.estado === 'error') && o.todosVinculados
  );

  // Contadores por origen para mostrar contexto
  const countHistorico = orderSyncs.filter((o) => o.origen === 'importacion_historica').length;
  const countWebhook = orderSyncs.filter((o) => o.origen === 'webhook' || !o.origen).length;

  const handleProcesarTodos = async () => {
    setBatchResult(null);
    try {
      const result = await procesarPendientes();
      setBatchResult(result);
    } catch {
      // Error manejado en el store
    }
  };

  const handleImportarHistorial = async () => {
    setImportResult(null);
    try {
      const result = await importHistoricalOrders(100);
      setImportResult(result);
    } catch {
      // Error manejado en el store
    }
  };

  const handleReenrichBuyers = async () => {
    setReenrichResult(null);
    try {
      const result = await reenrichBuyers();
      setReenrichResult(result);
    } catch {
      // Error manejado en el store
    }
  };

  const [patchingEnvio, setPatchingEnvio] = useState(false);
  const handlePatchEnvio = async () => {
    setPatchingEnvio(true);
    try {
      const result = await patchEnvio();
      alert(`Migración completada: ${result.parchadas} parchadas, ${result.sinCambio} ya tenían método, ${result.sinMetodo} sin método`);
    } catch {
      // Error manejado en el store
    } finally {
      setPatchingEnvio(false);
    }
  };

  const [reparandoUrbano, setReparandoUrbano] = useState(false);
  const [repairResult, setRepairResult] = useState<{
    reparadas: number;
    omitidas: number;
    errores: number;
    total: number;
    detalles: string[];
  } | null>(null);

  const handleRepararUrbano = async () => {
    setReparandoUrbano(true);
    setRepairResult(null);
    try {
      const result = await repararVentasUrbano();
      setRepairResult(result);
    } catch {
      // Error manejado en el store
    } finally {
      setReparandoUrbano(false);
    }
  };

  const [reparandoNombres, setReparandoNombres] = useState(false);
  const [nombresResult, setNombresResult] = useState<{
    reparadas: number;
    omitidas: number;
    errores: number;
    total: number;
    detalles: string[];
  } | null>(null);

  const handleRepararNombres = async () => {
    setReparandoNombres(true);
    setNombresResult(null);
    try {
      const result = await repararNombresDni();
      setNombresResult(result);
    } catch {
      // Error manejado en el store
    } finally {
      setReparandoNombres(false);
    }
  };

  const [packResult, setPackResult] = useState<{ duplicatesFound: number; fixed: number; log: string[] } | null>(null);
  const [packMode, setPackMode] = useState<'dry' | 'fix'>('dry');

  const handleConsolidarPacks = async (dryRun: boolean) => {
    setPackResult(null);
    setPackMode(dryRun ? 'dry' : 'fix');
    try {
      const result = await consolidatePackOrders(dryRun);
      setPackResult(result);
    } catch {
      // Error manejado en el store
    }
  };

  const [diagResult, setDiagResult] = useState<{ totalIssues: number; criticas: number; altas: number; medias: number; issues: any[]; log: string[] } | null>(null);
  const [analizandoBalance, setAnalizandoBalance] = useState(false);
  const [reingenieriaResult, setReingenieriaResult] = useState<{ dryRun: boolean; log: string[]; ordenesAnalizadas: number; ventasActualizadas: number; movimientosAnulados: number; movimientosCreados: number; gastosEliminados: number; gastosCreados: number; balanceMP: { anterior: number; calculado: number; ajusteReconciliacion: number; final: number; saldoRealMP: number | null } } | null>(null);
  const [reingenieriando, setReingenieriando] = useState(false);
  const [saldoRealMP, setSaldoRealMP] = useState<string>('2677.51');

  // Estado para diagnóstico de inconsistencias
  const [showInconsistencias, setShowInconsistencias] = useState(false);
  const [inconsistenciasLoading, setInconsistenciasLoading] = useState(false);
  const [inconsistenciasData, setInconsistenciasData] = useState<{
    totalInconsistencias: number;
    totalHuerfanos: number;
    inconsistencias: Array<any>;
    huerfanos: Array<any>;
  } | null>(null);
  const [resoluciones, setResoluciones] = useState<Map<string, { movId: string; accion: 'vincular' | 'anular' | 'skip' }>>(new Map());
  const [resolviendoInconsistencias, setResolviendoInconsistencias] = useState(false);

  const handleLoadInconsistencias = async () => {
    setInconsistenciasLoading(true);
    setInconsistenciasData(null);
    setResoluciones(new Map());
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const res = await mercadoLibreService.diagInconsistencias();
      setInconsistenciasData(res);
      setShowInconsistencias(true);
      // Auto-seleccionar candidatos con score >= 70
      const autoMap = new Map<string, { movId: string; accion: 'vincular' | 'anular' | 'skip' }>();
      for (const inc of res.inconsistencias) {
        if (inc.tipo === 'sin_movimientos' && inc.candidatos.length > 0 && inc.candidatos[0].score >= 70) {
          autoMap.set(inc.ventaId, { movId: inc.candidatos[0].movId, accion: 'vincular' });
        }
      }
      setResoluciones(autoMap);
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Error desconocido'}`);
    } finally {
      setInconsistenciasLoading(false);
    }
  };

  const handleAplicarResoluciones = async () => {
    const acciones: Array<{ movimientoId: string; ventaId?: string; ventaNumero?: string; accion: 'vincular' | 'anular' }> = [];
    for (const [ventaId, res] of resoluciones) {
      if (res.accion === 'skip') continue;
      const inc = inconsistenciasData?.inconsistencias.find((i: any) => i.ventaId === ventaId);
      acciones.push({
        movimientoId: res.movId,
        ventaId: res.accion === 'vincular' ? ventaId : undefined,
        ventaNumero: res.accion === 'vincular' ? inc?.ventaNumero : undefined,
        accion: res.accion,
      });
    }
    if (acciones.length === 0) { alert('No hay resoluciones seleccionadas'); return; }
    setResolviendoInconsistencias(true);
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const res = await mercadoLibreService.resolverInconsistencias(acciones);
      alert(`${res.exitosos}/${res.total} resueltas correctamente. Ahora corra Reingeniería Preview para verificar.`);
      setShowInconsistencias(false);
      setInconsistenciasData(null);
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Error desconocido'}`);
    } finally {
      setResolviendoInconsistencias(false);
    }
  };

  const handleDiagnostico = async () => {
    setDiagResult(null);
    try {
      const result = await diagnosticoSistema();
      setDiagResult(result);
    } catch {
      // Error manejado en el store
    }
  };

  const handleReingenieria = async (dryRun: boolean) => {
    setReingenieriaResult(null);
    setReingenieriando(true);
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const saldoReal = saldoRealMP ? parseFloat(saldoRealMP) : undefined;
      const res = await mercadoLibreService.reingenieria(dryRun, saldoReal && !isNaN(saldoReal) ? saldoReal : undefined);
      setReingenieriaResult({ ...res, dryRun });
    } catch (err: any) {
      setReingenieriaResult({
        dryRun,
        log: [`Error: ${err?.message || 'Error desconocido'}`],
        ordenesAnalizadas: 0,
        ventasActualizadas: 0,
        movimientosAnulados: 0,
        movimientosCreados: 0,
        gastosEliminados: 0,
        gastosCreados: 0,
        balanceMP: { anterior: 0, calculado: 0, ajusteReconciliacion: 0, final: 0, saldoRealMP: null },
      });
    } finally {
      setReingenieriando(false);
    }
  };

  const handleAnalizarBalance = async (dryRun: boolean) => {
    setAnalizandoBalance(true);
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const res = await mercadoLibreService.recalcularBalanceMP(dryRun);
      setDiagResult(prev => prev ? {
        ...prev,
        log: (res as any).log || [...prev.log, '', res.message],
        ...(dryRun ? {} : { totalIssues: 0, altas: 0 }),
      } : prev);
    } catch (err: any) {
      setDiagResult(prev => prev ? {
        ...prev,
        log: [...prev.log, '', `❌ Error: ${err?.message || 'Error desconocido'}`],
      } : prev);
    } finally {
      setAnalizandoBalance(false);
    }
  };

  // ---- Vinculación ML ↔ Ventas ----
  const [showVinculacion, setShowVinculacion] = useState(false);
  const [vinculacionLoading, setVinculacionLoading] = useState(false);
  const [vinculacionData, setVinculacionData] = useState<{
    totalSyncPendientes: number;
    totalVentasSinVincular: number;
    suggestions: Array<{
      syncId: string;
      mlOrderId: number;
      syncBuyerName: string;
      syncBuyerDni: string;
      syncTotal: number;
      syncFecha: string;
      syncProductos: string;
      syncMetodoEnvio: string;
      matches: Array<{
        ventaId: string;
        numeroVenta: string;
        nombreCliente: string;
        dniRuc: string;
        totalPEN: number;
        fechaCreacion: string;
        productos: string;
        score: number;
        matchDetails: string[];
      }>;
    }>;
  } | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Record<string, string>>({}); // syncId → ventaId
  const [vinculando, setVinculando] = useState(false);
  const [vinculacionResult, setVinculacionResult] = useState<{ vinculados: number; errores: number } | null>(null);

  const handleLoadSuggestions = async () => {
    setVinculacionLoading(true);
    setVinculacionData(null);
    setSelectedMatches({});
    setVinculacionResult(null);
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const res = await mercadoLibreService.matchSuggestions();
      setVinculacionData(res);
      // Auto-select high-confidence matches (score >= 60)
      const autoSelect: Record<string, string> = {};
      for (const s of res.suggestions) {
        if (s.matches.length > 0 && s.matches[0].score >= 60) {
          autoSelect[s.syncId] = s.matches[0].ventaId;
        }
      }
      setSelectedMatches(autoSelect);
      setShowVinculacion(true);
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Error desconocido'}`);
    } finally {
      setVinculacionLoading(false);
    }
  };

  const handleConfirmMatches = async () => {
    const pairs = Object.entries(selectedMatches).map(([syncId, ventaId]) => ({ syncId, ventaId }));
    if (pairs.length === 0) {
      alert('Selecciona al menos un par para vincular');
      return;
    }
    setVinculando(true);
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const res = await mercadoLibreService.confirmMatch(pairs);
      setVinculacionResult({ vinculados: res.vinculados, errores: res.errores });
      // Refresh suggestions
      const updated = await mercadoLibreService.matchSuggestions();
      setVinculacionData(updated);
      setSelectedMatches({});
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Error desconocido'}`);
    } finally {
      setVinculando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex bg-gray-100 rounded-lg p-0.5 overflow-x-auto scrollbar-hide">
          {[
            { id: 'todos', label: 'Todas' },
            { id: 'pendiente', label: 'Pendientes' },
            { id: 'procesada', label: 'Procesadas' },
            { id: 'error', label: 'Con error' },
            { id: 'ignorada', label: 'Ignoradas' },
          ].map((f) => {
            const count = f.id === 'todos' ? orderSyncs.length : orderSyncs.filter((o) => o.estado === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex-shrink-0 ${
                  filter === f.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setToolsOpen(!toolsOpen)}
              disabled={reenrichingBuyers || importingOrders || patchingEnvio || reparandoUrbano || reparandoNombres || consolidatingPacks || runningDiagnostic || reingenieriando || procesando}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              {(reenrichingBuyers || importingOrders || patchingEnvio || reparandoUrbano || consolidatingPacks || runningDiagnostic || reingenieriando) ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Settings className="w-3.5 h-3.5" />
              )}
              {reenrichingBuyers ? 'Actualizando Buyers...' :
               reparandoUrbano ? 'Reparando Urbano...' :
               reparandoNombres ? 'Reparando Nombres...' :
               patchingEnvio ? 'Parcheando Envíos...' :
               consolidatingPacks ? 'Consolidando Packs...' :
               runningDiagnostic ? 'Diagnosticando...' :
               reingenieriando ? 'Reingeniería ML...' :
               importingOrders ? 'Importando...' : 'Herramientas'}
              <ChevronDown className="w-3 h-3" />
            </button>
            {toolsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setToolsOpen(false)} />
                <div className="absolute left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={() => { setToolsOpen(false); handleReenrichBuyers(); }}
                    disabled={reenrichingBuyers || importingOrders || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-purple-500" />
                    Actualizar Buyers
                  </button>
                  <button
                    onClick={() => { setToolsOpen(false); handlePatchEnvio(); }}
                    disabled={patchingEnvio || importingOrders || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Truck className="w-3.5 h-3.5 text-teal-500" />
                    Patch Envíos
                  </button>
                  <button
                    onClick={() => { setToolsOpen(false); handleRepararUrbano(); }}
                    disabled={reparandoUrbano || procesando || reenrichingBuyers}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                    Reparar Ventas Urbano
                  </button>
                  <button
                    onClick={() => { setToolsOpen(false); handleRepararNombres(); }}
                    disabled={reparandoNombres || procesando || reenrichingBuyers}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Type className="w-3.5 h-3.5 text-purple-500" />
                    Reparar Nombres y DNI
                  </button>
                  <button
                    onClick={() => { setToolsOpen(false); handleImportarHistorial(); }}
                    disabled={importingOrders || procesando || reenrichingBuyers}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-500" />
                    Importar Historial ML
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { setToolsOpen(false); handleConsolidarPacks(true); }}
                    disabled={consolidatingPacks || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Package className="w-3.5 h-3.5 text-indigo-500" />
                    Diagnosticar Packs Duplicados
                  </button>
                  <button
                    onClick={() => { setToolsOpen(false); handleConsolidarPacks(false); }}
                    disabled={consolidatingPacks || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Package className="w-3.5 h-3.5 text-red-500" />
                    Corregir Packs Duplicados
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { setToolsOpen(false); handleDiagnostico(); }}
                    disabled={runningDiagnostic || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Search className="w-3.5 h-3.5 text-emerald-500" />
                    Diagnóstico Integral Sistema
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { setToolsOpen(false); handleLoadSuggestions(); }}
                    disabled={vinculacionLoading || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                  >
                    <Link2 className="w-3.5 h-3.5 text-blue-500" />
                    {vinculacionLoading ? 'Cargando...' : 'Vincular Órdenes ML ↔ Ventas'}
                  </button>
                  <button
                    onClick={() => { setToolsOpen(false); handleLoadInconsistencias(); }}
                    disabled={inconsistenciasLoading || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    {inconsistenciasLoading ? 'Analizando...' : 'Resolver Inconsistencias Financieras'}
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <div className="px-3 py-1.5">
                    <label className="text-[10px] text-gray-500 block mb-1">Saldo real MP (S/):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={saldoRealMP}
                      onChange={(e) => setSaldoRealMP(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-orange-300"
                      placeholder="ej: 2677.51"
                    />
                  </div>
                  <button
                    onClick={() => { setToolsOpen(false); handleReingenieria(true); }}
                    disabled={reingenieriando || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-orange-500" />
                    Reingeniería ML (Preview)
                  </button>
                  <button
                    onClick={() => { setToolsOpen(false); handleReingenieria(false); }}
                    disabled={reingenieriando || procesando}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-red-500" />
                    Ejecutar Reingeniería ML
                  </button>
                </div>
              </>
            )}
          </div>

          {pendientesProcesables.length > 0 && (
            <button
              onClick={handleProcesarTodos}
              disabled={procesando || importingOrders}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {procesando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Procesar Todos ({pendientesProcesables.length})
            </button>
          )}
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
          <Download className="w-4 h-4 flex-shrink-0" />
          <span>
            {importResult.importadas} orden{importResult.importadas !== 1 ? 'es' : ''} importada{importResult.importadas !== 1 ? 's' : ''}
            {importResult.omitidas > 0 && `, ${importResult.omitidas} ya existía${importResult.omitidas !== 1 ? 'n' : ''}`}
            {importResult.errores > 0 && `, ${importResult.errores} error${importResult.errores !== 1 ? 'es' : ''}`}
            {' '}(total en ML: {importResult.totalEnML})
          </span>
          <button onClick={() => setImportResult(null)} className="ml-auto text-blue-400 hover:text-blue-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Re-enrich result banner */}
      {reenrichResult && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-purple-50 border border-purple-200 text-purple-700">
          <RefreshCw className="w-4 h-4 flex-shrink-0" />
          <span>
            {reenrichResult.actualizadas}/{reenrichResult.total} órdenes actualizadas
            {reenrichResult.clientesActualizados > 0 && `, ${reenrichResult.clientesActualizados} cliente${reenrichResult.clientesActualizados !== 1 ? 's' : ''} actualizados`}
            {reenrichResult.errores > 0 && `, ${reenrichResult.errores} error${reenrichResult.errores !== 1 ? 'es' : ''}`}
          </span>
          <button onClick={() => setReenrichResult(null)} className="ml-auto text-purple-400 hover:text-purple-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Repair Urbano result banner */}
      {repairResult && (
        <div className="px-3 py-2 text-xs rounded-lg bg-orange-50 border border-orange-200 text-orange-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              {repairResult.reparadas} venta{repairResult.reparadas !== 1 ? 's' : ''} reparada{repairResult.reparadas !== 1 ? 's' : ''}
              {repairResult.errores > 0 && `, ${repairResult.errores} error${repairResult.errores !== 1 ? 'es' : ''}`}
            </span>
            <button onClick={() => setRepairResult(null)} className="ml-auto text-orange-400 hover:text-orange-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {repairResult.detalles.length > 0 && (
            <ul className="mt-1 ml-6 space-y-0.5 text-[11px] text-orange-600">
              {repairResult.detalles.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Repair Nombres/DNI result banner */}
      {nombresResult && (
        <div className="px-3 py-2 text-xs rounded-lg bg-purple-50 border border-purple-200 text-purple-700">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              {nombresResult.reparadas} venta{nombresResult.reparadas !== 1 ? 's' : ''} corregida{nombresResult.reparadas !== 1 ? 's' : ''}
              {nombresResult.errores > 0 && `, ${nombresResult.errores} error${nombresResult.errores !== 1 ? 'es' : ''}`}
            </span>
            <button onClick={() => setNombresResult(null)} className="ml-auto text-purple-400 hover:text-purple-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {nombresResult.detalles.length > 0 && (
            <ul className="mt-1 ml-6 space-y-0.5 text-[11px] text-purple-600">
              {nombresResult.detalles.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Pack consolidation result banner */}
      {packResult && (
        <div className="px-3 py-2 text-xs rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              {packMode === 'dry' ? 'Diagnóstico' : 'Corrección'}: {packResult.duplicatesFound} pack{packResult.duplicatesFound !== 1 ? 's' : ''} duplicado{packResult.duplicatesFound !== 1 ? 's' : ''} encontrado{packResult.duplicatesFound !== 1 ? 's' : ''}
              {packMode === 'fix' && `, ${packResult.fixed} corregido${packResult.fixed !== 1 ? 's' : ''}`}
            </span>
            <button onClick={() => setPackResult(null)} className="ml-auto text-indigo-400 hover:text-indigo-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {packResult.log.length > 0 && (
            <ul className="mt-1 ml-6 space-y-0.5 text-[11px] text-indigo-600 max-h-40 overflow-y-auto">
              {packResult.log.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Diagnostic result banner */}
      {diagResult && (
        <div className={`px-3 py-2 text-xs rounded-lg border ${
          diagResult.totalIssues === 0
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : diagResult.criticas > 0
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              {diagResult.totalIssues === 0
                ? '✅ Sistema limpio — sin registros fantasma ni inconsistencias'
                : `${diagResult.totalIssues} problema${diagResult.totalIssues !== 1 ? 's' : ''}: ${diagResult.criticas} crítico${diagResult.criticas !== 1 ? 's' : ''}, ${diagResult.altas} alto${diagResult.altas !== 1 ? 's' : ''}, ${diagResult.medias} medio${diagResult.medias !== 1 ? 's' : ''}`
              }
            </span>
            <button onClick={() => setDiagResult(null)} className="ml-auto opacity-50 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {diagResult.log.length > 0 && (
            <ul className="mt-1 ml-6 space-y-0.5 text-[11px] opacity-80 max-h-60 overflow-y-auto font-mono">
              {diagResult.log.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          {diagResult.issues?.some((i: any) => i.tipo === 'balance_mp_descuadrado') && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handleAnalizarBalance(true)}
                disabled={analizandoBalance}
                className="px-2.5 py-1 text-[11px] font-medium rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                {analizandoBalance && <Loader2 className="w-3 h-3 animate-spin" />}
                {analizandoBalance ? 'Analizando...' : 'Analizar Descuadre MP'}
              </button>
              <button
                onClick={() => handleAnalizarBalance(false)}
                disabled={analizandoBalance}
                className="px-2.5 py-1 text-[11px] font-medium rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                Corregir Balance MP
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reingeniería ML result banner */}
      {reingenieriaResult && (
        <div className={`px-3 py-2 text-xs rounded-lg border ${
          reingenieriaResult.dryRun
            ? 'bg-orange-50 border-orange-200 text-orange-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              {reingenieriaResult.dryRun ? 'Preview Reingeniería' : 'Reingeniería Ejecutada'}: {reingenieriaResult.ordenesAnalizadas} órdenes, {reingenieriaResult.ventasActualizadas} ventas actualizadas
            </span>
            <button onClick={() => setReingenieriaResult(null)} className="ml-auto opacity-50 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-1.5 ml-6 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-[11px] opacity-80">
            <span>Mov. anulados: {reingenieriaResult.movimientosAnulados}</span>
            <span>Mov. creados: {reingenieriaResult.movimientosCreados}</span>
            <span>Gastos elim: {reingenieriaResult.gastosEliminados}</span>
            <span>Gastos creados: {reingenieriaResult.gastosCreados}</span>
          </div>
          <div className="mt-1 ml-6 text-[11px] opacity-80">
            Balance MP: S/ {reingenieriaResult.balanceMP?.anterior?.toFixed(2) ?? '—'} → calculado: S/ {reingenieriaResult.balanceMP?.calculado?.toFixed(2) ?? '—'}
            {reingenieriaResult.balanceMP?.saldoRealMP != null && (
              <> | Real: S/ {reingenieriaResult.balanceMP.saldoRealMP.toFixed(2)} | Ajuste: S/ {reingenieriaResult.balanceMP.ajusteReconciliacion > 0 ? '+' : ''}{reingenieriaResult.balanceMP.ajusteReconciliacion.toFixed(2)} | Final: S/ {reingenieriaResult.balanceMP.final.toFixed(2)}</>
            )}
          </div>
          {reingenieriaResult.log.length > 0 && (
            <ul className="mt-1 ml-6 space-y-0.5 text-[11px] opacity-80 max-h-60 overflow-y-auto font-mono">
              {reingenieriaResult.log.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Panel de Inconsistencias Financieras */}
      {showInconsistencias && inconsistenciasData && (
        <div className="bg-white border border-amber-200 rounded-lg shadow-sm">
          <div className="p-4 border-b border-amber-100 bg-amber-50 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-amber-900">
                Inconsistencias Financieras ({inconsistenciasData.totalInconsistencias})
              </h3>
              <span className="text-xs text-amber-600 ml-2">
                {inconsistenciasData.totalHuerfanos} movimientos huérfanos en MP
              </span>
            </div>
            <button onClick={() => setShowInconsistencias(false)} className="text-amber-400 hover:text-amber-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {inconsistenciasData.inconsistencias.map((inc: any, idx: number) => {
              const resolucion = resoluciones.get(inc.ventaId);
              const fecha = inc.fechaVenta ? new Date(inc.fechaVenta).toLocaleDateString('es-PE') : '?';

              return (
                <div key={inc.ventaId} className={`border rounded-lg p-3 ${inc.tipo === 'sin_movimientos' ? 'border-amber-200 bg-amber-50/30' : 'border-red-200 bg-red-50/30'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${inc.tipo === 'sin_movimientos' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {inc.tipo === 'sin_movimientos' ? 'SIN MOVIMIENTO' : 'MONTO INCORRECTO'}
                    </span>
                    <span className="font-mono font-semibold text-sm">{inc.ventaNumero}</span>
                    <span className="text-xs text-gray-500">{inc.clienteNombre}</span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs text-gray-500">{fecha}</span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs font-medium">{inc.metodoEnvio}</span>
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    Total correcto: <strong className="text-green-700">S/ {inc.totalPENCorrecto.toFixed(2)}</strong>
                    {' | '}Subtotal: S/ {inc.subtotalPEN.toFixed(2)}
                    {' | '}Comisión: S/ {inc.comisionML.toFixed(2)}
                    {inc.cargoEnvioML > 0 && <> | Cargo envío: S/ {inc.cargoEnvioML.toFixed(2)}</>}
                  </div>

                  {inc.tipo === 'monto_incorrecto' && inc.movimientoActual && (
                    <div className="text-xs bg-red-50 p-2 rounded border border-red-100 mb-2">
                      Movimiento actual: <strong>S/ {inc.movimientoActual.monto.toFixed(2)}</strong> ({inc.movimientoActual.concepto})
                      <br/>Diferencia: <strong className="text-red-600">S/ {inc.diferencia?.toFixed(2)}</strong>
                      <br/><span className="text-gray-500 italic">La reingeniería anulará este movimiento y creará uno nuevo con el monto correcto.</span>
                    </div>
                  )}

                  {inc.tipo === 'sin_movimientos' && (
                    <div className="space-y-1">
                      <div className="text-[11px] text-gray-500 font-medium mb-1">Candidatos (movimientos huérfanos que podrían corresponder):</div>
                      {inc.candidatos.length === 0 ? (
                        <div className="text-xs text-gray-400 italic pl-2">Ningún candidato encontrado. Se creará movimiento nuevo en la reingeniería.</div>
                      ) : (
                        inc.candidatos.map((cand: any) => (
                          <label key={cand.movId} className={`flex items-start gap-2 p-1.5 rounded cursor-pointer hover:bg-amber-50 ${resolucion?.movId === cand.movId && resolucion?.accion === 'vincular' ? 'bg-green-50 ring-1 ring-green-300' : ''}`}>
                            <input
                              type="radio"
                              name={`inc-${inc.ventaId}`}
                              checked={resolucion?.movId === cand.movId && resolucion?.accion === 'vincular'}
                              onChange={() => {
                                const m = new Map(resoluciones);
                                m.set(inc.ventaId, { movId: cand.movId, accion: 'vincular' });
                                setResoluciones(m);
                              }}
                              className="mt-0.5"
                            />
                            <div className="text-xs flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-semibold">S/ {cand.monto.toFixed(2)}</span>
                                <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${cand.score >= 70 ? 'bg-green-100 text-green-700' : cand.score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {cand.score} pts
                                </span>
                                <span className="text-gray-400 text-[10px]">{cand.matchDetail}</span>
                              </div>
                              <div className="text-gray-500 text-[10px] mt-0.5 truncate max-w-lg">
                                {cand.tipo} | {cand.concepto} | {cand.fecha ? new Date(cand.fecha).toLocaleDateString('es-PE') : '?'}
                              </div>
                              <div className="text-gray-400 text-[9px] font-mono">{cand.movId}</div>
                            </div>
                          </label>
                        ))
                      )}
                      <label className={`flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-gray-50 ${resolucion?.accion === 'skip' || !resolucion ? 'bg-gray-50 ring-1 ring-gray-200' : ''}`}>
                        <input
                          type="radio"
                          name={`inc-${inc.ventaId}`}
                          checked={!resolucion || resolucion.accion === 'skip'}
                          onChange={() => {
                            const m = new Map(resoluciones);
                            m.set(inc.ventaId, { movId: '', accion: 'skip' });
                            setResoluciones(m);
                          }}
                          className="mt-0.5"
                        />
                        <span className="text-xs text-gray-500">No vincular (se creará movimiento nuevo en reingeniería)</span>
                      </label>
                    </div>
                  )}
                </div>
              );
            })}

            {inconsistenciasData.inconsistencias.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No se encontraron inconsistencias. El balance debería cuadrar correctamente.
              </div>
            )}
          </div>

          {/* Barra de acciones */}
          {inconsistenciasData.inconsistencias.filter((i: any) => i.tipo === 'sin_movimientos').length > 0 && (
            <div className="p-3 border-t border-amber-100 bg-amber-50/50 rounded-b-lg flex items-center justify-between">
              <div className="text-xs text-amber-700">
                {Array.from(resoluciones.values()).filter(r => r.accion === 'vincular').length} vinculaciones seleccionadas
                {' de '}
                {inconsistenciasData.inconsistencias.filter((i: any) => i.tipo === 'sin_movimientos').length} inconsistencias
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowInconsistencias(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAplicarResoluciones}
                  disabled={resolviendoInconsistencias || Array.from(resoluciones.values()).filter(r => r.accion === 'vincular').length === 0}
                  className="px-3 py-1.5 text-xs text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {resolviendoInconsistencias ? 'Aplicando...' : 'Aplicar Vinculaciones'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vinculación ML ↔ Ventas panel */}
      {showVinculacion && vinculacionData && (
        <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-800">Vincular Órdenes ML ↔ Ventas</h3>
              <span className="text-[11px] text-gray-400">
                {vinculacionData.totalSyncPendientes} pendientes · {vinculacionData.totalVentasSinVincular} ventas sin vincular
              </span>
            </div>
            <button onClick={() => setShowVinculacion(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {vinculacionResult && (
            <div className="text-xs px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg">
              ✅ {vinculacionResult.vinculados} vinculados{vinculacionResult.errores > 0 ? `, ${vinculacionResult.errores} errores` : ''}
            </div>
          )}

          {vinculacionData.suggestions.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No hay órdenes pendientes por vincular.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {vinculacionData.suggestions.map((s) => (
                <div key={s.syncId} className="border border-gray-200 rounded-lg p-3 text-xs">
                  {/* ML Order info */}
                  <div className="flex items-start gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800">ML #{s.mlOrderId}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          s.syncMetodoEnvio === 'flex' ? 'bg-green-100 text-green-700' :
                          s.syncMetodoEnvio === 'urbano' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {s.syncMetodoEnvio}
                        </span>
                        <span className="text-gray-500">{s.syncFecha}</span>
                      </div>
                      <div className="text-gray-600 mt-0.5">
                        {s.syncBuyerName} {s.syncBuyerDni ? `· DNI: ${s.syncBuyerDni}` : ''}
                        {' · '}S/ {s.syncTotal.toFixed(2)}
                      </div>
                      <div className="text-gray-400 truncate">{s.syncProductos}</div>
                    </div>
                  </div>

                  {/* Match candidates */}
                  {s.matches.length === 0 ? (
                    <div className="text-gray-400 italic ml-4">Sin coincidencias encontradas</div>
                  ) : (
                    <div className="ml-4 space-y-1">
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">Coincidencias sugeridas:</div>
                      {s.matches.map((m) => (
                        <label
                          key={m.ventaId}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                            selectedMatches[s.syncId] === m.ventaId
                              ? 'bg-blue-50 border border-blue-300'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`match-${s.syncId}`}
                            checked={selectedMatches[s.syncId] === m.ventaId}
                            onChange={() => setSelectedMatches(prev => ({ ...prev, [s.syncId]: m.ventaId }))}
                            className="text-blue-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-700">{m.numeroVenta}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                m.score >= 60 ? 'bg-emerald-100 text-emerald-700' :
                                m.score >= 30 ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {m.score}pts
                              </span>
                              <span className="text-gray-400">{m.matchDetails.join(' · ')}</span>
                            </div>
                            <div className="text-gray-500">
                              {m.nombreCliente} {m.dniRuc ? `· ${m.dniRuc}` : ''} · S/ {m.totalPEN.toFixed(2)} · {m.fechaCreacion}
                            </div>
                            <div className="text-gray-400 truncate">{m.productos}</div>
                          </div>
                        </label>
                      ))}
                      {/* Option to skip */}
                      <label className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-gray-400 hover:bg-gray-50 ${
                        !selectedMatches[s.syncId] ? 'bg-gray-50' : ''
                      }`}>
                        <input
                          type="radio"
                          name={`match-${s.syncId}`}
                          checked={!selectedMatches[s.syncId]}
                          onChange={() => setSelectedMatches(prev => {
                            const next = { ...prev };
                            delete next[s.syncId];
                            return next;
                          })}
                          className="text-gray-400"
                        />
                        <span>No vincular (omitir)</span>
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Action bar */}
          {vinculacionData.suggestions.some(s => s.matches.length > 0) && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                {Object.keys(selectedMatches).length} de {vinculacionData.suggestions.length} seleccionados
              </span>
              <button
                onClick={handleConfirmMatches}
                disabled={vinculando || Object.keys(selectedMatches).length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {vinculando ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Vincular Seleccionados
              </button>
            </div>
          )}
        </div>
      )}

      {/* Batch process result */}
      {batchResult && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-green-50 border border-green-200 text-green-700">
          <CheckCircle2 className="w-4 h-4" />
          {batchResult.procesadas} procesada{batchResult.procesadas !== 1 ? 's' : ''}
          {batchResult.errores > 0 && `, ${batchResult.errores} error${batchResult.errores !== 1 ? 'es' : ''}`}
        </div>
      )}

      {/* Origin summary when there are historical orders */}
      {countHistorico > 0 && orderSyncs.length > 0 && (
        <div className="flex items-center gap-3 text-[11px] text-gray-400 px-1">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-300" /> {countHistorico} importado{countHistorico !== 1 ? 's' : ''}
          </span>
          {countWebhook > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-300" /> {countWebhook} tiempo real
            </span>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">
            No hay órdenes {filter !== 'todos' ? `con estado "${filter}"` : 'sincronizadas'}
          </p>
          {orderSyncs.length === 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-400">
                Las órdenes llegan automáticamente por webhook, o puedes importar el historial desde ML.
              </p>
              <button
                onClick={handleImportarHistorial}
                disabled={importingOrders}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {importingOrders ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {importingOrders ? 'Importando historial...' : 'Importar Historial de ML'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y">
          {filtered.map((order) => (
            <OrderRow key={order.id} order={order} expanded />
          ))}
        </div>
      )}
    </div>
  );
};

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

const OrderRow: React.FC<{ order: MLOrderSync; expanded?: boolean }> = ({ order, expanded }) => {
  const { procesarOrden, procesando, procesandoOrderId } = useMercadoLibreStore();
  const [showDetail, setShowDetail] = useState(false);
  const [showError, setShowError] = useState(false);
  const isProcessing = procesando && procesandoOrderId === order.id;

  const estadoConfig = {
    pendiente: { icon: Clock, color: 'text-amber-600 bg-amber-50', label: 'Pendiente' },
    procesada: { icon: CheckCircle2, color: 'text-green-600 bg-green-50', label: 'Procesada' },
    error: { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Error' },
    ignorada: { icon: XCircle, color: 'text-gray-600 bg-gray-50', label: 'Ignorada' },
  };
  const cfg = estadoConfig[order.estado] || estadoConfig.pendiente;
  const Icon = cfg.icon;

  const handleProcesar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await procesarOrden(order.id);
    } catch {
      // Error manejado en el store
    }
  };

  const canProcess = (order.estado === 'pendiente' || order.estado === 'error') && order.todosVinculados;
  const hasUnlinked = order.estado === 'pendiente' && !order.todosVinculados;

  const total = (order.totalML || 0) + (order.costoEnvioCliente || 0);
  const fechaStr = order.fechaOrdenML
    ? order.fechaOrdenML.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  const buyerName = order.mlBuyerName ? toTitleCase(order.mlBuyerName) : `Buyer #${order.mlBuyerId}`;

  const isPack = !!(order.packId && (order.subOrderIds?.length || 0) > 1);
  const packProductCount = order.productos?.length || 0;

  const badges = (
    <>
      {isPack && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium leading-none inline-flex items-center gap-0.5">
          <Package className="w-2.5 h-2.5" />Pack {packProductCount} prod.
        </span>
      )}
      {order.origen === 'importacion_historica' && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium leading-none">
          Importado
        </span>
      )}
      {order.metodoEnvio === 'flex' && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium leading-none inline-flex items-center gap-0.5">
          <Zap className="w-2.5 h-2.5" />Flex
        </span>
      )}
      {order.metodoEnvio === 'urbano' && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium leading-none inline-flex items-center gap-0.5">
          <Truck className="w-2.5 h-2.5" />Urbano
        </span>
      )}
    </>
  );

  const processButton = canProcess && (
    <button
      onClick={handleProcesar}
      disabled={procesando}
      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
      title={order.estado === 'error' ? 'Reintentar' : 'Procesar'}
    >
      {isProcessing ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : order.estado === 'error' ? (
        <RotateCw className="w-3 h-3" />
      ) : (
        <Play className="w-3 h-3" />
      )}
      {order.estado === 'error' ? 'Reintentar' : 'Procesar'}
    </button>
  );

  return (
    <>
      {/* ---- Mobile card ---- */}
      <div
        className="sm:hidden px-4 py-3 hover:bg-gray-50 cursor-pointer space-y-2"
        onClick={() => setShowDetail(true)}
      >
        {/* Row 1: Estado + Total */}
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${cfg.color}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </span>
          <span className="text-sm font-bold text-gray-900">S/ {total.toFixed(2)}</span>
        </div>
        {/* Row 2: Order ID + Venta */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono text-gray-600">
            {isPack ? `Pack-${order.packId}` : `ML-${order.mlOrderId}`}
          </span>
          {order.numeroVenta && (
            <span className="text-xs font-semibold text-green-600">→ {order.numeroVenta}</span>
          )}
        </div>
        {/* Row 3: Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {badges}
        </div>
        {/* Row 4: Buyer + Date */}
        <div className="text-xs text-gray-500 truncate">
          {buyerName}
          {expanded && order.distrito && ` · ${order.distrito}`}
          {fechaStr && <span> · {fechaStr}</span>}
        </div>
        {/* Row 5: Financial details */}
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          {order.comisionML > 0 && <span>Com: S/ {order.comisionML.toFixed(2)}</span>}
          {(order.costoEnvioCliente || 0) > 0 && <span>Envío: S/ {(order.costoEnvioCliente || 0).toFixed(2)}</span>}
          {(order.cargoEnvioML || 0) > 0 && <span>Envío ML: S/ {(order.cargoEnvioML || 0).toFixed(2)}</span>}
        </div>
        {/* Warnings */}
        {hasUnlinked && (
          <p className="text-xs text-orange-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Productos sin vincular
          </p>
        )}
        {order.estado === 'error' && order.errorDetalle && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowError(!showError); }}
            className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
          >
            <AlertCircle className="w-3 h-3" />
            Ver error
          </button>
        )}
        {/* Process button */}
        {processButton && (
          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
            {processButton}
          </div>
        )}
      </div>

      {/* ---- Desktop row ---- */}
      <div
        className="hidden sm:flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
        onClick={() => setShowDetail(true)}
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${cfg.color}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5 flex-wrap">
              {isPack ? `Pack-${order.packId}` : `ML-${order.mlOrderId}`}
              {order.numeroVenta && (
                <span className="text-green-600">→ {order.numeroVenta}</span>
              )}
              {badges}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {buyerName}
              {expanded && order.distrito && ` · ${order.distrito}`}
              {fechaStr && <span className="ml-1">· {fechaStr}</span>}
            </p>
            {hasUnlinked && (
              <p className="text-xs text-orange-500 flex items-center gap-1 mt-0.5">
                <AlertTriangle className="w-3 h-3" />
                Productos sin vincular
              </p>
            )}
            {order.estado === 'error' && order.errorDetalle && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowError(!showError); }}
                className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 mt-0.5"
              >
                <AlertCircle className="w-3 h-3" />
                Ver error
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold">S/ {total.toFixed(2)}</p>
            {(order.costoEnvioCliente || 0) > 0 && (
              <p className="text-xs text-gray-400">Envío: S/ {(order.costoEnvioCliente || 0).toFixed(2)}</p>
            )}
            {order.comisionML > 0 && (
              <p className="text-xs text-gray-400">Com: S/ {order.comisionML.toFixed(2)}</p>
            )}
            {(order.cargoEnvioML || 0) > 0 && (
              <p className="text-xs text-gray-400">Envío ML: S/ {(order.cargoEnvioML || 0).toFixed(2)}</p>
            )}
          </div>
          {processButton}
        </div>
      </div>

      {showError && order.errorDetalle && (
        <div className="px-4 pb-3 -mt-1">
          <div className="text-xs bg-red-50 border border-red-200 rounded-lg p-2 text-red-700">
            {order.errorDetalle}
          </div>
        </div>
      )}

      {showDetail && (
        <OrderDetailModal order={order} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
};

// ---- ORDER DETAIL MODAL ----
const OrderDetailModal: React.FC<{ order: MLOrderSync; onClose: () => void }> = ({ order, onClose }) => {
  const { procesarOrden, procesando, procesandoOrderId } = useMercadoLibreStore();
  const isProcessing = procesando && procesandoOrderId === order.id;

  const canProcess = (order.estado === 'pendiente' || order.estado === 'error') && order.todosVinculados;

  const handleProcesar = async () => {
    try {
      await procesarOrden(order.id);
      onClose();
    } catch {
      // Error shown in store
    }
  };

  const costoEnvioCliente = order.costoEnvioCliente || 0;
  const cargoEnvioML = order.cargoEnvioML || 0;
  const esFlex = order.metodoEnvio === 'flex';
  const envioComoIngreso = esFlex ? costoEnvioCliente : 0; // Solo Flex es ingreso real del seller
  const totalConEnvio = order.totalML + envioComoIngreso;

  return (
    <Modal isOpen onClose={onClose} title={order.packId ? `Pack-${order.packId}` : `Orden ML-${order.mlOrderId}`} size="lg">
      <div className="space-y-4">
        {/* Estado + Origen */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${
              order.estado === 'procesada' ? 'text-green-600 bg-green-50' :
              order.estado === 'error' ? 'text-red-600 bg-red-50' :
              order.estado === 'ignorada' ? 'text-gray-600 bg-gray-50' :
              'text-amber-600 bg-amber-50'
            }`}>
              {order.estado === 'procesada' ? <CheckCircle2 className="w-4 h-4" /> :
               order.estado === 'error' ? <XCircle className="w-4 h-4" /> :
               order.estado === 'ignorada' ? <XCircle className="w-4 h-4" /> :
               <Clock className="w-4 h-4" />}
              {order.estado.charAt(0).toUpperCase() + order.estado.slice(1)}
            </span>
            {order.origen === 'importacion_historica' && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">
                <History className="w-3 h-3" />
                Importado
              </span>
            )}
            {order.packId && (order.subOrderIds?.length || 0) > 1 && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                <Package className="w-3 h-3" />
                Pack {order.productos?.length || 0} productos
              </span>
            )}
          </div>
          <div className="text-right">
            {order.numeroVenta && (
              <span className="text-sm font-medium text-green-600">{order.numeroVenta}</span>
            )}
            {order.fechaOrdenML && (
              <p className="text-xs text-gray-400">
                {order.fechaOrdenML.toDate().toLocaleDateString('es-PE', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>

        {/* ML Status */}
        {order.mlStatus && order.mlStatus !== 'paid' && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            Estado en ML: <span className="font-medium">{order.mlStatus}</span>
          </div>
        )}

        {/* Pack sub-orders info */}
        {order.packId && order.subOrderIds && order.subOrderIds.length > 1 && (
          <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
            <span className="font-medium">Compra multi-producto:</span>{' '}
            {order.subOrderIds.length} sub-órdenes ML ({order.subOrderIds.map(id => `#${id}`).join(', ')})
          </div>
        )}

        {/* Error */}
        {order.errorDetalle && (
          <div className="text-sm bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
            {order.errorDetalle}
          </div>
        )}

        {/* Buyer */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
          <h4 className="text-xs font-semibold text-gray-500 uppercase">Comprador</h4>
          <p className="text-sm font-medium">{order.mlBuyerName ? toTitleCase(order.mlBuyerName) : `Buyer #${order.mlBuyerId}`}</p>
          {order.mlBuyerNickname && <p className="text-xs text-gray-400">@{order.mlBuyerNickname}</p>}
          {order.buyerDni && <p className="text-xs text-gray-500">{order.buyerDocType || 'DNI'}: {order.buyerDni}</p>}
          {order.razonSocial && <p className="text-xs text-gray-500 font-medium">{order.razonSocial}</p>}
          {order.buyerEmail && <p className="text-xs text-gray-500">{order.buyerEmail}</p>}
          {order.buyerPhone && <p className="text-xs text-gray-500">Tel: {order.buyerPhone}</p>}
        </div>

        {/* Dirección */}
        {order.direccionEntrega && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <h4 className="text-xs font-semibold text-gray-500 uppercase">Dirección de entrega</h4>
            <p className="text-sm">{order.direccionEntrega}</p>
            {(order.distrito || order.provincia) && (
              <p className="text-xs text-gray-500">
                {[order.distrito, order.provincia].filter(Boolean).join(', ')}
                {order.codigoPostal && ` · C.P. ${order.codigoPostal}`}
              </p>
            )}
            {order.referenciaEntrega && (
              <p className="text-xs text-gray-500 italic">Ref: {order.referenciaEntrega}</p>
            )}
            {order.trackingNumber && (
              <p className="text-xs text-gray-500">Tracking: {order.trackingNumber}</p>
            )}
          </div>
        )}

        {/* Productos */}
        {order.productos && order.productos.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Productos</h4>
            <div className="space-y-2">
              {order.productos.map((prod, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {prod.productoNombre || prod.mlTitle}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {prod.productoSku && (
                        <span className="text-xs text-gray-400">SKU: {prod.productoSku}</span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        prod.vinculado
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {prod.vinculado ? 'Vinculado' : 'Sin vincular'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm font-medium">{prod.cantidad} × S/ {prod.precioUnitario.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">Fee: S/ {(prod.saleFee * prod.cantidad).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totales */}
        <div className="border-t pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal productos</span>
            <span className="font-medium">S/ {order.totalML.toFixed(2)}</span>
          </div>
          {esFlex && costoEnvioCliente > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Envío Flex (cliente paga)</span>
              <span className="font-medium">S/ {costoEnvioCliente.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t pt-1">
            <span>Total</span>
            <span>S/ {totalConEnvio.toFixed(2)}</span>
          </div>
          {order.comisionML > 0 && (
            <div className="flex justify-between text-xs text-gray-400">
              <span>Comisión ML</span>
              <span>- S/ {order.comisionML.toFixed(2)}</span>
            </div>
          )}
          {cargoEnvioML > 0 && (
            <div className="flex justify-between text-xs text-gray-400">
              <span>Cargo por envío ML{!esFlex && costoEnvioCliente > 0 ? ` (cliente pagó S/ ${costoEnvioCliente.toFixed(2)})` : ''}</span>
              <span>- S/ {cargoEnvioML.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Acción */}
        {canProcess && (
          <button
            onClick={handleProcesar}
            disabled={procesando}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : order.estado === 'error' ? (
              <RotateCw className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {order.estado === 'error' ? 'Reintentar procesamiento' : 'Procesar orden → Crear venta ERP'}
          </button>
        )}
      </div>
    </Modal>
  );
};

// ---- PREGUNTAS TAB ----
const PreguntasTab: React.FC<{ questions: any[] }> = ({ questions }) => {
  const { answerQuestion, fetchQuestions } = useMercadoLibreStore();
  const [answerTexts, setAnswerTexts] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<number | null>(null);

  const handleAnswer = async (questionId: number) => {
    const text = answerTexts[questionId];
    if (!text?.trim()) return;

    setSending(questionId);
    try {
      await answerQuestion(questionId, text.trim());
      setAnswerTexts((prev) => ({ ...prev, [questionId]: '' }));
    } catch {
      // Error manejado en el store
    } finally {
      setSending(null);
    }
  };

  const unanswered = questions.filter((q) => q.status === 'UNANSWERED');
  const answered = questions.filter((q) => q.status === 'ANSWERED');

  return (
    <div className="space-y-4">
      {unanswered.length === 0 && answered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay preguntas</p>
          <button
            onClick={fetchQuestions}
            className="mt-3 text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            Actualizar
          </button>
        </div>
      ) : (
        <>
          {unanswered.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Sin responder ({unanswered.length})
              </h3>
              <div className="space-y-3">
                {unanswered.map((q) => (
                  <div key={q.id} className="bg-white rounded-xl border border-orange-200 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm text-gray-800">{q.text}</p>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                        {new Date(q.date_created).toLocaleDateString('es-PE')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">Item: {q.item_id}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={answerTexts[q.id] || ''}
                        onChange={(e) =>
                          setAnswerTexts((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder="Escribe tu respuesta..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleAnswer(q.id)}
                      />
                      <button
                        onClick={() => handleAnswer(q.id)}
                        disabled={!answerTexts[q.id]?.trim() || sending === q.id}
                        className="px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                      >
                        <Send className={`w-4 h-4 ${sending === q.id ? 'animate-pulse' : ''}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {answered.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Respondidas ({answered.length})
              </h3>
              <div className="space-y-2">
                {answered.map((q) => (
                  <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-800 mb-1">{q.text}</p>
                    {q.answer && (
                      <p className="text-sm text-green-700 bg-green-50 rounded-lg p-2 mt-2">
                        {q.answer.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ---- RECONCILE STOCK BUTTON ----
const ReconcileStockButton: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ordenesPendientes: number; ordenesMigradas: number; productosActualizados: number } | null>(null);

  const handleReconcile = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const res = await mercadoLibreService.migrateStockPendiente();
      setResult(res);
    } catch (err: any) {
      console.error('Error en reconciliación:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-3">
      <button
        onClick={handleReconcile}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Reconciliando...
          </>
        ) : (
          <>
            <RotateCw className="w-4 h-4" />
            Reconciliar Stock Pendiente
          </>
        )}
      </button>
      {result && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
          <p><strong>{result.ordenesPendientes}</strong> órdenes pendientes encontradas</p>
          <p><strong>{result.ordenesMigradas}</strong> órdenes migradas (nuevas)</p>
          <p><strong>{result.productosActualizados}</strong> productos actualizados</p>
        </div>
      )}
    </div>
  );
};

// ---- CONFIG TAB ----
const ConfigTab: React.FC<{
  config: any;
  onConnect: () => void;
}> = ({ config, onConnect }) => {
  const { updateConfig } = useMercadoLibreStore();
  const [webhookStatus, setWebhookStatus] = useState<{ registered: boolean; url: string | null; loading: boolean }>({
    registered: config?.webhookRegistered || false,
    url: config?.webhookUrl || null,
    loading: false,
  });
  const [registering, setRegistering] = useState(false);

  const handleRegisterWebhook = useCallback(async () => {
    setRegistering(true);
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const result = await mercadoLibreService.registerWebhook();
      setWebhookStatus({ registered: true, url: result.registeredUrl, loading: false });
    } catch (err: any) {
      console.error('Error registrando webhook:', err);
      alert(`Error registrando webhook: ${err.message}`);
    } finally {
      setRegistering(false);
    }
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Estado de conexión */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Conexión</h3>
        {config?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-green-700">Conectado</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
              <div>
                <span className="text-gray-500">Usuario:</span>
                <span className="ml-2 font-medium">{config.nickname}</span>
              </div>
              <div>
                <span className="text-gray-500">ID:</span>
                <span className="ml-2 font-mono text-xs">{config.userId}</span>
              </div>
              {config.email && (
                <div className="break-all">
                  <span className="text-gray-500">Email:</span>
                  <span className="ml-2">{config.email}</span>
                </div>
              )}
              {config.lastSync && (
                <div>
                  <span className="text-gray-500">Última sync:</span>
                  <span className="ml-2">{config.lastSync.toDate?.().toLocaleString('es-PE')}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <WifiOff className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm mb-3">No conectado</p>
            <button
              onClick={onConnect}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-medium"
            >
              Conectar
            </button>
          </div>
        )}
      </div>

      {/* Webhook / Notificaciones */}
      {config?.connected && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Notificaciones (Webhook)</h3>
          <p className="text-xs text-gray-400 mb-4">
            ML necesita saber a dónde enviar las notificaciones de órdenes, envíos, etc.
          </p>
          {webhookStatus.registered || config?.webhookRegistered ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-700 font-medium">Webhook registrado</span>
              </div>
              <p className="text-xs text-gray-400 font-mono break-all">
                {webhookStatus.url || config?.webhookUrl}
              </p>
              <button
                onClick={handleRegisterWebhook}
                disabled={registering}
                className="mt-2 text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
              >
                {registering ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
                Re-registrar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  Webhook no registrado. Las órdenes de ML no se sincronizarán automáticamente.
                </p>
              </div>
              <button
                onClick={handleRegisterWebhook}
                disabled={registering}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium flex items-center gap-2"
              >
                {registering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4" />
                    Registrar Webhook
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reconciliación de Stock Pendiente ML */}
      {config?.connected && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Stock Efectivo ML</h3>
          <p className="text-xs text-gray-400 mb-4">
            Recalcula stockPendienteML desde cero contando órdenes pendientes. Úsalo si notas discrepancias entre stock ERP y ML.
          </p>
          <ReconcileStockButton />
        </div>
      )}

      {/* Opciones de automatización */}
      {config?.connected && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Automatización</h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Auto-crear ventas</p>
                <p className="text-xs text-gray-400">Crear ventas automáticamente cuando llega una orden pagada de ML</p>
              </div>
              <input
                type="checkbox"
                checked={config.autoCreateVentas || false}
                onChange={(e) => updateConfig({ autoCreateVentas: e.target.checked })}
                className="w-5 h-5 text-amber-500 rounded focus:ring-amber-500"
              />
            </label>
            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Auto-crear clientes</p>
                <p className="text-xs text-gray-400">Crear cliente nuevo si el comprador de ML no existe en tu ERP</p>
              </div>
              <input
                type="checkbox"
                checked={config.autoCreateClientes || false}
                onChange={(e) => updateConfig({ autoCreateClientes: e.target.checked })}
                className="w-5 h-5 text-amber-500 rounded focus:ring-amber-500"
              />
            </label>
            <div>
              <label className="text-sm font-medium text-gray-700">Comisión ML por defecto (%)</label>
              <input
                type="number"
                value={config.defaultComisionPorcentaje || 13}
                onChange={(e) => updateConfig({ defaultComisionPorcentaje: parseFloat(e.target.value) || 13 })}
                className="mt-1 w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min={0}
                max={100}
                step={0.5}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---- KPI CARD ----
const KPICard: React.FC<{
  label: string;
  value: string | number;
  icon: React.FC<{ className?: string }>;
  color: string;
  onClick?: () => void;
}> = ({ label, value, icon: Icon, color, onClick }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200 p-4 ${onClick ? 'cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.gray}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
};
