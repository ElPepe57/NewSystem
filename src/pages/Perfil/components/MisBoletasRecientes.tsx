/**
 * MisBoletasRecientes · F10.F.1.E · 2026-05-27
 *
 * Card sky con tabla de últimas 5 boletas del empleado · vista propia.
 * Solo aparece si el user tiene boletas registradas.
 *
 * Canon v8.0 N1 · color semántico sky (operacional)
 * Canon v9.0 · pixel-perfect del mockup perfil-v5.4-personalizado.html ACTO 5
 *
 * Cross-link footer · "Ver todas en Planilla" · /planilla?tab=boletas
 */
import React from 'react';
import { Receipt, Download, FileText, ExternalLink, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrencyPEN } from '../../../utils/format';
import type { Boleta } from '../../../types/planilla.types';

interface Props {
  boletas: Boleta[];
  loading?: boolean;
  /** Callback al click en una boleta · si NO se pasa, navega al detalle de planilla */
  onClickBoleta?: (boleta: Boleta) => void;
  /** Callback al click en Descargar PDF · si NO se pasa, oculta el botón */
  onDescargarPdf?: (boleta: Boleta) => void;
}

const MES_LABEL = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const ESTADO_COLOR: Record<Boleta['estado'], { bg: string; text: string; label: string }> = {
  borrador: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Borrador' },
  aprobada: { bg: 'bg-sky-100', text: 'text-sky-700', label: 'Aprobada' },
  pagada: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Pagada' },
  anulada: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Anulada' },
};

export const MisBoletasRecientes: React.FC<Props> = ({ boletas, loading = false, onClickBoleta, onDescargarPdf }) => {
  const navigate = useNavigate();

  const handleClick = (b: Boleta) => {
    if (onClickBoleta) {
      onClickBoleta(b);
    } else {
      navigate(`/planilla?tab=boletas&boletaId=${b.id}`);
    }
  };

  return (
    <div className="bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50 rounded-2xl overflow-hidden">
      {/* Header card */}
      <div className="px-4 py-3 border-b border-sky-200/60 flex items-center gap-2">
        <Receipt className="w-4 h-4 text-sky-700 flex-shrink-0" />
        <span className="text-[11px] uppercase tracking-wider text-sky-700 font-bold">
          Mis boletas recientes
        </span>
        <button
          type="button"
          onClick={() => navigate('/planilla?tab=boletas')}
          className="ml-auto text-[11px] font-semibold text-sky-700 hover:text-sky-800 inline-flex items-center gap-1"
        >
          Ver todas
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Body */}
      <div className="bg-white">
        {loading ? (
          <div className="p-6 text-center text-slate-400 text-[12px]">Cargando boletas...</div>
        ) : boletas.length === 0 ? (
          // Empty state canon v8.0 N9 · quick-start pedagógico
          <div className="p-6 text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <div className="text-[13px] font-semibold text-slate-700">Aún sin boletas registradas</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Tu primera boleta se generará al cierre del mes en curso.
            </div>
          </div>
        ) : (
          <>
            {/* Mobile · stack 1-col touch targets ≥44px */}
            <div className="sm:hidden divide-y divide-slate-100">
              {boletas.map((b) => {
                const estado = ESTADO_COLOR[b.estado];
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleClick(b)}
                    className="w-full text-left p-3 flex items-center gap-3 min-h-[56px] hover:bg-sky-50/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-slate-900">
                          {MES_LABEL[b.mes]} {b.anio}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${estado.bg} ${estado.text}`}>
                          {estado.label}
                        </span>
                      </div>
                      <div className="text-[12px] text-slate-500 tabular-nums mt-0.5">
                        Neto: <span className="font-bold text-slate-900">{formatCurrencyPEN(b.totalNeto)}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Desktop · tabla compacta */}
            <table className="hidden sm:table w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left py-2 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Período</th>
                  <th className="text-right py-2 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Bruto</th>
                  <th className="text-right py-2 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Descuentos</th>
                  <th className="text-right py-2 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Neto</th>
                  <th className="text-center py-2 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Estado</th>
                  <th className="text-right py-2 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {boletas.map((b) => {
                  const estado = ESTADO_COLOR[b.estado];
                  return (
                    <tr
                      key={b.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-sky-50/40 transition-colors cursor-pointer"
                      onClick={() => handleClick(b)}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {MES_LABEL[b.mes]} {b.anio}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                        {formatCurrencyPEN(b.totalBruto)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-rose-600">
                        −{formatCurrencyPEN(b.totalDescuentos)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-sky-900">
                        {formatCurrencyPEN(b.totalNeto)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-bold ${estado.bg} ${estado.text}`}>
                          {estado.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {onDescargarPdf ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDescargarPdf(b);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:text-sky-800"
                            title="Descargar PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">PDF</span>
                          </button>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 inline" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
};

export default MisBoletasRecientes;
