/**
 * TabBoletas.tsx — Boletas del periodo con generación masiva.
 */
import React, { useEffect, useState } from 'react';
import { FileText, Plus, Check, CreditCard, XCircle, Download, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Badge, Button, useConfirmDialog, ConfirmDialog } from '../../../components/common';
import { useToastStore } from '../../../store/toastStore';
import { useAuthStore } from '../../../store/authStore';
import { usePlanillaStore } from '../../../store/planillaStore';
import { formatCurrency } from '../../../utils/format';
import { ESTADO_BOLETA_LABELS } from '../../../types/planilla.types';
import { BoletaDetalle } from './BoletaDetalle';
import type { Boleta } from '../../../types/planilla.types';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const ESTADO_BADGE: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  borrador: 'default',
  aprobada: 'warning',
  pagada: 'success',
  anulada: 'danger',
};

export const TabBoletas: React.FC = () => {
  const toast = useToastStore();
  const { user } = useAuthStore();
  const {
    boletas, loadingBoletas, fetchBoletas,
    mesActivo, anioActivo, setMesActivo, setAnioActivo,
    generarBoletas, aprobarBoleta, anularBoleta, eliminarBoleta,
  } = usePlanillaStore();
  const [boletaDetalle, setBoletaDetalle] = useState<Boleta | null>(null);
  const [generando, setGenerando] = useState(false);
  const confirm = useConfirmDialog();

  useEffect(() => { fetchBoletas(); }, []);

  const handleGenerar = async () => {
    if (!user?.uid) return;
    setGenerando(true);
    try {
      const result = await generarBoletas(user.uid);
      toast.success(`${result.length} boletas generadas para ${MESES[mesActivo - 1]} ${anioActivo}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerando(false);
    }
  };

  const handleAprobar = async (boleta: Boleta) => {
    if (!user?.uid) return;
    try {
      await aprobarBoleta(boleta.id, user.uid);
      toast.success(`Boleta ${boleta.id} aprobada`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAnular = async (boleta: Boleta) => {
    confirm.show({
      title: 'Anular boleta',
      message: `¿Anular la boleta ${boleta.id} de ${boleta.empleadoNombre}?`,
      confirmLabel: 'Anular',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await anularBoleta(boleta.id);
          toast.success('Boleta anulada');
        } catch (e: any) {
          toast.error(e.message);
        }
      },
    });
  };

  const handleEliminar = async (boleta: Boleta) => {
    confirm.show({
      title: 'Eliminar boleta',
      message: `¿Eliminar la boleta ${boleta.id}? Esta accion no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await eliminarBoleta(boleta.id);
          toast.success('Boleta eliminada');
        } catch (e: any) {
          toast.error(e.message);
        }
      },
    });
  };

  const handleMesAnterior = () => {
    if (mesActivo === 1) {
      setAnioActivo(anioActivo - 1);
      setMesActivo(12);
    } else {
      setMesActivo(mesActivo - 1);
    }
  };

  const handleMesSiguiente = () => {
    if (mesActivo === 12) {
      setAnioActivo(anioActivo + 1);
      setMesActivo(1);
    } else {
      setMesActivo(mesActivo + 1);
    }
  };

  const totalBruto = boletas.reduce((s, b) => s + b.totalBruto, 0);
  const totalNeto = boletas.reduce((s, b) => s + b.totalNeto, 0);

  return (
    <div className="space-y-4">
      {/* Selector de periodo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleMesAnterior}>
            <ChevronLeft size={18} />
          </Button>
          <span className="text-lg font-semibold min-w-[140px] text-center">
            {MESES[mesActivo - 1]} {anioActivo}
          </span>
          <Button variant="ghost" size="sm" onClick={handleMesSiguiente}>
            <ChevronRight size={18} />
          </Button>
        </div>

        {boletas.length === 0 ? (
          <Button variant="primary" onClick={handleGenerar} disabled={generando}>
            <Plus size={16} className="mr-1" />
            {generando ? 'Generando...' : 'Generar boletas del mes'}
          </Button>
        ) : (
          <div className="text-sm text-slate-500">
            {boletas.length} boleta{boletas.length !== 1 ? 's' : ''}
            {' — '}
            Bruto: {formatCurrency(totalBruto, 'PEN')}
            {' | '}
            Neto: {formatCurrency(totalNeto, 'PEN')}
          </div>
        )}
      </div>

      {/* Loading */}
      {loadingBoletas ? (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mr-3" />
          Cargando boletas...
        </div>
      ) : boletas.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <FileText size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No hay boletas para {MESES[mesActivo - 1]} {anioActivo}</p>
          <p className="text-sm">Haz clic en "Generar boletas del mes" para calcular.</p>
        </div>
      ) : (
        /* Tabla de boletas */
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Boleta</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Empleado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Sueldo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Comisiones</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Descuentos</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Neto</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {boletas.map(b => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{b.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{b.empleadoNombre}</div>
                    {b.empleadoCargo && <div className="text-xs text-slate-500">{b.empleadoCargo}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(b.salarioBase, 'PEN')}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {b.comisionesVentas > 0 ? (
                      <span className="text-green-600">{formatCurrency(b.comisionesVentas, 'PEN')}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {b.totalDescuentos > 0 ? (
                      <span className="text-red-600">-{formatCurrency(b.totalDescuentos, 'PEN')}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{formatCurrency(b.totalNeto, 'PEN')}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={ESTADO_BADGE[b.estado] || 'default'}>
                      {ESTADO_BOLETA_LABELS[b.estado]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setBoletaDetalle(b)} title="Ver detalle">
                        <FileText size={14} />
                      </Button>
                      {b.estado === 'borrador' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleAprobar(b)} title="Aprobar">
                            <Check size={14} className="text-green-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEliminar(b)} title="Eliminar">
                            <Trash2 size={14} className="text-red-500" />
                          </Button>
                        </>
                      )}
                      {b.estado === 'aprobada' && (
                        <Button variant="ghost" size="sm" onClick={() => setBoletaDetalle(b)} title="Pagar">
                          <CreditCard size={14} className="text-teal-600" />
                        </Button>
                      )}
                      {(b.estado === 'borrador' || b.estado === 'aprobada') && (
                        <Button variant="ghost" size="sm" onClick={() => handleAnular(b)} title="Anular">
                          <XCircle size={14} className="text-orange-500" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal detalle */}
      {boletaDetalle && (
        <BoletaDetalle
          boleta={boletaDetalle}
          open={!!boletaDetalle}
          onClose={() => { setBoletaDetalle(null); fetchBoletas(); }}
        />
      )}

      <ConfirmDialog {...confirm.props} />
    </div>
  );
};
