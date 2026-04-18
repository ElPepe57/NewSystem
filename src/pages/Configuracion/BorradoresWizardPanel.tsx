import React, { useEffect, useState } from 'react';
import { FileText, Trash2, RefreshCw, ShoppingBag, Truck, AlertCircle } from 'lucide-react';
import {
  PageShell,
  PageHeader,
  StatusBadge,
  formatFechaRelativa,
} from '../../design-system';
import { borradorWizardService } from '../../services/borradorWizard.service';
import type { BorradorWizard } from '../../types/borradorWizard.types';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

/**
 * BorradoresWizardPanel — Página admin para gestionar borradores de wizards.
 *
 * Ruta: `/configuracion/borradores` (agregada en App.tsx)
 *
 * Funcionalidad (§10.3 ESPEC S41):
 * - Lista borradores activos en el sistema (todos los tipos y usuarios)
 * - Filtros por tipo (OC / Envío) y por antigüedad
 * - Borrar individual o en masa (checkbox selección múltiple)
 * - Expirar borradores >30 días con un click
 */
export const BorradoresWizardPanel: React.FC = () => {
  const toast = useToastStore();
  const currentUser = useAuthStore((s) => s.user);
  const [borradores, setBorradores] = useState<BorradorWizard[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'oc' | 'envio'>('todos');

  // ─── Carga ───────────────────────────────────────────────────────────────
  const cargar = async () => {
    setLoading(true);
    try {
      const lista = await borradorWizardService.listAll();
      setBorradores(lista);
    } catch (error: any) {
      toast.error(`Error cargando borradores: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  // ─── Filtrado ────────────────────────────────────────────────────────────
  const borradoresFiltrados = borradores.filter(
    (b) => filtroTipo === 'todos' || b.tipo === filtroTipo
  );

  // ─── Selección múltiple ──────────────────────────────────────────────────
  const toggleSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSeleccionTodos = () => {
    if (seleccionados.size === borradoresFiltrados.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(borradoresFiltrados.map((b) => b.id)));
    }
  };

  // ─── Acciones ────────────────────────────────────────────────────────────
  const borrarIndividual = async (b: BorradorWizard) => {
    if (!confirm(`¿Borrar borrador de ${b.tipo} del usuario ${b.userId}?`)) return;
    try {
      await borradorWizardService.delete(b.userId, b.tipo);
      toast.success('Borrador eliminado');
      cargar();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const borrarMasivo = async () => {
    if (seleccionados.size === 0) return;
    if (!confirm(`¿Borrar ${seleccionados.size} borradores seleccionados?`)) return;
    try {
      await borradorWizardService.deleteMultiple(Array.from(seleccionados));
      toast.success(`${seleccionados.size} borradores eliminados`);
      setSeleccionados(new Set());
      cargar();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const expirarAntiguos = async () => {
    if (!confirm('¿Eliminar todos los borradores con más de 30 días sin actualización?')) return;
    try {
      const count = await borradorWizardService.deleteExpired(30);
      toast.success(`${count} borradores antiguos eliminados`);
      cargar();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  // ─── Stats ───────────────────────────────────────────────────────────────
  const stats = {
    total: borradores.length,
    oc: borradores.filter((b) => b.tipo === 'oc').length,
    envio: borradores.filter((b) => b.tipo === 'envio').length,
    mios: borradores.filter((b) => b.userId === currentUser?.uid).length,
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <PageShell>
      <PageHeader
        title="Borradores de Wizards"
        subtitle="Gestión de borradores de OC y Envíos guardados por los usuarios (autoguardado)"
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard icon={<FileText />} label="Total borradores" value={stats.total} />
        <KpiCard
          icon={<ShoppingBag />}
          label="OCs"
          value={stats.oc}
          colorClass="text-sky-600 bg-sky-50"
        />
        <KpiCard
          icon={<Truck />}
          label="Envíos"
          value={stats.envio}
          colorClass="text-emerald-600 bg-emerald-50"
        />
        <KpiCard
          icon={<FileText />}
          label="Míos"
          value={stats.mios}
          colorClass="text-teal-600 bg-teal-50"
        />
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Filtrar:
          </span>
          <FilterPill active={filtroTipo === 'todos'} onClick={() => setFiltroTipo('todos')}>
            Todos ({stats.total})
          </FilterPill>
          <FilterPill active={filtroTipo === 'oc'} onClick={() => setFiltroTipo('oc')}>
            OCs ({stats.oc})
          </FilterPill>
          <FilterPill active={filtroTipo === 'envio'} onClick={() => setFiltroTipo('envio')}>
            Envíos ({stats.envio})
          </FilterPill>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cargar}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refrescar
          </button>
          <button
            type="button"
            onClick={expirarAntiguos}
            className="px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-300 hover:bg-amber-50 rounded-lg flex items-center gap-1.5"
            title="Eliminar borradores > 30 días"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Expirar &gt; 30 días
          </button>
          {seleccionados.size > 0 && (
            <button
              type="button"
              onClick={borrarMasivo}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Borrar {seleccionados.size}
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Cargando borradores...
          </div>
        ) : borradoresFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-medium text-slate-700">No hay borradores</div>
            <div className="text-xs text-slate-500 mt-1">
              {filtroTipo !== 'todos'
                ? `Sin borradores de tipo "${filtroTipo}"`
                : 'Los wizards sin completar aparecen aquí automáticamente'}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left w-8">
                  <input
                    type="checkbox"
                    checked={
                      seleccionados.size === borradoresFiltrados.length &&
                      borradoresFiltrados.length > 0
                    }
                    onChange={toggleSeleccionTodos}
                    className="w-4 h-4 rounded border-slate-300 text-teal-600"
                  />
                </th>
                <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                <th className="px-3 py-2 text-left font-semibold">Descripción</th>
                <th className="px-3 py-2 text-left font-semibold">Usuario</th>
                <th className="px-3 py-2 text-right font-semibold">Paso</th>
                <th className="px-3 py-2 text-right font-semibold">Monto USD</th>
                <th className="px-3 py-2 text-left font-semibold">Última edición</th>
                <th className="px-3 py-2 text-right font-semibold w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {borradoresFiltrados.map((b) => (
                <tr
                  key={b.id}
                  className={`hover:bg-slate-50 ${
                    seleccionados.has(b.id) ? 'bg-teal-50/40' : ''
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(b.id)}
                      onChange={() => toggleSeleccion(b.id)}
                      className="w-4 h-4 rounded border-slate-300 text-teal-600"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge variant={b.tipo === 'oc' ? 'info' : 'brand'}>
                      {b.tipo.toUpperCase()}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-slate-700 truncate max-w-[20rem]">
                    {b.resumen || <span className="text-slate-400 italic">Sin descripción</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500 truncate max-w-[12rem]">
                    {b.userId}
                    {b.userId === currentUser?.uid && (
                      <span className="ml-1 text-[10px] text-teal-600">(tú)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-600 tabular-nums">
                    {(b.pasoActual ?? 0) + 1}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {b.montoEstimado ? `$${b.montoEstimado.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {formatFechaRelativa(b.fechaActualizacion)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => borrarIndividual(b)}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ayuda */}
      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <strong>ℹ Cómo funciona:</strong> cada usuario puede tener máximo 1 borrador activo por
        tipo de wizard (OC o Envío). Los borradores se crean automáticamente cuando el usuario
        deja un wizard incompleto. Al continuar el wizard, el usuario decide si retomar desde el
        borrador o descartarlo.
      </div>
    </PageShell>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Internal components
// ════════════════════════════════════════════════════════════════════════════

const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass?: string;
}> = ({ icon, label, value, colorClass = 'text-slate-600 bg-slate-50' }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{value}</div>
      </div>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
        {React.cloneElement(
          icon as React.ReactElement<{ className?: string }>,
          { className: 'w-4 h-4' }
        )}
      </div>
    </div>
  </div>
);

const FilterPill: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
      active
        ? 'bg-teal-600 text-white'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
    }`}
  >
    {children}
  </button>
);
