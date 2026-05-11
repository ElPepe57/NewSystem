/**
 * AlertasWorkspace · workspace 4 · Cost Intelligence
 *
 * chk5.B10b (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-alertas.html`.
 *
 * Responde la pregunta: "¿Qué está mal AHORA que requiere acción inmediata?"
 *
 * Orquesta:
 *   - AlertCategoryCards · 4 cards (Variance · Pipeline · FX · Stock-DEUDA)
 *   - AlertasFiltros     · severity + estado + search + sort
 *   - AlertFeed          · cards apiladas F4
 *
 * Lógica:
 *   - 3 fuentes de alertas (variance + pipeline + fx) consolidadas del engine
 *   - Persistencia "marcar visto" en localStorage por userId
 *   - 3 empty states:
 *       a) sin data → CTA crear primera OC
 *       b) con data + 0 anomalías → "Todo bajo control" (banner emerald)
 *       c) con anomalías + filtros producen 0 → "Sin alertas que coincidan"
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ZapOff,
  ShieldCheck,
  Plus,
  ArrowRight,
  CheckCheck,
} from 'lucide-react';
import { useAuthStore } from '../../../../store/authStore';
import type {
  Alerta,
  AlertaCategoria,
  AlertaSeverity,
  AlertasConsolidadas,
  PipelineValorizado,
  SkuConCostos,
  TCPAvsSBS,
} from '../../utils/costIntelligence';
import {
  calcularAlertasConsolidadas,
  leerAlertasVistas,
  marcarAlertaVista as engineMarcarVista,
  desmarcarAlertaVista as engineDesmarcarVista,
  marcarTodasComoVistas as engineMarcarTodas,
} from '../../utils/costIntelligence';
import { AlertCategoryCards } from './alertas/AlertCategoryCards';
import { AlertasFiltros } from './alertas/AlertasFiltros';
import { AlertFeed } from './alertas/AlertFeed';

interface AlertasWorkspaceProps {
  skus: SkuConCostos[];
  pipeline: PipelineValorizado;
  tcpaVsSBS: TCPAvsSBS;
  /** true cuando el engine principal NO tiene data operacional · empty workspace */
  hasOperationalData: boolean;
}

export const AlertasWorkspace: React.FC<AlertasWorkspaceProps> = ({
  skus,
  pipeline,
  tcpaVsSBS,
  hasOperationalData,
}) => {
  const userId = useAuthStore((s) => s.user?.uid) ?? 'anon';

  // Consolidar alertas (solo si hay data operacional)
  const consolidadas = useMemo<AlertasConsolidadas>(
    () => calcularAlertasConsolidadas(skus, pipeline, tcpaVsSBS),
    [skus, pipeline, tcpaVsSBS]
  );

  // Set de IDs vistos · cargado desde localStorage al montar y al cambiar userId
  const [vistasIds, setVistasIds] = useState<Set<string>>(() => leerAlertasVistas(userId));

  useEffect(() => {
    setVistasIds(leerAlertasVistas(userId));
  }, [userId]);

  // Handlers persistencia
  const handleMarcarVista = useCallback((alertaId: string) => {
    if (vistasIds.has(alertaId)) {
      engineDesmarcarVista(userId, alertaId);
    } else {
      engineMarcarVista(userId, alertaId);
    }
    setVistasIds(leerAlertasVistas(userId));
  }, [userId, vistasIds]);

  const handleMarcarTodas = useCallback(() => {
    const idsNoVistos = consolidadas.alertas
      .filter((a) => !vistasIds.has(a.id))
      .map((a) => a.id);
    if (idsNoVistos.length === 0) return;
    engineMarcarTodas(userId, idsNoVistos);
    setVistasIds(leerAlertasVistas(userId));
  }, [userId, consolidadas.alertas, vistasIds]);

  // Acción primaria · placeholder MVP · handler real va en deuda
  const handleAccionPrimaria = useCallback((alerta: Alerta) => {
    const label = alerta.accionPrimaria?.label ?? 'Acción';
    alert(`${label} · próximamente`);
  }, []);

  // ─── Filtros locales ─────────────────────────────────────────────────────
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<AlertaCategoria | null>(null);
  const [severidadesSeleccionadas, setSeveridadesSeleccionadas] = useState<AlertaSeverity[]>([]);
  const [estadoFiltro, setEstadoFiltro] = useState<'todas' | 'sin_ver' | 'vistas'>('todas');
  const [search, setSearch] = useState('');
  const [sortValue, setSortValue] = useState<'severidad_desc' | 'fecha_desc'>('severidad_desc');

  const toggleSeveridad = (sev: AlertaSeverity) => {
    setSeveridadesSeleccionadas((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]
    );
  };

  // Counts dinámicos
  const countSinVer = useMemo(
    () => consolidadas.alertas.filter((a) => !vistasIds.has(a.id)).length,
    [consolidadas.alertas, vistasIds]
  );
  const countVistas = consolidadas.alertas.length - countSinVer;

  // Aplicar filtros
  const alertasVisibles = useMemo(() => {
    let res = consolidadas.alertas;

    // Filtro por categoría (desde category cards)
    if (categoriaSeleccionada) {
      res = res.filter((a) => a.category === categoriaSeleccionada);
    }

    // Filtro por severidades
    if (severidadesSeleccionadas.length > 0) {
      res = res.filter((a) => severidadesSeleccionadas.includes(a.severity));
    }

    // Filtro por estado visto
    if (estadoFiltro === 'sin_ver') {
      res = res.filter((a) => !vistasIds.has(a.id));
    } else if (estadoFiltro === 'vistas') {
      res = res.filter((a) => vistasIds.has(a.id));
    }

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      res = res.filter((a) =>
        a.titulo.toLowerCase().includes(q) ||
        a.descripcion.toLowerCase().includes(q) ||
        (a.contexto.sku && a.contexto.sku.toLowerCase().includes(q)) ||
        (a.contexto.productoNombre && a.contexto.productoNombre.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortValue === 'fecha_desc') {
      res = [...res].sort((a, b) => b.fechaDeteccion.getTime() - a.fechaDeteccion.getTime());
    }
    // severidad_desc ya viene del engine como default · no requiere re-sort

    return res;
  }, [
    consolidadas.alertas,
    categoriaSeleccionada,
    severidadesSeleccionadas,
    estadoFiltro,
    search,
    sortValue,
    vistasIds,
  ]);

  // ─── Empty state · sin data operacional ─────────────────────────────────
  if (!hasOperationalData) {
    return <EmptySinData />;
  }

  // ─── Empty state · todo bajo control · 0 anomalías ──────────────────────
  if (consolidadas.todoBajoControl) {
    return <EmptyTodoBajoControl tcpaActual={tcpaVsSBS.tcpaActual} />;
  }

  // ─── Render normal ───────────────────────────────────────────────────────
  const hayNoVistas = countSinVer > 0;

  return (
    <div className="space-y-4">
      {/* Botón "Marcar todo visto" · sólo si hay no-vistos */}
      {hayNoVistas && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleMarcarTodas}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Marcar todo visto ({countSinVer})
          </button>
        </div>
      )}

      <AlertCategoryCards
        consolidadas={consolidadas}
        categoriaSeleccionada={categoriaSeleccionada}
        onSeleccionar={setCategoriaSeleccionada}
      />

      <AlertasFiltros
        consolidadas={consolidadas}
        severidadesSeleccionadas={severidadesSeleccionadas}
        onToggleSeveridad={toggleSeveridad}
        estadoFiltro={estadoFiltro}
        onCambiarEstado={setEstadoFiltro}
        countSinVer={countSinVer}
        countVistas={countVistas}
        search={search}
        onCambiarSearch={setSearch}
        sortValue={sortValue}
        onCambiarSort={setSortValue}
      />

      <AlertFeed
        alertas={alertasVisibles}
        totalSinFiltros={consolidadas.totalActivas}
        vistasIds={vistasIds}
        onMarcarVista={handleMarcarVista}
        onAccionPrimaria={handleAccionPrimaria}
      />
    </div>
  );
};

// ─── Empty A · sin data operacional ──────────────────────────────────────────
const EmptySinData: React.FC = () => (
  <div className="bg-white border border-slate-200 rounded-xl p-12">
    <div className="max-w-lg mx-auto text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 ring-1 ring-teal-200/50 flex items-center justify-center mx-auto mb-4">
        <ZapOff className="w-10 h-10 text-teal-700" />
      </div>
      <h2 className="text-lg font-bold text-slate-900 mb-2">Sin data para monitorear</h2>
      <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-md mx-auto">
        Alertas detecta anomalías de costo, pipeline estancado y desviaciones FX.
        Hoy no hay transacciones operacionales para analizar — no podemos detectar
        problemas sobre data que no existe.
      </p>

      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Link
          to="/compras"
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Crear primera OC
        </Link>
        <Link
          to="/intel-productos"
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          Ver Catálogo
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="mt-6 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-500 text-left">
        <span className="font-bold">Nota:</span> Alertas se alimenta de la misma data que
        Catálogo y Pipeline. Cuando se active el módulo (≥1 OC cerrada + unidades en pipeline),
        Alertas empieza a monitorear automáticamente.
      </div>
    </div>
  </div>
);

// ─── Empty B · todo bajo control · banner positivo emerald ───────────────────
const EmptyTodoBajoControl: React.FC<{ tcpaActual: number | null }> = ({ tcpaActual }) => (
  <div className="bg-white border border-emerald-200 rounded-xl p-12">
    <div className="max-w-lg mx-auto text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 ring-1 ring-emerald-200/50 flex items-center justify-center mx-auto mb-4">
        <ShieldCheck className="w-10 h-10 text-emerald-700" />
      </div>
      <h2 className="text-lg font-bold text-slate-900 mb-2">Todo bajo control</h2>
      <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-md mx-auto">
        0 anomalías detectadas. El sistema sigue monitoreando automáticamente ·
        te avisaremos cuando algo se desvíe del baseline canónico.
      </p>

      {/* Mini stats emerald */}
      <div className="grid grid-cols-3 gap-2 mb-6 max-w-md mx-auto">
        <div className="bg-emerald-50/50 border border-emerald-200 rounded p-2">
          <div className="text-[9px] font-bold text-emerald-700 uppercase">Variance</div>
          <div className="text-base font-bold text-emerald-700 tabular-nums mt-0.5">Estable</div>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-200 rounded p-2">
          <div className="text-[9px] font-bold text-emerald-700 uppercase">Pipeline</div>
          <div className="text-base font-bold text-emerald-700 tabular-nums mt-0.5">OK</div>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-200 rounded p-2">
          <div className="text-[9px] font-bold text-emerald-700 uppercase">TCPA</div>
          <div className="text-base font-bold text-emerald-700 tabular-nums mt-0.5">
            {tcpaActual !== null ? tcpaActual.toFixed(2) : '—'}
          </div>
        </div>
      </div>

      <div className="text-[10px] text-slate-500">
        Política canon: variance &gt;10% = crítica · &gt;5% = alta · &gt;2% = media · ≤2% no se alerta
      </div>
    </div>
  </div>
);
