import React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Card } from '../../common';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  link?: string;
  gradient?: string;
  valueColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-primary-400',
  trend,
  link,
  gradient,
  valueColor = 'text-gray-900'
}) => {
  const content = (
    <Card
      padding="md"
      className={`${link ? 'hover:shadow-lg transition-shadow cursor-pointer' : ''} ${gradient || ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-600">{title}</div>
          <div className={`text-3xl font-bold mt-1 ${valueColor}`}>
            {value}
          </div>
          {subtitle && (
            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              {trend && (
                <span className={trend.isPositive ? 'text-success-500' : 'text-danger-500'}>
                  {trend.isPositive ? '↑' : '↓'} {trend.value}%
                </span>
              )}
              {trend?.label || subtitle}
            </div>
          )}
        </div>
        <Icon className={`h-10 w-10 ${iconColor}`} />
      </div>
    </Card>
  );

  if (link) {
    return <Link to={link}>{content}</Link>;
  }

  return content;
};
