/**
 * EmptyStateGlobal · Cost Intelligence sin data operacional aún
 *
 * chk5.B8 (S3.6 M1.bis · Cost Intelligence) · canon EmptyStateBd pattern.
 *
 * Se renderiza cuando NO hay data suficiente para activar el módulo:
 *   - 0 OCs cerradas Y 0 unidades en pipeline → empty state global
 *   - Caso contrario, render rich UI (catálogo · drill-down)
 *
 * Honestidad declarada (mockup canónico Sec 3):
 *   - NO listamos productos del catálogo sin costos reales
 *   - NO inventamos KPIs · todos en "—" cuando no hay data
 *   - CTAs guían al usuario a registrar el primer evento operativo
 *
 * Mockup canónico: docs/mockups/cost-intelligence-canon-productos.html · Sec 3
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  BrainCircuit,
  Info,
  Plus,
  Upload,
  ArrowRight,
} from 'lucide-react';
import type { PrerequisitosCI } from '../../utils/costIntelligence';

interface EmptyStateGlobalProps {
  prerequisitos: PrerequisitosCI;
}

interface PrerequisitoItem {
  num: number;
  titulo: string;
  detalle: string;
  cumplido: boolean;
}

export const EmptyStateGlobal: React.FC<EmptyStateGlobalProps> = ({ prerequisitos }) => {
  const items: PrerequisitoItem[] = [
    {
      num: 1,
      titulo: '≥1 orden de compra cerrada',
      detalle: 'con landed cost asignado (activa KPI Capital invertido)',
      cumplido: prerequisitos.ocsCerradas,
    },
    {
      num: 2,
      titulo: '≥2 OCs del mismo SKU',
      detalle: 'con lotes distintos (activa variance attribution)',
      cumplido: prerequisitos.skusConDosLotes,
    },
    {
      num: 3,
      titulo: 'Pool USD con TCPA real',
      detalle: 'activa comparación TCPA vs SBS',
      cumplido: prerequisitos.poolTcpa,
    },
    {
      num: 4,
      titulo: 'Unidades en distintos estados pipeline',
      detalle: 'activa capital atrapado',
      cumplido: prerequisitos.unidadesPipeline,
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-12">
      <div className="max-w-lg mx-auto text-center">
        {/* Hero icon · gradient teal canon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 ring-1 ring-teal-200/50 flex items-center justify-center mx-auto mb-4">
          <BrainCircuit className="w-10 h-10 text-teal-700" />
        </div>

        <h2 className="text-lg font-bold text-slate-900 mb-2">
          Sin data de costos · todavía nada que analizar
        </h2>

        <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-md mx-auto">
          Cost Intelligence analiza tus{' '}
          <span className="font-semibold">costos REALES de adquisición</span>{' '}
          (no investigación de mercado). Necesita transacciones operacionales
          para activarse.
        </p>

        {/* Prerequisitos canon · amber-50/50 */}
        <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Info className="w-3 h-3" />
            Para activar Cost Intelligence necesitas:
          </div>
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.num}
                className="text-xs text-slate-700 flex items-start gap-2"
              >
                <span
                  className={`font-bold tabular-nums mt-0.5 ${
                    item.cumplido ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {item.cumplido ? '✓' : item.num + '.'}
                </span>
                <span className={item.cumplido ? 'line-through text-slate-400' : ''}>
                  <span className="font-semibold">{item.titulo}</span>{' '}
                  ({item.detalle})
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTAs canon */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Link
            to="/compras"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Crear primera OC
          </Link>
          <button
            type="button"
            onClick={() => alert('Importar histórico CSV · próximamente')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Upload className="w-3.5 h-3.5" />
            Importar histórico CSV
          </button>
          <Link
            to="/tesoreria"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Ver Pool USD
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Nota explícita · separación con Productos */}
        <div className="mt-6 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-500 text-left">
          <span className="font-bold">Nota:</span> Cost Intelligence NO lista
          productos del catálogo aquí. Para investigación de mercado y precios
          sugeridos visitá el{' '}
          <Link to="/productos" className="text-teal-700 underline">
            módulo Productos
          </Link>
          . Acá sólo aparecen los SKUs con OCs cerradas.
        </div>
      </div>
    </div>
  );
};
