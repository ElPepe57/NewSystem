import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';

// Paleta de colores consistente
export const CHART_COLORS = {
  primary: '#2563eb',
  secondary: '#7c3aed',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#0891b2',
  gray: '#6b7280'
};

export const CHART_COLOR_PALETTE = [
  '#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626',
  '#0891b2', '#db2777', '#84cc16', '#f59e0b', '#6366f1'
];

// Formatters comunes
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('es-PE').format(value);

export const formatPercent = (value: number) => `${value.toFixed(1)}%`;

// ============================================
// LINE CHART - Tendencias temporales
// ============================================
export interface LineChartData {
  name: string;
  [key: string]: string | number;
}

export interface SimpleLineChartProps {
  data: LineChartData[];
  dataKey: string;
  xAxisKey?: string;
  height?: number;
  color?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
  formatValue?: (value: number) => string;
  title?: string;
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
  data,
  dataKey,
  xAxisKey = 'name',
  height = 300,
  color = CHART_COLORS.primary,
  showGrid = true,
  showTooltip = true,
  formatValue = formatNumber,
  title
}) => (
  <div className="w-full">
    {title && <h4 className="text-sm font-medium text-gray-700 mb-2">{title}</h4>}
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={formatValue} />
        {showTooltip && (
          <Tooltip
            formatter={(value: number) => [formatValue(value), dataKey]}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
        )}
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

// Multi-line chart
export interface MultiLineChartProps {
  data: LineChartData[];
  lines: Array<{ dataKey: string; color: string; name?: string }>;
  xAxisKey?: string;
  height?: number;
  showGrid?: boolean;
  formatValue?: (value: number) => string;
  title?: string;
}

export const MultiLineChart: React.FC<MultiLineChartProps> = ({
  data,
  lines,
  xAxisKey = 'name',
  height = 300,
  showGrid = true,
  formatValue = formatNumber,
  title
}) => (
  <div className="w-full">
    {title && <h4 className="text-sm font-medium text-gray-700 mb-2">{title}</h4>}
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={formatValue} />
        <Tooltip
          formatter={(value: number, name: string) => [formatValue(value), name]}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
        />
        <Legend />
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name || line.dataKey}
            stroke={line.color}
            strokeWidth={2}
            dot={{ fill: line.color, strokeWidth: 2, r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </div>
);

// ============================================
// AREA CHART - Tendencias con relleno
// ============================================
export interface AreaChartProps {
  data: LineChartData[];
  dataKey: string;
  xAxisKey?: string;
  height?: number;
  color?: string;
  gradientId?: string;
  formatValue?: (value: number) => string;
  title?: string;
}

export const SimpleAreaChart: React.FC<AreaChartProps> = ({
  data,
  dataKey,
  xAxisKey = 'name',
  height = 300,
  color = CHART_COLORS.primary,
  gradientId = 'areaGradient',
  formatValue = formatNumber,
  title
}) => (
  <div className="w-full">
    {title && <h4 className="text-sm font-medium text-gray-700 mb-2">{title}</h4>}
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={formatValue} />
        <Tooltip
          formatter={(value: number) => [formatValue(value), dataKey]}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fillOpacity={1}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

// ============================================
// BAR CHART - Comparaciones
// ============================================
export interface BarChartData {
  name: string;
  [key: string]: string | number;
}

export interface SimpleBarChartProps {
  data: BarChartData[];
  dataKey: string;
  xAxisKey?: string;
  height?: number;
  color?: string;
  horizontal?: boolean;
  formatValue?: (value: number) => string;
  title?: string;
  showValues?: boolean;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  dataKey,
  xAxisKey = 'name',
  height = 300,
  color = CHART_COLORS.primary,
  horizontal = false,
  formatValue = formatNumber,
  title,
  showValues = false
}) => (
  <div className="w-full">
    {title && <h4 className="text-sm font-medium text-gray-700 mb-2">{title}</h4>}
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 5, right: 20, left: horizontal ? 80 : 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={formatValue} />
            <YAxis type="category" dataKey={xAxisKey} tick={{ fontSize: 12 }} stroke="#9ca3af" width={70} />
          </>
        ) : (
          <>
            <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={formatValue} />
          </>
        )}
        <Tooltip
          formatter={(value: number) => [formatValue(value), dataKey]}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
        />
        <Bar
          dataKey={dataKey}
          fill={color}
          radius={[4, 4, 0, 0]}
          label={showValues ? { position: 'top', fontSize: 11 } : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

// Multi-bar chart
export interface MultiBarChartProps {
  data: BarChartData[];
  bars: Array<{ dataKey: string; color: string; name?: string }>;
  xAxisKey?: string;
  height?: number;
  formatValue?: (value: number) => string;
  title?: string;
  stacked?: boolean;
}

export const MultiBarChart: React.FC<MultiBarChartProps> = ({
  data,
  bars,
  xAxisKey = 'name',
  height = 300,
  formatValue = formatNumber,
  title,
  stacked = false
}) => (
  <div className="w-full">
    {title && <h4 className="text-sm font-medium text-gray-700 mb-2">{title}</h4>}
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={formatValue} />
        <Tooltip
          formatter={(value: number, name: string) => [formatValue(value), name]}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
        />
        <Legend />
        {bars.map((bar) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            name={bar.name || bar.dataKey}
            fill={bar.color}
            stackId={stacked ? 'stack' : undefined}
            radius={stacked ? undefined : [4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  </div>
);

// ============================================
// PIE / DONUT CHART - Distribuciones
// ============================================
export interface PieChartData {
  name: string;
  value: number;
  color?: string;
  [key: string]: string | number | undefined;
}

export interface SimplePieChartProps {
  data: PieChartData[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLabel?: boolean;
  showLegend?: boolean;
  formatValue?: (value: number) => string;
  title?: string;
  centerLabel?: string;
}

export const SimplePieChart: React.FC<SimplePieChartProps> = ({
  data,
  height = 300,
  innerRadius = 0,
  outerRadius = 100,
  showLabel = true,
  showLegend = true,
  formatValue = formatNumber,
  title,
  centerLabel
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // No mostrar labels para segmentos muy pequeños
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={500}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="w-full">
      {title && <h4 className="text-sm font-medium text-gray-700 mb-2">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={showLabel ? renderLabel : undefined}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [formatValue(value), name]}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
          {showLegend && <Legend />}
          {centerLabel && innerRadius > 0 && (
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
              <tspan x="50%" dy="-0.5em" fontSize={20} fontWeight="bold" fill="#374151">
                {centerLabel}
              </tspan>
              <tspan x="50%" dy="1.5em" fontSize={12} fill="#6b7280">
                Total: {formatValue(total)}
              </tspan>
            </text>
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// Donut chart (pie with inner radius)
export const DonutChart: React.FC<SimplePieChartProps> = (props) => (
  <SimplePieChart {...props} innerRadius={60} outerRadius={100} />
);

// ============================================
// COMPOSED CHART - Combinación de tipos
// ============================================
export interface ComposedChartProps {
  data: LineChartData[];
  bars?: Array<{ dataKey: string; color: string; name?: string }>;
  lines?: Array<{ dataKey: string; color: string; name?: string }>;
  areas?: Array<{ dataKey: string; color: string; name?: string }>;
  xAxisKey?: string;
  height?: number;
  formatValue?: (value: number) => string;
  title?: string;
}

export const SimpleComposedChart: React.FC<ComposedChartProps> = ({
  data,
  bars = [],
  lines = [],
  areas = [],
  xAxisKey = 'name',
  height = 300,
  formatValue = formatNumber,
  title
}) => (
  <div className="w-full">
    {title && <h4 className="text-sm font-medium text-gray-700 mb-2">{title}</h4>}
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={formatValue} />
        <Tooltip
          formatter={(value: number, name: string) => [formatValue(value), name]}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
        />
        <Legend />
        {areas.map((area) => (
          <Area
            key={area.dataKey}
            type="monotone"
            dataKey={area.dataKey}
            name={area.name || area.dataKey}
            fill={area.color}
            stroke={area.color}
            fillOpacity={0.3}
          />
        ))}
        {bars.map((bar) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            name={bar.name || bar.dataKey}
            fill={bar.color}
            radius={[4, 4, 0, 0]}
          />
        ))}
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name || line.dataKey}
            stroke={line.color}
            strokeWidth={2}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  </div>
);

// ============================================
// MINI CHARTS - Para KPIs y cards
// ============================================
export interface MiniChartProps {
  data: number[];
  type?: 'line' | 'bar' | 'area';
  color?: string;
  width?: number;
  height?: number;
}

export const MiniChart: React.FC<MiniChartProps> = ({
  data,
  type = 'line',
  color = CHART_COLORS.primary,
  width = 80,
  height = 30
}) => {
  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <ResponsiveContainer width={width} height={height}>
      {type === 'bar' ? (
        <BarChart data={chartData}>
          <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} />
        </BarChart>
      ) : type === 'area' ? (
        <AreaChart data={chartData}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={1.5}
          />
        </AreaChart>
      ) : (
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
};

export default {
  SimpleLineChart,
  MultiLineChart,
  SimpleAreaChart,
  SimpleBarChart,
  MultiBarChart,
  SimplePieChart,
  DonutChart,
  SimpleComposedChart,
  MiniChart,
  CHART_COLORS,
  CHART_COLOR_PALETTE,
  formatCurrency,
  formatNumber,
  formatPercent
};
