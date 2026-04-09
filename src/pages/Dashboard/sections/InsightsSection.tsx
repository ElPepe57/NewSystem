import React from 'react';
import { CheckCircle } from 'lucide-react';
import { InsightCard } from '../../../components/common/dashboard/InsightCard';
import type { Insight } from '../../../components/common/dashboard/InsightCard';

interface InsightsSectionProps {
  insights: Insight[];
}

export const InsightsSection: React.FC<InsightsSectionProps> = ({ insights }) => {
  if (insights.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-4">
        <div className="bg-emerald-100 rounded-full p-2.5 flex-shrink-0">
          <CheckCircle className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h4 className="font-semibold text-sm text-emerald-900">Todo en orden</h4>
          <p className="text-xs text-emerald-700 mt-0.5">No hay alertas activas en este momento. El negocio esta operando dentro de los parametros normales.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Insights y Alertas
        </h3>
        <span className="text-xs text-gray-400">{insights.length} activo{insights.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {insights.map(insight => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
};
