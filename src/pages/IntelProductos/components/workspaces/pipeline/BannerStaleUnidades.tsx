/**
 * BannerStaleUnidades · banner amber con SKUs estancados · Workspace Pipeline
 *
 * chk5.B10a (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-pipeline.html · Sec 1`.
 *
 * Muestra alertas sobre unidades que llevan más tiempo del esperado en su
 * etapa. Visualmente discreto pero accionable.
 *
 * NO se muestra si no hay unidades estancadas.
 */

import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { EtapaPipeline, UnidadEstancada } from '../../../utils/costIntelligence';
import { ETAPA_LABELS } from '../../../utils/costIntelligence';

interface BannerStaleUnidadesProps {
  unidades: UnidadEstancada[];
  onVerDetalle?: (etapa: EtapaPipeline) => void;
}

const fmtPEN0 = (n: number) =>
  n.toLocaleString('es-PE', { maximumFractionDigits: 0 });

export const BannerStaleUnidades: React.FC<BannerStaleUnidadesProps> = ({ unidades, onVerDetalle }) => {
  if (unidades.length === 0) return null;

  // Agrupar por etapa para resumen
  const porEtapa = new Map<EtapaPipeline, UnidadEstancada[]>();
  for (const u of unidades) {
    const arr = porEtapa.get(u.etapa) ?? [];
    arr.push(u);
    porEtapa.set(u.etapa, arr);
  }

  // Etapa con más estancadas · primer foco del banner
  let etapaFoco: EtapaPipeline | null = null;
  let maxCount = 0;
  for (const [etapa, arr] of porEtapa) {
    if (arr.length > maxCount) {
      maxCount = arr.length;
      etapaFoco = etapa;
    }
  }

  if (!etapaFoco) return null;

  const unidadesFoco = porEtapa.get(etapaFoco) ?? [];
  const totalCapitalFoco = unidadesFoco.reduce((s, u) => s + u.capitalPEN, 0);
  const topUnidades = unidadesFoco.slice(0, 3); // mostrar máximo 3 nombres en el banner

  // Texto resumen: "SUP-0078 (8 uds · 21 días) · SKC-0042 (4 uds · 15 días)..."
  const resumenItems = topUnidades.map((u) =>
    `${u.productoNombre || u.productoSKU} (${u.diasEnEtapa} días)`
  );
  const sobrantes = unidadesFoco.length - topUnidades.length;

  return (
    <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-amber-800 mb-1">
          {unidadesFoco.length} {unidadesFoco.length === 1 ? 'unidad estancada' : 'unidades estancadas'}{' '}
          en {ETAPA_LABELS[etapaFoco]}
          {porEtapa.size > 1 && (
            <span className="font-normal text-amber-700">
              {' '}· +{unidades.length - unidadesFoco.length} en otras etapas
            </span>
          )}
        </div>
        <div className="text-[11px] text-amber-700">
          {resumenItems.join(' · ')}
          {sobrantes > 0 && ` · +${sobrantes} más`}
          {' '}— capital comprometido:{' '}
          <span className="font-bold tabular-nums">S/ {fmtPEN0(totalCapitalFoco)}</span>.
        </div>
      </div>
      {onVerDetalle && (
        <button
          type="button"
          onClick={() => onVerDetalle(etapaFoco!)}
          className="text-[11px] font-medium text-amber-700 hover:text-amber-800 underline whitespace-nowrap flex-shrink-0 flex items-center gap-0.5"
        >
          Ver detalle
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
