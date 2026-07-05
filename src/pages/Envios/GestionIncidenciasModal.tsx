/**
 * GestionIncidenciasModal — S40 Bloque C · migrado a FormModalV2 (visual canon)
 *
 * Reemplaza al antiguo `GestionDanadasModal`. Ahora cubre TRES tipos de incidencias
 * del envío en un solo panel con tabs:
 *
 *  - DAÑADAS: disposición baja_definitiva / devolucion_proveedor / reparacion_reingreso
 *  - PERDIDAS: opción "Crear reclamo" o "Registrar pérdida directa"
 *  - ADUANA: abre LiberarAduanaModal o permite descartar como pérdida
 *
 * Fixes incorporados (bugs pre-existentes del GestionDanadasModal):
 *  - DATA-001: el costo se lee del doc Unidad (getCTRU) vía fallback en el service
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
  CheckCheck,
  Image,
  Package,
  ShieldAlert,
  Gavel,
  XCircle,
  Info,
} from 'lucide-react';
import { FormModalV2 } from '../../design-system';
import { Badge } from '../../components/common';
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
  color: 'red' | 'amber' | 'emerald';
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
    color: 'emerald',
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
  // BUG-INC-002 fix (S54.x) — Responsable elegido en el modal de gestión.
  const [responsableParaReclamo, setResponsableParaReclamo] = useState<ResponsableDano | undefined>(undefined);

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
  const todasDecididas = resueltasDanadas === incidenciasDanadas.length && incidenciasDanadas.length > 0;

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
          costoUnidadPEN: 0,  // S40: el service deriva el costo con getCTRU del doc Unidad
          costoUnidadUSD: 0,
          evidenciaURL: inc.evidenciaURL,
        };
      });

      const resultados = await bajaInventarioService.procesarBajasLote(bajas, user.uid);

      const errores = resultados.filter(r => 'error' in r && r.error);
      const gastosGenerados = resultados.filter(r => r.gastoGenerado).length;
      const reclamosGenerados = resultados.filter(r => r.reclamoGenerado).length;

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
        // BUG-INC-002 fix (S54.x): tomamos el responsable de la primera
        // incidencia (todas las en incDevoluciones tienen responsable
        // distinto a 'sin_responsable' por filtro arriba).
        const responsableMayoritario =
          decisiones[incDevoluciones[0].id]?.responsable;
        setIncidenciasParaReclamo(incDevoluciones);
        setResponsableParaReclamo(responsableMayoritario);
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
          costoUnidadPEN: 0,  // Service deriva el costo con getCTRU
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

  // ─── Submit dispatcher por tab ──────────────────────────────────────────

  const handleSubmit = () => {
    if (activeTab === 'danadas') {
      if (!showConfirmacion) {
        setShowConfirmacion(true);
      } else {
        handleConfirmarBajas();
      }
    } else if (activeTab === 'perdidas') {
      handleAbrirReclamoPerdidas();
    } else if (activeTab === 'aduana') {
      setShowLiberarAduana(true);
    }
  };

  // ─── Labels y disabled por tab ──────────────────────────────────────────

  const cantSeleccionadasPerdidas = Object.values(selectedPerdidas).filter(Boolean).length;

  const submitLabel = (() => {
    if (activeTab === 'danadas') {
      return showConfirmacion ? 'Confirmar todo' : `Revisar y confirmar (${resueltasDanadas}/${incidenciasDanadas.length})`;
    }
    if (activeTab === 'perdidas') return `Crear reclamo (${cantSeleccionadasPerdidas})`;
    return 'Abrir panel de liberación';
  })();

  const submitDisabled = (() => {
    if (activeTab === 'danadas') return !todasDecididas || submitting;
    if (activeTab === 'perdidas') return submitting || cantSeleccionadasPerdidas === 0;
    return false;
  })();

  const submitIcon = (() => {
    if (activeTab === 'danadas') return showConfirmacion ? CheckCheck : CheckCircle;
    if (activeTab === 'perdidas') return Gavel;
    return ShieldAlert;
  })();

  // ─── footerExtras: botón secundario para Perdidas (Descartar) ──────────

  const footerExtras = activeTab === 'perdidas' ? (
    <button
      type="button"
      onClick={handleDescartarPerdidas}
      disabled={submitting || cantSeleccionadasPerdidas === 0}
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Trash2 className="w-3.5 h-3.5" />
      {submitting ? 'Procesando...' : `Descartar como merma (${cantSeleccionadasPerdidas})`}
    </button>
  ) : activeTab === 'danadas' && showConfirmacion ? (
    <button
      type="button"
      onClick={() => setShowConfirmacion(false)}
      disabled={submitting}
      className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
    >
      Atrás
    </button>
  ) : undefined;

  // ─── Si no hay incidencias ──────────────────────────────────────────────

  const totalIncidencias = incidenciasDanadas.length + incidenciasPerdidas.length + incidenciasAduana.length;

  if (totalIncidencias === 0) {
    return (
      <FormModalV2
        isOpen={true}
        onClose={onClose}
        onSubmit={onClose}
        title="Incidencias del envío"
        subtitle={transferencia.numeroEnvio}
        icon={CheckCircle}
        iconTone="emerald"
        color="orange"
        size="md"
        submitLabel="Cerrar"
        loading={false}
      >
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 mx-auto text-emerald-400 mb-3" />
          <p className="text-[13px] font-semibold text-slate-800">Sin incidencias pendientes</p>
          <p className="text-[12px] text-slate-500 mt-1">Todas las incidencias del envío están resueltas.</p>
        </div>
      </FormModalV2>
    );
  }

  // ─── Si está abierto el panel de reclamo, mostrar SOLO ese panel ────────

  if (showReclamoPanel && user) {
    return (
      <ReclamoPanel
        envio={transferencia}
        incidenciasSugeridas={incidenciasParaReclamo}
        // BUG-INC-002 + INC-003 fix (S54.x)
        responsableSugerido={responsableParaReclamo}
        userId={user.uid}
        onClose={() => {
          setShowReclamoPanel(false);
          setIncidenciasParaReclamo([]);
          setResponsableParaReclamo(undefined);
        }}
        onSuccess={() => {
          setShowReclamoPanel(false);
          setIncidenciasParaReclamo([]);
          setResponsableParaReclamo(undefined);
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

  // ─── Render principal ───────────────────────────────────────────────────

  return (
    <FormModalV2
      isOpen={true}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Gestionar incidencias"
      subtitle={`${transferencia.numeroEnvio} · decide destino de cada unidad`}
      icon={AlertTriangle}
      iconTone="red"
      color="orange"
      size="lg"
      submitLabel={submitLabel}
      submitIcon={submitIcon}
      loading={submitting}
      disabled={submitDisabled}
      footerExtras={footerExtras}
    >
      <div className="space-y-4">
        {/* Tabs internas */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 -mx-1 px-1 overflow-x-auto"
             style={{ scrollbarWidth: 'none' }}>
          <TabButton
            active={activeTab === 'danadas'}
            onClick={() => { setActiveTab('danadas'); setShowConfirmacion(false); }}
            icon={AlertTriangle}
            label="Dañadas"
            count={incidenciasDanadas.length}
            badgeColor="red"
          />
          <TabButton
            active={activeTab === 'perdidas'}
            onClick={() => { setActiveTab('perdidas'); setShowConfirmacion(false); }}
            icon={XCircle}
            label="Perdidas"
            count={incidenciasPerdidas.length}
            badgeColor="red"
          />
          <TabButton
            active={activeTab === 'aduana'}
            onClick={() => { setActiveTab('aduana'); setShowConfirmacion(false); }}
            icon={ShieldAlert}
            label="Aduana"
            count={incidenciasAduana.length}
            badgeColor="amber"
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
          />
        )}

        {/* Tab Perdidas */}
        {activeTab === 'perdidas' && (
          <PerdidasTabContent
            incidencias={incidenciasPerdidas}
            selected={selectedPerdidas}
            setSelected={setSelectedPerdidas}
            getUnidadInfo={getUnidadInfo}
          />
        )}

        {/* Tab Aduana */}
        {activeTab === 'aduana' && (
          <AduanaTabContent
            incidencias={incidenciasAduana}
          />
        )}
      </div>
    </FormModalV2>
  );
};

// ─── Sub-componente: tab button ───────────────────────────────────────────

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count: number;
  badgeColor: 'red' | 'amber';
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon: Icon, label, count, badgeColor }) => {
  const badgeClass = badgeColor === 'red'
    ? 'text-red-600 bg-red-100'
    : 'text-amber-600 bg-amber-100';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-1 pb-2.5 text-[12px] font-medium whitespace-nowrap transition-colors ${
        active
          ? 'text-red-700 border-b-2 border-red-600 font-semibold'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {count > 0 && (
        <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full tabular-nums ${badgeClass}`}>
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
}

const DanadasTabContent: React.FC<DanadasTabContentProps> = ({
  incidencias, decisiones, updateDecision, getUnidadInfo,
  resueltas, todasDecididas, showConfirmacion,
}) => {
  if (incidencias.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-10 w-10 mx-auto text-emerald-400 mb-2" />
        <p className="text-[12px] text-slate-500">Sin unidades dañadas pendientes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progreso */}
      <div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Progreso</span>
          <span className="tabular-nums font-semibold text-slate-600">
            {resueltas} de {incidencias.length} decididas
          </span>
        </div>
        <div className="h-1 bg-slate-200 rounded-full mt-1">
          <div
            className="h-1 bg-orange-500 rounded-full transition-all"
            style={{ width: `${incidencias.length ? (resueltas / incidencias.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Lista de unidades */}
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
              {/* Cabecera de la unidad */}
              <div className="p-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-800 truncate">
                        {producto?.marca} — {producto?.nombreComercial || inc.productoNombre}
                      </p>
                      <p className="text-[11px] text-slate-500">{inc.sku}</p>
                    </div>
                  </div>
                  {inc.evidenciaURL && (
                    <a
                      href={inc.evidenciaURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-sky-600 hover:text-sky-800 flex-shrink-0"
                    >
                      <Image className="h-3.5 w-3.5" />
                      Ver evidencia
                    </a>
                  )}
                </div>
                {inc.descripcion && (
                  <p className="text-[11px] text-slate-600 mt-1 italic">"{inc.descripcion}"</p>
                )}
              </div>

              {/* Opciones de disposición — grid de cards (canon mockup ACTO 11) */}
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Disposición de la unidad">
                  {OPCIONES_DISPOSICION.map(op => {
                    const isSelected = decision?.disposicion === op.value;
                    const Icon = op.icon;
                    const selectedBorder = op.color === 'red'
                      ? 'border-2 border-red-500 bg-red-50/50 ring-2 ring-red-500/20'
                      : op.color === 'amber'
                      ? 'border-2 border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20'
                      : 'border-2 border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20';
                    const iconColorSelected = op.color === 'red' ? 'text-red-600'
                      : op.color === 'amber' ? 'text-amber-600'
                      : 'text-emerald-600';
                    return (
                      <button
                        key={op.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => updateDecision(inc.id, 'disposicion', op.value)}
                        title={op.descripcion}
                        className={`text-left rounded-lg p-2 transition-colors ${
                          isSelected
                            ? selectedBorder
                            : 'border-2 border-slate-200 bg-white hover:border-red-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Icon className={`w-4 h-4 ${isSelected ? iconColorSelected : 'text-slate-400'}`} />
                          {isSelected ? (
                            <CheckCircle className={`w-3.5 h-3.5 ${iconColorSelected}`} />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 flex-shrink-0" />
                          )}
                        </div>
                        <div className={`text-[10px] font-bold leading-tight ${isSelected ? 'text-slate-900' : 'text-slate-600 font-medium'}`}>
                          {op.label}
                        </div>
                        <div className="text-[9px] text-slate-500 leading-tight mt-0.5">{op.descripcion}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Selector de responsable (solo cuando devolucion elegida) */}
                {decision?.disposicion === 'devolucion_proveedor' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Responsable</label>
                    <select
                      value={decision.responsable}
                      onChange={e => updateDecision(inc.id, 'responsable', e.target.value)}
                      className="w-full text-[12px] border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {OPCIONES_RESPONSABLE.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    {decision.responsable !== 'sin_responsable' && (
                      <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                        <Gavel className="h-3 w-3" />
                        Se abrirá panel de reclamo al confirmar.
                      </p>
                    )}
                  </div>
                )}

                {/* Campo de motivo (cuando hay disposición elegida) */}
                {decision?.disposicion && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Motivo (opcional)</label>
                    <input
                      type="text"
                      value={decision.motivo}
                      onChange={e => updateDecision(inc.id, 'motivo', e.target.value)}
                      placeholder="Ej: Tapa rota durante el vuelo"
                      className="w-full text-[12px] border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Nota informativa */}
      <div className="flex items-start gap-2 text-[11px] text-slate-500">
        <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
        <span>
          Baja definitiva genera{' '}
          <span className="font-semibold text-slate-600">gasto automático</span>{' '}
          (cuenta <span className="tabular-nums">6952</span>).
        </span>
      </div>

      {/* Panel de revisión antes de confirmar */}
      {showConfirmacion && todasDecididas && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-[12px] font-semibold text-slate-900 mb-2">Se ejecutarán las siguientes acciones:</p>
          <ul className="space-y-1.5">
            {incidencias.map(inc => {
              const decision = decisiones[inc.id];
              const opcion = OPCIONES_DISPOSICION.find(o => o.value === decision?.disposicion);
              return (
                <li key={inc.id} className="flex items-center gap-2 text-[11px] text-slate-700">
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
    </div>
  );
};

// ─── Tab Perdidas content ─────────────────────────────────────────────────

interface PerdidasTabContentProps {
  incidencias: IncidenciaEnvio[];
  selected: Record<string, boolean>;
  setSelected: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  getUnidadInfo: (inc: IncidenciaEnvio) => { unidad?: any; producto?: Producto };
}

const PerdidasTabContent: React.FC<PerdidasTabContentProps> = ({
  incidencias, selected, setSelected, getUnidadInfo,
}) => {
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
      <div className="text-center py-8">
        <CheckCircle className="h-10 w-10 mx-auto text-emerald-400 mb-2" />
        <p className="text-[12px] text-slate-500">Sin unidades perdidas pendientes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Banner informativo — semántico red */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[12px] font-semibold text-red-900">
              {incidencias.length} unidad{incidencias.length !== 1 ? 'es' : ''} perdida{incidencias.length !== 1 ? 's' : ''} en tránsito
            </div>
            <div className="text-[11px] text-red-700 mt-0.5">
              Decide: <strong>Crear reclamo</strong> al courier/proveedor (recupera valor) o <strong>Descartar</strong> directo como merma.
            </div>
          </div>
        </div>
      </div>

      {/* Lista con checkboxes */}
      <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1 border border-slate-200 rounded-lg p-2">
        {incidencias.map(inc => {
          const { unidad, producto } = getUnidadInfo(inc);
          const checked = !!selected[inc.id];
          return (
            <label
              key={inc.id}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${checked ? 'bg-red-50/50' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={e => setSelected(prev => ({ ...prev, [inc.id]: e.target.checked }))}
                className="h-4 w-4 text-red-600 rounded focus:ring-orange-500"
              />
              <Package className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-slate-900 truncate">
                  {producto?.marca} — {producto?.nombreComercial || inc.productoNombre}
                </div>
                <div className="text-[11px] text-slate-500">
                  {unidad?.codigoUnidad || inc.unidadId?.slice(0, 8)} · {inc.sku}
                </div>
              </div>
              <div className="text-[11px] text-red-700 tabular-nums flex-shrink-0">
                {inc.fechaRegistro.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};

// ─── Tab Aduana content ───────────────────────────────────────────────────

interface AduanaTabContentProps {
  incidencias: IncidenciaEnvio[];
}

const AduanaTabContent: React.FC<AduanaTabContentProps> = ({ incidencias }) => {
  if (incidencias.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-10 w-10 mx-auto text-emerald-400 mb-2" />
        <p className="text-[12px] text-slate-500">Sin unidades retenidas en aduana.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Banner informativo — semántico amber (costos/aduana) */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[12px] font-semibold text-amber-900">
              {incidencias.length} unidad{incidencias.length !== 1 ? 'es' : ''} retenida{incidencias.length !== 1 ? 's' : ''} en aduana
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">
              Abre el panel de liberación para registrar los gastos pagados (se crea CostoLanded categoría Aduana).
            </div>
          </div>
        </div>
      </div>

      {/* Lista de unidades retenidas */}
      <div className="space-y-1.5 max-h-[35vh] overflow-y-auto pr-1">
        {incidencias.slice(0, 10).map(inc => (
          <div key={inc.id} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <span className="font-mono text-[11px] text-slate-700">{inc.sku || inc.unidadId?.slice(0, 8)}</span>
            {inc.productoNombre && (
              <span className="text-[11px] text-slate-500 truncate">· {inc.productoNombre}</span>
            )}
            <span className="ml-auto text-[10px] text-slate-400 tabular-nums flex-shrink-0">
              {(inc.fechaRetencion || inc.fechaRegistro).toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
            </span>
          </div>
        ))}
        {incidencias.length > 10 && (
          <div className="text-[11px] text-center text-slate-500">+{incidencias.length - 10} más…</div>
        )}
      </div>
    </div>
  );
};
