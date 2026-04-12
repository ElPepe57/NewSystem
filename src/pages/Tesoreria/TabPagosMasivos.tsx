/**
 * TabPagosMasivos.tsx
 *
 * Tab de Pagos Masivos dentro de Tesorería.
 * Reutiliza los componentes de la página PagosMasivos.
 */
import React, { useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useConfirmDialog, ConfirmDialog } from '../../components/common';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { usePagoMasivoStore } from '../../store/pagoMasivoStore';
import { DocumentosPendientesTable } from '../PagosMasivos/components/DocumentosPendientesTable';
import { ConfigPagoPanel } from '../PagosMasivos/components/ConfigPagoPanel';
import { ProgresoEjecucion } from '../PagosMasivos/components/ProgresoEjecucion';
import { HistorialLotes } from '../PagosMasivos/components/HistorialLotes';
import { LoteDetalleModal } from '../PagosMasivos/components/LoteDetalleModal';
import type { ConfigPagoMasivo } from '../../types/pagoMasivo.types';

type SubTab = 'nuevo' | 'historial';

export const TabPagosMasivos: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('nuevo');
  const [showProgreso, setShowProgreso] = useState(false);

  const toast = useToastStore();
  const { user } = useAuthStore();
  const {
    tipoLote,
    setTipoLote,
    fetchPendientes,
    seleccionados,
    ejecutarPagoMasivo,
    ejecutando,
    resetSeleccion,
    resetEjecucion,
    error,
    clearError,
  } = usePagoMasivoStore();

  const confirm = useConfirmDialog();

  useEffect(() => {
    fetchPendientes();
  }, []);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error]);

  const handleProcesar = async (config: ConfigPagoMasivo) => {
    if (!user?.uid) {
      toast.error('No se pudo identificar al usuario');
      return;
    }

    const count = seleccionados.size;
    confirm.show({
      title: 'Confirmar pago masivo',
      message: `Se procesaran ${count} pago${count !== 1 ? 's' : ''} desde la cuenta "${config.cuentaNombre}". Esta accion no se puede deshacer automaticamente.`,
      confirmLabel: `Procesar ${count} pago${count !== 1 ? 's' : ''}`,
      variant: 'warning',
      onConfirm: async () => {
        setShowProgreso(true);
        try {
          const lote = await ejecutarPagoMasivo(config, user.uid);
          if (lote.itemsConError === 0) {
            toast.success(`Lote ${lote.id} completado: ${lote.itemsExitosos} pagos exitosos`);
          } else {
            toast.warning(
              `Lote ${lote.id}: ${lote.itemsExitosos} exitosos, ${lote.itemsConError} con error`
            );
          }
        } catch (err: any) {
          toast.error(err.message || 'Error al procesar el lote');
        }
      },
    });
  };

  const handleCerrarProgreso = () => {
    setShowProgreso(false);
    resetSeleccion();
    resetEjecucion();
    fetchPendientes();
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {([
          { id: 'nuevo' as SubTab, label: 'Nuevo Lote' },
          { id: 'historial' as SubTab, label: 'Historial' },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              subTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'nuevo' ? (
        <>
          {/* Toggle Egresos / Ingresos */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipoLote('egreso')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                tipoLote === 'egreso'
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ArrowUpCircle size={18} />
              Egresos (OC + Gastos)
            </button>
            <button
              type="button"
              onClick={() => setTipoLote('ingreso')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                tipoLote === 'ingreso'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ArrowDownCircle size={18} />
              Ingresos (Ventas)
            </button>
          </div>

          {/* Layout: tabla + panel */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <DocumentosPendientesTable />
            <ConfigPagoPanel onProcesar={handleProcesar} loading={ejecutando} />
          </div>
        </>
      ) : (
        <HistorialLotes />
      )}

      {/* Modal de progreso */}
      <ProgresoEjecucion open={showProgreso} onClose={handleCerrarProgreso} />

      {/* Modal de detalle de lote */}
      <LoteDetalleModal />

      {/* ConfirmDialog */}
      <ConfirmDialog {...confirm.props} />
    </div>
  );
};
