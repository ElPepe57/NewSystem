import React, { useState, useCallback } from 'react';
import { useToastStore } from '../../store/toastStore';
import {
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  Loader2,
  RotateCw,
} from 'lucide-react';
import { useMercadoLibreStore } from '../../store/mercadoLibreStore';

// ---- RECONCILE STOCK BUTTON ----
const ReconcileStockButton: React.FC = () => {
  const toast = useToastStore();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ordenesPendientes: number;
    ordenesMigradas: number;
    productosActualizados: number;
  } | null>(null);

  const handleReconcile = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const { mercadoLibreService } = await import('../../services/mercadoLibre.service');
      const res = await mercadoLibreService.migrateStockPendiente();
      setResult(res);
    } catch (err: any) {
      console.error('Error en reconciliación:', err);
      toast.error(`Error: ${err.message}`);
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
export interface TabConfiguracionProps {
  config: any;
  onConnect: () => void;
}

export const TabConfiguracion: React.FC<TabConfiguracionProps> = ({ config, onConnect }) => {
  const { updateConfig } = useMercadoLibreStore();
  const toast = useToastStore();
  const [webhookStatus, setWebhookStatus] = useState<{
    registered: boolean;
    url: string | null;
    loading: boolean;
  }>({
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
      toast.error(`Error registrando webhook: ${err.message}`);
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
