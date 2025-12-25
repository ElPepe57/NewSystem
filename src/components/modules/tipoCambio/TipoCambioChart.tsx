import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { TipoCambio } from "../../../types/tipoCambio.types";

interface TipoCambioChartProps {
  tiposCambio: TipoCambio[];
}

export const TipoCambioChart: React.FC<TipoCambioChartProps> = ({ tiposCambio }) => {
  if (tiposCambio.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No hay datos para mostrar en el gráfico</p>
      </div>
    );
  }

  const chartData = tiposCambio.map(tc => ({
    fecha: tc.fecha?.toDate?.()?.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short"
    }) || "",
    compra: tc.compra,
    venta: tc.venta,
    promedio: ((tc.compra + tc.venta) / 2)
  }));

  const lastTC = tiposCambio[tiposCambio.length - 1];

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Evolución del Tipo de Cambio (Últimos {tiposCambio.length} días)
      </h3>
      
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="fecha" 
            stroke="#6b7280"
            style={{ fontSize: "12px" }}
          />
          <YAxis 
            stroke="#6b7280"
            style={{ fontSize: "12px" }}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "0.375rem",
              fontSize: "12px"
            }}
          />
          <Legend 
            wrapperStyle={{ fontSize: "12px" }}
          />
          <Line 
            type="monotone" 
            dataKey="compra" 
            stroke="#10b981" 
            name="TC Compra"
            strokeWidth={2}
            dot={{ fill: "#10b981", r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line 
            type="monotone" 
            dataKey="venta" 
            stroke="#ef4444" 
            name="TC Venta"
            strokeWidth={2}
            dot={{ fill: "#ef4444", r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line 
            type="monotone" 
            dataKey="promedio" 
            stroke="#3b82f6" 
            name="Promedio"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: "#3b82f6", r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="bg-green-50 p-3 rounded">
          <div className="text-xs text-gray-600">TC Compra Actual</div>
          <div className="text-lg font-bold text-green-600">
            S/ {lastTC?.compra.toFixed(3)}
          </div>
        </div>
        <div className="bg-red-50 p-3 rounded">
          <div className="text-xs text-gray-600">TC Venta Actual</div>
          <div className="text-lg font-bold text-red-600">
            S/ {lastTC?.venta.toFixed(3)}
          </div>
        </div>
        <div className="bg-blue-50 p-3 rounded">
          <div className="text-xs text-gray-600">Promedio Actual</div>
          <div className="text-lg font-bold text-blue-600">
            S/ {((lastTC?.compra + lastTC?.venta) / 2).toFixed(3)}
          </div>
        </div>
      </div>
    </div>
  );
};
