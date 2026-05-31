/**
 * Reporte Directo vs Indirecto · canon v5.1 chk5.E-S5
 *
 * Cleanup canon: removidos Card + Badge legacy de common · ahora usa div + ring
 * acorde con resto del módulo Contabilidad. Color signature alineada (blue=directos
 * importación · amber=indirectos fijos · purple=directos venta para diferenciar).
 *
 * Costos Directos = atribuibles a un producto/venta específica
 *   - Importación (Caja 1): flete, aranceles, seguros
 *   - Por Venta (Caja 2): comisiones, delivery, empaque
 *
 * Costos Indirectos = gastos fijos del período, no atribuibles a un producto
 *   - Personal, Local, Servicios, Operativos (Caja 3)
 */

import React, { useEffect, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { gastoService } from '../../../services/gasto.service';
import { formatCurrencyPEN } from '../../../utils/format';

interface CostosResumen {
  costosImportacion: number;
  costosVenta: number;
  totalDirectos: number;

  gastosPersonal: number;
  gastosLocal: number;
  gastosOperativos: number;
  gastosProfesionales: number;
  otrosGastosFijos: number;
  totalIndirectos: number;

  ratioDirectoIndirecto: number;
  totalGeneral: number;
}

interface Props {
  mes?: number;
  anio?: number;
}

export const ReporteDirectoIndirecto: React.FC<Props> = ({
  mes = new Date().getMonth() + 1,
  anio = new Date().getFullYear(),
}) => {
  const [data, setData] = useState<CostosResumen | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const todosGastos = await gastoService.getAll();
        const gastosMes = todosGastos.filter((g) => g.mes === mes && g.anio === anio);

        let costosImportacion = 0;
        let costosVenta = 0;
        let gastosPersonal = 0;
        let gastosLocal = 0;
        let gastosOperativos = 0;
        const gastosProfesionales = 0;
        let otrosGastosFijos = 0;

        for (const g of gastosMes) {
          const tipo = g.tipo;
          if (
            ['flete_internacional', 'flete_usa_peru', 'recojo_local', 'almacenaje', 'internacion'].includes(
              tipo,
            )
          ) {
            costosImportacion += g.montoPEN;
          } else if (
            ['comision_ml', 'comision_pasarela', 'comision_vendedor', 'delivery', 'empaque', 'marketing'].includes(
              tipo,
            )
          ) {
            costosVenta += g.montoPEN;
          } else {
            if (tipo === 'nomina') gastosPersonal += g.montoPEN;
            else if (tipo === 'administrativo') gastosLocal += g.montoPEN;
            else if (tipo === 'operativo') gastosOperativos += g.montoPEN;
            else otrosGastosFijos += g.montoPEN;
          }
        }

        const totalDirectos = costosImportacion + costosVenta;
        const totalIndirectos =
          gastosPersonal + gastosLocal + gastosOperativos + gastosProfesionales + otrosGastosFijos;
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

  // Loading state canon
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-center gap-2 text-[12px] text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin text-teal-600" /> Calculando costos directos vs
        indirectos…
      </div>
    );
  }

  // Empty state canon
  if (!data || data.totalGeneral === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4 text-slate-400" />
          <h3 className="text-[13px] font-bold text-slate-900">Directo vs Indirecto</h3>
        </div>
        <p className="text-[11px] text-slate-500">Sin gastos registrados en el mes.</p>
      </div>
    );
  }

  const pctDirecto = data.totalGeneral > 0 ? (data.totalDirectos / data.totalGeneral) * 100 : 0;
  const pctIndirecto = data.totalGeneral > 0 ? (data.totalIndirectos / data.totalGeneral) * 100 : 0;
  const periodoStr = new Date(anio, mes - 1).toLocaleDateString('es-PE', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <BarChart3 className="w-4 h-4 text-slate-600" />
        <h3 className="text-[13px] font-bold text-slate-900">Costos Directos vs Indirectos</h3>
        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded ml-auto capitalize">
          {periodoStr}
        </span>
      </div>

      {/* Barra comparativa */}
      <div className="mb-3">
        <div className="flex h-6 rounded-full overflow-hidden">
          <div
            className="bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold"
            style={{ width: `${Math.max(pctDirecto, 5)}%` }}
          >
            {pctDirecto.toFixed(0)}%
          </div>
          <div
            className="bg-amber-500 flex items-center justify-center text-[10px] text-white font-bold"
            style={{ width: `${Math.max(pctIndirecto, 5)}%` }}
          >
            {pctIndirecto.toFixed(0)}%
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
          <span className="tabular-nums">
            Directos: <strong className="text-blue-700">{formatCurrencyPEN(data.totalDirectos)}</strong>
          </span>
          <span className="tabular-nums">
            Indirectos: <strong className="text-amber-700">{formatCurrencyPEN(data.totalIndirectos)}</strong>
          </span>
        </div>
      </div>

      {/* Desglose en 2 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Directos</div>
          <LineaCosto label="Importación" monto={data.costosImportacion} total={data.totalGeneral} color="blue" />
          <LineaCosto label="Por venta" monto={data.costosVenta} total={data.totalGeneral} color="blue" />
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
            Indirectos (fijos)
          </div>
          <LineaCosto label="Personal" monto={data.gastosPersonal} total={data.totalGeneral} color="amber" />
          <LineaCosto label="Local" monto={data.gastosLocal} total={data.totalGeneral} color="amber" />
          <LineaCosto label="Operativos" monto={data.gastosOperativos} total={data.totalGeneral} color="amber" />
          {data.otrosGastosFijos > 0 && (
            <LineaCosto label="Otros" monto={data.otrosGastosFijos} total={data.totalGeneral} color="amber" />
          )}
        </div>
      </div>

      {/* Ratio */}
      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
        <span className="text-slate-500">Ratio D/I</span>
        <span className="font-bold tabular-nums text-slate-900">
          {data.ratioDirectoIndirecto.toFixed(2)}x
        </span>
      </div>
    </div>
  );
};

const LineaCosto: React.FC<{
  label: string;
  monto: number;
  total: number;
  color: 'blue' | 'amber';
}> = ({ label, monto, total, color }) => {
  if (monto === 0) return null;
  const pct = total > 0 ? (monto / total) * 100 : 0;
  const colorCls = color === 'blue' ? 'text-blue-700' : 'text-amber-700';

  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-slate-600">{label}</span>
      <span className={`font-medium tabular-nums ${colorCls}`}>
        {formatCurrencyPEN(monto)} <span className="text-slate-400">({pct.toFixed(0)}%)</span>
      </span>
    </div>
  );
};
