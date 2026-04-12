import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  iconColor?: string;
  action?: React.ReactNode;
  count?: number;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title, icon: Icon, iconColor = 'text-slate-600', action, count
}) => (
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-xl font-bold text-slate-900 flex items-center">
      {Icon && <Icon className={`h-5 w-5 mr-2 ${iconColor}`} />}
      {title}
      {count !== undefined && <span className="ml-2 text-sm font-normal text-slate-500">({count})</span>}
    </h2>
    {action}
  </div>
);
