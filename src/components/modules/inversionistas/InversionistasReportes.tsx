/**
 * Tab 7 · Reportes ejecutivos exportables
 *
 * 3 botones grandes (PDF · CSV · PPTX) · solo CSV funcional · resto placeholders
 * que muestran intento próximamente. Histórico vacío hasta que generes uno.
 *
 * Mobile: 3 botones stack vertical (grid-cols-1), 3 cols desktop.
 */
import React from 'react';
import { FileText, FileSpreadsheet, Presentation, History } from 'lucide-react';
import type { ResumenInversionista } from '../../../types/inversionista.types';
import { MESES_NOMBRE_LARGO } from './shared';

interface Props {
  data: ResumenInversionista;
  mes: number;
  anio: number;
}

export default function InversionistasReportes({ data, mes, anio }: Props) {
  const handleExportCSV = () => {
    const filename = `inversionistas-${anio}-${String(mes).padStart(2, '0')}.csv`;
    const rows: Array<[string, string | number]> = [
      ['Métrica', 'Valor'],
      ['Período', `${MESES_NOMBRE_LARGO[mes]} ${anio}`],
      ['Tipo de cambio usado', data.tipoCambio.toFixed(4)],
      ['', ''],
      ['CAPITAL', ''],
      ['Cash propio aportado', data.capitalComprometido.cashAportadoPEN.toFixed(2)],
      ['Deuda TC personal vigente', data.capitalComprometido.deudaTCPersonalPEN.toFixed(2)],
      ['Capital comprometido total', data.capitalComprometido.totalPEN.toFixed(2)],
      ['', ''],
      ['PATRIMONIO Y SALUD', ''],
      ['Patrimonio actual', data.patrimonioPEN.toFixed(2)],
      ['Activos totales', data.activosPEN.toFixed(2)],
      ['Pasivos totales', data.pasivosPEN.toFixed(2)],
      ['Equity Ratio (%)', data.equityRatio.porcentaje.toFixed(2)],
      ['Salud equity', data.equityRatio.salud],
      ['', ''],
      ['RETORNO', ''],
      ['Utilidad neta acumulada 12m', data.roiDual.utilidadNetaAcumuladaPEN.toFixed(2)],
      ['ROI sobre cash propio (%)', (data.roiDual.sobreCashAportado * 100).toFixed(2)],
      ['ROI sobre capital comprometido (%)', (data.roiDual.sobreCapitalComprometido * 100).toFixed(2)],
      ['Multiplicador patrimonio', data.multiplicador.multiplicador.toFixed(2)],
      ['', ''],
      ['SOBERANÍA FINANCIERA', ''],
      ['Meses para liberar TC', data.soberania.mesesParaSoberania.toFixed(1)],
      ['Pago mensual estimado a TC', data.soberania.pagoMensualEstimadoPEN.toFixed(2)],
      ['Estado de soberanía', data.soberania.estado],
    ];

    const csv =
      '﻿' +
      rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* 3 botones export · stack mobile, 3 cols desktop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => alert('Próximamente · generación de PDF de directorio')}
          className="bg-white border-2 border-violet-200 hover:border-violet-400 rounded-2xl p-4 text-left transition-colors min-h-[88px]"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mb-2">
            <FileText className="w-5 h-5 text-violet-700" />
          </div>
          <div className="text-[12px] font-bold text-violet-900 mb-0.5">Reporte directorio · PDF</div>
          <div className="text-[10px] text-slate-500">Próximamente · 1 página · todas las secciones</div>
        </button>

        <button
          type="button"
          onClick={handleExportCSV}
          className="bg-white border-2 border-emerald-200 hover:border-emerald-400 rounded-2xl p-4 text-left transition-colors min-h-[88px]"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="text-[12px] font-bold text-emerald-900 mb-0.5">Exportar para socios · CSV</div>
          <div className="text-[10px] text-slate-500">Métricas clave del período</div>
        </button>

        <button
          type="button"
          onClick={() => alert('Próximamente · slides ejecutivas en PPTX')}
          className="bg-white border-2 border-amber-200 hover:border-amber-400 rounded-2xl p-4 text-left transition-colors min-h-[88px]"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-2">
            <Presentation className="w-5 h-5 text-amber-700" />
          </div>
          <div className="text-[12px] font-bold text-amber-900 mb-0.5">Presentación junta · PPTX</div>
          <div className="text-[10px] text-slate-500">Próximamente · slides ejecutivas</div>
        </button>
      </div>

      {/* Histórico de reportes · placeholder · DEUDA-INV-REPORTES */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100">
          <h3 className="text-[12px] font-bold text-slate-900 flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-slate-600" />
            Histórico de reportes generados
          </h3>
        </div>
        <div className="px-4 py-6 text-center text-[11px] text-slate-500">
          Sin reportes generados aún · usá los botones arriba para empezar.
        </div>
      </div>
    </div>
  );
}
