/**
 * TabTarjetasCredito — S58d v2 · Lista de tarjetas con cards visuales
 *
 * Reemplaza la UI legacy v1 (con barra utilizado/disponible) por la versión
 * banking-grade del mockup S58c-d:
 *   - Header con stats (total deuda titulares · total deuda banco)
 *   - Botón "Nueva tarjeta" prominente
 *   - Grid de 2 columnas de TarjetaCards con plástico gradient
 *   - Click en card → abre detalle (próxima fase F3)
 *   - Click en "Nueva tarjeta" → TarjetaFormModal v2
 *
 * El saldo se lee desde la CC espejo (fuente de verdad), no del campo
 * legacy `saldoActualUSD` de la tarjeta.
 */

import React, { useEffect, useState } from 'react';
import { CreditCard, Plus, Receipt, HandCoins } from 'lucide-react';
import { useTarjetaCreditoStore } from '../../store/tarjetaCreditoStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { Button } from '../../components/common';
import type {
  TarjetaCredito,
  TarjetaCreditoFormData,
} from '../../types/tarjetaCredito.types';
import { TarjetaCard, TarjetaFormModal } from './TarjetasCreditoV2';
import { CargarTarjetaWizard } from './TarjetasCreditoV2/CargarTarjetaWizard';
import { PagarEstadoCuentaWizard } from './TarjetasCreditoV2/PagarEstadoCuentaWizard';

export const TabTarjetasCredito: React.FC = () => {
  const {
    tarjetas,
    tarjetasActivas,
    loading,
    fetchTarjetas,
    crearTarjeta,
    actualizarTarjeta,
  } = useTarjetaCreditoStore();
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore();

  const [showForm, setShowForm] = useState(false);
  const [tarjetaEditar, setTarjetaEditar] = useState<TarjetaCredito | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // S58d F3 — Wizard cargar a tarjeta
  const [showCargar, setShowCargar] = useState(false);
  const [tarjetaParaCargo, setTarjetaParaCargo] =
    useState<TarjetaCredito | undefined>(undefined);

  // S58d F4 — Wizard pagar estado de cuenta
  const [showPagar, setShowPagar] = useState(false);
  const [tarjetaParaPago, setTarjetaParaPago] =
    useState<TarjetaCredito | undefined>(undefined);

  useEffect(() => {
    void fetchTarjetas();
  }, [fetchTarjetas]);

  // ── Stats ──
  // Las stats se calculan a partir de las tarjetas legacy; en v2 los saldos
  // viven en CC. Para una visión consolidada se podría agregar un useEffect
  // que sume saldos CC, pero la card individual ya muestra el saldo real.
  const totalDeudaPersonalUSD = tarjetasActivas
    .filter((t) => t.titularidad === 'personal')
    .reduce((s, t) => s + (t.saldoActualUSD || 0), 0);
  const totalDeudaEmpresaUSD = tarjetasActivas
    .filter((t) => (t.titularidad ?? 'empresa') === 'empresa')
    .reduce((s, t) => s + (t.saldoActualUSD || 0), 0);

  // ── Handlers ──
  const abrirNueva = () => {
    setTarjetaEditar(null);
    setShowForm(true);
  };

  const abrirEditar = (tarjeta: TarjetaCredito) => {
    setTarjetaEditar(tarjeta);
    setShowForm(true);
  };

  const handleGuardar = async (
    data: TarjetaCreditoFormData,
    editingId: string | null,
  ) => {
    if (!user) {
      toast.error('Sesión inválida');
      throw new Error('No user');
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await actualizarTarjeta(editingId, data, user.uid);
        toast.success('Tarjeta actualizada');
      } else {
        await crearTarjeta(data, user.uid);
        toast.success(
          `Tarjeta "${data.nombre}" creada${
            data.titularidad === 'personal' && data.titularNombre
              ? ` · titular: ${data.titularNombre}`
              : ''
          }`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(msg, 'No se pudo guardar');
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Tarjetas de crédito
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {tarjetasActivas.length}{' '}
            {tarjetasActivas.length === 1 ? 'tarjeta' : 'tarjetas'}
            {totalDeudaPersonalUSD > 0 &&
              ` · Total deuda con titulares: US$ ${totalDeudaPersonalUSD.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            {totalDeudaEmpresaUSD > 0 &&
              ` · Total deuda con banco: US$ ${totalDeudaEmpresaUSD.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tarjetasActivas.length > 0 && (
            <>
              <Button
                variant="primary-soft"
                size="sm"
                onClick={() => {
                  setTarjetaParaCargo(undefined);
                  setShowCargar(true);
                }}
                disabled={submitting}
                title="Cargar deudas a una tarjeta"
              >
                <Receipt className="h-4 w-4 mr-1.5" />
                Cargar a tarjeta
              </Button>
              <Button
                variant="primary-soft"
                size="sm"
                onClick={() => {
                  setTarjetaParaPago(undefined);
                  setShowPagar(true);
                }}
                disabled={submitting}
                title="Pagar estado de cuenta o reembolsar al titular"
              >
                <HandCoins className="h-4 w-4 mr-1.5" />
                Pagar estado de cuenta
              </Button>
            </>
          )}
          <Button
            variant="primary-soft"
            size="sm"
            onClick={abrirNueva}
            disabled={submitting}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nueva tarjeta
          </Button>
        </div>
      </div>

      {/* Lista o empty state */}
      {loading && tarjetas.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <CreditCard className="h-12 w-12 mx-auto mb-3 text-slate-300 animate-pulse" />
          <p className="font-medium">Cargando tarjetas…</p>
        </div>
      ) : tarjetas.length === 0 ? (
        <div className="text-center py-12 px-4 bg-slate-50/50 border border-dashed border-slate-200 rounded-lg">
          <CreditCard className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-500">
            Sin tarjetas registradas
          </p>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Agrega tu primera tarjeta de crédito (empresarial o personal de un
            empleado) para registrar cargos como pasivos.
          </p>
          <Button
            variant="primary-soft"
            size="sm"
            onClick={abrirNueva}
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Crear primera tarjeta
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tarjetas.map((tarjeta) => (
            <div key={tarjeta.id} className="space-y-2">
              <TarjetaCard
                tarjeta={tarjeta}
                onClick={(t) => {
                  // Click en la card → cargar a tarjeta (caso más frecuente)
                  setTarjetaParaCargo(t);
                  setShowCargar(true);
                }}
              />
              <div className="flex items-center justify-between gap-1 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setTarjetaParaPago(tarjeta);
                    setShowPagar(true);
                  }}
                  className={
                    tarjeta.titularidad === 'personal'
                      ? 'text-[11px] text-sky-700 hover:text-sky-800 hover:underline px-2 py-0.5 font-medium'
                      : 'text-[11px] text-amber-700 hover:text-amber-800 hover:underline px-2 py-0.5 font-medium'
                  }
                  title={
                    tarjeta.titularidad === 'personal'
                      ? 'Reembolsar al titular'
                      : 'Pagar al banco emisor'
                  }
                >
                  {tarjeta.titularidad === 'personal'
                    ? 'Reembolsar al titular →'
                    : 'Pagar al banco →'}
                </button>
                <button
                  type="button"
                  onClick={() => abrirEditar(tarjeta)}
                  className="text-[10px] text-slate-500 hover:text-slate-700 hover:underline px-2 py-0.5"
                >
                  Editar tarjeta
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nueva/editar tarjeta */}
      <TarjetaFormModal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setTarjetaEditar(null);
        }}
        onGuardar={handleGuardar}
        tarjetaEditar={tarjetaEditar}
        isSubmitting={submitting}
      />

      {/* S58d F3 — Wizard cargar deudas a tarjeta (TX-1) */}
      <CargarTarjetaWizard
        isOpen={showCargar}
        onClose={() => {
          setShowCargar(false);
          setTarjetaParaCargo(undefined);
        }}
        tarjetaPreseleccionada={tarjetaParaCargo}
        onSuccess={() => {
          // Refresh datos tras cargo exitoso
          void fetchTarjetas();
        }}
      />

      {/* S58d F4 — Wizard pagar estado de cuenta (TX-2) */}
      <PagarEstadoCuentaWizard
        isOpen={showPagar}
        onClose={() => {
          setShowPagar(false);
          setTarjetaParaPago(undefined);
        }}
        tarjetaPreseleccionada={tarjetaParaPago}
        onSuccess={() => {
          void fetchTarjetas();
        }}
      />
    </div>
  );
};
