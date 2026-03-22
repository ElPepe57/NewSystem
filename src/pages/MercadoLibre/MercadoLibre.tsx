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

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  Link2,
  RefreshCw,
  Package,
  ShoppingCart,
  MessageCircle,
  Settings,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Wifi,
  WifiOff,
  BarChart3,
} from 'lucide-react';
import { useMercadoLibreStore, groupProductMaps } from '../../store/mercadoLibreStore';
import { useToastStore } from '../../store/toastStore';
import type { MLTabType } from '../../types/mercadoLibre.types';
import { TabResumen } from './TabResumen';
import { TabProductos } from './TabProductos';
import { TabOrdenes } from './TabOrdenes';
import { TabPreguntas } from './TabPreguntas';
import { TabConfiguracion } from './TabConfiguracion';

const TABS: { id: MLTabType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'resumen', label: 'Resumen', icon: BarChart3 },
  { id: 'productos', label: 'Productos', icon: Package },
  { id: 'ordenes', label: 'Órdenes', icon: ShoppingCart },
  { id: 'preguntas', label: 'Preguntas', icon: MessageCircle },
  { id: 'config', label: 'Configuración', icon: Settings },
];

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

export const MercadoLibre: React.FC = () => {
  const toast = useToastStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [oauthMessage, setOauthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const {
    config,
    productMaps,
    orderSyncs,
    questions,
    activeTab,
    loading,
    syncing,
    syncingStock,
    syncingBuyBox,
    error,
    initialize,
    cleanup,
    setActiveTab,
    getAuthUrl,
    syncItems,
    syncStock,
    syncBuyBox,
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
      window.location.href = url;
    } catch {
      // Error ya manejado en el store
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncItems();
      toast.success(`Sincronizacion completada: ${result.total} items (${result.nuevos} nuevos, ${result.actualizados} actualizados)`);
    } catch {
      // Error ya manejado en el store
    }
  };

  const handleSyncStock = async () => {
    try {
      const result = await syncStock();
      toast.success(`Stock sincronizado: ${result.synced} publicaciones actualizadas${result.errors > 0 ? `, ${result.errors} con error` : ''}`);
    } catch {
      // Error ya manejado en el store
    }
  };

  const handleSyncBuyBox = async () => {
    try {
      const result = await syncBuyBox();
      toast.success(`Competencia actualizada: ${result.checked} revisadas. ${result.winning} ganando, ${result.competing} perdiendo, ${result.sharing} compartiendo, ${result.listed} sin competir${result.errors > 0 ? `, ${result.errors} errores` : ''}`);
    } catch {
      // Error ya manejado en el store
    }
  };

  // Agrupar publicaciones ML por SKU
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
            <TabResumen
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
            <TabProductos
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
          {activeTab === 'ordenes' && <TabOrdenes orderSyncs={orderSyncs} />}
          {activeTab === 'preguntas' && <TabPreguntas questions={questions} />}
          {activeTab === 'config' && <TabConfiguracion config={config} onConnect={handleConnect} />}
        </>
      )}
    </div>
  );
};
