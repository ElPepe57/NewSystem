import React from 'react';
import { formatFecha as formatDate } from '../../utils/dateFormatters';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  ArrowLeftRight,
  Building2,
  Banknote,
  CreditCard,
  AlertTriangle,
  Shuffle,
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
  DataTableColumn,
  ComboboxGroup,
} from '../../design-system';
import type {
  CuentaCaja,
  TransferenciaEntreCuentasFormData,
  MonedaTesoreria
} from '../../types/tesoreria.types';

// Local type matching the one defined in Tesoreria.tsx
interface TransferenciaEntreCuentas {
  id: string;
  fecha: Date;
  cuentaOrigenId: string;
  cuentaOrigenNombre: string;
  cuentaDestinoId: string;
  cuentaDestinoNombre: string;
  monto: number;
  moneda: MonedaTesoreria;
  concepto?: string;
  creadoPor: string;
  creadoEn: Date;
}

interface TabTransferenciasProps {
  transferencias: TransferenciaEntreCuentas[];
  cuentas: CuentaCaja[];
  isTransferenciaModalOpen: boolean;
  setIsTransferenciaModalOpen: (open: boolean) => void;
  transferenciaForm: Partial<TransferenciaEntreCuentasFormData>;
  setTransferenciaForm: React.Dispatch<React.SetStateAction<Partial<TransferenciaEntreCuentasFormData>>>;
  isSubmitting: boolean;
  tcDefault: number;
  handleCrearTransferencia: () => void;
}

export const TabTransferencias: React.FC<TabTransferenciasProps> = ({
  transferencias,
  cuentas,
  isTransferenciaModalOpen,
  setIsTransferenciaModalOpen,
  transferenciaForm,
  setTransferenciaForm,
  isSubmitting,
  tcDefault,
  handleCrearTransferencia,
}) => {
  const moneda = (transferenciaForm.moneda || 'PEN') as MonedaTesoreria;
  const simbolo = moneda === 'USD' ? '$' : 'S/';
  const monto = transferenciaForm.monto || 0;

  const getSaldo = (cuenta: CuentaCaja): number => {
    if (cuenta.esBiMoneda) {
      return moneda === 'USD' ? (cuenta.saldoUSD || 0) : (cuenta.saldoPEN || 0);
    }
    return cuenta.saldoActual || 0;
  };

  const getTipoIcon = (tipo: string, productoFinanciero?: string) => {
    if (productoFinanciero === 'caja' || tipo === 'efectivo') return <Banknote className="w-3.5 h-3.5 text-emerald-500" />;
    if (productoFinanciero === 'billetera_digital' || tipo === 'digital') return <CreditCard className="w-3.5 h-3.5 text-purple-500" />;
    if (tipo === 'credito') return <CreditCard className="w-3.5 h-3.5 text-amber-500" />;
    return <Building2 className="w-3.5 h-3.5 text-sky-500" />;
  };

  const getCuentaLabel = (c: CuentaCaja) => {
    const parts: string[] = [];
    if (c.banco) parts.push(c.banco);
    parts.push(c.nombre);
    if (c.titular) parts.push(`(${c.titular})`);
    return parts.join(' · ');
  };

  const cuentasCompatibles = cuentas.filter(c => {
    if (!c.activa) return false;
    if (!(c.esBiMoneda || c.moneda === moneda)) return false;
    return true;
  });

  const cuentaOrigen = cuentas.find(c => c.id === transferenciaForm.cuentaOrigenId);
  const cuentaDestino = cuentas.find(c => c.id === transferenciaForm.cuentaDestinoId);

  const saldoOrigen = cuentaOrigen ? getSaldo(cuentaOrigen) : 0;
  const saldoDestino = cuentaDestino ? getSaldo(cuentaDestino) : 0;
  const saldoOrigenPost = saldoOrigen - monto;
  const saldoDestinoPost = saldoDestino + monto;
  const fondosInsuficientes = !!cuentaOrigen && monto > 0 && saldoOrigenPost < 0;
  const origenBajoMinimo = !!cuentaOrigen && monto > 0 && (() => {
    if (cuentaOrigen.esBiMoneda) {
      const min = moneda === 'USD' ? cuentaOrigen.saldoMinimoUSD : cuentaOrigen.saldoMinimoPEN;
      return min !== undefined && saldoOrigenPost < min;
    }
    return cuentaOrigen.saldoMinimo !== undefined && saldoOrigenPost < cuentaOrigen.saldoMinimo;
  })();

  const transferenciaColumns: DataTableColumn<TransferenciaEntreCuentas>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      render: (transf) => <span className="text-slate-500">{formatDate(transf.fecha)}</span>,
    },
    {
      key: 'cuentaOrigen',
      header: 'Cuenta Origen',
      render: (transf) => <span className="font-medium text-slate-900">{transf.cuentaOrigenNombre}</span>,
    },
    {
      key: 'arrow',
      header: '→',
      align: 'center',
      width: '48px',
      render: () => <ArrowLeftRight className="h-4 w-4 text-slate-400 inline" />,
    },
    {
      key: 'cuentaDestino',
      header: 'Cuenta Destino',
      render: (transf) => <span className="font-medium text-slate-900">{transf.cuentaDestinoNombre}</span>,
    },
    {
      key: 'monto',
      header: 'Monto',
      align: 'right',
      render: (transf) => (
        <span className="font-medium text-slate-900">
          {transf.moneda === 'PEN' ? 'S/ ' : '$ '}
          {transf.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'concepto',
      header: 'Concepto',
      render: (transf) => <span className="text-slate-500">{transf.concepto || '-'}</span>,
    },
  ];

  return (
    <>
      <Card padding="none">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">Transferencias entre Cuentas</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 hidden sm:block">
              Mueve fondos entre tus propias cuentas sin afectar el patrimonio
            </p>
          </div>
          <Button variant="primary" onClick={() => setIsTransferenciaModalOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
            <span className="sm:hidden">Nueva</span>
            <span className="hidden sm:inline">Nueva Transferencia</span>
          </Button>
        </div>

        {/* Mobile card layout */}
        <div className="md:hidden divide-y divide-slate-200">
          {transferencias.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500">
              <ArrowLeftRight className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="font-medium text-sm">No hay transferencias registradas</p>
              <p className="text-xs mt-1">Las transferencias entre cuentas se mostraran aqui</p>
            </div>
          ) : (
            transferencias.map((transf) => (
              <div key={transf.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{formatDate(transf.fecha)}</span>
                  <span className="text-sm font-bold text-slate-900">
                    {transf.moneda === 'PEN' ? 'S/ ' : '$ '}{transf.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-xs">
                    <div className="text-[10px] text-slate-400 uppercase">Origen</div>
                    <div className="font-medium text-slate-900 truncate">{transf.cuentaOrigenNombre}</div>
                  </div>
                  <ArrowLeftRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                  <div className="flex-1 text-xs text-right">
                    <div className="text-[10px] text-slate-400 uppercase">Destino</div>
                    <div className="font-medium text-slate-900 truncate">{transf.cuentaDestinoNombre}</div>
                  </div>
                </div>
                {transf.concepto && (
                  <p className="text-xs text-slate-500 truncate">{transf.concepto}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <DataTable
            columns={transferenciaColumns}
            data={transferencias}
            keyExtractor={(t) => t.id}
            compact
            emptyState={
              <div className="py-8 text-center text-slate-500">
                <ArrowLeftRight className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">No hay transferencias registradas</p>
                <p className="text-sm mt-1">Las transferencias entre cuentas se mostraran aqui</p>
              </div>
            }
          />
        </div>
      </Card>

      {/* Modal Transferencia entre Cuentas — S58 Fase 5 con FormModalV2 */}
      {(() => {
        // Construir grupos de Combobox de cuentas filtradas
        const buildCuentaGroups = (excludeId?: string): ComboboxGroup<string>[] => [
          {
            options: cuentasCompatibles
              .filter((c) => c.id !== excludeId)
              .map((cuenta) => ({
                value: cuenta.id,
                label: getCuentaLabel(cuenta),
                subLabel: `${cuenta.titular ? `${cuenta.titular} · ` : ''}Saldo ${simbolo} ${getSaldo(cuenta).toFixed(2)}`,
              })),
          },
        ];

        return (
          <FormModalV2
            isOpen={isTransferenciaModalOpen}
            onClose={() => {
              setIsTransferenciaModalOpen(false);
              setTransferenciaForm({ moneda: 'PEN', fecha: new Date(), tipoCambio: tcDefault });
            }}
            title="Transferencia entre cuentas"
            breadcrumb="Cash flow · Movimiento entre cuentas propias"
            icon={Shuffle}
            iconTone="sky"
            size="lg"
            loading={isSubmitting}
            disabled={
              isSubmitting ||
              !transferenciaForm.monto ||
              !transferenciaForm.cuentaOrigenId ||
              !transferenciaForm.cuentaDestinoId ||
              fondosInsuficientes
            }
            submitLabel="Realizar transferencia"
            submitVariant="primary-soft"
            submitIcon={Check}
            onSubmit={handleCrearTransferencia}
          >
            <div className="space-y-6">
              {/* Bloque 1: Moneda + monto */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">1</span>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Moneda y monto</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ToggleGroup<MonedaTesoreria>
                    label="Moneda"
                    value={moneda}
                    onChange={(v) =>
                      setTransferenciaForm({
                        ...transferenciaForm,
                        moneda: v,
                        cuentaOrigenId: undefined,
                        cuentaDestinoId: undefined,
                      })
                    }
                    options={[
                      { value: 'PEN', label: 'PEN' },
                      { value: 'USD', label: 'USD' },
                    ]}
                    hint="Solo cuentas en esta moneda aparecerán abajo"
                  />
                  <MoneyField
                    label="Monto a transferir"
                    value={transferenciaForm.monto}
                    onChange={(v) =>
                      setTransferenciaForm({ ...transferenciaForm, monto: v ?? 0 })
                    }
                    moneda={moneda}
                  />
                </div>
              </div>

              {/* Bloque 2: Cuentas */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">2</span>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Cuentas</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Combobox<string>
                    label="Cuenta origen (sale)"
                    value={transferenciaForm.cuentaOrigenId ?? ''}
                    onChange={(v) =>
                      setTransferenciaForm({
                        ...transferenciaForm,
                        cuentaOrigenId: v || undefined,
                      })
                    }
                    groups={buildCuentaGroups(transferenciaForm.cuentaDestinoId)}
                    placeholder="Seleccionar cuenta origen..."
                    error={
                      fondosInsuficientes
                        ? `Fondos insuficientes. Disponible: ${simbolo} ${saldoOrigen.toFixed(2)}`
                        : undefined
                    }
                    hint={
                      cuentaOrigen && monto > 0 && !fondosInsuficientes
                        ? `Saldo después: ${simbolo} ${saldoOrigenPost.toFixed(2)}`
                        : undefined
                    }
                  />
                  <Combobox<string>
                    label="Cuenta destino (entra)"
                    value={transferenciaForm.cuentaDestinoId ?? ''}
                    onChange={(v) =>
                      setTransferenciaForm({
                        ...transferenciaForm,
                        cuentaDestinoId: v || undefined,
                      })
                    }
                    groups={buildCuentaGroups(transferenciaForm.cuentaOrigenId)}
                    placeholder="Seleccionar cuenta destino..."
                    hint={
                      cuentaDestino && monto > 0
                        ? `Saldo después: ${simbolo} ${saldoDestinoPost.toFixed(2)}`
                        : undefined
                    }
                  />
                </div>
              </div>

              {/* Warnings adicionales (mínimo) */}
              {!fondosInsuficientes && origenBajoMinimo && (
                <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-[12px] text-amber-800">
                    <strong>Alerta de saldo mínimo.</strong> Esta transferencia dejará la cuenta origen por debajo de su saldo mínimo configurado.
                  </div>
                </div>
              )}

              {/* Bloque 3: Concepto */}
              <TextField
                label="Concepto / motivo"
                optional
                value={transferenciaForm.concepto || ''}
                onChange={(v) =>
                  setTransferenciaForm({ ...transferenciaForm, concepto: v })
                }
                placeholder="Ej: Reposición de caja chica, fondeo de cuenta..."
              />

              {/* Vista previa visual */}
              {monto > 0 && cuentaOrigen && cuentaDestino && (
                <div className="bg-gradient-to-br from-sky-50 to-white border border-sky-200 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-wider text-sky-700 font-bold mb-3">
                    Vista previa
                  </div>
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-5">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Sale de</div>
                      <div className="text-base font-bold text-slate-800 truncate">{cuentaOrigen.nombre}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Saldo: {simbolo} {saldoOrigen.toFixed(2)} →{' '}
                        <span className={saldoOrigenPost < 0 ? 'text-red-600 font-semibold' : 'text-slate-700 font-semibold'}>
                          {simbolo} {saldoOrigenPost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <div className="w-9 h-9 rounded-full bg-sky-100 border-2 border-sky-300 flex items-center justify-center">
                        <ArrowLeftRight className="text-sky-700 w-4 h-4" />
                      </div>
                    </div>
                    <div className="col-span-5 text-right">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mb-1">Entra a</div>
                      <div className="text-base font-bold text-emerald-700 truncate">{cuentaDestino.nombre}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Saldo: {simbolo} {saldoDestino.toFixed(2)} →{' '}
                        <span className="text-emerald-700 font-semibold">
                          {simbolo} {saldoDestinoPost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-sky-200/60 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Monto</span>
                    <div className="text-2xl font-bold text-slate-900 tabular-nums">
                      {simbolo} {monto.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </FormModalV2>
        );
      })()}
    </>
  );
};
