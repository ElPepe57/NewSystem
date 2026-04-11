import React, { useEffect, useState } from 'react';
import { Building2, Settings, User, RefreshCw, Database, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Card } from '../../components/common';
import { PageShell, PageHeader, Toolbar } from '../../design-system';
import { EmpresaForm } from '../../components/modules/configuracion/EmpresaForm';
import { ConfiguracionForm } from '../../components/modules/configuracion/ConfiguracionForm';
import { useConfiguracionStore } from '../../store/configuracionStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { useProductoStore } from '../../store/productoStore';
import { useProveedorStore } from '../../store/proveedorStore';
import { useClienteStore } from '../../store/clienteStore';
import { useOrdenCompraStore } from '../../store/ordenCompraStore';
import { useVentaStore } from '../../store/ventaStore';
import { useUnidadStore } from '../../store/unidadStore';
import { useMarcaStore } from '../../store/marcaStore';
import { useTipoProductoStore } from '../../store/tipoProductoStore';
import { useCategoriaStore } from '../../store/categoriaStore';
import { useCompetidorStore } from '../../store/competidorStore';
import { sincronizacionService, type SincronizacionGlobalResult } from '../../services/sincronizacion.service';
import type { EmpresaFormData, ConfiguracionFormData } from '../../types/configuracion.types';

type TabType = 'empresa' | 'general' | 'perfil' | 'sistema';

export const Configuracion: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const toast = useToastStore();

  // Store de Configuración (Empresa y General)
  const {
    empresa,
    configuracion,
    fetchEmpresa,
    saveEmpresa,
    fetchConfiguracion,
    saveConfiguracion
  } = useConfiguracionStore();

  // Stores adicionales para sincronización
  const fetchProductos = useProductoStore(state => state.fetchProductos);
  const fetchProveedores = useProveedorStore(state => state.fetchProveedores);
  const fetchProveedorStats = useProveedorStore(state => state.fetchStats);
  const fetchClientes = useClienteStore(state => state.fetchClientes);
  const fetchOrdenes = useOrdenCompraStore(state => state.fetchOrdenes);
  const fetchVentas = useVentaStore(state => state.fetchVentas);
  const fetchUnidades = useUnidadStore(state => state.fetchUnidades);
  const fetchMarcas = useMarcaStore(state => state.fetchMarcas);
  const fetchTiposActivos = useTipoProductoStore(state => state.fetchTiposActivos);
  const fetchCategoriasActivas = useCategoriaStore(state => state.fetchCategoriasActivas);
  const fetchCompetidores = useCompetidorStore(state => state.fetchCompetidores);

  const [activeTab, setActiveTab] = useState<TabType>('empresa');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para sincronización
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncResult, setSyncResult] = useState<SincronizacionGlobalResult | null>(null);

  // Cargar datos al montar
  useEffect(() => {
    fetchEmpresa();
    fetchConfiguracion();
  }, [fetchEmpresa, fetchConfiguracion]);

  // Guardar empresa
  const handleSaveEmpresa = async (data: EmpresaFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      await saveEmpresa(data, user.uid);
      toast.success('Información de la empresa guardada correctamente');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guardar configuración
  const handleSaveConfiguracion = async (data: ConfiguracionFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      await saveConfiguracion(data, user.uid);
      toast.success('Configuración guardada correctamente');
    } catch (error: any) {
      toast.error(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ejecutar sincronización
  const handleSincronizar = async () => {
    setIsSyncing(true);
    setSyncProgress(0);
    setSyncMessage('Iniciando sincronización...');
    setSyncResult(null);

    try {
      const result = await sincronizacionService.sincronizarTodo((mensaje, progreso) => {
        setSyncMessage(mensaje);
        setSyncProgress(progreso);
      });

      setSyncResult(result);

      if (result.exito) {
        toast.success(
          `Sincronización completada: ${result.resumen.totalActualizados} actualizados, ${result.resumen.totalReferenciasLimpiadas} referencias limpiadas`
        );
      } else {
        toast.warning(
          `Sincronización completada con ${result.resumen.totalErrores} errores`
        );
      }

      // Recargar TODOS los stores para reflejar cambios
      setSyncMessage('Recargando datos...');
      await Promise.all([
        fetchEmpresa(),
        fetchConfiguracion(),
        fetchProductos(),
        fetchProveedores(),
        fetchProveedorStats(),
        fetchClientes(),
        fetchOrdenes(),
        fetchVentas(),
        fetchUnidades(),
        fetchMarcas(),
        fetchTiposActivos(),
        fetchCategoriasActivas(),
        fetchCompetidores()
      ]);
    } catch (error: any) {
      toast.error(error.message, 'Error de sincronización');
    } finally {
      setIsSyncing(false);
      setSyncProgress(100);
      setSyncMessage('');
    }
  };

  const tabs = [
    { id: 'empresa' as TabType, label: 'Empresa', icon: Building2 },
    { id: 'general' as TabType, label: 'General', icon: Settings },
    { id: 'perfil' as TabType, label: 'Mi Perfil', icon: User },
    { id: 'sistema' as TabType, label: 'Sistema', icon: Database }
  ];

  return (
    <PageShell>
      <PageHeader
        title="Configuracion"
        subtitle="Administra la configuracion del sistema"
        icon={Settings}
      />
      <Toolbar />

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex overflow-x-auto scrollbar-hide gap-4 sm:gap-8 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap
                  ${isActive
                    ? 'border-teal-500 text-teal-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }
                `}
              >
                <Icon className="h-5 w-5 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div>
        {/* Tab: Empresa */}
        {activeTab === 'empresa' && (
          <Card padding="lg">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Información de la Empresa</h2>
              <p className="text-sm text-slate-600 mt-1">
                Datos generales de tu empresa
              </p>
            </div>
            <EmpresaForm
              initialData={empresa || undefined}
              onSubmit={handleSaveEmpresa}
              loading={isSubmitting}
            />
          </Card>
        )}

        {/* Tab: General */}
        {activeTab === 'general' && (
          <Card padding="lg">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Configuración General</h2>
              <p className="text-sm text-slate-600 mt-1">
                Parámetros de operación del sistema
              </p>
            </div>
            {configuracion && (
              <ConfiguracionForm
                initialData={configuracion}
                onSubmit={handleSaveConfiguracion}
                loading={isSubmitting}
              />
            )}
          </Card>
        )}

        {/* Tab: Perfil */}
        {activeTab === 'perfil' && user && (
          <Card padding="lg">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Mi Perfil</h2>
              <p className="text-sm text-slate-600 mt-1">
                Información de tu cuenta
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="h-20 w-20 rounded-full bg-teal-100 flex items-center justify-center">
                  <User className="h-10 w-10 text-teal-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{user.displayName || 'Usuario'}</h3>
                  <p className="text-sm text-slate-600">{user.email}</p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">UID</label>
                    <p className="text-sm text-slate-900 font-mono">{user.uid}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Rol</label>
                    <p className="text-sm text-slate-900">Administrador</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <p className="text-sm text-slate-900">{user.email}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Estado de verificación</label>
                  <p className="text-sm text-slate-900">
                    {user.emailVerified ? (
                      <span className="text-success-600">✓ Email verificado</span>
                    ) : (
                      <span className="text-warning-600">⚠ Email no verificado</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-slate-600">
                  Para cambiar tu contraseña o actualizar información de la cuenta,
                  contacta al administrador del sistema.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Tab: Sistema */}
        {activeTab === 'sistema' && (
          <div className="space-y-6">
            {/* Sincronización */}
            <Card padding="lg">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <RefreshCw className="h-6 w-6" />
                  Sincronización de Datos
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Sincroniza todos los módulos con Firebase para limpiar referencias huérfanas
                  y actualizar contadores cuando se han eliminado datos directamente desde la consola.
                </p>
              </div>

              <div className="space-y-4">
                {/* Botón de sincronización */}
                <div className="flex items-center gap-4">
                  <Button
                    variant="primary"
                    onClick={handleSincronizar}
                    disabled={isSyncing}
                    className="min-w-[200px]"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-5 w-5 mr-2" />
                        Sincronizar Todo
                      </>
                    )}
                  </Button>

                  {syncMessage && (
                    <span className="text-sm text-slate-600">{syncMessage}</span>
                  )}
                </div>

                {/* Barra de progreso */}
                {isSyncing && (
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>
                )}

                {/* Resultado de sincronización */}
                {syncResult && (
                  <div className="mt-4 border rounded-lg overflow-hidden">
                    {/* Resumen */}
                    <div className={`p-4 ${syncResult.exito ? 'bg-green-50' : 'bg-amber-50'}`}>
                      <div className="flex items-center gap-2">
                        {syncResult.exito ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                        )}
                        <span className="font-medium">
                          {syncResult.exito ? 'Sincronización exitosa' : 'Sincronización con advertencias'}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600">Actualizados:</span>
                          <span className="ml-2 font-medium text-blue-600">{syncResult.resumen.totalActualizados}</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Eliminados:</span>
                          <span className="ml-2 font-medium text-red-600">{syncResult.resumen.totalEliminados}</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Refs. limpiadas:</span>
                          <span className="ml-2 font-medium text-purple-600">{syncResult.resumen.totalReferenciasLimpiadas}</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Errores:</span>
                          <span className="ml-2 font-medium text-amber-600">{syncResult.resumen.totalErrores}</span>
                        </div>
                      </div>
                    </div>

                    {/* Detalle por módulo */}
                    <div className="divide-y">
                      {syncResult.resultados.map((resultado, idx) => (
                        <div key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            {resultado.errores.length === 0 ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                            )}
                            <span className="font-medium text-slate-900">{resultado.modulo}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            {resultado.registrosActualizados > 0 && (
                              <span className="text-blue-600">{resultado.registrosActualizados} act.</span>
                            )}
                            {resultado.registrosEliminados > 0 && (
                              <span className="text-red-600">{resultado.registrosEliminados} elim.</span>
                            )}
                            {resultado.referenciasLimpiadas > 0 && (
                              <span className="text-purple-600">{resultado.referenciasLimpiadas} refs.</span>
                            )}
                            {resultado.errores.length > 0 && (
                              <span className="text-amber-600">{resultado.errores.length} err.</span>
                            )}
                            {resultado.registrosActualizados === 0 &&
                             resultado.registrosEliminados === 0 &&
                             resultado.referenciasLimpiadas === 0 &&
                             resultado.errores.length === 0 && (
                              <span className="text-slate-400">Sin cambios</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Información */}
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  <strong>¿Cuándo usar esta función?</strong>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    <li>Cuando has eliminado registros directamente desde Firebase Console</li>
                    <li>Cuando los contadores de stock no coinciden con las unidades reales</li>
                    <li>Cuando hay proveedores/productos/clientes que aparecen pero ya no existen</li>
                    <li>Después de una migración o importación de datos</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Información del sistema */}
            <Card padding="lg">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-slate-900">Información del Sistema</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-600">Versión:</span>
                  <span className="ml-2 font-mono">2.0.0</span>
                </div>
                <div>
                  <span className="text-slate-600">Entorno:</span>
                  <span className="ml-2 font-mono">{import.meta.env.MODE}</span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

    </PageShell>
  );
};