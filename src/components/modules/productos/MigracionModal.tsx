import React, { useState } from 'react';
import { Upload, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Modal, Button } from '../../common';
import { migrarProductos, type MigracionResult } from '../../../utils/migrarProductos';

interface MigracionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onComplete: () => void;
}

export const MigracionModal: React.FC<MigracionModalProps> = ({
  isOpen,
  onClose,
  userId,
  onComplete
}) => {
  const [estado, setEstado] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [progreso, setProgreso] = useState(0);
  const [mensaje, setMensaje] = useState('');
  const [resultado, setResultado] = useState<MigracionResult | null>(null);

  const handleMigrar = async () => {
    setEstado('running');
    setProgreso(0);
    setMensaje('Iniciando migración...');

    try {
      const result = await migrarProductos(userId, (msg, prog) => {
        setMensaje(msg);
        setProgreso(prog);
      });

      setResultado(result);
      setEstado('completed');
      onComplete();
    } catch (error: any) {
      setEstado('error');
      setMensaje(`Error: ${error.message}`);
    }
  };

  const handleClose = () => {
    if (estado !== 'running') {
      setEstado('idle');
      setProgreso(0);
      setMensaje('');
      setResultado(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Migrar Productos del Sistema Antiguo"
      size="lg"
    >
      <div className="space-y-6">
        {estado === 'idle' && (
          <>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-800 dark:text-blue-200">
                    Importar 132 productos
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Esta acción importará los productos del archivo CSV del sistema antiguo.
                    Los productos duplicados (misma marca, nombre comercial, dosaje y contenido)
                    serán omitidos automáticamente.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                Datos que se importarán:
              </h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Marca y nombre comercial</li>
                <li>• Presentación (cápsulas, gomitas, líquido, etc.)</li>
                <li>• Dosaje y contenido</li>
                <li>• Sabor, grupo y subgrupo</li>
                <li>• Ciclo de recompra calculado automáticamente</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleMigrar}>
                <Upload className="h-4 w-4 mr-2" />
                Iniciar Migración
              </Button>
            </div>
          </>
        )}

        {estado === 'running' && (
          <div className="text-center py-8">
            <Loader2 className="h-12 w-12 text-primary-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-2">{mensaje}</p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-4">
              <div
                className="bg-primary-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">{progreso}%</p>
          </div>
        )}

        {estado === 'completed' && resultado && (
          <>
            <div className="text-center py-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Migración Completada
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{resultado.creados}</div>
                <div className="text-sm text-green-700 dark:text-green-300">Creados</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">{resultado.omitidos}</div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">Omitidos</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{resultado.errores}</div>
                <div className="text-sm text-red-700 dark:text-red-300">Errores</div>
              </div>
            </div>

            {resultado.productosOmitidos.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  Productos omitidos (duplicados):
                </h4>
                <div className="max-h-32 overflow-y-auto text-sm text-yellow-700 dark:text-yellow-300">
                  {resultado.productosOmitidos.slice(0, 10).map((p, i) => (
                    <div key={i}>• {p}</div>
                  ))}
                  {resultado.productosOmitidos.length > 10 && (
                    <div className="mt-1 italic">
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
                <div className="max-h-32 overflow-y-auto text-sm text-red-700 dark:text-red-300">
                  {resultado.erroresDetalle.map((e, i) => (
                    <div key={i}>• {e}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Cerrar
              </Button>
            </div>
          </>
        )}

        {estado === 'error' && (
          <>
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Error en la Migración
              </h3>
              <p className="text-red-600 dark:text-red-400 mt-2">{mensaje}</p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={handleClose}>
                Cerrar
              </Button>
              <Button onClick={handleMigrar}>
                Reintentar
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
