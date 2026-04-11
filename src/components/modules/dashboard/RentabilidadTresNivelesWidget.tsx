import React, { useEffect, useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { Card } from '../../common';
import { gastoService } from '../../../services/gasto.service';
import { VentaService } from '../../../services/venta.service';
import type { Venta } from '../../../types/venta.types';

interface NivelRentabilidad {
  nombre: string;
  valor: number;
  margen: number;
  color: string;
  bgColor: string;
  descripcion: string;
}

/**
 * Widget de Rentabilidad 3 Niveles (Acuerdo 3 — Modelo 3 Cajas)
 *
 * Nivel 1: Margen Bruto = Venta - CTRU (precio + costos landed)
 * Nivel 2: Margen Contribucion = Margen Bruto - Costos por Venta (comisiones, delivery, empaque)
 * Nivel 3: Margen Operativo = Margen Contribucion - Gastos Fijos del Mes (personal, local, servicios)
 */
export const RentabilidadTresNivelesWidget: React.FC = () => {
  const [data, setData] = useState<{
    totalVentas: number;
    costoProductos: number;
    costosVenta: number;
    gastosFijos: number;
    ventasCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const now = new Date();
        const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

        // Obtener ventas del mes
        const todasVentas = await VentaService.getAll(500);
        const ventasMes = todasVentas.filter(v => {
          if (v.estado === 'cotizacion' || v.estado === 'cancelada') return false;
          const fecha = v.fechaVenta?.toDate?.() || v.fechaCreacion?.toDate?.();
          return fecha && fecha >= inicioMes;
        });

        // Calcular totales
        let totalVentas = 0;
        let costoProductos = 0;
        let costosVenta = 0;

        for (const v of ventasMes) {
          totalVentas += v.totalPEN || 0;
          costoProductos += v.costoTotalPEN || 0;

          // Costos por venta (Caja 2): comisiones + delivery + empaque
          const cv = (v.comisionML || 0) + (v.costoEnvioML || 0) +
                     (v.costoEnvioNegocio || 0) + (v.otrosGastosVenta || 0) +
                     (v.costoVentaTotalPEN || 0);
          costosVenta += cv;
        }

        // Gastos fijos del mes (Caja 3)
        const todosGastos = await gastoService.getAll();
        const gastosFijosMes = todosGastos.filter(g => {
          const esGastoFijo = g.categoria === 'GA' || g.categoria === 'GO';
          return esGastoFijo && g.mes === (now.getMonth() + 1) && g.anio === now.getFullYear();
        });
        const gastosFijos = gastosFijosMes.reduce((sum, g) => sum + g.montoPEN, 0);

        setData({
          totalVentas,
          costoProductos,
          costosVenta,
          gastosFijos,
          ventasCount: ventasMes.length,
        });
      } catch (error) {
        console.error('Error loading rentabilidad data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const niveles = useMemo<NivelRentabilidad[]>(() => {
    if (!data || data.totalVentas === 0) return [];

    const margenBruto = data.totalVentas - data.costoProductos;
    const margenContribucion = margenBruto - data.costosVenta;
    const margenOperativo = margenContribucion - data.gastosFijos;

    return [
      {
        nombre: 'Margen Bruto',
        valor: margenBruto,
        margen: (margenBruto / data.totalVentas) * 100,
        color: 'text-blue-700',
        bgColor: 'bg-blue-50 border-blue-200',
        descripcion: 'Venta - CTRU (precio + costos importaci\u00f3n)',
      },
      {
        nombre: 'Margen Contribuci\u00f3n',
        valor: margenContribucion,
        margen: (margenContribucion / data.totalVentas) * 100,
        color: 'text-purple-700',
        bgColor: 'bg-purple-50 border-purple-200',
        descripcion: 'Bruto - Costos por Venta (comisiones, delivery)',
      },
      {
        nombre: 'Margen Operativo',
        valor: margenOperativo,
        margen: (margenOperativo / data.totalVentas) * 100,
        color: margenOperativo >= 0 ? 'text-green-700' : 'text-red-700',
        bgColor: margenOperativo >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200',
        descripcion: 'Contribuci\u00f3n - Gastos Fijos del Mes',
      },
    ];
  }, [data]);

  if (loading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-slate-200 rounded" />
          <div className="h-16 bg-slate-200 rounded" />
          <div className="h-16 bg-slate-200 rounded" />
        </div>
      </Card>
    );
  }

  if (!data || data.totalVentas === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-5 w-5 text-slate-400" />
          <h3 className="font-semibold text-slate-700">Rentabilidad 3 Niveles</h3>
        </div>
        <p className="text-sm text-slate-500">Sin ventas en el mes actual para calcular.</p>
      </Card>
    );
  }

  const formatCurrency = (n: number) => `S/${Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Rentabilidad 3 Niveles</h3>
        </div>
        <span className="text-xs text-slate-400">{data.ventasCount} ventas del mes</span>
      </div>

      {/* Waterfall visual */}
      <div className="space-y-2">
        {/* Venta total */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-sm font-medium text-slate-700">Ventas</span>
          <span className="text-sm font-bold text-slate-900">{formatCurrency(data.totalVentas)}</span>
        </div>

        {/* Cascada de costos */}
        <div className="flex items-center justify-between px-3 py-1 text-xs text-slate-500">
          <span>(-) CTRU productos</span>
          <span className="text-red-600">-{formatCurrency(data.costoProductos)}</span>
        </div>

        {niveles.map((nivel, i) => (
          <div key={nivel.nombre}>
            <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${nivel.bgColor}`}>
              <div>
                <div className={`text-sm font-semibold ${nivel.color}`}>{nivel.nombre}</div>
                <div className="text-xs text-slate-500">{nivel.descripcion}</div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${nivel.color}`}>
                  {nivel.valor < 0 ? '-' : ''}{formatCurrency(nivel.valor)}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1 justify-end">
                  {nivel.margen > 0 ? <TrendingUp className="h-3 w-3 text-green-500" /> :
                   nivel.margen < 0 ? <TrendingDown className="h-3 w-3 text-red-500" /> :
                   <Minus className="h-3 w-3 text-slate-400" />}
                  {nivel.margen.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Deduccion entre niveles */}
            {i === 0 && data.costosVenta > 0 && (
              <div className="flex items-center justify-between px-3 py-1 text-xs text-slate-500">
                <span>(-) Costos por venta</span>
                <span className="text-red-600">-{formatCurrency(data.costosVenta)}</span>
              </div>
            )}
            {i === 1 && data.gastosFijos > 0 && (
              <div className="flex items-center justify-between px-3 py-1 text-xs text-slate-500">
                <span>(-) Gastos fijos del mes</span>
                <span className="text-red-600">-{formatCurrency(data.gastosFijos)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};
