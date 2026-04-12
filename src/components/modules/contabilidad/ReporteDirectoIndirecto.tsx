import React, { useEffect, useState } from 'react';
import { BarChart3, ArrowRight } from 'lucide-react';
import { Card, Badge } from '../../common';
import { gastoService } from '../../../services/gasto.service';

interface CostosResumen {
  // Directos (Caja 1 + Caja 2)
  costosImportacion: number;     // Caja 1: costos landed (estimado desde gastos tipo importacion)
  costosVenta: number;           // Caja 2: comisiones, delivery, empaque
  totalDirectos: number;

  // Indirectos (Caja 3)
  gastosPersonal: number;
  gastosLocal: number;
  gastosOperativos: number;
  gastosProfesionales: number;
  otrosGastosFijos: number;
  totalIndirectos: number;

  // Ratio
  ratioDirectoIndirecto: number; // totalDirectos / totalIndirectos
  totalGeneral: number;
}

/**
 * Reporte Directo vs Indirecto
 *
 * Costos Directos = los que se pueden atribuir a un producto/venta especifica
 *   - Importacion (Caja 1): flete, aranceles, seguros
 *   - Por Venta (Caja 2): comisiones, delivery, empaque
 *
 * Costos Indirectos = gastos fijos del periodo, no atribuibles a un producto
 *   - Personal, Local, Servicios, Operativos (Caja 3)
 */
export const ReporteDirectoIndirecto: React.FC<{ mes?: number; anio?: number }> = ({
  mes = new Date().getMonth() + 1,
  anio = new Date().getFullYear()
}) => {
  const [data, setData] = useState<CostosResumen | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const todosGastos = await gastoService.getAll();
        const gastosMes = todosGastos.filter(g => g.mes === mes && g.anio === anio);

        // Clasificar
        let costosImportacion = 0;
        let costosVenta = 0;
        let gastosPersonal = 0;
        let gastosLocal = 0;
        let gastosOperativos = 0;
        let gastosProfesionales = 0;
        let otrosGastosFijos = 0;

        for (const g of gastosMes) {
          const tipo = g.tipo;
          const cat = g.categoria;

          // Directos: importacion
          if (['flete_internacional', 'flete_usa_peru', 'recojo_local', 'almacenaje', 'internacion'].includes(tipo)) {
            costosImportacion += g.montoPEN;
          }
          // Directos: venta
          else if (['comision_ml', 'comision_pasarela', 'comision_vendedor', 'delivery', 'empaque', 'marketing'].includes(tipo)) {
            costosVenta += g.montoPEN;
          }
          // Indirectos
          else if (cat === 'GA' || cat === 'GO') {
            if (tipo === 'nomina') gastosPersonal += g.montoPEN;
            else if (tipo === 'administrativo') gastosLocal += g.montoPEN;
            else if (tipo === 'operativo') gastosOperativos += g.montoPEN;
            else otrosGastosFijos += g.montoPEN;
          }
        }

        const totalDirectos = costosImportacion + costosVenta;
        const totalIndirectos = gastosPersonal + gastosLocal + gastosOperativos + gastosProfesionales + otrosGastosFijos;
        const totalGeneral = totalDirectos + totalIndirectos;

        setData({
          costosImportacion,
          costosVenta,
          totalDirectos,
          gastosPersonal,
          gastosLocal,
          gastosOperativos,
          gastosProfesionales,
          otrosGastosFijos,
          totalIndirectos,
          ratioDirectoIndirecto: totalIndirectos > 0 ? totalDirectos / totalIndirectos : 0,
          totalGeneral,
        });
      } catch (error) {
        console.error('Error loading directo/indirecto:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mes, anio]);

  if (loading) {
    return <Card className="p-4 animate-pulse"><div className="h-32 bg-slate-200 rounded" /></Card>;
  }

  if (!data || data.totalGeneral === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-5 w-5 text-slate-400" />
          <h3 className="font-semibold text-slate-700">Directo vs Indirecto</h3>
        </div>
        <p className="text-sm text-slate-500">Sin gastos registrados en el mes.</p>
      </Card>
    );
  }

  const formatMonto = (n: number) => `S/${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const pctDirecto = data.totalGeneral > 0 ? (data.totalDirectos / data.totalGeneral) * 100 : 0;
  const pctIndirecto = data.totalGeneral > 0 ? (data.totalIndirectos / data.totalGeneral) * 100 : 0;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-slate-600" />
        <h3 className="font-semibold text-slate-900">Costos Directos vs Indirectos</h3>
        <Badge variant="outline" className="text-xs ml-auto">
          {new Date(anio, mes - 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}
        </Badge>
      </div>

      {/* Barra comparativa */}
      <div className="mb-4">
        <div className="flex h-6 rounded-full overflow-hidden">
          <div
            className="bg-sky-500 flex items-center justify-center text-xs text-white font-medium"
            style={{ width: `${Math.max(pctDirecto, 5)}%` }}
          >
            {pctDirecto.toFixed(0)}%
          </div>
          <div
            className="bg-amber-500 flex items-center justify-center text-xs text-white font-medium"
            style={{ width: `${Math.max(pctIndirecto, 5)}%` }}
          >
            {pctIndirecto.toFixed(0)}%
          </div>
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>Directos: {formatMonto(data.totalDirectos)}</span>
          <span>Indirectos: {formatMonto(data.totalIndirectos)}</span>
        </div>
      </div>

      {/* Desglose en 2 columnas */}
      <div className="grid grid-cols-2 gap-4">
        {/* Directos */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-sky-700 uppercase">Directos</div>
          <Linea label="Importaci\u00f3n" monto={data.costosImportacion} total={data.totalGeneral} color="blue" />
          <Linea label="Por Venta" monto={data.costosVenta} total={data.totalGeneral} color="blue" />
        </div>

        {/* Indirectos */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-amber-700 uppercase">Indirectos (Fijos)</div>
          <Linea label="Personal" monto={data.gastosPersonal} total={data.totalGeneral} color="amber" />
          <Linea label="Local" monto={data.gastosLocal} total={data.totalGeneral} color="amber" />
          <Linea label="Operativos" monto={data.gastosOperativos} total={data.totalGeneral} color="amber" />
          {data.otrosGastosFijos > 0 && (
            <Linea label="Otros" monto={data.otrosGastosFijos} total={data.totalGeneral} color="amber" />
          )}
        </div>
      </div>

      {/* Ratio */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
        <span className="text-slate-500">Ratio D/I</span>
        <span className="font-bold text-slate-900">{data.ratioDirectoIndirecto.toFixed(2)}x</span>
      </div>
    </Card>
  );
};

const Linea: React.FC<{ label: string; monto: number; total: number; color: 'blue' | 'amber' }> = ({ label, monto, total, color }) => {
  if (monto === 0) return null;
  const pct = total > 0 ? (monto / total) * 100 : 0;
  const fmt = `S/${monto.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-600">{label}</span>
      <span className={`font-medium ${color === 'blue' ? 'text-sky-700' : 'text-amber-700'}`}>
        {fmt} <span className="text-slate-400">({pct.toFixed(0)}%)</span>
      </span>
    </div>
  );
};
