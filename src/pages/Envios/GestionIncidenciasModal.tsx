/**
 * GestionIncidenciasModal — S40 Bloque C
 *
 * Reemplaza al antiguo `GestionDanadasModal`. Ahora cubre TRES tipos de incidencias
 * del envío en un solo panel con tabs:
 *
 *  - DAÑADAS: dispoción baja_definitiva / devolucion_proveedor / reparacion_reingreso
 *  - PERDIDAS: opción "Crear reclamo" o "Registrar pérdida directa"
 *  - ADUANA: abre LiberarAduanaModal o permite descartar como pérdida
 *
 * Fixes incorporados (bugs pre-existentes del GestionDanadasModal):
 *  - DATA-001: el costo se lee del doc Unidad (ctruDinamico) vía fallback en el service
 *  - EDGE-002: procesarBajasLote usa Promise.allSettled
 *  - DATA-003/004/005: gasto generado via gastoService.create (categoría GV válida)
 */
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Trash2,
  RotateCcw,
  Wrench,
  CheckCircle,
  Image,
  Package,
  ShieldAlert,
  Gavel,
  XCircle,
} from 'lucide-react';
import { Modal, Button, Badge } from '../../components/common';
import { bajaInventarioService } from '../../services/bajaInventario.service';
import type { BajaDanoData } from '../../services/bajaInventario.service';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import type {
  Envio,
  IncidenciaEnvio,
  DisposicionDanada,
  ResponsableDano,
} from '../../types/envio.types';
import type { Producto } from '../../types/producto.types';
import { ReclamoPanel } from '../../components/modules/envio/ReclamoPanel';
import { LiberarAduanaModal } from './LiberarAduanaModal';
import { useReclamoStore } from '../../store/reclamoStore';

interface GestionIncidenciasModalProps {
  transferencia: Envio;
  productosMap: Map<string, Producto>;
  onClose: () => void;
  onSuccess: () => void;
  /** Tab inicial. Default: el primero con incidencias. */
  initialTab?: TabKey;
}

type TabKey = 'danadas' | 'perdidas' | 'aduana';

const OPCIONES_DISPOSICION: {
  value: DisposicionDanada;
  label: string;
  descripcion: string;
  icon: React.ElementType;
  color: 'red' | 'amber' | 'green';
}[] = [
  {
    value: 'baja_definitiva',
    label: 'Baja definitiva',
    descripcion: 'Destruir/descartar. Genera gasto contable automático (cuenta 6952).',
    icon: Trash2,
    color: 'red',
  },
  {
    value: 'devolucion_proveedor',
    label: 'Devolución / Reclamo',
    descripcion: 'Tras procesar se abre panel de reclamo al proveedor o courier.',
    icon: RotateCcw,
    color: 'amber',
  },
  {
    value: 'reparacion_reingreso',
    label: 'Reparar y reingresar',
    descripcion: 'Limpieza/relabelado. Vuelve a stock disponible. Sin gasto contable.',
    icon: Wrench,
    color: 'green',
  },
];

const OPCIONES_RESPONSABLE: { value: ResponsableDano; label: string }[] = [
  { value: 'viajero', label: 'Viajero / Courier' },
  { value: 'proveedor', label: 'Proveedor' },
  { value: 'sin_responsable', label: 'Sin responsable' },
];

interface DecisionUnidad {
  disposicion?: DisposicionDanada;
  responsable: ResponsableDano;
  motivo: string;
}

export const GestionIncidenciasModal: React.FC<GestionIncidenciasModalProps> = ({
  transferencia,
  productosMap,
  onClose,
  onSuccess,
  initialTab,
}) => {
  const toast = useToastStore();
  const { user } = useAuthStore();

  // ─── Clasificación de incidencias por tab ───────────────────────────────

  const incidencias = useMemo(() => transferencia.incidencias || [], [transferencia]);

  const incidenciasDanadas = useMemo(
    () => incidencias.filter(i => i.tipo === 'danada' && !i.resuelta),
    [incidencias]
  );
  const incidenciasPerdidas = useMemo(
    () => incidencias.filter(i => i.tipo === 'faltante' && !i.resuelta && (i.descripcion || '').toLowerCase().includes('perdida')),
    [incidencias]
  );
  const incidenciasAduana = useMemo(
    // S40: detección simplificada — post-cleanup todas las incidencias aduana usan tipo='aduana'
    () => incidencias.filter(i => !i.resuelta && i.tipo === 'aduana'),
    [incidencias]
  );

  const defaultTab: TabKey = initialTab
    || (incidenciasDanadas.length > 0 ? 'danadas'
    : incidenciasPerdidas.length > 0 ? 'perdidas'
    : incidenciasAduana.length > 0 ? 'aduana'
    : 'danadas');

  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

  // ─── Estado tab DAÑADAS ─────────────────────────────────────────────────

  const [decisiones, setDecisiones] = useState<Record<string, DecisionUnidad>>(() => {
    const init: Record<string, DecisionUnidad> = {};
    incidenciasDanadas.forEach(inc => {
      init[inc.id] = { responsable: 'sin_responsable', motivo: '' };
    });
    return init;
  });

  const [submitting, setSubmitting] = useState(false);
  const [showConfirmacion, setShowConfirmacion] = useState(false);

  // ─── Estado tab PERDIDAS ────────────────────────────────────────────────

  const [selectedPerdidas, setSelectedPerdidas] = useState<Record<string, boolean>>({});
  const [showReclamoPanel, setShowReclamoPanel] = useState(false);
  const [incidenciasParaReclamo, setIncidenciasParaReclamo] = useState<IncidenciaEnvio[]>([]);

  // ─── Estado tab ADUANA ──────────────────────────────────────────────────

  const [showLiberarAduana, setShowLiberarAduana] = useState(false);
  const [liberandoAduana, setLiberandoAduana] = useState(false);

  // ─── Helpers ────────────────────────────────────────────────────────────

  const getUnidadInfo = (inc: IncidenciaEnvio) => {
    const unidad = (transferencia.unidades ?? []).find(u => u.unidadId === inc.unidadId);
    const producto = productosMap.get(inc.productoId || unidad?.productoId || '');
    return { unidad, producto };
  };

  const updateDecision = (incId: string, field: keyof DecisionUnidad, value: any) => {
    setDecisiones(prev => ({
      ...prev,
      [incId]: { ...prev[incId], [field]: value },
    }));
  };

  const resueltasDanadas = incidenciasDanadas.filter(inc => decisiones[inc.id]?.disposicion).length;
  const todasDecididas = resueltasDanadas === incidenciasDanadas.length;

  // ─── Handler: confirmar bajas DAÑADAS ───────────────────────────────────

  const handleConfirmarBajas = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      const bajas: BajaDanoData[] = incidenciasDanadas.map(inc => {
        const decision = decisiones[inc.id];
        const { unidad, producto } = getUnidadInfo(inc);
        return {
          unidadId: inc.unidadId || unidad?.unidadId || '',
          envioId: transferencia.id,
          incidenciaId: inc.id,
          productoId: inc.productoId || unidad?.productoId || '',
          productoNombre: producto?.nombreComercial || inc.productoNombre || inc.sku || '',
          sku: inc.sku || unidad?.sku || '',
          disposicion: decision.disposicion!,
          motivo: decision.motivo || 'Sin motivo adicional',
          responsable: decision.responsable,
          costoUnidadPEN: 0,  // S40: el service usa ctruDinamico del doc Unidad como fallback
          costoUnidadUSD: 0,
          evidenciaURL: inc.evidenciaURL,
        };
      });

      const resultados = await bajaInventarioService.procesarBajasLote(bajas, user.uid);

      const errores = resultados.filter(r => 'error' in r && r.error);
      const gastosGenerados = resultados.filter(r => r.gastoGenerado).length;
      const reclamosGenerados = resultados.filter(r => r.reclamoGenerado).length;

      // Si hubo incidencias marcadas como devolucion_proveedor con responsable específico,
      // abrir panel de reclamo con ESAS incidencias preseleccionadas.
      const incDevoluciones = incidenciasDanadas.filter(inc =>
        decisiones[inc.id]?.disposicion === 'devolucion_proveedor'
        && decisiones[inc.id]?.responsable !== 'sin_responsable'
      );

      if (errores.length > 0) {
        toast.error(`${errores.length} baja(s) fallaron · ${resultados.length - errores.length} procesadas`);
      } else {
        let msg = `${resultados.length} unidad(es) procesadas`;
        if (gastosGenerados > 0) msg += ` · ${gastosGenerados} gasto(s)`;
        if (reclamosGenerados > 0) msg += ` · ${reclamosGenerados} reclamo(s) sugerido(s)`;
        toast.success(msg);
      }

      if (incDevoluciones.length > 0) {
        // Pre-seleccionar incidencias y abrir panel para crear reclamo
        setIncidenciasParaReclamo(incDevoluciones);
        setShowReclamoPanel(true);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      toast.error(`Error procesando bajas: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Handler: abrir reclamo desde tab PERDIDAS ──────────────────────────

  const handleAbrirReclamoPerdidas = () => {
    const seleccionadas = incidenciasPerdidas.filter(inc => selectedPerdidas[inc.id]);
    if (seleccionadas.length === 0) {
      toast.error('Selecciona al menos una unidad perdida');
      return;
    }
    setIncidenciasParaReclamo(seleccionadas);
    setShowReclamoPanel(true);
  };

  // ─── Handler: descartar perdidas como gasto directo (sin reclamo) ────────

  const handleDescartarPerdidas = async () => {
    if (!user) return;
    const seleccionadas = incidenciasPerdidas.filter(inc => selectedPerdidas[inc.id]);
    if (seleccionadas.length === 0) {
      toast.error('Selecciona al menos una unidad perdida');
      return;
    }
    setSubmitting(true);
    try {
      const bajas: BajaDanoData[] = seleccionadas.map(inc => {
        const { unidad, producto } = getUnidadInfo(inc);
        return {
          unidadId: inc.unidadId || unidad?.unidadId || '',
          envioId: transferencia.id,
          incidenciaId: inc.id,
          productoId: inc.productoId || unidad?.productoId || '',
          productoNombre: producto?.nombreComercial || inc.productoNombre || inc.sku || '',
          sku: inc.sku || unidad?.sku || '',
          disposicion: 'baja_definitiva' as DisposicionDanada,
          motivo: 'Pérdida en tránsito — descartada sin reclamo',
          responsable: 'sin_responsable' as ResponsableDano,
          costoUnidadPEN: 0,  // Service leerá ctruDinamico
          costoUnidadUSD: 0,
        };
      });
      const resultados = await bajaInventarioService.procesarBajasLote(bajas, user.uid);
      const errores = resultados.filter(r => 'error' in r && r.error);
      const gastos = resultados.filter(r => r.gastoGenerado).length;
      if (errores.length > 0) {
        toast.error(`${errores.length} falló · ${resultados.length - errores.length} gastos registrados`);
      } else {
        toast.success(`${resultados.length} pérdida(s) descartadas · ${gastos} gasto(s) merma registrados`);
      }
      onSuccess();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Handler: liberar aduana ────────────────────────────────────────────

  const handleLiberarAduana = async (data: {
    unidadIds: string[];
    gastosLiberacionPEN: number;
    documentoLiberacion?: string;
    descripcion?: string;
  }) => {
    if (!user) return;
    setLiberandoAduana(true);
    try {
      const { envioRecepcionService } = await import('../../services/envio.recepcion.service');
      await envioRecepcionService.liberarUnidadesAduana(
        transferencia.id,
        data.unidadIds,
        data.gastosLiberacionPEN,
        user.uid,
        data.documentoLiberacion,
        data.descripcion,
      );
      toast.success(`${data.unidadIds.length} unidad(es) liberadas`);
      setShowLiberarAduana(false);
      onSuccess();
    } catch (err: any) {
      toast.error(`Error liberando aduana: ${err.message}`);
    } finally {
      setLiberandoAduana(false);
    }
  };

  // ─── Si no hay incidencias ──────────────────────────────────────────────

  const totalIncidencias = incidenciasDanadas.length + incidenciasPerdidas.length + incidenciasAduana.length;

  if (totalIncidencias === 0) {
    return (
      <Modal isOpen onClose={onClose} title="Incidencias del envío" size="md">
        <div className="text-center py-8 text-slate-500">
          <CheckCircle className="h-12 w-12 mx-auto text-emerald-400 mb-3" />
          <p className="font-medium">Sin incidencias pendientes</p>
          <p className="text-sm mt-1">Todas las incidencias del envío están resueltas.</p>
        </div>
        <div className="flex justify-end pt-3 border-t">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </Modal>
    );
  }

  // ─── Render principal ───────────────────────────────────────────────────

  // Si está abierto el panel de reclamo, mostrar SOLO ese panel (overlay)
  if (showReclamoPanel && user) {
    return (
      <ReclamoPanel
        envio={transferencia}
        incidenciasSugeridas={incidenciasParaReclamo}
        userId={user.uid}
        onClose={() => {
          setShowReclamoPanel(false);
          setIncidenciasParaReclamo([]);
        }}
        onSuccess={() => {
          setShowReclamoPanel(false);
          setIncidenciasParaReclamo([]);
          onSuccess();
        }}
      />
    );
  }

  if (showLiberarAduana && !liberandoAduana) {
    return (
      <LiberarAduanaModal
        envio={transferencia}
        productosMap={productosMap}
        onClose={() => setShowLiberarAduana(false)}
        onConfirm={handleLiberarAduana}
      />
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Incidencias — ${transferencia.numeroEnvio}`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          <TabButton
            active={activeTab === 'danadas'}
            onClick={() => setActiveTab('danadas')}
            icon={AlertTriangle}
            label="Dañadas"
            count={incidenciasDanadas.length}
            color="amber"
          />
          <TabButton
            active={activeTab === 'perdidas'}
            onClick={() => setActiveTab('perdidas')}
            icon={XCircle}
            label="Perdidas"
            count={incidenciasPerdidas.length}
            color="red"
          />
          <TabButton
            active={activeTab === 'aduana'}
            onClick={() => setActiveTab('aduana')}
            icon={ShieldAlert}
            label="Aduana"
            count={incidenciasAduana.length}
            color="orange"
          />
        </div>

        {/* Tab Dañadas */}
        {activeTab === 'danadas' && (
          <DanadasTabContent
            incidencias={incidenciasDanadas}
            decisiones={decisiones}
            updateDecision={updateDecision}
            getUnidadInfo={getUnidadInfo}
            resueltas={resueltasDanadas}
            todasDecididas={todasDecididas}
            showConfirmacion={showConfirmacion}
            setShowConfirmacion={setShowConfirmacion}
            submitting={submitting}
            onCancel={onClose}
            onConfirm={handleConfirmarBajas}
          />
        )}

        {/* Tab Perdidas */}
        {activeTab === 'perdidas' && (
          <PerdidasTabContent
            incidencias={incidenciasPerdidas}
            selected={selectedPerdidas}
            setSelected={setSelectedPerdidas}
            getUnidadInfo={getUnidadInfo}
            submitting={submitting}
            onAbrirReclamo={handleAbrirReclamoPerdidas}
            onDescartar={handleDescartarPerdidas}
            onCancel={onClose}
          />
        )}

        {/* Tab Aduana */}
        {activeTab === 'aduana' && (
          <AduanaTabContent
            incidencias={incidenciasAduana}
            onAbrirLiberar={() => setShowLiberarAduana(true)}
            onCancel={onClose}
          />
        )}
      </div>
    </Modal>
  );
};

// ─── Sub-componentes ──────────────────────────────────────────────────────

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count: number;
  color: 'amber' | 'red' | 'orange';
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon: Icon, label, count, color }) => {
  const colorClass = color === 'amber' ? 'text-amber-700 bg-amber-100'
    : color === 'red' ? 'text-red-700 bg-red-100'
    : 'text-orange-700 bg-orange-100';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {count > 0 && (
        <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${colorClass}`}>
          {count}
        </span>
      )}
    </button>
  );
};

// ─── Tab Dañadas content ──────────────────────────────────────────────────

interface DanadasTabContentProps {
  incidencias: IncidenciaEnvio[];
  decisiones: Record<string, DecisionUnidad>;
  updateDecision: (incId: string, field: keyof DecisionUnidad, value: any) => void;
  getUnidadInfo: (inc: IncidenciaEnvio) => { unidad?: any; producto?: Producto };
  resueltas: number;
  todasDecididas: boolean;
  showConfirmacion: boolean;
  setShowConfirmacion: (v: boolean) => void;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const DanadasTabContent: React.FC<DanadasTabContentProps> = ({
  incidencias, decisiones, updateDecision, getUnidadInfo,
  resueltas, todasDecididas, showConfirmacion, setShowConfirmacion,
  submitting, onCancel, onConfirm,
}) => {
  if (incidencias.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <CheckCircle className="h-10 w-10 mx-auto text-emerald-400 mb-2" />
        <p className="text-sm">Sin unidades dañadas pendientes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="font-medium text-amber-800">
              {incidencias.length} unidad{incidencias.length !== 1 ? 'es' : ''} dañada{incidencias.length !== 1 ? 's' : ''}
            </span>
          </div>
          <Badge variant={todasDecididas ? 'success' : 'warning'}>
            {resueltas}/{incidencias.length} decididas
          </Badge>
        </div>
        <div className="w-full bg-amber-200 rounded-full h-1.5 mt-2">
          <div
            className="bg-amber-600 h-1.5 rounded-full transition-all"
            style={{ width: `${(resueltas / incidencias.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
        {incidencias.map(inc => {
          const { producto } = getUnidadInfo(inc);
          const decision = decisiones[inc.id];
          const isDecided = !!decision?.disposicion;

          return (
            <div
              key={inc.id}
              className={`border rounded-lg overflow-hidden ${
                isDecided ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="p-3 bg-slate-50 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">
                        {producto?.marca} — {producto?.nombreComercial || inc.productoNombre}
                      </p>
                      <p className="text-xs text-slate-500">{inc.sku}</p>
                    </div>
                  </div>
                  {inc.evidenciaURL && (
                    <a
                      href={inc.evidenciaURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 flex-shrink-0"
                    >
                      <Image className="h-3.5 w-3.5" />
                      Evidencia
                    </a>
                  )}
                </div>
                {inc.descripcion && (
                  <p className="text-xs text-slate-600 mt-1 italic">"{inc.descripcion}"</p>
                )}
              </div>

              <div className="p-3 space-y-3">
                <div className="space-y-2">
                  {OPCIONES_DISPOSICION.map(op => {
                    const isSelected = decision?.disposicion === op.value;
                    const Icon = op.icon;
                    const selectedBg = op.color === 'red' ? 'bg-red-50 border-red-200'
                      : op.color === 'amber' ? 'bg-amber-50 border-amber-200'
                      : 'bg-emerald-50 border-emerald-200';
                    const iconColor = op.color === 'red' ? 'text-red-600'
                      : op.color === 'amber' ? 'text-amber-600'
                      : 'text-emerald-600';
                    return (
                      <label
                        key={op.value}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                          isSelected ? selectedBg : 'border-transparent hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`disposicion-${inc.id}`}
                          value={op.value}
                          checked={isSelected}
                          onChange={() => updateDecision(inc.id, 'disposicion', op.value)}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <Icon className={`h-4 w-4 flex-shrink-0 ${isSelected ? iconColor : 'text-slate-400'}`} />
                        <div>
                          <span className="text-sm font-medium text-slate-900">{op.label}</span>
                          <span className="block text-xs text-slate-500">{op.descripcion}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {decision?.disposicion === 'devolucion_proveedor' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Responsable</label>
                    <select
                      value={decision.responsable}
                      onChange={e => updateDecision(inc.id, 'responsable', e.target.value)}
                      className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-amber-400"
                    >
                      {OPCIONES_RESPONSABLE.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    {decision.responsable !== 'sin_responsable' && (
                      <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                        <Gavel className="h-3 w-3" />
                        Se abrirá panel de reclamo al confirmar.
                      </p>
                    )}
                  </div>
                )}

                {decision?.disposicion && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Motivo (opcional)</label>
                    <input
                      type="text"
                      value={decision.motivo}
                      onChange={e => updateDecision(inc.id, 'motivo', e.target.value)}
                      placeholder="Ej: Tapa rota durante el vuelo"
                      className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmación */}
      {showConfirmacion && todasDecididas && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-sm font-medium text-slate-900 mb-2">Se ejecutarán las siguientes acciones:</p>
          <ul className="space-y-1.5 text-xs text-slate-700">
            {incidencias.map(inc => {
              const decision = decisiones[inc.id];
              const opcion = OPCIONES_DISPOSICION.find(o => o.value === decision?.disposicion);
              return (
                <li key={inc.id} className="flex items-center gap-2">
                  <span className="font-mono text-slate-500">{inc.sku}</span>
                  <span>→</span>
                  <span className="font-medium">{opcion?.label}</span>
                  {decision?.disposicion === 'devolucion_proveedor' && decision.responsable !== 'sin_responsable' && (
                    <Badge variant="warning" size="sm">+reclamo</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-between pt-3 border-t">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>Cancelar</Button>
        <div className="flex gap-2">
          {!showConfirmacion ? (
            <Button
              variant="primary"
              onClick={() => setShowConfirmacion(true)}
              disabled={!todasDecididas || submitting}
            >
              Revisar y confirmar ({resueltas}/{incidencias.length})
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setShowConfirmacion(false)} disabled={submitting}>
                Atrás
              </Button>
              <Button variant="primary" onClick={onConfirm} disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Procesando...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar todo
                  </span>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Tab Perdidas content ─────────────────────────────────────────────────

interface PerdidasTabContentProps {
  incidencias: IncidenciaEnvio[];
  selected: Record<string, boolean>;
  setSelected: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  getUnidadInfo: (inc: IncidenciaEnvio) => { unidad?: any; producto?: Producto };
  submitting: boolean;
  onAbrirReclamo: () => void;
  onDescartar: () => void;
  onCancel: () => void;
}

const PerdidasTabContent: React.FC<PerdidasTabContentProps> = ({
  incidencias, selected, setSelected, getUnidadInfo,
  submitting, onAbrirReclamo, onDescartar, onCancel,
}) => {
  const cantSeleccionadas = Object.values(selected).filter(Boolean).length;

  // Pre-seleccionar todas al entrar si no hay selección
  React.useEffect(() => {
    if (Object.keys(selected).length === 0 && incidencias.length > 0) {
      const init: Record<string, boolean> = {};
      incidencias.forEach(inc => { init[inc.id] = true; });
      setSelected(init);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (incidencias.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <CheckCircle className="h-10 w-10 mx-auto text-emerald-400 mb-2" />
        <p className="text-sm">Sin unidades perdidas pendientes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-red-900">
              {incidencias.length} unidad{incidencias.length !== 1 ? 'es' : ''} perdida{incidencias.length !== 1 ? 's' : ''} en tránsito
            </div>
            <div className="text-xs text-red-700 mt-0.5">
              Decide: <strong>Crear reclamo</strong> al courier/proveedor (recupera valor) o <strong>Descartar</strong> directo como merma.
            </div>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1 border border-slate-200 rounded-lg p-2">
        {incidencias.map(inc => {
          const { unidad, producto } = getUnidadInfo(inc);
          const checked = !!selected[inc.id];
          return (
            <label
              key={inc.id}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-slate-50 ${checked ? 'bg-red-50/50' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={e => setSelected(prev => ({ ...prev, [inc.id]: e.target.checked }))}
                className="h-4 w-4 text-red-600 rounded"
              />
              <Package className="h-4 w-4 text-slate-400" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {producto?.marca} — {producto?.nombreComercial || inc.productoNombre}
                </div>
                <div className="text-xs text-slate-500">
                  {unidad?.codigoUnidad || inc.unidadId?.slice(0, 8)} · {inc.sku}
                </div>
              </div>
              <div className="text-xs text-red-700">
                {inc.fechaRegistro.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
              </div>
            </label>
          );
        })}
      </div>

      {/* Botones */}
      <div className="flex items-center justify-between pt-3 border-t">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>Cancelar</Button>
        <div className="flex gap-2">
          <Button
            variant="danger"
            onClick={onDescartar}
            disabled={submitting || cantSeleccionadas === 0}
          >
            {submitting ? 'Procesando...' : `Descartar como merma (${cantSeleccionadas})`}
          </Button>
          <Button
            variant="primary"
            onClick={onAbrirReclamo}
            disabled={submitting || cantSeleccionadas === 0}
          >
            <Gavel className="w-4 h-4 mr-1.5" />
            Crear reclamo ({cantSeleccionadas})
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Tab Aduana content ───────────────────────────────────────────────────

interface AduanaTabContentProps {
  incidencias: IncidenciaEnvio[];
  onAbrirLiberar: () => void;
  onCancel: () => void;
}

const AduanaTabContent: React.FC<AduanaTabContentProps> = ({ incidencias, onAbrirLiberar, onCancel }) => {
  if (incidencias.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <CheckCircle className="h-10 w-10 mx-auto text-emerald-400 mb-2" />
        <p className="text-sm">Sin unidades retenidas en aduana.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-orange-900">
              {incidencias.length} unidad{incidencias.length !== 1 ? 'es' : ''} retenida{incidencias.length !== 1 ? 's' : ''} en aduana
            </div>
            <div className="text-xs text-orange-700 mt-0.5">
              Abre el panel de liberación para registrar los gastos pagados (se crea CostoLanded categoría Aduana).
            </div>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="space-y-1.5 max-h-[35vh] overflow-y-auto pr-1">
        {incidencias.slice(0, 10).map(inc => (
          <div key={inc.id} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg text-xs">
            <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />
            <span className="font-mono text-slate-700">{inc.sku || inc.unidadId?.slice(0, 8)}</span>
            {inc.productoNombre && <span className="text-slate-500 truncate">· {inc.productoNombre}</span>}
            <span className="ml-auto text-slate-400 text-[10px]">
              {(inc.fechaRetencion || inc.fechaRegistro).toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
            </span>
          </div>
        ))}
        {incidencias.length > 10 && (
          <div className="text-xs text-center text-slate-500">+{incidencias.length - 10} más…</div>
        )}
      </div>

      {/* Botones */}
      <div className="flex justify-between pt-3 border-t">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={onAbrirLiberar}>
          <ShieldAlert className="w-4 h-4 mr-1.5" />
          Abrir panel de liberación
        </Button>
      </div>
    </div>
  );
};
