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
} from 'lucide-react';
import { useMercadoLibreStore, groupProductMaps } from '../../store/mercadoLibreStore';
import { useAuthStore } from '../../store/authStore';
import { useProductoStore } from '../../store/productoStore';
import { Modal } from '../../components/common/Modal';
import type { MLTabType, MLProductMap, MLProductGroup, MLOrderSync } from '../../types/mercadoLibre.types';
import type { Producto } from '../../types/producto.types';

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mercado Libre</h1>
            <p className="text-sm text-gray-500">
              {config?.connected
                ? `Conectado como ${config.nickname || 'VitaSkin'}`
                : 'No conectado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {config?.connected ? (
            <>
              <span className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                <Wifi className="w-3.5 h-3.5" />
                Conectado
              </span>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm font-medium"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-medium"
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'ordenes' && ordenesPendientes > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">
                    {ordenesPendientes}
                  </span>
                )}
                {tab.id === 'preguntas' && preguntasSinResponder > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full">
                    {preguntasSinResponder}
                  </span>
                )}
                {tab.id === 'productos' && sinVincular > 0 && (
                  <span className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">
                    {sinVincular}
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
              onSync={handleSync}
              onSyncStock={handleSyncStock}
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
  onSync: () => void;
  onSyncStock: () => void;
}> = ({ productMaps, productGroups, syncing, syncingStock, onSync, onSyncStock }) => {
  const [filter, setFilter] = useState<'todos' | 'vinculados' | 'sin_vincular'>('todos');
  const [search, setSearch] = useState('');
  const [vinculandoPM, setVinculandoPM] = useState<MLProductMap | null>(null);
  const { vincularProducto, desvincularProducto } = useMercadoLibreStore();

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
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['todos', 'vinculados', 'sin_vincular'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filter === f
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'todos' ? 'Todos' : f === 'vinculados' ? 'Vinculados' : 'Sin vincular'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSyncStock}
            disabled={syncingStock}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg disabled:opacity-50"
            title="Sincronizar stock del ERP hacia ML"
          >
            <ArrowUpDown className={`w-4 h-4 ${syncingStock ? 'animate-pulse' : ''}`} />
            {syncingStock ? 'Sincronizando...' : 'Sync Stock'}
          </button>
          <button
            onClick={onSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
        </div>
      </div>

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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="w-8 px-2 py-3"></th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Producto ML</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">SKU ML</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Precio</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Stock ML</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Producto ERP</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Estado</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredGroups.map((group) => (
                <ProductGroupRow
                  key={group.groupKey}
                  group={group}
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
      )}

      {/* Modal de vinculación */}
      <VincularProductoModal
        isOpen={!!vinculandoPM}
        onClose={() => setVinculandoPM(null)}
        mlProduct={vinculandoPM}
        onSelect={handleSelectProducto}
      />
    </div>
  );
};

// ---- PRODUCT GROUP ROW (agrupado por SKU) ----
const ProductGroupRow: React.FC<{
  group: MLProductGroup;
  onVincular: (pm: MLProductMap) => void;
  onDesvincular: (pm: MLProductMap) => void;
}> = ({ group, onVincular, onDesvincular }) => {
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
  const { procesarPendientes, procesando } = useMercadoLibreStore();
  const [batchResult, setBatchResult] = useState<{ procesadas: number; errores: number } | null>(null);

  const filtered = filter === 'todos'
    ? orderSyncs
    : orderSyncs.filter((o) => o.estado === filter);

  const pendientesProcesables = orderSyncs.filter(
    (o) => (o.estado === 'pendiente' || o.estado === 'error') && o.todosVinculados
  );

  const handleProcesarTodos = async () => {
    setBatchResult(null);
    try {
      const result = await procesarPendientes();
      setBatchResult(result);
    } catch {
      // Error manejado en el store
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
          {[
            { id: 'todos', label: 'Todas' },
            { id: 'pendiente', label: 'Pendientes' },
            { id: 'procesada', label: 'Procesadas' },
            { id: 'error', label: 'Con error' },
          ].map((f) => {
            const count = f.id === 'todos' ? orderSyncs.length : orderSyncs.filter((o) => o.estado === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
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

        {pendientesProcesables.length > 0 && (
          <button
            onClick={handleProcesarTodos}
            disabled={procesando}
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

      {batchResult && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-green-50 border border-green-200 text-green-700">
          <CheckCircle2 className="w-4 h-4" />
          {batchResult.procesadas} procesada{batchResult.procesadas !== 1 ? 's' : ''}
          {batchResult.errores > 0 && `, ${batchResult.errores} error${batchResult.errores !== 1 ? 'es' : ''}`}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay órdenes {filter !== 'todos' ? `con estado "${filter}"` : ''}</p>
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

  return (
    <>
      <div
        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
        onClick={() => setShowDetail(true)}
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${cfg.color}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">
              ML-{order.mlOrderId}
              {order.numeroVenta && (
                <span className="text-green-600 ml-2">→ {order.numeroVenta}</span>
              )}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {order.mlBuyerName || `Buyer #${order.mlBuyerId}`}
              {expanded && order.distrito && ` · ${order.distrito}`}
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
            <p className="text-sm font-semibold">S/ {order.totalML?.toFixed(2)}</p>
            {order.comisionML > 0 && (
              <p className="text-xs text-gray-400">Com: S/ {order.comisionML.toFixed(2)}</p>
            )}
          </div>

          {canProcess && (
            <button
              onClick={handleProcesar}
              disabled={procesando}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
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
          )}
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

  const costoEnvio = order.costoEnvioCliente || order.costoEnvioML || 0;
  const totalConEnvio = order.totalML + costoEnvio;

  return (
    <Modal isOpen onClose={onClose} title={`Orden ML-${order.mlOrderId}`} size="lg">
      <div className="space-y-4">
        {/* Estado */}
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${
            order.estado === 'procesada' ? 'text-green-600 bg-green-50' :
            order.estado === 'error' ? 'text-red-600 bg-red-50' :
            'text-amber-600 bg-amber-50'
          }`}>
            {order.estado === 'procesada' ? <CheckCircle2 className="w-4 h-4" /> :
             order.estado === 'error' ? <XCircle className="w-4 h-4" /> :
             <Clock className="w-4 h-4" />}
            {order.estado.charAt(0).toUpperCase() + order.estado.slice(1)}
          </span>
          {order.numeroVenta && (
            <span className="text-sm font-medium text-green-600">{order.numeroVenta}</span>
          )}
        </div>

        {/* Error */}
        {order.errorDetalle && (
          <div className="text-sm bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
            {order.errorDetalle}
          </div>
        )}

        {/* Buyer */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
          <h4 className="text-xs font-semibold text-gray-500 uppercase">Comprador</h4>
          <p className="text-sm font-medium">{order.mlBuyerName || `Buyer #${order.mlBuyerId}`}</p>
          {order.buyerDni && <p className="text-xs text-gray-500">DNI: {order.buyerDni}</p>}
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
              </p>
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
                    <p className="text-xs text-gray-400">Fee: S/ {prod.saleFee.toFixed(2)}</p>
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
          {costoEnvio > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Envío (cliente paga)</span>
              <span className="font-medium">S/ {costoEnvio.toFixed(2)}</span>
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

// ---- CONFIG TAB ----
const ConfigTab: React.FC<{
  config: any;
  onConnect: () => void;
}> = ({ config, onConnect }) => {
  const { updateConfig } = useMercadoLibreStore();

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
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Usuario:</span>
                <span className="ml-2 font-medium">{config.nickname}</span>
              </div>
              <div>
                <span className="text-gray-500">ID:</span>
                <span className="ml-2 font-mono text-xs">{config.userId}</span>
              </div>
              {config.email && (
                <div>
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
