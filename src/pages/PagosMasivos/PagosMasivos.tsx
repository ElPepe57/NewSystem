/**
 * PagosMasivos.tsx
 *
 * Página principal del módulo de Pagos Masivos.
 * Permite seleccionar N documentos pendientes y pagarlos/cobrarlos en lote.
 */
import React, { useEffect, useState } from 'react';
import { Layers, ArrowDownCircle, ArrowUpCircle, CreditCard } from 'lucide-react';
import { PageShell, PageHeader, Toolbar } from '../../design-system';
import { useConfirmDialog, ConfirmDialog } from '../../components/common';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { usePagoMasivoStore } from '../../store/pagoMasivoStore';
import { DocumentosPendientesTable } from './components/DocumentosPendientesTable';
import { ConfigPagoPanel } from './components/ConfigPagoPanel';
import { ProgresoEjecucion } from './components/ProgresoEjecucion';
import { HistorialLotes } from './components/HistorialLotes';
import { LoteDetalleModal } from './components/LoteDetalleModal';
import type { ConfigPagoMasivo } from '../../types/pagoMasivo.types';

type TabActiva = 'nuevo' | 'historial';

export const PagosMasivos: React.FC = () => {
  const [tabActiva, setTabActiva] = useState<TabActiva>('nuevo');
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
    loteResultado,
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
    <PageShell>
      <PageHeader
        title="Pagos Masivos"
        subtitle="Procesa multiples pagos en un solo lote"
        icon={CreditCard}
      />
      <Toolbar />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {([
          { id: 'nuevo' as TabActiva, label: 'Nuevo Lote' },
          { id: 'historial' as TabActiva, label: 'Historial' },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTabActiva(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tabActiva === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabActiva === 'nuevo' ? (
        <>
          {/* Toggle Egresos / Ingresos */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setTipoLote('egreso')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                tipoLote === 'egreso'
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
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
                  ? 'bg-green-50 border-green-300 text-green-800'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
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
    </PageShell>
  );
};
