import React, { useMemo, useState, useCallback } from 'react';
import {
  Calculator,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Info,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../common';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// ============================================================
// INTERFACES
// ============================================================

export interface ProductoSimulador {
  /** ID único del producto */
  productoId: string;
  /** Nombre o SKU para mostrar */
  nombre: string;
  /** Línea de negocio */
  lineaNegocio: string;
  /** Precio de venta en PEN */
  precioVentaPEN: number;
  /** Costo en USD (precio de compra sin TCPA aplicado) */
  costoUSD: number;
  /** Costos adicionales en PEN (flete nacional, impuestos, margen operativo) */
  costosAdicionalesPEN: number;
}

export interface SimuladorTCProps {
  /** Productos a simular */
  productos: ProductoSimulador[];
  /** TCPA actual del pool */
  tcpaActual: number;
  /** TC de mercado actual (referencia) */
  tcMercado: number;
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

const TC_MIN = 3.0;
const TC_MAX = 5.0;
const TC_STEP = 0.01;

/** Margen del producto a un TC dado */
function calcularMargen(producto: ProductoSimulador, tc: number): number {
  const costoTotalPEN = producto.costoUSD * tc + producto.costosAdicionalesPEN;
  if (costoTotalPEN <= 0) return 0;
  return ((producto.precioVentaPEN - costoTotalPEN) / producto.precioVentaPEN) * 100;
}

/** TC al que el margen llega exactamente a 0% */
function calcularPuntoQuiebre(producto: ProductoSimulador): number | null {
  // precioVentaPEN = costoUSD * tc + costosAdicionalesPEN
  // => tc = (precioVentaPEN - costosAdicionalesPEN) / costoUSD
  if (producto.costoUSD <= 0) return null;
  const tc = (producto.precioVentaPEN - producto.costosAdicionalesPEN) / producto.costoUSD;
  if (tc < TC_MIN || tc > TC_MAX) return null;
  return tc;
}

// ============================================================
// SUBCOMPONENTE: Slider con marcadores
// ============================================================

interface SliderTCProps {
  value: number;
  onChange: (v: number) => void;
  tcpa: number;
  tcMercado: number;
}

const SliderTC: React.FC<SliderTCProps> = ({ value, onChange, tcpa, tcMercado }) => {
  const pctValue = ((value - TC_MIN) / (TC_MAX - TC_MIN)) * 100;
  const pctTcpa = ((tcpa - TC_MIN) / (TC_MAX - TC_MIN)) * 100;
  const pctMercado = ((tcMercado - TC_MIN) / (TC_MAX - TC_MIN)) * 100;

  return (
    <div className="space-y-3">
      {/* Valor actual */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Tipo de Cambio Simulado</span>
        <span className="text-2xl font-bold text-blue-600">{fmt(value, 4)}</span>
      </div>

      {/* Slider */}
      <div className="relative pt-2 pb-5">
        <input
          type="range"
          min={TC_MIN}
          max={TC_MAX}
          step={TC_STEP}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${pctValue}%, #e5e7eb ${pctValue}%, #e5e7eb 100%)`,
          }}
        />

        {/* Marcador TCPA */}
        <div
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `calc(${pctTcpa}% - 1px)` }}
        >
          <div className="w-0.5 h-4 bg-amber-500" />
          <span className="text-[10px] font-semibold text-amber-600 whitespace-nowrap mt-0.5">
            TCPA {fmt(tcpa, 4)}
          </span>
        </div>

        {/* Marcador TC Mercado */}
        <div
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `calc(${pctMercado}% - 1px)` }}
        >
          <div className="w-0.5 h-4 bg-green-500" />
          <span className="text-[10px] font-semibold text-green-600 whitespace-nowrap mt-0.5">
            Mkt {fmt(tcMercado, 4)}
          </span>
        </div>
      </div>

      {/* Atajos */}
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => onChange(tcpa)}
          className="px-2 py-1 rounded border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
        >
          Usar TCPA ({fmt(tcpa, 4)})
        </button>
        <button
          onClick={() => onChange(tcMercado)}
          className="px-2 py-1 rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
        >
          Usar TC Mercado ({fmt(tcMercado, 4)})
        </button>
        <button
          onClick={() => onChange(3.70)}
          className="px-2 py-1 rounded border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
        >
          Reset 3.70
        </button>
      </div>
    </div>
  );
};

// ============================================================
// SUBCOMPONENTE: Tabla de resultados por producto
// ============================================================

const TablaResultados: React.FC<{
  productos: ProductoSimulador[];
  tcSimulado: number;
  tcpaActual: number;
}> = ({ productos, tcSimulado, tcpaActual }) => {
  if (productos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Calculator className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No hay productos para simular</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="py-2 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Producto</th>
            <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Línea</th>
            <th className="py-2 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Precio PEN</th>
            <th className="py-2 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Margen TCPA</th>
            <th className="py-2 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Margen TC Sim.</th>
            <th className="py-2 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Variación</th>
            <th className="py-2 pl-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Punto Quiebre</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {productos.map((p) => {
            const margenTcpa = calcularMargen(p, tcpaActual);
            const margenSim = calcularMargen(p, tcSimulado);
            const variacion = margenSim - margenTcpa;
            const puntoQuiebre = calcularPuntoQuiebre(p);
            const enZonaCritica = margenSim < 5;
            const enZonaQuiebre = margenSim <= 0;

            return (
              <tr
                key={p.productoId}
                className={`hover:bg-gray-50 transition-colors ${enZonaQuiebre ? 'bg-red-50' : ''}`}
              >
                <td className="py-2.5 pr-3">
                  <span className={`font-medium ${enZonaQuiebre ? 'text-red-700' : 'text-gray-800'}`}>
                    {p.nombre}
                  </span>
                </td>
                <td className="py-2.5 px-2">
                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {p.lineaNegocio}
                  </span>
                </td>
                <td className="py-2.5 px-2 text-right font-mono text-gray-600">
                  S/ {fmt(p.precioVentaPEN)}
                </td>
                <td className="py-2.5 px-2 text-right font-mono text-gray-600">
                  {fmt(margenTcpa, 1)}%
                </td>
                <td className="py-2.5 px-2 text-right">
                  <span className={`font-semibold font-mono ${
                    enZonaQuiebre ? 'text-red-600' :
                    enZonaCritica ? 'text-amber-600' :
                    'text-green-600'
                  }`}>
                    {fmt(margenSim, 1)}%
                  </span>
                </td>
                <td className="py-2.5 px-2 text-right">
                  <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                    variacion >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {variacion >= 0
                      ? <TrendingUp className="w-3 h-3" />
                      : <TrendingDown className="w-3 h-3" />
                    }
                    {variacion >= 0 ? '+' : ''}{fmt(variacion, 1)} pp
                  </span>
                </td>
                <td className="py-2.5 pl-2 text-right">
                  {puntoQuiebre !== null ? (
                    <span className={`font-mono text-xs font-semibold ${
                      tcSimulado >= puntoQuiebre ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {fmt(puntoQuiebre, 4)}
                      {tcSimulado >= puntoQuiebre && (
                        <span className="ml-1 text-red-500">!</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">N/A</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================
// SUBCOMPONENTE: Gráfico curvas de margen
// ============================================================

const GraficoCurvasMargen: React.FC<{
  productos: ProductoSimulador[];
  tcSimulado: number;
  tcpaActual: number;
  tcMercado: number;
}> = ({ productos, tcSimulado, tcpaActual, tcMercado }) => {
  // Generar puntos cada 0.1 entre TC_MIN y TC_MAX
  const puntos = useMemo(() => {
    const steps: number[] = [];
    for (let tc = TC_MIN; tc <= TC_MAX + 0.001; tc += 0.1) {
      steps.push(parseFloat(tc.toFixed(2)));
    }

    return steps.map((tc) => {
      const punto: Record<string, number> = { tc };
      productos.slice(0, 5).forEach((p) => { // Máximo 5 líneas para legibilidad
        punto[p.nombre] = parseFloat(calcularMargen(p, tc).toFixed(2));
      });
      return punto;
    });
  }, [productos]);

  const COLORES = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];

  if (productos.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-700">Curvas de Margen por TC</h4>
          <p className="text-xs text-gray-500 mt-0.5">Evolución del margen al variar el tipo de cambio</p>
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={puntos} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="tc"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickFormatter={(v) => v.toFixed(1)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              formatter={(value: number, name: string) => [`${fmt(value, 1)}%`, name]}
              labelFormatter={(v) => `TC ${fmt(parseFloat(v as string), 4)}`}
              contentStyle={{
                fontSize: 12,
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            />
            {/* Línea de 0% */}
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '0%', fill: '#ef4444', fontSize: 10 }} />
            {/* TC Simulado actual */}
            <ReferenceLine
              x={parseFloat(tcSimulado.toFixed(1))}
              stroke="#3b82f6"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
            {/* TCPA */}
            <ReferenceLine
              x={parseFloat(tcpaActual.toFixed(1))}
              stroke="#f59e0b"
              strokeWidth={1}
              strokeDasharray="5 5"
            />
            {/* TC Mercado */}
            <ReferenceLine
              x={parseFloat(tcMercado.toFixed(1))}
              stroke="#10b981"
              strokeWidth={1}
              strokeDasharray="5 5"
            />
            {productos.slice(0, 5).map((p, i) => (
              <Line
                key={p.productoId}
                type="monotone"
                dataKey={p.nombre}
                stroke={COLORES[i % COLORES.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

// ============================================================
// COMPONENTE PRINCIPAL: SimuladorTC
// ============================================================

export const SimuladorTC: React.FC<SimuladorTCProps> = ({
  productos,
  tcpaActual,
  tcMercado,
  loading = false,
}) => {
  const [tcSimulado, setTcSimulado] = useState<number>(tcpaActual);

  const handleSliderChange = useCallback((v: number) => {
    setTcSimulado(v);
  }, []);

  // Productos que cruzan el punto de quiebre al TC simulado
  const productosEnQuiebre = useMemo(() => {
    return productos.filter((p) => calcularMargen(p, tcSimulado) <= 0);
  }, [productos, tcSimulado]);

  // Variación promedio de margen al pasar del TCPA al TC simulado
  const variacionPromedioMargen = useMemo(() => {
    if (productos.length === 0) return 0;
    const total = productos.reduce((sum, p) => {
      return sum + (calcularMargen(p, tcSimulado) - calcularMargen(p, tcpaActual));
    }, 0);
    return total / productos.length;
  }, [productos, tcSimulado, tcpaActual]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header informativo */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Ajusta el tipo de cambio con el slider para ver cómo impacta los márgenes de cada producto.
          La columna "Punto Quiebre" indica el TC exacto en que ese producto deja de ser rentable.
        </p>
      </div>

      {/* Slider */}
      <Card className="p-4">
        <SliderTC
          value={tcSimulado}
          onChange={handleSliderChange}
          tcpa={tcpaActual}
          tcMercado={tcMercado}
        />
      </Card>

      {/* KPIs de impacto */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Variación promedio margen</p>
          <p className={`text-2xl font-bold ${variacionPromedioMargen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {variacionPromedioMargen >= 0 ? '+' : ''}{fmt(variacionPromedioMargen, 1)} pp
          </p>
          <p className="text-xs text-gray-400 mt-0.5">vs. TCPA actual</p>
        </Card>

        <Card className={`p-4 text-center ${productosEnQuiebre.length > 0 ? 'border-2 border-red-300 bg-red-50' : ''}`}>
          <p className="text-xs text-gray-500 mb-1">Productos en zona de pérdida</p>
          <p className={`text-2xl font-bold ${productosEnQuiebre.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {productosEnQuiebre.length}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">de {productos.length} simulados</p>
        </Card>

        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">TC ingresado</p>
          <p className="text-2xl font-bold text-blue-600">{fmt(tcSimulado, 4)}</p>
          <p className={`text-xs mt-0.5 font-medium ${
            tcSimulado > tcpaActual ? 'text-red-500' : 'text-green-600'
          }`}>
            {tcSimulado > tcpaActual
              ? `+${fmt(tcSimulado - tcpaActual, 4)} vs TCPA`
              : `${fmt(tcSimulado - tcpaActual, 4)} vs TCPA`
            }
          </p>
        </Card>
      </div>

      {/* Alerta de productos en quiebre */}
      {productosEnQuiebre.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {productosEnQuiebre.length === 1
                ? `"${productosEnQuiebre[0].nombre}" cruza el punto de quiebre a este TC`
                : `${productosEnQuiebre.length} productos en margen negativo a TC ${fmt(tcSimulado, 4)}`
              }
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              Se recomienda revisar el precio de venta o buscar mejores condiciones de compra.
            </p>
          </div>
        </div>
      )}

      {/* Tabla de resultados */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detalle por Producto a TC {fmt(tcSimulado, 4)}</h3>
        <TablaResultados
          productos={productos}
          tcSimulado={tcSimulado}
          tcpaActual={tcpaActual}
        />
      </Card>

      {/* Gráfico de curvas */}
      <GraficoCurvasMargen
        productos={productos}
        tcSimulado={tcSimulado}
        tcpaActual={tcpaActual}
        tcMercado={tcMercado}
      />

    </div>
  );
};
