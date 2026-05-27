/**
 * MisBoletasRecientes · F10.F.1.I-FIX · 2026-05-27
 *
 * PIXEL-PERFECT REWRITE · canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 6 (líneas 779-808).
 *
 * Patrón canon mockup: card blanco simple con tabla compacta
 *   - bg-white border border-slate-200 rounded-xl p-5
 *   - h3 text-[14px] font-bold con icon w-4 h-4 text-sky-700
 *   - "Ver todas" arrow-right text-[11px] text-sky-700 font-bold
 *   - table w-full text-[11px]
 *   - thead: border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-500 font-bold
 *   - tbody: divide-y divide-slate-100 · ítems text-right tabular · neto font-bold
 *   - estado chip text-[9px] bg-emerald-100 px-1.5 py-0.5 rounded uppercase
 */
import React from 'react';
import { FileText, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Boleta } from '../../../types/planilla.types';

interface Props {
  boletas: Boleta[];
  loading?: boolean;
  onClickBoleta?: (boleta: Boleta) => void;
}

const MES_LABEL = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const ESTADO_CHIP: Record<Boleta['estado'], { bg: string; text: string; label: string }> = {
  borrador: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'BORRADOR' },
  aprobada: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'PEND.' },
  pagada: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'PAGADA' },
  anulada: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'ANULADA' },
};

const fmtTabular = (n: number): string =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const MisBoletasRecientes: React.FC<Props> = ({ boletas, loading = false, onClickBoleta }) => {
  const navigate = useNavigate();

  return (
    // Canon mockup ACTO 6 · líneas 779-808 · copy-paste literal
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-sky-700" />
          Mis boletas recientes
        </h3>
        <button
          type="button"
          onClick={() => navigate('/planilla?tab=boletas')}
          className="text-[11px] text-sky-700 font-bold hover:underline inline-flex items-center gap-1"
        >
          Ver todas
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-slate-400 text-[11px]">Cargando boletas...</div>
      ) : boletas.length === 0 ? (
        <div className="py-6 text-center">
          <FileText className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
          <div className="text-[12px] font-semibold text-slate-700">Aún sin boletas</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Tu primera boleta se generará al cierre del mes.
          </div>
        </div>
      ) : (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              <th className="py-2">Período</th>
              <th className="text-right">Sueldo</th>
              <th className="text-right">Bonos</th>
              <th className="text-right">Descuentos</th>
              <th className="text-right">Neto</th>
              <th className="text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {boletas.map((b) => {
              const estado = ESTADO_CHIP[b.estado];
              const bonos = (b.comisionesVentas || 0) + (b.bonificaciones || 0) + (b.otrosIngresos || 0);
              return (
                <tr
                  key={b.id}
                  className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => onClickBoleta?.(b) ?? navigate(`/planilla?tab=boletas&boletaId=${b.id}`)}
                >
                  <td className="py-1.5">
                    {MES_LABEL[b.mes]} {b.anio}
                  </td>
                  <td className="text-right tabular-nums">{fmtTabular(b.salarioBase)}</td>
                  <td className="text-right tabular-nums text-emerald-700">
                    {bonos > 0 ? `+${fmtTabular(bonos)}` : '0'}
                  </td>
                  <td className="text-right tabular-nums text-rose-700">
                    {b.totalDescuentos > 0 ? `-${fmtTabular(b.totalDescuentos)}` : '0'}
                  </td>
                  <td className="text-right tabular-nums font-bold">{fmtTabular(b.totalNeto)}</td>
                  <td className="text-right">
                    <span
                      className={`${estado.bg} ${estado.text} text-[9px] font-bold px-1.5 py-0.5 rounded uppercase`}
                    >
                      {estado.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default MisBoletasRecientes;
