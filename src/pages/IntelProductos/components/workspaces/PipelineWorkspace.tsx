/**
 * PipelineWorkspace · workspace 3 · Cost Intelligence
 *
 * chk5.B10a (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-pipeline.html`.
 *
 * Responde la pregunta: "¿Dónde está atrapado mi capital ahora mismo?"
 *
 * Orquesta:
 *   - StageFlow             · 4 etapas valorizadas con flow horizontal
 *   - BannerStaleUnidades   · banner alertas si hay unidades estancadas
 *   - DrillDownStage        · tabla SKUs en la etapa activa
 *
 * Lógica:
 *   - Etapa default: la de mayor capital pre-almacén (más urgente)
 *   - Selección manual via click en stage card
 *   - Empty state interno cuando no hay unidades en ningún estado de pipeline
 */

import React, { useMemo, useState } from 'react';
import { GitBranch, Plus, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Producto } from '../../../../types/producto.types';
import type { Unidad } from '../../../../types/unidad.types';
import type { EtapaPipeline } from '../../utils/costIntelligence';
import {
  calcularPipelineValorizado,
  calcularUnidadesEnEtapa,
  ETAPA_LABELS,
} from '../../utils/costIntelligence';
import { StageFlow } from './pipeline/StageFlow';
import { BannerStaleUnidades } from './pipeline/BannerStaleUnidades';
import { DrillDownStage } from './pipeline/DrillDownStage';

interface PipelineWorkspaceProps {
  unidades: Unidad[];
  productos: Producto[];
  tcpa?: number;
  tcSpotFallback?: number;
}

export const PipelineWorkspace: React.FC<PipelineWorkspaceProps> = ({
  unidades,
  productos,
  tcpa,
  tcSpotFallback,
}) => {
  // Pipeline valorizado · derivado en cada render para reaccionar a cambios
  const pipeline = useMemo(
    () => calcularPipelineValorizado(unidades, tcpa, tcSpotFallback),
    [unidades, tcpa, tcSpotFallback]
  );

  // Selección de etapa · null = usa default del pipeline (mayor capital pre-almacén)
  const [etapaActivaManual, setEtapaActivaManual] = useState<EtapaPipeline | null>(null);
  const etapaActiva: EtapaPipeline | null = etapaActivaManual ?? pipeline.etapaConMayorCapital;

  // Index de productos para enriquecer drill-down
  const productoIndex = useMemo(() => {
    const map = new Map<string, Producto>();
    for (const p of productos) map.set(p.id, p);
    return map;
  }, [productos]);

  // Unidades en la etapa activa (drill-down)
  const unidadesEnEtapa = useMemo(() => {
    if (!etapaActiva) return [];
    return calcularUnidadesEnEtapa(unidades, etapaActiva, productoIndex, tcpa, tcSpotFallback);
  }, [unidades, etapaActiva, productoIndex, tcpa, tcSpotFallback]);

  // Empty state interno · cuando no hay unidades en ningún estado pipeline
  if (!pipeline.hasData) {
    return <EmptyPipeline />;
  }

  return (
    <div className="space-y-4">
      <StageFlow
        etapas={pipeline.etapas}
        etapaActiva={etapaActiva}
        onSeleccionarEtapa={setEtapaActivaManual}
      />

      <BannerStaleUnidades
        unidades={pipeline.unidadesEstancadas}
        onVerDetalle={(etapa) => setEtapaActivaManual(etapa)}
      />

      {etapaActiva && (
        <DrillDownStage
          etapa={etapaActiva}
          unidades={unidadesEnEtapa}
        />
      )}
    </div>
  );
};

// ─── Empty state interno · sin unidades en pipeline ──────────────────────────
const EmptyPipeline: React.FC = () => (
  <div className="bg-white border border-slate-200 rounded-xl p-12">
    <div className="max-w-lg mx-auto text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 ring-1 ring-teal-200/50 flex items-center justify-center mx-auto mb-4">
        <GitBranch className="w-10 h-10 text-teal-700" />
      </div>
      <h2 className="text-lg font-bold text-slate-900 mb-2">Sin capital en pipeline</h2>
      <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-md mx-auto">
        Pipeline valoriza tus unidades por etapa: pedidas · en tránsito · en aduana · en almacén.
        Hoy no hay unidades cargadas operacionalmente.
      </p>

      {/* 4 stage cards dim placeholders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-6 opacity-50">
        {(['pedido', 'transito', 'aduana', 'almacen'] as EtapaPipeline[]).map((e) => (
          <div key={e} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase">
              {ETAPA_LABELS[e]}
            </div>
            <div className="text-base font-bold text-slate-400 tabular-nums mt-1">
              S/ —
            </div>
          </div>
        ))}
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
        <Link
          to="/envios"
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          Ver módulo Envíos
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Nota explícita · qué estados aparecen */}
      <div className="mt-6 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-500 text-left">
        <span className="font-bold">Nota:</span> Pipeline sólo lista unidades en estados{' '}
        <code className="text-teal-700 font-mono">pedida</code>,{' '}
        <code className="text-teal-700 font-mono">en_transito</code>,{' '}
        <code className="text-teal-700 font-mono">retenida_aduana</code>,{' '}
        <code className="text-teal-700 font-mono">disponible/reservada/asignada_venta</code>.
        Las unidades vendidas, dañadas o perdidas NO aparecen acá.
      </div>
    </div>
  </div>
);
