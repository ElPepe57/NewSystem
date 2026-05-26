/**
 * ExportPayrollModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F5.C · 2026-05-26
 *
 * Modal canon FormModalV2 slate para exportar payroll del mes a CSV.
 * Genera CSV en cliente (sin endpoint backend) con boletas del período
 * seleccionado.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Info } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { planillaService } from '../../../services/planilla.service';
import type { Boleta } from '../../../types/planilla.types';
import { formatCurrencyPEN } from '../../../utils/format';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mes: number;
  anio: number;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

const MES_NOMBRE = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function generarCSV(boletas: Boleta[], mes: number, anio: number): string {
  const headers = [
    'Empleado',
    'Cargo',
    'Período',
    'Salario base',
    'Comisiones',
    'Bonificaciones',
    'Otros ingresos',
    'Total bruto',
    'Adelantos',
    'Otros descuentos',
    'Total descuentos',
    'Total neto',
    'Estado',
  ];
  const rows = boletas.map((b) => [
    `"${b.empleadoNombre}"`,
    `"${b.empleadoCargo ?? ''}"`,
    `"${MES_NOMBRE[mes - 1]} ${anio}"`,
    b.salarioBase.toFixed(2),
    b.comisionesVentas.toFixed(2),
    b.bonificaciones.toFixed(2),
    b.otrosIngresos.toFixed(2),
    b.totalBruto.toFixed(2),
    b.adelantos.toFixed(2),
    b.otrosDescuentos.toFixed(2),
    b.totalDescuentos.toFixed(2),
    b.totalNeto.toFixed(2),
    b.estado,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export const ExportPayrollModal: React.FC<Props> = ({
  isOpen,
  onClose,
  mes,
  anio,
  onSuccess,
  onError,
}) => {
  const [boletas, setBoletas] = useState<Boleta[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<'todas' | 'aprobadas' | 'pagadas'>('todas');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    (async () => {
      try {
        const bols = await planillaService.getBoletasPorPeriodo(mes, anio);
        setBoletas(bols);
      } catch (err) {
        console.error('[ExportPayrollModal] error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, mes, anio]);

  const filtradas = useMemo(() => {
    if (filtroEstado === 'todas') return boletas;
    if (filtroEstado === 'aprobadas') return boletas.filter((b) => b.estado === 'aprobada' || b.estado === 'pagada');
    return boletas.filter((b) => b.estado === 'pagada');
  }, [boletas, filtroEstado]);

  const totalNeto = filtradas.reduce((s, b) => s + b.totalNeto, 0);

  const handleSubmit = async () => {
    if (submitting || filtradas.length === 0) return;
    setSubmitting(true);
    try {
      const csv = generarCSV(filtradas, mes, anio);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payroll-${anio}-${String(mes).padStart(2, '0')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onSuccess?.(
        `CSV exportado · ${filtradas.length} boleta${filtradas.length === 1 ? '' : 's'} · ${formatCurrencyPEN(totalNeto)} total`,
      );
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al exportar CSV');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={`Exportar payroll · ${MES_NOMBRE[mes - 1]} ${anio}`}
      subtitle="Genera CSV con todas las boletas del mes"
      icon={Download}
      iconTone="slate"
      size="md"
      submitLabel={
        submitting
          ? 'Generando...'
          : filtradas.length === 0
            ? 'Sin boletas para exportar'
            : `Descargar CSV (${filtradas.length})`
      }
      submitVariant="primary-soft"
      submitIcon={Download}
      loading={submitting}
      disabled={loading || filtradas.length === 0}
    >
      <div className="space-y-4">
        <div className="bg-slate-50 border border-slate-200 rounded p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-700">
            CSV con encoding UTF-8 separado por comas. Compatible con Excel · Google Sheets · y
            herramientas de contabilidad.
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Incluir</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['todas', 'aprobadas', 'pagadas'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setFiltroEstado(opt)}
                className={`text-[11px] py-1.5 rounded border ${
                  filtroEstado === opt
                    ? 'bg-slate-100 border-slate-400 text-slate-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
              A EXPORTAR
            </span>
            <FileText className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">
            {filtradas.length} <span className="text-[12px] font-normal">boleta{filtradas.length === 1 ? '' : 's'}</span>
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">
            Total neto: {formatCurrencyPEN(totalNeto)}
          </div>
        </div>
      </div>
    </FormModalV2>
  );
};

export default ExportPayrollModal;
