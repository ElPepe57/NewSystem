import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon, title, description, action
}) => (
  <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-12">
    <div className="text-center">
      <div className="mx-auto h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      {description && <p className="text-slate-500 max-w-sm mx-auto mb-6">{description}</p>}
      {action}
    </div>
  </div>
);
