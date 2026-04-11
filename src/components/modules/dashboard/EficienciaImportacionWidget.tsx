/**
 * EficienciaImportacionWidget.tsx
 *
 * Widget compacto para el Dashboard que muestra métricas de eficiencia logística por peso.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, Package, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card } from '../../common';
import { logisticaReporteService } from '../../../services/logistica.reporte.service';
import { useProductoStore } from '../../../store/productoStore';

export const EficienciaImportacionWidget: React.FC = () => {
  const navigate = useNavigate();
  const { productos } = useProductoStore();
  const [costoPromedioLb, setCostoPromedioLb] = useState<number>(0);
  const [pesoTotal, setPesoTotal] = useState<number>(0);
  const [ultimoEnvioCostoLb, setUltimoEnvioCostoLb] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logisticaReporteService.getResumenLogistica()
      .then(data => {
        setCostoPromedioLb(data.costoPromedioPorLibraGlobal);
        setPesoTotal(data.pesoTotalTransportadoLb);
        // Buscar costo/lb del último envío del viajero con más envíos
        if (data.viajeros.length > 0) {
          const topViajero = data.viajeros[0];
          if (topViajero.transferencias.length > 0) {
            const ultimo = topViajero.transferencias[0];
            setUltimoEnvioCostoLb(ultimo.costoFletePorLibra || 0);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const productosSinPeso = productos.filter(p => p.estado === 'activo' && !p.pesoLibras).length;
  const productosConPeso = productos.filter(p => p.estado === 'activo' && p.pesoLibras && p.pesoLibras > 0).length;

  const tendencia = ultimoEnvioCostoLb > 0 && costoPromedioLb > 0
    ? ((ultimoEnvioCostoLb - costoPromedioLb) / costoPromedioLb) * 100
    : null;

  if (loading) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Scale className="h-4 w-4 text-teal-600" />
          Eficiencia de Importacion
        </h3>
        <button
          type="button"
          onClick={() => navigate('/reportes')}
          className="text-xs text-teal-600 hover:text-teal-800"
        >
          Ver detalle
        </button>
      </div>

      <div className="space-y-3">
        {/* Costo/lb promedio */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Costo/lb promedio</span>
          <span className="text-sm font-semibold font-mono">
            {costoPromedioLb > 0 ? `$${costoPromedioLb.toFixed(2)}/lb` : '—'}
          </span>
        </div>

        {/* Último envío vs promedio */}
        {tendencia !== null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Ultimo envio vs promedio</span>
            <span className={`text-xs font-medium flex items-center gap-1 ${
              tendencia <= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {tendencia <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {tendencia <= 0 ? '' : '+'}{tendencia.toFixed(1)}%
            </span>
          </div>
        )}

        {/* Peso total transportado */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Peso total transportado</span>
          <span className="text-sm font-mono text-slate-700">{pesoTotal.toFixed(1)} lb</span>
        </div>

        {/* Productos con/sin peso */}
        <div className="border-t pt-2 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Package className="h-3 w-3" /> Productos con peso
            </span>
            <span className="text-xs font-medium text-slate-700">{productosConPeso}</span>
          </div>
          {productosSinPeso > 0 && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Sin peso registrado
              </span>
              <button
                type="button"
                onClick={() => navigate('/productos')}
                className="text-xs font-medium text-amber-700 hover:text-amber-900 underline"
              >
                {productosSinPeso} productos
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
