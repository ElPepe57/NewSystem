/**
 * BoletaDetalleModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F10.A · 2026-05-26
 *
 * Modal canon FormModalV2 sky · M3 del mockup planilla-v5.3-modales-internos.html.
 * Drill F6.A · vista completa de boleta + acción "Marcar pagada" + descarga PDF.
 *
 * Reemplaza BoletaDetalle.tsx legacy.
 *
 * Tabs internos:
 *  - Detalle · KPIs + neto + descuentos
 *  - Comisiones · tabla con desglose de comisiones por venta
 */
import React, { useState } from 'react';
import {
  FileText, Download, Check, Edit2, Trash2,
  DollarSign, History, X,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common';
import { useToastStore } from '../../../store/toastStore';
import { useAuthStore } from '../../../store/authStore';
import { usePlanillaStore } from '../../../store/planillaStore';
import { PagoUnificadoForm } from '../../../components/modules/pagos/PagoUnificadoForm';
import { formatCurrencyPEN } from '../../../utils/format';
import type { Boleta, DetalleComision, EstadoBoleta } from '../../../types/planilla.types';
import { ESTADO_BOLETA_LABELS } from '../../../types/planilla.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  boleta: Boleta | null;
  onRequestEdit?: (boleta: Boleta) => void;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const ESTADO_CHIP: Record<EstadoBoleta, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  aprobada: 'bg-amber-100 text-amber-700',
  pagada: 'bg-emerald-100 text-emerald-700',
  anulada: 'bg-rose-100 text-rose-700',
};

type TabId = 'detalle' | 'comisiones';

/** Iniciales del nombre para el avatar */
function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

export const BoletaDetalleModal: React.FC<Props> = ({
  isOpen,
  onClose,
  boleta,
  onRequestEdit,
  onSuccess,
  onError,
}) => {
  const toast = useToastStore();
  const { user } = useAuthStore();
  const { pagarBoleta, anularBoleta } = usePlanillaStore();
  const [tab, setTab] = useState<TabId>('detalle');
  const [showPago, setShowPago] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [anulando, setAnulando] = useState(false);

  if (!boleta) return null;

  const handlePago = async (datosPago: any) => {
    if (!user?.uid) return;
    setPagando(true);
    try {
      await pagarBoleta(
        boleta.id,
        {
          metodoPago: datosPago.metodoPago,
          cuentaOrigenId: datosPago.cuentaOrigenId,
          referencia: datosPago.referencia,
          tipoCambio: datosPago.tipoCambio,
        },
        user.uid,
      );
      toast.success(`Boleta ${boleta.id} pagada · ${formatCurrencyPEN(boleta.totalNeto)}`);
      onSuccess?.(`Boleta ${boleta.id} pagada exitosamente`);
      setShowPago(false);
      onClose();
    } catch (e: any) {
      onError?.(e?.message ?? 'Error al pagar boleta');
      toast.error(e?.message ?? 'Error');
    } finally {
      setPagando(false);
    }
  };

  const handleDescargarPDF = async () => {
    try {
      const { generarBoletaPdf } = await import('../../../services/boletaPdf.service');
      const blob = await generarBoletaPdf(boleta);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${boleta.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF descargado');
    } catch (e: any) {
      toast.error('Error al generar PDF: ' + (e?.message ?? 'desconocido'));
    }
  };

  const handleAnular = async () => {
    if (!window.confirm(`¿Anular boleta ${boleta.id}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setAnulando(true);
    try {
      await anularBoleta(boleta.id);
      onSuccess?.(`Boleta ${boleta.id} anulada`);
      onClose();
    } catch (e: any) {
      onError?.(e?.message ?? 'Error al anular boleta');
    } finally {
      setAnulando(false);
    }
  };

  const initials = iniciales(boleta.empleadoNombre);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="xl"
      contentPadding="none"
      showHeaderShadow={false}
    >
      {/* Header custom · avatar gradient sky + nombre + estado + acciones */}
      <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-start gap-3 sticky top-0 z-10">
        <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-violet-600 rounded-2xl flex items-center justify-center text-white font-bold text-[14px] flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h1 className="text-[16px] font-bold text-slate-900">Boleta · {boleta.empleadoNombre}</h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${ESTADO_CHIP[boleta.estado]}`}>
              {ESTADO_BOLETA_LABELS[boleta.estado]}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            {MESES[boleta.mes - 1]} {boleta.anio}
            {boleta.empleadoCargo ? ` · ${boleta.empleadoCargo}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDescargarPDF}
          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[12px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          title="Descargar PDF"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">PDF</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs internos */}
      <div className="border-b border-slate-200 px-5">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab('detalle')}
            className={`px-3 py-2.5 text-[12px] border-b-2 flex items-center gap-1.5 ${
              tab === 'detalle'
                ? 'border-violet-600 text-violet-700 font-bold'
                : 'border-transparent text-slate-600 hover:text-violet-600 font-medium'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Detalle
          </button>
          <button
            type="button"
            onClick={() => setTab('comisiones')}
            className={`px-3 py-2.5 text-[12px] border-b-2 flex items-center gap-1.5 ${
              tab === 'comisiones'
                ? 'border-violet-600 text-violet-700 font-bold'
                : 'border-transparent text-slate-600 hover:text-violet-600 font-medium'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Comisiones
            {boleta.detalleComisiones?.length > 0 && (
              <span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                {boleta.detalleComisiones.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Body · scroll */}
      <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 220px)' }}>
        {tab === 'detalle' && (
          <div className="space-y-3">
            {/* KPI cards 4 cols · pixel-perfect canon M3 */}
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  Sueldo base
                </div>
                <div className="text-xl font-bold tabular-nums text-slate-900">
                  {formatCurrencyPEN(boleta.salarioBase)}
                </div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1">
                  Bonificación
                </div>
                <div className="text-xl font-bold tabular-nums text-emerald-900">
                  + {formatCurrencyPEN(boleta.bonificaciones + boleta.otrosIngresos)}
                </div>
              </div>
              <div className="bg-violet-50 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-violet-700 font-bold mb-1">
                  Comisiones
                </div>
                <div className="text-xl font-bold tabular-nums text-violet-900">
                  + {formatCurrencyPEN(boleta.comisionesVentas)}
                </div>
              </div>
              <div className="bg-rose-50 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-rose-700 font-bold mb-1">
                  Descuentos
                </div>
                <div className="text-xl font-bold tabular-nums text-rose-900">
                  - {formatCurrencyPEN(boleta.totalDescuentos)}
                </div>
              </div>
            </div>

            {/* NETO grande · canon mockup */}
            <div className="bg-gradient-to-r from-violet-50 to-cyan-50 border border-violet-200 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-violet-700 font-bold mb-1">
                    NETO A PAGAR
                  </div>
                  <div className="text-3xl font-bold tabular-nums text-violet-900">
                    {formatCurrencyPEN(boleta.totalNeto)}
                  </div>
                </div>
                {boleta.estado === 'aprobada' && (
                  <button
                    type="button"
                    onClick={() => setShowPago(true)}
                    disabled={pagando}
                    className="bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Marcar pagada
                  </button>
                )}
                {boleta.estado === 'pagada' && (
                  <div className="text-[11px] text-emerald-700 font-bold inline-flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Pagada
                  </div>
                )}
              </div>
            </div>

            {/* Detalle de adelantos descontados */}
            {boleta.detalleAdelantos?.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-700 font-bold mb-1.5 pt-2">
                  Detalle de descuentos (adelantos)
                </div>
                <table className="w-full text-[11px]">
                  <tbody>
                    {boleta.detalleAdelantos.map((a, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-1.5">Adelanto · {a.adelantoId}</td>
                        <td className="text-right tabular-nums text-rose-700">
                          - {formatCurrencyPEN(a.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'comisiones' && (
          <div className="space-y-3">
            {boleta.detalleComisiones?.length > 0 ? (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500 font-bold">
                    <th className="py-2">Venta</th>
                    <th className="text-right pr-2">Monto venta</th>
                    <th className="text-right pr-2">%</th>
                    <th className="text-right">Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {boleta.detalleComisiones.map((c: DetalleComision, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-900">{c.ventaNumero}</td>
                      <td className="text-right pr-2 tabular-nums">
                        {formatCurrencyPEN(c.montoVenta)}
                      </td>
                      <td className="text-right pr-2 tabular-nums">{c.porcentaje}%</td>
                      <td className="text-right tabular-nums font-bold text-violet-700">
                        {formatCurrencyPEN(c.montoComision)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-bold">
                    <td colSpan={3} className="py-2 text-right">
                      TOTAL COMISIONES
                    </td>
                    <td className="text-right tabular-nums text-violet-900">
                      {formatCurrencyPEN(boleta.comisionesVentas)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <div className="text-center py-8 text-[12px] text-slate-500">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                Sin comisiones calculadas para esta boleta
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between sticky bottom-0">
        <button
          type="button"
          onClick={handleAnular}
          disabled={anulando || boleta.estado === 'pagada' || boleta.estado === 'anulada'}
          className="text-[11px] text-rose-600 font-bold flex items-center gap-1 hover:text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed"
          title={
            boleta.estado === 'pagada' || boleta.estado === 'anulada'
              ? 'Solo se pueden anular boletas en borrador o aprobada'
              : 'Anular boleta'
          }
        >
          <Trash2 className="w-3 h-3" />
          Anular boleta
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          {onRequestEdit && boleta.estado !== 'pagada' && boleta.estado !== 'anulada' && (
            <button
              type="button"
              onClick={() => onRequestEdit(boleta)}
              className="bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Editar
            </button>
          )}
        </div>
      </div>

      {/* Sub-modal pago · PagoUnificadoForm */}
      {showPago && (
        <Modal
          isOpen={showPago}
          onClose={() => setShowPago(false)}
          title={`Pagar boleta · ${boleta.empleadoNombre}`}
          size="lg"
        >
          <PagoUnificadoForm
            origen="nomina"
            titulo={`Pagar boleta · ${boleta.empleadoNombre}`}
            montoTotal={boleta.totalNeto}
            montoPendiente={boleta.totalNeto}
            monedaOriginal="PEN"
            onSubmit={handlePago}
            onCancel={() => setShowPago(false)}
            loading={pagando}
          />
        </Modal>
      )}
    </Modal>
  );
};

export default BoletaDetalleModal;
