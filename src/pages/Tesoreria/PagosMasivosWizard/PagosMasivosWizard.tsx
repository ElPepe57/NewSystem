/**
 * PagosMasivosWizard — Imp-L3 · Pagos Masivos M5
 *
 * Wizard banking-grade de 4 pasos con sidebar persistente izquierdo
 * (steps) + sidebar persistente derecho (resumen del lote en construcción).
 *
 * Reutiliza los componentes existentes que ya hacen el trabajo pesado:
 *   - DocumentosPendientesTable (tabla de selección de documentos)
 *   - ConfigPagoPanel (configuración de pago: cuenta, método, TC, ref)
 *   - ProgresoEjecucion (modal de progreso para Paso 4)
 *
 * Autosave del borrador en localStorage para que el lote sobreviva refresh.
 *
 * Nota: el wizard se queda al lado del sub-tab "Historial" en TabPagosMasivos
 * para no perder funcionalidad de consulta de lotes pasados.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';
import { useAuthStore } from '../../../store/authStore';
import { usePagoMasivoStore } from '../../../store/pagoMasivoStore';
import { useTesoreriaStore } from '../../../store/tesoreriaStore';
import { DocumentosPendientesTable } from '../components/pagosMasivos/DocumentosPendientesTable';
import { ProgresoEjecucion } from '../components/pagosMasivos/ProgresoEjecucion';
import type { ConfigPagoMasivo } from '../../../types/pagoMasivo.types';
import type { MetodoPagoUnificado } from '../../../types/pago.types';
import { useConfirmDialog, ConfirmDialog } from '../../../components/common';
import { cn } from '../../../design-system/utils';
import { StepsSidebar, type WizardStepKey } from './StepsSidebar';
import { ResumenSidebar } from './ResumenSidebar';

// ═════════════════════════════════════════════════════════════════════════
// AUTOSAVE
// ═════════════════════════════════════════════════════════════════════════

const AUTOSAVE_KEY = 'pagosMasivos:wizard:borrador';

interface BorradorWizard {
  paso: WizardStepKey;
  tipo: 'egreso' | 'ingreso';
  configParcial: Partial<ConfigPagoMasivo>;
  ts: number;
}

function saveBorrador(b: BorradorWizard): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(b));
  } catch {
    // ignore
  }
}

function loadBorrador(): BorradorWizard | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BorradorWizard;
  } catch {
    return null;
  }
}

function clearBorrador(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const PagosMasivosWizard: React.FC = () => {
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

  const [paso, setPaso] = useState<WizardStepKey>('tipo');
  const [configParcial, setConfigParcial] = useState<Partial<ConfigPagoMasivo>>({});
  const [showProgreso, setShowProgreso] = useState(false);
  const [autosaveLoaded, setAutosaveLoaded] = useState(false);
  const confirm = useConfirmDialog();

  const itemsArray = useMemo(() => Array.from(seleccionados.values()), [seleccionados]);

  // ── Cargar pendientes al montar ──
  useEffect(() => {
    fetchPendientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cargar borrador al montar ──
  useEffect(() => {
    if (autosaveLoaded) return;
    const b = loadBorrador();
    if (b) {
      // Solo restaurar si es reciente (menos de 24 horas)
      if (Date.now() - b.ts < 24 * 60 * 60 * 1000) {
        setTipoLote(b.tipo);
        setConfigParcial(b.configParcial);
        // No restauramos el paso porque seleccionados se reseteó al cambiar tipo
      }
    }
    setAutosaveLoaded(true);
  }, [autosaveLoaded, setTipoLote]);

  // ── Autosave en cada cambio ──
  useEffect(() => {
    if (!autosaveLoaded) return;
    saveBorrador({
      paso,
      tipo: tipoLote,
      configParcial,
      ts: Date.now(),
    });
  }, [autosaveLoaded, paso, tipoLote, configParcial]);

  // ── Errores del store ──
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  // ── Pasos completados (derivados) ──
  const pasosCompletados = useMemo(() => {
    const set = new Set<WizardStepKey>();
    if (configParcial.cuentaId && configParcial.metodoPago && configParcial.tipoCambio) {
      set.add('tipo');
    }
    if (set.has('tipo') && itemsArray.length > 0) set.add('documentos');
    if (set.has('documentos') && paso === 'ejecucion') set.add('revision');
    return set;
  }, [configParcial, itemsArray.length, paso]);

  // ── Validación para avanzar ──
  const puedeAvanzar = useMemo(() => {
    if (paso === 'tipo') {
      return !!(
        configParcial.cuentaId &&
        configParcial.metodoPago &&
        configParcial.tipoCambio &&
        configParcial.tipoCambio > 0
      );
    }
    if (paso === 'documentos') return itemsArray.length > 0;
    if (paso === 'revision') return itemsArray.length > 0 && !!configParcial.cuentaId;
    return false;
  }, [paso, configParcial, itemsArray.length]);

  // ── Avanzar / Retroceder ──
  const handleAvanzar = () => {
    if (!puedeAvanzar) return;
    if (paso === 'tipo') setPaso('documentos');
    else if (paso === 'documentos') setPaso('revision');
    else if (paso === 'revision') handleEjecutar();
  };
  const handleRetroceder = () => {
    if (paso === 'documentos') setPaso('tipo');
    else if (paso === 'revision') setPaso('documentos');
    else if (paso === 'ejecucion') setPaso('revision');
  };

  // ── Ejecutar lote ──
  const handleEjecutar = async () => {
    if (!user?.uid) {
      toast.error('No se pudo identificar al usuario');
      return;
    }
    if (
      !configParcial.cuentaId ||
      !configParcial.cuentaNombre ||
      !configParcial.metodoPago ||
      !configParcial.monedaPago ||
      !configParcial.tipoCambio ||
      !configParcial.fechaPago
    ) {
      toast.error('Faltan datos en la configuración del lote');
      return;
    }
    const count = itemsArray.length;
    const ok = await confirm.confirm({
      title: 'Confirmar pago masivo',
      message: `Se procesarán ${count} pago${count !== 1 ? 's' : ''} desde la cuenta "${configParcial.cuentaNombre}". Esta acción no se puede deshacer automáticamente.`,
      confirmText: `Procesar ${count} pago${count !== 1 ? 's' : ''}`,
      variant: 'warning',
    });
    if (!ok) return;

    setPaso('ejecucion');
    setShowProgreso(true);

    const config: ConfigPagoMasivo = {
      monedaPago: configParcial.monedaPago,
      tipoCambio: configParcial.tipoCambio,
      metodoPago: configParcial.metodoPago,
      cuentaId: configParcial.cuentaId,
      cuentaNombre: configParcial.cuentaNombre,
      referencia: configParcial.referencia ?? '',
      notas: configParcial.notas ?? '',
      fechaPago: configParcial.fechaPago,
    };
    try {
      const lote = await ejecutarPagoMasivo(config, user.uid);
      if (lote.itemsConError === 0) {
        toast.success(`Lote ${lote.id} completado: ${lote.itemsExitosos} pagos exitosos`);
      } else {
        toast.warning(
          `Lote ${lote.id}: ${lote.itemsExitosos} exitosos, ${lote.itemsConError} con error`,
        );
      }
      clearBorrador();
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar el lote');
    }
  };

  const handleCerrarProgreso = () => {
    setShowProgreso(false);
    resetSeleccion();
    resetEjecucion();
    setConfigParcial({});
    setPaso('tipo');
    fetchPendientes();
  };

  // Tipo selector (Paso 1)
  const handleSelectTipo = (t: 'egreso' | 'ingreso') => {
    setTipoLote(t);
    // Reset config al cambiar tipo
    setConfigParcial((prev) => ({ ...prev }));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex flex-col lg:flex-row min-h-[600px]">
        {/* Sidebar izquierdo · Pasos */}
        <StepsSidebar
          pasoActual={paso}
          pasosCompletados={pasosCompletados}
          onClickPaso={(key) => {
            if (key !== 'ejecucion') setPaso(key);
          }}
        />

        {/* Contenido principal */}
        <div className="flex-1 min-w-0 p-5 sm:p-6">
          {/* PASO 1 · Tipo + Cuenta */}
          {paso === 'tipo' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Tipo de operación</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Selecciona si el lote es de egresos (pagos) o ingresos (cobros).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Egreso */}
                <button
                  type="button"
                  onClick={() => handleSelectTipo('egreso')}
                  className={cn(
                    'border-2 rounded-xl p-5 text-left transition-all duration-200',
                    'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]',
                    tipoLote === 'egreso'
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        tipoLote === 'egreso' ? 'bg-red-100' : 'bg-slate-100',
                      )}
                    >
                      <ArrowUpCircle
                        className={cn(
                          'w-5 h-5',
                          tipoLote === 'egreso' ? 'text-red-600' : 'text-slate-500',
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        tipoLote === 'egreso' ? 'text-red-800' : 'text-slate-700',
                      )}
                    >
                      Egreso · Pagos
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Pagar OCs, gastos o servicios desde una cuenta del negocio.
                  </p>
                </button>

                {/* Ingreso */}
                <button
                  type="button"
                  onClick={() => handleSelectTipo('ingreso')}
                  className={cn(
                    'border-2 rounded-xl p-5 text-left transition-all duration-200',
                    'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]',
                    tipoLote === 'ingreso'
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        tipoLote === 'ingreso' ? 'bg-emerald-100' : 'bg-slate-100',
                      )}
                    >
                      <ArrowDownCircle
                        className={cn(
                          'w-5 h-5',
                          tipoLote === 'ingreso' ? 'text-emerald-600' : 'text-slate-500',
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        tipoLote === 'ingreso' ? 'text-emerald-800' : 'text-slate-700',
                      )}
                    >
                      Ingreso · Cobros
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Cobrar ventas pendientes a una cuenta del negocio.
                  </p>
                </button>
              </div>

              {/* Config de pago · inputs inline (Paso 1 del wizard) */}
              <ConfigPasoInline config={configParcial} setConfig={setConfigParcial} />
            </div>
          )}

          {/* PASO 2 · Documentos */}
          {paso === 'documentos' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Documentos a {tipoLote === 'egreso' ? 'pagar' : 'cobrar'}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Selecciona los documentos del lote. El monto a pagar es editable
                  para permitir pagos parciales.
                </p>
              </div>
              <DocumentosPendientesTable />
              {itemsArray.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-amber-800">
                    Selecciona al menos un documento para continuar.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* PASO 3 · Revisión */}
          {paso === 'revision' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Revisión final del lote
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Verifica los datos antes de ejecutar. Esta acción no se puede
                  deshacer automáticamente.
                </p>
              </div>

              {/* Resumen consolidado */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Configuración del lote
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Tipo:</span>
                    <span className="ml-2 font-medium text-slate-900">
                      {tipoLote === 'egreso' ? 'Egreso · Pagos' : 'Ingreso · Cobros'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Cuenta:</span>
                    <span className="ml-2 font-medium text-slate-900 truncate">
                      {configParcial.cuentaNombre}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Método:</span>
                    <span className="ml-2 font-medium text-slate-900">
                      {configParcial.metodoPago}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Moneda:</span>
                    <span className="ml-2 font-medium text-slate-900">
                      {configParcial.monedaPago}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">TC:</span>
                    <span className="ml-2 font-medium text-slate-900 tabular-nums">
                      S/ {configParcial.tipoCambio?.toFixed(3)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Fecha:</span>
                    <span className="ml-2 font-medium text-slate-900">
                      {configParcial.fechaPago}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items que se van a procesar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Documentos · {itemsArray.length}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {itemsArray.map((it) => (
                    <div
                      key={it.documentoId}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          {it.numeroDocumento}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {it.contraparteNombre}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="font-semibold text-slate-900 tabular-nums">
                          {it.monedaDocumento === 'USD' ? 'US$' : 'S/'}{' '}
                          {it.montoPagar.toLocaleString('es-PE', {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PASO 4 · Ejecución */}
          {paso === 'ejecucion' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Ejecutando lote
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Los pagos se procesan secuencialmente. No cierres esta ventana
                  hasta que termine.
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-8 text-center">
                <div className="inline-block animate-spin w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full mb-3" />
                <p className="text-sm text-slate-600">
                  Procesando {itemsArray.length} pagos...
                </p>
              </div>
            </div>
          )}

          {/* Footer · Navegación */}
          {paso !== 'ejecucion' && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleRetroceder}
                disabled={paso === 'tipo'}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Atrás
              </button>
              <button
                type="button"
                onClick={handleAvanzar}
                disabled={!puedeAvanzar || ejecutando}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm',
                  paso === 'revision'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-teal-600 hover:bg-teal-700 text-white',
                  (!puedeAvanzar || ejecutando) && 'opacity-50 cursor-not-allowed',
                )}
              >
                {paso === 'revision' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Ejecutar lote
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar derecho · Resumen */}
        <ResumenSidebar tipo={tipoLote} config={configParcial} items={itemsArray} />
      </div>

      {/* Modal de progreso (legacy reusado) */}
      <ProgresoEjecucion open={showProgreso} onClose={handleCerrarProgreso} />

      {/* ConfirmDialog */}
      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// CONFIG PASO INLINE · inputs del Paso 1
// ═════════════════════════════════════════════════════════════════════════

const METODOS: Array<{ value: MetodoPagoUnificado; label: string; moneda: 'PEN' | 'USD' | 'AMBAS' }> = [
  { value: 'efectivo', label: 'Efectivo', moneda: 'AMBAS' },
  { value: 'transferencia', label: 'Transferencia', moneda: 'AMBAS' },
  { value: 'yape', label: 'Yape', moneda: 'PEN' },
  { value: 'plin', label: 'Plin', moneda: 'PEN' },
  { value: 'tarjeta_debito', label: 'Tarjeta débito', moneda: 'AMBAS' },
  { value: 'tarjeta_credito', label: 'Tarjeta crédito', moneda: 'AMBAS' },
  { value: 'mercado_pago', label: 'Mercado Pago', moneda: 'AMBAS' },
  { value: 'paypal', label: 'PayPal', moneda: 'USD' },
  { value: 'zelle', label: 'Zelle', moneda: 'USD' },
];

const ConfigPasoInline: React.FC<{
  config: Partial<ConfigPagoMasivo>;
  setConfig: React.Dispatch<React.SetStateAction<Partial<ConfigPagoMasivo>>>;
}> = ({ config, setConfig }) => {
  const cuentas = useTesoreriaStore((s) => s.cuentas);

  const cuentasFiltradas = useMemo(() => {
    if (!config.monedaPago) return cuentas;
    return cuentas.filter(
      (c) => c.activa && (c.esBiMoneda || c.moneda === config.monedaPago),
    );
  }, [cuentas, config.monedaPago]);

  // Inicializar fecha si no la tiene
  useEffect(() => {
    if (!config.fechaPago) {
      setConfig((prev) => ({
        ...prev,
        fechaPago: new Date().toISOString().slice(0, 10),
      }));
    }
    if (!config.tipoCambio) {
      setConfig((prev) => ({ ...prev, tipoCambio: 3.85 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCuentaChange = (id: string) => {
    const cuenta = cuentas.find((c) => c.id === id);
    setConfig((prev) => ({
      ...prev,
      cuentaId: id,
      cuentaNombre: cuenta?.nombre ?? '',
    }));
  };

  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">
        Cuenta y configuración del pago
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Moneda */}
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Moneda <span className="text-red-500">*</span>
          </label>
          <select
            value={config.monedaPago ?? ''}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                monedaPago: e.target.value as 'PEN' | 'USD',
              }))
            }
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          >
            <option value="">— Seleccionar —</option>
            <option value="PEN">PEN</option>
            <option value="USD">USD</option>
          </select>
        </div>

        {/* Tipo de cambio */}
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Tipo de cambio <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={config.tipoCambio ?? ''}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                tipoCambio: parseFloat(e.target.value) || 0,
              }))
            }
            placeholder="3.85"
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 tabular-nums"
          />
        </div>

        {/* Método de pago */}
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Método <span className="text-red-500">*</span>
          </label>
          <select
            value={config.metodoPago ?? ''}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                metodoPago: e.target.value as MetodoPagoUnificado,
              }))
            }
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          >
            <option value="">— Seleccionar —</option>
            {METODOS.filter(
              (m) =>
                !config.monedaPago ||
                m.moneda === 'AMBAS' ||
                m.moneda === config.monedaPago,
            ).map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Cuenta */}
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Cuenta <span className="text-red-500">*</span>
          </label>
          <select
            value={config.cuentaId ?? ''}
            onChange={(e) => handleCuentaChange(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          >
            <option value="">— Seleccionar —</option>
            {cuentasFiltradas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.moneda}
                {c.esBiMoneda ? ' bi-moneda' : ''})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Fecha pago */}
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Fecha de pago
          </label>
          <input
            type="date"
            value={config.fechaPago ?? ''}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, fechaPago: e.target.value }))
            }
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {/* Referencia */}
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Referencia (opcional)
          </label>
          <input
            type="text"
            value={config.referencia ?? ''}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, referencia: e.target.value }))
            }
            placeholder="ej: Operación 12345"
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="block text-[11px] font-medium text-slate-600 mb-1">
          Notas (opcional)
        </label>
        <textarea
          value={config.notas ?? ''}
          onChange={(e) =>
            setConfig((prev) => ({ ...prev, notas: e.target.value }))
          }
          rows={2}
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          placeholder="Detalle del lote..."
        />
      </div>
    </div>
  );
};
