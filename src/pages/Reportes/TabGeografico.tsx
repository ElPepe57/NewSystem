import { useEffect, useState, useMemo } from 'react';
import { MapPin, Download, RefreshCw } from 'lucide-react';
import { Button } from '../../components/common';
import { mapaCalorService } from '../../services/mapaCalor.service';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';
import { ExcelService } from '../../services/excel.service';
import type { VentaGeo, ZonaResumen, FiltrosMapaCalor } from '../../types/mapaCalor.types';
import { Link } from 'react-router-dom';

interface TabGeograficoProps {
  fechaInicio: Date;
  fechaFin: Date;
}

export function TabGeografico({ fechaInicio, fechaFin }: TabGeograficoProps) {
  const [ventas, setVentas] = useState<VentaGeo[]>([]);
  const [loading, setLoading] = useState(true);
  const lineaFiltroGlobal = useLineaNegocioStore(s => s.lineaFiltroGlobal);
  const { lineasActivas } = useLineaNegocioStore();

  const getLineaNombre = (id: string) => lineasActivas.find(l => l.id === id)?.nombre || id;

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      try {
        const filtros: FiltrosMapaCalor = {
          periodoPreset: 'custom',
          fechaInicio,
          fechaFin,
          lineaNegocioId: lineaFiltroGlobal,
          distritos: []
        };
        const data = await mapaCalorService.getVentasGeo(filtros);
        setVentas(data);
      } catch (e) {
        console.error('Error cargando datos geográficos:', e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [fechaInicio, fechaFin, lineaFiltroGlobal]);

  const zonas = useMemo(() => mapaCalorService.calcularZonas(ventas), [ventas]);

  const exportarExcel = () => {
    const data = zonas.map(z => ({
      'Distrito': z.distrito,
      'Provincia': z.provincia,
      'Ventas': z.totalVentas,
      'Volumen (PEN)': z.volumenPEN,
      'Ticket Promedio': z.ticketPromedio,
      'Clientes Únicos': z.clientesUnicos,
      'Top Producto': z.productosTop[0]?.nombre || '—'
    }));
    ExcelService.exportToExcel(data, 'Reporte_Geografico', 'Zonas');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 text-primary-500 animate-spin mr-2" />
        <span className="text-gray-500">Cargando datos geográficos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-800">Desglose Geográfico</h3>
          <span className="text-sm text-gray-500">({zonas.length} zonas)</span>
        </div>
        <div className="flex gap-2">
          <Link to="/mapa-ventas">
            <Button variant="outline" className="text-sm">
              <MapPin className="h-4 w-4 mr-1" />
              Ver Mapa
            </Button>
          </Link>
          <Button variant="outline" onClick={exportarExcel} disabled={zonas.length === 0} className="text-sm">
            <Download className="h-4 w-4 mr-1" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Resumen rápido */}
      {ventas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{zonas.length}</p>
            <p className="text-xs text-gray-500">Distritos</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700">
              S/ {ventas.reduce((s, v) => s + v.totalPEN, 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-500">Volumen</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-orange-700">{ventas.length}</p>
            <p className="text-xs text-gray-500">Ventas Geo</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-purple-700">
              {new Set(zonas.map(z => z.provincia)).size}
            </p>
            <p className="text-xs text-gray-500">Provincias</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      {zonas.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Distrito</th>
                  <th className="px-3 py-2 text-left">Provincia</th>
                  <th className="px-3 py-2 text-right">Ventas</th>
                  <th className="px-3 py-2 text-right">Volumen PEN</th>
                  <th className="px-3 py-2 text-right">Ticket Prom.</th>
                  <th className="px-3 py-2 text-right">Clientes</th>
                  <th className="px-3 py-2 text-left">Top Producto</th>
                  <th className="px-3 py-2 text-left">Líneas</th>
                </tr>
              </thead>
              <tbody>
                {zonas.map((zona, i) => (
                  <tr key={zona.key} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{zona.distrito}</td>
                    <td className="px-3 py-2 text-gray-600">{zona.provincia}</td>
                    <td className="px-3 py-2 text-right">{zona.totalVentas}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-600">
                      S/ {zona.volumenPEN.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-2 text-right">S/ {zona.ticketPromedio.toFixed(0)}</td>
                    <td className="px-3 py-2 text-right">{zona.clientesUnicos}</td>
                    <td className="px-3 py-2 text-gray-600 truncate max-w-[140px]">
                      {zona.productosTop[0]?.nombre || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {zona.distribucionLinea.map(d => (
                          <span key={d.lineaNegocioId} className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded-full text-gray-600">
                            {getLineaNombre(d.lineaNegocioId).substring(0, 3)} {d.porcentaje}%
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium">Sin datos geográficos</p>
          <p className="text-sm mt-1">No hay ventas con coordenadas en este periodo</p>
        </div>
      )}
    </div>
  );
}
