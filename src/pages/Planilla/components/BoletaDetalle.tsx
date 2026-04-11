/**
 * BoletaDetalle.tsx — Modal con detalle completo de una boleta + opción de pago.
 */
import React, { useState } from 'react';
import { FileText, Download, DollarSign } from 'lucide-react';
import { Modal, Button, Badge } from '../../../components/common';
import { useToastStore } from '../../../store/toastStore';
import { useAuthStore } from '../../../store/authStore';
import { usePlanillaStore } from '../../../store/planillaStore';
import { useTipoCambioStore } from '../../../store/tipoCambioStore';
import { PagoUnificadoForm } from '../../../components/modules/pagos/PagoUnificadoForm';
import { formatCurrency } from '../../../utils/format';
import { ESTADO_BOLETA_LABELS } from '../../../types/planilla.types';
import type { Boleta } from '../../../types/planilla.types';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface BoletaDetalleProps {
  boleta: Boleta;
  open: boolean;
  onClose: () => void;
}

export const BoletaDetalle: React.FC<BoletaDetalleProps> = ({ boleta, open, onClose }) => {
  const toast = useToastStore();
  const { user } = useAuthStore();
  const { pagarBoleta } = usePlanillaStore();
  const [showPago, setShowPago] = useState(false);
  const [pagando, setPagando] = useState(false);

  const handlePago = async (datosPago: any) => {
    if (!user?.uid) return;
    setPagando(true);
    try {
      await pagarBoleta(boleta.id, {
        metodoPago: datosPago.metodoPago,
        cuentaOrigenId: datosPago.cuentaOrigenId,
        referencia: datosPago.referencia,
        tipoCambio: datosPago.tipoCambio,
      }, user.uid);
      toast.success(`Boleta ${boleta.id} pagada exitosamente`);
      setShowPago(false);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
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
      toast.error('Error al generar PDF: ' + e.message);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={`Boleta ${boleta.id}`} size="lg">
      <div className="space-y-4">
        {/* Encabezado */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold">{boleta.empleadoNombre}</h3>
            <p className="text-sm text-slate-500">{boleta.empleadoCargo || '—'}</p>
            <p className="text-sm text-slate-500">Periodo: {MESES[boleta.mes - 1]} {boleta.anio}</p>
          </div>
          <Badge variant={boleta.estado === 'pagada' ? 'success' : boleta.estado === 'aprobada' ? 'warning' : 'default'}>
            {ESTADO_BOLETA_LABELS[boleta.estado]}
          </Badge>
        </div>

        {/* Ingresos */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-green-50 px-4 py-2 text-sm font-semibold text-green-800">Ingresos</div>
          <div className="divide-y">
            <div className="flex justify-between px-4 py-2 text-sm">
              <span>Salario base</span>
              <span className="font-mono">{formatCurrency(boleta.salarioBase, 'PEN')}</span>
            </div>
            {boleta.comisionesVentas > 0 && (
              <div className="flex justify-between px-4 py-2 text-sm">
                <span>Comisiones ({boleta.detalleComisiones.length} ventas)</span>
                <span className="font-mono text-green-600">{formatCurrency(boleta.comisionesVentas, 'PEN')}</span>
              </div>
            )}
            {boleta.bonificaciones > 0 && (
              <div className="flex justify-between px-4 py-2 text-sm">
                <span>Bonificaciones</span>
                <span className="font-mono">{formatCurrency(boleta.bonificaciones, 'PEN')}</span>
              </div>
            )}
            {boleta.otrosIngresos > 0 && (
              <div className="flex justify-between px-4 py-2 text-sm">
                <span>Otros ingresos</span>
                <span className="font-mono">{formatCurrency(boleta.otrosIngresos, 'PEN')}</span>
              </div>
            )}
            <div className="flex justify-between px-4 py-2 text-sm font-semibold bg-green-50">
              <span>Total bruto</span>
              <span className="font-mono">{formatCurrency(boleta.totalBruto, 'PEN')}</span>
            </div>
          </div>
        </div>

        {/* Descuentos */}
        {boleta.totalDescuentos > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">Descuentos</div>
            <div className="divide-y">
              {boleta.adelantos > 0 && (
                <div className="flex justify-between px-4 py-2 text-sm">
                  <span>Adelantos ({boleta.detalleAdelantos.length})</span>
                  <span className="font-mono text-red-600">-{formatCurrency(boleta.adelantos, 'PEN')}</span>
                </div>
              )}
              {boleta.otrosDescuentos > 0 && (
                <div className="flex justify-between px-4 py-2 text-sm">
                  <span>Otros descuentos</span>
                  <span className="font-mono text-red-600">-{formatCurrency(boleta.otrosDescuentos, 'PEN')}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-2 text-sm font-semibold bg-red-50">
                <span>Total descuentos</span>
                <span className="font-mono text-red-600">-{formatCurrency(boleta.totalDescuentos, 'PEN')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Neto */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 flex justify-between items-center">
          <span className="text-lg font-semibold text-teal-800">Neto a pagar</span>
          <span className="text-2xl font-bold text-teal-700 font-mono">{formatCurrency(boleta.totalNeto, 'PEN')}</span>
        </div>

        {/* Detalle comisiones */}
        {boleta.detalleComisiones.length > 0 && (
          <details className="border rounded-lg">
            <summary className="px-4 py-2 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
              Detalle de comisiones ({boleta.detalleComisiones.length} ventas)
            </summary>
            <div className="border-t max-h-[200px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-1.5 text-left">Venta</th>
                    <th className="px-3 py-1.5 text-right">Monto</th>
                    <th className="px-3 py-1.5 text-right">%</th>
                    <th className="px-3 py-1.5 text-right">Comision</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {boleta.detalleComisiones.map((d, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-mono">{d.ventaNumero}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(d.montoVenta, 'PEN')}</td>
                      <td className="px-3 py-1.5 text-right">{d.porcentaje}%</td>
                      <td className="px-3 py-1.5 text-right font-mono text-green-600">{formatCurrency(d.montoComision, 'PEN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* Acciones */}
        <div className="flex justify-between items-center pt-2 border-t">
          <Button variant="secondary" onClick={handleDescargarPDF}>
            <Download size={16} className="mr-1" /> PDF
          </Button>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
            {boleta.estado === 'aprobada' && (
              <Button variant="primary" onClick={() => setShowPago(true)}>
                <DollarSign size={16} className="mr-1" /> Pagar boleta
              </Button>
            )}
          </div>
        </div>

        {/* Formulario de pago */}
        {showPago && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-3">Registrar pago</h4>
            <PagoUnificadoForm
              origen="nomina"
              titulo={`Pago de boleta ${boleta.id}`}
              esIngreso={false}
              montoTotal={boleta.totalNeto}
              montoPendiente={boleta.totalNeto}
              monedaOriginal="PEN"
              onSubmit={handlePago}
              onCancel={() => setShowPago(false)}
              loading={pagando}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
