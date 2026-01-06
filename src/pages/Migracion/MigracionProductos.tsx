import React, { useState } from 'react';
import { Upload, CheckCircle, XCircle, AlertCircle, Loader2, ArrowLeft, RefreshCw, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card } from '../../components/common';
import { useAuthStore } from '../../store/authStore';
import { useProductoStore } from '../../store/productoStore';
import { migrarProductos, type MigracionResult } from '../../utils/migrarProductos';
import { corregirProductosMigrados, type CorreccionResult } from '../../utils/corregirProductosMigrados';
import { actualizarProductosConDatosAntiguos, type ActualizacionResult } from '../../utils/actualizarProductosConDatosAntiguos';

export const MigracionProductos: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { fetchProductos } = useProductoStore();

  const [estado, setEstado] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [modo, setModo] = useState<'migrar' | 'corregir' | 'actualizar'>('migrar');
  const [progreso, setProgreso] = useState(0);
  const [mensaje, setMensaje] = useState('');
  const [resultado, setResultado] = useState<MigracionResult | null>(null);
  const [resultadoCorreccion, setResultadoCorreccion] = useState<CorreccionResult | null>(null);
  const [resultadoActualizacion, setResultadoActualizacion] = useState<ActualizacionResult | null>(null);

  const handleMigrar = async () => {
    if (!user) return;

    setEstado('running');
    setProgreso(0);
    setMensaje('Iniciando migración...');

    try {
      const result = await migrarProductos(user.uid, (msg, prog) => {
        setMensaje(msg);
        setProgreso(prog);
      });

      setResultado(result);
      setEstado('completed');

      // Refrescar productos
      fetchProductos();
    } catch (error: any) {
      setEstado('error');
      setMensaje(`Error: ${error.message}`);
    }
  };

  const handleCorregir = async () => {
    setEstado('running');
    setModo('corregir');
    setProgreso(0);
    setMensaje('Iniciando corrección...');

    try {
      const result = await corregirProductosMigrados((msg, prog) => {
        setMensaje(msg);
        setProgreso(prog);
      });

      setResultadoCorreccion(result);
      setEstado('completed');

      // Refrescar productos
      fetchProductos();
    } catch (error: any) {
      setEstado('error');
      setMensaje(`Error: ${error.message}`);
    }
  };

  const handleActualizarDatos = async () => {
    setEstado('running');
    setModo('actualizar');
    setProgreso(0);
    setMensaje('Iniciando actualización con datos del sistema antiguo...');

    try {
      const result = await actualizarProductosConDatosAntiguos((msg, prog) => {
        setMensaje(msg);
        setProgreso(prog);
      });

      setResultadoActualizacion(result);
      setEstado('completed');

      // Refrescar productos
      fetchProductos();
    } catch (error: any) {
      setEstado('error');
      setMensaje(`Error: ${error.message}`);
    }
  };

  const handleReset = () => {
    setEstado('idle');
    setModo('migrar');
    setProgreso(0);
    setMensaje('');
    setResultado(null);
    setResultadoCorreccion(null);
    setResultadoActualizacion(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link to="/productos" className="inline-flex items-center text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Productos
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <Upload className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Migrar Productos del Sistema Antiguo
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Importar 132 productos desde el CSV del sistema anterior
            </p>
          </div>
        </div>

        {estado === 'idle' && (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-800 dark:text-blue-200">
                    Importar productos
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Esta acción importará los productos del archivo CSV del sistema antiguo (SISTEMA - BMN FASE 10 - PRODUCTOS.csv).
                    Los productos duplicados (misma marca, nombre comercial, dosaje y contenido) serán omitidos automáticamente.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">
                Datos que se importarán:
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div>
                  <ul className="space-y-1">
                    <li>• Marca y nombre comercial</li>
                    <li>• Presentación (cápsulas, gomitas, líquido, etc.)</li>
                    <li>• Dosaje y contenido</li>
                  </ul>
                </div>
                <div>
                  <ul className="space-y-1">
                    <li>• Sabor del producto</li>
                    <li>• Grupo y subgrupo</li>
                    <li>• Ciclo de recompra (calculado automáticamente)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Nueva sección para actualizar datos */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-800 dark:text-green-200">
                    Actualizar con datos del Sistema Antiguo
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Actualiza los productos existentes con los datos del archivo MD actualizado:
                  </p>
                  <ul className="text-sm text-green-700 dark:text-green-300 mt-2 space-y-1">
                    <li>• <strong>Stock Mínimo y Máximo</strong> - De la columna MINIMO y MAXIMO</li>
                    <li>• <strong>Precio Sugerido</strong> - De la columna PRECIO (en soles)</li>
                    <li>• <strong>Genera SKU</strong> - Para productos que no tienen SKU (BMN-0001, BMN-0002...)</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                Valores por defecto:
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Los productos se crearán con margen mínimo 20%, margen objetivo 30%, stock mínimo 5 y máximo 50.
                Habilitados para Mercado Libre por defecto. Podrás editarlos después de la importación.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button size="lg" variant="secondary" onClick={handleCorregir} disabled={!user}>
                <RefreshCw className="h-5 w-5 mr-2" />
                Corregir Datos Faltantes
              </Button>
              <Button size="lg" variant="outline" onClick={handleActualizarDatos}>
                <Database className="h-5 w-5 mr-2" />
                Actualizar SKU, Stock y Precios
              </Button>
              <Button size="lg" onClick={handleMigrar} disabled={!user}>
                <Upload className="h-5 w-5 mr-2" />
                Iniciar Migración
              </Button>
            </div>
          </div>
        )}

        {estado === 'running' && (
          <div className="text-center py-12">
            <Loader2 className="h-16 w-16 text-primary-500 animate-spin mx-auto mb-6" />
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">{mensaje}</p>
            <div className="w-full max-w-md mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-3 mt-4">
              <div
                className="bg-primary-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">{progreso}% completado</p>
          </div>
        )}

        {/* Resultado de actualización con datos antiguos */}
        {estado === 'completed' && modo === 'actualizar' && resultadoActualizacion && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                Actualización Completada
              </h3>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-green-600">{resultadoActualizacion.actualizados}</div>
                <div className="text-sm text-green-700 dark:text-green-300 mt-1">Actualizados</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-blue-600">{resultadoActualizacion.skusGenerados}</div>
                <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">SKUs Generados</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-yellow-600">{resultadoActualizacion.sinCoincidencia}</div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">Sin Coincidencia</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-red-600">{resultadoActualizacion.errores}</div>
                <div className="text-sm text-red-700 dark:text-red-300 mt-1">Errores</div>
              </div>
            </div>

            {resultadoActualizacion.detalles.actualizados.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                  Productos actualizados ({resultadoActualizacion.detalles.actualizados.length}):
                </h4>
                <div className="max-h-48 overflow-y-auto text-sm text-green-700 dark:text-green-300 space-y-1">
                  {resultadoActualizacion.detalles.actualizados.slice(0, 20).map((d, i) => (
                    <div key={i}>• {d}</div>
                  ))}
                  {resultadoActualizacion.detalles.actualizados.length > 20 && (
                    <div className="mt-2 italic">
                      ... y {resultadoActualizacion.detalles.actualizados.length - 20} más
                    </div>
                  )}
                </div>
              </div>
            )}

            {resultadoActualizacion.detalles.skusGenerados.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                  SKUs generados ({resultadoActualizacion.detalles.skusGenerados.length}):
                </h4>
                <div className="max-h-32 overflow-y-auto text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  {resultadoActualizacion.detalles.skusGenerados.slice(0, 15).map((d, i) => (
                    <div key={i}>• {d}</div>
                  ))}
                  {resultadoActualizacion.detalles.skusGenerados.length > 15 && (
                    <div className="mt-2 italic">
                      ... y {resultadoActualizacion.detalles.skusGenerados.length - 15} más
                    </div>
                  )}
                </div>
              </div>
            )}

            {resultadoActualizacion.detalles.sinCoincidencia.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  Sin coincidencia en archivo antiguo (no se actualizó stock/precio):
                </h4>
                <div className="max-h-32 overflow-y-auto text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  {resultadoActualizacion.detalles.sinCoincidencia.slice(0, 10).map((d, i) => (
                    <div key={i}>• {d}</div>
                  ))}
                  {resultadoActualizacion.detalles.sinCoincidencia.length > 10 && (
                    <div className="mt-2 italic">
                      ... y {resultadoActualizacion.detalles.sinCoincidencia.length - 10} más
                    </div>
                  )}
                </div>
              </div>
            )}

            {resultadoActualizacion.detalles.erroresDetalle.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
                  Errores:
                </h4>
                <div className="max-h-32 overflow-y-auto text-sm text-red-700 dark:text-red-300 space-y-1">
                  {resultadoActualizacion.detalles.erroresDetalle.map((e, i) => (
                    <div key={i}>• {e}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={handleReset}>
                Volver
              </Button>
              <Link to="/productos">
                <Button>
                  Ver Productos
                </Button>
              </Link>
            </div>
          </div>
        )}

        {estado === 'completed' && modo === 'corregir' && resultadoCorreccion && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                Corrección Completada
              </h3>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-green-600">{resultadoCorreccion.actualizados}</div>
                <div className="text-sm text-green-700 dark:text-green-300 mt-1">Actualizados</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-gray-600">{resultadoCorreccion.sinCambios}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Sin Cambios</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-yellow-600">{resultadoCorreccion.noEncontrados}</div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">No Encontrados</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-red-600">{resultadoCorreccion.errores}</div>
                <div className="text-sm text-red-700 dark:text-red-300 mt-1">Errores</div>
              </div>
            </div>

            {resultadoCorreccion.detalles.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                  Detalles de la corrección:
                </h4>
                <div className="max-h-64 overflow-y-auto text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  {resultadoCorreccion.detalles.map((d, i) => (
                    <div key={i}>• {d}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={handleReset}>
                Volver
              </Button>
              <Link to="/productos">
                <Button>
                  Ver Productos
                </Button>
              </Link>
            </div>
          </div>
        )}

        {estado === 'completed' && modo === 'migrar' && resultado && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                Migración Completada
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-green-600">{resultado.creados}</div>
                <div className="text-sm text-green-700 dark:text-green-300 mt-1">Productos Creados</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-yellow-600">{resultado.omitidos}</div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">Omitidos (Duplicados)</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-red-600">{resultado.errores}</div>
                <div className="text-sm text-red-700 dark:text-red-300 mt-1">Errores</div>
              </div>
            </div>

            {resultado.productosCreados.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                  Productos creados ({resultado.productosCreados.length}):
                </h4>
                <div className="max-h-48 overflow-y-auto text-sm text-green-700 dark:text-green-300 space-y-1">
                  {resultado.productosCreados.slice(0, 20).map((p, i) => (
                    <div key={i}>• {p}</div>
                  ))}
                  {resultado.productosCreados.length > 20 && (
                    <div className="mt-2 italic">
                      ... y {resultado.productosCreados.length - 20} más
                    </div>
                  )}
                </div>
              </div>
            )}

            {resultado.productosOmitidos.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  Productos omitidos (ya existían):
                </h4>
                <div className="max-h-32 overflow-y-auto text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  {resultado.productosOmitidos.slice(0, 10).map((p, i) => (
                    <div key={i}>• {p}</div>
                  ))}
                  {resultado.productosOmitidos.length > 10 && (
                    <div className="mt-2 italic">
                      ... y {resultado.productosOmitidos.length - 10} más
                    </div>
                  )}
                </div>
              </div>
            )}

            {resultado.erroresDetalle.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
                  Errores:
                </h4>
                <div className="max-h-32 overflow-y-auto text-sm text-red-700 dark:text-red-300 space-y-1">
                  {resultado.erroresDetalle.map((e, i) => (
                    <div key={i}>• {e}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={handleReset}>
                Migrar de nuevo
              </Button>
              <Link to="/productos">
                <Button>
                  Ver Productos
                </Button>
              </Link>
            </div>
          </div>
        )}

        {estado === 'error' && (
          <div className="space-y-6">
            <div className="text-center py-12">
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                Error en la Migración
              </h3>
              <p className="text-red-600 dark:text-red-400 mt-2">{mensaje}</p>
            </div>

            <div className="flex justify-center gap-4">
              <Button variant="ghost" onClick={handleReset}>
                Cancelar
              </Button>
              <Button onClick={handleMigrar}>
                Reintentar
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
