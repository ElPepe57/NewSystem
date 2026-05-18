/**
 * AllocationEngineSettings · panel canon política de asignación overhead
 *
 * chk5.C9 (S3.6 M3 · Gastos Rework) · pixel-perfect contra mockup canon
 * `gastos-rework-v3-final.html · Sección 6 · Allocation Engine`.
 *
 * D-GR-7 · esta política es CÁLCULO RUNTIME (NO se persiste en BD de gastos).
 * Se persiste solo la PREFERENCIA del usuario (localStorage por ahora · futuro
 * Firestore en colección userPreferences/{uid}/gastos.allocationEngine).
 *
 * Cross-link a Cost Intelligence: los lentes A/B/C de rentabilidad por producto
 * leen esta política. Cambiar acá → cambian los lentes allá en tiempo real
 * (sin tocar datos transaccionales).
 */

import React, { useState, useEffect } from 'react';
import { Settings, BarChart3, ArrowRight, X as XIcon } from 'lucide-react';

export type AllocationMethod = 'unidades' | 'ingreso' | 'margen' | 'manual';
export type AllocationPeriod = 'realtime' | 'mes_anterior' | 'movil_3m';

export interface AllocationEngineConfig {
  metodo: AllocationMethod;
  periodo: AllocationPeriod;
}

const STORAGE_KEY = 'gastos.allocationEngine.config';
const DEFAULT_CONFIG: AllocationEngineConfig = {
  metodo: 'ingreso',       // D-GR-7 recomendado
  periodo: 'mes_anterior', // D-GR-7 recomendado
};

/** Lee la config persistida (localStorage) · fallback a defaults canon */
export const getAllocationConfig = (): AllocationEngineConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        metodo: parsed.metodo || DEFAULT_CONFIG.metodo,
        periodo: parsed.periodo || DEFAULT_CONFIG.periodo,
      };
    }
    return DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
};

/** Persiste la config a localStorage */
export const saveAllocationConfig = (config: AllocationEngineConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* localStorage puede estar lleno o deshabilitado · silencioso */
  }
};

interface AllocationEngineSettingsProps {
  /** Cerrar modal · sin guardar */
  onClose: () => void;
  /** Click "Ver impacto en productos" · navega a CI · Catálogo */
  onVerImpactoEnProductos: () => void;
  /** Total overhead del mes (Período · denominador) · solo lectura */
  overheadMesPEN: number;
  /** Ingreso base del período (calculado por método + período seleccionados) */
  ingresoBasePEN: number;
}

const METODO_OPTIONS: Array<{ value: AllocationMethod; label: string; descripcion: string; isRecommended?: boolean }> = [
  { value: 'unidades', label: 'Por unidades (simple)',          descripcion: 'overhead ÷ unidades vendidas · útil para SKUs homogéneos' },
  { value: 'ingreso',  label: 'Por ingreso (recomendado)',      descripcion: 'overhead × (ingreso producto / ingreso total) · canon D-GR-7', isRecommended: true },
  { value: 'margen',   label: 'Por margen contribución',        descripcion: 'pondera por margen · favorece productos rentables' },
  { value: 'manual',   label: 'Manual por SKU (power-user)',    descripcion: 'pesos manuales · requiere mantenimiento' },
];

const PERIODO_OPTIONS: Array<{ value: AllocationPeriod; label: string; descripcion: string; isRecommended?: boolean }> = [
  { value: 'realtime',     label: 'En tiempo real (mes actual)', descripcion: 'volátil · útil para forecasting' },
  { value: 'mes_anterior', label: 'Mes anterior cerrado',         descripcion: 'estable · canon D-GR-7', isRecommended: true },
  { value: 'movil_3m',     label: 'Promedio móvil 3 meses',      descripcion: 'suaviza estacionalidad' },
];

const formatPEN0 = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(n);

export const AllocationEngineSettings: React.FC<AllocationEngineSettingsProps> = ({
  onClose,
  onVerImpactoEnProductos,
  overheadMesPEN,
  ingresoBasePEN,
}) => {
  const [config, setConfig] = useState<AllocationEngineConfig>(getAllocationConfig);
  const [dirty, setDirty] = useState(false);

  // Recarga config desde storage si cambia externamente (multi-tab)
  useEffect(() => {
    setConfig(getAllocationConfig());
  }, []);

  const ratioPct = ingresoBasePEN > 0 ? (overheadMesPEN / ingresoBasePEN) * 100 : 0;

  const handleChange = <K extends keyof AllocationEngineConfig>(key: K, value: AllocationEngineConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleGuardar = () => {
    saveAllocationConfig(config);
    setDirty(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Allocation Engine</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Política de asignación overhead → costo de productos
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors"
            title="Cerrar"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="text-[11px] text-slate-500">
            Configura cómo se distribuye el overhead (gastos bloque <span className="font-bold text-amber-700">Período</span>)
            hacia el costo de productos · usado por <span className="text-teal-700 font-semibold">Cost Intelligence</span> y
            vistas de rentabilidad.{' '}
            <span className="font-bold">Cálculo runtime · NO persiste en BD · cambia tu lente sin tocar data.</span>
          </div>

          <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-4 h-4 text-slate-600" />
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Configuración activa</span>
              <span className="ml-auto text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded">
                Vista calculada · NO se persiste
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-[11px]">
              {/* Columna 1 · Método */}
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Método de asignación</div>
                <div className="space-y-1.5">
                  {METODO_OPTIONS.map((op) => (
                    <label key={op.value} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="metodo"
                        checked={config.metodo === op.value}
                        onChange={() => handleChange('metodo', op.value)}
                        className="mt-0.5 text-teal-600 focus:ring-teal-500"
                      />
                      <span>
                        <span className={config.metodo === op.value ? 'font-bold' : ''}>
                          {op.label}
                        </span>
                        {op.isRecommended && config.metodo === op.value && (
                          <span className="ml-1 text-[9px] text-teal-700">✓</span>
                        )}
                        <span className="block text-[10px] text-slate-500 italic">{op.descripcion}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Columna 2 · Período base */}
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Período base</div>
                <div className="space-y-1.5">
                  {PERIODO_OPTIONS.map((op) => (
                    <label key={op.value} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="periodo"
                        checked={config.periodo === op.value}
                        onChange={() => handleChange('periodo', op.value)}
                        className="mt-0.5 text-teal-600 focus:ring-teal-500"
                      />
                      <span>
                        <span className={config.periodo === op.value ? 'font-bold' : ''}>
                          {op.label}
                        </span>
                        {op.isRecommended && config.periodo === op.value && (
                          <span className="ml-1 text-[9px] text-teal-700">✓</span>
                        )}
                        <span className="block text-[10px] text-slate-500 italic">{op.descripcion}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Columna 3 · Estado actual (read-only) */}
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Estado actual</div>
                <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-[11px]">
                  <div className="text-slate-700">
                    <span className="font-bold">Ratio activo:</span>
                    <br />
                    <span className="font-bold tabular-nums text-emerald-700">
                      {formatPEN0(overheadMesPEN)} / {formatPEN0(ingresoBasePEN)} = {ratioPct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-1">del ingreso es overhead</div>
                </div>
                <button
                  type="button"
                  onClick={onVerImpactoEnProductos}
                  className="block w-full mt-3 text-[10px] text-teal-700 hover:text-teal-800 hover:underline text-center"
                >
                  <span className="inline-flex items-center gap-1 justify-center">
                    Ver impacto en productos
                    <ArrowRight className="w-3 h-3" />
                  </span>
                  <span className="block text-slate-400 font-normal">Cost Intelligence · Catálogo</span>
                </button>
              </div>
            </div>

            {/* Nota cross-link a lentes A/B/C */}
            <div className="mt-4 px-3 py-2 bg-white border border-slate-200 rounded text-[10px] text-slate-600 flex items-start gap-1.5">
              <BarChart3 className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
              <span>
                <span className="font-bold">¿Dónde se ven los lentes A/B/C?</span> Esta política alimenta los lentes de
                rentabilidad por producto que viven en{' '}
                <button
                  type="button"
                  onClick={onVerImpactoEnProductos}
                  className="text-teal-700 hover:underline"
                >
                  Cost Intelligence · Catálogo · drill-down producto
                </button>
                . Cambiar acá cambia los lentes allá en tiempo real.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-md px-3 py-1.5 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={!dirty}
            className={`text-[11px] font-bold text-white rounded-md px-4 py-1.5 ml-auto transition-colors ${
              dirty ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            {dirty ? 'Guardar política' : 'Sin cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};
