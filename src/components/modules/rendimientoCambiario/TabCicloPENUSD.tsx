import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Card } from '../../common';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

// ============================================================
// INTERFACES
// ============================================================

export interface MargenLineaNegocio {
  /** Nombre de la línea de negocio, ej. "Tecnología", "Hogar" */
  linea: string;
  /** Margen nominal calculado sin erosión cambiaria (%) */
  margenNominal: number;
  /** Margen real considerando TCPA vs. TC venta (%) */
  margenReal: number;
  /** Unidades vendidas en el período */
  unidades: number;
  /** Ingresos totales en PEN */
  ingresosPEN: number;
}

export interface ErosionMensual {
  /** Período en formato "Mar 2026" */
  mes: string;
  /** Puntos porcentuales de erosión: margenNominal - margenReal */
  erosionPct: number;
  /** TCPA promedio del período */
  tcpaPromedio: number;
}

export interface DatosCobertura {
  /** USD en el pool disponibles para próximas compras */
  poolUSD: number;
  /** USD que se necesitan para cubrir OC pendientes + pipeline */
  necesidadUSD: number;
  /** TCPA actual del pool */
  tcpa: number;
  /** TC de mercado actual */
  tcMercado: number;
}

export interface NecesidadVentas {
  /** Ventas PEN acumuladas en el mes */
  ventasActualesPEN: number;
  /** Meta de ventas PEN para auto-financiar próximas compras en USD */
  metaPEN: number;
  /** Descripción de la meta */
  descripcionMeta?: string;
}

export interface TabCicloPENUSDProps {
  /** Datos de margen real vs nominal por línea de negocio */
  margenesPorLinea: MargenLineaNegocio[];
  /** Erosión cambiaria histórica mensual */
  erosionMensual: ErosionMensual[];
  /** Datos de cobertura del pool */
  cobertura: DatosCobertura;
  /** Datos de necesidad de ventas */
  necesidadVentas: NecesidadVentas;
  /** En proceso de carga */
  loading?: boolean;
}

// ============================================================
// HELPERS
// ============================================================

function fmt(n: number, dec = 2): string {
  return n.toLocaleString('es-PE', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${fmt(n, 1)}%`;
}

type SemaforoEstado = 'verde' | 'amarillo' | 'rojo';

function calcularSemaforo(ratio: number): SemaforoEstado {
  if (ratio >= 1.2) return 'verde';
  if (ratio >= 0.8) return 'amarillo';
  return 'rojo';
}

const SEMAFORO_STYLES: Record<SemaforoEstado, { bg: string; border: string; texto: string; icono: string; label: string }> = {
  verde: {
    bg: 'bg-green-50',
    border: 'border-green-300',
    texto: 'text-green-800',
    icono: 'text-green-500',
    label: 'Cobertura suficiente',
  },
  amarillo: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    texto: 'text-amber-800',
    icono: 'text-amber-500',
    label: 'Cobertura ajustada',
  },
  rojo: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    texto: 'text-red-800',
    icono: 'text-red-500',
    label: 'Cobertura insuficiente',
  },
};

// ============================================================
// SUBCOMPONENTE: Card Ratio de Cobertura
// ============================================================

const CardRatioCobertura: React.FC<{ cobertura: DatosCobertura }> = ({ cobertura }) => {
  const ratio = cobertura.necesidadUSD > 0
    ? cobertura.poolUSD / cobertura.necesidadUSD
    : 0;
  const semaforo = calcularSemaforo(ratio);
  const estilos = SEMAFORO_STYLES[semaforo];

  const barraAncho = Math.min(100, (cobertura.poolUSD / Math.max(cobertura.necesidadUSD, 1)) * 100);

  return (
    <Card className={`p-4 border-2 ${estilos.border} ${estilos.bg}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Ratio de Cobertura</h3>
          <p className="text-xs text-gray-500 mt-0.5">Pool USD vs. Necesidad de compras</p>
        </div>
        {semaforo === 'verde' && <CheckCircle className={`w-6 h-6 ${estilos.icono}`} />}
        {semaforo === 'amarillo' && <AlertTriangle className={`w-6 h-6 ${estilos.icono}`} />}
        {semaforo === 'rojo' && <AlertTriangle className={`w-6 h-6 ${estilos.icono}`} />}
      </div>

      {/* Ratio grande */}
      <div className="text-center my-4">
        <p className={`text-4xl font-bold ${estilos.texto}`}>
          {fmt(ratio, 2)}x
        </p>
        <p className={`text-sm font-medium mt-1 ${estilos.texto}`}>{estilos.label}</p>
      </div>

      {/* Barra de progreso */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Pool actual: $ {fmt(cobertura.poolUSD)}</span>
          <span>Necesidad: $ {fmt(cobertura.necesidadUSD)}</span>
        </div>
        <div className="w-full bg-white/70 rounded-full h-3 border border-gray-200">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              semaforo === 'verde' ? 'bg-green-500' :
              semaforo === 'amarillo' ? 'bg-amber-500' :
              'bg-red-500'
            }`}
            style={{ width: `${barraAncho}%` }}
          />
        </div>
      </div>

      {/* TCPA vs TC Mercado */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-200/70">
        <div className="text-center">
          <p className="text-xs text-gray-500">TCPA Pool</p>
          <p className="text-base font-bold text-gray-800">{fmt(cobertura.tcpa, 4)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">TC Mercado</p>
          <p className={`text-base font-bold ${cobertura.tcMercado > cobertura.tcpa ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(cobertura.tcMercado, 4)}
          </p>
        </div>
      </div>
    </Card>
  );
};

// ============================================================
// SUBCOMPONENTE: Card Necesidad de Ventas
// ============================================================

const CardNecesidadVentas: React.FC<{ datos: NecesidadVentas }> = ({ datos }) => {
  const progresoPct = datos.metaPEN > 0
    ? Math.min(100, (datos.ventasActualesPEN / datos.metaPEN) * 100)
    : 0;
  const faltaPEN = Math.max(0, datos.metaPEN - datos.ventasActualesPEN);
  const cumplida = progresoPct >= 100;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Necesidad de Ventas PEN</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {datos.descripcionMeta ?? 'Para auto-financiar compras en USD del próximo ciclo'}
          </p>
        </div>
        <Target className="w-5 h-5 text-blue-500" />
      </div>

      {/* Progreso circular simplificado */}
      <div className="flex items-center gap-4 my-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18" cy="18" r="15.9"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="3"
            />
            <circle
              cx="18" cy="18" r="15.9"
              fill="none"
              stroke={cumplida ? '#10b981' : progresoPct >= 70 ? '#f59e0b' : '#3b82f6'}
              strokeWidth="3"
              strokeDasharray={`${progresoPct} ${100 - progresoPct}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-gray-800">{Math.round(progresoPct)}%</span>
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Ventas actuales</span>
            <span className="font-semibold text-gray-800">S/ {fmt(datos.ventasActualesPEN, 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Meta del ciclo</span>
            <span className="font-semibold text-blue-600">S/ {fmt(datos.metaPEN, 0)}</span>
          </div>
          {!cumplida && (
            <div className="flex justify-between text-sm pt-1 border-t border-gray-100">
              <span className="text-gray-500">Faltan</span>
              <span className="font-semibold text-amber-600">S/ {fmt(faltaPEN, 0)}</span>
            </div>
          )}
          {cumplida && (
            <div className="flex items-center gap-1 text-sm text-green-600 font-medium pt-1">
              <CheckCircle className="w-3.5 h-3.5" />
              Meta alcanzada
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

// ============================================================
// SUBCOMPONENTE: Tabla Margen Real vs Nominal
// ============================================================

const TablaMargenesLinea: React.FC<{ datos: MargenLineaNegocio[] }> = ({ datos }) => {
  if (datos.length === 0) {
    return (
      <Card className="p-6 text-center text-gray-400">
        <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Sin datos de margen por línea</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Margen Real vs Nominal — Por Línea de Negocio</h3>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Info className="w-3.5 h-3.5" />
          <span>Real = Nominal ajustado por diferencial TCPA / TC cobro</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-2 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Línea</th>
              <th className="py-2 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Nominal %</th>
              <th className="py-2 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Real %</th>
              <th className="py-2 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Gap</th>
              <th className="py-2 pl-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Unidades</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {datos.map((row) => {
              const gap = row.margenReal - row.margenNominal;
              const gapPositivo = gap >= 0;
              const margenRealCritico = row.margenReal < 5;
              const margenRealBajo = row.margenReal >= 5 && row.margenReal < 15;

              return (
                <tr key={row.linea} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 pr-4">
                    <span className="font-medium text-gray-800">{row.linea}</span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-600">
                    {fmt(row.margenNominal, 1)}%
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className={`inline-flex items-center justify-end font-mono font-semibold ${
                      margenRealCritico ? 'text-red-600' :
                      margenRealBajo ? 'text-amber-600' :
                      'text-green-600'
                    }`}>
                      {fmt(row.margenReal, 1)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded ${
                      gapPositivo
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {gapPositivo
                        ? <TrendingUp className="w-3 h-3" />
                        : <TrendingDown className="w-3 h-3" />
                      }
                      {fmtPct(gap)}
                    </span>
                  </td>
                  <td className="py-2.5 pl-2 text-right font-mono text-gray-600">
                    {row.unidades.toLocaleString('es-PE')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ============================================================
// SUBCOMPONENTE: Gráfico de Erosión Cambiaria Mensual
// ============================================================

const GraficoErosionMensual: React.FC<{ datos: ErosionMensual[] }> = ({ datos }) => {
  if (datos.length === 0) {
    return (
      <Card className="p-6 text-center text-gray-400">
        <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Sin historial de erosión cambiaria</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Erosión Cambiaria Mensual</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Puntos de margen perdidos por diferencial TCPA vs. TC de cobro
          </p>
        </div>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}pp`}
            />
            <Tooltip
              formatter={(value: number) => [`${fmt(value, 2)} pp`, 'Erosión']}
              labelStyle={{ fontWeight: 600, color: '#374151' }}
              contentStyle={{
                fontSize: 12,
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            />
            <ReferenceLine y={0} stroke="#d1d5db" />
            <Bar dataKey="erosionPct" name="Erosión" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {datos.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.erosionPct < 0 ? '#ef4444' : entry.erosionPct < 2 ? '#f59e0b' : '#10b981'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-2 justify-center text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Neutro / Favorable</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Leve (0-2pp)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Severo (&gt;2pp)</span>
      </div>
    </Card>
  );
};

// ============================================================
// COMPONENTE PRINCIPAL: TabCicloPENUSD
// ============================================================

export const TabCicloPENUSD: React.FC<TabCicloPENUSDProps> = ({
  margenesPorLinea,
  erosionMensual,
  cobertura,
  necesidadVentas,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  // Calcular erosión promedio de los últimos 3 meses para la alerta de cabecera
  const erosionPromedio = useMemo(() => {
    const ultimos = erosionMensual.slice(-3);
    if (ultimos.length === 0) return 0;
    return ultimos.reduce((s, m) => s + m.erosionPct, 0) / ultimos.length;
  }, [erosionMensual]);

  const hayAlertaErosion = erosionPromedio < 0;

  return (
    <div className="space-y-5">

      {/* Banner de alerta de erosión si es relevante */}
      {hayAlertaErosion && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Erosión cambiaria activa — promedio {fmt(Math.abs(erosionPromedio), 1)} pp de margen en los últimos 3 meses
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              El TCPA del pool es superior al TC de cobro promedio de las ventas.
              Usa el Simulador para estimar el impacto a distintos escenarios de TC.
            </p>
          </div>
        </div>
      )}

      {/* Fila superior: KPIs de cobertura + necesidad de ventas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardRatioCobertura cobertura={cobertura} />
        <CardNecesidadVentas datos={necesidadVentas} />
      </div>

      {/* Tabla de márgenes */}
      <TablaMargenesLinea datos={margenesPorLinea} />

      {/* Gráfico de erosión mensual */}
      <GraficoErosionMensual datos={erosionMensual} />

    </div>
  );
};
