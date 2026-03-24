import React, { useEffect, useState } from 'react';
import { Archive, RefreshCw, Clock, Loader2 } from 'lucide-react';
import { Modal } from '../../common';
import type { Producto } from '../../../types/producto.types';

interface ArchivoModalProps {
  isOpen: boolean;
  onClose: () => void;
  archivados: Producto[];
  loading: boolean;
  onFetch: () => Promise<void>;
  onReactivar: (id: string) => Promise<void>;
}

function formatFecha(fecha: any): string {
  if (!fecha) return 'Fecha desconocida';
  const d = fecha.toDate ? fecha.toDate() : new Date(fecha);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function diasDesdeArchivo(fecha: any): number {
  if (!fecha) return 0;
  const d = fecha.toDate ? fecha.toDate() : new Date(fecha);
  const diffMs = new Date().getTime() - d.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export const ArchivoModal: React.FC<ArchivoModalProps> = ({
  isOpen,
  onClose,
  archivados,
  loading,
  onFetch,
  onReactivar,
}) => {
  const [procesando, setProcesando] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (isOpen) {
      onFetch();
      setBusqueda('');
    }
  }, [isOpen]);

  const handleReactivar = async (id: string) => {
    setProcesando(id);
    try {
      await onReactivar(id);
    } finally {
      setProcesando(null);
    }
  };

  const filtrados = archivados.filter(p => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      p.sku?.toLowerCase().includes(q) ||
      p.marca?.toLowerCase().includes(q) ||
      p.nombreComercial?.toLowerCase().includes(q)
    );
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Archivo de Productos" size="lg">
      <div className="space-y-4">
        {/* Header info */}
        <p className="text-sm text-gray-500">
          {archivados.length} producto{archivados.length !== 1 ? 's' : ''} archivado{archivados.length !== 1 ? 's' : ''}
          <span className="text-xs text-gray-400 ml-2">· Los productos archivados se conservan permanentemente para trazabilidad</span>
        </p>

        {/* Búsqueda */}
        {archivados.length > 3 && (
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por SKU, marca o nombre..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Cargando archivo...</span>
          </div>
        )}

        {/* Lista vacía */}
        {!loading && archivados.length === 0 && (
          <div className="text-center py-12">
            <Archive className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">El archivo está vacío</p>
            <p className="text-gray-400 text-sm mt-1">Los productos eliminados se archivarán aquí</p>
          </div>
        )}

        {/* Lista de productos archivados */}
        {!loading && filtrados.length > 0 && (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {filtrados.map(producto => {
              const dias = diasDesdeArchivo(producto.fechaEliminacion);

              return (
                <div
                  key={producto.id}
                  className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                        {producto.sku}
                      </span>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {producto.marca}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {producto.nombreComercial}
                      {producto.presentacion ? ` · ${producto.presentacion}` : ''}
                      {producto.dosaje ? ` · ${producto.dosaje}` : ''}
                    </p>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      Archivado: {formatFecha(producto.fechaEliminacion)}
                      {dias > 0 && <span className="text-gray-400">({dias} día{dias !== 1 ? 's' : ''})</span>}
                    </span>
                  </div>

                  <div className="flex items-center ml-3 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReactivar(producto.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                      title="Reactivar producto"
                      disabled={procesando === producto.id}
                    >
                      {procesando === producto.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Reactivar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sin resultados de búsqueda */}
        {!loading && archivados.length > 0 && filtrados.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No se encontraron coincidencias</p>
        )}
      </div>
    </Modal>
  );
};
