import React from 'react';
import { formatFecha as formatDate } from '../../utils/dateFormatters';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { Button, Card } from '../../components/common';
import { FormModal, DataTable } from '../../design-system';
import type { DataTableColumn as Column } from '../../design-system';
import type {
  ConversionCambiaria,
  CuentaCaja,
  ConversionCambiariaFormData,
  MonedaTesoreria
} from '../../types/tesoreria.types';

interface TabConversionesPros {
  conversiones: ConversionCambiaria[];
  cuentas: CuentaCaja[];
  isConversionModalOpen: boolean;
  setIsConversionModalOpen: (open: boolean) => void;
  conversionForm: Partial<ConversionCambiariaFormData>;
  setConversionForm: React.Dispatch<React.SetStateAction<Partial<ConversionCambiariaFormData>>>;
  isSubmitting: boolean;
  tcDefault: number;
  handleCrearConversion: () => void;
}

export const TabConversiones: React.FC<TabConversionesPros> = ({
  conversiones,
  cuentas,
  isConversionModalOpen,
  setIsConversionModalOpen,
  conversionForm,
  setConversionForm,
  isSubmitting,
  handleCrearConversion,
}) => {
  const conversionColumns: Column<ConversionCambiaria>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      align: 'left',
      render: (conv) => formatDate(conv.fecha),
    },
    {
      key: 'origen',
      header: 'Origen',
      align: 'left',
      render: (conv) => (
        <div>
          <div className="font-medium text-slate-900">
            {conv.monedaOrigen === 'PEN' ? 'S/ ' : '$ '}
            {conv.montoOrigen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500">{conv.monedaOrigen}</div>
        </div>
      ),
    },
    {
      key: 'destino',
      header: 'Destino',
      align: 'left',
      render: (conv) => (
        <div>
          <div className="font-medium text-slate-900">
            {conv.monedaDestino === 'PEN' ? 'S/ ' : '$ '}
            {conv.montoDestino.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500">{conv.monedaDestino}</div>
        </div>
      ),
    },
    {
      key: 'tipoCambio',
      header: 'TC Usado',
      align: 'right',
      render: (conv) => conv.tipoCambio.toFixed(3),
    },
    {
      key: 'tipoCambioReferencia',
      header: 'TC Ref.',
      align: 'right',
      render: (conv) => (
        <span className="text-slate-500">{conv.tipoCambioReferencia.toFixed(3)}</span>
      ),
    },
    {
      key: 'spread',
      header: 'Spread',
      align: 'right',
      render: (conv) => (
        <span className={conv.spreadCambiario >= 0 ? 'text-emerald-600' : 'text-red-600'}>
          {conv.spreadCambiario >= 0 ? '+' : ''}{conv.spreadCambiario.toFixed(2)}%
        </span>
      ),
    },
  ];

  return (
    <>
      <Card padding="none">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900">
            Conversiones ({conversiones.length})
          </h3>
          <Button variant="primary" onClick={() => setIsConversionModalOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
            <span className="sm:hidden">Nueva</span>
            <span className="hidden sm:inline">Nueva Conversion</span>
          </Button>
        </div>

        {/* Mobile card layout */}
        <div className="md:hidden divide-y divide-slate-200">
          {conversiones.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500">
              No hay conversiones registradas
            </div>
          ) : (
            conversiones.map((conv) => (
              <div key={conv.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{formatDate(conv.fecha)}</span>
                  <span className={`text-xs font-medium ${conv.spreadCambiario >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    Spread: {conv.spreadCambiario >= 0 ? '+' : ''}{conv.spreadCambiario.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div className="text-center flex-1">
                    <div className="text-[10px] text-slate-500 uppercase">Origen</div>
                    <div className="text-sm font-bold text-red-600">
                      {conv.monedaOrigen === 'PEN' ? 'S/ ' : '$ '}{conv.montoOrigen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-slate-400">{conv.monedaOrigen}</div>
                  </div>
                  <RefreshCw className="h-4 w-4 text-slate-300 flex-shrink-0" />
                  <div className="text-center flex-1">
                    <div className="text-[10px] text-slate-500 uppercase">Destino</div>
                    <div className="text-sm font-bold text-emerald-600">
                      {conv.monedaDestino === 'PEN' ? 'S/ ' : '$ '}{conv.montoDestino.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-slate-400">{conv.monedaDestino}</div>
                  </div>
                </div>
                <div className="flex justify-center gap-4 text-[10px] text-slate-500">
                  <span>TC: <strong className="text-slate-700">{conv.tipoCambio.toFixed(3)}</strong></span>
                  <span>Ref: {conv.tipoCambioReferencia.toFixed(3)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <DataTable
            columns={conversionColumns}
            data={conversiones}
            keyExtractor={(conv) => conv.id}
            compact
            emptyMessage="No hay conversiones registradas"
          />
        </div>
      </Card>

      {/* Modal Nueva Conversion */}
      <FormModal
        isOpen={isConversionModalOpen}
        onClose={() => setIsConversionModalOpen(false)}
        title="Nueva Conversion de Moneda"
        size="lg"
        variant="create"
        submitLabel={isSubmitting ? 'Guardando...' : 'Guardar'}
        onSubmit={handleCrearConversion}
        loading={isSubmitting}
        disabled={!conversionForm.montoOrigen || !conversionForm.tipoCambio || (() => {
          if (!conversionForm.cuentaOrigenId || !conversionForm.montoOrigen) return false;
          const ctaOrigen = cuentas.find(c => c.id === conversionForm.cuentaOrigenId);
          if (!ctaOrigen) return false;
          const saldo = ctaOrigen.esBiMoneda
            ? (conversionForm.monedaOrigen === 'USD' ? (ctaOrigen.saldoUSD || 0) : (ctaOrigen.saldoPEN || 0))
            : (ctaOrigen.saldoActual || 0);
          return saldo < (conversionForm.montoOrigen ?? 0);
        })()}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Moneda Origen</label>
              <select
                value={conversionForm.monedaOrigen}
                onChange={(e) =>
                  setConversionForm({
                    ...conversionForm,
                    monedaOrigen: e.target.value as MonedaTesoreria,
                    cuentaOrigenId: undefined,
                    cuentaDestinoId: undefined
                  })
                }
                className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              >
                <option value="USD">USD (Dolares)</option>
                <option value="PEN">PEN (Soles)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monto Origen</label>
              <input
                type="number"
                step="0.01"
                value={conversionForm.montoOrigen || ''}
                onChange={(e) => setConversionForm({ ...conversionForm, montoOrigen: parseFloat(e.target.value) })}
                className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Cambio</label>
              <input
                type="number"
                step="0.001"
                value={conversionForm.tipoCambio || ''}
                onChange={(e) => setConversionForm({ ...conversionForm, tipoCambio: parseFloat(e.target.value) })}
                className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
                placeholder="3.700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Entidad de Cambio</label>
              <input
                type="text"
                value={conversionForm.entidadCambio || ''}
                onChange={(e) => setConversionForm({ ...conversionForm, entidadCambio: e.target.value })}
                className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
                placeholder="Casa de cambio, banco, etc."
              />
            </div>
          </div>

          {/* Seccion de Cuentas */}
          <div className="border-t border-slate-200 pt-4 mt-4">
            <h4 className="text-sm font-medium text-slate-900 mb-3 flex items-center">
              <Wallet className="h-4 w-4 mr-2 text-teal-600" />
              Vincular con Cuentas (Opcional)
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              Selecciona las cuentas para registrar automaticamente los movimientos de tesoreria
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <ArrowUpCircle className="inline h-4 w-4 mr-1 text-red-500" />
                  Cuenta Origen ({conversionForm.monedaOrigen || 'USD'})
                </label>
                <select
                  value={conversionForm.cuentaOrigenId || ''}
                  onChange={(e) => setConversionForm({ ...conversionForm, cuentaOrigenId: e.target.value || undefined })}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
                >
                  <option value="">Sin cuenta (solo registro)</option>
                  {cuentas
                    .filter(c => c.activa && (c.esBiMoneda || c.moneda === conversionForm.monedaOrigen))
                    .map(cuenta => {
                      const saldoActual = cuenta.esBiMoneda
                        ? (conversionForm.monedaOrigen === 'USD' ? (cuenta.saldoUSD || 0) : (cuenta.saldoPEN || 0))
                        : (cuenta.saldoActual || 0);
                      const sim = conversionForm.monedaOrigen === 'USD' ? '$' : 'S/';
                      const label = [cuenta.banco, cuenta.nombre, cuenta.titular ? `(${cuenta.titular})` : ''].filter(Boolean).join(' · ');
                      return (
                        <option key={cuenta.id} value={cuenta.id}>
                          {label} — {sim}{saldoActual.toFixed(2)}
                        </option>
                      );
                    })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <ArrowDownCircle className="inline h-4 w-4 mr-1 text-emerald-500" />
                  Cuenta Destino ({conversionForm.monedaOrigen === 'USD' ? 'PEN' : 'USD'})
                </label>
                <select
                  value={conversionForm.cuentaDestinoId || ''}
                  onChange={(e) => setConversionForm({ ...conversionForm, cuentaDestinoId: e.target.value || undefined })}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
                >
                  <option value="">Sin cuenta (solo registro)</option>
                  {cuentas
                    .filter(c => c.activa && (c.esBiMoneda || c.moneda === (conversionForm.monedaOrigen === 'USD' ? 'PEN' : 'USD')))
                    .map(cuenta => {
                      const monedaDestino = conversionForm.monedaOrigen === 'USD' ? 'PEN' : 'USD';
                      const saldoActual = cuenta.esBiMoneda
                        ? (monedaDestino === 'USD' ? (cuenta.saldoUSD || 0) : (cuenta.saldoPEN || 0))
                        : (cuenta.saldoActual || 0);
                      const sim = monedaDestino === 'USD' ? '$' : 'S/';
                      const label = [cuenta.banco, cuenta.nombre, cuenta.titular ? `(${cuenta.titular})` : ''].filter(Boolean).join(' · ');
                      return (
                        <option key={cuenta.id} value={cuenta.id}>
                          {label} — {sim}{saldoActual.toFixed(2)}
                        </option>
                      );
                    })}
                </select>
              </div>
            </div>
          </div>

          {/* Preview de la conversion */}
          {conversionForm.montoOrigen && conversionForm.tipoCambio && (
            <div className="bg-sky-50 p-4 rounded-lg border border-sky-200">
              <h4 className="text-sm font-medium text-slate-900 mb-2">Vista Previa de Conversion</h4>
              <div className="flex items-center justify-center space-x-4">
                <div className="text-center">
                  <p className="text-xs text-slate-500">Sale</p>
                  <p className="text-lg font-bold text-red-600">
                    {conversionForm.monedaOrigen === 'USD' ? '$' : 'S/'}{conversionForm.montoOrigen.toFixed(2)}
                  </p>
                  {conversionForm.cuentaOrigenId && (
                    <p className="text-xs text-slate-500">
                      de {cuentas.find(c => c.id === conversionForm.cuentaOrigenId)?.nombre}
                    </p>
                  )}
                </div>
                <RefreshCw className="h-6 w-6 text-slate-400" />
                <div className="text-center">
                  <p className="text-xs text-slate-500">Entra</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {conversionForm.monedaOrigen === 'USD'
                      ? `S/${(conversionForm.montoOrigen * conversionForm.tipoCambio).toFixed(2)}`
                      : `$${(conversionForm.montoOrigen / conversionForm.tipoCambio).toFixed(2)}`
                    }
                  </p>
                  {conversionForm.cuentaDestinoId && (
                    <p className="text-xs text-slate-500">
                      a {cuentas.find(c => c.id === conversionForm.cuentaDestinoId)?.nombre}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-center text-slate-500 mt-2">
                TC: {conversionForm.tipoCambio.toFixed(3)}
              </p>
              {(conversionForm.cuentaOrigenId || conversionForm.cuentaDestinoId) && (
                <div className="mt-3 pt-3 border-t border-sky-200">
                  <p className="text-xs font-medium text-slate-700 mb-1">Movimientos a generar:</p>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {conversionForm.cuentaOrigenId && (
                      <li className="flex items-center">
                        <ArrowUpCircle className="h-3 w-3 text-red-500 mr-1" />
                        Egreso: {conversionForm.monedaOrigen === 'USD' ? '$' : 'S/'}{conversionForm.montoOrigen.toFixed(2)} de {cuentas.find(c => c.id === conversionForm.cuentaOrigenId)?.nombre}
                      </li>
                    )}
                    {conversionForm.cuentaDestinoId && (
                      <li className="flex items-center">
                        <ArrowDownCircle className="h-3 w-3 text-emerald-500 mr-1" />
                        Ingreso: {conversionForm.monedaOrigen === 'USD'
                          ? `S/${(conversionForm.montoOrigen * conversionForm.tipoCambio).toFixed(2)}`
                          : `$${(conversionForm.montoOrigen / conversionForm.tipoCambio).toFixed(2)}`
                        } a {cuentas.find(c => c.id === conversionForm.cuentaDestinoId)?.nombre}
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
            <input
              type="text"
              value={conversionForm.motivo || ''}
              onChange={(e) => setConversionForm({ ...conversionForm, motivo: e.target.value })}
              className="w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              placeholder="Razon de la conversion"
            />
          </div>

          {/* Validación de saldo insuficiente */}
          {conversionForm.cuentaOrigenId && conversionForm.montoOrigen && (() => {
            const ctaOrigen = cuentas.find(c => c.id === conversionForm.cuentaOrigenId);
            if (!ctaOrigen) return null;
            const saldo = ctaOrigen.esBiMoneda
              ? (conversionForm.monedaOrigen === 'USD' ? (ctaOrigen.saldoUSD || 0) : (ctaOrigen.saldoPEN || 0))
              : (ctaOrigen.saldoActual || 0);
            if (saldo < conversionForm.montoOrigen) {
              return (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  Saldo insuficiente en {ctaOrigen.nombre}. Disponible: {conversionForm.monedaOrigen === 'USD' ? '$' : 'S/'}{saldo.toFixed(2)}
                </div>
              );
            }
            return null;
          })()}

        </div>
      </FormModal>
    </>
  );
};
