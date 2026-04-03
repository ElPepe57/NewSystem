/**
 * Banner de errores de tesorería para Dashboard
 * Muestra alertas cuando hay documentos con errorTesoreria=true
 */
import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { logger } from '../../../lib/logger';

interface ErrorTesoreriaItem {
  tipo: 'venta' | 'gasto' | 'ordenCompra' | 'transferencia';
  id: string;
  numero: string;
  mensaje: string;
}

export const ErrorTesoreriaBanner: React.FC = () => {
  const [errores, setErrores] = useState<ErrorTesoreriaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const buscarErrores = async () => {
    setLoading(true);
    try {
      const items: ErrorTesoreriaItem[] = [];

      // Buscar en ventas
      const ventasQ = query(collection(db, 'ventas'), where('errorTesoreria', '==', true));
      const ventasSnap = await getDocs(ventasQ);
      ventasSnap.docs.forEach(d => {
        const v = d.data();
        items.push({
          tipo: 'venta',
          id: d.id,
          numero: v.numeroVenta || d.id,
          mensaje: v.errorTesoreriaMsg || 'Error de tesorería en venta'
        });
      });

      // Buscar en gastos
      const gastosQ = query(collection(db, 'gastos'), where('errorTesoreria', '==', true));
      const gastosSnap = await getDocs(gastosQ);
      gastosSnap.docs.forEach(d => {
        const g = d.data();
        items.push({
          tipo: 'gasto',
          id: d.id,
          numero: g.numero || d.id,
          mensaje: g.errorTesoreriaMsg || 'Error de tesorería en gasto'
        });
      });

      // Buscar en OC
      const ocQ = query(collection(db, 'ordenesCompra'), where('errorTesoreria', '==', true));
      const ocSnap = await getDocs(ocQ);
      ocSnap.docs.forEach(d => {
        const oc = d.data();
        items.push({
          tipo: 'ordenCompra',
          id: d.id,
          numero: oc.numero || oc.numeroOrden || d.id,
          mensaje: oc.errorTesoreriaMsg || 'Error de tesorería en OC'
        });
      });

      setErrores(items);
    } catch (error) {
      logger.error('Error buscando errores de tesorería:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buscarErrores();
  }, []);

  if (loading || errores.length === 0) return null;

  const tipoLabel = { venta: 'Venta', gasto: 'Gasto', ordenCompra: 'OC', transferencia: 'Transferencia' };

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-red-800">
              {errores.length} error{errores.length > 1 ? 'es' : ''} de tesorería pendiente{errores.length > 1 ? 's' : ''}
            </h4>
            <p className="text-xs text-red-600">
              Pagos que no se registraron correctamente en tesorería. Requieren reconciliación.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={buscarErrores}
            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {errores.map((err, i) => (
            <div key={i} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-red-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                  {tipoLabel[err.tipo]}
                </span>
                <span className="text-sm font-medium text-gray-800">{err.numero}</span>
              </div>
              <span className="text-xs text-gray-500 max-w-[300px] truncate">{err.mensaje}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
