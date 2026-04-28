import React from 'react';
import { formatFecha as formatDate } from '../../utils/dateFormatters';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  RefreshCw,
  Rotate3d,
  Check,
} from 'lucide-react';
import { Button, Card } from '../../components/common';
import {
  FormModalV2,
  DataTable,
  TextField,
  MoneyField,
  ToggleGroup,
  Combobox,
} from '../../design-system';
import type {
  DataTableColumn as Column,
  ComboboxGroup,
} from '../../design-system';
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

      {/* Modal Nueva Conversion — S58 Fase 5 con FormModalV2 */}
      {(() => {
        const monedaOrigen = conversionForm.monedaOrigen ?? 'USD';
        const monedaDestino: MonedaTesoreria = monedaOrigen === 'USD' ? 'PEN' : 'USD';
        const ctaOrigen = cuentas.find((c) => c.id === conversionForm.cuentaOrigenId);
        const saldoOrigen = ctaOrigen
          ? ctaOrigen.esBiMoneda
            ? monedaOrigen === 'USD'
              ? ctaOrigen.saldoUSD || 0
              : ctaOrigen.saldoPEN || 0
            : ctaOrigen.saldoActual || 0
          : null;
        const saldoInsuficiente =
          ctaOrigen != null &&
          conversionForm.montoOrigen != null &&
          saldoOrigen != null &&
          saldoOrigen < conversionForm.montoOrigen;

        // Cuentas filtradas por moneda
        const cuentasFiltradasOrigen = cuentas.filter(
          (c) => c.activa && (c.esBiMoneda || c.moneda === monedaOrigen),
        );
        const cuentasFiltradasDestino = cuentas.filter(
          (c) => c.activa && (c.esBiMoneda || c.moneda === monedaDestino),
        );

        const buildCuentaGroups = (
          lista: CuentaCaja[],
          moneda: MonedaTesoreria,
        ): ComboboxGroup<string>[] => {
          const sym = moneda === 'USD' ? 'US$' : 'S/';
          return [
            {
              options: [
                { value: '', label: 'Sin cuenta · solo registro', subLabel: 'No afecta saldos' },
                ...lista.map((cuenta) => {
                  const saldoActual = cuenta.esBiMoneda
                    ? moneda === 'USD'
                      ? cuenta.saldoUSD || 0
                      : cuenta.saldoPEN || 0
                    : cuenta.saldoActual || 0;
                  const labelParts = [cuenta.banco, cuenta.nombre].filter(Boolean) as string[];
                  return {
                    value: cuenta.id,
                    label: labelParts.join(' · ') || cuenta.nombre,
                    subLabel: `${cuenta.titular ? `${cuenta.titular} · ` : ''}Saldo ${sym} ${saldoActual.toFixed(2)}`,
                  };
                }),
              ],
            },
          ];
        };

        return (
          <FormModalV2
            isOpen={isConversionModalOpen}
            onClose={() => setIsConversionModalOpen(false)}
            title="Nueva conversión"
            breadcrumb="Cash flow · Conversión cambiaria"
            icon={Rotate3d}
            iconTone="purple"
            size="lg"
            loading={isSubmitting}
            disabled={
              isSubmitting ||
              !conversionForm.montoOrigen ||
              !conversionForm.tipoCambio ||
              !!saldoInsuficiente
            }
            submitLabel="Ejecutar conversión"
            submitVariant="primary-soft"
            submitIcon={Check}
            onSubmit={handleCrearConversion}
          >
            <div className="space-y-6">
              {/* Bloque 1: Direccion de la conversion */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">1</span>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Dirección de la conversión</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ToggleGroup<MonedaTesoreria>
                    label="Moneda origen"
                    value={monedaOrigen}
                    onChange={(v) =>
                      setConversionForm({
                        ...conversionForm,
                        monedaOrigen: v,
                        cuentaOrigenId: undefined,
                        cuentaDestinoId: undefined,
                      })
                    }
                    options={[
                      { value: 'USD', label: 'USD' },
                      { value: 'PEN', label: 'PEN' },
                    ]}
                    hint={`Convertir ${monedaOrigen} → ${monedaDestino}`}
                  />
                  <MoneyField
                    label="Monto a convertir"
                    value={conversionForm.montoOrigen}
                    onChange={(v) =>
                      setConversionForm({ ...conversionForm, montoOrigen: v ?? 0 })
                    }
                    moneda={monedaOrigen}
                    equivalente={
                      conversionForm.montoOrigen && conversionForm.tipoCambio
                        ? {
                            valor:
                              monedaOrigen === 'USD'
                                ? conversionForm.montoOrigen * conversionForm.tipoCambio
                                : conversionForm.montoOrigen / conversionForm.tipoCambio,
                            moneda: monedaDestino,
                            tcUsado: conversionForm.tipoCambio,
                          }
                        : undefined
                    }
                  />
                </div>
              </div>

              {/* Bloque 2: TC + entidad de cambio */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">2</span>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Tipo de cambio aplicado</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextField
                    label="Tipo de cambio"
                    value={conversionForm.tipoCambio?.toString() ?? ''}
                    onChange={(v) => {
                      const num = parseFloat(v);
                      setConversionForm({
                        ...conversionForm,
                        tipoCambio: isNaN(num) ? undefined : num,
                      });
                    }}
                    placeholder="3.700"
                    rightHint={
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-medium">
                        Día
                      </span>
                    }
                    hint="Auto-llenado desde tipoCambio.service. Modificar solo si negociaste un TC distinto."
                  />
                  <TextField
                    label="Casa de cambio"
                    optional
                    value={conversionForm.entidadCambio || ''}
                    onChange={(v) =>
                      setConversionForm({ ...conversionForm, entidadCambio: v })
                    }
                    placeholder="BCP, Western, casa de cambio..."
                  />
                </div>
              </div>

              {/* Bloque 3: Cuentas */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">3</span>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Cuentas afectadas</span>
                  <span className="text-[10px] text-slate-400 italic">opcional</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Combobox<string>
                    label={`Cuenta origen (${monedaOrigen})`}
                    value={conversionForm.cuentaOrigenId ?? ''}
                    onChange={(v) =>
                      setConversionForm({
                        ...conversionForm,
                        cuentaOrigenId: v || undefined,
                      })
                    }
                    groups={buildCuentaGroups(cuentasFiltradasOrigen, monedaOrigen)}
                    placeholder="Sin cuenta · solo registro"
                    hint="De donde sale el dinero (egreso)"
                    error={
                      saldoInsuficiente && ctaOrigen
                        ? `Saldo insuficiente. Disponible: ${monedaOrigen === 'USD' ? 'US$' : 'S/'} ${(saldoOrigen ?? 0).toFixed(2)}`
                        : undefined
                    }
                  />
                  <Combobox<string>
                    label={`Cuenta destino (${monedaDestino})`}
                    value={conversionForm.cuentaDestinoId ?? ''}
                    onChange={(v) =>
                      setConversionForm({
                        ...conversionForm,
                        cuentaDestinoId: v || undefined,
                      })
                    }
                    groups={buildCuentaGroups(cuentasFiltradasDestino, monedaDestino)}
                    placeholder="Sin cuenta · solo registro"
                    hint="A donde llega el dinero (ingreso)"
                  />
                </div>
              </div>

              {/* Vista previa de la conversión */}
              {conversionForm.montoOrigen && conversionForm.tipoCambio && (
                <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-wider text-purple-700 font-bold mb-2">
                    Vista previa
                  </div>
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-5 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                        Vendes
                      </div>
                      <div className="text-2xl font-bold text-red-700 num-tab tabular-nums">
                        {monedaOrigen === 'USD' ? 'US$' : 'S/'}{' '}
                        {conversionForm.montoOrigen.toFixed(2)}
                      </div>
                      {conversionForm.cuentaOrigenId && (
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                          desde{' '}
                          {cuentas.find((c) => c.id === conversionForm.cuentaOrigenId)?.nombre}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <div className="w-9 h-9 rounded-full bg-purple-100 border-2 border-purple-300 flex items-center justify-center">
                        <RefreshCw className="text-purple-700 w-4 h-4" />
                      </div>
                    </div>
                    <div className="col-span-5 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mb-1">
                        Recibes
                      </div>
                      <div className="text-2xl font-bold text-emerald-700 tabular-nums">
                        {monedaDestino === 'USD' ? 'US$' : 'S/'}{' '}
                        {(monedaOrigen === 'USD'
                          ? conversionForm.montoOrigen * conversionForm.tipoCambio
                          : conversionForm.montoOrigen / conversionForm.tipoCambio
                        ).toFixed(2)}
                      </div>
                      {conversionForm.cuentaDestinoId && (
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                          en{' '}
                          {cuentas.find((c) => c.id === conversionForm.cuentaDestinoId)?.nombre}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-purple-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">
                      TC aplicado:{' '}
                      <span className="font-semibold tabular-nums">
                        {conversionForm.tipoCambio.toFixed(3)}
                      </span>
                    </span>
                    {(conversionForm.cuentaOrigenId || conversionForm.cuentaDestinoId) && (
                      <span className="text-purple-700 font-medium">
                        Generará movimientos en cuentas seleccionadas
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Bloque 4: Motivo */}
              <TextField
                label="Motivo"
                optional
                value={conversionForm.motivo || ''}
                onChange={(v) =>
                  setConversionForm({ ...conversionForm, motivo: v })
                }
                placeholder="Ej: Pagar planilla en soles"
              />
            </div>
          </FormModalV2>
        );
      })()}
    </>
  );
};
