import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  data: { value: number }[];
  width?: number;
  height?: number;
  color?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 80,
  height = 28,
  color
}) => {
  if (!data || data.length < 2) return null;
  const trend = data[data.length - 1].value - data[0].value;
  const stroke = color ?? (trend >= 0 ? '#10b981' : '#f43f5e');
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
