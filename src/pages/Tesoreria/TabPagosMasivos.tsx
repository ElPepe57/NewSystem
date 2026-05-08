/**
 * TabPagosMasivos.tsx — Imp-L3 · M5 banking-grade
 *
 * Tab de Pagos Masivos rediseñado pixel-perfect con wizard 4 pasos +
 * sidebars persistentes. Mantiene sub-tab "Historial" para consulta de
 * lotes anteriores.
 */
import React, { useState } from 'react';
import { Layers, History, ChevronRight } from 'lucide-react';
import { HistorialLotes } from './components/pagosMasivos/HistorialLotes';
import { LoteDetalleModal } from './components/pagosMasivos/LoteDetalleModal';
import { PagosMasivosWizard } from './PagosMasivosWizard';
import { cn } from '../../design-system/utils';

type SubTab = 'nuevo' | 'historial';

export const TabPagosMasivos: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('nuevo');

  return (
    <div className="space-y-4 mt-2">
      {/* Header banking-grade S58e · breadcrumb + h1 + sub-tabs a la derecha */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="hover:text-teal-600 transition-colors cursor-pointer">Tesorería</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-600 font-medium">Pagos masivos · Lotes</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-teal-600" />
            Pagos Masivos
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Procesa múltiples pagos o cobros en un solo lote · {subTab === 'nuevo' ? 'Configurando nuevo lote' : 'Consultando historial'}
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
          <button
            type="button"
            onClick={() => setSubTab('nuevo')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
              subTab === 'nuevo'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-teal-700',
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            Nuevo lote
          </button>
          <button
            type="button"
            onClick={() => setSubTab('historial')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
              subTab === 'historial'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-teal-700',
            )}
          >
            <History className="w-3.5 h-3.5" />
            Historial
          </button>
        </div>
      </div>

      {/* Contenido según sub-tab */}
      {subTab === 'nuevo' ? <PagosMasivosWizard /> : <HistorialLotes />}

      {/* Modal de detalle de lote (compartido entre sub-tabs) */}
      <LoteDetalleModal />
    </div>
  );
};
